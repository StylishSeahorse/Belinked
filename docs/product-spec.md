# Belinked Product Specification

Verified on 26 May 2026 against official Linktree sources:

- Linktree pricing page: https://linktr.ee/s/pricing
- Linktree Help Centre paid-features overview, published 12 March 2026: https://linktr.ee/help/en/articles/5434140-an-overview-of-paid-features-available-on-linktree

This project is not a Linktree clone. It implements a similar link-in-bio category for one local owner with original naming, UI, copy, implementation, and assets.

## Feature Matrix

| Category | Official Free/Pro-style capability observed | Belinked local feature |
| --- | --- | --- |
| Links | Unlimited links, headers, thumbnails/icons, featured layouts, scheduling, prioritization/animation | Unlimited ordered blocks, headers/text/separators, thumbnails/icons, featured flag, pulse animation, scheduled/expired/hidden/archived states |
| Embeds | Video, music, podcast, newsletter, stores/products, contact-style blocks | Typed blocks for video, music, podcast, newsletter, calendar, contact, custom embed, product, subscriber form |
| Profile | Custom profile image/title/bio, hero/video image on paid tiers | Root public page, display name, username, bio, badge, avatar, logo, SEO/OG metadata, publication toggle |
| Themes | Free themes, advanced themes, custom colors, button/font styles, wallpapers, title styling | Starter themes, custom themes, colors, fonts, layout, radius, shadows, saved theme selection |
| QR | QR creation and paid customization | Owner-only PNG QR generation for the public profile |
| Analytics | Views/clicks, custom date ranges, deeper paid insights, referrers/device-like insight | First-party profile views, link/short-link clicks, CTR, referrers, browser, OS, device, bot flag, date filters, CSV/JSON export |
| Marketing tech | UTM parameters, GA/Meta Pixel integrations, audience integrations | UTM parameters, local settings model for integrations; external trackers intentionally not enabled by default |
| Redirects/short links | Redirect link, shortener/custom back-halves on higher tiers | Profile priority redirect, local `/s/{code}` short links, click tracking |
| Monetization | Digital products, courses, shops, sponsored links | Product blocks and protected-download-ready model surface; payment processing intentionally out of scope for local MVP |
| Account management | Multi-plan, admins, billing, support response tiers | Excluded by design: single owner, no SaaS billing, no public registration, no teams |

## Local Product Scope

Belinked is a single-user, self-hosted web app. It manages one public profile page and one private owner dashboard. It is intended for `docker compose up --build`, SQLite persistence, local uploads, first-party analytics, and simple secure owner authentication.

## Security And Privacy Notes

- No public registration or tenant separation.
- Passwords are hashed with bcrypt.
- Sessions are stored server-side and delivered via HTTP-only cookies.
- Login attempts are rate-limited by email and salted IP hash.
- Public analytics are first-party and bot-aware.
- User supplied URLs are validated to safe protocols.
- Secrets stay server-side through environment variables.
- File upload storage is reserved behind `public/uploads`; upload endpoints should enforce MIME/type/size before enabling broad uploads.
- Export and deletion support are local-owner controls. GDPR/APP-style obligations depend on deployment context and are not legal advice.

## Phase Plan

1. Phase 1: runnable local foundation with auth, profile, blocks, public page, analytics, QR, short links, export, Docker, tests.
2. Phase 2: file uploads, richer embed renderers, social-icon manager, CSV import, reset workflow.
3. Phase 3: protected digital product downloads, optional SMTP password reset, S3-compatible storage adapter.
4. Phase 4: advanced analytics visualizations, geolocation adapter, bot rule tuning, optional external pixels with consent.
