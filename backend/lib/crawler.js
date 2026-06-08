// ============================================================
// lib/crawler.js — Smart crawler for SPAs and static sites
// Combines: HTML link extraction + JS bundle route parsing +
// well-known path probing to discover pages even on React/
// Next.js/Vue SPAs where links are rendered by JavaScript.
// ============================================================

// ── Fetch a page ──────────────────────────────────────────────
export async function fetchPage(url, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return { html: '', status: res.status, ok: false };
    const html = await res.text();
    return { html, status: res.status, ok: true, finalUrl: res.url };
  } catch (e) {
    clearTimeout(timer);
    return { html: '', status: 0, ok: false, error: e.message };
  }
}

// ── Extract links from HTML ───────────────────────────────────
export function extractLinks(html, baseUrl) {
  const links = new Set();
  const base  = new URL(baseUrl);

  // Standard href links
  const hrefRe = /href=["']([^"'#?][^"']*?)["']/gi;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    try {
      const resolved = new URL(m[1], baseUrl);
      if (resolved.origin === base.origin && isValidPath(resolved.pathname)) {
        links.add(resolved.href.split('?')[0].split('#')[0]);
      }
    } catch {}
  }

  // React Router / Next.js — to="/path" or href="/path"
  const toRe = /\bto=["'](\/?[a-z][a-z0-9\-/_]*?)["']/gi;
  while ((m = toRe.exec(html)) !== null) {
    try {
      const resolved = new URL(m[1], baseUrl);
      if (resolved.origin === base.origin && isValidPath(resolved.pathname)) {
        links.add(resolved.href.split('?')[0].split('#')[0]);
      }
    } catch {}
  }

  // JSON-embedded paths like "path":"/some/route"
  const jsonPathRe = /"(?:path|url|route|href|link)"\s*:\s*"(\/[a-z][a-z0-9\-/_]*)"/gi;
  while ((m = jsonPathRe.exec(html)) !== null) {
    try {
      const resolved = new URL(m[1], baseUrl);
      if (resolved.origin === base.origin && isValidPath(resolved.pathname)) {
        links.add(resolved.href);
      }
    } catch {}
  }

  return [...links];
}

// ── Extract routes from JS bundle files ──────────────────────
export async function extractRoutesFromBundles(html, baseUrl) {
  const routes = new Set();
  const base   = new URL(baseUrl);

  // Find all script src attributes
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
  const scriptUrls = [];
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    try {
      const src = new URL(m[1], baseUrl).href;
      // Only fetch main/chunk JS files (not tiny polyfills)
      if (src.includes(base.origin) || src.includes('/static/js/')) {
        scriptUrls.push(src);
      }
    } catch {}
  }

  // Fetch up to 3 JS bundles and look for route patterns
  for (const scriptUrl of scriptUrls.slice(0, 3)) {
    try {
      const res = await fetch(scriptUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const js = await res.text();

      // React Router paths: "/dashboard", "/settings", etc.
      const pathRe = /["'](\/[a-z][a-z0-9\-/_]{1,50})["']/g;
      let pm;
      while ((pm = pathRe.exec(js)) !== null) {
        const p = pm[1];
        if (isValidPath(p) && !p.includes('.') && p.split('/').length <= 5) {
          try {
            routes.add(new URL(p, baseUrl).href);
          } catch {}
        }
      }

      // Next.js page routes
      const nextRe = /pages\/([a-z][a-z0-9\-/_]*)/gi;
      while ((pm = nextRe.exec(js)) !== null) {
        try {
          routes.add(new URL('/' + pm[1].replace(/\/index$/, ''), baseUrl).href);
        } catch {}
      }
    } catch {}
  }

  return [...routes];
}

// ── Well-known paths to probe ─────────────────────────────────
// These are common routes that exist on most web apps.
// We probe them with a HEAD request to see if they return 200.
const COMMON_PATHS = [
  '/', '/home', '/about', '/about-us', '/contact', '/contact-us',
  '/login', '/signin', '/sign-in', '/signup', '/sign-up', '/register',
  '/dashboard', '/app', '/admin', '/portal',
  '/profile', '/account', '/settings', '/preferences',
  '/products', '/product', '/shop', '/store', '/catalogue', '/catalog',
  '/services', '/service', '/features', '/pricing', '/plans',
  '/blog', '/news', '/articles', '/posts',
  '/help', '/support', '/faq', '/docs', '/documentation',
  '/privacy', '/privacy-policy', '/terms', '/terms-of-service',
  '/users', '/members', '/team',
  '/cart', '/checkout', '/orders', '/order-history',
  '/search', '/explore', '/discover',
  '/notifications', '/messages', '/inbox',
  '/reports', '/analytics', '/insights',
  '/api', '/api/v1', '/api/health',
];

async function probeKnownPaths(baseUrl, maxProbes = 30) {
  const base   = new URL(baseUrl);
  const found  = [];
  const probes = COMMON_PATHS.slice(0, maxProbes);

  // Fire all HEAD requests in parallel (fast)
  const results = await Promise.allSettled(
    probes.map(async (path) => {
      const url = `${base.origin}${path}`;
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000),
          redirect: 'follow',
        });
        // 200, 301, 302 all mean the page exists
        if (res.status < 400) return url;
        return null;
      } catch {
        return null;
      }
    })
  );

  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) found.push(r.value);
  });

  return found;
}

