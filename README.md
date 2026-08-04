# CardSparks

CardSparks turns topics, notes, documents, and camera scans into editable flashcard decks, then closes the loop with spaced repetition, weak-spot practice, test mode, progress insights, and optional AI coaching.

Built as a hackathon project, CardSparks combines a React application with a real Django REST API. It also includes a self-contained mock mode for demonstrations where a backend or AI provider is unavailable.

## Highlights

- Create decks manually or generate cards from a topic, pasted notes, PDF, DOCX, text, Markdown, or an OCR camera scan.
- Review every generated card before saving it.
- Study with SM-2-style scheduling, configurable grading, missed-card retries, and an independent AI study coach.
- Launch cross-deck weak-spots practice or a timed, shuffled practice test.
- Track retention, upcoming workload, streaks, difficult cards, and weak decks.
- Organize cards with search, folders, tags, card types, and bulk editing.
- Check card quality and accept suggested rewrites individually.
- Import and export CSV, Anki-compatible data, JSON backups, Markdown, and PDF.
- Share public read-only decks without exposing private study history.
- Use responsive light and dark themes on desktop or mobile.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React 19, React Router, Vite |
| Document import | PDF.js, Mammoth, Tesseract.js |
| Backend | Python, Django 6, Django REST Framework |
| Authentication | DRF token authentication |
| AI | Mistral API, with deterministic mock fallbacks |
| Local database | SQLite |
| Tests | Node test runner and Django test framework |

## Repository layout

```text
backend/    Django API, authentication, models, scheduling, and AI endpoints
frontend/   React interface plus real and mock API adapters
context.md  Hackathon and Devpost context
TODO.md     Remaining backend handoff notes
```

## Run locally

Requirements:

- Python 3.12 or newer
- Node.js 20 or newer
- npm

### 1. Start the backend

```powershell
cd backend
py -3.13 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py runserver
```

The API starts at `http://localhost:8000`.

### 2. Start the frontend

In a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

The application starts at `http://localhost:5173`.

To connect React to Django, use:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK_API=false
```

Set `VITE_USE_MOCK_API=true` for a backend-free browser demo.

## Demo account

CardSparks includes an idempotent command that creates a real login-ready judge account with three decks, 16 cards, scheduling state, and review history.

Configure the credentials in `backend/.env`, then seed the account:

```dotenv
DEMO_ACCOUNT_EMAIL=demo@cardsparks.app
DEMO_ACCOUNT_PASSWORD=choose-a-strong-demo-password
DEMO_ACCOUNT_NAME=Demo Learner
```

```powershell
python manage.py seed_demo_account
```

Rerunning the command resets only the configured demo account. It does not modify another learner's account or decks.

## AI configuration

Add a Mistral API key to `backend/.env` to enable real card generation and AI feedback:

```dotenv
MISTRAL_API_KEY=your-key
```

Authentication, deck management, studying, progress, and exports work without an AI key. Mock mode provides deterministic generated cards and coaching for demonstrations.

## Production configuration

Do not commit a production `.env`. Configure these values in the hosting provider instead:

```dotenv
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=a-new-long-random-production-secret
DJANGO_ALLOWED_HOSTS=api.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
CSRF_TRUSTED_ORIGINS=https://app.example.com
TIME_ZONE=America/Los_Angeles
MISTRAL_API_KEY=your-production-key

DEMO_ACCOUNT_EMAIL=demo@cardsparks.app
DEMO_ACCOUNT_PASSWORD=a-strong-public-demo-password
DEMO_ACCOUNT_NAME=Demo Learner

# Enable these when the host terminates HTTPS and forwards to Django.
DJANGO_TRUST_X_FORWARDED_PROTO=true
DJANGO_SECURE_SSL_REDIRECT=true
DJANGO_SESSION_COOKIE_SECURE=true
DJANGO_CSRF_COOKIE_SECURE=true
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=true
DJANGO_SECURE_HSTS_PRELOAD=true
```

Frontend build variables:

```dotenv
VITE_API_BASE_URL=https://api.example.com
VITE_USE_MOCK_API=false
```

Run the release steps from the backend directory:

```powershell
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py seed_demo_account
python manage.py check --deploy
```

Then build the frontend:

```powershell
cd frontend
npm ci
npm run build
```

Serve Django through the hosting provider's production WSGI server and serve `frontend/dist` through the frontend host. SQLite is suitable for a local demo; use a persistent production database or persistent disk before accepting real learner data.

## Validation

```powershell
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test

cd ..\frontend
npm test
npm run build
```

## Privacy and product behavior

- Imported files and photos are parsed in the browser; CardSparks does not upload the original source files.
- AI-generated cards remain editable drafts until the learner saves them.
- Study scheduling is saved before optional coaching begins, so an AI failure cannot invalidate a completed session.
- Practice-test results do not change spaced-repetition schedules unless the learner explicitly applies them.
- Public deck responses exclude learner email addresses and private review history.

## More documentation

- [Backend setup and checks](backend/README.md)
- [Frontend setup and API modes](frontend/README.md)
- [Hackathon project context](context.md)
