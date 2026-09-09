/* Investor-readiness scoring.
 *
 * Grades a plan the way a partner skims one: not "is every box filled in" but
 * "does this survive ten minutes of questions". Each dimension returns a score
 * out of its weight plus the specific gaps behind the deduction, so the result
 * is a to-do list rather than a vanity number.
 *
 * Public: BP.Score.evaluate(plan, projection) -> { total, band, dimensions[], gaps[] } */
(function (root) {
  'use strict';

  const BANDS = [
    { min: 85, band: 'Investor ready',  tone: 'good',     note: 'This would survive a first partner meeting.' },
    { min: 70, band: 'Nearly there',    tone: 'good',     note: 'Credible. Close the gaps below before you send it.' },
    { min: 55, band: 'Needs work',      tone: 'warning',  note: 'The story holds but the evidence is thin in places.' },
    { min: 35, band: 'Early draft',     tone: 'serious',  note: 'Enough to think with, not enough to raise on.' },
    { min: 0,  band: 'Not fundable yet',tone: 'critical', note: 'Major pieces are missing or the economics do not work.' },
  ];

  // Word counts below which a section is doing no real work.
  const THIN = 120;
  const SUBSTANTIAL = 260;

  function words(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function has(plan, id) {
    const s = plan && plan.sections && plan.sections[id];
    return s && words(s.content) > 0;
  }
  function depth(plan, id) {
    const s = plan && plan.sections && plan.sections[id];
    return s ? words(s.content) : 0;
  }

  /* Does the text contain concrete evidence — numbers, dates, named things —
   * or is it all adjectives? This is the single best proxy for rigour. */
  function evidenceDensity(text) {
    const w = words(text);
    if (w < 20) return 0;
    const t = String(text);
    const figures = (t.match(/\d[\d,.]*\s*(%|percent|m|bn|k\b|million|billion)?/gi) || []).length;
    const citations = (t.match(/\b(according to|source:|per |research|survey|study|report)\b/gi) || []).length;
    return Math.min(1, (figures + citations * 2) / (w / 40));
  }

  /* Hedging and filler language that reads as "we have not done the work". */
  function vaguenessPenalty(text) {
    const w = words(text);
    if (w < 20) return 0;
    const hits = (String(text).match(
      /\b(revolutionary|game[- ]chang\w+|disrupt\w*|synerg\w+|world[- ]class|cutting[- ]edge|best[- ]in[- ]class|leverage|paradigm|seamless\w*|unparalleled|unique(?:ly)?|huge(?:ly)?|massive|no competition|first[- ]ever)\b/gi
    ) || []).length;
    return Math.min(1, hits / (w / 150));
  }

  function evaluate(plan, projection) {
    const p = plan || {};
    const proj = projection || null;
    const dims = [];
    const gaps = [];

    const add = (id, label, weight, earned, detail, missing) => {
      dims.push({
        id, label, weight,
        score: Math.max(0, Math.min(weight, earned)),
        pct: weight > 0 ? Math.max(0, Math.min(1, earned / weight)) : 0,
        detail,
      });
      (missing || []).forEach(m => gaps.push({ dimension: label, ...m }));
    };

    /* --- 1. Problem & solution clarity (12) --------------------------- */
    {
      const w = 12; let s = 0; const miss = [];
      const problem = depth(p, 'problem'), solution = depth(p, 'solution');
      s += Math.min(5, problem / THIN * 5);
      s += Math.min(5, solution / THIN * 5);
      const text = sectionText(p, ['problem', 'solution']);
      const vague = vaguenessPenalty(text);
      s += 2 * (1 - vague);
      if (problem < THIN) miss.push({ severity: 'serious', text: 'The problem statement is too thin to establish that anyone is actually hurting.' });
      if (solution < THIN) miss.push({ severity: 'serious', text: 'The solution section does not yet explain what you actually built.' });
      if (vague > 0.4) miss.push({ severity: 'warning', text: 'Cut the superlatives — "revolutionary", "game-changing" and similar read as a substitute for evidence.' });
      add('problem', 'Problem & solution', w, s,
        problem + solution + ' words across problem and solution', miss);
    }

    /* --- 2. Market sizing discipline (12) ----------------------------- */
    {
      const w = 12; let s = 0; const miss = [];
      const market = sectionText(p, ['market']);
      const wc = words(market);
      s += Math.min(4, wc / SUBSTANTIAL * 4);
      // A defensible market section names TAM/SAM/SOM and shows the arithmetic.
      const namesLayers = /\bTAM\b/i.test(market) && /\bSAM\b/i.test(market) && /\bSOM\b/i.test(market);
      if (namesLayers) s += 3; else miss.push({ severity: 'serious', text: 'Break the market into TAM, SAM and SOM — a single big number reads as unexamined.' });
      const bottomUp = /\b(bottom[- ]up|per customer|× |x \d|multiplied|unit[s]? of)\b/i.test(market);
      if (bottomUp) s += 3; else miss.push({ severity: 'serious', text: 'Show a bottom-up market calculation (customers × price), not just an analyst top-line.' });
      s += 2 * evidenceDensity(market);
      if (evidenceDensity(market) < 0.3) miss.push({ severity: 'warning', text: 'Market claims need figures and named sources behind them.' });
      add('market', 'Market sizing', w, s, wc + ' words' + (namesLayers ? ', TAM/SAM/SOM present' : ', no TAM/SAM/SOM'), miss);
    }

    /* --- 3. Competitive honesty (10) ---------------------------------- */
    {
      const w = 10; let s = 0; const miss = [];
      const comp = sectionText(p, ['competition']);
      const wc = words(comp);
      s += Math.min(4, wc / THIN * 4);
      const named = (p.competitors && p.competitors.length) || 0;
      s += Math.min(4, named * 1.5);
      if (named < 3) miss.push({ severity: 'serious', text: 'Name at least three real competitors. "We have no competition" is heard as "I have not looked".' });
      if (/\bno (real )?competit/i.test(comp)) {
        s -= 3;
        miss.push({ severity: 'critical', text: 'The plan claims no competition. That single sentence ends most investor meetings.' });
      } else s += 2;
      add('competition', 'Competitive honesty', w, s,
        named + ' named competitor' + (named === 1 ? '' : 's'), miss);
    }

    /* --- 4. Financial rigour (22) — the heaviest weight ---------------- */
    {
      const w = 22; let s = 0; const miss = [];
      if (!proj) {
        miss.push({ severity: 'critical', text: 'No financial model has been computed.' });
        add('financials', 'Financial rigour', w, 0, 'no model', miss);
      } else {
        const mt = proj.metrics;
        // A model exists and covers a fundable horizon.
        s += 5;
        if (proj.months.length >= 36) s += 2;
        else miss.push({ severity: 'warning', text: 'Extend the projection to 36 months — most investors expect three years.' });

        // Unit economics that clear the standard bars.
        if (mt.ltvCacRatio === null) {
          miss.push({ severity: 'warning', text: 'LTV:CAC cannot be computed — check churn and acquisition assumptions.' });
        } else if (mt.ltvCacRatio >= 3) s += 5;
        else {
          s += Math.max(0, mt.ltvCacRatio / 3 * 5);
          miss.push({ severity: 'serious', text: 'LTV:CAC is ' + mt.ltvCacRatio.toFixed(1) + ':1, below the 3:1 investors expect.' });
        }

        if (mt.cacPaybackMonths !== null && mt.cacPaybackMonths <= 12) s += 3;
        else if (mt.cacPaybackMonths !== null && mt.cacPaybackMonths <= 18) s += 1.5;
        else miss.push({ severity: 'warning', text: 'CAC payback is slow — under 12 months is the mark to aim for.' });

        if (mt.grossMarginPct >= 0.7) s += 3;
        else if (mt.grossMarginPct >= 0.4) s += 1.5;
        else miss.push({ severity: 'serious', text: 'Gross margin below 40% will be valued as a services business.' });

        if (mt.breakEvenMonth) s += 2;
        else miss.push({ severity: 'warning', text: 'The model never breaks even inside the horizon.' });

        if (mt.cashOutMonth) {
          s -= 4;
          miss.push({ severity: 'critical', text: 'The plan runs out of cash in month ' + mt.cashOutMonth + '. Fix the raise or the burn before showing this to anyone.' });
        } else s += 2;
        add('financials', 'Financial rigour', w, s,
          mt.ltvCacRatio !== null ? 'LTV:CAC ' + mt.ltvCacRatio.toFixed(1) + ':1, ' +
            (mt.grossMarginPct * 100).toFixed(0) + '% gross margin' : 'model computed', miss);
      }
    }

    /* --- 5. Assumption transparency (10) ------------------------------ */
    {
      const w = 10; let s = 0; const miss = [];
      const a = p.assumptions;
      if (a) {
        s += 3;
        const streams = (a.revenueStreams || []).length;
        const channels = (a.channels || []).length;
        const staff = (a.headcount || []).length;
        if (streams >= 1) s += 2;
        if (channels >= 1) s += 2; else miss.push({ severity: 'serious', text: 'No acquisition channel is modelled — growth appears from nowhere.' });
        if (staff >= 1) s += 2; else miss.push({ severity: 'warning', text: 'No headcount plan. Payroll is usually the largest line in the model.' });
        if (depth(p, 'assumptions') > 80) s += 1;
        else miss.push({ severity: 'warning', text: 'Write out the reasoning behind the key assumptions in prose, not just numbers.' });
      } else {
        miss.push({ severity: 'critical', text: 'No assumptions recorded.' });
      }
      add('assumptions', 'Assumption transparency', w, s,
        a ? (a.revenueStreams || []).length + ' revenue stream(s), ' +
            (a.channels || []).length + ' channel(s)' : 'none', miss);
    }

    /* --- 6. Team credibility (10) ------------------------------------- */
    {
      const w = 10; let s = 0; const miss = [];
      const team = sectionText(p, ['team']);
      const wc = words(team);
      s += Math.min(4, wc / THIN * 4);
      const members = (p.team && p.team.length) || 0;
      s += Math.min(3, members * 1.5);
      // Named, specific track record beats "experienced team".
      const specifics = (team.match(/\b(previously|founded|led|shipped|scaled|years at|ex-|PhD|patent)\b/gi) || []).length;
      s += Math.min(3, specifics * 0.6);
      if (members === 0) miss.push({ severity: 'serious', text: 'No team members listed. Early-stage investors buy the team first.' });
      if (specifics < 2) miss.push({ severity: 'warning', text: 'Say what the team has actually done before — specific companies, shipped products, measurable outcomes.' });
      add('team', 'Team credibility', w, s, members + ' member(s), ' + wc + ' words', miss);
    }

    /* --- 7. Go-to-market concreteness (10) ---------------------------- */
    {
      const w = 10; let s = 0; const miss = [];
      const gtm = sectionText(p, ['gtm']);
      const wc = words(gtm);
      s += Math.min(4, wc / SUBSTANTIAL * 4);
      s += 3 * evidenceDensity(gtm);
      const channelsNamed = (p.assumptions && (p.assumptions.channels || []).length) || 0;
      s += Math.min(3, channelsNamed * 1.5);
      if (wc < THIN) miss.push({ severity: 'serious', text: 'The go-to-market section needs a concrete first-90-days motion, not a channel list.' });
      if (evidenceDensity(gtm) < 0.3) miss.push({ severity: 'warning', text: 'Attach numbers to the GTM plan — cost per channel, expected conversion, cycle length.' });
      add('gtm', 'Go-to-market', w, s, wc + ' words, ' + channelsNamed + ' modelled channel(s)', miss);
    }

    /* --- 8. Risk candour (8) ------------------------------------------ */
    {
      const w = 8; let s = 0; const miss = [];
      const risks = (p.risks && p.risks.length) || 0;
      const text = sectionText(p, ['risks']);
      s += Math.min(4, risks * 1.2);
      s += Math.min(2, words(text) / THIN * 2);
      // Credit only risks that come with a mitigation.
      const mitigated = (p.risks || []).filter(r => r && words(r.mitigation) > 8).length;
      s += Math.min(2, mitigated * 0.7);
      if (risks < 3) miss.push({ severity: 'serious', text: 'List at least three real risks. A plan with no risks reads as a plan with no thought.' });
      if (mitigated < risks) miss.push({ severity: 'warning', text: 'Every risk needs a mitigation beside it, or it is just a warning label.' });
      add('risks', 'Risk candour', w, s, risks + ' risk(s), ' + mitigated + ' mitigated', miss);
    }

    /* --- 9. The ask (6) ------------------------------------------------ */
    {
      const w = 6; let s = 0; const miss = [];
      const ask = sectionText(p, ['funding']);
      const wc = words(ask);
      s += Math.min(2, wc / THIN * 2);
      const hasAmount = (p.assumptions && (p.assumptions.funding || []).length > 0);
      if (hasAmount) s += 2; else miss.push({ severity: 'serious', text: 'State the amount you are raising and when it lands in the model.' });
      const hasUse = /\b(use of (funds|proceeds)|allocat\w+|runway|hire|milestone)\b/i.test(ask);
      if (hasUse) s += 2; else miss.push({ severity: 'serious', text: 'Break down use of funds and the milestones the money buys.' });
      add('funding', 'The ask', w, s, hasAmount ? 'round modelled' : 'no round modelled', miss);
    }

    const total = Math.round(dims.reduce((a, d) => a + d.score, 0));
    const bandInfo = BANDS.find(b => total >= b.min) || BANDS[BANDS.length - 1];

    // Surface the deductions that cost the most first.
    const order = { critical: 0, serious: 1, warning: 2 };
    gaps.sort((x, y) => (order[x.severity] ?? 3) - (order[y.severity] ?? 3));

    return {
      total,
      max: dims.reduce((a, d) => a + d.weight, 0),
      band: bandInfo.band,
      tone: bandInfo.tone,
      note: bandInfo.note,
      dimensions: dims.sort((a, b) => a.pct - b.pct),
      gaps,
      // The three cheapest points to win, for the "what next" nudge.
      nextBest: dims.filter(d => d.pct < 0.9)
        .sort((a, b) => (b.weight - b.score) - (a.weight - a.score))
        .slice(0, 3)
        .map(d => ({ label: d.label, pointsAvailable: Math.round(d.weight - d.score) })),
    };
  }

  function sectionText(plan, ids) {
    return ids.map(id => (plan.sections && plan.sections[id] && plan.sections[id].content) || '')
      .join('\n\n');
  }

  root.BP = root.BP || {};
  root.BP.Score = { evaluate, _helpers: { words, evidenceDensity, vaguenessPenalty } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
