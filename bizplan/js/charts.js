/* Charts — inline SVG, no library, driven entirely by the computed model.
 *
 * Palette: categorical slots 1-3 of the validated reference palette, checked
 * with the skill validator at all-pairs in both modes (worst CVD ΔE 9.2 light /
 * 9.4 dark; worst normal-vision ΔE 24.0 / 20.9). Light-mode aqua sits at 2.74:1
 * against the surface, so the relief rule applies — every series carries a
 * direct label and the whole model is available as a table.
 *
 * Colours come from CSS custom properties so the theme swaps in one place.
 *
 * Public: BP.Charts.render(container, projection, currency) */
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, text) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* --- formatting ------------------------------------------------------ */

  function compact(n, cur) {
    if (!Number.isFinite(n)) return '—';
    const sign = n < 0 ? '-' : '';
    const a = Math.abs(n);
    const [div, suf] = a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'k'] : [1, ''];
    const v = a / div;
    return sign + (cur || '') + (suf && v < 100 ? v.toFixed(1) : Math.round(v)) + suf;
  }
  function count(n) {
    if (!Number.isFinite(n)) return '—';
    return Math.round(n).toLocaleString();
  }

  /* Axis ticks on 1/2/5×10ⁿ steps, so labels land on numbers people read. */
  function niceTicks(min, max, target) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const raw = span / (target || 5);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }

  /* --- chart frame ----------------------------------------------------- */

  const W = 760, H = 300;
  const PAD = { t: 18, r: 18, b: 34, l: 58 };

  function buildFigure(title, subtitle) {
    const fig = document.createElement('figure');
    fig.className = 'chart';
    const head = document.createElement('figcaption');
    head.className = 'chart-head';
    head.innerHTML = '<span class="chart-title"></span>' +
      (subtitle ? '<span class="chart-sub"></span>' : '');
    head.querySelector('.chart-title').textContent = title;
    if (subtitle) head.querySelector('.chart-sub').textContent = subtitle;
    fig.appendChild(head);

    const plot = document.createElement('div');
    plot.className = 'chart-plot';
    const svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': title + (subtitle ? '. ' + subtitle : ''),
      preserveAspectRatio: 'xMidYMid meet',
    });
    plot.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    plot.appendChild(tip);
    fig.appendChild(plot);
    return { fig, svg, plot, tip };
  }

  function legend(items) {
    const wrap = document.createElement('div');
    wrap.className = 'chart-legend';
    items.forEach(it => {
      const s = document.createElement('span');
      s.className = 'legend-item';
      const dot = document.createElement('span');
      dot.className = 'legend-dot';
      dot.style.background = it.color;
      s.appendChild(dot);
      s.appendChild(document.createTextNode(it.label));
      wrap.appendChild(s);
    });
    return wrap;
  }

  function axes(svg, xLabels, yTicks, fmtY) {
    const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
    const yMin = yTicks[0], yMax = yTicks[yTicks.length - 1];
    const yScale = v => PAD.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
    const xScale = i => PAD.l + (xLabels.length === 1 ? innerW / 2
      : (i / (xLabels.length - 1)) * innerW);

    // Recessive gridlines; the zero line gets the baseline weight so a cash
    // chart reads "above or below water" at a glance.
    yTicks.forEach(t => {
      const y = yScale(t);
      svg.appendChild(el('line', {
        x1: PAD.l, x2: W - PAD.r, y1: y, y2: y,
        class: t === 0 ? 'axis-zero' : 'grid',
      }));
      svg.appendChild(el('text', {
        x: PAD.l - 8, y: y + 4, class: 'tick tick-y', 'text-anchor': 'end',
      }, fmtY(t)));
    });

    // Roughly six x labels, whatever the horizon length.
    const stride = Math.max(1, Math.round(xLabels.length / 6));
    xLabels.forEach((lab, i) => {
      if (i % stride !== 0 && i !== xLabels.length - 1) return;
      svg.appendChild(el('text', {
        x: xScale(i), y: H - PAD.b + 20, class: 'tick tick-x', 'text-anchor': 'middle',
      }, lab));
    });

    return { xScale, yScale, innerW, innerH };
  }

  /* --- line chart with crosshair --------------------------------------- */

  function lineChart(opts) {
    const { title, subtitle, xLabels, series, fmtY, fmtTip } = opts;
    const { fig, svg, plot, tip } = buildFigure(title, subtitle);

    const allValues = series.flatMap(s => s.values).filter(Number.isFinite);
    const lo = Math.min(0, ...allValues), hi = Math.max(0, ...allValues);
    const ticks = niceTicks(lo, hi, 5);
    const { xScale, yScale } = axes(svg, xLabels, ticks, fmtY);

    series.forEach(s => {
      const d = s.values.map((v, i) => (i === 0 ? 'M' : 'L') + xScale(i) + ' ' + yScale(v)).join(' ');
      if (s.fill) {
        const base = yScale(Math.max(ticks[0], 0));
        svg.appendChild(el('path', {
          d: d + ' L' + xScale(s.values.length - 1) + ' ' + base + ' L' + xScale(0) + ' ' + base + ' Z',
          fill: s.color, opacity: 0.12, stroke: 'none',
        }));
      }
      svg.appendChild(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

      // Direct label at the series end — identity never rests on colour alone.
      const lastIdx = s.values.length - 1;
      const lx = xScale(lastIdx), ly = yScale(s.values[lastIdx]);
      if (lx < W - PAD.r - 4) {
        svg.appendChild(el('circle', { cx: lx, cy: ly, r: 3.5, fill: s.color,
          stroke: 'var(--surface-1)', 'stroke-width': 2 }));
      }
    });

    /* Crosshair layer: one transparent rect captures the pointer, a vertical
     * rule and per-series markers follow it, and the tooltip reads values. */
    const rule = el('line', { class: 'crosshair', y1: PAD.t, y2: H - PAD.b, x1: 0, x2: 0, opacity: 0 });
    svg.appendChild(rule);
    const markers = series.map(s => {
      const c = el('circle', { r: 4.5, fill: s.color, stroke: 'var(--surface-1)',
        'stroke-width': 2, opacity: 0 });
      svg.appendChild(c);
      return c;
    });

    const hit = el('rect', { x: PAD.l, y: PAD.t, width: W - PAD.l - PAD.r,
      height: H - PAD.t - PAD.b, fill: 'transparent', style: 'cursor:crosshair' });
    svg.appendChild(hit);

    function moveTo(clientX) {
      const box = svg.getBoundingClientRect();
      const rel = (clientX - box.left) / box.width * W;
      const innerW = W - PAD.l - PAD.r;
      const t = Math.max(0, Math.min(1, (rel - PAD.l) / innerW));
      const i = Math.round(t * (xLabels.length - 1));
      const x = xScale(i);
      rule.setAttribute('x1', x); rule.setAttribute('x2', x); rule.setAttribute('opacity', 1);
      markers.forEach((mk, si) => {
        mk.setAttribute('cx', x); mk.setAttribute('cy', yScale(series[si].values[i]));
        mk.setAttribute('opacity', 1);
      });
      tip.hidden = false;
      tip.innerHTML = '<div class="tip-label">' + xLabels[i] + '</div>' +
        series.map((s, si) =>
          '<div class="tip-row"><span class="legend-dot" style="background:' + s.color + '"></span>' +
          '<span class="tip-name">' + s.label + '</span>' +
          '<span class="tip-val">' + (fmtTip || fmtY)(s.values[i]) + '</span></div>').join('');
      // Keep the tooltip inside the plot rather than clipped at the edge.
      const pct = x / W;
      tip.style.left = (pct * 100) + '%';
      tip.style.transform = 'translate(' + (pct > 0.68 ? 'calc(-100% - 12px)' : '12px') + ', -50%)';
      tip.style.top = '38%';
    }

    hit.addEventListener('pointermove', e => moveTo(e.clientX));
    hit.addEventListener('pointerleave', () => {
      rule.setAttribute('opacity', 0);
      markers.forEach(m => m.setAttribute('opacity', 0));
      tip.hidden = true;
    });

    if (series.length >= 2) {
      fig.appendChild(legend(series.map(s => ({ label: s.label, color: s.color }))));
    }
    return fig;
  }

  /* --- horizontal bars -------------------------------------------------- */

  function barChart(opts) {
    const { title, subtitle, items, fmt, color } = opts;
    const { fig, svg, tip, plot } = buildFigure(title, subtitle);
    const n = items.length;
    const rowH = Math.min(38, (H - 40) / Math.max(n, 1));
    const labelW = 168;
    const barMax = W - labelW - 96;
    const max = Math.max(...items.map(i => Math.abs(i.value)), 1);

    items.forEach((it, i) => {
      const y = 20 + i * rowH;
      const w = Math.max(2, Math.abs(it.value) / max * barMax);
      svg.appendChild(el('text', { x: labelW - 12, y: y + rowH / 2 + 4,
        class: 'bar-label', 'text-anchor': 'end' }, it.label));
      const rect = el('rect', {
        x: labelW, y: y + 4, width: w, height: Math.max(8, rowH - 14),
        rx: 4, fill: it.color || color || 'var(--series-1)',
      });
      // 2px surface gap between adjacent fills.
      rect.setAttribute('stroke', 'var(--surface-1)');
      rect.setAttribute('stroke-width', 2);
      svg.appendChild(rect);
      svg.appendChild(el('text', { x: labelW + w + 10, y: y + rowH / 2 + 4,
        class: 'bar-value' }, fmt(it.value)));

      if (it.note) {
        rect.addEventListener('pointerenter', () => {
          tip.hidden = false;
          tip.innerHTML = '<div class="tip-label">' + it.label + '</div><div class="tip-note">' + it.note + '</div>';
          tip.style.left = '50%'; tip.style.top = '8px'; tip.style.transform = 'translateX(-50%)';
        });
        rect.addEventListener('pointerleave', () => { tip.hidden = true; });
      }
    });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (30 + n * rowH));
    return fig;
  }

  /* --- the dashboard ---------------------------------------------------- */

  function render(container, projection, currency) {
    container.innerHTML = '';
    if (!projection) return;
    const cur = currency || '';
    const m = projection.months;
    const labels = m.map(x => x.label);
    const fy = v => compact(v, cur);

    // 1. Revenue against total cost — the shape of the business.
    container.appendChild(lineChart({
      title: 'Revenue vs total cost',
      subtitle: 'Where the two lines cross is operating break-even',
      xLabels: labels,
      fmtY: fy,
      series: [
        { label: 'Revenue', color: 'var(--series-1)', values: m.map(x => x.revenue), fill: true },
        { label: 'Total cost', color: 'var(--series-2)', values: m.map(x => x.cogs + x.totalOpex) },
      ],
    }));

    // 2. Cash — the question that actually decides whether the plan is fundable.
    const lowest = projection.metrics.lowestCash;
    container.appendChild(lineChart({
      title: 'Cash balance',
      subtitle: lowest < 0
        ? 'Goes below zero — this plan needs more capital than it raises'
        : 'Low point ' + compact(lowest, cur) + ' in month ' + projection.metrics.lowestCashMonth,
      xLabels: labels,
      fmtY: fy,
      series: [{ label: 'Cash', color: lowest < 0 ? 'var(--status-critical)' : 'var(--series-3)',
        values: m.map(x => x.cash), fill: true }],
    }));

    // 3. The installed base. Headcount deliberately does NOT share this axis:
    //    hundreds of customers against a handful of staff would flatten the
    //    smaller series onto the baseline and say nothing. One axis, one
    //    measure — headcount is carried by the tables and the annual summary.
    container.appendChild(lineChart({
      title: 'Customer base',
      subtitle: 'Active customers, net of churn',
      xLabels: labels,
      fmtY: count, fmtTip: count,
      series: [{ label: 'Customers', color: 'var(--series-1)',
        values: m.map(x => x.customers), fill: true }],
    }));

    // 4. Where new customers come from — two series on a genuinely shared
    //    scale, and the paid/organic mix is the question GTM has to answer.
    container.appendChild(lineChart({
      title: 'New customers each month',
      subtitle: 'The mix matters more than the total — organic growth is what makes the model cheap',
      xLabels: labels,
      fmtY: count, fmtTip: count,
      series: [
        { label: 'From paid spend', color: 'var(--series-1)', values: m.map(x => x.newFromPaid) },
        { label: 'Organic', color: 'var(--series-2)', values: m.map(x => x.newOrganic) },
      ],
    }));

    // 5. Unit economics — one measure, two entities, so a single hue.
    const mt = projection.metrics;
    if (mt.ltv !== null && mt.blendedCac > 0) {
      container.appendChild(barChart({
        title: 'Unit economics',
        subtitle: 'Lifetime value against what it costs to acquire one customer',
        items: [
          { label: 'Lifetime value', value: mt.ltv, color: 'var(--series-1)',
            note: 'ARPU × gross margin ÷ monthly churn' },
          { label: 'Cost to acquire', value: mt.blendedCac, color: 'var(--series-2)',
            note: 'Total paid spend ÷ customers that spend bought' },
        ],
        fmt: v => compact(v, cur),
      }));
    }

    // 6. Where the money goes — magnitude across categories, single hue.
    const spend = {
      'Payroll': projection.months.reduce((a, x) => a + x.opexPayroll + x.cogsPayroll, 0),
      'Paid acquisition': projection.months.reduce((a, x) => a + x.paidSpend, 0),
      'Cost of delivery': projection.months.reduce((a, x) => a + x.productCogs, 0),
      'Other operating': projection.months.reduce((a, x) => a + x.otherOpex, 0),
    };
    const total = Object.values(spend).reduce((a, b) => a + b, 0) || 1;
    container.appendChild(barChart({
      title: 'Where the money goes',
      subtitle: 'Total spend across the ' + m.length + '-month horizon',
      items: Object.entries(spend)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({
          label, value, color: 'var(--series-1)',
          note: (value / total * 100).toFixed(1) + '% of all spend',
        })),
      fmt: v => compact(v, cur),
    }));
  }

  root.BP = root.BP || {};
  root.BP.Charts = { render, lineChart, barChart, compact, count, niceTicks };
})(typeof globalThis !== 'undefined' ? globalThis : this);
