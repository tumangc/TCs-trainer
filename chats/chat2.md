# Proceeding to next step

_Started 2026-09-15 14:27 UTC_

---

## User

Continuing from "AI runner training app".

## Assistant

We've been designing TCs Trainer, an AI running coach app for three personas (competitive half/marathon runner, structured club runner, casual consistency-seeker). The app adapts workouts to recovery, builds periodized plans, auto-reschedules, analyzes runs, and explains decisions in plain English.

Through nine rounds of questions, we locked in: TC (the AI coach) signs its notes; Today screen leads with the day's full prescription; the app remembers view density (simple/full toggle); constraints include unavailable days, max time per day, cross-training days, long-run preference, recurring commitments; a standing "open questions" list surfaces uncertainty; notifications cover morning brief, plan changes, post-run analysis ready, coach questions, weekly review.

We chose Today-A (Prescription sheet) as the primary direction — prescription-first UX. Watch syncing is device-agnostic; plan display is a week list with collapsible block overview above; the Amend flow lets users free-text TC to revise sessions. Onboarding is Goal → Constraints → Fitness → Plan preview, watch prompted later. Post-run analysis is a timeline with TC's notes pinned to moments. Profile holds zones/thresholds, devices, constraints, race calendar, TC's learning log, units, notifications, privacy.

TC's model of you is a dated log grouped by belief type (e.g., "VO2 max estimate," "injury risk"), each tappable to see revision history.

I've built Plan, Progress, and TC's Model of You screens. Progress charts Load & Form (CTL/ATL/TSB), weekly volume, race prediction over time, and personal bests. Plan shows phase bar + weekly load ramp + key sessions remaining.

Next: build Today (direction A), Onboarding (Goal → Constraints → Fitness → Plan preview), Post-run Analysis, and TC Chat to complete the full flow.

Files: TCs Trainer.dc.html, Today A - Prescription.dc.html (reference).

## User

Looks good, proceed to next step

## Assistant

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

Whats next?

## Assistant

Second pass is in: Onboarding (4 steps, reachable from the left rail), Run analysis (Tuesday's row in Plan, or the rail), and TC chat (new nav tab, ask-anything with real replies).

What's left to make it a complete product story:

- **Profile hub** — zones/thresholds, devices, constraints you can edit after onboarding, race calendar, units, privacy
- **Notifications** — the five-message set (morning brief, plan changed, analysis ready, TC has a question, weekly review) as a lock-screen sheet
- **Watch pairing + mid-run screens** — the one place the app isn't the phone
- **Race week** — taper screens and a race-day prescription, since the whole plan points there

My pick: Profile hub plus the notification set — together they close the loop on "TC keeps learning and tells you when it changes its mind." Say the word, or name a different one.

## User

move on to profile hub and notifications

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

