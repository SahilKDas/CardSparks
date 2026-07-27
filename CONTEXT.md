# Sidekick AI — Teammate and Coding-Agent Context

Read this before changing the project. It is the technical operational map; [`PROJECT_SUMMARY.md`](PROJECT_SUMMARY.md) is the mixed-audience project snapshot, and [`README.md`](README.md) is the user-facing setup and demo guide.

## In one minute

Sidekick AI is a hackathon project for the **Small Business AI** track. It gives an independent owner a morning briefing by correlating:

1. Recent daily sales.
2. Current and forecast weather.
3. Nearby events.
4. Outcomes from actions the owner previously tried.

It then recommends three concrete moves, explains the evidence, lets the owner put a move into **Today’s Playbook**, builds an immediately usable **Launch Kit**, and measures the result against comparable weekdays. The differentiator is the closed loop: advice → campaign artifacts → action → measured outcome → better advice.

The canonical demo persona is **Juniper Coffee Co. in Portland, Oregon**. Demo data is deliberately labeled.

## First ten minutes

```powershell
cd C:\SahilAppProjects\Sidekick_AI\Sidekick_AI
npm install
npm run test:all
npm start
```

Open `http://localhost:8000` and click **See the coffee shop demo**. Do this before editing so you understand the intended story.

Expected baseline:

- 10 frontend tests pass.
- 21 backend tests pass.
- The production build succeeds.
- The demo shows a prior measured result of **+$210 versus baseline**.
- Settings contains **Reset recorded-demo story**.

## Product promise and non-negotiables

The product should feel like a friendly co-pilot, not a generic analytics dashboard or chatbot.

Preserve these rules:

- Recommendations must be specific, short, and measurable.
- Every recommendation exposes 2–3 factual evidence statements, confidence, signals, and a success metric.
- Measured outcomes must feed later recommendation context.
- Live, cached, fallback, and demo data must never be visually conflated.
- Curated events must never be described as live events.
- The app must remain useful with no keys and no network.
- Total required spend must stay at $0.
- Do not add authentication, multi-tenancy, payments, POS integrations, or generic chat during the hackathon unless the product owner explicitly changes scope.

## Architecture

```text
React + Recharts UI
        │ same-origin JSON (/api)
Python ThreadingHTTPServer — standard library only
   ├── Open-Meteo geocoding and weather
   ├── Ticketmaster → Nager.Date → labeled curated events
   ├── Anthropic → Gemini → deterministic local advisor
   └── SQLite profiles, briefings, actions, outcomes, campaign kits
```

Key files:

| Area | Source of truth |
|---|---|
| UI, demo fixtures, view state | `src/App.jsx` |
| Visual system and responsive behavior | `src/styles.css` |
| HTTP routes, integrations, advisor orchestration | `backend/app.py` |
| SQLite schema and action/outcome logic | `backend/store.py` |
| Backend contract tests | `backend/test_app.py` |
| Frontend behavior tests | `src/App.test.jsx` |
| Recording path | `demo/RECORDING_GUIDE.md` |
| Usability protocol | `demo/USABILITY_TEST.md` |

There is intentionally no frontend router and no Python web framework. The single-process production path keeps the demo dependable: Vite builds `dist/`, then the Python server serves both the SPA and `/api`.

## Main data flow

```text
Onboarding/demo reset
        ↓
POST /api/briefing
        ↓
validate profile + summarize sales
        ↓
weather + events + prior measured outcomes
        ↓
AI provider adapter or local advisor
        ↓
normalize one shared recommendation schema
        ↓
dashboard → Playbook → Launch Kit → outcome → next briefing
```

The shared recommendation shape is:

```json
{
  "id": "rainy-day-plan",
  "priority": "Plan ahead",
  "icon": "rain",
  "title": "Make rainy Monday intentional",
  "action": "Concrete action text",
  "why": "One-line signal explanation",
  "signals": ["weather", "sales"],
  "impact": "Protects demand",
  "evidence": ["65% rain chance", "Monday is the softest weekday"],
  "confidence": "medium",
  "success_metric": "Sales versus the usual Monday baseline"
}
```

All providers must pass through `normalize_recommendations`; do not create provider-specific UI branches.

Launch Kits use a second provider-independent contract:

```json
{
  "action_id": 12,
  "provider": "local",
  "offer_name": "Festival Fuel",
  "campaign_code": "FESTIVALFUEL",
  "owner_approved": false,
  "audience": "People heading to the nearby event",
  "schedule": { "date": "2026-08-01", "time": "15:30", "label": "Suggested launch time" },
  "customer_copy": { "social": "...", "sms": "...", "sign_headline": "FESTIVAL FUEL", "sign_body": "..." },
  "operations": [{ "task": "...", "timing": "Before launch", "owner": "Shift lead" }],
  "measurement": { "metric": "Event-day sales versus baseline", "baseline_sales": 1443 },
  "generated_at": "ISO-8601 timestamp"
}
```

All providers pass through `normalize_launch_kit`. The provider input is deliberately limited to business type/goal, action text, evidence, date, and baseline. Do not send raw customer data or invent a discount, price, partnership, or quantity that is absent from the source action/evidence.

