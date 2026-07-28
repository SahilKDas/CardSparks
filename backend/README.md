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

## Checks

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

For production, set `DJANGO_DEBUG=false`, provide a strong `DJANGO_SECRET_KEY`, and configure `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` for the deployed domains.
