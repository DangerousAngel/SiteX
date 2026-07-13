/* ─────────────────────────────────────────────
   SiteX — Frontend (calls backend API)
────────────────────────────────────────────── */

const input = document.getElementById('siteInput');
const lookupBtn = document.getElementById('lookupBtn');
const statusBar = document.getElementById('statusBar');
const statusText = document.getElementById('statusText');
const resultsSection = document.getElementById('resultsSection');
const cardsGrid = document.getElementById('cardsGrid');
const downloadBtn = document.getElementById('downloadBtn');
const heroBlock = document.getElementById('heroBlock');
const mainWrapper = document.getElementById('mainWrapper');
const resultsDomain = document.getElementById('resultsDomain');

let collectedData = {};

/* ── Helpers ── */
function cleanUrl(raw) {
  raw = raw.trim();
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) raw = 'https://' + raw;
  try { return new URL(raw); } catch { return null; }
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function setStatus(msg) {
  statusText.textContent = msg;
}

function setLoading(on) {
  if (on) {
    lookupBtn.classList.add('loading');
    lookupBtn.innerHTML = '<span class="spinner"></span>SCANNING';
    statusBar.classList.add('visible');
  } else {
    lookupBtn.classList.remove('loading');
    lookupBtn.innerHTML = 'LOOK UP';
    statusBar.classList.remove('visible');
  }
}

/* ── Card Builder ── */
function makeCard(title, subtitle, iconSvg, rows, opts = {}) {
  const card = document.createElement('div');
  card.className = 'card' + (opts.fullWidth ? ' full-width' : '');

  card.innerHTML = `
    <div class="card-header">
      <div class="card-icon">${iconSvg}</div>
      <div>
        <div class="card-title">${title}</div>
        ${subtitle ? `<div class="card-subtitle">${subtitle}</div>` : ''}
      </div>
    </div>
    ${rows.map(r => rowHtml(r)).join('')}
  `;
  return card;
}

function rowHtml({ label, value, cls, tags, isUrlList }) {
  if (isUrlList && Array.isArray(value)) {
    const items = value.length ? value : ['None detected'];
    return `
      <div class="info-row" style="flex-direction:column; align-items:flex-start; gap:10px;">
        <span class="info-label">${label}</span>
        <div class="url-list">
          ${items.map(u => `<div class="url-item"><span class="url-dot"></span>${u}</div>`).join('')}
        </div>
      </div>`;
  }
  if (tags) {
    const vals = tags.length ? tags : ['Unknown'];
    return `
      <div class="info-row">
        <span class="info-label">${label}</span>
        <div class="tag-list">${vals.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </div>`;
  }
  const display = value || '<span class="muted">N/A</span>';
  return `
    <div class="info-row">
      <span class="info-label">${label}</span>
      <span class="info-value ${cls || ''}">${display}</span>
    </div>`;
}

function animateCards() {
  const cards = cardsGrid.querySelectorAll('.card');
  cards.forEach((card, i) => {
    setTimeout(() => card.classList.add('animate-in'), i * 80);
  });
}