The backend derives a memorable alphanumeric campaign code and guarantees that it appears in the social copy, SMS, and sign. `PATCH /api/actions/{id}/launch-kit` is the owner-editing boundary: it accepts only copy, schedule, checklist, code, and approval state; generated provider/baseline metadata remains authoritative.

## API contract

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/briefing` | Build and persist the combined briefing |
| `GET` | `/api/history?business=...` | Read past recommendation sets |
| `POST` | `/api/actions` | Put a recommendation into the Playbook |
| `GET` | `/api/actions?business=...` | Read planned/completed/measured actions |
| `PATCH` | `/api/actions/{id}` | Set `planned`, `completed`, or `dismissed` |
| `POST` | `/api/actions/{id}/outcome` | Record sales/helpfulness/note and calculate lift |
| `POST` | `/api/actions/{id}/launch-kit` | Create/reuse a kit; `{"refresh": true}` replaces it |
| `GET` | `/api/actions/{id}/launch-kit` | Read the stored kit |
| `PATCH` | `/api/actions/{id}/launch-kit` | Persist owner edits and optional approval |
| `POST` | `/api/demo/reset` | Idempotently rebuild the Juniper recorded-demo story |
| `GET` | `/api/health` | Health, version, provider selection, offline status |

Outcome lift is calculated in the backend against historical sales for the same weekday. If no comparable weekday exists, the store falls back to the overall historical average.

Outcomes also store a non-negative integer `redemptions`. The Campaign Debrief uses sales lift and redemption response as evidence but must always describe the relationship as an association, never as proof of causation. Older SQLite databases are upgraded additively with a default of zero redemptions.

## External data and provider behavior

The default is `AI_PROVIDER=auto`:

1. Try Anthropic only when `ANTHROPIC_API_KEY` exists.
2. Try Gemini only when `GEMINI_API_KEY` exists.
3. Always fall back to the deterministic local advisor.

`SIDEKICK_OFFLINE=1` skips all external signals and AI calls immediately. Keep this path fast and functional; it is the backup recorded demo.

Events are cached in memory for 15 minutes. SQLite persists to `backend/sidekick.db`, which is intentionally ignored by git.

Never commit `.env`, API keys, `*.db`, `dist/`, or `node_modules/`.

## Environment variables

Copy `.env.example` to `.env` when keys are available.

| Variable | Default | Meaning |
|---|---|---|
| `AI_PROVIDER` | `auto` | `auto`, `anthropic`, `gemini`, or `local` |
| `SIDEKICK_OFFLINE` | `0` | `1` disables all network-dependent behavior |
| `ANTHROPIC_API_KEY` | empty | Optional Claude API access |
| `ANTHROPIC_MODEL` | configured in example | Claude model override |
| `GEMINI_API_KEY` | empty | Optional free-tier Gemini access |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Gemini model override |
| `TICKETMASTER_API_KEY` | empty | Optional live event listings |
| `SIDEKICK_DB_PATH` | `backend/sidekick.db` | Test/custom SQLite path |
| `VITE_API_URL` | empty | Optional frontend API origin override |

## Testing and definition of done

Run before every commit:

```powershell
npm run test:all
npm run build
git diff --check
```

A change is not done if it:

- Breaks onboarding, one-click demo reset, or the offline path.
- Returns provider output without schema normalization.
- Removes source/demo labels.
- Changes an API shape without updating both UI and tests.
- Makes the measured outcome loop impossible on 390px mobile width.
- Introduces a required paid service or Python package without explicit approval.

For persistence tests, always use a temporary `SIDEKICK_DB_PATH`; never delete a teammate’s local database as test cleanup.

## Known tradeoffs—not surprise bugs

- `App.jsx` and `styles.css` are intentionally concentrated for hackathon speed. Split them only if it directly reduces change risk; avoid a cosmetic architecture rewrite before judging.
- SQLite and the in-memory event cache are single-machine demo choices, not production multi-user infrastructure.
- There is no authentication or authorization.
- Live event breadth depends on a Ticketmaster key; the keyless fallback is honest but curated.
- Gemini free-tier data terms differ from paid usage. The demo uses fictional data; do not upload a real owner’s sensitive data without consent.
- External model identifiers and free-tier limits can change. Keep models configurable through environment variables.
- The frontend bundle is larger than ideal because Recharts is bundled; this is acceptable for the local recorded demo.

## Best next contributions

Choose a bounded task and announce it before editing:

1. Run the five-person usability protocol and fix the most common observed confusion.
2. Add free Gemini/Ticketmaster keys locally and rehearse the primary recording path—never commit the keys.
3. Run the Launch Kit flow at 390px and improve any keyboard/focus issue without changing the demo narrative.
4. Add frontend tests for the complete planned → completed → outcome interaction using mocked API responses.
5. Capture and time a clean normal plus offline take using the Launch Kit reveal in the recording guide.

Avoid speculative feature expansion until the recorded submission is complete.

## Git collaboration

- Start with `git status`; preserve unrelated teammate changes.
- Make small commits with present-tense messages.
- Do not force-push, rewrite history, reset the worktree, or delete local databases.
- Keep contracts, tests, `CONTEXT.md`, and `README.md` synchronized.
- If a change affects the three-minute story, update `demo/RECORDING_GUIDE.md` in the same commit.

When handing off, report: files changed, user-visible behavior, tests run, fallback behavior checked, commit hash, and any key or human input still required.
