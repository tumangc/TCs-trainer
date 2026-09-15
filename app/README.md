# TCs Trainer

A React + TypeScript + Vite implementation of the `TCs Trainer` Claude Design
handoff (`../project/TCs Trainer.dc.html`). TC is an AI running coach that
writes a daily prescription, shows the inputs behind it, and revises the
plan when you tell it something changed.

## Scope of this pass

All nine screens from the handoff are built: **Onboarding** (goal →
constraints → fitness → plan preview), **Today** (prescription, amend
flow, basis, open questions), **Plan** (collapsible block overview, week
list, run-analysis links), **Progress** (load & form, race prediction,
weekly volume, bests), **Run analysis** (verdict, pace/HR chart, timeline
with pinned notes), **TC chat** (ask-anything with pattern-matched
replies), **TC's model of you** (beliefs with expandable revision
history), **Profile** (zones, devices, constraints, race calendar,
learning log, preferences, data controls), and **Notifications**
(preview cards, per-type toggles, timing) — plus the bottom nav and top
chrome that link them.

Not built: watch pairing / mid-run screens and race week (taper, race-day
prescription) — these were still open items in the design handoff itself,
not just deferred here.

## Design system

Visual tokens and base component classes (`.card`, `.btn`, `.tag`, `.seg`,
`.field`) come straight from the Nocturne design system
(`src/styles/nocturne.css`, copied verbatim from the handoff bundle).
`src/styles/app.css` adds the layout/shell classes this app needs on top of
it. Icons are [Phosphor](https://phosphoricons.com) via `@phosphor-icons/react`.

## Data layer

All data currently comes from `MockCoachService`
(`src/services/mockCoachService.ts`), which reproduces the prototype's
canned data and pattern-matched "AI" replies (e.g. the Amend flow regex-
matches free text to a canned rewrite). Screens only depend on the
`CoachService` interface (`src/services/CoachService.ts`) via
`useCoachService()`, so a real backend/LLM-backed implementation can be
swapped in later by providing a different `CoachService` to
`CoachServiceProvider` — no screen code needs to change.

## Development

```sh
npm install
npm run dev      # start the dev server
npm run lint      # oxlint
npm run build     # typecheck + production build
```
