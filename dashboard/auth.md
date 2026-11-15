# Authentication

## Overview

Yieldary AI supports **3 user types** overall (login pages are separate):

1. **Admin**
2. **Farmer**
<!-- 3. **Researcher** -->

Login pages are separate (Farmer login and Admin login); no dropdown on the login page.

- **Farmer** login redirects to the existing Farmer Dashboard (Yieldary AI dashboard).
- **Researcher** mode is reserved for future work (placeholder route for now).
- **Admin** login uses only **username + password** (similar to Django's built-in admin login) and redirects to a separate Admin Panel (to be added later).

Signup supports **2 user types** only:

1. **Farmer** (shown first / on top)
<!-- 2. **Researcher** -->

Signup also uses the same dropdown as the first field. Selecting a type conditionally renders the corresponding fields (maximum efficiency: one page, conditional fields).

---

## Entry / Routing

- Root URL (`/`) opens the **Login page**.
- Login page has two buttons/actions:
  - **Login** — submits credentials.
  - **Create Account** — redirects to the Signup page (`/signup`).

## Login Page (Farmer)

- email
- password
- forgot password
- link to signup

On success → redirect to Farmer Dashboard (`/dashboard`).

## Admin Login (separate page)

- username
- password

On success → redirect to Admin Panel (to be added later).

---

## Signup Page

**First field:** Dropdown — `Farmer` <!-- | Researcher --> (Farmer on top)

### Farmer Signup Fields
(from `farmer-signup.md`)

- email
- phone number + SMS verification (Firebase phone auth flow)
- name
- place (OpenStreetMap search; fetch lat/long coordinates)
- area of the farm land
- crops grown (list provided by the farmer)
- gender
- age
- terms & privacy consent
- password & confirm password
- preferred language
- link to login

<!-- ### Researcher Signup Fields
(from `researcher-signup.md`)

- email
- name
- phone
- place
- institution / organization name
- gender
- age
- password & confirm password
- link to login -->

---

## Implementation Notes

- Use **plain JavaScript + Tailwind CSS** for login and signup page designs (no Next.js).
- Use conditional rendering based on the dropdown selection to show the correct fields for each user type.
- Admin authentication should mirror Django's built-in admin login (username + password only).
- Farmer signup should store profiles keyed by the authenticated user (Firebase UID or backend user id). <!-- Researcher signup (closed for now). -->
- Phone verification uses Firebase SMS flow; respect Firebase rate limits (3,000 SMS/day default, 900 SMS/minute, 50 SMS/minute per IP).
- Place search uses OpenStreetMap (Nominatim) with debounced queries and requires a selected result to ensure lat/long are captured.
- Implemented in `backend/Farmer/` with Django templates, plain JavaScript and
  Tailwind CSS (no Next.js). Farmer routes live in `Farmer/urls.py`; the root
  URL `/` serves the login page and `/signup/` serves the signup page.
