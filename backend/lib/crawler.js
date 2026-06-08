// ============================================================
// lib/crawler.js — Real HTML crawler for test generation
// Fetches each page, parses HTML, extracts every interactive
// element and generates 200+ test cases per page.
// ============================================================

// ── Fetch a page's HTML ───────────────────────────────────────
export async function fetchPage(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TestItNow/1.0; +https://testitnow.com)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
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

// ── Extract all links from HTML ───────────────────────────────
export function extractLinks(html, baseUrl) {
  const links = new Set();
  const base  = new URL(baseUrl);

  // Match all href attributes
  const hrefRegex = /href=["']([^"'#?]+)["']/gi;
  let m;
  while ((m = hrefRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(m[1], baseUrl);
      // Only same-origin links
      if (resolved.origin === base.origin &&
          !resolved.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|pdf|zip)$/i)) {
        links.add(resolved.href.split('?')[0].split('#')[0]);
      }
    } catch {}
  }
  return [...links];
}

// ── Parse every interactive element from HTML ─────────────────
export function parsePageElements(html, pageUrl) {
  const elements = {
    forms:      [],
    inputs:     [],
    buttons:    [],
    links:      [],
    selects:    [],
    tables:     [],
    navItems:   [],
    headings:   [],
    images:     [],
    modals:     [],
    alerts:     [],
    checkboxes: [],
    radios:     [],
    textareas:  [],
    fileInputs: [],
    iframes:    [],
    videos:     [],
    pagination: [],
    tabs:       [],
    accordions: [],
    dropdowns:  [],
  };

  // ── Forms ─────────────────────────────────────────────────
  const formRegex = /<form([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm;
  while ((fm = formRegex.exec(html)) !== null) {
    const attrs  = fm[1];
    const body   = fm[2];
    const id     = extractAttr(attrs, 'id') || extractAttr(attrs, 'name') || `form-${elements.forms.length+1}`;
    const action = extractAttr(attrs, 'action') || pageUrl;
    const method = extractAttr(attrs, 'method') || 'GET';
    const fields = parseFormFields(body);
    elements.forms.push({ id, action, method, fields, raw: body.substring(0, 200) });
  }

  // ── Inputs ────────────────────────────────────────────────
  const inputRegex = /<input([^>]*)\/?>/gi;
  let im;
  while ((im = inputRegex.exec(html)) !== null) {
    const attrs = im[1];
    const type  = extractAttr(attrs, 'type') || 'text';
    if (['hidden', 'submit', 'reset', 'image'].includes(type)) continue;
    elements.inputs.push({
      type,
      name:        extractAttr(attrs, 'name') || extractAttr(attrs, 'id') || `input-${elements.inputs.length+1}`,
      id:          extractAttr(attrs, 'id') || '',
      placeholder: extractAttr(attrs, 'placeholder') || '',
      required:    /required/i.test(attrs),
      pattern:     extractAttr(attrs, 'pattern') || '',
      minLength:   extractAttr(attrs, 'minlength') || '',
      maxLength:   extractAttr(attrs, 'maxlength') || '',
      min:         extractAttr(attrs, 'min') || '',
      max:         extractAttr(attrs, 'max') || '',
      ariaLabel:   extractAttr(attrs, 'aria-label') || extractAttr(attrs, 'aria-labelledby') || '',
    });
  }

  // ── Textareas ─────────────────────────────────────────────
  const taRegex = /<textarea([^>]*)>/gi;
  let tam;
  while ((tam = taRegex.exec(html)) !== null) {
    const attrs = tam[1];
    elements.textareas.push({
      name:      extractAttr(attrs, 'name') || `textarea-${elements.textareas.length+1}`,
      id:        extractAttr(attrs, 'id') || '',
      required:  /required/i.test(attrs),
      rows:      extractAttr(attrs, 'rows') || '',
      maxLength: extractAttr(attrs, 'maxlength') || '',
    });
  }

  // ── Selects / Dropdowns ───────────────────────────────────
  const selRegex = /<select([^>]*)>([\s\S]*?)<\/select>/gi;
  let sm;
  while ((sm = selRegex.exec(html)) !== null) {
    const attrs   = sm[1];
    const body    = sm[2];
    const options = [];
    const optRegex = /<option([^>]*)>([^<]*)<\/option>/gi;
    let om;
    while ((om = optRegex.exec(body)) !== null) {
      const val = extractAttr(om[1], 'value') || om[2].trim();
      if (val) options.push(val);
    }
    elements.selects.push({
      name:     extractAttr(attrs, 'name') || extractAttr(attrs, 'id') || `select-${elements.selects.length+1}`,
      id:       extractAttr(attrs, 'id') || '',
      required: /required/i.test(attrs),
      multiple: /multiple/i.test(attrs),
      options:  options.slice(0, 20),
    });
  }

  // ── Checkboxes ────────────────────────────────────────────
  const cbRegex = /<input([^>]*type=["']?checkbox["']?[^>]*)>/gi;
  let cbm;
  while ((cbm = cbRegex.exec(html)) !== null) {
    const attrs = cbm[1];
    elements.checkboxes.push({
      name:  extractAttr(attrs, 'name') || extractAttr(attrs, 'id') || `checkbox-${elements.checkboxes.length+1}`,
      id:    extractAttr(attrs, 'id') || '',
      value: extractAttr(attrs, 'value') || '',
      required: /required/i.test(attrs),
    });
  }

  // ── Radio Buttons ─────────────────────────────────────────
  const rdRegex = /<input([^>]*type=["']?radio["']?[^>]*)>/gi;
  let rdm;
  while ((rdm = rdRegex.exec(html)) !== null) {
    const attrs = rdm[1];
    elements.radios.push({
      name:  extractAttr(attrs, 'name') || `radio-${elements.radios.length+1}`,
      id:    extractAttr(attrs, 'id') || '',
      value: extractAttr(attrs, 'value') || '',
    });
  }

  // ── File Inputs ───────────────────────────────────────────
  const fileRegex = /<input([^>]*type=["']?file["']?[^>]*)>/gi;
  let filem;
  while ((filem = fileRegex.exec(html)) !== null) {
    const attrs = filem[1];
    elements.fileInputs.push({
      name:   extractAttr(attrs, 'name') || `file-${elements.fileInputs.length+1}`,
      accept: extractAttr(attrs, 'accept') || '',
      multiple: /multiple/i.test(attrs),
    });
  }

  // ── Buttons ───────────────────────────────────────────────
  const btnRegex = /<button([^>]*)>([^<]*(?:<[^>]*>[^<]*<\/[^>]*>)*[^<]*)<\/button>/gi;
  let bm;
  while ((bm = btnRegex.exec(html)) !== null) {
    const attrs = bm[1];
    const text  = bm[2].replace(/<[^>]+>/g,'').trim();
    if (!text) continue;
    elements.buttons.push({
      type:      extractAttr(attrs, 'type') || 'button',
      text:      text.substring(0, 80),
      id:        extractAttr(attrs, 'id') || '',
      ariaLabel: extractAttr(attrs, 'aria-label') || '',
      disabled:  /disabled/i.test(attrs),
      className: extractAttr(attrs, 'class') || '',
    });
  }

  // ── Navigation items ──────────────────────────────────────
  const navRegex = /<nav([^>]*)>([\s\S]*?)<\/nav>/gi;
  let nm;
  while ((nm = navRegex.exec(html)) !== null) {
    const navBody  = nm[2];
    const navLinks = [];
    const nlRegex  = /<a([^>]*)>([^<]*)<\/a>/gi;
    let nlm;
    while ((nlm = nlRegex.exec(navBody)) !== null) {
      const text = nlm[2].trim();
      const href = extractAttr(nlm[1], 'href') || '';
      if (text && href) navLinks.push({ text, href });
    }
    if (navLinks.length) elements.navItems.push(...navLinks.slice(0, 30));
  }

  // ── Tables ────────────────────────────────────────────────
  const tblRegex = /<table([^>]*)>([\s\S]*?)<\/table>/gi;
  let tm;
  while ((tm = tblRegex.exec(html)) !== null) {
    const body    = tm[2];
    const headers = [];
    const thRegex = /<th([^>]*)>([^<]*)<\/th>/gi;
    let thm;
    while ((thm = thRegex.exec(body)) !== null) headers.push(thm[2].trim());
    const rowCount = (body.match(/<tr/gi) || []).length;
    elements.tables.push({
      id:       extractAttr(tm[1], 'id') || `table-${elements.tables.length+1}`,
      headers:  headers.slice(0, 15),
      rowCount: Math.max(0, rowCount - 1),
    });
  }

  // ── Headings ──────────────────────────────────────────────
  for (let h = 1; h <= 4; h++) {
    const hRegex = new RegExp(`<h${h}([^>]*)>([^<]+)<\/h${h}>`, 'gi');
    let hm;
    while ((hm = hRegex.exec(html)) !== null) {
      const text = hm[2].trim();
      if (text.length > 2) elements.headings.push({ level: h, text: text.substring(0, 100) });
    }
  }

  // ── Images ────────────────────────────────────────────────
  const imgRegex = /<img([^>]*)\/?>/gi;
  let igm;
  while ((igm = imgRegex.exec(html)) !== null) {
    const attrs = igm[1];
    const src   = extractAttr(attrs, 'src') || '';
    const alt   = extractAttr(attrs, 'alt');
    elements.images.push({
      src:    src.substring(0, 100),
      alt:    alt,
      hasAlt: alt !== null,
      id:     extractAttr(attrs, 'id') || '',
    });
  }

  // ── Links ─────────────────────────────────────────────────
  const linkRegex = /<a([^>]*)>([^<]*)<\/a>/gi;
  let lm;
  while ((lm = linkRegex.exec(html)) !== null) {
    const attrs = lm[1];
    const text  = lm[2].trim();
    const href  = extractAttr(attrs, 'href') || '';
    if (text && href && href !== '#') {
      elements.links.push({
        text:   text.substring(0, 80),
        href,
        target: extractAttr(attrs, 'target') || '',
        rel:    extractAttr(attrs, 'rel') || '',
      });
    }
  }

  // ── Pagination ────────────────────────────────────────────
  if (/pagination|page-\d+|prev.*next|next.*prev/i.test(html)) {
    const pageNums = [];
    const pRegex = /href=["'][^"']*[?&]page=(\d+)[^"'"]/gi;
    let pm;
    while ((pm = pRegex.exec(html)) !== null) pageNums.push(parseInt(pm[1]));
    const maxPage = pageNums.length ? Math.max(...pageNums) : 1;
    elements.pagination.push({ maxPage, detected: true });
  }

  // ── Tabs ──────────────────────────────────────────────────
  const tabRegex = /role=["']tab["']|class=["'][^"']*\btab\b[^"'"]/gi;
  const tabMatches = html.match(tabRegex) || [];
  if (tabMatches.length > 1) {
    elements.tabs.push({ count: tabMatches.length });
  }

  // ── Modals / Dialogs ──────────────────────────────────────
  const modalRegex = /role=["']dialog["']|class=["'][^"']*\bmodal\b[^"'"]/gi;
  const modalMatches = html.match(modalRegex) || [];
  modalMatches.forEach((_, i) => elements.modals.push({ index: i + 1 }));

  // ── Accordions ────────────────────────────────────────────
  const accRegex = /data-toggle=["']collapse["']|class=["'][^"']*\baccordion\b[^"'"]/gi;
  const accMatches = html.match(accRegex) || [];
  if (accMatches.length) elements.accordions.push({ count: accMatches.length });

  // ── Page title ────────────────────────────────────────────
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : new URL(pageUrl).pathname;

  return { elements, title, url: pageUrl };
}

// ── Helper: extract attribute value ──────────────────────────
function extractAttr(str, attr) {
  // Handles: attr="val", attr='val', attr=val
  const patterns = [
    new RegExp(`\\b${attr}=["']([^"']*)["']`, 'i'),
    new RegExp(`\\b${attr}=([^\\s>]+)`, 'i'),
  ];
  for (const re of patterns) {
    const m = re.exec(str);
    if (m) return m[1];
  }
  return null;
}

// ── Helper: parse form fields ─────────────────────────────────
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
    const a = tam[1];
    fields.push({
      name:     extractAttr(a, 'name') || extractAttr(a, 'id') || `textarea-${fields.length+1}`,
      type:     'textarea',
      required: /required/i.test(a),
    });
  }
  const selRe = /<select([^>]*)>/gi;
  let sm;
  while ((sm = selRe.exec(formHtml)) !== null) {
    const a = sm[1];
    fields.push({
      name:     extractAttr(a, 'name') || extractAttr(a, 'id') || `select-${fields.length+1}`,
      type:     'select',
      required: /required/i.test(a),
    });
  }
  return fields;
}

// ── Discover all pages from a site up to maxPages ────────────
export async function discoverPages(startUrl, maxPages = 20) {
  const visited   = new Set();
  const toVisit   = [startUrl];
  const pageData  = [];
  const base      = new URL(startUrl).origin;

  while (toVisit.length && pageData.length < maxPages) {
    const url = toVisit.shift();
    const normalized = url.split('?')[0].split('#')[0];
    if (visited.has(normalized)) continue;
    visited.add(normalized);

    console.log(`[crawler] Fetching: ${url}`);
    const { html, ok, finalUrl } = await fetchPage(url);
    if (!ok || !html) continue;

    const parsed = parsePageElements(html, finalUrl || url);
    pageData.push(parsed);

    // Discover more links from this page (up to limit)
    const links = extractLinks(html, url)
      .filter(l => !visited.has(l.split('?')[0].split('#')[0]))
      .slice(0, 10); // limit links per page to avoid explosion

    toVisit.push(...links);
    // Small delay to be polite
    await new Promise(r => setTimeout(r, 200));
  }

  return pageData;
}
