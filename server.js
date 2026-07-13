const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const whois = require('whois-json');
const dns = require('dns').promises;
const tls = require('tls');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// ─── Helper: fetch with timeout ──────────────────
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await axios({ url, ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// ─── 1. DNS Lookup ──────────────────────────────
async function getDns(domain) {
  const result = { A: [], AAAA: [], MX: [], NS: [], TXT: [], CNAME: [] };
  try {
    const [a, aaaa, mx, ns, txt, cname] = await Promise.allSettled([
      dns.resolve4(domain),
      dns.resolve6(domain),
      dns.resolveMx(domain),
      dns.resolveNs(domain),
      dns.resolveTxt(domain),
      dns.resolveCname(domain),
    ]);
    if (a.status === 'fulfilled') result.A = a.value;
    if (aaaa.status === 'fulfilled') result.AAAA = aaaa.value;
    if (mx.status === 'fulfilled') result.MX = mx.value.map(m => `${m.exchange} (priority ${m.priority})`);
    if (ns.status === 'fulfilled') result.NS = ns.value;
    if (txt.status === 'fulfilled') result.TXT = txt.value.flat();
    if (cname.status === 'fulfilled') result.CNAME = cname.value;
  } catch (e) { /* ignore */ }
  return result;
}

// ─── 2. WHOIS ────────────────────────────────────
async function getWhois(domain) {
  try {
    const data = await whois(domain, { timeout: 10000 });
    const registrar = data.registrar || data.Registrar || null;
    const created = data.creationDate || data['Creation Date'] || data.created || null;
    const updated = data.updatedDate || data['Updated Date'] || data.updated || null;
    const expires = data.expiryDate || data['Registry Expiry Date'] || data['Expiration Date'] || data.expires || null;
    const status = data.domainStatus || data['Domain Status'] || data.status || null;
    const nameserver = data.nameServer || data['Name Server'] || data.nameserver || null;
    return {
      registrar,
      created: created ? new Date(created).toISOString() : null,
      updated: updated ? new Date(updated).toISOString() : null,
      expires: expires ? new Date(expires).toISOString() : null,
      status: Array.isArray(status) ? status.join(', ') : status,
      nameserver: Array.isArray(nameserver) ? nameserver : (nameserver ? [nameserver] : []),
    };
  } catch (e) {
    return {};
  }
}

// ─── 3. SSL Certificate ──────────────────────────
async function getSsl(domain) {
  return new Promise((resolve) => {
    const options = { host: domain, port: 443, servername: domain, rejectUnauthorized: false };
    const socket = tls.connect(options, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (cert && cert.subject) {
        resolve({
          issuer: cert.issuer?.O || cert.issuer?.CN || null,
          validFrom: cert.valid_from ? new Date(cert.valid_from).toISOString() : null,
          validTo: cert.valid_to ? new Date(cert.valid_to).toISOString() : null,
          cn: cert.subject?.CN || null,
        });
      } else {
        resolve({});
      }
    });
    socket.on('error', () => resolve({}));
    socket.setTimeout(5000, () => { socket.destroy(); resolve({}); });
  });
}

// ─── 4. HTTP Headers ─────────────────────────────
async function getHeaders(url) {
  try {
    const response = await fetchWithTimeout(url, { method: 'HEAD', timeout: 10000 });
    const headers = response.headers;
    return {
      server: headers['server'] || null,
      xPoweredBy: headers['x-powered-by'] || null,
      contentType: headers['content-type'] || null,
      cacheControl: headers['cache-control'] || null,
      strictTransport: headers['strict-transport-security'] || null,
      xFrameOptions: headers['x-frame-options'] || null,
      xContentType: headers['x-content-type-options'] || null,
      xXssProtection: headers['x-xss-protection'] || null,
      setCookie: headers['set-cookie'] ? headers['set-cookie'].join('; ') : null,
    };
  } catch {
    return {};
  }
}

// ─── 5. Page Meta & Links ────────────────────────
async function getPageData(url) {
  try {
    const response = await fetchWithTimeout(url, { timeout: 15000 });
    const html = response.data;
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || null;
    const lang = $('html').attr('lang') || null;
    const charset = $('meta[charset]').attr('charset') || null;
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || null;
    const ogTitle = $('meta[property="og:title"]').attr('content') || null;
    const ogType = $('meta[property="og:type"]').attr('content') || null;
    const robots = $('meta[name="robots"]').attr('content') || null;
    const viewport = $('meta[name="viewport"]').attr('content') || null;
    const themeColor = $('meta[name="theme-color"]').attr('content') || null;
    const generator = $('meta[name="generator"]').attr('content') || null;
    const canonical = $('link[rel="canonical"]').attr('href') || null;
    const favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || null;

    const hasAnalytics = /google-analytics|gtag|googletagmanager/i.test(html);
    const hasAds = /google.*ads|adsense|doubleclick/i.test(html);
    const hasCookieBanner = /cookie|consent|gdpr/i.test(html);
    const hasForm = $('form').length > 0;
    const hasVideo = $('video').length > 0 || /youtube\.com\/embed|vimeo\.com/i.test(html);
    const hasMap = /google.*maps|leaflet|mapbox/i.test(html);

    const scriptCount = $('script').length;
    const linkCount = $('link').length;
    const imgCount = $('img').length;

    const cookieTypes = [];
    if (/cookie/i.test(html)) cookieTypes.push('Uses Cookies');
    if (/localStorage/i.test(html)) cookieTypes.push('localStorage');
    if (/sessionStorage/i.test(html)) cookieTypes.push('sessionStorage');
    if (/indexedDB/i.test(html)) cookieTypes.push('IndexedDB');

    // Links
    const internal = [];
    const external = [];
    const social = [];
    const socialDomains = ['twitter.com','x.com','facebook.com','instagram.com','linkedin.com','github.com','youtube.com','tiktok.com','pinterest.com'];
    const urlObj = new URL(url);
    const baseDomain = urlObj.hostname.replace(/^www\./, '');

    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      let full = href;
      try {
        if (href.startsWith('/')) full = urlObj.origin + href;
        else if (!href.startsWith('http')) full = new URL(href, url).href;
        else full = href;
        const parsed = new URL(full);
        if (parsed.hostname.replace(/^www\./, '') === baseDomain) {
          internal.push(full);
        } else {
          external.push(full);
          if (socialDomains.some(sd => parsed.hostname.includes(sd))) social.push(full);
        }
      } catch (e) { /* ignore */ }
    });

    return {
      title, lang, charset, description, ogTitle, ogType, robots, viewport,
      themeColor, generator, canonical, favicon, hasAnalytics, hasAds,
      hasCookieBanner, hasForm, hasVideo, hasMap,
      scriptCount, linkCount, imgCount, cookieTypes,
      internal: internal.slice(0, 50),
      external: external.slice(0, 50),
      social: social.slice(0, 20),
    };
  } catch {
    return {};
  }
}

