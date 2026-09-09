/* Persistence. Everything lives in this browser's localStorage — no account,
 * no server, no copy of your business idea on someone else's machine.
 *
 * Public: BP.Store.{getSettings,saveSettings,listPlans,getPlan,savePlan,deletePlan,duplicatePlan} */
(function (root) {
  'use strict';
  const P = () => root.BP.config.storagePrefix;
  const KEY_SETTINGS = () => P() + 'settings';
  const KEY_INDEX = () => P() + 'plans';
  const KEY_PLAN = id => P() + 'plan_' + id;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) {
      // Quota is the only realistic failure here, and it must not be silent —
      // a founder losing a plan to a swallowed exception is unforgivable.
      root.BP.bus && root.BP.bus.emit('storage-error', e);
      return false;
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  const Store = {
    getSettings() {
      const d = root.BP.config.defaults;
      return Object.assign({
        apiKey: '', model: d.model, temperature: d.temperature,
        maxTokens: d.maxTokens, stream: d.stream, theme: 'system',
        currency: d.currency,
      }, read(KEY_SETTINGS(), {}));
    },
    saveSettings(patch) {
      const next = Object.assign(Store.getSettings(), patch);
      write(KEY_SETTINGS(), next);
      return next;
    },

    listPlans() {
      return read(KEY_INDEX(), [])
        .map(id => Store.getPlan(id))
        .filter(Boolean)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },
    getPlan(id) { return read(KEY_PLAN(id), null); },

    createPlan(intake) {
      const plan = {
        id: uid(),
        createdAt: Date.now(), updatedAt: Date.now(),
        title: (intake && intake.company) || 'Untitled venture',
        intake: intake || {},
        assumptions: null,
        sections: {},      // id -> { content, generatedAt, model, words }
        companions: {},    // id -> { content, generatedAt }
        competitors: [], team: [], risks: [], milestones: [],
        status: 'draft',
      };
      Store.savePlan(plan);
      return plan;
    },

    savePlan(plan) {
      if (!plan || !plan.id) return null;
      plan.updatedAt = Date.now();
      if (!write(KEY_PLAN(plan.id), plan)) return null;
      const index = read(KEY_INDEX(), []);
      if (!index.includes(plan.id)) {
        index.unshift(plan.id);
        // Keep the library bounded so localStorage never fills up silently.
        while (index.length > root.BP.config.limits.maxPlans) {
          const dropped = index.pop();
          try { localStorage.removeItem(KEY_PLAN(dropped)); } catch (e) {}
        }
        write(KEY_INDEX(), index);
      }
      return plan;
    },

    deletePlan(id) {
      try { localStorage.removeItem(KEY_PLAN(id)); } catch (e) {}
      write(KEY_INDEX(), read(KEY_INDEX(), []).filter(x => x !== id));
    },

    duplicatePlan(id) {
      const src = Store.getPlan(id);
      if (!src) return null;
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = uid();
      copy.title = src.title + ' (copy)';
      copy.createdAt = copy.updatedAt = Date.now();
      return Store.savePlan(copy);
    },

    importPlan(json) {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      if (!parsed || !parsed.sections) throw new Error('That file is not a VentureForge plan.');
      parsed.id = uid();
      parsed.createdAt = parsed.createdAt || Date.now();
      parsed.updatedAt = Date.now();
      return Store.savePlan(parsed);
    },

    uid,
  };

  root.BP = root.BP || {};
  root.BP.Store = Store;

  /* Minimal event bus — lets modules talk without importing each other. */
  const handlers = {};
  root.BP.bus = {
    on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); },
    emit(evt, payload) { (handlers[evt] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } }); },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
