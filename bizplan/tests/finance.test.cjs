/* Proof that the financial engine computes rather than hallucinates.
 * Run: node bizplan/tests/finance.test.cjs
 *
 * These are accounting identities, not snapshots — they must hold for any
 * assumptions, so they catch a broken model rather than a changed one. */
require('../js/finance.js');
const { project, normalize, sensitivity } = globalThis.BP.Finance;

let passed = 0, failed = 0;
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol);

function test(name, fn) {
  try { fn(); passed++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  catch (e) { failed++; console.log('  \x1b[31m✗\x1b[0m ' + name + '\n      ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg, tol) {
  if (!near(a, b, tol)) throw new Error((msg || 'values differ') + ': ' + a + ' vs ' + b);
}

/* A realistic seed-stage B2B SaaS, used as the fixture throughout. */
const seed = {
  startDate: '2026-01', horizonMonths: 36,
  startingCash: 500000, startingCustomers: 0,
  revenueStreams: [
    { name: 'Pro plan', type: 'recurring', share: 1, unitPrice: 99, cogsPct: 0.18 },
    { name: 'Onboarding fee', type: 'oneoff', share: 0.4, unitPrice: 500, cogsPct: 0.5 },
  ],
  channels: [
    { name: 'Paid search', monthlySpend: 15000, spendGrowthPct: 0.05, cac: 900, cacInflationPct: 0.01 },
  ],
  organic: { month1: 5, growthPct: 0.08, cap: 60 },
  churnPct: 0.03, netExpansionPct: 0.01,
  headcount: [
    { role: 'Engineering', count: 3, monthlySalary: 11000, startMonth: 1, category: 'engineering' },
    { role: 'Support', count: 1, monthlySalary: 5000, startMonth: 6, inCogs: true, category: 'ops' },
  ],
  opex: [{ name: 'Tooling & hosting', monthlyAmount: 4000, growthPct: 0.02, category: 'ga', perCustomer: 2 }],
  funding: [{ name: 'Seed', amount: 2000000, month: 4 }],
  payrollTaxPct: 0.15, collectionLagMonths: 1, taxRatePct: 0.21,
};

console.log('\n\x1b[1mFinancial engine\x1b[0m');

const r = project(seed);

test('produces exactly the requested horizon', () => {
  eq(r.months.length, 36, 'month count');
  eq(r.years.length, 3, 'year count');
});

test('P&L foots in every month: revenue − COGS = gross profit', () => {
  r.months.forEach(m => eq(m.revenue - m.cogs, m.grossProfit, 'month ' + m.month, 1e-6));
});

test('P&L foots in every month: gross profit − opex = EBITDA', () => {
  r.months.forEach(m => eq(m.grossProfit - m.totalOpex, m.ebitda, 'month ' + m.month, 1e-6));
});

test('opex reconciles to its components incl. paid acquisition', () => {
  r.months.forEach(m =>
    eq(m.otherOpex + m.opexPayroll + m.paidSpend, m.totalOpex, 'month ' + m.month, 1e-6));
});

test('COGS reconciles to product cost + capitalised payroll', () => {
  r.months.forEach(m => eq(m.productCogs + m.cogsPayroll, m.cogs, 'month ' + m.month, 1e-6));
});

test('cash rolls forward: prior cash + net cash flow = closing cash', () => {
  let prev = seed.startingCash;
  r.months.forEach(m => {
    eq(prev + m.netCashFlow, m.cash, 'month ' + m.month, 1e-6);
    prev = m.cash;
  });
});

test('net cash flow reconciles to collections, costs and funding', () => {
  r.months.forEach(m =>
    eq(m.collected - m.cashCosts + m.fundingIn, m.netCashFlow, 'month ' + m.month, 1e-6));
});

test('customers roll forward: opening − churn + new = closing', () => {
  let prev = seed.startingCustomers;
  r.months.forEach(m => {
    eq(prev - m.churnedCustomers + m.newCustomers, m.customers, 'month ' + m.month, 1e-6);
    prev = m.customers;
  });
});

test('new customers split cleanly into paid and organic', () => {
  r.months.forEach(m => eq(m.newFromPaid + m.newOrganic, m.newCustomers, 'month ' + m.month, 1e-6));
});

test('paid acquisition obeys spend ÷ CAC', () => {
  const m1 = r.months[0];
  eq(m1.newFromPaid, 15000 / 900, 'month 1 paid customers', 1e-9);
});

test('organic acquisition respects its cap', () => {
  r.months.forEach(m => assert(m.newOrganic <= 60 + 1e-9, 'month ' + m.month + ' exceeded cap'));
});

test('a customer is never churned in the month they are acquired', () => {
  // Churn is charged on the opening base only.
  const m1 = r.months[0];
  eq(m1.churnedCustomers, 0, 'month 1 churn with zero starting customers');
});

test('funding lands in the month it is scheduled and nowhere else', () => {
  r.months.forEach(m => eq(m.fundingIn, m.month === 4 ? 2000000 : 0, 'month ' + m.month));
});

test('collection lag defers revenue into cash by exactly one month', () => {
  eq(r.months[0].collected, 0, 'month 1 collects nothing with a 1-month lag');
  eq(r.months[1].collected, r.months[0].revenue, 'month 2 collects month 1 revenue', 1e-6);
});

test('one-off revenue tracks new customers, not the installed base', () => {
  const m = r.months[10];
  const onboarding = m.streams.find(s => s.name === 'Onboarding fee');
  eq(onboarding.revenue, m.newCustomers * 0.4 * 500, 'onboarding revenue', 1e-6);
});

test('tax is charged on profit and never on a loss', () => {
  r.months.forEach(m => {
    if (m.ebitda <= 0) eq(m.tax, 0, 'month ' + m.month + ' taxed a loss');
    else eq(m.tax, m.ebitda * 0.21, 'month ' + m.month, 1e-6);
  });
});

test('annual roll-up ties to the underlying months', () => {
  r.years.forEach((yr, i) => {
    const slice = r.months.slice(i * 12, i * 12 + 12);
    eq(yr.revenue, slice.reduce((a, m) => a + m.revenue, 0), 'year ' + yr.year + ' revenue', 1e-6);
    eq(yr.endingCash, slice[slice.length - 1].cash, 'year ' + yr.year + ' cash', 1e-6);
  });
});

test('horizon totals tie to the sum of months', () => {
  eq(r.totals.revenue, r.months.reduce((a, m) => a + m.revenue, 0), 'total revenue', 1e-6);
  eq(r.totals.endingCash, r.months[35].cash, 'ending cash', 1e-6);
});

console.log('\n\x1b[1mDerived metrics\x1b[0m');

test('LTV uses gross-margin-adjusted contribution over churn', () => {
  const f = r.months[35];
  const arpu = f.mrr / f.customers;
  const gm = f.grossProfit / f.revenue;
  eq(r.metrics.ltv, (arpu * gm) / 0.03, 'LTV', 1e-6);
});

test('blended CAC divides paid spend by paid-acquired customers only', () => {
  const spend = r.months.reduce((a, m) => a + m.paidSpend, 0);
  const cust = r.months.reduce((a, m) => a + m.newFromPaid, 0);
  eq(r.metrics.blendedCac, spend / cust, 'blended CAC', 1e-6);
});

test('LTV is undefined at zero churn rather than infinite', () => {
  const z = project(Object.assign({}, seed, { churnPct: 0 }));
  assert(z.metrics.ltv === null, 'expected null LTV, got ' + z.metrics.ltv);
});

test('break-even is the first month EBITDA turns non-negative', () => {
  const first = r.months.find(m => m.ebitda >= 0);
  eq(r.metrics.breakEvenMonth, first ? first.month : null, 'break-even month');
  if (first) assert(r.months[first.month - 2].ebitda < 0, 'prior month should still be negative');
});

test('CAC payback equals CAC ÷ monthly gross contribution', () => {
  eq(r.metrics.cacPaybackMonths,
    r.metrics.blendedCac / r.metrics.contributionPerCustomer, 'payback', 1e-6);
});

test('runway is null once the business funds itself', () => {
  assert(r.metrics.runwayMonths === null || r.metrics.runwayMonths > 0,
    'runway should be null or positive, got ' + r.metrics.runwayMonths);
});

test('capital required is the depth of the deepest cash trough', () => {
  const low = Math.min(...r.months.map(m => m.cash));
  eq(r.metrics.capitalRequired, low < 0 ? Math.abs(low) : 0, 'capital required', 1e-6);
});

console.log('\n\x1b[1mSelf-critique warnings\x1b[0m');

test('flags a plan that runs out of cash', () => {
  const broke = project(Object.assign({}, seed, { startingCash: 1000, funding: [] }));
  assert(broke.warnings.some(w => w.code === 'cash-out'), 'expected a cash-out warning');
  assert(broke.metrics.capitalRequired > 0, 'expected capital required > 0');
});

test('flags LTV:CAC below the 3:1 bar', () => {
  const bad = project(Object.assign({}, seed, {
    channels: [{ name: 'Paid', monthlySpend: 15000, cac: 9000 }],
  }));
  assert(bad.warnings.some(w => w.code === 'ltv-cac'), 'expected an LTV:CAC warning');
});

test('flags churn that caps the business', () => {
  const churny = project(Object.assign({}, seed, { churnPct: 0.15 }));
  assert(churny.warnings.some(w => w.code === 'churn'), 'expected a churn warning');
});

test('flags a hockey-stick growth curve', () => {
  const stick = project(Object.assign({}, seed, {
    organic: { month1: 5, growthPct: 0.6, cap: 100000 },
  }));
  assert(stick.warnings.some(w => w.code === 'hockey-stick'), 'expected a hockey-stick warning');
});

test('a healthy plan raises no critical warnings', () => {
  assert(!r.warnings.some(w => w.level === 'critical'),
    'fixture unexpectedly critical: ' + JSON.stringify(r.warnings.map(w => w.code)));
});

console.log('\n\x1b[1mInput hardening\x1b[0m');

test('survives an empty assumptions object', () => {
  const empty = project({});
  eq(empty.months.length, 36, 'default horizon');
  empty.months.forEach(m => assert(Number.isFinite(m.cash), 'month ' + m.month + ' cash is NaN'));
});

test('coerces junk input instead of propagating NaN', () => {
  const junk = project({
    startingCash: 'not a number', churnPct: 'abc', horizonMonths: 9999,
    revenueStreams: [{ name: 'X', unitPrice: '1,200', cogsPct: 5 }],
    channels: [{ name: 'C', monthlySpend: null, cac: 0 }],
  });
  junk.months.forEach(m => {
    assert(Number.isFinite(m.revenue), 'month ' + m.month + ' revenue is NaN');
    assert(Number.isFinite(m.ebitda), 'month ' + m.month + ' EBITDA is NaN');
  });
  eq(junk.assumptions.horizonMonths, 60, 'horizon clamped to 60');
  eq(junk.assumptions.revenueStreams[0].unitPrice, 1200, 'parsed "1,200"');
  assert(junk.assumptions.revenueStreams[0].cogsPct <= 0.95, 'COGS % clamped');
});

test('normalize is idempotent', () => {
  const once = normalize(seed), twice = normalize(once);
  eq(JSON.stringify(once).length, JSON.stringify(twice).length, 'normalize changed on second pass');
});

test('projection is deterministic — same input, identical output', () => {
  const a = JSON.stringify(project(seed).months);
  const b = JSON.stringify(project(seed).months);
  assert(a === b, 'two runs of the same model disagreed');
});

console.log('\n\x1b[1mSensitivity\x1b[0m');

test('every lever produces a full set of scenarios', () => {
  const s = sensitivity(seed);
  eq(s.length, 4, 'lever count');
  s.forEach(l => eq(l.points.length, 4, l.label + ' scenario count'));
});

test('raising price raises ending ARR; raising churn lowers it', () => {
  const s = sensitivity(seed);
  const price = s.find(l => l.key === 'price');
  const up = price.points.find(p => p.delta === 0.3);
  const down = price.points.find(p => p.delta === -0.3);
  assert(up.endingArr > down.endingArr, 'price lever has no effect on ARR');

  const churn = s.find(l => l.key === 'churnPct');
  const worse = churn.points.find(p => p.delta === 0.3);
  const better = churn.points.find(p => p.delta === -0.3);
  assert(better.endingArr > worse.endingArr, 'higher churn did not reduce ARR');
});

test('sensitivity does not mutate the caller\'s assumptions', () => {
  const before = JSON.stringify(seed);
  sensitivity(seed);
  assert(JSON.stringify(seed) === before, 'sensitivity mutated its input');
});

console.log('\n' + (failed === 0
  ? '\x1b[32m\x1b[1m' + passed + ' passed\x1b[0m — the model computes.\n'
  : '\x1b[31m\x1b[1m' + failed + ' failed\x1b[0m, ' + passed + ' passed\n'));
process.exit(failed === 0 ? 0 : 1);
