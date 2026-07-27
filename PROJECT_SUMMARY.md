# Sidekick AI — Project Summary

**Status:** Feature-complete hackathon demo; validation and submission production remain.  
**Track:** Small Business AI  
**Canonical demo:** Juniper Coffee Co., an independent Portland coffee shop  
**Winning line:** “Sidekick gives a neighborhood owner the daily counsel and learning loop that chains get from a data team.”

This is the three-minute project map for teammates, coding agents, mentors, and judge preparation. For implementation contracts and guardrails, use [`CONTEXT.md`](CONTEXT.md). For setup and API details, use [`README.md`](README.md).

## The problem and the owner

Independent owners already have useful signals—daily sales, the weather, nearby events, and memories of what worked—but rarely have time or staff to connect them. Chains turn those signals into inventory, staffing, and promotion decisions with analysts and specialized software.

Sidekick AI gives a neighborhood owner a friendly daily co-pilot. It does not stop at a dashboard or generic advice: it recommends a specific move, prepares the campaign artifacts, keeps the owner in control, measures the observed result, and carries the lesson into later advice.

## The complete product loop

```text
Sales + weather + nearby events + prior outcomes
                        ↓
             Evidence-backed recommendation
                        ↓
                 Today’s Playbook
                        ↓
 Launch Kit: copy + sign + checklist + timing + campaign code
                        ↓
              Owner edits and approves
                        ↓
       Observed sales + redemptions + owner note
                        ↓
 Campaign Debrief: Signals → Recommendation → Kit → Result → Lesson
                        ↓
                Better future advice
```

The result is a closed learning loop: **counsel → execution → measurement → learning**.

## Why it stands out to judges

| Criterion | What Sidekick demonstrates |
|---|---|
| Creativity | A sidekick rather than a chatbot or analytics dashboard; sales × weather × events become an executable campaign and learning receipt. |
| Real-world impact | Coffee-shop-specific inventory, timing, customer copy, staff ownership, campaign codes, and comparable-day measurement. |
| Technical execution | Real weather/geocoding, optional live events and structured AI, normalized provider contracts, SQLite persistence, caching, migrations, and complete offline fallbacks. |
| Thoughtful design | Plain-language evidence, owner approval, editable artifacts, explicit demo/live labels, mobile styling, and non-causal outcome language. |
| Presentation clarity | The resettable Juniper story moves from a prior measured result to a new Festival Fuel Launch Kit in under three minutes. |

## What is implemented

- Two-step onboarding with CSV upload or manual daily sales.
- Morning briefing with sales trends, seven-day weather, nearby events, and source freshness.
- Three specific recommendations with evidence, confidence, signals, and success metrics.
- Anthropic → Gemini → deterministic local provider chain with shared validation.
- Today’s Playbook with planned, completed, dismissed, and measured actions.
- Launch Kit Studio with:
  - Social and SMS copy.
  - Printable branded sidewalk sign.
  - Operations checklist with timing and owner.
  - Suggested date/time and downloadable calendar task.
  - Comparable-day baseline and measurement plan.
  - Trackable campaign code embedded in every customer-facing artifact.
  - Owner editing, saved drafts, and explicit **Owner approved** versions.
- Outcome entry for observed sales, campaign-code redemptions, helpfulness, and notes.
- Campaign Debrief / Learning Receipt tracing Signals → Recommendation → Launch Kit → Result → Lesson.
- Same-weekday baseline and lift calculation, with language that treats lift as association rather than proof of causation.
- Resettable, idempotent Juniper demo with a clearly labeled prior +$210 result.
- SQLite history, additive migrations, 15-minute event caching, and explicit offline mode.

## Technical shape and honest fallbacks

```text
React + Recharts responsive UI
            │ same-origin JSON
Python standard-library threaded HTTP server
   ├── Open-Meteo geocoding and weather
   ├── Ticketmaster → Nager.Date → labeled curated events
   ├── Anthropic → Gemini → deterministic local generation
   └── SQLite profiles, briefings, actions, outcomes, and campaign kits
```

- The Python backend has no third-party runtime dependencies.
- `AI_PROVIDER=auto` tries configured providers and always falls back locally.
- `SIDEKICK_OFFLINE=1` skips all external requests and immediately produces a complete demo.
- Live, cached, curated, fallback, and seeded information are labeled separately.
- Model input is compact business/action context; Launch Kit generation does not receive raw customer data.
- Owner edits never imply that a message was published, a calendar was remotely changed, or a POS system was connected.

## The Juniper Coffee demo story