// ── Main discover function ────────────────────────────────────
export async function discoverPages(startUrl, maxPages = 20) {
  const visited  = new Set();
  const pageData = [];
  const base     = new URL(startUrl).origin;

  console.log(`[crawler] Starting discovery for ${startUrl}`);

  // ── Phase 1: Fetch root page ──────────────────────────────
  const { html: rootHtml, ok: rootOk, finalUrl: rootFinal } = await fetchPage(startUrl);
  if (!rootOk || !rootHtml) {
    console.warn('[crawler] Root page fetch failed');
    return [];
  }

  const rootUrl = rootFinal || startUrl;
  visited.add(rootUrl.split('?')[0].split('#')[0]);
  const rootParsed = parsePageElements(rootHtml, rootUrl);
  pageData.push(rootParsed);
  console.log(`[crawler] Root page parsed: "${rootParsed.title}"`);

  // ── Phase 2: Extract links from root HTML ─────────────────
  const htmlLinks = extractLinks(rootHtml, rootUrl)
    .filter(l => !visited.has(l.split('?')[0].split('#')[0]));
  console.log(`[crawler] Found ${htmlLinks.length} links in HTML`);

  // ── Phase 3: Extract routes from JS bundles ───────────────
  let bundleRoutes = [];
  try {
    bundleRoutes = (await extractRoutesFromBundles(rootHtml, rootUrl))
      .filter(l => !visited.has(l.split('?')[0].split('#')[0]));
    console.log(`[crawler] Found ${bundleRoutes.length} routes in JS bundles`);
  } catch (e) {
    console.warn('[crawler] Bundle extraction failed:', e.message);
  }

  // ── Phase 4: Probe well-known paths ──────────────────────
  let probedPaths = [];
  try {
    probedPaths = (await probeKnownPaths(rootUrl, 35))
      .filter(l => !visited.has(l.split('?')[0].split('#')[0]));
    console.log(`[crawler] Found ${probedPaths.length} reachable known paths`);
  } catch (e) {
    console.warn('[crawler] Path probing failed:', e.message);
  }

  // ── Phase 5: Merge all discovered URLs, deduplicate ───────
  const allUrls = [...new Set([
    ...htmlLinks,
    ...bundleRoutes,
    ...probedPaths,
  ])].filter(u => {
    try {
      const parsed = new URL(u);
      return parsed.origin === base && isValidPath(parsed.pathname);
    } catch { return false; }
  });

  console.log(`[crawler] Total unique URLs to visit: ${allUrls.length}`);

  // ── Phase 6: Fetch each discovered page ──────────────────
  // Fetch in parallel batches of 5 for speed
  const remaining = allUrls.slice(0, maxPages - 1); // -1 because root already added
  const batches   = chunkArray(remaining, 5);

  for (const batch of batches) {
    if (pageData.length >= maxPages) break;

    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const normalized = url.split('?')[0].split('#')[0];
        if (visited.has(normalized)) return null;
        visited.add(normalized);

        const { html, ok, finalUrl } = await fetchPage(url, 8000);
        if (!ok || !html || html.length < 200) return null;

        const parsed = parsePageElements(html, finalUrl || url);

        // Skip pages that look identical to root (SPA returning same shell)
        if (parsed.title === rootParsed.title &&
            parsed.elements.forms.length === rootParsed.elements.forms.length &&
            parsed.elements.buttons.length === rootParsed.elements.buttons.length) {
          // It's the same SPA shell — use the URL but note it's a virtual route
          return { ...parsed, title: getTitleFromUrl(url), url, isSPARoute: true };
        }

        console.log(`[crawler] Fetched: "${parsed.title}" (${url})`);
        return parsed;
      })
    );

    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value && pageData.length < maxPages) {
        pageData.push(r.value);
      }
    });
  }

  console.log(`[crawler] Discovery complete: ${pageData.length} pages`);
  return pageData;
}

