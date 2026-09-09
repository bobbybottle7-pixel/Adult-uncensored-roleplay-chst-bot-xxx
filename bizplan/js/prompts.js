/* Prompt construction.
 *
 * The governing rule of this file: the model proposes ASSUMPTIONS, and prose
 * ABOUT computed results. It never authors a figure that lands in a table.
 * Every prompt that touches financials is handed the already-computed numbers
 * and told, explicitly, that inventing different ones is an error.
 *
 * Public: BP.Prompts.{assumptions, section, companion, competitorScan} */
(function (root) {
  'use strict';

  const money = (n, cur) => {
    if (n === null || n === undefined || !Number.isFinite(n)) return 'n/a';
    const abs = Math.abs(n);
    const unit = abs >= 1e9 ? [1e9, 'B'] : abs >= 1e6 ? [1e6, 'M'] : abs >= 1e3 ? [1e3, 'k'] : [1, ''];
    return (cur || '') + (n / unit[0]).toFixed(unit[1] ? 1 : 0) + unit[1];
  };
  const pc = n => (n === null || n === undefined || !Number.isFinite(n)) ? 'n/a' : (n * 100).toFixed(1) + '%';

  /* --- shared voice ---------------------------------------------------- */

  const VOICE = [
    'You are a senior partner at an early-stage venture fund who has read ten thousand',
    'business plans and written a few hundred. You write the way good investors think:',
    'concrete, specific, quantified, and sceptical of your own claims.',
    '',
    'Rules you never break:',
    '• Never use the words revolutionary, game-changing, disruptive, synergy, world-class,',
    '  cutting-edge, seamless, or unparalleled. They signal an absence of evidence.',
    '• Never write "there is no competition". Name the alternatives, including doing nothing',
    '  and doing it in a spreadsheet.',
    '• Prefer a specific number with a stated basis over a vague superlative. If you estimate,',
    '  say it is an estimate and show the arithmetic that produced it.',
    '• Write in plain declarative sentences. No bullet-point soup where prose belongs, and',
    '  no prose where a table is clearer.',
    '• Where a claim needs external evidence you do not have, write it as a bracketed',
    '  research task — [VERIFY: industry churn benchmark for mid-market HR software] —',
    '  rather than inventing a citation. A named gap is honest; a fabricated source is not.',
  ].join('\n');

  function intakeBlock(intake) {
    const i = intake || {};
    const rows = [
      ['Company', i.company], ['One-line description', i.pitch],
      ['Stage', i.stage], ['Business model', i.businessModel],
      ['Target customer', i.customer], ['Problem being solved', i.problem],
      ['Product / how it works', i.product],
      ['Pricing today', i.pricing], ['Traction so far', i.traction],
      ['Known competitors', i.competitors], ['Team', i.team],
      ['Geography / market', i.geography], ['Amount being raised', i.raise],
      ['Currency', i.currency], ['Anything else', i.notes],
    ].filter(r => r[1] && String(r[1]).trim());
    return rows.map(r => '• ' + r[0] + ': ' + r[1]).join('\n') || '• (no detail supplied)';
  }

  /* --- phase 1: assumptions -------------------------------------------- */

  function assumptions(intake) {
    const system = VOICE + '\n\n' +
      'Right now you are doing one job: turning a business description into the numeric ' +
      'assumptions behind a financial model. You are not writing prose. Choose figures a ' +
      'sceptical investor would accept as reasonable for this stage, model and geography — ' +
      'not the best case. Where the founder gave a real number, use theirs.';

    const prompt = [
      'Business:', intakeBlock(intake), '',
      'Produce the assumption set for a ' + (intake.horizonMonths || 36) + '-month model.',
      'Return exactly this JSON shape (all numbers plain, no currency symbols, rates as decimals — 0.05 means 5%):',
      '',
      '{',
      '  "startingCash": number,            // cash on hand at month 1',
      '  "startingCustomers": number,',
      '  "churnPct": number,                // MONTHLY logo churn, decimal',
      '  "netExpansionPct": number,         // MONTHLY revenue expansion per retained customer',
      '  "payrollTaxPct": number,           // employer burden on salaries',
      '  "collectionLagMonths": number,     // 0 for card-on-file, 1-2 for invoiced B2B',
      '  "taxRatePct": number,              // corporate tax on profit, 0 if pre-profit',
      '  "revenueStreams": [',
      '    { "name": string, "type": "recurring"|"oneoff"|"usage", "share": number,',
      '      "unitPrice": number, "cogsPct": number, "priceGrowthPct": number }',
      '  ],',
      '  "channels": [',
      '    { "name": string, "monthlySpend": number, "spendGrowthPct": number,',
      '      "cac": number, "cacInflationPct": number, "startMonth": number }',
      '  ],',
      '  "organic": { "month1": number, "growthPct": number, "cap": number },',
      '  "headcount": [',
      '    { "role": string, "count": number, "monthlySalary": number, "startMonth": number,',
      '      "addPerMonth": number, "category": "engineering"|"sales"|"marketing"|"ops"|"ga",',
      '      "inCogs": boolean }',
      '  ],',
      '  "opex": [',
      '    { "name": string, "monthlyAmount": number, "growthPct": number,',
      '      "startMonth": number, "category": "rnd"|"sales"|"marketing"|"ga", "perCustomer": number }',
      '  ],',
      '  "funding": [ { "name": string, "amount": number, "month": number } ],',
      '  "rationale": { "<fieldName>": "one sentence justifying this figure" }',
      '}',
      '',
      'Discipline:',
      '• "share" values across recurring streams describe what fraction of customers buy each;',
      '  they need not sum to 1 but must each be between 0 and 1.',
      '• Monthly churn for healthy B2B SaaS is 0.01–0.03; consumer apps 0.05–0.10. Do not',
      '  submit 0 — no business retains everyone.',
      '• Salaries must be monthly and realistic for the stated geography.',
      '• Include the raise the founder named in "funding". If they named none, include none.',
      '• "rationale" must cover at least churnPct, cac, unitPrice and the largest opex line.',
      '• Be conservative. A model that survives scrutiny beats one that looks exciting.',
    ].join('\n');

    return { system, prompt };
  }

  /* --- phase 2: sections ----------------------------------------------- */

  /* The financial summary handed to every prose prompt. This is the only
   * source of figures the model is permitted to use. */
  function financeBlock(projection, currency) {
    if (!projection) return '(no model computed yet)';
    const m = projection.metrics, t = projection.totals, y = projection.years;
    const cur = currency || '';
    const lines = [
      'COMPUTED MODEL — these figures are already calculated. Use them exactly; do not recalculate or replace them.',
      '',
      'Horizon: ' + projection.months.length + ' months, starting ' + projection.months[0].label + '.',
    ];
    y.forEach(yr => lines.push(
      'Year ' + yr.year + ': revenue ' + money(yr.revenue, cur) +
      ', gross margin ' + pc(yr.grossMarginPct) +
      ', EBITDA ' + money(yr.ebitda, cur) +
      ', ending cash ' + money(yr.endingCash, cur) +
      ', ending customers ' + Math.round(yr.endingCustomers).toLocaleString() +
      ', headcount ' + Math.round(yr.endingHeadcount) +
      (yr.revenueGrowthPct !== null && yr.revenueGrowthPct !== undefined
        ? ', YoY growth ' + pc(yr.revenueGrowthPct) : '')));
    lines.push('');
    lines.push('Ending ARR: ' + money(m.endingArr, cur));
    lines.push('Blended CAC: ' + money(m.blendedCac, cur) +
      ' | LTV: ' + (m.ltv === null ? 'undefined (zero churn)' : money(m.ltv, cur)) +
      ' | LTV:CAC: ' + (m.ltvCacRatio === null ? 'n/a' : m.ltvCacRatio.toFixed(1) + ':1'));
    lines.push('CAC payback: ' + (m.cacPaybackMonths === null ? 'n/a' : Math.round(m.cacPaybackMonths) + ' months'));
    lines.push('Ending gross margin: ' + pc(m.grossMarginPct));
    lines.push('Operating break-even: ' + (m.breakEvenLabel ? m.breakEvenLabel + ' (month ' + m.breakEvenMonth + ')' : 'not reached in horizon'));
    lines.push('Average monthly burn (last quarter): ' + money(m.avgMonthlyBurn, cur));
    lines.push('Peak monthly burn: ' + money(m.peakBurn, cur) + ' in month ' + m.peakBurnMonth);
    lines.push('Lowest cash point: ' + money(m.lowestCash, cur) + ' in month ' + m.lowestCashMonth);
    if (m.capitalRequired > 0) lines.push('ADDITIONAL CAPITAL REQUIRED: ' + money(m.capitalRequired, cur));
    if (m.runwayMonths !== null) lines.push('Runway at current burn: ' + Math.round(m.runwayMonths) + ' months');
    if (m.ruleOf40 !== null) lines.push('Rule of 40 score: ' + Math.round(m.ruleOf40));
    lines.push('Total revenue across horizon: ' + money(t.revenue, cur));

    if (projection.warnings.length) {
      lines.push('', 'The model flagged these weaknesses. Do not hide them — address them where relevant:');
      projection.warnings.forEach(w => lines.push('• [' + w.level + '] ' + w.message));
    }
    return lines.join('\n');
  }

  function section(sectionDef, ctx) {
    const { intake, projection, plan } = ctx;
    const cur = (intake && intake.currency) || 'USD';

    const system = VOICE + '\n\n' +
      'You are writing ONE section of a business plan: "' + sectionDef.title + '".\n' +
      'Purpose of this section: ' + sectionDef.purpose + '\n' +
      'Target length: roughly ' + sectionDef.targetWords + ' words.\n\n' +
      'Output format: GitHub-flavoured Markdown. Start directly with the body — do NOT ' +
      'repeat the section title as a heading, the document adds it. Use ### for any ' +
      'sub-headings, tables where a table is genuinely clearer than prose, and bold ' +
      'sparingly for figures that matter.';

    const parts = [
      'Business:', intakeBlock(intake), '',
      financeBlock(projection, cur), '',
    ];

    // Give each section the context it specifically needs, and nothing else —
    // a bloated prompt makes the model hedge.
    const guidance = {
      problem: 'Establish who has this problem, how they solve it today, what that costs them ' +
        'in money or time, and why the moment for a new answer is now. Quantify the pain. ' +
        'Do not describe your product here at all.',
      solution: 'Explain what the product actually does, in the order a user encounters it. ' +
        'Then explain what makes it defensible: what would a well-funded competitor have to ' +
        'do to copy it, and how long would that take. Be honest if the answer is "not much yet".',
      market: 'Build the market from the bottom up and show the arithmetic explicitly: number ' +
        'of potential customers × realistic annual contract value = TAM. Then narrow to SAM ' +
        '(reachable given geography, segment and channel) and SOM (winnable in three years, ' +
        'and it must be consistent with the customer count in the computed model). Label each ' +
        'figure as an estimate and mark the ones needing verification with [VERIFY: ...]. ' +
        'A market section that only quotes a large analyst number scores badly.',
      competition: 'Name at least four real, specific alternatives — including incumbents, ' +
        'point tools, and the status quo of spreadsheets or doing nothing. For each: what they ' +
        'do well, where they fall short for this customer, and how you win against them. ' +
        'Include a markdown comparison table. Then state, plainly, the one thing a competitor ' +
        'could do that would hurt you most.',
      gtm: 'Describe the actual motion, not a list of channels. For each channel in the model, ' +
        'give the specific first action, the expected cost per acquisition, the conversion ' +
        'assumption, and the sales-cycle length. Include a first-90-days plan with named ' +
        'weekly actions. Tie the channel spend back to the figures in the computed model.',
      operations: 'Cover how the product is built and delivered, the key systems and vendors, ' +
        'what happens when volume multiplies by ten, and the single biggest operational ' +
        'dependency or single point of failure.',
      team: 'Introduce each person with what they have specifically done before — companies, ' +
        'products shipped, measurable outcomes. State the gaps in the founding team honestly, ' +
        'then lay out the hiring sequence, matching the roles and start months in the computed ' +
        'model. Name the one hire that most changes the trajectory.',
      assumptions: 'Walk through the reasoning behind the key numbers in the model: pricing, ' +
        'churn, CAC, conversion, salary levels and the largest cost lines. For each, say what ' +
        'it is based on, how confident you are, and what would make you revise it. Use a table ' +
        'with columns: Assumption | Value | Basis | Confidence | What would change it. ' +
        'Values must match the computed model exactly.',
      financials: 'Narrate the computed model. Explain the shape of the revenue curve, when and ' +
        'why the business crosses into profit, where the cash low point sits and what drives it, ' +
        'and what the unit economics say about whether growth creates or destroys value. ' +
        'Quote the computed figures exactly as given — you must not produce any figure that ' +
        'is not in the computed model block above. Close by naming the two assumptions the ' +
        'whole model is most sensitive to.',
      risks: 'Identify at least six real risks across market, execution, financial, competitive, ' +
        'regulatory and key-person categories. Use a table: Risk | Likelihood | Impact | ' +
        'Mitigation | Early warning signal. The mitigations must be actions, not intentions. ' +
        'Include at least one risk that could genuinely end the company.',
      funding: 'State the amount, the structure, and the runway it buys according to the ' +
        'computed model. Break down use of funds by category with percentages that sum to 100. ' +
        'Tie each block of spend to a specific milestone it unlocks, and state what metrics ' +
        'the company will be able to show at the next raise.',
      milestones: 'Give dated, falsifiable milestones across the horizon, grouped by quarter. ' +
        'Each one must be checkable by an outsider — "500 paying customers by Q3 2027", not ' +
        '"achieve product-market fit". Mark which ones are prerequisites for the next raise.',
      summary: 'Write this LAST and make it stand alone. Cover, in order: what the company does ' +
        'in one sentence a stranger understands, the problem and its size, the solution and why ' +
        'it wins, the market, the traction, the headline financials from the computed model, ' +
        'the team, and the ask. This is the only page many readers will finish, so every ' +
        'sentence must earn its place.',
    }[sectionDef.id] || 'Write this section thoroughly and specifically.';

    parts.push('Task: ' + guidance);

    // Let later sections see earlier ones so the document coheres instead of
    // repeating itself in thirteen different registers.
    const written = root.BP.config.sections
      .filter(s => s.id !== sectionDef.id && plan.sections[s.id] && plan.sections[s.id].content)
      .slice(0, 6);
    if (written.length) {
      parts.push('', 'Already written (do not repeat this material — reference it and move on):');
      written.forEach(s => {
        const body = plan.sections[s.id].content;
        parts.push('--- ' + s.title + ' ---');
        parts.push(body.length > 700 ? body.slice(0, 700) + '…' : body);
      });
    }

    return { system, prompt: parts.join('\n') };
  }

  /* --- phase 3: companion documents ------------------------------------ */

  function companion(companionDef, ctx) {
    const { intake, projection, plan } = ctx;
    const cur = (intake && intake.currency) || 'USD';
    const summary = (plan.sections.summary && plan.sections.summary.content) || '';

    const spec = {
      onepager: 'Produce a one-page brief: company, problem, solution, market, traction, ' +
        'business model, headline financials from the computed model, team, and the ask. ' +
        'Use tight headed blocks. It must fit on one printed page — roughly 450 words.',
      pitchdeck: 'Produce a 12-slide deck outline. For each slide give: the slide number, ' +
        'a headline that states the point (not a label like "Market"), 3-5 bullet points of ' +
        'content, and a one-line note on what visual belongs there. Slide order: Title, ' +
        'Problem, Solution, Why Now, Market, Product, Business Model, Traction, Competition, ' +
        'Team, Financials, The Ask.',
      elevator: 'Write three versions of the pitch, each under its own ### heading: ' +
        '"15 seconds" (one or two sentences, ~35 words), "60 seconds" (~140 words), and ' +
        '"3 minutes" (~420 words, structured as hook, problem, solution, proof, ask). ' +
        'Each must work spoken aloud — short sentences, no subordinate clauses stacked up.',
      swot: 'Produce a SWOT analysis as four ### sections. Four to six entries each, every ' +
        'one specific to this business — anything that could be said of any startup does not ' +
        'belong. Weaknesses and threats must be as substantial as strengths and opportunities; ' +
        'a lopsided SWOT is a tell that the founder is not being honest.',
      canvas: 'Produce a Business Model Canvas covering all nine blocks as ### sections: ' +
        'Customer Segments, Value Propositions, Channels, Customer Relationships, Revenue ' +
        'Streams, Key Resources, Key Activities, Key Partnerships, Cost Structure. Revenue ' +
        'Streams and Cost Structure must match the computed model.',
      diligence: 'Write the 20 hardest questions an investor will ask about THIS specific ' +
        'business, with a direct answer to each. Format as ### Q1 … with the answer beneath. ' +
        'Include the uncomfortable ones — about churn, about the competitor with more money, ' +
        'about why the team, about what happens if the main assumption is wrong. Answers must ' +
        'be honest and use the computed figures; an answer that dodges is worse than none.',
    }[companionDef.id] || 'Produce this document.';

    const system = VOICE + '\n\nYou are producing a companion document: "' +
      companionDef.title + '". Output GitHub-flavoured Markdown. Do not repeat the document ' +
      'title as a top-level heading.';

    const prompt = [
      'Business:', intakeBlock(intake), '',
      financeBlock(projection, cur), '',
      summary ? 'Executive summary of the finished plan:\n' + summary + '\n' : '',
      'Task: ' + spec,
    ].join('\n');

    return { system, prompt };
  }

  /* --- structured extraction for the scorecard -------------------------- */

  /* Pulls competitors, team members, risks and milestones out of the finished
   * prose into structured records, so the readiness score can count them and
   * the UI can render them as data rather than re-parsing markdown. */
  function extractEntities(plan) {
    const system = 'You extract structured records from business-plan text. Be literal: ' +
      'record only what the text actually states.';
    const grab = id => (plan.sections[id] && plan.sections[id].content) || '';
    const prompt = [
      'From the plan text below, extract structured records.',
      '',
      '--- COMPETITION ---', grab('competition').slice(0, 3000),
      '--- TEAM ---', grab('team').slice(0, 2000),
      '--- RISKS ---', grab('risks').slice(0, 3000),
      '--- MILESTONES ---', grab('milestones').slice(0, 2000),
      '',
      'Return this JSON shape:',
      '{',
      '  "competitors": [ { "name": string, "strength": string, "weakness": string, "ourEdge": string } ],',
      '  "team": [ { "name": string, "role": string, "background": string } ],',
      '  "risks": [ { "risk": string, "likelihood": "low"|"medium"|"high",',
      '               "impact": "low"|"medium"|"high", "mitigation": string } ],',
      '  "milestones": [ { "when": string, "milestone": string, "measurable": boolean } ]',
      '}',
      'Include every distinct entry the text supports. Use an empty array where the text has none.',
    ].join('\n');
    return { system, prompt };
  }

  root.BP = root.BP || {};
  root.BP.Prompts = { assumptions, section, companion, extractEntities, financeBlock, intakeBlock, _fmt: { money, pc } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
