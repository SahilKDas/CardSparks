# CardSparks frontend

CardSparks is a demo-ready React frontend for an AI-assisted flashcard study app. Learners can create decks manually or generate a first draft from a topic, edit every card, and run a flip-card study session with self-ratings.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The Vite server runs at `http://localhost:5173` by default.

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

## API configuration

Configuration lives in `.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK_API=true
```

- `VITE_API_BASE_URL` is the Django/DRF origin. Do not add a trailing slash.
- `VITE_USE_MOCK_API=true` runs the complete product locally using browser `localStorage`. It ships with three sample decks, simulates AI generation, and persists edits and study ratings between refreshes.
- Set `VITE_USE_MOCK_API=false` to call the DRF endpoints documented in [API_ASSUMPTIONS.md](./API_ASSUMPTIONS.md). Restart Vite after changing environment variables.

When using the real API, allow `http://localhost:5173` in Django CORS/CSRF settings as appropriate for the backend auth scheme.

## Available scripts

```bash
npm run dev      # start the development server
npm run build    # create a production build in dist/
npm run preview  # serve the production build locally
npm test         # run scheduling and study-feature unit tests
```

## Product flows

- Dashboard with deck search, card totals, mastery, and last-studied dates
- Manual deck creation with editable front/back card rows
- AI generation preview with editable/deletable cards before saving
- Pasted-notes generation with source-derived mock previews and a pending real API contract
- Deck detail editing, card CRUD, deck deletion, and AI generation into an existing deck
- Study mode with flip animation, previous/next navigation, recall ratings, completion summary, and local mastery updates
- Independent post-session study coaching that never blocks or retries a saved schedule
- Login/signup forms with protected learner routes; demo mode accepts any non-empty email/password
- Responsive navigation and light/dark themes

## Project structure

```text
src/
  components/  Shared layout, feedback, icons, deck cards, and editors
  context/     App state, auth identity, theme, and mutation coordination
  data/        Demo seed decks
  pages/       Dashboard, creation, detail, study, and auth routes
  services/    Real DRF client and persistent mock adapter
```

The frontend can run independently in mock mode or connect to the Django API in `../backend`.