/* ── Icons ── */
const ICONS = {
  network: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  server: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  lock: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  code: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  geo: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  dns: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  time: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  link: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  meta: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  cookie: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/></svg>`,
  social: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
};

/* ─────────────────────────────────────────────
   MAIN LOOKUP — calls backend
────────────────────────────────────────────── */

async function runLookup() {
  console.log('🔍 Lookup triggered');
  const raw = input.value.trim();
  if (!raw) {
    input.style.animation = 'shake 0.4s ease';
    setTimeout(() => input.style.animation = '', 500);
    return;
  }
  const parsed = cleanUrl(raw);
  if (!parsed) {
    input.style.animation = 'shake 0.4s ease';
    setTimeout(() => input.style.animation = '', 500);
    return;
  }

  const domain = parsed.hostname.replace(/^www\./, '');
  const fullUrl = parsed.href;

  // Reset
  cardsGrid.innerHTML = '';
  collectedData = { domain, url: fullUrl, timestamp: new Date().toISOString() };
  resultsSection.classList.remove('visible');
  heroBlock.classList.add('compact');
  mainWrapper.classList.add('has-results');
  resultsDomain.textContent = domain;

  setLoading(true);
  setStatus('Contacting backend…');
  console.log('📡 Fetching:', `/api/lookup?url=${encodeURIComponent(fullUrl)}`);

  try {
    const resp = await fetch(`/api/lookup?url=${encodeURIComponent(fullUrl)}`, {
      signal: AbortSignal.timeout(30000)
    });

    console.log('📥 Response status:', resp.status);

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Backend error (${resp.status}): ${errText || resp.statusText}`);
    }

    const data = await resp.json();
    console.log('📦 Data received:', data);

    if (data.error) {
      throw new Error(data.error);
    }

    collectedData = { ...collectedData, ...data };

    setLoading(false);
    buildCards(data);
    resultsSection.classList.add('visible');
    setTimeout(animateCards, 50);

  } catch (err) {
    console.error('❌ Fetch error:', err);
    setLoading(false);
    showError(err.message || 'Failed to fetch site intelligence.');
  }
}

/* ─────────────────────────────────────────────
   CARD ASSEMBLY (from backend data)
────────────────────────────────────────────── */

