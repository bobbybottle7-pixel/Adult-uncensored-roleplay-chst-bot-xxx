/* UI controller: library → wizard → workspace.
 *
 * Rendering is deliberately plain — build HTML, delegate events — because the
 * interesting engineering in this app is the financial engine, not a
 * hand-rolled virtual DOM. State lives in one object and every view is a pure
 * function of it.
 *
 * Public: BP.App.boot() */
(function (root) {
  'use strict';

  const $ = s => document.querySelector(s);
  const esc = s => root.BP.Render.escapeHtml(s);
  const cfg = () => root.BP.config;

  const state = {
    view: 'library',       // library | wizard | workspace
    planId: null,
    tab: 'plan',
    step: 0,
    draft: {},
    projection: null,
    generating: false,
    progress: [],
    partial: '',
    railOpen: false,
  };

  const plan = () => state.planId ? root.BP.Store.getPlan(state.planId) : null;
  const currency = p => (p && p.intake && p.intake.currency) || 'USD';
  const currencySymbol = code => {
    const c = cfg().currencies.find(x => x.code === code);
    return c ? c.symbol : '';
  };

  function recompute(p) {
    state.projection = (p && p.assumptions) ? root.BP.Finance.project(p.assumptions) : null;
    return state.projection;
  }

  /* ---------- toasts ---------------------------------------------------- */

  function toast(message, kind) {
    const wrap = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' is-' + kind : '');
    t.textContent = message;
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 4200);
  }

  /* ---------- top-level render ------------------------------------------ */

  function render() {
    const p = plan();
    $('#topbar-title').textContent = p ? p.title : '';
    $('#rail').innerHTML = renderRail(p);
    $('#rail').classList.toggle('is-open', state.railOpen);
    const main = $('#main');
    if (state.view === 'wizard') main.innerHTML = renderWizard();
    else if (state.view === 'workspace' && p) main.innerHTML = renderWorkspace(p);
    else main.innerHTML = renderLibrary();
    afterRender();
  }

  /* Charts are DOM nodes, not HTML strings, so they mount after the view. */
  function afterRender() {
    const host = document.getElementById('chart-host');
    if (host && state.projection) {
      root.BP.Charts.render(host, state.projection, currencySymbol(currency(plan())));
    }
    const peek = document.getElementById('stream-peek');
    if (peek) peek.scrollTop = peek.scrollHeight;
  }

  /* ---------- rail ------------------------------------------------------ */

  function renderRail(p) {
    const out = [];
    out.push('<div class="rail-group">');
    out.push('<button class="btn btn-primary" style="width:100%" data-act="new-plan">+ New business plan</button>');
    out.push('</div>');

    if (p && state.view === 'workspace') {
      out.push('<div class="rail-group"><div class="rail-title">Sections</div>');
      cfg().sections.forEach(s => {
        const done = p.sections[s.id] && p.sections[s.id].content;
        out.push('<button class="rail-link ' + (done ? 'is-done' : 'is-pending') +
          '" data-act="goto-section" data-id="' + s.id + '">' +
          '<span class="ico">' + s.icon + '</span>' + esc(s.title) +
          '<span class="rail-meta">' + (done ? p.sections[s.id].words + 'w' : '—') + '</span></button>');
      });
      out.push('</div>');
    }

    const plans = root.BP.Store.listPlans();
    if (plans.length) {
      out.push('<div class="rail-group"><div class="rail-title">Your plans</div>');
      plans.slice(0, 12).forEach(x => {
        out.push('<button class="rail-link' + (x.id === state.planId ? ' is-active' : '') +
          '" data-act="open-plan" data-id="' + x.id + '">' +
          '<span class="ico">▦</span>' + esc(x.title.slice(0, 22)) +
          (x.score ? '<span class="rail-meta">' + x.score.total + '</span>' : '') + '</button>');
      });
      out.push('</div>');
    }

    out.push('<div class="rail-group"><div class="rail-title">App</div>');
    out.push('<button class="rail-link" data-act="settings"><span class="ico">⚙</span>Settings</button>');
    out.push('<button class="rail-link" data-act="import"><span class="ico">↑</span>Import a plan</button>');
    out.push('<button class="rail-link" data-act="theme"><span class="ico">◐</span>Theme</button>');
    out.push('</div>');
    return out.join('');
  }

  /* ---------- library --------------------------------------------------- */

  function renderLibrary() {
    const plans = root.BP.Store.listPlans();
    const hasKey = root.BP.API.hasKey();

    const pillars = [
      { ico: '▦', h: 'The numbers are computed, not written',
        p: 'A deterministic 36-month engine builds the P&L, cash flow and unit economics in JavaScript. The AI proposes assumptions; it never authors a figure. The model foots — provably.' },
      { ico: '◎', h: 'It argues with you',
        p: 'The engine grades its own output and flags what an investor will attack: thin margins, slow payback, a cash line that dips below zero, a hockey stick nobody will believe.' },
      { ico: '⊙', h: 'A full document set',
        p: 'Thirteen plan sections plus a one-pager, pitch deck outline, elevator pitch, SWOT, business model canvas and twenty due-diligence questions with answers.' },
      { ico: '↓', h: 'Yours to take away',
        p: 'Markdown, styled HTML, print-to-PDF, a CSV of every month in the model, and a JSON file that round-trips. Stored in your browser — never uploaded anywhere.' },
    ];

    const out = [];
    out.push('<div class="hero"><h1>Business plans that survive the second question.</h1>' +
      '<p class="lede">Most AI plan generators write plausible prose and invent the financials to match. ' +
      'VentureForge computes the model first — then writes the plan around numbers that actually reconcile.</p>' +
      '<div class="hero-actions">' +
      '<button class="btn btn-primary btn-lg" data-act="new-plan">Build a plan</button>' +
      (hasKey ? '' : '<button class="btn btn-lg" data-act="settings">Add your free API key</button>') +
      '</div></div>');

    if (!hasKey) {
      out.push('<div class="banner"><div><strong>You need a free key first</strong>' +
        'Create one at <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer">openrouter.ai</a> ' +
        '— sign in, open Keys, create one, paste it into Settings. No card required, and the models this app uses are free.</div></div>');
    }

    out.push('<div class="pillars">' + pillars.map(p =>
      '<div class="pillar"><span class="ico">' + p.ico + '</span><h3>' + esc(p.h) + '</h3><p>' + esc(p.p) + '</p></div>'
    ).join('') + '</div>');

    out.push('<div class="card"><div class="card-head"><h2>Your plans</h2><div class="spacer"></div>' +
      (plans.length ? '<span class="muted">' + plans.length + ' saved locally</span>' : '') + '</div>');
    if (!plans.length) {
      out.push('<div class="empty">Nothing yet. Build your first plan — it takes about four minutes.</div>');
    } else {
      out.push('<div class="plan-list">' + plans.map(x => {
        const done = Object.keys(x.sections || {}).length;
        return '<div class="plan-row" data-act="open-plan" data-id="' + x.id + '" role="button" tabindex="0">' +
          '<div><h3>' + esc(x.title) + '</h3><div class="plan-meta">' +
          done + '/' + cfg().sections.length + ' sections · updated ' +
          new Date(x.updatedAt).toLocaleDateString() +
          (x.status === 'partial' ? ' · <span style="color:var(--status-warning-ink)">partial</span>' : '') +
          '</div></div><div class="spacer"></div>' +
          (x.score ? '<span class="score-pill is-' + x.score.tone + '">' + x.score.total + '/100</span>' : '') +
          '<button class="btn btn-sm btn-ghost" data-act="duplicate" data-id="' + x.id + '" title="Duplicate">⧉</button>' +
          '<button class="btn btn-sm btn-danger" data-act="delete" data-id="' + x.id + '" title="Delete">✕</button>' +
          '</div>';
      }).join('') + '</div>');
    }
    out.push('</div>');
    return out.join('');
  }

  /* ---------- wizard ---------------------------------------------------- */

  const STEPS = [
    {
      label: 'The idea',
      fields: [
        { k: 'company', label: 'Company or project name', type: 'text', ph: 'Northwind Analytics', required: true },
        { k: 'pitch', label: 'Describe it in one sentence', type: 'text', required: true,
          ph: 'Warehouse inventory forecasting for mid-market distributors.',
          hint: 'If you cannot say it in one sentence, the plan will not fix that.' },
        { k: 'problem', label: 'What problem does it solve, and for whom?', type: 'textarea', required: true,
          ph: 'Distributors carry 30–40% more stock than they need because forecasting runs on spreadsheets…',
          hint: 'Be concrete about who is hurting and what it costs them today.' },
        { k: 'product', label: 'What have you built, or what will you build?', type: 'textarea',
          ph: 'A web app that connects to their ERP, forecasts demand per SKU, and recommends purchase orders.' },
      ],
    },
    {
      label: 'Market',
      fields: [
        { k: 'customer', label: 'Who exactly is the customer?', type: 'textarea', required: true,
          ph: 'Operations managers at distributors with $10M–$200M revenue and 2,000+ SKUs, in the US and Canada.',
          hint: 'Job title, company size, geography. "Everyone" is not a customer.' },
        { k: 'geography', label: 'Which markets?', type: 'text', ph: 'United States and Canada, expanding to the UK in year 2' },
        { k: 'competitors', label: 'Who do you compete with?', type: 'textarea',
          ph: 'NetSuite Demand Planning, Inventory Planner, and — most often — an Excel workbook maintained by one person.',
          hint: 'Include the spreadsheet and the do-nothing option. Those win more deals than software does.' },
        { k: 'traction', label: 'Any traction so far?', type: 'textarea',
          ph: '11 paying customers, $4,300 MRR, 3% monthly churn over the last six months.',
          hint: 'Real numbers if you have them. "Strong interest" is not traction.' },
      ],
    },
    {
      label: 'Money',
      fields: [
        { k: 'pricing', label: 'How do you charge?', type: 'textarea', required: true,
          ph: '$490/month per site, annual contracts, plus a $2,000 one-time implementation fee.',
          hint: 'Price, billing frequency, and any one-off fees. This drives the whole model.' },
        { k: 'raise', label: 'How much are you raising, if anything?', type: 'text',
          ph: '$1.5M seed, closing in month 3' },
      ],
      custom: 'money',
    },
    {
      label: 'Team',
      fields: [
        { k: 'team', label: 'Who is on the team?', type: 'textarea',
          ph: 'Two founders. Ana ran supply chain at a $400M distributor for six years. Ben built forecasting at Flexport.',
          hint: 'What they have actually done matters far more than titles.' },
        { k: 'notes', label: 'Anything else the plan should account for?', type: 'textarea',
          ph: 'Regulatory constraints, a signed LOI, a channel partnership, a hard deadline…' },
      ],
    },
  ];

  function renderWizard() {
    const step = STEPS[state.step];
    const d = state.draft;
    const out = [];

    out.push('<div class="view">');
    out.push('<div class="step-label">Step ' + (state.step + 1) + ' of ' + STEPS.length + ' · ' + esc(step.label) + '</div>');
    out.push('<div class="steps">' + STEPS.map((s, i) =>
      '<div class="step-dot' + (i <= state.step ? ' is-done' : '') + '"></div>').join('') + '</div>');

    out.push('<div class="card">');
    step.fields.forEach(f => {
      out.push('<div class="field"><label for="f-' + f.k + '">' + esc(f.label) +
        (f.required ? ' <span style="color:var(--status-critical)">*</span>' : '') + '</label>');
      if (f.hint) out.push('<p class="hint">' + esc(f.hint) + '</p>');
      const val = esc(d[f.k] || '');
      if (f.type === 'textarea') {
        out.push('<textarea class="textarea" id="f-' + f.k + '" data-field="' + f.k + '" placeholder="' + esc(f.ph || '') + '">' + val + '</textarea>');
      } else {
        out.push('<input class="input" id="f-' + f.k + '" data-field="' + f.k + '" value="' + val + '" placeholder="' + esc(f.ph || '') + '">');
      }
      out.push('</div>');
    });

    if (step.custom === 'money') {
      out.push('<div class="field"><label>Currency</label><div class="chip-row">' +
        cfg().currencies.map(c => '<button class="chip' + ((d.currency || 'USD') === c.code ? ' is-on' : '') +
          '" data-set="currency" data-val="' + c.code + '">' + c.symbol + ' ' + c.code + '</button>').join('') +
        '</div></div>');
      out.push('<div class="field"><label>Planning horizon</label><div class="chip-row">' +
        [24, 36, 48, 60].map(n => '<button class="chip' + ((d.horizonMonths || 36) === n ? ' is-on' : '') +
          '" data-set="horizonMonths" data-val="' + n + '">' + n + ' months</button>').join('') +
        '</div></div>');
    }

    if (state.step === 0) {
      out.push('<div class="field"><label>Stage</label><div class="chip-row">' +
        cfg().stages.map(s => '<button class="chip' + (d.stage === s.label ? ' is-on' : '') +
          '" data-set="stage" data-val="' + esc(s.label) + '">' + esc(s.label) +
          '<small>' + esc(s.note) + '</small></button>').join('') + '</div></div>');
      out.push('<div class="field"><label>Business model</label><div class="chip-row">' +
        cfg().businessModels.map(b => '<button class="chip' + (d.businessModel === b.label ? ' is-on' : '') +
          '" data-set="businessModel" data-val="' + esc(b.label) + '">' + esc(b.label) + '</button>').join('') +
        '</div></div>');
    }

    out.push('</div>');

    out.push('<div class="wizard-nav">' +
      (state.step > 0 ? '<button class="btn" data-act="wizard-back">← Back</button>' : '<button class="btn" data-act="home">Cancel</button>') +
      '<div class="spacer"></div>' +
      (state.step < STEPS.length - 1
        ? '<button class="btn btn-primary" data-act="wizard-next">Continue →</button>'
        : '<button class="btn btn-primary btn-lg" data-act="generate">Build the plan</button>') +
      '</div>');
    out.push('</div>');
    return out.join('');
  }

  /* ---------- workspace ------------------------------------------------- */

  function renderWorkspace(p) {
    const tabs = [
      { id: 'plan', label: 'Plan' },
      { id: 'model', label: 'Financial model' },
      { id: 'score', label: 'Readiness' },
      { id: 'docs', label: 'Documents' },
      { id: 'export', label: 'Export' },
    ];
    const out = ['<div class="view' + (state.tab === 'plan' ? ' is-doc' : '') + '">'];

    if (state.generating) out.push(renderProgress());

    out.push('<div class="tabs">' + tabs.map(t =>
      '<button class="tab' + (state.tab === t.id ? ' is-on' : '') + '" data-act="tab" data-id="' + t.id + '">' +
      esc(t.label) + '</button>').join('') + '</div>');

    if (state.tab === 'plan') out.push(renderPlanTab(p));
    else if (state.tab === 'model') out.push(renderModelTab(p));
    else if (state.tab === 'score') out.push(renderScoreTab(p));
    else if (state.tab === 'docs') out.push(renderDocsTab(p));
    else out.push(renderExportTab(p));

    out.push('</div>');
    return out.join('');
  }

  function renderProgress() {
    const out = ['<div class="card">'];
    out.push('<div class="card-head"><h2>Building your plan</h2><div class="spacer"></div>' +
      '<button class="btn btn-sm btn-danger" data-act="cancel">Stop</button></div>');
    out.push('<ul class="progress-list">' + state.progress.slice(-9).map(s =>
      '<li class="prog is-' + s.status + '"><span class="dot"></span>' + esc(s.label) +
      (s.words ? '<span class="prog-meta">' + s.words + ' words</span>' : '') + '</li>').join('') + '</ul>');
    if (state.partial) {
      out.push('<div class="stream-peek" id="stream-peek">' + esc(state.partial.slice(-1400)) + '</div>');
    }
    out.push('</div>');
    return out.join('');
  }

  function renderPlanTab(p) {
    const written = cfg().sections.filter(s => p.sections[s.id] && p.sections[s.id].content);
    if (!written.length) {
      return '<div class="card"><div class="empty">No sections yet. ' +
        (state.generating ? 'Generating…' : '<button class="btn btn-primary" data-act="generate-existing">Generate the plan</button>') +
        '</div></div>';
    }
    const R = root.BP.Render;
    const out = [];

    if (p.failures && p.failures.length) {
      out.push('<div class="banner is-warning"><div><strong>' + p.failures.length +
        ' section(s) did not finish</strong>' +
        esc(p.failures.map(f => f.title).join(', ')) +
        '. Use the regenerate button on each to retry.</div></div>');
    }

    if (state.projection) out.push(R.metricGrid(state.projection, currencySymbol(currency(p))));

    out.push('<div class="doc-body">');
    cfg().sections.forEach(def => {
      const s = p.sections[def.id];
      if (!s || !s.content) return;
      out.push('<div class="section-block" id="sec-' + def.id + '">');
      out.push('<h2>' + esc(def.title) + '</h2>');
      out.push('<div class="section-tools no-print">' +
        '<button class="btn btn-sm btn-ghost" data-act="regen" data-id="' + def.id + '">↻ Regenerate</button>' +
        '<button class="btn btn-sm btn-ghost" data-act="copy-section" data-id="' + def.id + '">Copy</button>' +
        '<span class="words">' + s.words + ' words · ' + esc(root.BP.API.shortLabel(s.model || '')) + '</span></div>');
      out.push(R.markdown(s.content));
      // The financial section is followed by the computed tables, so prose and
      // numbers can never drift apart in the reader's hands.
      if (def.id === 'financials' && state.projection) out.push(annualTableHtml(state.projection, p));
      out.push('</div>');
    });
    out.push('</div>');
    return out.join('');
  }

  function annualTableHtml(proj, p) {
    const cur = currencySymbol(currency(p));
    const money = n => root.BP.Charts.compact(n, cur);
    const pctS = n => (n * 100).toFixed(1) + '%';
    return '<h3>Annual summary <span class="muted" style="font-weight:400;font-size:.8em">(computed)</span></h3>' +
      '<div class="table-scroll"><table><thead><tr>' +
      ['Period', 'Revenue', 'Gross profit', 'GM%', 'Opex', 'EBITDA', 'Ending cash', 'Customers', 'Headcount']
        .map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' +
      proj.years.map(y => '<tr><td>Year ' + y.year + '</td><td>' + money(y.revenue) + '</td><td>' +
        money(y.grossProfit) + '</td><td>' + pctS(y.grossMarginPct) + '</td><td>' + money(y.opex) +
        '</td><td>' + money(y.ebitda) + '</td><td>' + money(y.endingCash) + '</td><td>' +
        Math.round(y.endingCustomers).toLocaleString() + '</td><td>' + Math.round(y.endingHeadcount) +
        '</td></tr>').join('') + '</tbody></table></div>';
  }

  /* ---------- model tab: charts + live-editable assumptions -------------- */

  function renderModelTab(p) {
    if (!p.assumptions) {
      return '<div class="card"><div class="empty">No model yet. Generate the plan and the engine will build one.</div></div>';
    }
    const proj = state.projection || recompute(p);
    const cur = currencySymbol(currency(p));
    const out = [];

    out.push(root.BP.Render.metricGrid(proj, cur));

    out.push('<div class="card"><div class="card-head"><h2>What the model says about itself</h2></div>' +
      root.BP.Render.warningList(proj) + '</div>');

    out.push('<div class="card"><div class="card-head"><h2>Charts</h2><div class="spacer"></div>' +
      '<span class="muted" style="font-size:12.5px">Hover for month-by-month values</span></div>' +
      '<div id="chart-host"></div></div>');

    out.push('<div class="card"><div class="card-head"><h2>Assumptions</h2><div class="spacer"></div>' +
      '<span class="live-note">● Edits recompute everything instantly</span></div>' +
      '<p class="card-sub">Every figure above is derived from these. Change one and watch the charts move — ' +
      'this is the model, not a summary of it.</p>' +
      renderAssumptionsEditor(p) + '</div>');

    out.push('<div class="card"><div class="card-head"><h2>Month by month</h2><div class="spacer"></div>' +
      '<button class="btn btn-sm" data-act="export-csv">Download CSV</button></div>' +
      monthlyTableHtml(proj, cur) + '</div>');

    return out.join('');
  }

  /* Inputs carry a dot-path so one handler can write any assumption. */
  function input(path, value, type) {
    return '<input data-path="' + path + '" type="' + (type || 'number') +
      '" step="any" value="' + esc(value) + '">';
  }

  function renderAssumptionsEditor(p) {
    const a = p.assumptions;
    const why = k => p.assumptionRationale && p.assumptionRationale[k]
      ? '<div class="rationale">' + esc(p.assumptionRationale[k]) + '</div>' : '';
    const out = [];

    out.push('<div class="assum-group"><h3>Core</h3><div class="table-scroll"><table class="assum-table"><tbody>');
    [['startingCash', 'Starting cash'], ['startingCustomers', 'Starting customers'],
     ['churnPct', 'Monthly churn (0.03 = 3%)'], ['netExpansionPct', 'Monthly expansion'],
     ['payrollTaxPct', 'Payroll tax rate'], ['collectionLagMonths', 'Collection lag (months)'],
     ['taxRatePct', 'Corporate tax rate']
    ].forEach(([k, label]) => {
      out.push('<tr><td>' + esc(label) + why(k) + '</td><td style="width:150px">' + input(k, a[k]) + '</td></tr>');
    });
    out.push('</tbody></table></div></div>');

    out.push('<div class="assum-group"><h3>Revenue streams</h3><div class="table-scroll"><table class="assum-table">' +
      '<thead><tr><th>Name</th><th>Type</th><th>Share</th><th>Price</th><th>COGS %</th></tr></thead><tbody>');
    a.revenueStreams.forEach((s, i) => {
      out.push('<tr><td>' + input('revenueStreams.' + i + '.name', s.name, 'text') + '</td>' +
        '<td>' + esc(s.type) + '</td>' +
        '<td>' + input('revenueStreams.' + i + '.share', s.share) + '</td>' +
        '<td>' + input('revenueStreams.' + i + '.unitPrice', s.unitPrice) + '</td>' +
        '<td>' + input('revenueStreams.' + i + '.cogsPct', s.cogsPct) + '</td></tr>');
    });
    out.push('</tbody></table></div></div>');

    if (a.channels.length) {
      out.push('<div class="assum-group"><h3>Acquisition channels</h3><div class="table-scroll"><table class="assum-table">' +
        '<thead><tr><th>Channel</th><th>Monthly spend</th><th>Spend growth</th><th>CAC</th><th>Start month</th></tr></thead><tbody>');
      a.channels.forEach((c, i) => {
        out.push('<tr><td>' + input('channels.' + i + '.name', c.name, 'text') + '</td>' +
          '<td>' + input('channels.' + i + '.monthlySpend', c.monthlySpend) + '</td>' +
          '<td>' + input('channels.' + i + '.spendGrowthPct', c.spendGrowthPct) + '</td>' +
          '<td>' + input('channels.' + i + '.cac', c.cac) + '</td>' +
          '<td>' + input('channels.' + i + '.startMonth', c.startMonth) + '</td></tr>');
      });
      out.push('</tbody></table></div></div>');
    }

    out.push('<div class="assum-group"><h3>Organic acquisition</h3><div class="table-scroll"><table class="assum-table"><tbody>' +
      '<tr><td>New customers in month 1</td><td style="width:150px">' + input('organic.month1', a.organic.month1) + '</td></tr>' +
      '<tr><td>Monthly growth in that number</td><td>' + input('organic.growthPct', a.organic.growthPct) + '</td></tr>' +
      '<tr><td>Monthly cap (0 = uncapped)</td><td>' + input('organic.cap', a.organic.cap) + '</td></tr>' +
      '</tbody></table></div></div>');

    if (a.headcount.length) {
      out.push('<div class="assum-group"><h3>Headcount</h3><div class="table-scroll"><table class="assum-table">' +
        '<thead><tr><th>Role</th><th>Count</th><th>Monthly salary</th><th>Start month</th><th>In COGS</th></tr></thead><tbody>');
      a.headcount.forEach((h, i) => {
        out.push('<tr><td>' + input('headcount.' + i + '.role', h.role, 'text') + '</td>' +
          '<td>' + input('headcount.' + i + '.count', h.count) + '</td>' +
          '<td>' + input('headcount.' + i + '.monthlySalary', h.monthlySalary) + '</td>' +
          '<td>' + input('headcount.' + i + '.startMonth', h.startMonth) + '</td>' +
          '<td style="text-align:center">' + (h.inCogs ? 'yes' : 'no') + '</td></tr>');
      });
      out.push('</tbody></table></div></div>');
    }

    if (a.opex.length) {
      out.push('<div class="assum-group"><h3>Operating costs</h3><div class="table-scroll"><table class="assum-table">' +
        '<thead><tr><th>Cost</th><th>Monthly</th><th>Growth</th><th>Per customer</th><th>Start</th></tr></thead><tbody>');
      a.opex.forEach((o, i) => {
        out.push('<tr><td>' + input('opex.' + i + '.name', o.name, 'text') + '</td>' +
          '<td>' + input('opex.' + i + '.monthlyAmount', o.monthlyAmount) + '</td>' +
          '<td>' + input('opex.' + i + '.growthPct', o.growthPct) + '</td>' +
          '<td>' + input('opex.' + i + '.perCustomer', o.perCustomer) + '</td>' +
          '<td>' + input('opex.' + i + '.startMonth', o.startMonth) + '</td></tr>');
      });
      out.push('</tbody></table></div></div>');
    }

    if (a.funding.length) {
      out.push('<div class="assum-group"><h3>Funding</h3><div class="table-scroll"><table class="assum-table">' +
        '<thead><tr><th>Round</th><th>Amount</th><th>Month</th></tr></thead><tbody>');
      a.funding.forEach((f, i) => {
        out.push('<tr><td>' + input('funding.' + i + '.name', f.name, 'text') + '</td>' +
          '<td>' + input('funding.' + i + '.amount', f.amount) + '</td>' +
          '<td>' + input('funding.' + i + '.month', f.month) + '</td></tr>');
      });
      out.push('</tbody></table></div></div>');
    }

    return out.join('');
  }

  function monthlyTableHtml(proj, cur) {
    const money = n => root.BP.Charts.compact(n, cur);
    const head = ['Month', 'Customers', 'Revenue', 'COGS', 'Gross profit', 'Opex', 'EBITDA', 'Net cash flow', 'Cash'];
    return '<div class="table-scroll"><table class="doc-table" style="width:100%;border-collapse:collapse;font-size:13px">' +
      '<thead><tr>' + head.map(h => '<th style="text-align:left;padding:6px 9px;border-bottom:1px solid var(--rule)">' +
        h + '</th>').join('') + '</tr></thead><tbody>' +
      proj.months.map(m => '<tr>' + [
        m.label, Math.round(m.customers).toLocaleString(), money(m.revenue), money(m.cogs),
        money(m.grossProfit), money(m.totalOpex), money(m.ebitda), money(m.netCashFlow), money(m.cash),
      ].map((c, i) => '<td style="padding:5px 9px;border-bottom:1px solid var(--rule);font-variant-numeric:tabular-nums' +
        (i === 8 && m.cash < 0 ? ';color:var(--status-critical);font-weight:600' : '') + '">' + esc(c) + '</td>').join('') +
        '</tr>').join('') + '</tbody></table></div>';
  }

  function renderScoreTab(p) {
    const score = p.score || (state.projection ? root.BP.Score.evaluate(p, state.projection) : null);
    return '<div class="card"><div class="card-head"><h2>Investor readiness</h2><div class="spacer"></div>' +
      '<button class="btn btn-sm" data-act="rescore">Re-score</button></div>' +
      '<p class="card-sub">Graded the way a partner skims a plan: not whether every box is filled, ' +
      'but whether it survives ten minutes of questions.</p>' +
      root.BP.Render.scorecard(score) + '</div>';
  }

  function renderDocsTab(p) {
    const out = ['<div class="card"><div class="card-head"><h2>Companion documents</h2><div class="spacer"></div>' +
      '<button class="btn btn-sm" data-act="gen-all-docs">Generate missing</button></div>' +
      '<p class="card-sub">Built from the same intake and the same computed model, so nothing contradicts the plan.</p>'];
    out.push('<div class="plan-list">');
    cfg().companions.forEach(c => {
      const has = p.companions[c.id];
      out.push('<div class="plan-row"><div><h3>' + c.icon + ' ' + esc(c.title) + '</h3>' +
        '<div class="plan-meta">' + esc(c.note) + '</div></div><div class="spacer"></div>' +
        (has ? '<button class="btn btn-sm" data-act="view-doc" data-id="' + c.id + '">Read</button>' : '') +
        '<button class="btn btn-sm' + (has ? '' : ' btn-primary') + '" data-act="gen-doc" data-id="' + c.id + '">' +
        (has ? '↻' : 'Generate') + '</button></div>');
    });
    out.push('</div></div>');

    if (state.viewDoc && p.companions[state.viewDoc]) {
      const def = cfg().companions.find(c => c.id === state.viewDoc);
      out.push('<div class="card"><div class="card-head"><h2>' + esc(def.title) + '</h2><div class="spacer"></div>' +
        '<button class="btn btn-sm btn-ghost" data-act="copy-doc" data-id="' + def.id + '">Copy</button>' +
        '<button class="btn btn-sm btn-ghost" data-act="close-doc">Close</button></div>' +
        '<div class="doc-body">' + root.BP.Render.markdown(p.companions[def.id].content) + '</div></div>');
    }
    return out.join('');
  }

  function renderExportTab(p) {
    const items = [
      { act: 'export-md', h: 'Markdown', p: 'The whole plan including computed tables. Opens in any editor.' },
      { act: 'export-html', h: 'Styled HTML', p: 'Self-contained single file — works from a USB stick, no internet.' },
      { act: 'export-pdf', h: 'PDF', p: 'Print-ready, via your browser. Choose "Save as PDF" in the dialog.' },
      { act: 'export-csv', h: 'CSV of the model', p: 'Every month, every line, plus the metrics block. For Excel or Sheets.' },
      { act: 'export-json', h: 'JSON', p: 'Everything, round-trips back into the app. Re-running the engine on it reproduces the model exactly.' },
    ];
    return '<div class="card"><div class="card-head"><h2>Take it with you</h2></div>' +
      '<p class="card-sub">Nothing here has ever left your browser. These files are the plan — there is no account to lose access to.</p>' +
      '<div class="plan-list">' + items.map(i =>
        '<div class="plan-row"><div><h3>' + esc(i.h) + '</h3><div class="plan-meta">' + esc(i.p) + '</div></div>' +
        '<div class="spacer"></div><button class="btn btn-sm btn-primary" data-act="' + i.act + '">Download</button></div>'
      ).join('') + '</div></div>';
  }

  /* ---------- generation ------------------------------------------------- */

  async function startGeneration(p, opts) {
    if (!root.BP.API.hasKey()) { openSettings('You need a free OpenRouter key before generating.'); return; }
    state.generating = true; state.progress = []; state.partial = '';
    state.view = 'workspace'; state.planId = p.id; state.tab = 'plan';
    render();

    const onProgress = s => {
      // Collapse repeated updates for the same step into one live row.
      const key = s.phase + ':' + (s.id || '');
      const existing = state.progress.find(x => x.key === key);
      const entry = { key, label: s.label, status: s.status === 'streaming' ? 'active' : s.status, words: s.words };
      if (existing) Object.assign(existing, entry); else state.progress.push(entry);
      state.partial = s.partial || (s.status === 'done' ? '' : state.partial);
      if (s.projection) state.projection = s.projection;
      if (s.status !== 'streaming') { render(); }
      else {
        // Streaming updates touch only the peek panel — re-rendering the whole
        // view on every token would fight the user's scroll position.
        const peek = document.getElementById('stream-peek');
        if (peek) { peek.textContent = s.partial.slice(-1400); peek.scrollTop = peek.scrollHeight; }
        else render();
      }
    };

    try {
      const res = await root.BP.Generate.run(p, Object.assign({ onProgress }, opts || {}));
      state.generating = false;
      recompute(res.plan);
      if (res.cancelled) toast('Stopped. Everything written so far is saved.');
      else if (res.failures && res.failures.length) toast(res.failures.length + ' section(s) failed — retry them individually.', 'error');
      else toast('Plan complete — readiness ' + res.score.total + '/100', 'good');
      render();
    } catch (err) {
      state.generating = false;
      render();
      if (err.code === 'NO_KEY' || err.code === 'AUTH') openSettings(err.message);
      else toast(err.message || 'Generation failed.', 'error');
    }
  }

  /* ---------- settings & modals ------------------------------------------ */

  function openSettings(message) {
    const s = root.BP.Store.getSettings();
    const body =
      (message ? '<div class="banner is-warning"><div>' + esc(message) + '</div></div>' : '') +
      '<div class="field"><label for="s-key">OpenRouter API key</label>' +
      '<p class="hint">Free to create at <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer">openrouter.ai</a> — ' +
      'sign in, open Keys, create one. No card required. Stored only in this browser.</p>' +
      '<input class="input" id="s-key" type="password" value="' + esc(s.apiKey) + '" placeholder="sk-or-..."></div>' +
      '<div class="field"><label for="s-model">Model</label>' +
      '<p class="hint">Auto walks the list top-to-bottom and falls through anything busy or capped.</p>' +
      '<select class="select" id="s-model"><option value="auto"' + (s.model === 'auto' ? ' selected' : '') + '>Auto — try each in turn</option>' +
      cfg().freeModels.map(m => '<option value="' + m.id + '"' + (s.model === m.id ? ' selected' : '') + '>' +
        esc(m.label) + ' — ' + esc(m.note) + '</option>').join('') + '</select></div>' +
      '<div class="row"><div class="field"><label for="s-temp">Temperature</label>' +
      '<p class="hint">Lower is more literal. 0.6 suits analysis.</p>' +
      '<input class="input" id="s-temp" type="number" step="0.05" min="0" max="1.5" value="' + s.temperature + '"></div>' +
      '<div class="field"><label for="s-theme">Theme</label>' +
      '<select class="select" id="s-theme">' + ['system', 'light', 'dark'].map(t =>
        '<option value="' + t + '"' + (s.theme === t ? ' selected' : '') + '>' + t + '</option>').join('') +
      '</select></div></div>';

    modal('Settings', body, [
      { label: 'Cancel', act: 'close' },
      { label: 'Save', primary: true, act: 'save-settings' },
    ]);
  }

  function modal(title, bodyHtml, actions) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><h2>' + esc(title) + '</h2>' +
      bodyHtml + '<div class="modal-actions">' + actions.map(a =>
        '<button class="btn' + (a.primary ? ' btn-primary' : '') + (a.danger ? ' btn-danger' : '') +
        '" data-modal-act="' + a.act + '">' + esc(a.label) + '</button>').join('') + '</div></div>';
    back.addEventListener('click', e => { if (e.target === back) back.remove(); });
    document.body.appendChild(back);
    return back;
  }

  function applyTheme() {
    const t = root.BP.Store.getSettings().theme;
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  /* ---------- events ------------------------------------------------------ */

  const ACTIONS = {
    'home': () => { state.view = 'library'; state.planId = null; render(); },
    'new-plan': () => { state.view = 'wizard'; state.step = 0; state.draft = { currency: 'USD', horizonMonths: 36 }; render(); },
    'wizard-next': () => {
      const step = STEPS[state.step];
      const missing = step.fields.filter(f => f.required && !String(state.draft[f.k] || '').trim());
      if (missing.length) { toast('Fill in: ' + missing.map(m => m.label).join(', '), 'error'); return; }
      state.step = Math.min(STEPS.length - 1, state.step + 1); render();
    },
    'wizard-back': () => { state.step = Math.max(0, state.step - 1); render(); },
    'generate': () => {
      const missing = STEPS.flatMap(s => s.fields).filter(f => f.required && !String(state.draft[f.k] || '').trim());
      if (missing.length) { toast('Still missing: ' + missing.map(m => m.label).join(', '), 'error'); return; }
      const p = root.BP.Store.createPlan(state.draft);
      startGeneration(p);
    },
    'generate-existing': () => { const p = plan(); if (p) startGeneration(p); },
    'cancel': () => { root.BP.Generate.cancel(); },
    'open-plan': id => { const p = root.BP.Store.getPlan(id); if (!p) return;
      state.planId = id; state.view = 'workspace'; state.tab = 'plan'; state.railOpen = false;
      recompute(p); render(); },
    'tab': id => { state.tab = id; render(); },
    'goto-section': id => {
      state.tab = 'plan'; render();
      const target = document.getElementById('sec-' + id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    'duplicate': id => { const c = root.BP.Store.duplicatePlan(id); if (c) { toast('Duplicated.'); render(); } },
    'delete': id => {
      const p = root.BP.Store.getPlan(id);
      const back = modal('Delete this plan?',
        '<p>“' + esc(p ? p.title : '') + '” will be removed from this browser. This cannot be undone — ' +
        'export it first if you want a copy.</p>',
        [{ label: 'Keep it', act: 'close' }, { label: 'Delete', danger: true, act: 'confirm-delete' }]);
      back.dataset.planId = id;
    },
    'settings': () => openSettings(),
    'theme': () => {
      const order = ['system', 'light', 'dark'];
      const cur = root.BP.Store.getSettings().theme;
      const next = order[(order.indexOf(cur) + 1) % 3];
      root.BP.Store.saveSettings({ theme: next });
      applyTheme(); toast('Theme: ' + next);
    },
    'import': () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.addEventListener('change', () => {
        const f = inp.files[0]; if (!f) return;
        const fr = new FileReader();
        fr.onload = () => {
          try {
            const p = root.BP.Store.importPlan(fr.result);
            state.planId = p.id; state.view = 'workspace'; recompute(p); render();
            toast('Plan imported.', 'good');
          } catch (e) { toast(e.message, 'error'); }
        };
        fr.readAsText(f);
      });
      inp.click();
    },
    'regen': async id => {
      const p = plan(); if (!p) return;
      state.generating = true; state.progress = []; state.partial = ''; render();
      try {
        await root.BP.Generate.regenerateSection(p, id, s => {
          state.progress = [{ key: id, label: s.label, status: s.status === 'streaming' ? 'active' : s.status }];
          state.partial = s.partial || state.partial;
          const peek = document.getElementById('stream-peek');
          if (peek && s.partial) { peek.textContent = s.partial.slice(-1400); peek.scrollTop = peek.scrollHeight; }
          else render();
        });
        toast('Section rewritten.', 'good');
      } catch (e) { toast(e.message, 'error'); }
      state.generating = false; render();
    },
    'rescore': () => {
      const p = plan(); if (!p) return;
      p.score = root.BP.Score.evaluate(p, recompute(p));
      root.BP.Store.savePlan(p); render(); toast('Re-scored: ' + p.score.total + '/100');
    },
    'gen-doc': async id => {
      const p = plan(); if (!p) return;
      state.generating = true; state.progress = []; render();
      try {
        await root.BP.Generate.runCompanion(p, id, s => {
          state.progress = [{ key: id, label: s.label, status: s.status === 'streaming' ? 'active' : s.status }];
          state.partial = s.partial || state.partial;
          const peek = document.getElementById('stream-peek');
          if (peek && s.partial) peek.textContent = s.partial.slice(-1400);
          else render();
        });
        state.viewDoc = id; toast('Document ready.', 'good');
      } catch (e) { toast(e.message, 'error'); }
      state.generating = false; render();
    },
    'gen-all-docs': async () => {
      const p = plan(); if (!p) return;
      for (const c of cfg().companions) {
        if (p.companions[c.id]) continue;
        await ACTIONS['gen-doc'](c.id);
      }
    },
    'view-doc': id => { state.viewDoc = id; render(); },
    'close-doc': () => { state.viewDoc = null; render(); },
    'copy-doc': id => {
      const p = plan();
      navigator.clipboard.writeText(p.companions[id].content).then(
        () => toast('Copied.', 'good'), () => toast('Could not copy.', 'error'));
    },
    'copy-section': id => {
      const p = plan();
      navigator.clipboard.writeText(p.sections[id].content).then(
        () => toast('Copied.', 'good'), () => toast('Could not copy.', 'error'));
    },
    'export-md': () => { const p = plan(); root.BP.Export.saveMarkdown(p, state.projection); },
    'export-html': () => { const p = plan(); root.BP.Export.saveHtml(p, state.projection); },
    'export-csv': () => { const p = plan(); root.BP.Export.saveCsv(p, state.projection); },
    'export-json': () => { const p = plan(); root.BP.Export.saveJson(p, state.projection); },
    'export-pdf': () => { const p = plan(); root.BP.Export.print(p, state.projection); },
    'toggle-rail': () => { state.railOpen = !state.railOpen; render(); },
  };

  function bind() {
    document.addEventListener('click', e => {
      const modalBtn = e.target.closest('[data-modal-act]');
      if (modalBtn) {
        const back = modalBtn.closest('.modal-back');
        const act = modalBtn.dataset.modalAct;
        if (act === 'close') back.remove();
        else if (act === 'save-settings') {
          root.BP.Store.saveSettings({
            apiKey: back.querySelector('#s-key').value.trim(),
            model: back.querySelector('#s-model').value,
            temperature: parseFloat(back.querySelector('#s-temp').value) || 0.6,
            theme: back.querySelector('#s-theme').value,
          });
          applyTheme(); back.remove(); render(); toast('Settings saved.', 'good');
        } else if (act === 'confirm-delete') {
          root.BP.Store.deletePlan(back.dataset.planId);
          if (state.planId === back.dataset.planId) { state.planId = null; state.view = 'library'; }
          back.remove(); render(); toast('Deleted.');
        }
        return;
      }

      const setter = e.target.closest('[data-set]');
      if (setter) {
        const key = setter.dataset.set;
        const raw = setter.dataset.val;
        state.draft[key] = key === 'horizonMonths' ? parseInt(raw, 10) : raw;
        render();
        return;
      }

      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const fn = ACTIONS[btn.dataset.act];
      if (fn) { e.preventDefault(); e.stopPropagation(); fn(btn.dataset.id); }
    });

    // Wizard fields write straight to the draft.
    document.addEventListener('input', e => {
      const f = e.target.closest('[data-field]');
      if (f) { state.draft[f.dataset.field] = f.value; return; }

      // Assumption cells recompute the entire model live.
      const cell = e.target.closest('[data-path]');
      if (cell) onAssumptionEdit(cell);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const back = document.querySelector('.modal-back');
        if (back) back.remove();
      }
    });
  }

  let editTimer = null;
  function onAssumptionEdit(cell) {
    const p = plan(); if (!p || !p.assumptions) return;
    const path = cell.dataset.path.split('.');
    const isText = cell.type === 'text';
    let node = p.assumptions;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    const key = path[path.length - 1];
    const value = isText ? cell.value : parseFloat(cell.value);
    if (!isText && !Number.isFinite(value)) return;   // mid-typing, e.g. "-" or ""
    node[key] = value;

    // Re-normalise so a hand-typed value gets the same clamping the engine
    // applies to a model-generated one.
    p.assumptions = root.BP.Finance.normalize(p.assumptions);
    recompute(p);

    // Debounce the write and the repaint; typing should feel instant.
    clearTimeout(editTimer);
    editTimer = setTimeout(() => {
      p.score = root.BP.Score.evaluate(p, state.projection);
      root.BP.Store.savePlan(p);
      const active = document.activeElement;
      const activePath = active && active.dataset ? active.dataset.path : null;
      const caret = active && active.selectionStart;
      render();
      // Restore focus so a live edit does not knock the cursor out of the cell.
      if (activePath) {
        const again = document.querySelector('[data-path="' + activePath + '"]');
        if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch (e) {} }
      }
    }, 420);
  }

  function boot() {
    applyTheme();
    bind();
    root.BP.bus.on('storage-error', () =>
      toast('Browser storage is full. Export a plan and delete an old one.', 'error'));
    render();
  }

  root.BP = root.BP || {};
  root.BP.App = { boot, state, render, toast };
})(typeof globalThis !== 'undefined' ? globalThis : this);
