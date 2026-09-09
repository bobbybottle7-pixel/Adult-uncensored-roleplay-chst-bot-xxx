/* Exports. A plan you cannot take with you is not your plan.
 *
 * Markdown  — the full document, model tables included, for any editor.
 * HTML      — styled, self-contained, opens anywhere.
 * PDF       — via the browser's own print pipeline (no library, no upload).
 * CSV       — the complete month-by-month model, for Excel or Sheets.
 * JSON      — everything, round-trips back through Store.importPlan.
 *
 * Public: BP.Export.{markdown, html, csv, json, print, download} */
(function (root) {
  'use strict';

  const cfg = () => root.BP.config;
  const money = (n, cur) => Number.isFinite(n) ? (cur || '') + Math.round(n).toLocaleString() : '';
  const pctS = n => Number.isFinite(n) ? (n * 100).toFixed(1) + '%' : '';

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    // Revoke on the next tick — revoking synchronously can cancel the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const slug = s => String(s || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 48) || 'plan';

  /* --- financial tables, shared by every text export ------------------- */

  function annualTable(projection, cur) {
    const rows = projection.years.map(y => [
      'Year ' + y.year, money(y.revenue, cur), money(y.cogs, cur), money(y.grossProfit, cur),
      pctS(y.grossMarginPct), money(y.opex, cur), money(y.ebitda, cur),
      pctS(y.ebitdaMarginPct), money(y.endingCash, cur),
      Math.round(y.endingCustomers).toLocaleString(), Math.round(y.endingHeadcount),
    ]);
    const head = ['Period', 'Revenue', 'COGS', 'Gross profit', 'GM%', 'Opex', 'EBITDA', 'EBITDA%',
      'Ending cash', 'Customers', 'Headcount'];
    return { head, rows };
  }

  function mdTable(head, rows) {
    return '| ' + head.join(' | ') + ' |\n' +
      '|' + head.map(() => '---').join('|') + '|\n' +
      rows.map(r => '| ' + r.join(' | ') + ' |').join('\n');
  }

  function metricsRows(projection, cur) {
    const m = projection.metrics;
    return [
      ['Ending ARR', money(m.endingArr, cur)],
      ['Ending customers', Math.round(m.endingCustomers).toLocaleString()],
      ['Gross margin (final month)', pctS(m.grossMarginPct)],
      ['Blended CAC', money(m.blendedCac, cur)],
      ['Lifetime value (LTV)', m.ltv === null ? 'undefined at zero churn' : money(m.ltv, cur)],
      ['LTV : CAC', m.ltvCacRatio === null ? '—' : m.ltvCacRatio.toFixed(2) + ':1'],
      ['CAC payback', m.cacPaybackMonths === null ? '—' : Math.round(m.cacPaybackMonths) + ' months'],
      ['Operating break-even', m.breakEvenLabel ? m.breakEvenLabel + ' (month ' + m.breakEvenMonth + ')' : 'not reached'],
      ['Average monthly burn', money(m.avgMonthlyBurn, cur)],
      ['Peak monthly burn', money(m.peakBurn, cur) + ' (month ' + m.peakBurnMonth + ')'],
      ['Lowest cash point', money(m.lowestCash, cur) + ' (month ' + m.lowestCashMonth + ')'],
      ['Additional capital required', m.capitalRequired > 0 ? money(m.capitalRequired, cur) : 'none'],
      ['Runway at current burn', m.runwayMonths === null ? 'self-funding' : Math.round(m.runwayMonths) + ' months'],
      ['Rule of 40', m.ruleOf40 === null ? '—' : Math.round(m.ruleOf40)],
    ];
  }

  /* --- markdown --------------------------------------------------------- */

  function markdown(plan, projection) {
    const cur = (plan.intake && plan.intake.currency) || '';
    const out = [];
    out.push('# ' + (plan.title || 'Business Plan'));
    if (plan.intake && plan.intake.pitch) out.push('\n> ' + plan.intake.pitch);
    out.push('\n_Prepared ' + new Date(plan.updatedAt || Date.now()).toLocaleDateString() +
      ' · Financial model computed over ' + (projection ? projection.months.length : 0) + ' months_');

    if (plan.score) {
      out.push('\n**Investor readiness: ' + plan.score.total + '/100 — ' + plan.score.band + '**');
    }

    cfg().sections.forEach(def => {
      const s = plan.sections[def.id];
      if (!s || !s.content) return;
      out.push('\n---\n\n## ' + def.title + '\n');
      out.push(s.content);

      // The financial section carries the computed tables straight after it.
      if (def.id === 'financials' && projection) {
        const t = annualTable(projection, cur);
        out.push('\n### Annual summary\n');
        out.push(mdTable(t.head, t.rows));
        out.push('\n### Key metrics\n');
        out.push(mdTable(['Metric', 'Value'], metricsRows(projection, cur)));
        if (projection.warnings.length) {
          out.push('\n### Model flags\n');
          projection.warnings.forEach(w => out.push('- **' + w.level.toUpperCase() + '** — ' + w.message));
        }
      }
    });

    const companions = cfg().companions.filter(c => plan.companions[c.id]);
    if (companions.length) {
      out.push('\n\n---\n\n# Appendices\n');
      companions.forEach(c => {
        out.push('\n## ' + c.title + '\n');
        out.push(plan.companions[c.id].content);
      });
    }

    if (plan.score && plan.score.gaps.length) {
      out.push('\n\n---\n\n## Readiness gaps\n');
      plan.score.gaps.forEach(g => out.push('- **' + g.severity + '** (' + g.dimension + ') — ' + g.text));
    }

    out.push('\n\n---\n\n_Every figure in this plan was computed from stated assumptions by ' +
      cfg().appName + ', not written by a language model._');
    return out.join('\n');
  }

  /* --- html ------------------------------------------------------------- */

  function html(plan, projection) {
    const R = root.BP.Render;
    const cur = (plan.intake && plan.intake.currency) || '';
    const esc = R.escapeHtml;
    const body = [];

    body.push('<header class="doc-head"><h1>' + esc(plan.title || 'Business Plan') + '</h1>');
    if (plan.intake && plan.intake.pitch) body.push('<p class="lede">' + esc(plan.intake.pitch) + '</p>');
    body.push('<p class="meta">Prepared ' + esc(new Date(plan.updatedAt || Date.now()).toLocaleDateString()) +
      (plan.score ? ' · Investor readiness ' + plan.score.total + '/100 — ' + esc(plan.score.band) : '') + '</p></header>');

    if (projection) body.push(R.metricGrid(projection, cur));

    cfg().sections.forEach(def => {
      const s = plan.sections[def.id];
      if (!s || !s.content) return;
      body.push('<section><h2>' + esc(def.title) + '</h2>' + R.markdown(s.content) + '</section>');
      if (def.id === 'financials' && projection) {
        const t = annualTable(projection, cur);
        body.push('<h3>Annual summary</h3><div class="table-scroll"><table><thead><tr>' +
          t.head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
          t.rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>');
        body.push('<h3>Key metrics</h3><div class="table-scroll"><table><tbody>' +
          metricsRows(projection, cur).map(r =>
            '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>').join('') +
          '</tbody></table></div>');
      }
    });

    const companions = cfg().companions.filter(c => plan.companions[c.id]);
    if (companions.length) {
      body.push('<h1 class="appendix-title">Appendices</h1>');
      companions.forEach(c => body.push('<section><h2>' + esc(c.title) + '</h2>' +
        R.markdown(plan.companions[c.id].content) + '</section>'));
    }

    // Self-contained: styles inline so the file works from a USB stick.
    return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(plan.title || 'Business Plan') + '</title><style>' + printCss() + '</style></head>' +
      '<body class="doc">' + body.join('\n') + '</body></html>';
  }

  function printCss() {
    return [
      ':root{--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;--rule:#e1e0d9;--surface:#fcfcfb;',
      '--s1:#2a78d6;--s2:#eb6834;--good:#0ca30c;--warn:#fab219;--crit:#d03b3b;}',
      '*{box-sizing:border-box}body.doc{margin:0 auto;padding:48px 32px;max-width:52rem;background:var(--surface);',
      'color:var(--ink);font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif;}',
      '.doc-head{border-bottom:2px solid var(--ink);padding-bottom:18px;margin-bottom:28px}',
      'h1{font-size:2.1rem;line-height:1.15;margin:0 0 8px}h2{font-size:1.4rem;margin:2.2em 0 .6em;',
      'padding-bottom:.3em;border-bottom:1px solid var(--rule)}h3{font-size:1.08rem;margin:1.6em 0 .5em}',
      '.lede{font-size:1.15rem;color:var(--ink2);margin:0 0 8px}.meta{color:var(--muted);font-size:.86rem;margin:0}',
      'p{margin:0 0 1em}ul,ol{margin:0 0 1em;padding-left:1.3em}li{margin:.3em 0}',
      'table{border-collapse:collapse;width:100%;font-size:.88rem;margin:0 0 1.2em}',
      'th,td{border:1px solid var(--rule);padding:7px 10px;text-align:left;vertical-align:top}',
      'th{background:#f2f1ed;font-weight:600}td{font-variant-numeric:tabular-nums}',
      '.table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}',
      'blockquote{margin:0 0 1em;padding:.5em 1em;border-left:3px solid var(--s1);color:var(--ink2);background:#f6f5f2}',
      'code{background:#f2f1ed;padding:.12em .35em;border-radius:3px;font-size:.9em}',
      'pre{background:#f2f1ed;padding:12px;overflow-x:auto;border-radius:6px}pre code{background:none;padding:0}',
      'mark.verify{background:#fff3d4;border-bottom:1px dashed var(--warn);padding:.05em .3em;border-radius:3px;font-size:.92em}',
      '.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;margin:0 0 28px}',
      '.metric{border:1px solid var(--rule);border-radius:8px;padding:12px 14px;background:#fff}',
      '.metric-label{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}',
      '.metric-value{font-size:1.35rem;font-weight:650;margin:3px 0 2px}',
      '.metric-note{font-size:.74rem;color:var(--muted);line-height:1.35}',
      '.metric.is-good .metric-value{color:var(--good)}.metric.is-warning .metric-value{color:#b07d00}',
      '.metric.is-critical .metric-value{color:var(--crit)}',
      '.appendix-title{margin-top:2.5em;border-top:2px solid var(--ink);padding-top:24px}',
      'a{color:var(--s1)}hr{border:0;border-top:1px solid var(--rule);margin:2em 0}',
      '@media print{body.doc{padding:0;max-width:none}h1,h2,h3{break-after:avoid}',
      'table,blockquote,.metric-grid{break-inside:avoid}section{break-before:auto}',
      '.metric{border-color:#ccc}a{text-decoration:none;color:inherit}}',
    ].join('');
  }

  /* --- csv -------------------------------------------------------------- */

  function csv(projection) {
    if (!projection) return '';
    const q = v => {
      const s = String(v === null || v === undefined ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const round = n => Number.isFinite(n) ? Math.round(n * 100) / 100 : '';

    const head = ['Month', 'Label', 'New customers', 'From paid', 'Organic', 'Churned',
      'Active customers', 'Employees', 'Revenue', 'MRR', 'COGS', 'Gross profit', 'Gross margin %',
      'Payroll opex', 'Paid acquisition', 'Other opex', 'Total opex', 'EBITDA', 'EBITDA margin %',
      'Tax', 'Net income', 'Collected', 'Cash costs', 'Funding in', 'Net cash flow', 'Cash balance'];

    const rows = projection.months.map(m => [
      m.month, m.label, round(m.newCustomers), round(m.newFromPaid), round(m.newOrganic),
      round(m.churnedCustomers), round(m.customers), round(m.employees),
      round(m.revenue), round(m.mrr), round(m.cogs), round(m.grossProfit),
      round(m.grossMarginPct * 100), round(m.opexPayroll), round(m.paidSpend),
      round(m.otherOpex), round(m.totalOpex), round(m.ebitda), round(m.ebitdaMarginPct * 100),
      round(m.tax), round(m.netIncome), round(m.collected), round(m.cashCosts),
      round(m.fundingIn), round(m.netCashFlow), round(m.cash),
    ]);

    // A trailing metrics block, so one file carries the whole model.
    const cur = projection.assumptions.currency;
    const extra = [[], ['KEY METRICS'], ...metricsRows(projection, cur)];

    return [head, ...rows, ...extra].map(r => r.map(q).join(',')).join('\n');
  }

  /* --- json ------------------------------------------------------------- */

  function json(plan, projection) {
    return JSON.stringify({
      _format: 'ventureforge.plan.v1',
      _exportedAt: new Date().toISOString(),
      _note: 'Financial figures are reproducible: re-running the engine on `assumptions` regenerates the model exactly.',
      plan,
      computed: projection ? {
        metrics: projection.metrics, totals: projection.totals,
        years: projection.years, warnings: projection.warnings,
      } : null,
    }, null, 2);
  }

  /* --- print ------------------------------------------------------------ */

  /* Renders the document into a hidden iframe and prints that, so the app's
   * own chrome never appears in the PDF and the page keeps its state. */
  function print(plan, projection) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(html(plan, projection));
    doc.close();
    const go = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }
      finally { setTimeout(() => frame.remove(), 1500); }
    };
    if (doc.readyState === 'complete') setTimeout(go, 120);
    else frame.onload = () => setTimeout(go, 120);
  }

  root.BP = root.BP || {};
  root.BP.Export = {
    markdown, html, csv, json, print, download, slug,
    saveMarkdown: (p, pr) => download(slug(p.title) + '.md', markdown(p, pr), 'text/markdown'),
    saveHtml: (p, pr) => download(slug(p.title) + '.html', html(p, pr), 'text/html'),
    saveCsv: (p, pr) => download(slug(p.title) + '-model.csv', csv(pr), 'text/csv'),
    saveJson: (p, pr) => download(slug(p.title) + '.json', json(p, pr), 'application/json'),
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
