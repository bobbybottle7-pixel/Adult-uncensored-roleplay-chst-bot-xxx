/* VentureForge — deterministic financial engine.
 *
 * This file is the reason the app exists. Every number in a generated plan is
 * computed HERE, in auditable JavaScript, from a plain assumptions object.
 * The language model proposes assumptions; it never writes a figure into a
 * table. That means the P&L always foots, the cash flow always ties to the
 * balance, and changing one input re-derives all 36 months instantly.
 *
 * Runs unmodified in the browser and in Node (see tests/finance.test.cjs).
 *
 * Public:
 *   BP.Finance.normalize(assumptions)  -> filled-in, validated assumptions
 *   BP.Finance.project(assumptions)    -> { months[], totals, metrics, warnings }
 */
(function (root) {
  'use strict';

  /* ---------- small numeric helpers ---------------------------------- */

  // Guard every input: a model that silently swallows NaN is worse than one
  // that refuses to run, because NaN propagates into every downstream cell.
  function num(v, fallback) {
    const n = typeof v === 'string' ? parseFloat(v.replace(/[, ]/g, '')) : v;
    return Number.isFinite(n) ? n : (fallback || 0);
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function pct(v, fallback) { return clamp(num(v, fallback), -0.99, 10); }
  function round2(v) { return Math.round(v * 100) / 100; }
  function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
  function last(arr) { return arr[arr.length - 1]; }

  // Monthly rate implied by an annual one, compounded rather than divided by 12.
  function monthlyFromAnnual(annual) { return Math.pow(1 + annual, 1 / 12) - 1; }

  /* ---------- assumption normalisation -------------------------------- */

  const DEFAULT_HORIZON = 36;

  function normalize(input) {
    const a = input || {};
    const horizon = clamp(Math.round(num(a.horizonMonths, DEFAULT_HORIZON)), 12, 60);

    const streams = (Array.isArray(a.revenueStreams) && a.revenueStreams.length
      ? a.revenueStreams
      : [{ name: 'Primary product', type: 'recurring', share: 1, unitPrice: 49, cogsPct: 0.2 }]
    ).map((s, i) => ({
      id: s.id || ('stream' + (i + 1)),
      name: String(s.name || ('Stream ' + (i + 1))),
      // 'recurring' bills every active customer every month.
      // 'oneoff'    bills each customer once, in the month they are acquired.
      // 'usage'     bills active customers a variable amount that grows with time.
      type: ['recurring', 'oneoff', 'usage'].includes(s.type) ? s.type : 'recurring',
      share: clamp(num(s.share, 1), 0, 1),        // fraction of customers buying it
      unitPrice: Math.max(0, num(s.unitPrice, 0)),
      cogsPct: clamp(num(s.cogsPct, 0.2), 0, 0.95),
      priceGrowthPct: pct(s.priceGrowthPct, 0),   // monthly price/usage drift
    }));

    const channels = (Array.isArray(a.channels) ? a.channels : []).map((c, i) => ({
      id: c.id || ('channel' + (i + 1)),
      name: String(c.name || ('Channel ' + (i + 1))),
      monthlySpend: Math.max(0, num(c.monthlySpend, 0)),
      spendGrowthPct: pct(c.spendGrowthPct, 0),
      cac: Math.max(1, num(c.cac, 100)),          // cost to acquire one customer
      cacInflationPct: pct(c.cacInflationPct, 0), // channels saturate over time
      startMonth: clamp(Math.round(num(c.startMonth, 1)), 1, horizon),
    }));

    const headcount = (Array.isArray(a.headcount) ? a.headcount : []).map((h, i) => ({
      id: h.id || ('role' + (i + 1)),
      role: String(h.role || ('Role ' + (i + 1))),
      count: Math.max(0, Math.round(num(h.count, 1))),
      monthlySalary: Math.max(0, num(h.monthlySalary, 0)),
      startMonth: clamp(Math.round(num(h.startMonth, 1)), 1, horizon),
      // A role can scale headcount over the horizon (e.g. +1 support rep / quarter).
      addPerMonth: Math.max(0, num(h.addPerMonth, 0)),
      category: ['engineering', 'sales', 'marketing', 'ops', 'ga'].includes(h.category)
        ? h.category : 'ga',
      // Engineering and support salaries capitalised into COGS vs opex.
      inCogs: !!h.inCogs,
    }));

    const opex = (Array.isArray(a.opex) ? a.opex : []).map((o, i) => ({
      id: o.id || ('opex' + (i + 1)),
      name: String(o.name || ('Cost ' + (i + 1))),
      monthlyAmount: Math.max(0, num(o.monthlyAmount, 0)),
      growthPct: pct(o.growthPct, 0),
      startMonth: clamp(Math.round(num(o.startMonth, 1)), 1, horizon),
      category: ['rnd', 'sales', 'marketing', 'ga'].includes(o.category) ? o.category : 'ga',
      // Costs that scale with customers rather than sitting flat.
      perCustomer: Math.max(0, num(o.perCustomer, 0)),
    }));

    const funding = (Array.isArray(a.funding) ? a.funding : []).map((f, i) => ({
      id: f.id || ('round' + (i + 1)),
      name: String(f.name || ('Round ' + (i + 1))),
      amount: Math.max(0, num(f.amount, 0)),
      month: clamp(Math.round(num(f.month, 1)), 1, horizon),
    }));

    return {
      currency: String(a.currency || 'USD'),
      startDate: String(a.startDate || isoMonth(new Date())),
      horizonMonths: horizon,
      startingCash: Math.max(0, num(a.startingCash, 0)),
      startingCustomers: Math.max(0, num(a.startingCustomers, 0)),

      revenueStreams: streams,
      channels,
      headcount,
      opex,
      funding,

      organic: {
        month1: Math.max(0, num(a.organic && a.organic.month1, 0)),
        growthPct: pct(a.organic && a.organic.growthPct, 0.1),
        // Organic acquisition rarely compounds forever; cap the monthly adds.
        cap: Math.max(0, num(a.organic && a.organic.cap, 0)),
      },
      churnPct: clamp(num(a.churnPct, 0.05), 0, 1),          // monthly logo churn
      netExpansionPct: pct(a.netExpansionPct, 0),            // monthly ARPU expansion
      payrollTaxPct: clamp(num(a.payrollTaxPct, 0.15), 0, 1),
      collectionLagMonths: clamp(Math.round(num(a.collectionLagMonths, 0)), 0, 6),
      taxRatePct: clamp(num(a.taxRatePct, 0), 0, 0.6),
    };
  }

  function isoMonth(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function labelForMonth(startDate, offset) {
    const [y, m] = String(startDate).split('-').map(Number);
    const d = new Date(Date.UTC(y || 2026, (m || 1) - 1 + offset, 1));
    return d.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }

  /* ---------- the projection ------------------------------------------ */

  function project(rawAssumptions) {
    const a = normalize(rawAssumptions);
    const H = a.horizonMonths;
    const months = [];
    const warnings = [];

    let customers = a.startingCustomers;
    let cash = a.startingCash;
    // Revenue billed but not yet collected, indexed by the month it lands in.
    const collections = new Array(H + a.collectionLagMonths + 2).fill(0);

    for (let m = 1; m <= H; m++) {
      /* --- acquisition ------------------------------------------------- */
      const channelDetail = channelsForMonth(a, m);
      const paidSpend = sum(channelDetail.map(c => c.spend));
      const newFromPaid = sum(channelDetail.map(c => c.customers));

      let newOrganic = a.organic.month1 * Math.pow(1 + a.organic.growthPct, m - 1);
      if (a.organic.cap > 0) newOrganic = Math.min(newOrganic, a.organic.cap);

      const newCustomers = newFromPaid + newOrganic;

      /* --- retention --------------------------------------------------- */
      // Churn applies to the opening base, before this month's cohort lands,
      // so a new customer is never churned in the month they arrive.
      const openingCustomers = customers;
      const churnedCustomers = openingCustomers * a.churnPct;
      customers = openingCustomers - churnedCustomers + newCustomers;

      /* --- revenue ----------------------------------------------------- */
      // Expansion lifts ARPU on the installed base only.
      const expansionMultiplier = Math.pow(1 + a.netExpansionPct, m - 1);

      const streamDetail = a.revenueStreams.map(s => {
        const price = s.unitPrice * Math.pow(1 + s.priceGrowthPct, m - 1);
        let revenue;
        if (s.type === 'oneoff') {
          // Billed once, on acquisition — no expansion, no installed base.
          revenue = newCustomers * s.share * price;
        } else if (s.type === 'usage') {
          revenue = customers * s.share * price * expansionMultiplier;
        } else {
          // Average the opening and closing base so a month of rapid growth
          // isn't credited with a full month of revenue it never billed.
          const billableBase = (openingCustomers + customers) / 2;
          revenue = billableBase * s.share * price * expansionMultiplier;
        }
        return { id: s.id, name: s.name, revenue, cogs: revenue * s.cogsPct };
      });

      const revenue = sum(streamDetail.map(s => s.revenue));
      const productCogs = sum(streamDetail.map(s => s.cogs));

      /* --- people ------------------------------------------------------ */
      const payrollDetail = headcountForMonth(a, m);
      const cogsPayroll = sum(payrollDetail.filter(p => p.inCogs).map(p => p.cost));
      const opexPayroll = sum(payrollDetail.filter(p => !p.inCogs).map(p => p.cost));
      const employees = sum(payrollDetail.map(p => p.count));

      const cogs = productCogs + cogsPayroll;
      const grossProfit = revenue - cogs;

      /* --- operating expenses ------------------------------------------ */
      const opexDetail = a.opex
        .filter(o => m >= o.startMonth)
        .map(o => ({
          id: o.id,
          name: o.name,
          category: o.category,
          amount: o.monthlyAmount * Math.pow(1 + o.growthPct, m - o.startMonth)
            + o.perCustomer * customers,
        }));

      const otherOpex = sum(opexDetail.map(o => o.amount));
      // Paid acquisition spend is a real cash cost and belongs in opex, not
      // hidden inside a CAC ratio.
      const totalOpex = otherOpex + opexPayroll + paidSpend;

      const ebitda = grossProfit - totalOpex;
      const tax = ebitda > 0 ? ebitda * a.taxRatePct : 0;
      const netIncome = ebitda - tax;

      /* --- cash -------------------------------------------------------- */
      // Revenue lands in cash `collectionLagMonths` later; costs are paid now.
      collections[m + a.collectionLagMonths] += revenue;
      const collected = collections[m] || 0;
      const cashCosts = cogs + totalOpex + tax;
      const fundingIn = sum(a.funding.filter(f => f.month === m).map(f => f.amount));

      const netCashFlow = collected - cashCosts + fundingIn;
      cash += netCashFlow;

      months.push({
        month: m,
        label: labelForMonth(a.startDate, m - 1),
        newCustomers, newFromPaid, newOrganic, churnedCustomers,
        customers, employees,
        streams: streamDetail,
        revenue,
        mrr: sum(streamDetail.filter((s, i) => a.revenueStreams[i].type !== 'oneoff')
          .map(s => s.revenue)),
        cogs, productCogs, cogsPayroll,
        grossProfit,
        grossMarginPct: revenue > 0 ? grossProfit / revenue : 0,
        opexDetail, otherOpex, opexPayroll, paidSpend, totalOpex,
        ebitda,
        ebitdaMarginPct: revenue > 0 ? ebitda / revenue : 0,
        tax, netIncome,
        collected, cashCosts, fundingIn, netCashFlow,
        cash,
      });
    }

    /* --- horizon-level metrics ----------------------------------------- */
    const metrics = deriveMetrics(a, months, warnings);
    const totals = deriveTotals(months);
    const years = deriveYears(months);

    return { assumptions: a, months, years, totals, metrics, warnings };
  }

  function channelsForMonth(a, m) {
    return a.channels.filter(c => m >= c.startMonth).map(c => {
      const age = m - c.startMonth;
      const spend = c.monthlySpend * Math.pow(1 + c.spendGrowthPct, age);
      const cac = c.cac * Math.pow(1 + c.cacInflationPct, age);
      return { id: c.id, name: c.name, spend, cac, customers: cac > 0 ? spend / cac : 0 };
    });
  }

  function headcountForMonth(a, m) {
    return a.headcount.filter(h => m >= h.startMonth).map(h => {
      const count = h.count + h.addPerMonth * (m - h.startMonth);
      const cost = count * h.monthlySalary * (1 + a.payrollTaxPct);
      return { id: h.id, role: h.role, category: h.category, inCogs: h.inCogs, count, cost };
    });
  }

  function deriveTotals(months) {
    const keys = ['revenue', 'cogs', 'grossProfit', 'totalOpex', 'ebitda', 'tax',
      'netIncome', 'paidSpend', 'newCustomers', 'fundingIn'];
    const out = {};
    keys.forEach(k => { out[k] = sum(months.map(m => m[k])); });
    out.grossMarginPct = out.revenue > 0 ? out.grossProfit / out.revenue : 0;
    out.ebitdaMarginPct = out.revenue > 0 ? out.ebitda / out.revenue : 0;
    out.endingCash = last(months).cash;
    out.endingCustomers = last(months).customers;
    out.endingMrr = last(months).mrr;
    out.endingArr = last(months).mrr * 12;
    return out;
  }

  function deriveYears(months) {
    const years = [];
    for (let y = 0; y * 12 < months.length; y++) {
      const slice = months.slice(y * 12, y * 12 + 12);
      const revenue = sum(slice.map(m => m.revenue));
      const cogs = sum(slice.map(m => m.cogs));
      const opex = sum(slice.map(m => m.totalOpex));
      years.push({
        year: y + 1,
        months: slice.length,
        revenue, cogs,
        grossProfit: revenue - cogs,
        grossMarginPct: revenue > 0 ? (revenue - cogs) / revenue : 0,
        opex,
        ebitda: revenue - cogs - opex,
        ebitdaMarginPct: revenue > 0 ? (revenue - cogs - opex) / revenue : 0,
        netIncome: sum(slice.map(m => m.netIncome)),
        endingCash: last(slice).cash,
        endingCustomers: last(slice).customers,
        endingHeadcount: last(slice).employees,
      });
    }
    // Year-over-year growth, once there is a prior year to compare against.
    years.forEach((yr, i) => {
      yr.revenueGrowthPct = i > 0 && years[i - 1].revenue > 0
        ? yr.revenue / years[i - 1].revenue - 1 : null;
    });
    return years;
  }

  function deriveMetrics(a, months, warnings) {
    const final = last(months);

    // Blended CAC over the whole horizon: total paid spend / customers that
    // paid spend actually bought. Organic sign-ups do not flatter the number.
    const paidCustomers = sum(months.map(m => m.newFromPaid));
    const blendedCac = paidCustomers > 0 ? sum(months.map(m => m.paidSpend)) / paidCustomers : 0;

    // ARPU from the last full month with customers on the books.
    const arpu = final.customers > 0 ? final.mrr / final.customers : 0;
    const grossMargin = final.revenue > 0 ? final.grossProfit / final.revenue : 0;
    const contributionPerCustomer = arpu * grossMargin;

    // LTV on the standard gross-margin-adjusted perpetuity. Undefined at zero
    // churn — a model that claims infinite lifetime is a model to distrust.
    const ltv = a.churnPct > 0 ? contributionPerCustomer / a.churnPct : null;
    const ltvCacRatio = ltv !== null && blendedCac > 0 ? ltv / blendedCac : null;
    const cacPaybackMonths = contributionPerCustomer > 0 && blendedCac > 0
      ? blendedCac / contributionPerCustomer : null;

    const breakEvenMonth = months.find(m => m.ebitda >= 0);
    const cashFlowPositiveMonth = months.find(m => m.netCashFlow >= 0);
    const cashOutMonth = months.find(m => m.cash < 0);

    // Runway from the current burn rate, averaged over the trailing quarter so
    // a single lumpy month doesn't swing the answer.
    const trailing = months.slice(-3);
    const avgBurn = -sum(trailing.map(m => m.netCashFlow)) / trailing.length;
    const runwayMonths = avgBurn > 0 ? final.cash / avgBurn : null;

    const peakBurnMonth = months.reduce((worst, m) =>
      m.netCashFlow < worst.netCashFlow ? m : worst, months[0]);
    const lowestCash = months.reduce((low, m) => (m.cash < low.cash ? m : low), months[0]);

    // Total external capital required = the deepest the cash line ever goes
    // below zero, net of funding already modelled.
    const capitalRequired = lowestCash.cash < 0 ? Math.abs(lowestCash.cash) : 0;

    const y1 = months.slice(0, 12), y2 = months.slice(12, 24);
    const y1Rev = sum(y1.map(m => m.revenue)), y2Rev = sum(y2.map(m => m.revenue));
    const growthPct = y1Rev > 0 && y2.length ? y2Rev / y1Rev - 1 : null;
    // Rule of 40: growth rate + EBITDA margin, the standard SaaS health check.
    const ruleOf40 = growthPct !== null
      ? (growthPct * 100) + (last(months).ebitdaMarginPct * 100) : null;

    /* --- honesty checks the model runs on itself ----------------------- */
    if (cashOutMonth) {
      warnings.push({
        level: 'critical',
        code: 'cash-out',
        message: 'Cash goes negative in ' + cashOutMonth.label + ' (month ' +
          cashOutMonth.month + '). The plan needs roughly ' +
          Math.ceil(capitalRequired).toLocaleString() + ' ' + a.currency +
          ' more capital, or a lower burn, before it is fundable.',
      });
    }
    if (ltvCacRatio !== null && ltvCacRatio < 3 && ltvCacRatio > 0) {
      warnings.push({
        level: 'serious',
        code: 'ltv-cac',
        message: 'LTV:CAC is ' + ltvCacRatio.toFixed(1) + ':1. Investors look for 3:1 or ' +
          'better; below that, growth destroys value rather than creating it.',
      });
    }
    if (cacPaybackMonths !== null && cacPaybackMonths > 18) {
      warnings.push({
        level: 'warning',
        code: 'payback',
        message: 'CAC payback is ' + Math.round(cacPaybackMonths) + ' months. Above 18 ' +
          'months, each new customer is a long-dated cash drain.',
      });
    }
    if (a.churnPct >= 0.1) {
      warnings.push({
        level: 'serious',
        code: 'churn',
        message: 'Monthly churn of ' + (a.churnPct * 100).toFixed(1) + '% implies the ' +
          'average customer stays ' + (1 / a.churnPct).toFixed(1) + ' months. ' +
          'This caps the business regardless of how much is spent on acquisition.',
      });
    }
    if (!breakEvenMonth) {
      warnings.push({
        level: 'warning',
        code: 'no-breakeven',
        message: 'The model never reaches operating break-even inside ' +
          a.horizonMonths + ' months. Expect to be asked what changes after that.',
      });
    }
    if (grossMargin < 0.4 && final.revenue > 0) {
      warnings.push({
        level: 'warning',
        code: 'gross-margin',
        message: 'Ending gross margin is ' + (grossMargin * 100).toFixed(0) + '%. ' +
          'Below roughly 40% the business is priced and valued like a services ' +
          'company, not a software one.',
      });
    }
    if (growthPct !== null && growthPct > 9) {
      warnings.push({
        level: 'warning',
        code: 'hockey-stick',
        message: 'Year 2 revenue is ' + (growthPct + 1).toFixed(1) + '× year 1. ' +
          'Growth this steep reads as a hockey stick and invites scepticism about ' +
          'the acquisition assumptions behind it.',
      });
    }

    return {
      arpu, blendedCac, ltv, ltvCacRatio, cacPaybackMonths,
      grossMarginPct: grossMargin,
      contributionPerCustomer,
      breakEvenMonth: breakEvenMonth ? breakEvenMonth.month : null,
      breakEvenLabel: breakEvenMonth ? breakEvenMonth.label : null,
      cashFlowPositiveMonth: cashFlowPositiveMonth ? cashFlowPositiveMonth.month : null,
      cashOutMonth: cashOutMonth ? cashOutMonth.month : null,
      cashOutLabel: cashOutMonth ? cashOutMonth.label : null,
      runwayMonths, avgMonthlyBurn: avgBurn > 0 ? avgBurn : 0,
      peakBurn: -peakBurnMonth.netCashFlow,
      peakBurnMonth: peakBurnMonth.month,
      lowestCash: lowestCash.cash,
      lowestCashMonth: lowestCash.month,
      capitalRequired,
      endingArr: final.mrr * 12,
      endingCustomers: final.customers,
      endingHeadcount: final.employees,
      y1Revenue: y1Rev, y2Revenue: y2Rev,
      y2GrowthPct: growthPct,
      ruleOf40,
    };
  }

  /* ---------- sensitivity --------------------------------------------- */

  /* Re-runs the projection with one assumption flexed, so a founder can see
   * which lever actually moves the outcome. This is the question every
   * investor asks and almost no generated plan can answer. */
  function sensitivity(assumptions, opts) {
    const o = opts || {};
    const deltas = o.deltas || [-0.3, -0.15, 0.15, 0.3];
    const levers = [
      { key: 'churnPct', label: 'Monthly churn', invert: true },
      { key: 'price', label: 'Pricing' },
      { key: 'cac', label: 'CAC', invert: true },
      { key: 'spend', label: 'Marketing spend' },
    ];

    const base = project(assumptions);
    return levers.map(lever => ({
      key: lever.key,
      label: lever.label,
      points: deltas.map(d => {
        const flexed = applyLever(assumptions, lever.key, d);
        const r = project(flexed);
        return {
          delta: d,
          endingArr: r.metrics.endingArr,
          endingCash: r.totals.endingCash,
          breakEvenMonth: r.metrics.breakEvenMonth,
          arrChangePct: base.metrics.endingArr > 0
            ? r.metrics.endingArr / base.metrics.endingArr - 1 : 0,
        };
      }),
    }));
  }

  function applyLever(assumptions, key, delta) {
    const a = JSON.parse(JSON.stringify(normalize(assumptions)));
    if (key === 'churnPct') a.churnPct = clamp(a.churnPct * (1 + delta), 0, 1);
    if (key === 'price') a.revenueStreams.forEach(s => { s.unitPrice *= (1 + delta); });
    if (key === 'cac') a.channels.forEach(c => { c.cac = Math.max(1, c.cac * (1 + delta)); });
    if (key === 'spend') a.channels.forEach(c => { c.monthlySpend *= (1 + delta); });
    return a;
  }

  root.BP = root.BP || {};
  root.BP.Finance = {
    normalize, project, sensitivity,
    // exported for tests and for the UI's own formatting
    _helpers: { num, clamp, pct, round2, sum, monthlyFromAnnual, labelForMonth },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
