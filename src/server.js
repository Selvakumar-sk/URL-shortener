const express = require("express");
const path = require("path");
const UAParser = require("ua-parser-js");
const { resolveLink, recordClick } = require("./utils/linkService");
const apiRouter = require("./routes/api");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

// ── API routes ───────────────────────────────────────────────────────────────
app.use("/api", apiRouter);

// ── Analytics page ───────────────────────────────────────────────────────────
app.get("/analytics/:slug", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/analytics.html"));
});

// ── Password page ────────────────────────────────────────────────────────────
app.get("/protected/:slug", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/protected.html"));
});

// ── Redirect route — must come last ─────────────────────────────────────────
app.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  // Skip static asset requests
  if (slug.includes(".")) return res.status(404).send("Not found");

  try {
    const link = await resolveLink(slug);

    const ua = UAParser(req.headers["user-agent"] || "");
    recordClick(link.slug, {
      referrer: req.headers.referer || null,
      browser: ua.browser?.name || null,
      os: ua.os?.name || null,
      device: ua.device?.type || "desktop",
    });

    return res.redirect(301, link.original);
  } catch (err) {
    if (err.code === "PASSWORD_REQUIRED") {
      return res.redirect(`/protected/${slug}`);
    }
    if (err.status === 410) {
      return res.status(410).sendFile(path.join(__dirname, "../public/expired.html"));
    }
    return res.status(404).sendFile(path.join(__dirname, "../public/404.html"));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  ✂  URL Shortener running at http://localhost:${PORT}\n`);
});

module.exports = app;
