# CardSparks backend

The API uses Django, Django REST Framework token authentication, SQLite for local development, and Mistral for optional AI card generation.

## Run locally

Requirements: Python 3.12 or newer.

```powershell
cd backend
py -3.13 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py runserver
```

The API runs at `http://localhost:8000`. AI generation returns a configuration error until `MISTRAL_API_KEY` is set; authentication, decks, cards, studying, and progress work without it.

## Seed the judge demo account

Set `DEMO_ACCOUNT_EMAIL`, `DEMO_ACCOUNT_PASSWORD`, and optionally
`DEMO_ACCOUNT_NAME` in the backend environment, then run:

```powershell
python manage.py seed_demo_account
```

The command creates a real authenticated user with three polished decks,
mixed scheduling state, and review history. It is idempotent: rerunning it
resets only that configured account so the demo returns to a known state.

## Checks

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

For production, set `DJANGO_DEBUG=false`, provide a strong `DJANGO_SECRET_KEY`, and configure `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` for the deployed domains.
