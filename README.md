# Anti-Corruption Prevent Platform API

This refactor keeps confidential reports separate from public community posts. Report evidence is never exposed by a static `uploads` directory.

## Setup

Create the MySQL database named in `.env`, set `ADMIN_SETUP_KEY` to a private value, run [`database/schema.sql`](database/schema.sql), replace `JWT_SECRET` with a long random secret, then run `npm start`.

## Main API

- `POST /api/auth/register`, `POST /api/auth/login`
- `POST /api/reports` (multipart field: `evidence`), `GET /api/reports/mine`
- `GET /api/reports/admin`, `PATCH /api/reports/:publicId/review` (admin only)
- `POST /api/posts` (multipart field: `media`), `GET /api/posts`, plus reactions and comments
- `POST /api/auth/admin` with `x-admin-setup-key: <ADMIN_SETUP_KEY>` creates an admin account
- `GET /api/admin/complaints`, `PATCH /api/admin/complaints/:publicId/review` for complaint approval, cancellation, and forwarding
- `GET /api/admin/notifications`, `PATCH /api/admin/notifications/:notificationId/read` for security-team notifications

Use `Authorization: Bearer <token>` for protected endpoints. Reports start as private and are recorded in `report_actions`; forwarding requires `targetTeam` (`security_team` or `action_team`), and rejection requires a `note`.
