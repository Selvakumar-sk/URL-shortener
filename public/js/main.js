// ── Helpers ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

function timeAgo(unixSec) {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// ── Advanced options toggle ───────────────────────────────────────────────────
const toggle = document.getElementById("optionsToggle");
const advanced = document.getElementById("advancedOptions");
toggle.addEventListener("click", () => {
  const open = advanced.classList.toggle("open");
  toggle.classList.toggle("open", open);
});

// ── Shorten form ─────────────────────────────────────────────────────────────
document.getElementById("shortenBtn").addEventListener("click", async () => {
  const url      = document.getElementById("urlInput").value.trim();
  const alias    = document.getElementById("aliasInput").value.trim();
  const expiry   = document.getElementById("expiryInput").value;
  const password = document.getElementById("passwordInput").value;

  if (!url) { showToast("Please enter a URL first"); return; }

  const btn = document.getElementById("shortenBtn");
  btn.disabled = true;
  btn.querySelector(".btn-text").textContent = "Shortening…";

  try {
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        alias: alias || undefined,
        password: password || undefined,
        expiresInDays: expiry ? parseInt(expiry) : undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Something went wrong"); return; }

    showResult(data, url);
    loadRecent();

    // Reset form
    document.getElementById("urlInput").value = "";
    document.getElementById("aliasInput").value = "";
    document.getElementById("expiryInput").value = "";
    document.getElementById("passwordInput").value = "";
    advanced.classList.remove("open");
    toggle.classList.remove("open");
  } catch {
    showToast("Network error — is the server running?");
  } finally {
    btn.disabled = false;
    btn.querySelector(".btn-text").textContent = "Shorten URL";
  }
});

// Enter key on URL input
document.getElementById("urlInput").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("shortenBtn").click();
});

// ── Show result card ──────────────────────────────────────────────────────────
function showResult({ slug, shortUrl, qrUrl, analyticsUrl }, original) {
  const card = document.getElementById("resultCard");
  document.getElementById("resultUrl").textContent = shortUrl;
  document.getElementById("resultUrl").href = shortUrl;
  document.getElementById("resultOriginal").textContent = truncate(original, 80);
  document.getElementById("analyticsLink").href = analyticsUrl;
  document.getElementById("qrLink").href = qrUrl;
  document.getElementById("qrPreview").hidden = true;
  card.hidden = false;
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });

  // QR button
  document.getElementById("qrLink").onclick = async (e) => {
    e.preventDefault();
    const preview = document.getElementById("qrPreview");
    if (!preview.hidden) { preview.hidden = true; return; }
    document.getElementById("qrImg").src = qrUrl;
    document.getElementById("qrDownload").href = qrUrl;
    document.getElementById("qrDownload").download = `${slug}-qr.png`;
    preview.hidden = false;
  };
}

// ── Copy to clipboard ─────────────────────────────────────────────────────────
document.getElementById("copyBtn").addEventListener("click", () => {
  const url = document.getElementById("resultUrl").textContent;
  navigator.clipboard.writeText(url).then(() => showToast("Copied to clipboard!"));
});

document.getElementById("resultClose").addEventListener("click", () => {
  document.getElementById("resultCard").hidden = true;
});

// ── Load recent links ─────────────────────────────────────────────────────────
async function loadRecent() {
  try {
    const res = await fetch("/api/links");
    const links = await res.json();
    renderRecent(links);
  } catch {
    // fail silently
  }
}

function renderRecent(links) {
  const container = document.getElementById("recentLinks");
  if (!links.length) {
    container.innerHTML = '<p class="empty-state">No links yet. Shorten your first URL above!</p>';
    return;
  }

  container.innerHTML = links.map(link => {
    const tags = [
      link.has_password ? '<span class="link-tag tag-password">🔒 password</span>' : "",
      link.expires_at   ? `<span class="link-tag tag-expiry">⏱ expires</span>` : "",
    ].filter(Boolean).join("");

    return `
      <div class="link-row">
        <div class="link-info">
          <div class="link-short">
            <a href="${link.shortUrl}" target="_blank">${link.shortUrl}</a>
          </div>
          <div class="link-original">${truncate(link.original, 70)}</div>
        </div>
        <div class="link-meta">
          ${tags}
          <span>${timeAgo(link.created_at)}</span>
        </div>
        <div class="link-clicks" title="Total clicks">${link.clicks} clicks</div>
        <div class="link-actions">
          <button class="icon-btn" title="Copy short URL" onclick="copyLink('${link.shortUrl}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <a class="icon-btn" title="Analytics" href="/analytics/${link.slug}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </a>
          <a class="icon-btn" title="QR Code" href="/api/qr/${link.slug}" target="_blank">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
          </a>
        </div>
      </div>`;
  }).join("");
}

window.copyLink = (url) => {
  navigator.clipboard.writeText(url).then(() => showToast("Copied!"));
};

// Initial load
loadRecent();
