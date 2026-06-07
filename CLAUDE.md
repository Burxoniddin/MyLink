# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyLink.asia is a "link in bio" platform for Uzbek businesses — users create a branded page at `mylink.asia/<path>` that aggregates their social media links. The stack is Django REST Framework + React (Vite), deployed on a Contabo VPS with Gunicorn + Nginx.

## Development Commands

### Backend (from `backend/`)

```powershell
# Activate venv (Windows)
.\env\Scripts\Activate.ps1

# Run dev server
python manage.py runserver

# Migrations
python manage.py makemigrations
python manage.py migrate

# Run tests
python manage.py test
python manage.py test users          # single app
python manage.py test businesses.tests.BusinessModelTest  # single test

# Create superuser
python manage.py createsuperuser

# Create DB cache table (required for OTP/rate-limiting in dev)
python manage.py createcachetable
```

### Frontend (from `frontend/`)

```powershell
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build to dist/
npm run lint
```

## Architecture

### Backend

Two Django apps under `backend/`:

- **`users`** — Custom user model with `phone_number` as `USERNAME_FIELD` (no username). Authentication is OTP-based: `POST /api/auth/otp/` sends a 5-digit code via Eskiz SMS API, `POST /api/auth/login/` verifies it and returns a DRF Token. OTP codes and rate-limit counters are stored in the DB cache (not in-memory).

- **`businesses`** — Core data. `Business` has a unique `path` slug that becomes the public URL. `Link` rows are ordered social media links attached to a business. `MenuItem` and `SiteSettings` are admin-only site-wide config.

Auth: DRF `TokenAuthentication` — frontend stores the token in `localStorage` and sends `Authorization: Token <key>`.

The `BusinessDetailView` uses `lookup_field = 'path'` (not PK). If a business path is renamed, the edit URL changes.

### Frontend

React 19 SPA with React Router v7. Key pages:

- `/dashboard` — lists user's businesses
- `/business/:path/*` — `BusinessDetail` editor (create/edit links with `@dnd-kit` drag-and-drop reordering)
- `/:path` — `LandingPage`, the public-facing business card (no auth required)

Route order matters: `/business/new` must come before `/business/:path/*` so the literal string "new" isn't treated as a path slug. `/:path` is the final catch-all — any new top-level route must be added above it in `App.jsx`.

API calls go through `src/api.js` — an Axios instance that auto-selects `http://127.0.0.1:8000/api/` in development or `https://api.mylink.asia/api/` in production based on `window.location.hostname`.

No global state library — auth token lives in `localStorage`, all other state is local to each page component.

#### Non-obvious frontend patterns

- **Path availability check**: `BusinessDetail` calls `GET api/businesses/:path/` and treats a 404 as "available" (debounced 500 ms). A 200 means taken.
- **Platform auto-detection**: `detectPlatform(url)` in `BusinessDetail.jsx` maps URL patterns to `icon_type` values. It runs at save time (not on input), so `icon_type` in local state may lag until `handleSave`.
- **URL normalization**: `normalizeUrl()` prepends `https://` and converts bare phone numbers to `tel:` before persisting.
- **Logo upload is two-step**: The main PUT/POST saves text fields and links, then a separate PATCH with `multipart/form-data` uploads `logo_upload`. Removal sends `PATCH { logo_remove: true }`.

#### Link update strategy

`BusinessSerializer.update()` deletes all existing `Link` rows and recreates them on every save. Link PKs change on each save — don't rely on them for client-side state across saves.

### SMS Provider

Eskiz.uz (`users/utils.py`) — Uzbek SMS API. Tokens are valid 30 days and cached in the DB cache for 29 days. In development (no credentials), `send_sms()` logs to stdout and returns `True` to allow testing without real SMS.

### Environment Variables

Create `backend/.env`:

```
DEBUG=True
SECRET_KEY=...
DATABASE_URL=postgres://...   # omit to use SQLite
ESKIZ_EMAIL=...
ESKIZ_PASSWORD=...
```

### Deployment

See `DEPLOY_GUIDE.md` for full server setup. CI/CD via `.github/workflows/deploy.yml` — push to `main` triggers SSH deploy (pull, pip install, migrate, collectstatic, npm build, restart gunicorn/nginx). Requires `SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY` GitHub secrets.

Admin panel uses Jazzmin theme; a compatibility patch for Django 5.2 is applied at import time in `config/jazzmin_patch.py`.