1. Click **See the coffee shop demo**.
2. Show the labeled prior action that finished **$210 above its comparable-day baseline**.
3. Open its Campaign Debrief. Point out the association warning and the lesson that zero direct redemptions means attribution should improve.
4. Expand the first event recommendation’s evidence trail.
5. Put that recommendation into Today’s Playbook.
6. Build the **Festival Fuel** Launch Kit.
7. Show `FESTIVALFUEL` in the social copy, SMS, sign, and tracking card.
8. Edit one operations owner and click **Save & approve**.
9. Close on the **Owner approved** badge and explain that later sales and code redemptions feed the next briefing.

Use the timed narration and exact cursor path in [`demo/RECORDING_GUIDE.md`](demo/RECORDING_GUIDE.md).

## Verified baseline

As of July 27, 2026:

- **10 frontend tests pass.**
- **21 backend tests pass.**
- The production Vite build passes.
- Provider schemas, malformed-output fallback, event caching, offline behavior, demo reset, migration, campaign-code grounding, owner approval, redemptions, calendar content, copy actions, and non-causal Debrief language have automated coverage.
- An offline HTTP rehearsal completed demo reset → event recommendation → action → Launch Kit → edited campaign code/owner → approval → completion → measured redemption outcome.
- The repository is pushed to `origin/main` with no known uncommitted product work.

Manual desktop/390px visual inspection, keyboard focus validation, live-key rehearsal, five-person usability sessions, and final recordings remain intentionally listed as pending below.

## Honest limitations

- This is a single-machine hackathon architecture, not a multi-tenant production service.
- There is no authentication, authorization, POS connection, remote calendar integration, or automated social/SMS publishing.
- Campaign-code redemptions are entered by the owner rather than synchronized from a register.
- A sales lift is an observed comparison, not evidence that the campaign caused the change.
- Ticketmaster breadth and external AI depend on optional free keys; the no-key experience remains complete and labeled.
- No real-owner testimonial or usability result will be claimed until the sessions actually happen.

## Final eight-day checklist

| Day | Priority | Owner | Status | Done when |
|---:|---|---|---|---|
| 1 | Desktop and 390px visual QA; print and `.ics` checks | `________` | Not started | The entire demo path is readable and usable at both widths; sign and calendar artifacts open correctly. |
| 2 | Keyboard-only and modal-focus QA; fix only confirmed accessibility problems | `________` | Not started | Focus enters, stays within, and returns from Launch Kit and Debrief dialogs; Escape works. |
| 3 | Run usability sessions 1–3 using the written protocol | `________` | Not started | Raw task times, success/failure, and participant wording are recorded honestly. |
| 4 | Run sessions 4–5 and fix the single most common confusion | `________` | Not started | At least 4/5 reach and explain the Launch Kit flow, or the miss is documented and addressed. |
| 5 | Configure free Gemini/Ticketmaster keys locally and rehearse live, partial-outage, and offline modes | `________` | Not started | Provider/source badges are correct and no mode produces a blank or unlabeled dashboard. |
| 6 | Add one complete mocked lifecycle regression; begin feature freeze | `________` | Not started | Recommendation → kit → edit → approve → result → Debrief → reset passes in one test. |
| 7 | Record the clean primary and fully offline backup takes | `________` | Not started | Three timed rehearsals and both final captures finish below three minutes. |
| 8 | Edit video, finalize submission copy, regression check, and contingency | `________` | Not started | Submission assets are uploaded, links work, tests/build pass, and no unsupported claim remains. |

After the first clean recording, freeze product scope. Defer QR landing pages, authentication, POS integrations, generic chat, automated posting, additional dashboards, and new analytics.

## Run it

Requirements: Node.js 20+ and Python 3.11+.

```powershell
cd C:\SahilAppProjects\Sidekick_AI\Sidekick_AI
npm install
npm start
```

Open `http://localhost:8000` and click **See the coffee shop demo**.

Optional live services are configured in an uncommitted `.env` copied from `.env.example`:

- `GEMINI_API_KEY`: optional free-tier AI.
- `ANTHROPIC_API_KEY`: optional only when free trial credits are available.
- `TICKETMASTER_API_KEY`: optional live concerts, sports, and festivals.

Fully offline rehearsal:

```powershell
$env:SIDEKICK_OFFLINE='1'
npm start
```

## Document map

- [`README.md`](README.md): setup, environment variables, APIs, and architecture.
- [`CONTEXT.md`](CONTEXT.md): coding-agent contracts, guardrails, data shapes, and tradeoffs.
- [`demo/RECORDING_GUIDE.md`](demo/RECORDING_GUIDE.md): timed 2:58 recorded-demo script.
- [`demo/USABILITY_TEST.md`](demo/USABILITY_TEST.md): five-person protocol and honest results table.
- [`demo/DEPLOYMENT_HANDOFF.md`](demo/DEPLOYMENT_HANDOFF.md): hosting teammate checklist.
- [`AGENTS.md`](AGENTS.md): mandatory instructions before changing the repository.