// ── Parse every interactive element from a page ───────────────
export function parsePageElements(html, pageUrl) {
  const elements = {
    forms: [], inputs: [], buttons: [], links: [],
    selects: [], tables: [], navItems: [], headings: [],
    images: [], modals: [], checkboxes: [], radios: [],
    textareas: [], fileInputs: [], pagination: [], tabs: [], accordions: [],
  };

  // Forms
  const formRe = /<form([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm;
  while ((fm = formRe.exec(html)) !== null) {
    const attrs  = fm[1];
    const body   = fm[2];
    const id     = extractAttr(attrs, 'id') || extractAttr(attrs, 'name') || `form-${elements.forms.length+1}`;
    const fields = parseFormFields(body);
    elements.forms.push({
      id,
      action: extractAttr(attrs, 'action') || pageUrl,
      method: extractAttr(attrs, 'method') || 'POST',
      fields,
    });
  }

  // Inputs
  const inputRe = /<input([^>]*)\/?>/gi;
  let im;
  while ((im = inputRe.exec(html)) !== null) {
    const attrs = im[1];
    const type  = extractAttr(attrs, 'type') || 'text';
    if (['hidden', 'submit', 'reset', 'image', 'button'].includes(type)) continue;
    if (type === 'checkbox') {
      elements.checkboxes.push({
        name:     extractAttr(attrs, 'name') || extractAttr(attrs, 'id') || `cb-${elements.checkboxes.length+1}`,
        id:       extractAttr(attrs, 'id') || '',
        required: /required/i.test(attrs),
      });
    } else if (type === 'radio') {
      elements.radios.push({
        name:  extractAttr(attrs, 'name') || `radio-${elements.radios.length+1}`,
        id:    extractAttr(attrs, 'id') || '',
        value: extractAttr(attrs, 'value') || '',
      });
    } else if (type === 'file') {
      elements.fileInputs.push({
        name:     extractAttr(attrs, 'name') || `file-${elements.fileInputs.length+1}`,
        accept:   extractAttr(attrs, 'accept') || '',
        multiple: /multiple/i.test(attrs),
      });
    } else {
      elements.inputs.push({
        type,
        name:        extractAttr(attrs, 'name') || extractAttr(attrs, 'id') || `input-${elements.inputs.length+1}`,
        id:          extractAttr(attrs, 'id') || '',
        placeholder: extractAttr(attrs, 'placeholder') || '',
        required:    /required/i.test(attrs),
        pattern:     extractAttr(attrs, 'pattern') || '',
        minLength:   extractAttr(attrs, 'minlength') || '',
        maxLength:   extractAttr(attrs, 'maxlength') || '',
      });
    }
  }

  // Textareas
  const taRe = /<textarea([^>]*)>/gi;
  let tam;
  while ((tam = taRe.exec(html)) !== null) {
    const attrs = tam[1];
    elements.textareas.push({
      name:     extractAttr(attrs, 'name') || `textarea-${elements.textareas.length+1}`,
      required: /required/i.test(attrs),
      maxLength: extractAttr(attrs, 'maxlength') || '',
    });
  }

  // Selects
  const selRe = /<select([^>]*)>([\s\S]*?)<\/select>/gi;
  let sm;
  while ((sm = selRe.exec(html)) !== null) {
    const attrs = sm[1];
    const body  = sm[2];
    const opts  = [];
    const optRe = /<option([^>]*)>([^<]*)<\/option>/gi;
    let om;
    while ((om = optRe.exec(body)) !== null) {
      const val = extractAttr(om[1], 'value') || om[2].trim();
      if (val) opts.push(val);
    }
    elements.selects.push({
      name:     extractAttr(attrs, 'name') || extractAttr(attrs, 'id') || `select-${elements.selects.length+1}`,
      required: /required/i.test(attrs),
      multiple: /multiple/i.test(attrs),
      options:  opts.slice(0, 20),
    });
  }

  // Buttons
  const btnRe = /<button([^>]*)>([\s\S]*?)<\/button>/gi;
  let bm;
  while ((bm = btnRe.exec(html)) !== null) {
    const text = bm[2].replace(/<[^>]+>/g, '').trim();
    if (!text || text.length > 100) continue;
    elements.buttons.push({
      type:     extractAttr(bm[1], 'type') || 'button',
      text:     text.substring(0, 80),
      id:       extractAttr(bm[1], 'id') || '',
      disabled: /disabled/i.test(bm[1]),
    });
  }

  // Navigation
  const navRe = /<nav([^>]*)>([\s\S]*?)<\/nav>/gi;
  let nm;
  while ((nm = navRe.exec(html)) !== null) {
    const aRe = /<a([^>]*)>([^<]*)<\/a>/gi;
    let am;
    while ((am = aRe.exec(nm[2])) !== null) {
      const text = am[2].trim();
      const href = extractAttr(am[1], 'href') || '';
      if (text && href) elements.navItems.push({ text, href });
    }
  }

  // Tables
  const tblRe = /<table([^>]*)>([\s\S]*?)<\/table>/gi;
  let tm;
  while ((tm = tblRe.exec(html)) !== null) {
    const hdrs = [];
    const thRe = /<th([^>]*)>([^<]*)<\/th>/gi;
    let thm;
    while ((thm = thRe.exec(tm[2])) !== null) hdrs.push(thm[2].trim());
    const rows = (tm[2].match(/<tr/gi) || []).length;
    elements.tables.push({
      id:       extractAttr(tm[1], 'id') || `table-${elements.tables.length+1}`,
      headers:  hdrs.slice(0, 15),
      rowCount: Math.max(0, rows - 1),
    });
  }

  // Headings
  for (let h = 1; h <= 4; h++) {
    const hRe = new RegExp(`<h${h}[^>]*>([^<]+)<\/h${h}>`, 'gi');
    let hm;
    while ((hm = hRe.exec(html)) !== null) {
      const text = hm[1].trim();
      if (text.length > 2) elements.headings.push({ level: h, text: text.substring(0, 100) });
    }
  }

  // Images
  const imgRe = /<img([^>]*)\/?>/gi;
  let igm;
  while ((igm = imgRe.exec(html)) !== null) {
    const attrs = igm[1];
    elements.images.push({
      src:    (extractAttr(attrs, 'src') || '').substring(0, 100),
      hasAlt: extractAttr(attrs, 'alt') !== null,
    });
  }

  // Links
  const linkRe = /<a([^>]*)>([^<]{1,80})<\/a>/gi;
  let lm;
  while ((lm = linkRe.exec(html)) !== null) {
    const text = lm[2].trim();
    const href = extractAttr(lm[1], 'href') || '';
    if (text && href && href !== '#' && href.length < 200) {
      elements.links.push({ text, href, target: extractAttr(lm[1], 'target') || '' });
    }
  }

  // Modals
  const modalCount = (html.match(/role=["']dialog["']|class=["'][^"']*\bmodal\b[^"'"]/gi) || []).length;
  for (let i = 0; i < modalCount; i++) elements.modals.push({ index: i+1 });

  // Tabs
  const tabCount = (html.match(/role=["']tab["']/gi) || []).length;
  if (tabCount > 1) elements.tabs.push({ count: tabCount });

  // Accordions
  const accCount = (html.match(/data-toggle=["']collapse["']|class=["'][^"']*\baccordion\b[^"'"]/gi) || []).length;
  if (accCount > 0) elements.accordions.push({ count: accCount });

  // Pagination
  if (/pagination|page-\d+|\bprev\b.*\bnext\b|\bnext\b.*\bprev\b/i.test(html)) {
    const pageNums = [];
    const pgRe = /[?&]page=(\d+)/gi;
    let pm;
    while ((pm = pgRe.exec(html)) !== null) pageNums.push(parseInt(pm[1]));
    elements.pagination.push({ maxPage: pageNums.length ? Math.max(...pageNums) : 2, detected: true });
  }

  // Page title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/\s*[|\-–]\s*.+$/, '').trim()  // strip " | Site Name" suffix
    : getTitleFromUrl(pageUrl);

  return { elements, title, url: pageUrl };
}

// ── Helpers ───────────────────────────────────────────────────
function extractAttr(str, attr) {
  const patterns = [
    new RegExp(`\\b${attr}=["']([^"']*)["']`, 'i'),
    new RegExp(`\\b${attr}=([^\\s>/]+)`, 'i'),
  ];
  for (const re of patterns) {
    const m = re.exec(str);
    if (m) return m[1];
  }
  return null;
}

function parseFormFields(formHtml) {
  const fields = [];
  const inputRe = /<input([^>]*)\/?>/gi;
  let im;
  while ((im = inputRe.exec(formHtml)) !== null) {
    const a    = im[1];
    const type = extractAttr(a, 'type') || 'text';
    if (type === 'hidden') continue;
    fields.push({
      name:     extractAttr(a, 'name') || extractAttr(a, 'id') || `field-${fields.length+1}`,
      type,
      required: /required/i.test(a),
      pattern:  extractAttr(a, 'pattern') || '',
    });
  }
  const taRe = /<textarea([^>]*)>/gi;
  let tam;
  while ((tam = taRe.exec(formHtml)) !== null) {
    fields.push({
      name:     extractAttr(tam[1], 'name') || extractAttr(tam[1], 'id') || `ta-${fields.length+1}`,
      type:     'textarea',
      required: /required/i.test(tam[1]),
    });
  }
  const selRe = /<select([^>]*)>/gi;
  let sm;
  while ((sm = selRe.exec(formHtml)) !== null) {
    fields.push({
      name:     extractAttr(sm[1], 'name') || extractAttr(sm[1], 'id') || `sel-${fields.length+1}`,
      type:     'select',
      required: /required/i.test(sm[1]),
    });
  }
  return fields;
}

function isValidPath(pathname) {
  return !pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip|map|json|xml|txt|csv|webp|avif|mp4|webm|mp3|wav)$/i)
    && pathname.length < 100
    && !pathname.includes('/_next/') // Next.js internals
    && !pathname.includes('/__webpack')
    && !pathname.includes('/api/') // skip API routes from page crawl
    && pathname !== '';
}

function getTitleFromUrl(url) {
  try {
    const p = new URL(url).pathname;
    if (p === '/' || p === '') return 'Homepage';
    return p.split('/').filter(Boolean).pop()
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()) || 'Page';
  } catch { return 'Page'; }
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