function buildCards(data) {
  console.log('🏗️ Building cards with data:', data);
  const {
    domain,
    ip,
    geo,
    whois,
    dns,
    headers,
    ssl,
    links,
    pageMeta,
    tech,
    reverseIp,
    sharedHosts
  } = data;

  const primaryIp = ip || null;
  const cards = [];

  /* ── Card: IP & Network ── */
  cards.push(makeCard('IP & Network', 'Primary IP address information', ICONS.network, [
    { label: 'Primary IP', value: primaryIp || 'Unresolved', cls: primaryIp ? 'highlight' : 'muted' },
    { label: 'IPv6', value: dns?.AAAA?.[0] || null },
    { label: 'IP Version', value: primaryIp ? (primaryIp.includes(':') ? 'IPv6' : 'IPv4') : null },
    { label: 'ASN', value: geo?.asn || null },
    { label: 'AS Org', value: geo?.org || null },
    { label: 'Provider / ISP', value: geo?.org?.replace(/^AS\d+\s*/, '') || null },
  ]));

  /* ── Card: Geolocation ── */
  cards.push(makeCard('Geolocation', 'Physical server location', ICONS.geo, [
    { label: 'Country', value: geo?.country_name ? `${geo.country_name} ${geo.country || ''}` : null },
    { label: 'Region', value: geo?.region || null },
    { label: 'City', value: geo?.city || null },
    { label: 'Postal', value: geo?.postal || null },
    { label: 'Latitude', value: geo?.latitude || null },
    { label: 'Longitude', value: geo?.longitude || null },
    { label: 'Timezone', value: geo?.timezone || null },
    { label: 'Currency', value: geo?.currency_name || null },
    { label: 'Calling Code', value: geo?.country_calling_code || null },
  ]));

  /* ── Card: WHOIS / Registration ── */
  cards.push(makeCard('Registration', 'Domain WHOIS information', ICONS.time, [
    { label: 'Registrar', value: whois?.registrar || null },
    { label: 'Date Created', value: whois?.created ? fmtDate(whois.created) : null, cls: 'highlight' },
    { label: 'Last Updated', value: whois?.updated ? fmtDate(whois.updated) : null },
    { label: 'Expires', value: whois?.expires ? fmtDate(whois.expires) : null },
    { label: 'Domain Age', value: whois?.created ? calcAge(whois.created) : null, cls: 'green' },
    { label: 'Status', value: whois?.status?.split(' ')?.[0] || null },
    { label: 'Nameservers', value: whois?.nameserver?.slice(0, 2).join(', ') || null },
  ]));

  /* ── Card: DNS Records ── */
  cards.push(makeCard('DNS Records', 'Resolved DNS entries', ICONS.dns, [
    { label: 'A Records', value: dns?.A?.join(', ') || null },
    { label: 'AAAA Records', value: dns?.AAAA?.join(', ') || null },
    { label: 'MX Records', value: dns?.MX?.join(', ') || null },
    { label: 'NS Records', value: dns?.NS?.slice(0, 2).join(', ') || null },
    { label: 'CNAME', value: dns?.CNAME?.join(', ') || null },
    { label: 'TXT Records', value: dns?.TXT?.[0] || null },
  ]));

  /* ── Card: SSL Certificate ── */
  const sslValid = ssl?.validTo ? new Date(ssl.validTo) > new Date() : null;
  cards.push(makeCard('SSL Certificate', 'TLS/HTTPS security', ICONS.lock, [
    { label: 'Status', value: sslValid === true ? '✓ Valid' : sslValid === false ? '✗ Expired' : null,
      cls: sslValid ? 'green' : 'red' },
    { label: 'Issuer', value: ssl?.issuer || null },
    { label: 'Common Name', value: ssl?.cn || null },
    { label: 'Valid From', value: ssl?.validFrom ? fmtDate(ssl.validFrom) : null },
    { label: 'Valid To', value: ssl?.validTo ? fmtDate(ssl.validTo) : null },
    { label: 'Certs Found', value: ssl?.count ? `${ssl.count} historical cert(s)` : null },
  ]));

  /* ── Card: Server & Hosting ── */
  const secScore = calcSecurityScore(headers);
  cards.push(makeCard('Server & Hosting', 'Web server details', ICONS.server, [
    { label: 'Server', value: headers?.server || null, cls: 'highlight' },
    { label: 'Powered By', value: headers?.xPoweredBy || null },
    { label: 'Content-Type', value: headers?.contentType?.split(';')[0] || null },
    { label: 'Cache-Control', value: headers?.cacheControl || null },
    { label: 'HTTPS Strict', value: headers?.strictTransport ? '✓ Enabled' : null, cls: 'green' },
    { label: 'X-Frame-Options', value: headers?.xFrameOptions || null },
    { label: 'XSS Protection', value: headers?.xXssProtection || null },
    { label: 'Security Score', value: `${secScore}/10`, cls: secScore >= 7 ? 'green' : secScore >= 4 ?
      'yellow' : 'red' },
  ]));

  /* ── Card: Technology Stack ── */
  cards.push(makeCard('Technology Stack', 'Detected frameworks & services', ICONS.code, [
    { label: 'Detected Stack', tags: tech || [] },
    { label: 'Generator', value: pageMeta?.generator || null },
    { label: 'Scripts', value: pageMeta?.scriptCount != null ? `${pageMeta.scriptCount} script tag(s)` :
      null },
    { label: 'Stylesheets', value: pageMeta?.linkCount != null ? `${pageMeta.linkCount} link tag(s)` :
      null },
    { label: 'Images', value: pageMeta?.imgCount != null ? `${pageMeta.imgCount} image(s)` : null },
    { label: 'Has Analytics', value: pageMeta?.hasAnalytics ? '✓ Yes' : '✗ No', cls: pageMeta
        ?.hasAnalytics ? 'green' : 'muted' },
    { label: 'Has Ads', value: pageMeta?.hasAds ? '✓ Yes' : '✗ No' },
  ]));

  /* ── Card: Page Metadata ── */
  cards.push(makeCard('Page Metadata', 'HTML meta & SEO data', ICONS.meta, [
    { label: 'Title', value: pageMeta?.title || null, cls: 'highlight' },
    { label: 'Description', value: truncate(pageMeta?.description, 80) || null },
    { label: 'OG Title', value: truncate(pageMeta?.ogTitle, 60) || null },
    { label: 'OG Type', value: pageMeta?.ogType || null },
    { label: 'Language', value: pageMeta?.lang || null },
    { label: 'Charset', value: pageMeta?.charset || null },
    { label: 'Viewport', value: pageMeta?.viewport || null },
    { label: 'Theme Color', value: pageMeta?.themeColor || null },
    { label: 'Robots', value: pageMeta?.robots || null },
    { label: 'Canonical', value: truncate(pageMeta?.canonical, 50) || null },
  ]));

  /* ── Card: Cookies & Storage ── */
  cards.push(makeCard('Cookies & Storage', 'Client-side storage signals', ICONS.cookie, [
    { label: 'Cookie Header', value: truncate(headers?.setCookie, 60) || null, cls: 'highlight' },
    { label: 'Cookie Banner', value: pageMeta?.hasCookieBanner ? '✓ Detected' : '✗ None found',
      cls: pageMeta?.hasCookieBanner ? 'yellow' : 'muted' },
    { label: 'Storage Types', tags: pageMeta?.cookieTypes || [] },
    { label: 'Has Forms', value: pageMeta?.hasForm ? '✓ Yes' : '✗ No' },
    { label: 'Has Video', value: pageMeta?.hasVideo ? '✓ Yes' : '✗ No' },
    { label: 'Has Maps', value: pageMeta?.hasMap ? '✓ Yes' : '✗ No' },
  ]));

  /* ── Card: Shared Hosting ── */
  if (reverseIp?.length) {
    cards.push(makeCard('Shared Hosting', `${reverseIp.length} domain(s) on same IP`, ICONS.server, [
      { label: 'Domains on IP', value: reverseIp.join(', '), cls: 'muted' },
    ]));
  }

  /* ── Card: Social Links (full-width) ── */
  cards.push(makeCard('Discovered Links', 'Internal, external & social', ICONS.social, [
    { label: 'Social Profiles', isUrlList: true, value: links?.social || [] },
    { label: 'External Links', isUrlList: true, value: links?.external?.slice(0, 8) || [] },
  ], { fullWidth: true }));

  /* ── Card: Internal Links (full-width) ── */
  cards.push(makeCard('Internal Pages', 'Discovered internal URLs', ICONS.link, [
    { label: 'Internal URLs', isUrlList: true, value: links?.internal || [] },
  ], { fullWidth: true }));

  /* Render all */
  for (const card of cards) cardsGrid.appendChild(card);
  console.log('✅ Cards rendered:', cards.length);
}

