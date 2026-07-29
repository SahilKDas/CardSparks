#!/bin/bash
source ./venv/bin/activate &
cd backend
python manage.py runserver &
cd ../frontend
npm run dev
