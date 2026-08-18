# Anti-Corruption Prevent Platform API

This refactor keeps confidential reports separate from public community posts. Report evidence is never exposed by a static `uploads` directory.

## Setup

Create the MySQL database named in `.env`, run [`database/schema.sql`](database/schema.sql), replace `JWT_SECRET` with a long random secret, then run `npm start`.

## Main API

- `POST /api/auth/register`, `POST /api/auth/login`
- `POST /api/reports` (multipart field: `evidence`), `GET /api/reports/mine`
- `GET /api/reports/admin`, `PATCH /api/reports/:publicId/review` (admin only)
- `POST /api/posts` (multipart field: `media`), `GET /api/posts`, plus reactions and comments

Use `Authorization: Bearer <token>` for protected endpoints. Reports start as private and are recorded in `report_actions`; forwarding requires `targetTeam` (`security_team` or `action_team`), and rejection requires a `note`.