// ─── 6. Technology Detection ──────────────────
function detectTech(html, headers) {
  const combined = (html || '') + JSON.stringify(headers || {});
  const techs = [];
  const checks = [
    [/wp-content|wp-includes|wordpress/i, 'WordPress'],
    [/shopify/i, 'Shopify'],
    [/drupal/i, 'Drupal'],
    [/joomla/i, 'Joomla'],
    [/wix\.com/i, 'Wix'],
    [/squarespace/i, 'Squarespace'],
    [/webflow/i, 'Webflow'],
    [/react|__react/i, 'React'],
    [/angular\.js|angularjs/i, 'AngularJS'],
    [/vue\.js|vuejs/i, 'Vue.js'],
    [/next\.js|_next\//i, 'Next.js'],
    [/gatsby/i, 'Gatsby'],
    [/nuxt/i, 'Nuxt.js'],
    [/jquery/i, 'jQuery'],
    [/bootstrap/i, 'Bootstrap'],
    [/tailwind/i, 'Tailwind CSS'],
    [/nginx/i, 'Nginx'],
    [/apache/i, 'Apache'],
    [/cloudflare/i, 'Cloudflare'],
    [/php/i, 'PHP'],
    [/asp\.net|aspnet/i, 'ASP.NET'],
    [/laravel/i, 'Laravel'],
    [/django/i, 'Django'],
    [/express\.js/i, 'Express.js'],
    [/ruby on rails|rails/i, 'Ruby on Rails'],
    [/google-analytics|googletagmanager/i, 'Google Analytics'],
    [/hotjar/i, 'Hotjar'],
    [/intercom/i, 'Intercom'],
    [/stripe/i, 'Stripe'],
    [/recaptcha/i, 'reCAPTCHA'],
    [/font-awesome|fontawesome/i, 'Font Awesome'],
    [/vercel/i, 'Vercel'],
    [/netlify/i, 'Netlify'],
  ];
  for (const [pattern, name] of checks) {
    if (pattern.test(combined)) techs.push(name);
  }
  return [...new Set(techs)];
}

// ─── 7. Geolocation ──────────────────────────
async function getGeo(ip) {
  if (!ip) return {};
  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 5000 });
    return response.data;
  } catch { return {}; }
}

