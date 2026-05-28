# Security Checklist

- Rotate `SESSION_SECRET` before production use.
- Change the seeded owner password immediately.
- Run behind HTTPS when exposed beyond localhost.
- Keep `DATABASE_URL` and SMTP credentials out of client code.
- Restrict uploads to known-safe image/document MIME types and size limits.
- Keep short-link destinations limited to `http`, `https`, `mailto`, or `tel`.
- Review any custom embed HTML before enabling raw rendering.
- Back up the SQLite database and uploads directory before reset/delete operations.
- Add a real IP geolocation database only if privacy disclosures and retention policies are updated.
- Treat privacy/compliance notes as implementation guidance, not legal advice.
