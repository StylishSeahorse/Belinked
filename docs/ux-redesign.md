# Management UX redesign (September 2026)

The goal was to turn the admin from a database-style control panel into a visual link-in-bio editor: **Open → Edit → Preview → Publish**. It is still single-owner, with one profile and one public page.

## Stage 1: audit of the previous admin

| Problem | Where |
| --- | --- |
| 8 top-level sections split along database lines (Dashboard, Links & blocks, Profile, Socials, Appearance, Analytics, Short links, Settings) | Sidebar |
| No preview while editing links; every change was a form submit followed by a page reload | Links & blocks |
| Each block was an accordion wrapped around a technical form, including a raw "Metadata JSON" field | Links & blocks |
| Bio and socials lived two screens away from the links they introduce | Profile, Socials |
| Publish/unpublish was hidden on the Dashboard; there was no Share action; the QR code was buried under Profile | Dashboard, Profile |
| The Dashboard repeated Analytics numbers | Dashboard |
| Appearance was one long form of more than 25 fields | Themes |
| Social ordering used a numeric "position" field | Socials |
| Settings mixed SMTP, Meta tokens, password, backups and audit log on a single page | Settings |
| Dark "control panel" styling unlike a consumer creator tool; inconsistent badges and buttons | Everywhere |

## Stage 2: information architecture

Four sections, with the same navigation on desktop (top bar) and phones (bottom tab bar):

| Section | Contents |
| --- | --- |
| **Links** (home, `/admin`) | Profile header (click to edit picture, name, bio, badge and social icons), the **+ Add** button, link and block cards, page tools (link check, CSV import/export), onboarding checklist, live preview |
| **Appearance** | Theme gallery, Background, Buttons, Fonts, Layout, each with a live preview |
| **Analytics** | Headline numbers, views and clicks chart, top links, traffic sources, devices and countries; details folded away |
| **Settings** | Page, SEO & sharing, Domain, Analytics & integrations, Email, Short links, Security, Data & backups |

**Global, always visible:** a save indicator (Saving… / ✓ Saved / Not saved), a Published/Unpublished pill that toggles publishing, **Share** (copy link, open, native share, QR in PNG/SVG with colours), and an account menu (view page, sign out).

The old URLs (`/admin/blocks`, `/admin/profile`, `/admin/socials`, `/admin/themes`, `/admin/short-links`) now redirect into the new structure.

## Stage 3–5: the editor and preview

- **Autosave.** Editing uses JSON server actions (`app/editor-actions.ts`) with optimistic UI and debounced saves (`useAutosave`). "Saving…" appears as soon as a change is queued, and leaving the page is guarded until every queued change has been written. Errors show on the card and as a toast; nothing is lost silently.
- **Live preview.** `LivePreview` renders the *real* public page component from in-memory editor state, so the preview is exactly what visitors see and it updates as you type. It has phone and desktop modes; on smaller screens a floating **Preview** button opens it full-screen.
- **Add flow.** Content types are grouped (Essentials, Media, Grow & sell), searchable, and have icons and descriptions. Choosing one opens a quick form of one to three fields. URLs without `https://` are accepted, and a link's title is auto-suggested from the page. The catalog is data (`lib/content-catalog.ts`), so new types don't touch the editor.
- **Link cards.** Each card has a drag handle, a thumbnail or icon, an inline-editable title and URL, a visibility switch, and badges (Hidden, Scheduled, Expired, Featured, Side by side, Link problem, clicks). The ⋮ menu holds Edit details, Duplicate, Hide/Show, View analytics and Delete. Delete has a 5-second **Undo**.
- **Details drawer.** Secondary settings live here: thumbnail, layout (Classic / Featured / Side by side ×2 or ×3), animation, button labels, price, second button, player-link override, schedule (in the owner's timezone), UTM tags, and a private note.
- **Reordering.** Dragging uses pointer events, so it works for mouse, touch and pen, with a lifted card, items shifting to make room and auto-scroll near the edges. The handle also moves the item with the ↑/↓ keys, and screen-reader announcements report each move.
- **Onboarding.** A dismissible "Get your page ready" checklist covers picture, bio, first link, theme, and publish & share. First-run setup signs the owner straight into the editor with their name already on the page.

## Appearance

Theme presets are shown as miniature renderings, not names. Every other choice is a visual card or segmented control (background type, button style and shape, font "Aa" samples, header layout). Presets are never modified: the first customisation saves a single **Custom** theme and makes it active.

## Design system

Everything uses the tokens in `app/globals.css` (canvas, surface, ink, muted, border, violet accent, success, danger) and a shared kit in `components/ui`: toasts plus the save indicator, a native-`<dialog>` modal and drawer (focus trap, Escape, bottom sheet on phones), a dropdown menu with arrow-key support, and a switch. Buttons are pill-shaped (`btn`, `btn-accent`, `btn-secondary`, `btn-ghost`, `btn-danger`), cards are `panel` with a 24px radius, and form fields are `field` + `input` with hints linked by `aria-describedby`.

## Verification

Playwright covers the full owner journey on desktop and phone: setup, profile, add, keyboard and pointer reorder, publish, visitor click, analytics, hide link, logout and protection. It also covers uploads, socials, details/duplicate/undo-delete, every Add type, CSV import, appearance, share, settings tabs, 2FA and backup/restore. It asserts that no browser console errors occur.

## Link thumbnails (October 2026)

A link's thumbnail can come from three places, and the owner's choice always wins:

1. **Automatic.** When a link is added or its URL changes, the server reads the page's preview image (`og:image` / `twitter:image`, falling back to the site's apple-touch-icon). It downloads the image through the SSRF-safe fetcher and stores it in local uploads, after the same type, signature, size and dimension checks as an upload (SVG is never accepted). Visitors never load third-party images. The owner can also use **Fetch from link** in the details panel, or **Fetch missing thumbnails** from the page tools menu.
2. **Icon pack.** **Choose icon** opens a searchable set of about 80 general icons (Lucide, ISC licence) plus the social platform marks, stored as `Block.icon` (`i:<name>` / `s:<platform>`). Only known ids are accepted or rendered. Icons follow the theme's button colours.
3. **Upload.**

Uploading an image or choosing an icon is never overwritten automatically. Removing a thumbnail turns automatic fetching off for that link (`metadata.autoThumbnail = "off"`). Server-action uploads allow request bodies up to 60MB (`serverActions.bodySizeLimit`); the per-file limits are `UPLOAD_MAX_MB` (default 15) and `VIDEO_UPLOAD_MAX_MB`.