// ─── 8. Reverse IP ──────────────────────────
async function getReverseIp(ip) {
  if (!ip) return [];
  try {
    const response = await axios.get(`https://api.hackertarget.com/reverseiplookup/?q=${ip}`, { timeout: 10000 });
    const lines = response.data.split('\n').filter(Boolean);
    return lines.slice(0, 20);
  } catch { return []; }
}

// ─── MAIN API ENDPOINT ────────────────────────────
app.get('/api/lookup', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  const domain = parsed.hostname.replace(/^www\./, '');
  const protocol = parsed.protocol;

  // Collect data in parallel with error tolerance
  const [dns, whoisData, ssl, headers, pageData] = await Promise.allSettled([
    getDns(domain),
    getWhois(domain),
    getSsl(domain),
    getHeaders(url),
    getPageData(url),
  ]);

  const dnsResult = dns.status === 'fulfilled' ? dns.value : {};
  const whoisResult = whoisData.status === 'fulfilled' ? whoisData.value : {};
  const sslResult = ssl.status === 'fulfilled' ? ssl.value : {};
  const headersResult = headers.status === 'fulfilled' ? headers.value : {};
  const pageResult = pageData.status === 'fulfilled' ? pageData.value : {};

  const primaryIp = dnsResult.A && dnsResult.A.length > 0 ? dnsResult.A[0] : null;

  const [geo, reverseIp] = await Promise.allSettled([
    getGeo(primaryIp),
    getReverseIp(primaryIp),
  ]);

  const geoResult = geo.status === 'fulfilled' ? geo.value : {};
  const reverseResult = reverseIp.status === 'fulfilled' ? reverseIp.value : [];

  // Fetch raw HTML for tech detection (if not already available)
  let htmlContent = '';
  try {
    const htmlResp = await axios.get(url, { timeout: 15000 });
    htmlContent = htmlResp.data;
  } catch (e) { /* ignore */ }
  const tech = detectTech(htmlContent, headersResult);

  const response = {
    domain,
    ip: primaryIp,
    geo: geoResult,
    whois: whoisResult,
    dns: dnsResult,
    headers: headersResult,
    ssl: sslResult,
    links: {
      internal: pageResult.internal || [],
      external: pageResult.external || [],
      social: pageResult.social || [],
    },
    pageMeta: {
      title: pageResult.title,
      description: pageResult.description,
      ogTitle: pageResult.ogTitle,
      ogType: pageResult.ogType,
      lang: pageResult.lang,
      charset: pageResult.charset,
      viewport: pageResult.viewport,
      themeColor: pageResult.themeColor,
      generator: pageResult.generator,
      canonical: pageResult.canonical,
      robots: pageResult.robots,
      hasAnalytics: pageResult.hasAnalytics,
      hasAds: pageResult.hasAds,
      hasCookieBanner: pageResult.hasCookieBanner,
      hasForm: pageResult.hasForm,
      hasVideo: pageResult.hasVideo,
      hasMap: pageResult.hasMap,
      scriptCount: pageResult.scriptCount,
      linkCount: pageResult.linkCount,
      imgCount: pageResult.imgCount,
      cookieTypes: pageResult.cookieTypes,
    },
    tech,
    reverseIp: reverseResult,
  };

  res.json(response);
});

app.listen(PORT, () => {
  console.log(`SiteX backend running on http://localhost:${PORT}`);
});