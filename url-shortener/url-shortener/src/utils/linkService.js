const { customAlphabet } = require("nanoid");
const bcrypt = require("bcryptjs");
const { getDb } = require("../utils/db");

// URL-safe alphabet, no confusing chars (0/O, l/1)
const nanoid = customAlphabet("abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789", 7);

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Create a shortened link.
 */
async function createLink({ originalUrl, alias, password, expiresInDays }) {
  if (!isValidUrl(originalUrl)) {
    throw Object.assign(new Error("Invalid URL. Must start with http:// or https://"), { status: 400 });
  }

  const db = getDb();

  // Check alias availability
  if (alias) {
    if (!/^[a-zA-Z0-9_-]{2,40}$/.test(alias)) {
      throw Object.assign(new Error("Alias must be 2–40 characters: letters, numbers, - or _"), { status: 400 });
    }
    const existing = db.prepare("SELECT id FROM links WHERE slug = ? OR alias = ?").get(alias, alias);
    if (existing) {
      throw Object.assign(new Error("That alias is already taken"), { status: 409 });
    }
  }

  const slug = alias || nanoid();
  const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
  const expiresAt = expiresInDays ? Math.floor(Date.now() / 1000) + expiresInDays * 86400 : null;

  db.prepare(
    `INSERT INTO links (slug, original, alias, password, expires_at)
     VALUES (@slug, @original, @alias, @password, @expiresAt)`
  ).run({ slug, original: originalUrl, alias: alias || null, password: hashedPassword, expiresAt });

  return { slug };
}

/**
 * Resolve a slug → original URL. Validates expiry + password.
 */
async function resolveLink(slug, providedPassword = null) {
  const db = getDb();
  const link = db.prepare("SELECT * FROM links WHERE slug = ? OR alias = ?").get(slug, slug);

  if (!link) {
    throw Object.assign(new Error("Link not found"), { status: 404 });
  }

  if (link.expires_at && link.expires_at < Math.floor(Date.now() / 1000)) {
    throw Object.assign(new Error("This link has expired"), { status: 410 });
  }

  if (link.password) {
    if (!providedPassword) {
      throw Object.assign(new Error("PASSWORD_REQUIRED"), { status: 401, code: "PASSWORD_REQUIRED" });
    }
    const ok = await bcrypt.compare(providedPassword, link.password);
    if (!ok) {
      throw Object.assign(new Error("Incorrect password"), { status: 403 });
    }
  }

  // Increment click count
  db.prepare("UPDATE links SET clicks = clicks + 1 WHERE slug = ?").run(link.slug);

  return link;
}

/**
 * Record a click with metadata.
 */
function recordClick(slug, { referrer, browser, os, device, country } = {}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO clicks (slug, referrer, browser, os, device, country)
     VALUES (@slug, @referrer, @browser, @os, @device, @country)`
  ).run({ slug, referrer: referrer || null, browser: browser || null, os: os || null, device: device || null, country: country || null });
}

/**
 * Get analytics for a slug.
 */
function getLinkAnalytics(slug) {
  const db = getDb();
  const link = db.prepare("SELECT * FROM links WHERE slug = ? OR alias = ?").get(slug, slug);
  if (!link) return null;

  const totalClicks = link.clicks;

  // Clicks over last 7 days (by day)
  const daily = db.prepare(`
    SELECT date(clicked_at, 'unixepoch') AS day, COUNT(*) AS count
    FROM clicks WHERE slug = ?
    AND clicked_at >= unixepoch('now', '-7 days')
    GROUP BY day ORDER BY day
  `).all(link.slug);

  // Top referrers
  const referrers = db.prepare(`
    SELECT COALESCE(referrer, 'Direct') AS referrer, COUNT(*) AS count
    FROM clicks WHERE slug = ?
    GROUP BY referrer ORDER BY count DESC LIMIT 10
  `).all(link.slug);

  // Browsers
  const browsers = db.prepare(`
    SELECT COALESCE(browser, 'Unknown') AS browser, COUNT(*) AS count
    FROM clicks WHERE slug = ?
    GROUP BY browser ORDER BY count DESC LIMIT 8
  `).all(link.slug);

  // OS
  const oses = db.prepare(`
    SELECT COALESCE(os, 'Unknown') AS os, COUNT(*) AS count
    FROM clicks WHERE slug = ?
    GROUP BY os ORDER BY count DESC LIMIT 8
  `).all(link.slug);

  // Devices
  const devices = db.prepare(`
    SELECT COALESCE(device, 'Unknown') AS device, COUNT(*) AS count
    FROM clicks WHERE slug = ?
    GROUP BY device ORDER BY count DESC LIMIT 5
  `).all(link.slug);

  return {
    link: {
      slug: link.slug,
      alias: link.alias,
      original: link.original,
      createdAt: link.created_at,
      expiresAt: link.expires_at,
      hasPassword: !!link.password,
      clicks: totalClicks,
    },
    analytics: { daily, referrers, browsers, oses, devices },
  };
}

/**
 * List recent links (last 20).
 */
function listLinks() {
  const db = getDb();
  return db.prepare(
    `SELECT slug, alias, original, clicks, created_at, expires_at,
            CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END as has_password
     FROM links ORDER BY created_at DESC LIMIT 20`
  ).all();
}

module.exports = { createLink, resolveLink, recordClick, getLinkAnalytics, listLinks };
