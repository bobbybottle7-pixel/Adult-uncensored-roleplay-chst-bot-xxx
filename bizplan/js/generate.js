/* Generation orchestration.
 *
 * The pipeline that makes the output trustworthy:
 *
 *   intake ──▶ [AI] assumptions (JSON)
 *                  │
 *                  ▼
 *            [JS] finance.project()  ← every figure is computed here
 *                  │
 *                  ├──▶ [AI] 13 plan sections, each handed the COMPUTED numbers
 *                  ├──▶ [AI] entity extraction (competitors, risks, team)
 *                  └──▶ [AI] 6 companion documents
 *                            │
 *                            ▼
 *                      [JS] readiness score
 *
 * Each stage persists as it completes, so a capped model or a closed tab never
 * costs more than the section in flight.
 *
 * Public: BP.Generate.{run, regenerateSection, generateCompanion, cancel} */
(function (root) {
  'use strict';

  let controller = null;

  function cancel() { if (controller) { controller.abort(); controller = null; } }
  function signal() { return controller ? controller.signal : undefined; }

  const wordCount = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;

  /* Strip a leading H1/H2 if the model repeated the section title despite
   * being told not to — cheaper than another round trip. */
  function cleanSection(text, title) {
    let t = String(text || '').trim();
    const firstLine = t.split('\n')[0] || '';
    const titleWords = title.toLowerCase().replace(/[^a-z ]/g, '');
    if (/^#{1,2}\s+/.test(firstLine) &&
        firstLine.toLowerCase().replace(/[^a-z ]/g, '').includes(titleWords.split(' ')[0])) {
      t = t.split('\n').slice(1).join('\n').trim();
    }
    return t;
  }

  /* --- phase 1 --------------------------------------------------------- */

  async function buildAssumptions(plan, report) {
    report({ phase: 'assumptions', status: 'active', label: 'Deriving financial assumptions' });
    const { system, prompt } = root.BP.Prompts.assumptions(plan.intake);
    const { data, model } = await root.BP.API.json({ system, prompt, signal: signal() });

    // The model's numbers pass through normalize(), which clamps anything
    // absurd rather than trusting the generator.
    const normalized = root.BP.Finance.normalize(Object.assign({}, data, {
      currency: plan.intake.currency || 'USD',
      horizonMonths: plan.intake.horizonMonths || 36,
    }));
    plan.assumptions = normalized;
    plan.assumptionRationale = data.rationale || {};
    plan.assumptionModel = model;
    root.BP.Store.savePlan(plan);

    report({ phase: 'assumptions', status: 'done', label: 'Assumptions derived', model });
    return normalized;
  }

  /* --- phase 2 --------------------------------------------------------- */

  async function writeSection(plan, sectionDef, projection, report) {
    report({ phase: 'section', id: sectionDef.id, status: 'active',
      label: 'Writing ' + sectionDef.title });

    const { system, prompt } = root.BP.Prompts.section(sectionDef, {
      intake: plan.intake, projection, plan,
    });

    let streamed = '';
    const { text, model } = await root.BP.API.complete({
      system, prompt, signal: signal(),
      maxTokens: Math.max(1200, Math.round(sectionDef.targetWords * 3.2)),
      onToken: (delta, full) => {
        streamed = full;
        report({ phase: 'section', id: sectionDef.id, status: 'streaming',
          label: 'Writing ' + sectionDef.title, partial: full });
      },
      onStatus: s => report({ phase: 'section', id: sectionDef.id, status: 'active',
        label: s.text, fellBack: s.fellBack }),
    });

    const content = cleanSection(text || streamed, sectionDef.title);
    plan.sections[sectionDef.id] = {
      content, model, generatedAt: Date.now(), words: wordCount(content),
    };
    root.BP.Store.savePlan(plan);
    report({ phase: 'section', id: sectionDef.id, status: 'done',
      label: sectionDef.title + ' complete', words: wordCount(content) });
    return content;
  }

  /* --- phase 3 --------------------------------------------------------- */

  async function extractEntities(plan, report) {
    report({ phase: 'entities', status: 'active', label: 'Indexing competitors, risks and team' });
    try {
      const { system, prompt } = root.BP.Prompts.extractEntities(plan);
      const { data } = await root.BP.API.json({ system, prompt, signal: signal(), maxTokens: 2000 });
      plan.competitors = Array.isArray(data.competitors) ? data.competitors : [];
      plan.team = Array.isArray(data.team) ? data.team : [];
      plan.risks = Array.isArray(data.risks) ? data.risks : [];
      plan.milestones = Array.isArray(data.milestones) ? data.milestones : [];
      root.BP.Store.savePlan(plan);
      report({ phase: 'entities', status: 'done',
        label: plan.competitors.length + ' competitors, ' + plan.risks.length + ' risks indexed' });
    } catch (e) {
      // Extraction is an enhancement, never a blocker — the prose is already
      // written and the plan is usable without the structured index.
      report({ phase: 'entities', status: 'skipped', label: 'Entity indexing unavailable — prose is unaffected' });
    }
  }

  async function generateCompanion(plan, companionDef, projection, report) {
    report({ phase: 'companion', id: companionDef.id, status: 'active',
      label: 'Building ' + companionDef.title });
    const { system, prompt } = root.BP.Prompts.companion(companionDef, {
      intake: plan.intake, projection, plan,
    });
    const { text, model } = await root.BP.API.complete({
      system, prompt, signal: signal(), maxTokens: 2600,
      onToken: (d, full) => report({ phase: 'companion', id: companionDef.id,
        status: 'streaming', label: 'Building ' + companionDef.title, partial: full }),
    });
    plan.companions[companionDef.id] = {
      content: cleanSection(text, companionDef.title), model, generatedAt: Date.now(),
    };
    root.BP.Store.savePlan(plan);
    report({ phase: 'companion', id: companionDef.id, status: 'done',
      label: companionDef.title + ' ready' });
  }

  /* --- the run --------------------------------------------------------- */

  async function run(plan, opts) {
    const o = opts || {};
    const report = o.onProgress || (() => {});
    const sections = root.BP.config.sections;
    controller = new AbortController();

    const failures = [];

    try {
      // 1. Assumptions, then the deterministic model.
      if (!plan.assumptions || o.regenerateAssumptions) {
        await buildAssumptions(plan, report);
      }
      let projection = root.BP.Finance.project(plan.assumptions);
      report({ phase: 'model', status: 'done',
        label: 'Model computed — ' + projection.months.length + ' months, ' +
               projection.warnings.length + ' issues flagged',
        projection });

      // 2. Sections. Executive summary is deliberately last: it can only
      //    summarise a document that exists.
      const ordered = [...sections.filter(s => !s.last), ...sections.filter(s => s.last)];
      for (const def of ordered) {
        if (plan.sections[def.id] && !o.overwrite) continue;
        try {
          await writeSection(plan, def, projection, report);
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          if (err.code === 'NO_KEY' || err.code === 'AUTH') throw err;
          // One section failing must not abandon the other twelve.
          failures.push({ id: def.id, title: def.title, message: err.message });
          report({ phase: 'section', id: def.id, status: 'failed',
            label: def.title + ' failed — continuing', error: err.message });
        }
      }

      // 3. Structured index for the scorecard.
      await extractEntities(plan, report);

      // 4. Companion documents, if asked for.
      if (o.companions !== false) {
        for (const def of root.BP.config.companions) {
          if (plan.companions[def.id] && !o.overwrite) continue;
          try {
            await generateCompanion(plan, def, projection, report);
          } catch (err) {
            if (err.name === 'AbortError') throw err;
            failures.push({ id: def.id, title: def.title, message: err.message });
            report({ phase: 'companion', id: def.id, status: 'failed',
              label: def.title + ' failed — continuing' });
          }
        }
      }

      // 5. Score the finished article.
      projection = root.BP.Finance.project(plan.assumptions);
      plan.score = root.BP.Score.evaluate(plan, projection);
      plan.status = failures.length ? 'partial' : 'complete';
      plan.failures = failures;
      root.BP.Store.savePlan(plan);

      report({ phase: 'complete', status: 'done',
        label: 'Plan complete — readiness ' + plan.score.total + '/100',
        score: plan.score, failures });

      return { plan, projection, score: plan.score, failures };
    } catch (err) {
      if (err.name === 'AbortError') {
        report({ phase: 'cancelled', status: 'cancelled', label: 'Stopped. Everything written so far is saved.' });
        // A cancelled run still leaves a usable partial plan behind.
        plan.status = 'partial';
        root.BP.Store.savePlan(plan);
        return { plan, cancelled: true };
      }
      report({ phase: 'error', status: 'failed', label: err.message, error: err });
      throw err;
    } finally {
      controller = null;
    }
  }

  async function regenerateSection(plan, sectionId, onProgress) {
    const def = root.BP.config.sections.find(s => s.id === sectionId);
    if (!def) throw new Error('Unknown section: ' + sectionId);
    controller = new AbortController();
    try {
      const projection = root.BP.Finance.project(plan.assumptions);
      await writeSection(plan, def, projection, onProgress || (() => {}));
      plan.score = root.BP.Score.evaluate(plan, projection);
      root.BP.Store.savePlan(plan);
      return plan;
    } finally { controller = null; }
  }

  async function runCompanion(plan, companionId, onProgress) {
    const def = root.BP.config.companions.find(c => c.id === companionId);
    if (!def) throw new Error('Unknown document: ' + companionId);
    controller = new AbortController();
    try {
      const projection = root.BP.Finance.project(plan.assumptions);
      await generateCompanion(plan, def, projection, onProgress || (() => {}));
      return plan;
    } finally { controller = null; }
  }

  root.BP = root.BP || {};
  root.BP.Generate = { run, regenerateSection, runCompanion, cancel, cleanSection };
})(typeof globalThis !== 'undefined' ? globalThis : this);
