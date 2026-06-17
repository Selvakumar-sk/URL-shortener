const express = require("express");
const QRCode = require("qrcode");
const UAParser = require("ua-parser-js");
const { createLink, resolveLink, recordClick, getLinkAnalytics, listLinks } = require("../utils/linkService");

const router = express.Router();

// ── POST /api/links — create a short link ────────────────────────────────────
router.post("/links", async (req, res) => {
  try {
    const { url, alias, password, expiresInDays } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });

    const { slug } = await createLink({
      originalUrl: url,
      alias: alias?.trim() || null,
      password: password || null,
      expiresInDays: expiresInDays ? parseInt(expiresInDays) : null,
    });

    const base = `${req.protocol}://${req.get("host")}`;
    res.status(201).json({
      slug,
      shortUrl: `${base}/${slug}`,
      qrUrl: `${base}/api/qr/${slug}`,
      analyticsUrl: `${base}/analytics/${slug}`,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── GET /api/links — list recent links ───────────────────────────────────────
router.get("/links", (req, res) => {
  try {
    const links = listLinks();
    const base = `${req.protocol}://${req.get("host")}`;
    res.json(links.map(l => ({ ...l, shortUrl: `${base}/${l.slug}` })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/analytics/:slug — analytics data ────────────────────────────────
router.get("/analytics/:slug", (req, res) => {
  try {
    const data = getLinkAnalytics(req.params.slug);
    if (!data) return res.status(404).json({ error: "Link not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/qr/:slug — generate QR code PNG ─────────────────────────────────
router.get("/qr/:slug", async (req, res) => {
  try {
    const base = `${req.protocol}://${req.get("host")}`;
    const url = `${base}/${req.params.slug}`;
    const format = req.query.format === "svg" ? "svg" : "png";

    if (format === "svg") {
      const svg = await QRCode.toString(url, { type: "svg", margin: 2, color: { dark: "#0f172a", light: "#ffffff" } });
      res.setHeader("Content-Type", "image/svg+xml");
      return res.send(svg);
    }

    const buffer = await QRCode.toBuffer(url, {
      type: "png",
      margin: 2,
      width: 300,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `inline; filename="${req.params.slug}-qr.png"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/resolve — resolve with password ────────────────────────────────
router.post("/resolve", async (req, res) => {
  try {
    const { slug, password } = req.body;
    const link = await resolveLink(slug, password);

    // Record click
    const ua = UAParser(req.headers["user-agent"] || "");
    recordClick(link.slug, {
      referrer: req.headers.referer || null,
      browser: ua.browser?.name || null,
      os: ua.os?.name || null,
      device: ua.device?.type || "desktop",
    });

    res.json({ url: link.original });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

module.exports = router;