/* ─────────────────────────────────────────────
   UTILITY HELPERS
────────────────────────────────────────────── */

function fmtDate(str) {
  if (!str) return null;
  try {
    const d = new Date(str);
    if (isNaN(d)) return str;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return str; }
}

function calcAge(created) {
  try {
    const ms = Date.now() - new Date(created).getTime();
    const days = Math.floor(ms / 86400000);
    if (days < 30) return `${days} day(s)`;
    if (days < 365) return `${Math.floor(days / 30)} month(s)`;
    const yrs = Math.floor(days / 365);
    const mo = Math.floor((days % 365) / 30);
    return `${yrs} year(s) ${mo} month(s)`;
  } catch { return null; }
}

function calcSecurityScore(h) {
  let score = 0;
  if (h?.strictTransport) score += 2;
  if (h?.xFrameOptions) score += 2;
  if (h?.xContentType) score += 2;
  if (h?.xXssProtection) score += 2;
  if (h?.server && !/apache|nginx/i.test(h.server)) score += 1;
  if (h?.cacheControl) score += 1;
  return Math.min(score, 10);
}

function truncate(str, max) {
  if (!str) return null;
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function showError(msg) {
  const card = document.createElement('div');
  card.className = 'card error-card';
  card.innerHTML = `
    <div class="error-title">⚠️ Lookup Failed</div>
    <div class="error-msg">${msg}</div>
  `;
  cardsGrid.appendChild(card);
  resultsSection.classList.add('visible');
  setTimeout(() => card.classList.add('animate-in'), 50);
}

/* ─────────────────────────────────────────────
   EVENTS
────────────────────────────────────────────── */

lookupBtn.addEventListener('click', runLookup);
input.addEventListener('keydown', e => { if (e.key === 'Enter') runLookup(); });

downloadBtn.addEventListener('click', () => {
  if (!Object.keys(collectedData).length) return;
  const json = JSON.stringify(collectedData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sitex-${collectedData.domain || 'results'}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});