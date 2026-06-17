# Snip — URL Shortening Service

A full-featured URL shortening service built with **Node.js + Express + SQLite**. Includes a polished dark-themed frontend, click analytics, QR code generation, link expiry, and password-protected links.

---

## Features

| Feature | Details |
|---|---|
| **URL Shortening** | 7-character nanoid slugs (URL-safe alphabet) |
| **Custom Aliases** | `/my-custom-link` style vanity URLs |
| **Click Analytics** | Tracks clicks by day, browser, OS, device, referrer |
| **QR Code Generation** | PNG and SVG QR codes per link |
| **Link Expiry** | Set TTL in days (1 / 7 / 30 / 90 / never) |
| **Password Protection** | bcrypt-hashed passwords, unlock page included |
| **Analytics Dashboard** | Sparkline, bar charts, stat cards — no external lib |
| **Recent Links** | Table of last 20 created links with copy / analytics / QR |

---

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite via `better-sqlite3` (zero setup, file-based)
- **Password hashing**: `bcryptjs`
- **QR Codes**: `qrcode`
- **UA Parsing**: `ua-parser-js`
- **ID Generation**: `nanoid`
- **Frontend**: Vanilla HTML/CSS/JS (no framework)

---

## Project Structure

```
url-shortener/
├── src/
│   ├── server.js              # Express app entry point
│   ├── routes/
│   │   └── api.js             # REST API routes
│   └── utils/
│       ├── db.js              # SQLite setup + schema
│       └── linkService.js     # Core business logic
├── public/
│   ├── index.html             # Homepage — shorten + recent links
│   ├── analytics.html         # Analytics page
│   ├── protected.html         # Password-unlock page
│   ├── 404.html               # Not found page
│   ├── expired.html           # Expired link page
│   ├── css/style.css          # All styles
│   └── js/
│       ├── main.js            # Homepage logic
│       └── analytics.js       # Analytics rendering + charts
├── db/                        # SQLite database (auto-created)
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js v16+

### Install & Run

```bash
git clone <your-repo-url>
cd url-shortener
npm install
npm run dev      # nodemon hot-reload
# or
npm start        # production
```

Open [http://localhost:3000](http://localhost:3000)

---

## API Reference

### `POST /api/links` — Create a short link

```json
// Request
{
  "url": "https://example.com/very/long/path",
  "alias": "my-link",          // optional
  "password": "secret",        // optional
  "expiresInDays": 7           // optional
}

// Response 201
{
  "slug": "aB3xK7p",
  "shortUrl": "http://localhost:3000/aB3xK7p",
  "qrUrl": "http://localhost:3000/api/qr/aB3xK7p",
  "analyticsUrl": "http://localhost:3000/analytics/aB3xK7p"
}
```

### `GET /api/links` — List recent links (last 20)

### `GET /api/analytics/:slug` — Analytics data for a link

### `GET /api/qr/:slug` — QR code PNG (`?format=svg` for SVG)

### `POST /api/resolve` — Resolve a password-protected link

```json
{ "slug": "aB3xK7p", "password": "secret" }
```

### `GET /:slug` — Redirect to original URL

---

## Database Schema

```sql
links (
  id, slug, original, alias,
  password,       -- bcrypt hash
  expires_at,     -- Unix timestamp
  created_at,     -- Unix timestamp
  clicks          -- running count
)

clicks (
  id, slug, clicked_at,
  referrer, browser, os, device, country
)
```

---

## Production Notes

- Replace SQLite with **PostgreSQL** for multi-instance deployments
- Add rate limiting (see the Rate Limiter project!)
- Add authentication to protect the admin/analytics endpoints
- Deploy to **Railway**, **Render**, or **Fly.io** — all support Node + SQLite for small-scale use

---

## License

MIT
