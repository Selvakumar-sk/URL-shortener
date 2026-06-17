const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "../../db/links.db");

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT    NOT NULL UNIQUE,
      original    TEXT    NOT NULL,
      alias       TEXT    UNIQUE,
      password    TEXT,
      expires_at  INTEGER,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      clicks      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clicks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT    NOT NULL,
      clicked_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      referrer    TEXT,
      browser     TEXT,
      os          TEXT,
      device      TEXT,
      country     TEXT,
      FOREIGN KEY (slug) REFERENCES links(slug) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_clicks_slug ON clicks(slug);
    CREATE INDEX IF NOT EXISTS idx_links_slug  ON links(slug);
    CREATE INDEX IF NOT EXISTS idx_links_alias ON links(alias);
  `);
}

module.exports = { getDb };
