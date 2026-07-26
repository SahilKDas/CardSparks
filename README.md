# Sidekick AI

Sidekick AI is a friendly morning co-pilot for small business owners. It connects recent sales, the seven-day weather forecast, and nearby activity, then turns those signals into three specific next moves with a plain-English “why.”

The included demo follows **Juniper Coffee Co.**, an independent Portland coffee shop trying to grow weekday traffic. It is designed to tell a complete hackathon story in under three minutes and remains useful if Wi-Fi or paid APIs fail.

## What works

- Two-step onboarding for business context and goals.
- CSV upload or manual sales entry; invalid rows are ignored safely.
- Responsive morning briefing with sales trend chart, live weather, upcoming events, and source/status labels.
- Three concrete recommendations correlating sales × weather × events.
- One-line signal attribution on every recommendation.
- Real Claude recommendations when an Anthropic key is present.
- Explainable local advisor when it is not, so the demo never becomes a blank screen.
- SQLite history of past briefings.
- One-click, preloaded coffee-shop demo.

## Fastest way to run it

Requirements: [Node.js 20+](https://nodejs.org/) and [Python 3.11+](https://www.python.org/downloads/). Python packages are **not** required—the backend uses the standard library.

From this repository folder, type:

```powershell
npm install
npm start
```

Then open [http://localhost:8000](http://localhost:8000). Click **See the coffee shop demo**.

`npm start` builds the React app and runs the Python API/static server together. Stop it with `Ctrl+C`.

## Optional API keys

The app is fully demoable without keys. To enable AI-written advice:

1. Create an API key in the [Anthropic Console](https://console.anthropic.com/settings/keys). API usage is billed by Anthropic.
2. Copy `.env.example` to `.env`.
3. Put the key after `ANTHROPIC_API_KEY=`.
4. Restart `npm start`.

For live concerts, sports, and festivals, create a free [Ticketmaster Developer](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/) key and put it after `TICKETMASTER_API_KEY=`. This is optional.

```dotenv
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
TICKETMASTER_API_KEY=your-ticketmaster-key
```

Never commit `.env`; it is already ignored by git.

## Live data and fallbacks

| Signal | Normal source | API key | Demo-safe behavior |
|---|---|---:|---|
| Location | Open-Meteo Geocoding | No | Falls back to the entered city label |
| Weather | Open-Meteo Forecast | No | Uses a clearly labeled demo forecast if offline |
| Events | Ticketmaster Discovery | Optional | Tries live Nager.Date public holidays, then clearly labeled curated demo events |
| Recommendations | Anthropic Messages API | Optional | Uses the local explainable multi-signal advisor |
| History | Local SQLite | No | Stored in `backend/sidekick.db` |

The UI always identifies whether weather is live and labels the event source. Curated event listings are never presented as live API data.

## Use your own sales data

The CSV needs a header and two columns:

```csv
date,amount
2026-07-24,1680
2026-07-25,1940
2026-07-26,1525
```

Dates use `YYYY-MM-DD`; amount is daily gross sales. A ready-made file is at [`demo/sample_sales.csv`](demo/sample_sales.csv).

## Two-minute judge demo

1. On the opening screen, frame Sidekick as a **co-pilot, not another dashboard**. Click the coffee-shop demo.
2. Start with **Three moves worth making**. Read the first action and its “Why this?” line to show sales × event correlation.
3. Point to the rainy-day plan to show weather × sales correlation and concrete staffing/promotion advice.
4. Scroll to **The signals**: live weather, source-labeled events, and the uploaded sales trend.
5. Open **Past advice** to show persisted history and close with: “A local owner gets the kind of daily context a chain’s data team would provide.”

For a live-AI demo, add `ANTHROPIC_API_KEY` beforehand and confirm the badge reads **Powered by Claude**. Without it, the badge honestly reads **Explainable demo advisor**.

## Development and tests

Frontend development (terminal 1):

```powershell
npm run dev
```

Backend (terminal 2):

```powershell
python -m backend.app
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to the backend on port 8000; production uses the same paths from a single server.

Run every automated test:

```powershell
npm run test:all
```

## Architecture

```text
React + Recharts responsive UI
            │ JSON
Python threaded HTTP API (zero pip dependencies)
   ├── Open-Meteo geocoding + forecast
   ├── Ticketmaster / Nager.Date / labeled event fallback
   ├── Anthropic Messages API / explainable local advisor
   └── SQLite profiles + briefing history
```

This intentionally small stack keeps setup and failure modes manageable for a hackathon while still demonstrating real APIs, persistence, structured AI output, input validation, and graceful degradation.
