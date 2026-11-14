# Yieldary AI — Precision Agriculture Portal

Full-stack Django REST Framework (DRF + Simple JWT) backend and React (Vite + Tailwind CSS + Axios) frontend with OpenStreetMap Nominatim geocoding.

## Project Structure

```text
yieldary/
├── backend/     # Django + DRF + Simple JWT (/api/register/, /api/token/, /api/profile/)
└── frontend/    # React + TypeScript + Tailwind CSS + Axios
```

## Quick Start

### 1. Backend (Django)

```bash
cd backend
python -m venv ../venv
# Windows PowerShell: ..\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 2. Frontend (React + Vite)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.
