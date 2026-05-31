# Belinked

Belinked is a single-user, self-hosted link-in-bio app built for local ownership rather than multi-tenant SaaS. It gives one owner a private admin dashboard and one public profile page with links, embeds, themes, analytics, short links, QR generation, and local media uploads.

This project is intentionally original in branding, UI, copy, and implementation. It is inspired by the link-in-bio category, but it is not a clone of Linktree branding or assets.

## What It Does

- Public profile page served from `/`
- Private owner dashboard served from `/admin`
- One owner account, no public registration, no teams
- Ordered link and content blocks with featured and standard layouts
- Seamless block reordering with drag-and-drop on desktop and up/down controls on touch devices
- Video, music, podcast, newsletter, calendar, contact, embed, product, and subscriber blocks
- Social icon row with top or bottom placement
- Theme editor with colors, fonts, layout, shadows, button styling, and uploaded background images
- Avatar, logo, Open Graph image, and block media uploads stored locally
- First-party analytics for views, clicks, CTR, referrers, browser, OS, device, and bot detection
- Short links at `/s/{code}`
- QR code download for the public page
- SMTP settings and connection testing for local or custom mail delivery
- SQLite database with Prisma

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Prisma
- SQLite
- Server Actions and Route Handlers
- Docker Compose
- Vitest

## Routes

- `/`
  Public profile page
- `/admin`
  Private dashboard
- `/admin/setup`
  First-run owner creation
- `/admin/login`
  Owner sign-in
- `/s/{code}`
  Short link redirect

## Quick Start

### Recommended: Docker Compose

Belinked is designed to run as a local self-hosted app with Docker Compose. The app container serves Belinked on port `3000`, MailHog is included for local email testing on port `8025`, and Docker volumes keep the SQLite database and uploads persistent across restarts.

1. Clone the repo and enter the project folder.

```bash
git clone https://github.com/StylishSeahorse/Belinked.git
cd Belinked
```

2. Copy the environment example.

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The repo already includes a runnable `docker-compose.yml`. A commented template is also available at `docker-compose.example.yml` if you want to reset your local Compose file or build a clean deployment file from scratch.

3. Edit `.env` and, if needed, `docker-compose.yml`.

At minimum, change:

- `SESSION_SECRET`
- `SETUP_EMAIL`
- `SETUP_DISPLAY_NAME`

Use at least 32 random characters for `SESSION_SECRET`. Docker Compose stores SQLite at `file:/app/data/belinked.db` inside the container so the database lives in the `belinked-data` volume.

4. Start the app.

```bash
docker compose up --build -d
```

Then open:

- Public page: [http://localhost:3000](http://localhost:3000)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)
- MailHog: [http://localhost:8025](http://localhost:8025)

On first run, if no owner exists yet, Belinked will send you to `/admin/setup`. The setup form uses `SETUP_EMAIL` and `SETUP_DISPLAY_NAME` from `.env` as defaults.

To stop the app without deleting data:

```bash
docker compose down
```

To view logs:

```bash
docker compose logs -f app
```

To rebuild after pulling updates:

```bash
docker compose up --build -d
```

Do not run `docker compose down -v` unless you intentionally want to delete the local database and uploaded files.

### Environment

Copy `.env.example` to `.env` and adjust values as needed. Docker Compose can also define the same values under the `environment` section in `docker-compose.yml`; values in Compose are what the container receives at runtime.

Important variables:

- `DATABASE_URL`
- `APP_URL`
- `SESSION_SECRET`
- `COOKIE_SECURE`
- `SETUP_EMAIL`
- `SETUP_PASSWORD`
- `SETUP_DISPLAY_NAME`
- `BELINKED_AUTO_CREATE_OWNER`
- `SMTP_HOST`
- `SMTP_PORT`
- `UPLOAD_MAX_MB`
- `VIDEO_UPLOAD_MAX_MB`

Note:
The current app uses the setup screen at `/admin/setup` for first-run owner creation. `SETUP_EMAIL` and `SETUP_DISPLAY_NAME` are used as setup form defaults. `SETUP_PASSWORD` is only used when `BELINKED_AUTO_CREATE_OWNER=true`, which provisions an owner during seeding and sends `/admin` to the login page instead of setup. Keep `COOKIE_SECURE=false` for plain local HTTP; set it to `true` when serving Belinked over HTTPS.

### SMTP With Docker

The example Compose file includes MailHog:

- SMTP host inside Docker: `mailhog`
- SMTP port inside Docker: `1025`
- MailHog inbox in your browser: [http://localhost:8025](http://localhost:8025)

In the admin dashboard, go to `/admin/settings`, set the email provider to `smtp`, use `mailhog` and `1025`, then click `Test SMTP connection`.

For a real SMTP provider, replace the host and port, then enter the username, password, from name, and from email in the Settings screen. Belinked stores those settings locally in SQLite.

## Local Development

If you want to run outside Docker:

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Note:
Docker is the more reliable path on this machine class because local Prisma native engine compatibility can be awkward on some Windows setups.

## Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run db:generate
npm run db:push
npm run db:seed
```

## Storage

Belinked is local-first and currently uses local storage only.

- SQLite database
- Uploaded media under `public/uploads`
- Docker volumes for persistent app data and uploads

## Current Feature Areas

### Profile

- Display name, username, bio, badge
- Avatar upload or URL
- Logo upload or URL
- SEO title and description
- Open Graph image upload or URL
- Publish toggle
- Priority redirect

### Blocks

- Link blocks with featured and standard display
- Type-specific admin fields
- Drag-and-drop ordering in the admin dashboard
- Scheduling, hidden, archived, and expired states
- Media upload or media URL
- Link metadata fetching for title and image
- UTM support for links

### Socials

- Instagram, Facebook, YouTube, Spotify, SoundCloud, TikTok, X, Telegram, Twitch, Website
- Top or bottom placement on the public page
- Platform icons with live preview
- Reorderable by numeric position

### Themes

- Starter themes
- Custom themes
- Background color or background image upload/URL
- Button styling
- Font family
- Radius, shadows, layout
- Darker, polished admin editing interface

### Analytics

- Profile views
- Link clicks
- Short link clicks
- CTR
- Referrers
- Browser, OS, device
- Bot-aware event records
- CSV and JSON export

## Security Notes

- Passwords are hashed with bcrypt
- Sessions are HTTP-only cookies with expiry
- Login attempts are rate-limited
- URLs are validated to safe protocols
- Uploads are type- and size-restricted
- Secrets stay server-side

See [docs/security-checklist.md](docs/security-checklist.md) for the current checklist.

## Project Docs

- Product spec: [docs/product-spec.md](docs/product-spec.md)
- Security checklist: [docs/security-checklist.md](docs/security-checklist.md)

## Status

Belinked is already runnable locally with Docker and includes:

- Authenticated admin dashboard
- Dark-themed admin UI with mobile navigation
- Public profile at `/`
- Block editing
- Drag-and-drop block ordering
- Social management
- Theme customization
- Local uploads
- Analytics
- Short links
- QR generation

Still good candidates for future work:

- CSV import UI
- Password reset flow using configured SMTP
- Protected digital download flow
- Optional S3-compatible storage adapter
- Richer analytics visualizations
