# SHARPMOVIES API

The Express API uses Supabase Auth for accounts and Supabase Postgres for movie, profile, and review data. Keep all Supabase keys on the server; do not put the service-role key in the React app or `src/services/api.js`.

## Setup

1. From this directory, install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` from the Supabase project's API settings. `SUPABASE_URL` must be the project API URL (for example, `https://<project-ref>.supabase.co`), not a Supabase dashboard URL. Keep `.env` private and never put the secret key in the React app. Existing `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` names are also accepted.
3. Run `supabase/schema.sql` in the Supabase SQL Editor.
4. Start the API with `npm start`.
5. In another terminal, run the React app from `../the-rush` with `npm start`. The development proxy forwards `/api` requests to `http://localhost:5000`; set `REACT_APP_API_URL` for a separately hosted API.

The API health check is `GET /api/health`. It reports whether the project URL and required keys appear configured; it does not make a live database query.

Signup email delivery and rate limits are controlled by Supabase Auth, not this API. If signup returns `429`, stop retrying and wait for the applicable limit to reset. Supabase's built-in email provider has a low send quota; configure a custom SMTP provider in the project's Authentication settings for ongoing signup emails. Existing users should sign in rather than sign up again.

New accounts receive the `member` role. To seed `admin@gmail.com`, run `npm run seed:admin` from `backend/`. The command promotes an existing Supabase Auth account without changing its password. If the account does not exist, it creates a confirmed account and prompts for a new password without echoing it to the terminal. Set `ADMIN_EMAIL` to use a different address. Admin endpoints enforce the role on the server.

## Routes

- `GET /api/session`, `POST /api/auth/signup`, `POST /api/auth/signin`, `POST /api/auth/signout`, `POST /api/auth/password`
- `GET /api/movies`, `GET /api/movies/:id`
- `GET /api/reviews`, `POST /api/reviews`
- `GET /api/admin/overview`, `GET /api/admin/reviews`, `DELETE /api/admin/reviews/:id`
- `POST /api/admin/users` (admin only; creates a confirmed member account)
- `POST /api/admin/movies`, `DELETE /api/admin/movies/:id`

Authenticated routes accept a Supabase access token in the `Authorization: Bearer <token>` header.
