# VentureForge

**AI business plans where the financials are computed, not written.**

Open `index.html`. Paste a free API key. Answer eleven questions. Four minutes
later you have a thirteen-section business plan, a 36-month financial model, six
companion documents, and an honest score telling you what an investor will
attack first.

No install, no build step, no server, no account. Everything runs in the browser
and stays there.

---

## Why this exists

Every AI business plan generator has the same defect: **the language model writes
the numbers.** It produces a revenue table that looks plausible, a cash-flow
table that looks plausible, and the two do not reconcile. Ask where the £2.4M
came from and there is no answer, because there was never a calculation — only
text shaped like a calculation.

VentureForge inverts the pipeline:

```
    intake ──▶ [AI]  proposes assumptions (JSON only, no prose)
                      │
                      ▼
               [JS]  finance.project()  ← every figure originates here
                      │
                      ├──▶ [AI]  writes 13 sections, handed the COMPUTED numbers
                      ├──▶ [AI]  extracts competitors / risks / team as records
                      └──▶ [AI]  writes 6 companion documents
                                  │
                                  ▼
                            [JS]  readiness score + self-critique
```

The model is told, in every prompt that touches money: *these figures are already
calculated; use them exactly; producing a figure that is not in this block is an
error.* It proposes churn and CAC. It never authors a total.

## What that buys you

**The P&L foots.** Revenue − COGS = gross profit, gross profit − opex = EBITDA,
prior cash + net cash flow = closing cash — in all 36 months, provably.
`tests/finance.test.cjs` asserts these as accounting identities rather than
snapshots, so they hold for any assumptions, not just the fixture.

```
$ node tests/finance.test.cjs
37 passed — the model computes.
```

**Edit any assumption and everything re-derives instantly.** The assumptions
table on the Financial model tab *is* the model. Change monthly churn from 1.8%
to 9% and watch ending ARR halve, the charts redraw, and a new warning appear —
all synchronously, in JavaScript, with no round trip.

**The model argues with you.** It inspects its own output and raises what a
partner would raise:

> **critical** — Cash goes negative in Mar 28 (month 27). The plan needs roughly
> 840,000 GBP more capital, or a lower burn, before it is fundable.
>
> **serious** — LTV:CAC is 1.8:1. Investors look for 3:1 or better; below that,
> growth destroys value rather than creating it.
>
> **warning** — Year 2 revenue is 11.4× year 1. Growth this steep reads as a
> hockey stick and invites scepticism about the acquisition assumptions.

Those warnings are also fed back into the writing prompts, so the plan addresses
its own weaknesses instead of papering over them.

**It refuses to fabricate sources.** Where a claim needs evidence the model does
not have, it is instructed to emit `[VERIFY: mid-market HR software churn
benchmark]`, which renders as a highlighted chip. A named gap is honest; an
invented citation is not.

## Investor readiness score

Nine weighted dimensions, graded the way a partner skims a plan — not "is every
box filled in" but "does this survive ten minutes of questions".

| Dimension | Weight | What loses points |
|---|--:|---|
| Financial rigour | 22 | LTV:CAC under 3:1, sub-40% gross margin, slow payback, cash going negative |
| Problem & solution | 12 | Thin sections, superlatives standing in for evidence |
| Market sizing | 12 | No TAM/SAM/SOM split, no bottom-up arithmetic, unsourced claims |
| Competitive honesty | 10 | Fewer than three named rivals; "we have no competition" is scored as critical |
| Assumption transparency | 10 | No modelled channel, no headcount plan, no stated reasoning |
| Team credibility | 10 | No named people, no specific track record |
| Go-to-market | 10 | A channel list instead of a motion; no costs or conversion rates |
| Risk candour | 8 | Fewer than three risks, or risks with no mitigation beside them |
| The ask | 6 | No amount, no use of funds, no milestones the money buys |

The score returns the gaps that cost the points, ordered by severity, plus the
three cheapest places to win them back. It is a to-do list, not a vanity number.

## What you get

**The plan** — Executive Summary, Problem, Solution & Product, Market Analysis,
Competitive Landscape, Go-to-Market, Operations, Team & Org, Key Assumptions,
Financial Plan, Risks & Mitigations, The Ask & Use of Funds, Milestones. The
summary is written last, so it can summarise a document that exists.

