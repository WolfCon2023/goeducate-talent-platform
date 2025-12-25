# Auth recovery (username + password)

This repo supports **self-service account recovery** so admins are not required for common “forgot username/password” scenarios.

## Summary of flows

### Forgot username
- **UI**: `/forgot-username`
- **API**: `POST /auth/forgot-username` with `{ "email": "user@example.com" }`
- **Behavior**:
  - Always returns `{ ok: true }` (does not reveal whether an account exists).
  - If an active user exists and email is configured, an email is sent with the user’s username (or email if username is not set).

### Forgot password
- **UI**: `/forgot-password`
- **API**: `POST /auth/forgot-password` with `{ "login": "email-or-username" }`
- **Behavior**:
  - Always returns `{ ok: true }` (does not reveal whether an account exists).
  - If an active user exists:
    - Creates a **short-lived reset token** (60 minutes) stored hashed in Mongo.
    - Sends a reset email (if email is configured).

### Reset password (token-based)
- **UI**: `/reset-password?token=...`
- **API**:
  - `GET /auth/reset-password/validate?token=...` → `{ valid: boolean }`
  - `POST /auth/reset-password` with `{ "token": "...", "password": "newPassword" }`
- **Behavior**:
  - Tokens are **single-use** (marked used and cleared on success).
  - Invalid/expired tokens return an error from the reset endpoint.

### Change password (logged-in)
- **UI**: `/change-password`
- **API**: `POST /auth/change-password` (requires bearer token) with `{ "currentPassword": "...", "newPassword": "..." }`

## Login (email or username)
- **UI**: `/login` now accepts **Email or username**
- **API**: `POST /auth/login` supports both:
  - legacy: `{ email, password }`
  - new: `{ login, password }`

## Admin user management additions

Admin can:
- Edit **email**
- Edit **username**
- Toggle **active/disabled**
- Change **role**, **name**, and coach **subscription status**
- Send a **password reset link**:
  - `POST /admin/users/:id/send-password-reset`

## Security model
- **No user enumeration** on public recovery endpoints: they return generic success regardless of whether an account exists.
- Reset tokens are **random**, **short-lived**, and stored **hashed** in the database.
- Sensitive endpoints are **rate-limited** using the existing `rateLimit` middleware.

## Required environment variables (email)

To send recovery emails, configure SMTP + sender:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `INVITE_FROM_EMAIL` (used as sender)

Recommended for reset links:
- `WEB_APP_URL` (e.g. `https://talent.goeducateinc.org`)

If `WEB_APP_URL` is not set, password reset emails will include a raw token instead of a link.

## Security questions (optional recovery)

Users can configure security questions and use them as an additional recovery method.

### Configure security questions
- **UI**: `/account/security` (requires login)
- **API**:
  - `GET /auth/recovery-questions/me` (returns configured questions, no answers)
  - `PUT /auth/recovery-questions/me` with:
    - `currentPassword`
    - `questions: [{ questionId, question, answer }]` (exactly 3)
- **Storage**: answers are stored **hashed** (bcrypt) on the `User` document.

### Recover username/password using security questions
- **UI**:
  - `/recover/username`
  - `/recover/password`
- **API**:
  - `POST /auth/recover/username` with `{ login, answers: [{ questionId, answer }...] }`
  - `POST /auth/recover/password` with `{ login, answers: [{ questionId, answer }...] }`
- **Behavior**:
  - Always returns `{ ok: true }` (no enumeration).
  - If answers match the stored hashes, the system sends the appropriate email (username reminder or password reset link).


