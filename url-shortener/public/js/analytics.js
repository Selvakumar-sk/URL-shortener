const slug = location.pathname.split("/").pop();

async function loadAnalytics() {
  const res = await fetch(`/api/analytics/${slug}`);
  if (!res.ok) {
    document.getElementById("analyticsContent").innerHTML =
      '<p style="color:#94A3B8;text-align:center;padding:80px 0">Link not found.</p>';
    return;
  }
  const { link, analytics } = await res.json();
  render(link, analytics);
}

function fmtDate(unixSec) {
  return new Date(unixSec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function render(link, analytics) {
  const expiryInfo = link.expiresAt
    ? `Expires ${fmtDate(link.expiresAt)}`
    : "Never expires";

  const totalDailyClicks = analytics.daily.reduce((s, d) => s + d.count, 0);

  document.getElementById("analyticsContent").innerHTML = `
    <div class="analytics-header">
      <a class="analytics-back" href="/">← Back to Snip</a>
      <div class="analytics-title">${link.slug}${link.alias && link.alias !== link.slug ? ' <span style="color:var(--slate);font-size:18px">/ ' + link.alias + '</span>' : ''}</div>
      <div class="analytics-meta">${link.original}</div>
    </div>

    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-card-label">Total clicks</div>
        <div class="stat-card-value">${link.clicks}</div>
        <div class="stat-card-sub">all time</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Last 7 days</div>
        <div class="stat-card-value">${totalDailyClicks}</div>
        <div class="stat-card-sub">recent activity</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Created</div>
        <div class="stat-card-value" style="font-size:16px;padding-top:6px">${fmtDate(link.createdAt)}</div>
        <div class="stat-card-sub">${expiryInfo}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Protection</div>
        <div class="stat-card-value" style="font-size:20px;padding-top:6px">${link.hasPassword ? "🔒 On" : "🔓 Off"}</div>
        <div class="stat-card-sub">password</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card full-width">
        <div class="chart-title">Clicks — last 7 days</div>
        ${renderSparkline(analytics.daily)}
      </div>
      <div class="chart-card">
        <div class="chart-title">Top referrers</div>
        ${renderBars(analytics.referrers, "referrer")}
      </div>
      <div class="chart-card">
        <div class="chart-title">Browsers</div>
        ${renderBars(analytics.browsers, "browser")}
      </div>
      <div class="chart-card">
        <div class="chart-title">Operating systems</div>
        ${renderBars(analytics.oses, "os")}
      </div>
      <div class="chart-card">
        <div class="chart-title">Device type</div>
        ${renderBars(analytics.devices, "device")}
      </div>
    </div>

    <div style="margin-top:8px">
      <a href="/api/qr/${link.slug}" target="_blank"
         style="display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--teal);font-weight:600;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
        Download QR Code
      </a>
    </div>
  `;
}

function renderBars(items, key) {
  if (!items.length) return '<p style="color:var(--slate);font-size:13px">No data yet.</p>';
  const max = Math.max(...items.map(i => i.count));
  return `<div class="bar-list">` + items.map(item => `
    <div class="bar-item">
      <div class="bar-label-row">
        <span class="bar-label">${item[key] || "Unknown"}</span>
        <span class="bar-value">${item.count}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round((item.count / max) * 100)}%"></div>
      </div>
    </div>`).join("") + `</div>`;
}

function renderSparkline(daily) {
  if (!daily.length) return '<p style="color:var(--slate);font-size:13px">No clicks in the last 7 days.</p>';

  // Fill in missing days
  const dayMap = {};
  daily.forEach(d => { dayMap[d.day] = d.count; });

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: key, count: dayMap[key] || 0 });
  }

  const maxVal = Math.max(...days.map(d => d.count), 1);
  const W = 600, H = 80, pad = 20;
  const step = (W - pad * 2) / (days.length - 1);

  const points = days.map((d, i) => {
    const x = pad + i * step;
    const y = H - pad - ((d.count / maxVal) * (H - pad * 2));
    return { x, y, ...d };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(" ");
  const areaPath = `M${points[0].x},${H - pad} ` +
    points.map(p => `L${p.x},${p.y}`).join(" ") +
    ` L${points[points.length - 1].x},${H - pad} Z`;

  const labels = points.map(p => {
    const short = p.day.slice(5); // MM-DD
    return `<text x="${p.x}" y="${H}" text-anchor="middle" font-size="10" fill="#64748B">${short}</text>`;
  }).join("");

  const dots = points.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--teal)">
       <title>${p.day}: ${p.count} clicks</title>
     </circle>`
  ).join("");

  return `
    <div class="sparkline-wrap">
      <svg class="sparkline-svg" viewBox="0 0 ${W} ${H + 14}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--teal)" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="var(--teal)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#sg)" />
        <polyline points="${polyline}" fill="none" stroke="var(--teal)" stroke-width="2" stroke-linejoin="round"/>
        ${dots}
        ${labels}
      </svg>
    </div>`;
}

loadAnalytics();