**Companion documents** — one-page brief, 12-slide pitch deck outline, elevator
pitch at three lengths, SWOT, Business Model Canvas, and the twenty hardest
due-diligence questions with answers. All built from the same intake and the
same computed model, so nothing contradicts anything.

**Charts** — revenue against total cost, cash balance, customer base, new
customers by paid/organic mix, unit economics, and where the money goes. Inline
SVG with a crosshair and tooltips, no chart library. Colours are the validated
categorical palette, checked at all-pairs in both light and dark (worst CVD
ΔE 9.2 / 9.4; worst normal-vision ΔE 24.0 / 20.9). Every series carries a direct
label, so identity never rests on colour alone.

**Exports** — Markdown, self-contained styled HTML, print-to-PDF, CSV of all 36
months plus the metrics block, and JSON that round-trips back into the app.
Re-running the engine on an exported `assumptions` object reproduces the model
exactly.

## Setup

1. Get a free key at [openrouter.ai](https://openrouter.ai) — sign in, open
   **Keys**, create one. No card required.
2. Open `index.html` in a browser, or host the folder anywhere static.
3. Paste the key into **Settings**.

The models used all end in `:free`, and the API layer walks the list
top-to-bottom, falling through anything busy or rate-limited, so a daily cap
never kills a generation mid-plan. Each section is saved the moment it finishes:
a closed tab or a stopped run costs you the section in flight, nothing more.

## The financial engine

`js/finance.js` is the centre of gravity. It models:

- **Acquisition** — per channel spend ÷ CAC, with spend growth and CAC inflation
  as channels saturate; plus organic adds with their own growth rate and cap.
- **Retention** — churn charged on the opening base, so a customer is never
  churned in the month they arrive.
- **Revenue** — recurring, one-off and usage streams; recurring bills the average
  of opening and closing base, so a month of fast growth is not credited with a
  full month of revenue it never billed.
- **Costs** — COGS as a share of revenue plus capitalised support payroll;
  payroll with employer burden and scheduled scaling; opex with growth rates and
  per-customer components; paid acquisition as a real cash line, not hidden in a
  ratio.
- **Cash** — collections lagged by DSO while costs are paid immediately, plus
  scheduled funding rounds.
- **Metrics** — blended CAC over paid-acquired customers only, gross-margin-
  adjusted LTV (`null` at zero churn, never infinite), CAC payback, break-even
  month, runway on trailing-quarter burn, peak burn, deepest cash trough,
  capital required, and Rule of 40.
- **Sensitivity** — re-runs the whole projection with churn, pricing, CAC and
  marketing spend flexed ±15% and ±30%, so "which lever actually matters" has an
  answer.

Every input passes through `normalize()`, which coerces and clamps before any
arithmetic runs. Junk in gives you a conservative model, never `NaN` propagating
through 36 months of tables.

## Layout

```
bizplan/
├── index.html              shell and module load order
├── css/style.css           design system, light + dark
├── js/
│   ├── finance.js          the engine — deterministic, Node-testable
│   ├── score.js            investor readiness scoring
│   ├── charts.js           inline SVG charts, no library
│   ├── prompts.js          prompt construction; the "never author a figure" rule
│   ├── generate.js         pipeline orchestration, per-section persistence
│   ├── api.js              OpenRouter adapter, model fallback, JSON repair
│   ├── render.js           markdown → HTML (escape-first), scorecard, metrics
│   ├── export.js           Markdown / HTML / PDF / CSV / JSON
│   ├── store.js            localStorage persistence
│   ├── config.js           models, sections, currencies — all data
│   └── app.js              views, wizard, live assumptions editor
└── tests/finance.test.cjs  37 assertions on the engine
```

## Privacy

There is no backend. Your idea, your numbers and your API key live in this
browser's `localStorage` and are sent to exactly one place: OpenRouter, to
generate text, using your own key. Clearing site data deletes everything —
export first. The financial engine never makes a network call at all.

## Notes

Markdown from the model is HTML-escaped before any structure is applied, and
links are restricted to `http(s)` and `mailto`, so generated text cannot inject
markup or script into the page.

Chart colours, the CVD validation results, and the light-mode contrast relief
rule are documented inline at the top of `js/charts.js`.
