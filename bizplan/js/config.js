/* VentureForge — global configuration.
 * Safe to edit: model list, defaults, and the document set are all data. */
(function (root) {
  'use strict';
  root.BP = root.BP || {};

  root.BP.config = {
    appName: 'VentureForge',
    version: '1.0.0',
    storagePrefix: 'vforge_',

    endpoint: 'https://openrouter.ai/api/v1/chat/completions',

    /* Tried top-to-bottom; a busy or capped model falls through to the next.
     * All end in ":free" — a complete plan costs nothing. */
    freeModels: [
      { id: 'z-ai/glm-5.2:free',                      label: 'GLM 5.2', note: 'Strong structured reasoning — best default' },
      { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron 3 Ultra 550B', note: 'Largest, most thorough prose' },
      { id: 'minimax/minimax-m3:free',                label: 'MiniMax M3', note: 'Fast, good long-form' },
      { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super 120B', note: 'Balanced' },
      { id: 'minimax/minimax-m2.7:free',              label: 'MiniMax M2.7', note: 'Fallback' },
      { id: 'google/gemma-4-31b-it:free',             label: 'Gemma 4 31B', note: 'Last resort' },
    ],

    defaults: {
      model: 'auto',
      temperature: 0.6,      // Lower than a chat app: this is analysis, not fiction.
      maxTokens: 2600,
      horizonMonths: 36,
      currency: 'USD',
      stream: true,
    },

    currencies: [
      { code: 'USD', symbol: '$' },  { code: 'EUR', symbol: '€' },
      { code: 'GBP', symbol: '£' },  { code: 'CAD', symbol: 'CA$' },
      { code: 'AUD', symbol: 'A$' }, { code: 'INR', symbol: '₹' },
      { code: 'JPY', symbol: '¥' },  { code: 'BRL', symbol: 'R$' },
      { code: 'ZAR', symbol: 'R' },  { code: 'NGN', symbol: '₦' },
    ],

    stages: [
      { id: 'idea',     label: 'Idea',            note: 'Pre-product, validating the problem' },
      { id: 'preseed',  label: 'Pre-seed',        note: 'Prototype or early users' },
      { id: 'seed',     label: 'Seed',            note: 'Product live, early revenue' },
      { id: 'seriesa',  label: 'Series A',        note: 'Repeatable growth, scaling the motion' },
      { id: 'growth',   label: 'Growth / later',  note: 'Proven economics, expanding' },
      { id: 'smb',      label: 'Small business',  note: 'Bank loan or grant, not venture' },
    ],

    businessModels: [
      { id: 'saas',        label: 'SaaS / subscription',   recurring: true },
      { id: 'marketplace', label: 'Marketplace',           recurring: false },
      { id: 'ecommerce',   label: 'E-commerce / DTC',      recurring: false },
      { id: 'services',    label: 'Services / agency',     recurring: false },
      { id: 'hardware',    label: 'Hardware / physical',   recurring: false },
      { id: 'app',         label: 'Consumer app',          recurring: true },
      { id: 'local',       label: 'Local / bricks-and-mortar', recurring: false },
      { id: 'other',       label: 'Something else',        recurring: false },
    ],

    /* The document set. Order is the order of the finished plan.
     * `weightsScore` marks sections the readiness score reads. */
    sections: [
      { id: 'summary',     title: 'Executive Summary',        icon: '◆', targetWords: 400, last: true,
        purpose: 'The whole plan in one page, written last so it can reference real numbers.' },
      { id: 'problem',     title: 'Problem',                  icon: '◈', targetWords: 320,
        purpose: 'Who is hurting, how much it costs them, and why now.' },
      { id: 'solution',    title: 'Solution & Product',       icon: '◇', targetWords: 420,
        purpose: 'What you built, how it works, and what makes it hard to copy.' },
      { id: 'market',      title: 'Market Analysis',          icon: '◎', targetWords: 520,
        purpose: 'TAM/SAM/SOM with a bottom-up calculation and named sources.' },
      { id: 'competition', title: 'Competitive Landscape',    icon: '◐', targetWords: 420,
        purpose: 'Real competitors, honest positioning, durable advantage.' },
      { id: 'gtm',         title: 'Go-to-Market Strategy',    icon: '▸', targetWords: 500,
        purpose: 'The specific motion, channel by channel, with costs and conversion.' },
      { id: 'operations',  title: 'Operations Plan',          icon: '⬢', targetWords: 360,
        purpose: 'How the thing actually gets delivered, and what it depends on.' },
      { id: 'team',        title: 'Team & Org Plan',          icon: '◍', targetWords: 340,
        purpose: 'Who is here, what they have done, and the hiring sequence.' },
      { id: 'assumptions', title: 'Key Assumptions',          icon: '≡', targetWords: 340,
        purpose: 'The reasoning behind every number in the model, stated plainly.' },
      { id: 'financials',  title: 'Financial Plan',           icon: '▦', targetWords: 480, computed: true,
        purpose: 'Narrative around the computed model — never a source of figures.' },
      { id: 'risks',       title: 'Risks & Mitigations',      icon: '⚠', targetWords: 380,
        purpose: 'What kills this business, and what you do about each one.' },
      { id: 'funding',     title: 'The Ask & Use of Funds',   icon: '◈', targetWords: 340,
        purpose: 'Amount, structure, allocation, and the milestones it buys.' },
      { id: 'milestones',  title: 'Milestones & Roadmap',     icon: '▪', targetWords: 320,
        purpose: 'Dated, falsifiable checkpoints over the planning horizon.' },
    ],

    /* Companion documents generated from the same model + intake. */
    companions: [
      { id: 'onepager',   title: 'One-Page Brief',        icon: '▤', note: 'The single page you actually send first' },
      { id: 'pitchdeck',  title: 'Pitch Deck Outline',    icon: '▥', note: '12 slides, with the line that goes on each' },
      { id: 'elevator',   title: 'Elevator Pitch',        icon: '▸', note: 'Three lengths: 15s, 60s, 3min' },
      { id: 'swot',       title: 'SWOT Analysis',         icon: '⊞', note: 'Four quadrants, no filler' },
      { id: 'canvas',     title: 'Business Model Canvas', icon: '⊟', note: 'All nine blocks' },
      { id: 'diligence',  title: 'Due-Diligence Q&A',     icon: '⊙', note: 'The 20 questions you will be asked, with answers' },
    ],

    // Rows the intake wizard collects, in order.
    limits: { maxPlans: 40, maxRetries: 2 },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
