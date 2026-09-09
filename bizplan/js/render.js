/* Markdown rendering and document assembly.
 *
 * The markdown converter is deliberately small and written here rather than
 * pulled from a CDN: model output is untrusted text, so it is HTML-escaped
 * FIRST and only then given structure. Nothing the model writes can inject
 * markup into the page.
 *
 * Public: BP.Render.{markdown, escapeHtml, plan, sectionCard, metricGrid, scorecard} */
(function (root) {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Inline spans, applied to already-escaped text. */
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, (_, c) => '<code>' + c + '</code>')
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      // Bracketed research tasks are a first-class idea in this app: the model
      // is told to flag unverified claims this way, so they get a visible chip.
      .replace(/\[VERIFY:([^\]]+)\]/gi, (_, t) => '<mark class="verify">Verify:' + t + '</mark>')
      // Links: only http(s) and mailto survive, so a model cannot emit javascript:.
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
        (_, text, href) => '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + text + '</a>');
  }

  function markdown(src) {
    if (!src) return '';
    const lines = escapeHtml(src).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;

    const flushParagraph = buf => {
      if (buf.length) out.push('<p>' + inline(buf.join(' ')) + '</p>');
      buf.length = 0;
    };
    const para = [];

    while (i < lines.length) {
      const line = lines[i];

      // Fenced code
      if (/^\s*```/.test(line)) {
        flushParagraph(para);
        const body = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
        i++;
        out.push('<pre><code>' + body.join('\n') + '</code></pre>');
        continue;
      }

      // Table — a header row followed by a separator row of dashes.
      if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1])) {
        flushParagraph(para);
        const cells = r => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
        const head = cells(line);
        const align = cells(lines[i + 1]).map(a =>
          /^:-+:$/.test(a) ? 'center' : /-+:$/.test(a) ? 'right' : 'left');
        i += 2;
        const body = [];
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) body.push(cells(lines[i++]));
        out.push('<div class="table-scroll"><table><thead><tr>' +
          head.map((h, c) => '<th style="text-align:' + (align[c] || 'left') + '">' + inline(h) + '</th>').join('') +
          '</tr></thead><tbody>' +
          body.map(r => '<tr>' + r.map((c, ci) =>
            '<td style="text-align:' + (align[ci] || 'left') + '">' + inline(c) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>');
        continue;
      }

      // Headings
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushParagraph(para);
        const level = Math.min(6, h[1].length + 1); // shift down: plan supplies h2
        out.push('<h' + level + '>' + inline(h[2]) + '</h' + level + '>');
        i++; continue;
      }

      // Horizontal rule
      if (/^\s*([-*_])\s*\1\s*\1[\s\S]*$/.test(line) && !/\w/.test(line)) {
        flushParagraph(para); out.push('<hr>'); i++; continue;
      }

      // Blockquote
      if (/^\s*>\s?/.test(line)) {
        flushParagraph(para);
        const body = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
        out.push('<blockquote>' + markdown(body.join('\n')) + '</blockquote>');
        continue;
      }

      // Lists (ordered and unordered, one level — plans rarely need more)
      const li = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
      if (li) {
        flushParagraph(para);
        const ordered = /\d/.test(li[1]);
        const items = [];
        while (i < lines.length) {
          const m2 = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
          if (!m2) {
            // A wrapped continuation line belongs to the item above it.
            if (items.length && lines[i].trim() && !/^\s*$/.test(lines[i]) && /^\s{2,}/.test(lines[i])) {
              items[items.length - 1] += ' ' + lines[i].trim(); i++; continue;
            }
            break;
          }
          items.push(m2[2]); i++;
        }
        const tag = ordered ? 'ol' : 'ul';
        out.push('<' + tag + '>' + items.map(t => '<li>' + inline(t) + '</li>').join('') + '</' + tag + '>');
        continue;
      }

      if (!line.trim()) { flushParagraph(para); i++; continue; }
      para.push(line.trim());
      i++;
    }
    flushParagraph(para);
    return out.join('\n');
  }

  /* --- document furniture ---------------------------------------------- */

  const fmtMoney = (n, cur) => root.BP.Charts.compact(n, cur);
  const fmtPct = n => (n === null || n === undefined || !Number.isFinite(n)) ? '—' : (n * 100).toFixed(1) + '%';

  /* The headline numbers, all computed. Each tile names its own basis so a
   * reader never has to ask where a figure came from. */
  function metricGrid(projection, currency) {
    if (!projection) return '';
    const m = projection.metrics, t = projection.totals, cur = currency || '';
    const tone = (ok, warn) => ok ? 'good' : (warn ? 'warning' : 'critical');

    const tiles = [
      { label: 'Ending ARR', value: fmtMoney(m.endingArr, cur),
        note: 'Month ' + projection.months.length + ' recurring revenue × 12' },
      { label: 'Gross margin', value: fmtPct(m.grossMarginPct),
        note: 'Final month', tone: tone(m.grossMarginPct >= 0.7, m.grossMarginPct >= 0.4) },
      { label: 'LTV : CAC', value: m.ltvCacRatio === null ? '—' : m.ltvCacRatio.toFixed(1) + ':1',
        note: '3:1 is the investor bar', tone: m.ltvCacRatio === null ? null : tone(m.ltvCacRatio >= 3, m.ltvCacRatio >= 2) },
      { label: 'CAC payback', value: m.cacPaybackMonths === null ? '—' : Math.round(m.cacPaybackMonths) + ' mo',
        note: 'Under 12 months is healthy',
        tone: m.cacPaybackMonths === null ? null : tone(m.cacPaybackMonths <= 12, m.cacPaybackMonths <= 18) },
      { label: 'Break-even', value: m.breakEvenLabel || 'Not reached',
        note: m.breakEvenMonth ? 'Month ' + m.breakEvenMonth + ' — first positive EBITDA' : 'Inside the horizon',
        tone: m.breakEvenMonth ? 'good' : 'warning' },
      { label: 'Peak burn', value: fmtMoney(m.peakBurn, cur), note: 'Worst single month' },
      { label: 'Lowest cash', value: fmtMoney(m.lowestCash, cur),
        note: 'Month ' + m.lowestCashMonth, tone: m.lowestCash < 0 ? 'critical' : 'good' },
      { label: m.capitalRequired > 0 ? 'Capital shortfall' : 'Ending cash',
        value: fmtMoney(m.capitalRequired > 0 ? m.capitalRequired : t.endingCash, cur),
        note: m.capitalRequired > 0 ? 'More than the plan raises' : 'After the full horizon',
        tone: m.capitalRequired > 0 ? 'critical' : 'good' },
    ];

    return '<div class="metric-grid">' + tiles.map(t2 =>
      '<div class="metric' + (t2.tone ? ' is-' + t2.tone : '') + '">' +
      '<div class="metric-label">' + escapeHtml(t2.label) + '</div>' +
      '<div class="metric-value">' + escapeHtml(t2.value) + '</div>' +
      '<div class="metric-note">' + escapeHtml(t2.note) + '</div></div>').join('') + '</div>';
  }

  /* Readiness scorecard: the number, the band, the weighted bars, the gaps. */
  function scorecard(score) {
    if (!score) return '<p class="muted">Generate the plan to see its readiness score.</p>';
    const r = 52, circ = 2 * Math.PI * r;
    const dash = circ * (score.total / 100);

    const ring =
      '<svg class="score-ring" viewBox="0 0 130 130" role="img" aria-label="Readiness ' + score.total + ' out of 100">' +
      '<circle cx="65" cy="65" r="' + r + '" class="ring-track"/>' +
      '<circle cx="65" cy="65" r="' + r + '" class="ring-value is-' + score.tone + '" ' +
      'stroke-dasharray="' + dash.toFixed(1) + ' ' + circ.toFixed(1) + '" ' +
      'transform="rotate(-90 65 65)"/>' +
      '<text x="65" y="62" class="ring-num" text-anchor="middle">' + score.total + '</text>' +
      '<text x="65" y="82" class="ring-den" text-anchor="middle">/ 100</text></svg>';

    const bars = score.dimensions.map(d =>
      '<div class="dim">' +
      '<div class="dim-head"><span>' + escapeHtml(d.label) + '</span>' +
      '<span class="dim-num">' + Math.round(d.score) + '<span class="muted">/' + d.weight + '</span></span></div>' +
      '<div class="dim-track"><div class="dim-fill" style="width:' + (d.pct * 100).toFixed(0) + '%"></div></div>' +
      '<div class="dim-detail">' + escapeHtml(d.detail) + '</div></div>').join('');

    const gaps = score.gaps.length
      ? '<ul class="gap-list">' + score.gaps.slice(0, 12).map(g =>
          '<li class="gap is-' + g.severity + '"><span class="gap-tag">' + g.severity + '</span>' +
          '<span><strong>' + escapeHtml(g.dimension) + '</strong> — ' + escapeHtml(g.text) + '</span></li>').join('') + '</ul>'
      : '<p class="muted">No gaps found. That is rare — read it again anyway.</p>';

    const next = score.nextBest.length
      ? '<p class="next-best">Fastest points available: ' +
        score.nextBest.map(n => '<strong>' + escapeHtml(n.label) + '</strong> (+' + n.pointsAvailable + ')').join(', ') +
        '.</p>' : '';

    return '<div class="scorecard">' +
      '<div class="score-hero">' + ring +
      '<div><div class="score-band is-' + score.tone + '">' + escapeHtml(score.band) + '</div>' +
      '<p class="score-note">' + escapeHtml(score.note) + '</p>' + next + '</div></div>' +
      '<div class="dims">' + bars + '</div>' +
      '<h3 class="gap-title">What is holding the score down</h3>' + gaps + '</div>';
  }

  /* Warnings the financial engine raised about its own output. */
  function warningList(projection) {
    if (!projection || !projection.warnings.length) {
      return '<p class="muted">The model raised no flags on these assumptions.</p>';
    }
    return '<ul class="warn-list">' + projection.warnings.map(w =>
      '<li class="warn is-' + w.level + '"><span class="warn-tag">' + w.level + '</span>' +
      escapeHtml(w.message) + '</li>').join('') + '</ul>';
  }

  root.BP = root.BP || {};
  root.BP.Render = { markdown, escapeHtml, inline, metricGrid, scorecard, warningList, fmtPct };
})(typeof globalThis !== 'undefined' ? globalThis : this);
