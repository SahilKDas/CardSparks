# Deployment Teammate Handoff

Hosting implementation is intentionally owned by the deployment teammate. The app is one production process serving both the built React app and the API.

## Start command

```powershell
npm start
```

Optional environment variables: `AI_PROVIDER`, `SIDEKICK_OFFLINE`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and `TICKETMASTER_API_KEY`. The app works at $0 with none of the keys.

Set `SIDEKICK_DB_PATH` to a file on a writable persistent volume. Example: `/data/sidekick.db`. Do not store SQLite on an ephemeral build filesystem if demo actions must survive restarts.

## Verify

1. `GET /api/health` returns `{"status":"ok"}`.
2. Open `/` and click **See the coffee shop demo**.
3. Confirm the measured **+$210** win appears.
4. Add the first event recommendation to the Playbook.
5. Build a Launch Kit and confirm **Festival Fuel**, code `FESTIVALFUEL`, social/SMS copy, sign, checklist, calendar download, and baseline all appear.
6. Edit one field, click **Save & approve**, close the Studio, and confirm the Playbook shows **Owner approved**.
7. Open the prior measured action’s **Campaign Debrief** and confirm the five-step timeline and association-not-causation sentence appear.
8. Use **Business profile → Reset recorded-demo story** and confirm the old kit is gone; the seeded measured action remains and no kit is pre-created.

No remote messaging, calendar, or publishing permissions are required. Launch Kit Copy, Download, and Print actions run in the browser.
