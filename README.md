# WiFi Hotspot System

A WiFi hotspot billing system: users sign in, pick a package, pay with M-Pesa (STK push), and get timed internet access.

- **Frontend:** React (Vite) + React Router + Axios
- **Backend:** Django + Django REST Framework (token auth)
- **Payments:** M-Pesa Daraja STK Push (with a simulation mode for development)

## Project structure

```text
wifi-hotspot-system/
├── frontend/   React app (Login, Packages, Payment, PaymentStatus)
└── backend/    Django API (accounts, packages, payments, hotspot, config)
```

## 1. Backend setup

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate     Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                # Windows: copy .env.example .env
python manage.py makemigrations accounts packages payments hotspot
python manage.py migrate
python manage.py seed_packages      # adds sample packages
python manage.py createsuperuser    # optional, for /admin
python manage.py runserver
```

API runs at [http://127.0.0.1:8000](http://127.0.0.1:8000)

## 2. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

App runs at [http://localhost:5173](http://localhost:5173) (requests to `/api` are proxied to the backend).

## API endpoints

| Method | Endpoint | Description |
| :----- | :------- | :---------- |
| POST | `/api/accounts/register/` | Create account (phone, password) |
| POST | `/api/accounts/login/` | Login, returns token |
| GET | `/api/accounts/me/` | Current user |
| GET | `/api/packages/` | List active packages |
| POST | `/api/payments/initiate/` | Start STK push (`package_id`, `phone`) |
| POST | `/api/payments/callback/` | M-Pesa callback (called by Safaricom) |
| GET | `/api/payments/<id>/status/` | Poll payment status |
| GET | `/api/hotspot/session/` | Current active session |

## M-Pesa

By default `MPESA_SIMULATE=True` in `.env`, so payments succeed instantly and no real money moves. To go live:

1. Create an app at [Safaricom Developer Portal](https://developer.safaricom.co.ke)
2. Fill in `MPESA_*` values in `backend/.env` and set `MPESA_SIMULATE=False`
3. Set `MPESA_CALLBACK_URL` to a public HTTPS URL (e.g. via ngrok) ending in `/api/payments/callback/`

## Connecting to your router

After a successful payment, `hotspot/services.py` creates a `HotspotSession` and calls `authorize_on_router()`. That function is a stub: plug in your MikroTik (RouterOS API), RADIUS, or CoovaChilli integration there.
