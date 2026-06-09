// ============================================================
// lib/testGenerator.js
// Generates 100-300+ test cases per page.
// Works even on SPAs where HTML parsing yields few elements —
// infers elements from URL/page title and generates tests for
// every possible scenario, interaction, and edge case.
// ============================================================

let tcCounter = 0;
export function resetCounter() { tcCounter = 0; }
function nextId(prefix) {
  tcCounter++;
  return `${prefix}-${String(tcCounter).padStart(4,'0')}`;
}

// ── MASTER GENERATOR ─────────────────────────────────────────
export function generateAllTestCases(pages, authCredentials) {
  resetCounter();
  const all = { ui:[], api:[], security:[], performance:[], database:[], unit:[] };

  pages.forEach((page, idx) => {
    const t = generatePageTests(page, idx, authCredentials);
    Object.entries(t).forEach(([type, list]) => all[type].push(...list));
  });

  all.ui.push(         ...generateCrossPageTests(pages));
  all.security.push(   ...generateGlobalSecurityTests(pages));
  all.performance.push(...generateGlobalPerfTests(pages));
  all.api.push(        ...generateApiTests(pages));
  all.database.push(   ...generateDatabaseTests());
  all.unit.push(       ...generateUnitTests());

  return all;
}

// ── PER-PAGE GENERATOR ────────────────────────────────────────
function generatePageTests(page, pageIdx, authCredentials) {
  const { elements, title, url } = page;
  const tests   = { ui:[], security:[] };
  const hasAuth = authCredentials?.username && authCredentials?.password;

  // Infer page type from URL + title to supplement parsed elements
  const pageType = inferPageType(url, title);
  const inferred = inferElements(url, title, pageType, elements);

  // Merge parsed + inferred elements
  const merged = mergeElements(elements, inferred);

  // ─────────────────────────────────────────────────────────
  // A. UNIVERSAL PAGE TESTS (every page gets all of these)
  // ─────────────────────────────────────────────────────────

  // 1. Load tests
  tests.ui.push(tc('UI-LOAD', `[${title}] Page Load — Success`, url,
    `Verify ${url} loads and renders correctly`,
    `Browser open | App accessible`,
    `1. Navigate to ${url} | 2. Wait for JS to render | 3. Verify content visible | 4. Check network tab for errors | 5. Verify status 200`,
    `Page visible within 3s | Status 200 | No JS errors | No 404 resources`,
    pageIdx < 3 ? 'Critical' : 'High'));

  tests.ui.push(tc('UI-LOAD', `[${title}] Page Load — After Hard Refresh`, url,
    `Verify page loads correctly after Ctrl+Shift+R (bypass cache)`,
    `Page previously visited`,
    `1. Navigate to ${url} | 2. Press Ctrl+Shift+R | 3. Verify full reload | 4. Verify content same as normal load`,
    `Full reload works | No cached state issues | Content consistent`,
    'Medium'));

  tests.ui.push(tc('UI-LOAD', `[${title}] Direct URL Access`, url,
    `Verify page accessible by typing URL directly (SPA routing)`,
    `Browser address bar`,
    `1. Clear browser history | 2. Type ${url} directly | 3. Press Enter | 4. Verify page loads without 404 | 5. Verify correct content shown`,
    `Page loads correctly | No "Cannot GET /" error | SPA routing works | Content matches page`,
    'Critical'));

  tests.ui.push(tc('UI-LOAD', `[${title}] Page Load — Slow Network (3G)`, url,
    `Verify page remains usable on slow 3G connection`,
    `Chrome DevTools > Network throttling`,
    `1. Open DevTools > Network | 2. Set throttle to "Slow 3G" | 3. Navigate to ${url} | 4. Verify loading state shown | 5. Verify page eventually loads`,
    `Loading indicator shown | Content loads within 10s | No timeout errors | Skeleton/placeholder shown`,
    'High'));

  tests.ui.push(tc('UI-LOAD', `[${title}] Offline Behaviour`, url,
    `Verify graceful handling when offline`,
    `DevTools Network > Offline mode`,
    `1. Load page | 2. Enable Offline mode in DevTools | 3. Click navigation links | 4. Verify error message | 5. Re-enable network | 6. Verify page recovers`,
    `Friendly offline message | App doesn't crash | Recovers when network restored`,
    'Medium'));

  // 2. Responsive tests — 5 breakpoints
  [
    {w:320,  label:'Mobile S (320px)',   device:'iPhone SE'},
    {w:375,  label:'Mobile M (375px)',   device:'iPhone 14'},
    {w:768,  label:'Tablet (768px)',     device:'iPad'},
    {w:1024, label:'Laptop (1024px)',    device:'MacBook'},
    {w:1440, label:'Desktop (1440px)',   device:'External Monitor'},
  ].forEach(bp => {
    tests.ui.push(tc('UI-RESP', `[${title}] Responsive — ${bp.label}`, url,
      `Verify layout at ${bp.label} (${bp.device})`,
      `Chrome DevTools | Device toolbar`,
      `1. Open ${url} | 2. DevTools > Device toolbar | 3. Set width ${bp.w}px | 4. Check layout | 5. Check overflow | 6. Check font sizes | 7. Check touch targets | 8. Test all interactions`,
      `No horizontal scroll | Readable text (≥14px) | Touch targets ≥44px | No overlapping elements | Images fit viewport`,
      'High'));
  });

  // 3. Browser tests — 5 browsers
  ['Chrome 120', 'Firefox 121', 'Safari 17', 'Edge 120', 'Chrome Mobile'].forEach(browser => {
    tests.ui.push(tc('UI-BROWSER', `[${title}] ${browser} Compatibility`, url,
      `Verify ${title} renders and functions correctly in ${browser}`,
      `${browser} installed`,
      `1. Open ${url} in ${browser} | 2. Check visual rendering | 3. Test interactive elements | 4. Check console for errors | 5. Verify fonts and icons load`,
      `No layout breaks | All features work | No console errors | Fonts render correctly`,
      'Medium'));
  });

  // 4. Accessibility tests
  [
    ['WCAG 2.1 AA Scan',        `Run automated scan with axe | Verify 0 critical errors | 0 serious errors`],
    ['Keyboard Navigation',     `Tab through all elements | Verify focus visible | Tab order logical | All interactive elements reachable`],
    ['Screen Reader',           `Enable NVDA/VoiceOver | Navigate page | Verify all content announced | Images have alt text`],
    ['Colour Contrast',         `Check all text | Verify contrast ratio ≥4.5:1 normal text | ≥3:1 large text | Use axe or Colour Contrast Analyser`],
    ['Focus Management',        `Click links | Open modals | Verify focus moves correctly | Verify focus returns after close`],
    ['Skip Navigation Link',    `Press Tab on page load | Verify "Skip to main content" appears | Press Enter | Verify focus jumps to main`],
    ['ARIA Labels',             `Inspect interactive elements | Verify aria-label on icon buttons | Verify aria-expanded on toggles | Verify roles`],
    ['Zoom to 200%',            `Browser zoom to 200% | Verify no content lost | Verify no horizontal scroll | Verify readable`],
  ].forEach(([name, steps]) => {
    tests.ui.push(tc('UI-A11Y', `[${title}] Accessibility — ${name}`, url,
      `WCAG 2.1 compliance: ${name}`,
      `Accessibility testing tools available`,
      steps,
      `Passes ${name} check | No accessibility violations`,
      'High'));
  });

  // 5. SEO tests
  [
    ['Title Tag',           `View source | Check <title> exists | Title 30-60 chars | Contains keywords`],
    ['Meta Description',    `View source | Check meta description | Length 50-160 chars | Unique and descriptive`],
    ['Open Graph Tags',     `View source | Check og:title, og:description, og:image | All present`],
    ['Canonical URL',       `View source | Check <link rel="canonical"> | Points to correct URL`],
    ['H1 Structure',        `View source | Count H1 tags | Verify exactly 1 H1 | H1 is descriptive`],
    ['Structured Data',     `View source | Check JSON-LD or microdata | Valid schema markup`],
    ['robots.txt',          `Navigate to ${new URL(url).origin}/robots.txt | Verify exists | Not blocking important pages`],
    ['sitemap.xml',         `Navigate to ${new URL(url).origin}/sitemap.xml | Verify exists | Contains all pages`],
  ].forEach(([name, steps]) => {
    tests.ui.push(tc('UI-SEO', `[${title}] SEO — ${name}`, url,
      `SEO check: ${name}`,
      `Browser and DevTools`,
      steps,
      `${name} passes SEO best practices`,
      'Medium'));
  });

  // 6. Performance tests
  [
    ['Lighthouse Score',       `Run Lighthouse audit | Record Performance score | Target ≥80`],
    ['LCP (Largest Contentful Paint)', `Measure LCP in Lighthouse | Target < 2.5s`],
    ['FID (First Input Delay)',       `Measure FID | Target < 100ms`],
    ['CLS (Cumulative Layout Shift)', `Measure CLS | Target < 0.1 | No layout shifts`],
    ['TTFB (Time to First Byte)',     `Check TTFB in Network tab | Target < 600ms`],
    ['Bundle Size',                   `Check Network tab | Main JS bundle < 500KB | CSS < 100KB`],
    ['Image Optimisation',            `Check images in Network | WebP/AVIF format | Lazy loading | Correct dimensions`],
    ['Caching Headers',               `Check response headers | Cache-Control set | ETag present | Immutable for static`],
  ].forEach(([name, steps]) => {
    tests.ui.push(tc('UI-PERF-PAGE', `[${title}] Performance — ${name}`, url,
      `Performance metric: ${name}`,
      `Chrome Lighthouse / DevTools`,
      steps,
      `${name} meets target threshold`,
      'High'));
  });

  // 7. Security per-page tests
  [
    [`[${title}] XSS — URL Parameter`,         `Try ${url}?q=<script>alert(1)</script> | Verify no XSS | Input escaped in page`],
    [`[${title}] Clickjacking`,                 `Add ${url} to iframe on test page | Verify X-Frame-Options blocks it`],
    [`[${title}] Mixed Content`,                `Open ${url} | Check console for mixed content warnings | All resources HTTPS`],
    [`[${title}] Information Disclosure`,       `View source of ${url} | No comments with credentials | No debug info | No stack traces`],
    [`[${title}] CSP Header`,                   `Check Content-Security-Policy response header | Restrictive policy | No unsafe-inline`],
  ].forEach(([name, steps]) => {
    tests.security.push(tc('SEC-PAGE', name, url, `Security: ${name}`, `Access to ${url}`, steps, `Security check passes | No vulnerabilities`, 'Critical'));
  });

  // ─────────────────────────────────────────────────────────
  // B. PAGE-TYPE SPECIFIC TESTS
  // ─────────────────────────────────────────────────────────
  generatePageTypeTests(pageType, title, url, merged, tests, pageIdx, hasAuth, authCredentials);

  // ─────────────────────────────────────────────────────────
  // C. ELEMENT-BASED TESTS (from parsed + inferred elements)
  // ─────────────────────────────────────────────────────────

  // Forms
  merged.forms.forEach((form, fi) => generateFormTests(form, fi, title, url, tests));

  // Inputs (standalone, not in forms)
  const standaloneInputs = merged.inputs.filter(inp =>
    !merged.forms.some(f => f.fields.some(ff => ff.name === inp.name))
  ).slice(0, 20);
  standaloneInputs.forEach(inp => generateInputTests(inp, title, url, tests));

  // Buttons
  const uniqueBtns = [...new Map(merged.buttons.map(b=>[b.text,b])).values()].slice(0,25);
  uniqueBtns.forEach(btn => generateButtonTests(btn, title, url, tests));

  // Selects
  merged.selects.slice(0,15).forEach(sel => generateSelectTests(sel, title, url, tests));

  // Tables
  merged.tables.slice(0,10).forEach(tbl => generateTableTests(tbl, title, url, tests));

  // Navigation links
  const uniqueLinks = [...new Map(merged.navItems.map(n=>[n.href,n])).values()].slice(0,20);
  if (uniqueLinks.length > 0) generateNavTests(uniqueLinks, title, url, tests);

  // Modals
  merged.modals.slice(0,10).forEach((_, mi) => generateModalTests(mi+1, title, url, tests));

  // File inputs
  merged.fileInputs.slice(0,5).forEach(fi => generateFileInputTests(fi, title, url, tests));

  // Pagination
  if (merged.pagination.length > 0) generatePaginationTests(merged.pagination[0], title, url, tests);

  // Tabs
  if (merged.tabs.length > 0) generateTabTests(merged.tabs[0], title, url, tests);

  return tests;
}

// ── Infer page type from URL + title ─────────────────────────
function inferPageType(url, title) {
  const u = (url + ' ' + title).toLowerCase();
  if (/login|signin|sign-in/.test(u))                          return 'auth-login';
  if (/signup|sign-up|register|registration|create.*account/.test(u)) return 'auth-signup';
  if (/forgot.*pass|reset.*pass|password.*reset/.test(u))      return 'auth-forgot';
  if (/dashboard|home|overview|summary/.test(u))               return 'dashboard';
  if (/profile|account|my.*account|user.*settings/.test(u))    return 'profile';
  if (/settings|preferences|configuration|config/.test(u))     return 'settings';
  if (/product|item|listing|catalogue|catalog|shop|store/.test(u)) return 'product-list';
  if (/detail|single|view|item\/\d|product\//.test(u))         return 'product-detail';
  if (/cart|basket/.test(u))                                   return 'cart';
  if (/checkout|payment|billing|order/.test(u))                return 'checkout';
  if (/order.*history|my.*orders|purchases/.test(u))           return 'order-history';
  if (/search|results|find/.test(u))                           return 'search';
  if (/contact|get.*touch|reach.*us/.test(u))                  return 'contact';
  if (/about|team|company|who.*we|our.*story/.test(u))         return 'about';
  if (/blog|news|article|post|press/.test(u))                  return 'blog';
  if (/help|faq|support|docs|documentation|knowledge/.test(u)) return 'help';
  if (/pricing|plans|subscription/.test(u))                    return 'pricing';
  if (/\/$|^home/.test(u))                                     return 'home';
  return 'generic';
}

// ── Infer elements from page type when HTML parsing fails ─────
function inferElements(url, title, pageType, parsed) {
  const inferred = { forms:[], inputs:[], buttons:[], selects:[], tables:[], navItems:[], modals:[], fileInputs:[], pagination:[], tabs:[], checkboxes:[], radios:[] };

  switch(pageType) {
    case 'auth-login':
      inferred.forms.push({ id:'login-form', action:url, method:'POST', fields:[
        { name:'email',    type:'email',    required:true,  pattern:'email' },
        { name:'password', type:'password', required:true,  pattern:'minLength:8' },
        { name:'remember', type:'checkbox', required:false, pattern:'' },
      ]});
      inferred.buttons.push({ text:'Login', type:'submit' }, { text:'Sign In', type:'submit' },
        { text:'Forgot Password', type:'button' }, { text:'Sign up', type:'button' },
        { text:'Continue with Google', type:'button' }, { text:'Continue with GitHub', type:'button' });
      break;

    case 'auth-signup':
      inferred.forms.push({ id:'signup-form', action:url, method:'POST', fields:[
        { name:'fullName',        type:'text',     required:true,  pattern:'minLength:3' },
        { name:'email',           type:'email',    required:true,  pattern:'email' },
        { name:'password',        type:'password', required:true,  pattern:'minLength:8' },
        { name:'confirmPassword', type:'password', required:true,  pattern:'matchPassword' },
        { name:'phone',           type:'tel',      required:false, pattern:'phone' },
        { name:'terms',           type:'checkbox', required:true,  pattern:'' },
        { name:'newsletter',      type:'checkbox', required:false, pattern:'' },
      ]});
      inferred.buttons.push({ text:'Sign Up', type:'submit' }, { text:'Create Account', type:'submit' },
        { text:'Already have account', type:'button' });
      break;

    case 'auth-forgot':
      inferred.forms.push({ id:'forgot-form', action:url, method:'POST', fields:[
        { name:'email', type:'email', required:true, pattern:'email' },
      ]});
      inferred.buttons.push({ text:'Send Reset Link', type:'submit' }, { text:'Back to Login', type:'button' });
      break;

    case 'dashboard':
      inferred.buttons.push(
        { text:'New', type:'button' }, { text:'Create', type:'button' },
        { text:'Add', type:'button' }, { text:'Refresh', type:'button' },
        { text:'Export', type:'button' }, { text:'Filter', type:'button' },
        { text:'View All', type:'button' }, { text:'Settings', type:'button' },
      );
      inferred.tables.push({ id:'dashboard-table', headers:['Name','Status','Date','Actions'], rowCount:10 });
      inferred.modals.push({ index:1 }, { index:2 });
      inferred.selects.push({ name:'date-range', required:false, multiple:false, options:['Today','This Week','This Month','This Year','Custom'] });
      inferred.selects.push({ name:'status-filter', required:false, multiple:false, options:['All','Active','Inactive','Pending'] });
      break;

    case 'profile':
      inferred.forms.push({ id:'profile-form', action:url, method:'PUT', fields:[
        { name:'fullName',    type:'text',     required:true,  pattern:'minLength:3' },
        { name:'email',       type:'email',    required:true,  pattern:'email' },
        { name:'phone',       type:'tel',      required:false, pattern:'phone' },
        { name:'bio',         type:'textarea', required:false, pattern:'maxLength:500' },
        { name:'website',     type:'url',      required:false, pattern:'url' },
        { name:'avatar',      type:'file',     required:false, pattern:'image/*' },
      ]});
      inferred.buttons.push({ text:'Save Changes', type:'submit' }, { text:'Cancel', type:'button' },
        { text:'Change Password', type:'button' }, { text:'Delete Account', type:'button' },
        { text:'Upload Photo', type:'button' });
      inferred.fileInputs.push({ name:'avatar', accept:'image/*', multiple:false });
      inferred.tabs.push({ count:3 }); // Profile, Security, Preferences
      break;

    case 'settings':
      inferred.tabs.push({ count:4 }); // General, Security, Notifications, Billing
      inferred.buttons.push({ text:'Save', type:'submit' }, { text:'Save Changes', type:'submit' },
        { text:'Reset', type:'button' }, { text:'Delete Account', type:'button' });
      inferred.selects.push({ name:'language', required:false, multiple:false, options:['English','French','Spanish','Arabic'] });
      inferred.selects.push({ name:'timezone', required:false, multiple:false, options:['UTC','EST','PST','GMT','IST'] });
      inferred.checkboxes.push({ name:'email-notifications', required:false },
        { name:'sms-notifications', required:false }, { name:'marketing', required:false });
      inferred.forms.push({ id:'settings-form', action:url, method:'PUT', fields:[
        { name:'language', type:'select', required:false, pattern:'' },
        { name:'timezone', type:'select', required:false, pattern:'' },
      ]});
      break;

    case 'product-list':
      inferred.buttons.push({ text:'Filter', type:'button' }, { text:'Sort', type:'button' },
        { text:'Add to Cart', type:'button' }, { text:'Add to Wishlist', type:'button' },
        { text:'View', type:'button' }, { text:'Quick View', type:'button' },
        { text:'Load More', type:'button' });
      inferred.selects.push({ name:'sort-by', required:false, multiple:false, options:['Price: Low to High','Price: High to Low','Newest','Popular','Rating'] });
      inferred.selects.push({ name:'category', required:false, multiple:false, options:['All','Electronics','Clothing','Books','Sports'] });
      inferred.selects.push({ name:'price-range', required:false, multiple:false, options:['All','Under $25','$25-$50','$50-$100','Over $100'] });
      inferred.pagination.push({ maxPage:5, detected:true });
      inferred.inputs.push({ name:'search', type:'search', required:false, placeholder:'Search products...', pattern:'' });
      break;

    case 'product-detail':
      inferred.buttons.push({ text:'Add to Cart', type:'button' }, { text:'Buy Now', type:'button' },
        { text:'Add to Wishlist', type:'button' }, { text:'Share', type:'button' },
        { text:'Write Review', type:'button' }, { text:'Ask Question', type:'button' });
      inferred.selects.push({ name:'quantity', required:true, multiple:false, options:['1','2','3','4','5','10'] });
      inferred.selects.push({ name:'size', required:true, multiple:false, options:['XS','S','M','L','XL','XXL'] });
      inferred.selects.push({ name:'color', required:true, multiple:false, options:['Red','Blue','Green','Black','White'] });
      inferred.tabs.push({ count:3 }); // Description, Reviews, Q&A
      break;

    case 'cart':
      inferred.buttons.push({ text:'Proceed to Checkout', type:'button' }, { text:'Remove', type:'button' },
        { text:'Update Cart', type:'button' }, { text:'Apply Coupon', type:'button' },
        { text:'Continue Shopping', type:'button' }, { text:'Save for Later', type:'button' });
      inferred.inputs.push({ name:'coupon', type:'text', required:false, placeholder:'Coupon code', pattern:'' });
      inferred.selects.push({ name:'quantity', required:false, multiple:false, options:['1','2','3','4','5'] });
      break;

    case 'checkout':
      inferred.forms.push({ id:'checkout-form', action:url, method:'POST', fields:[
        { name:'fullName',   type:'text',     required:true,  pattern:'minLength:3' },
        { name:'email',      type:'email',    required:true,  pattern:'email' },
        { name:'phone',      type:'tel',      required:true,  pattern:'phone' },
        { name:'address',    type:'text',     required:true,  pattern:'minLength:10' },
        { name:'city',       type:'text',     required:true,  pattern:'' },
        { name:'state',      type:'text',     required:true,  pattern:'' },
        { name:'zipCode',    type:'text',     required:true,  pattern:'zip' },
        { name:'country',    type:'select',   required:true,  pattern:'' },
        { name:'cardNumber', type:'text',     required:true,  pattern:'creditCard' },
        { name:'cardExpiry', type:'text',     required:true,  pattern:'MM/YY' },
        { name:'cardCvv',    type:'text',     required:true,  pattern:'digits:3-4' },
        { name:'cardName',   type:'text',     required:true,  pattern:'minLength:3' },
        { name:'saveCard',   type:'checkbox', required:false, pattern:'' },
      ]});
      inferred.radios.push({ name:'payment-method', value:'card' }, { name:'payment-method', value:'paypal' }, { name:'payment-method', value:'bank' });
      inferred.buttons.push({ text:'Place Order', type:'submit' }, { text:'Pay Now', type:'submit' }, { text:'Back', type:'button' });
      break;

    case 'search':
      inferred.forms.push({ id:'search-form', action:url, method:'GET', fields:[
        { name:'q', type:'search', required:true, pattern:'' },
      ]});
      inferred.selects.push({ name:'category', required:false, multiple:false, options:['All','Products','Blog','Users'] });
      inferred.selects.push({ name:'sort', required:false, multiple:false, options:['Relevance','Newest','Popular'] });
      inferred.buttons.push({ text:'Search', type:'submit' }, { text:'Clear', type:'button' }, { text:'Filter', type:'button' });
      inferred.pagination.push({ maxPage:10, detected:true });
      break;

    case 'contact':
      inferred.forms.push({ id:'contact-form', action:url, method:'POST', fields:[
        { name:'name',    type:'text',     required:true,  pattern:'minLength:3' },
        { name:'email',   type:'email',    required:true,  pattern:'email' },
        { name:'phone',   type:'tel',      required:false, pattern:'phone' },
        { name:'subject', type:'text',     required:true,  pattern:'minLength:5' },
        { name:'message', type:'textarea', required:true,  pattern:'minLength:20' },
        { name:'terms',   type:'checkbox', required:true,  pattern:'' },
      ]});
      inferred.selects.push({ name:'department', required:false, multiple:false, options:['Sales','Support','Billing','Technical','General'] });
      inferred.buttons.push({ text:'Send Message', type:'submit' }, { text:'Clear', type:'button' });
      break;

    case 'home':
      inferred.buttons.push({ text:'Get Started', type:'button' }, { text:'Sign Up Free', type:'button' },
        { text:'Learn More', type:'button' }, { text:'View Demo', type:'button' },
        { text:'Contact Sales', type:'button' }, { text:'Watch Video', type:'button' });
      inferred.modals.push({ index:1 }); // Newsletter/promo popup
      break;

    case 'pricing':
      inferred.buttons.push({ text:'Get Started', type:'button' }, { text:'Start Free Trial', type:'button' },
        { text:'Contact Sales', type:'button' }, { text:'Upgrade', type:'button' },
        { text:'Choose Plan', type:'button' });
      inferred.radios.push({ name:'billing', value:'monthly' }, { name:'billing', value:'annual' });
      break;

    case 'blog':
      inferred.inputs.push({ name:'search', type:'search', required:false, placeholder:'Search articles...', pattern:'' });
      inferred.selects.push({ name:'category', required:false, multiple:false, options:['All','Technology','News','Updates','Tutorials'] });
      inferred.pagination.push({ maxPage:5, detected:true });
      inferred.buttons.push({ text:'Read More', type:'button' }, { text:'Subscribe', type:'button' });
      break;

    default:
      // Generic page — add common elements
      inferred.buttons.push({ text:'Submit', type:'button' }, { text:'Cancel', type:'button' },
        { text:'Save', type:'button' }, { text:'Edit', type:'button' });
  }

  return inferred;
}

// ── Merge parsed and inferred elements ───────────────────────
function mergeElements(parsed, inferred) {
  const merge = (a, b) => {
    const combined = [...a, ...b];
    // Simple dedup by name/id
    return combined.filter((item, idx) => {
      const key = item.name || item.text || item.id || idx;
      return combined.findIndex(x => (x.name||x.text||x.id) === key) === idx;
    });
  };

  return {
    forms:      merge(parsed.forms,      inferred.forms),
    inputs:     merge(parsed.inputs,     inferred.inputs),
    buttons:    merge(parsed.buttons,    inferred.buttons),
    selects:    merge(parsed.selects,    inferred.selects),
    tables:     merge(parsed.tables,     inferred.tables),
    navItems:   merge(parsed.navItems,   inferred.navItems),
    modals:     merge(parsed.modals,     inferred.modals),
    fileInputs: merge(parsed.fileInputs, inferred.fileInputs),
    pagination: merge(parsed.pagination, inferred.pagination),
    tabs:       merge(parsed.tabs,       inferred.tabs),
    checkboxes: merge(parsed.checkboxes||[], inferred.checkboxes||[]),
    radios:     merge(parsed.radios||[],     inferred.radios||[]),
    headings:   parsed.headings || [],
    images:     parsed.images   || [],
    links:      parsed.links    || [],
    accordions: parsed.accordions || [],
  };
}

// ── Generate page-type specific tests ────────────────────────
function generatePageTypeTests(pageType, title, url, elements, tests, pageIdx, hasAuth, authCredentials) {
  switch(pageType) {
    case 'auth-login':
      generateAuthLoginTests(title, url, tests, hasAuth, authCredentials);
      break;
    case 'auth-signup':
      generateAuthSignupTests(title, url, tests);
      break;
    case 'auth-forgot':
      generateAuthForgotTests(title, url, tests);
      break;
    case 'dashboard':
      generateDashboardTests(title, url, tests);
      break;
    case 'profile':
      generateProfileTests(title, url, tests);
      break;
    case 'settings':
      generateSettingsTests(title, url, tests);
      break;
    case 'product-list':
      generateProductListTests(title, url, tests);
      break;
    case 'product-detail':
      generateProductDetailTests(title, url, tests);
      break;
    case 'cart':
      generateCartTests(title, url, tests);
      break;
    case 'checkout':
      generateCheckoutTests(title, url, tests);
      break;
    case 'search':
      generateSearchTests(title, url, tests);
      break;
    case 'contact':
      generateContactTests(title, url, tests);
      break;
    case 'pricing':
      generatePricingTests(title, url, tests);
      break;
    default:
      generateGenericPageTests(title, url, tests);
  }
}

// ── Auth Login Tests ──────────────────────────────────────────
function generateAuthLoginTests(title, url, tests, hasAuth, creds) {
  const scenarios = [
    ['Valid credentials',         creds?.username||'user@test.com', creds?.password||'Pass123!', 'Login successful | Redirect to dashboard | Token stored'],
    ['Invalid email',             'notanemail',                     'Pass123!',                  'Validation error: invalid email format'],
    ['Invalid password',          'user@test.com',                  'wrongpass',                 'Error: Invalid credentials | No redirect'],
    ['Empty email',               '',                               'Pass123!',                  'Required field error on email'],
    ['Empty password',            'user@test.com',                  '',                          'Required field error on password'],
    ['Both empty',                '',                               '',                           'Required errors on both fields'],
    ['SQL injection in email',    "' OR '1'='1",                   'Pass123!',                  'Input rejected | No SQL error exposed'],
    ['XSS in email',              '<script>alert(1)</script>',      'Pass123!',                  'Input sanitised | No XSS executed'],
    ['Very long email',           'a'.repeat(200) + '@test.com',   'Pass123!',                  'Validation error or truncation'],
    ['Case insensitive email',    'USER@TEST.COM',                  creds?.password||'Pass123!', 'Login treats email as case-insensitive'],
    ['Password with spaces',      'user@test.com',                  'Pass 123 !',                'Password with spaces handled correctly'],
    ['Brute force protection',    'user@test.com',                  'wrong',                     'Account locked or rate limited after 5 failures'],
    ['Remember me checked',       creds?.username||'user@test.com', creds?.password||'Pass123!', 'Session persists across browser restart'],
    ['Remember me unchecked',     creds?.username||'user@test.com', creds?.password||'Pass123!', 'Session expires when browser closes'],
    ['Enter key submission',      creds?.username||'user@test.com', creds?.password||'Pass123!', 'Form submits on Enter key press'],
    ['Paste into password',       creds?.username||'user@test.com', creds?.password||'Pass123!', 'Password can be pasted into field'],
    ['Show/hide password toggle', 'user@test.com',                  creds?.password||'Pass123!', 'Eye icon toggles password visibility'],
    ['Tab order',                 '',                               '',                           'Tab moves: Email → Password → Remember → Submit'],
    ['Auto-fill support',         '',                               '',                           'Browser auto-fill populates fields correctly'],
    ['Redirect after login',      creds?.username||'user@test.com', creds?.password||'Pass123!', 'Redirects to originally requested page'],
  ];

  scenarios.forEach(([name, email, pass, expected]) => {
    tests.ui.push(tc('UI-AUTH', `[${title}] Login — ${name}`, url,
      `Test login with: ${name}`,
      `Login form visible | Fields empty`,
      `1. Enter email: "${email}" | 2. Enter password: "${pass}" | 3. ${name.includes('Enter key') ? 'Press Enter' : 'Click Login'} | 4. Verify result`,
      expected, name.includes('Valid') || name.includes('SQL') || name.includes('XSS') ? 'Critical' : 'High'));
  });
}

// ── Auth Signup Tests ─────────────────────────────────────────
function generateAuthSignupTests(title, url, tests) {
  const scenarios = [
    ['All valid data',            'Test passes | Account created | Redirect to dashboard or verify email'],
    ['Duplicate email',           'Error: Email already registered | No duplicate account created'],
    ['Invalid email format',      'Validation error: Please enter a valid email'],
    ['Password too short (<8)',   'Validation error: Password must be at least 8 characters'],
    ['Password no uppercase',     'Validation error: Password must contain uppercase letter'],
    ['Password no number',        'Validation error: Password must contain a number'],
    ['Passwords do not match',    'Validation error: Passwords do not match'],
    ['All fields empty',          'Required errors on all required fields'],
    ['Terms not checked',         'Validation error: You must accept terms'],
    ['XSS in name field',         'Input sanitised | No script execution'],
    ['SQL injection in email',    'Input rejected | No database error'],
    ['Very long name (200 chars)','Validation error or truncation applied'],
    ['Emoji in name',             'Emoji handled correctly | Stored or rejected gracefully'],
    ['International email',       'International email formats accepted'],
    ['Weak password',             'Strength indicator shows weak | Warning shown'],
    ['Strong password',           'Strength indicator shows strong | Green state'],
    ['Already logged in',         'Redirect to dashboard | No duplicate session'],
    ['Social signup button',      'Redirects to OAuth provider | Callback handled'],
    ['Email verification',        'Verification email sent | Account inactive until verified'],
    ['Phone number optional',     'Form submits without phone | Phone validation when provided'],
  ];

  scenarios.forEach(([name, expected]) => {
    tests.ui.push(tc('UI-AUTH', `[${title}] Signup — ${name}`, url,
      `Signup scenario: ${name}`,
      `Signup form visible`,
      `1. Fill form for scenario: "${name}" | 2. Submit | 3. Verify: ${expected}`,
      expected, name.includes('valid') || name.includes('SQL') || name.includes('XSS') ? 'Critical' : 'High'));
  });
}

function generateAuthForgotTests(title, url, tests) {
  [
    ['Valid email',           'Reset email sent | Success message shown'],
    ['Unregistered email',    'Success message shown (don\'t reveal if email exists)'],
    ['Invalid email format',  'Validation error'],
    ['Empty email',           'Required field error'],
    ['SQL injection',         'Input rejected'],
    ['Rate limiting',         'Limited to 3-5 requests per hour'],
    ['Reset link expiry',     'Link expires in 1 hour'],
    ['One-time use link',     'Link invalid after first use'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-AUTH', `[${title}] Forgot Password — ${name}`, url, name, 'Form visible',
      `1. Enter email for: ${name} | 2. Submit | 3. Verify`, expected, 'High'));
  });
}

// ── Dashboard Tests ───────────────────────────────────────────
function generateDashboardTests(title, url, tests) {
  [
    ['Loads with user data',              'User name shown | Correct data displayed | No placeholder text'],
    ['Stats cards display correctly',     'All metrics visible | Numbers formatted | No NaN or undefined'],
    ['Charts render',                     'Chart visible | Data plotted | Legend shown | Interactive on hover'],
    ['Recent activity list',              'Latest items shown | Timestamps correct | Links to detail pages work'],
    ['Quick action buttons work',         'Each button triggers correct action | Loading states shown'],
    ['Date range filter works',           'Selecting range updates data | Charts refresh | Tables update'],
    ['Search/filter on tables',           'Search input filters results | No results state shown'],
    ['Sorting table columns',             'Click header sorts asc | Click again sorts desc | Icon updates'],
    ['Pagination on data tables',         'Next/prev work | Page numbers correct | Items per page selector'],
    ['Empty state when no data',          'Helpful empty state message | Create/add button shown'],
    ['Refresh data button',               'Clicking refresh fetches latest | Loading spinner shown'],
    ['Export data',                       'Export triggers download | Correct format | All data included'],
    ['Notifications badge',               'Badge count correct | Clicking opens notification list'],
    ['User menu dropdown',                'Clicking avatar opens menu | Profile/Logout links work'],
    ['Sidebar navigation',                'All menu items clickable | Active state shown | Collapsed on mobile'],
    ['Breadcrumbs',                       'Path is correct | Clicking navigates correctly'],
    ['Logout from dashboard',             'Redirects to login | Session cleared | Token removed'],
    ['Inactivity timeout',                'Session expires after inactivity | Redirect to login with message'],
    ['Multiple browser tabs',             'Changes in one tab reflect in another | No conflicts'],
    ['Deep link to dashboard section',    'URL with hash or param loads correct section'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-DASH', `[${title}] Dashboard — ${name}`, url, name, 'Logged in | Dashboard loaded',
      `1. Verify: ${name} | Steps specific to scenario`, expected, 'High'));
  });
}

// ── Profile Tests ─────────────────────────────────────────────
function generateProfileTests(title, url, tests) {
  [
    ['View own profile',              'All user data displayed correctly'],
    ['Edit name — valid',             'Name saved | Success toast shown'],
    ['Edit email — valid',            'Verification sent to new email | Not updated until verified'],
    ['Edit phone — valid format',     'Phone saved | Formatted correctly'],
    ['Edit phone — invalid format',   'Validation error shown'],
    ['Upload avatar — valid image',   'Image uploaded | Preview shown | Saved'],
    ['Upload avatar — wrong type',    'Error: Only JPG/PNG/GIF accepted'],
    ['Upload avatar — too large',     'Error: File must be under 2MB'],
    ['Remove avatar',                 'Default avatar shown | Change saved'],
    ['Change password — valid',       'Password updated | Re-login required or session refreshed'],
    ['Change password — wrong current', 'Error: Current password incorrect'],
    ['Change password — mismatch',    'Error: Passwords do not match'],
    ['Bio — max length (500 chars)',  'Accepts 500 chars | Rejects 501+ | Counter shown'],
    ['Website URL — valid',           'URL saved | Validated as valid URL'],
    ['Website URL — invalid',         'Validation error: Enter a valid URL'],
    ['Cancel edit',                   'Changes discarded | Original data restored'],
    ['Save with no changes',          'No unnecessary API calls | UI unchanged'],
    ['Delete account',                'Confirmation dialog | Account deleted | Redirect to home'],
    ['Two-factor authentication tab', '2FA setup flow works | QR code shown'],
    ['API key generation',            'New key generated | Old key invalidated | Key copiable'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-PROFILE', `[${title}] Profile — ${name}`, url, name, 'Logged in | On profile page',
      `1. Perform: ${name} | 2. Verify: ${expected}`, expected, name.includes('Delete') ? 'Critical' : 'High'));
  });
}

// ── Settings Tests ────────────────────────────────────────────
function generateSettingsTests(title, url, tests) {
  [
    ['Language change',                'Page reloads in selected language | Persists on refresh'],
    ['Timezone change',                'Times shown in new timezone | Saved to profile'],
    ['Email notifications toggle',     'Toggle saves | Emails sent/not-sent based on setting'],
    ['SMS notifications toggle',       'Toggle saves | SMS behaviour changes'],
    ['Marketing emails toggle',        'Can opt out | Complies with GDPR/CAN-SPAM'],
    ['Theme change (dark/light)',      'Theme applied immediately | Persists across sessions'],
    ['Currency change',                'Prices shown in selected currency | Rates correct'],
    ['Privacy settings',               'Data sharing toggles work | GDPR compliance'],
    ['Connected accounts',             'OAuth accounts shown | Can disconnect | Can reconnect'],
    ['API keys management',            'Keys listed | Revoke works | Create new key works'],
    ['Billing info update',            'Card updated | Receipt sent | Old card removed'],
    ['Plan upgrade/downgrade',         'Correct plan selected | Payment processed | Features change'],
    ['Delete data request',            'GDPR right to erasure | Confirmation required | Processed in 30 days'],
    ['Export data',                    'Data export triggered | Email sent with download link'],
    ['Tab: General settings',          'General settings tab loads and saves'],
    ['Tab: Security settings',         'Security tab shows 2FA, sessions, password'],
    ['Tab: Notification settings',     'Notification preferences all present and saveable'],
    ['Tab: Billing settings',          'Billing tab shows plan, invoices, payment method'],
    ['Active sessions list',           'All sessions shown | Can revoke other sessions'],
    ['Session revoke',                 'Other session invalidated | That device logged out'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-SETTINGS', `[${title}] Settings — ${name}`, url, name, 'Logged in | Settings page',
      `1. ${name} | 2. Verify: ${expected}`, expected, 'High'));
  });
}

// ── Product List Tests ────────────────────────────────────────
function generateProductListTests(title, url, tests) {
  [
    ['Products load on page visit',          'Products visible | Images load | Names/prices shown'],
    ['Sort by price — low to high',          'Products sorted ascending by price'],
    ['Sort by price — high to low',          'Products sorted descending by price'],
    ['Sort by newest',                       'Most recent products shown first'],
    ['Sort by popularity',                   'Most popular products shown first'],
    ['Filter by category',                   'Only selected category shown | Count updates'],
    ['Filter by price range',                'Only products within range shown'],
    ['Filter by rating',                     'Only products with selected rating shown'],
    ['Multiple filters combined',            'All filters applied together | Correct results'],
    ['Clear all filters',                    'All products shown | Filter UI reset'],
    ['Search within products',               'Relevant products shown | Highlights search term'],
    ['Search — no results',                  'Empty state shown | "No products found" message'],
    ['Pagination — next page',               'Page 2 loads | Different products shown | URL updates'],
    ['Pagination — previous page',           'Page 1 reloads | Same products as initially'],
    ['Pagination — jump to specific page',   'Correct page loads | Items correct'],
    ['Items per page selector',              'Changing to 24/48 shows correct count'],
    ['Grid/list view toggle',                'View changes | Products reflow | Preference saved'],
    ['Add to cart from listing',             'Item added | Cart count increments | Confirmation shown'],
    ['Add to wishlist',                      'Item saved to wishlist | Icon state changes'],
    ['Product card hover',                   'Hover shows quick actions | Quick view option'],
    ['Out of stock products',                'Marked as out of stock | Add to cart disabled'],
    ['Sale/discount badge',                  'Discounted price shown | Original price struck through'],
    ['Rating stars display',                 'Stars match rating | Correct out of 5'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-PRODUCTS', `[${title}] Products — ${name}`, url, name, 'Products page loaded',
      `1. ${name} | 2. Verify: ${expected}`, expected, 'High'));
  });
}

// ── Product Detail Tests ──────────────────────────────────────
function generateProductDetailTests(title, url, tests) {
  [
    ['Product images load',              'Main image visible | Thumbnails shown | No broken images'],
    ['Image zoom on hover',              'Zoomed view appears | Shows detail'],
    ['Image gallery navigation',        'Prev/next arrows work | Thumbnails clickable'],
    ['Product name and price visible',  'Name prominent | Price correct | Currency shown'],
    ['Size selection',                  'All sizes shown | Selecting updates price if applicable'],
    ['Colour selection',                'All colours shown | Selecting updates main image'],
    ['Quantity selector',               'Can increase/decrease | Min 1 enforced | Max stock enforced'],
    ['Add to cart — valid selection',   'Added to cart | Cart count increments | Success message'],
    ['Add to cart — no size selected',  'Error: Please select a size | Not added to cart'],
    ['Buy now button',                  'Proceeds to checkout with this item | Cart not persisted'],
    ['Add to wishlist',                 'Saved | Icon filled | Can be removed'],
    ['Share product',                   'Share options shown | Correct URL copied'],
    ['Product description tab',         'Full description shown | Formatted correctly'],
    ['Reviews tab',                     'Reviews listed | Average rating shown | Pagination works'],
    ['Write review',                    'Review form opens | Star rating required | Text required'],
    ['Q&A tab',                         'Questions shown | Can ask question | Answers shown'],
    ['Related products',                'Similar products shown | Links work | Images load'],
    ['Breadcrumb navigation',           'Path shown | Clicking navigates correctly'],
    ['Stock indicator',                 'In stock / low stock / out of stock shown correctly'],
    ['Shipping information',            'Delivery estimate shown | Shipping cost shown'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-PRODUCT', `[${title}] Product — ${name}`, url, name, 'Product detail page loaded',
      `1. ${name} | 2. Verify: ${expected}`, expected, 'High'));
  });
}

// ── Cart Tests ────────────────────────────────────────────────
function generateCartTests(title, url, tests) {
  [
    ['Empty cart state',              '"Your cart is empty" message | Continue shopping button'],
    ['Item displays correctly',       'Name, price, image, quantity shown'],
    ['Update quantity — increase',    'Quantity increases | Subtotal updates | Total updates'],
    ['Update quantity — decrease',    'Quantity decreases | Cannot go below 1'],
    ['Remove item',                   'Item removed | Total recalculated | Empty state if last item'],
    ['Apply valid coupon',            'Discount applied | Coupon shown | Total reduced'],
    ['Apply invalid coupon',          'Error: Invalid coupon code | Total unchanged'],
    ['Apply expired coupon',          'Error: Coupon expired | Total unchanged'],
    ['Remove coupon',                 'Coupon removed | Original total restored'],
    ['Subtotal calculation',          'Sum of items matches subtotal'],
    ['Tax calculation',               'Tax percentage applied correctly | Amount shown'],
    ['Shipping calculation',          'Shipping cost shown | Free shipping threshold applied'],
    ['Total calculation',             'Subtotal + tax + shipping = total'],
    ['Proceed to checkout',           'Navigates to checkout | Cart items passed'],
    ['Save cart for later',           'Items saved | Available on next login'],
    ['Cart persists on refresh',      'Items still in cart after page refresh'],
    ['Cart syncs across devices',     'Adding on mobile shows on desktop (if logged in)'],
    ['Out of stock item in cart',     'Warning shown | Cannot proceed | Remove prompted'],
    ['Quantity exceeds stock',        'Quantity capped at available stock | Warning shown'],
    ['Continue shopping link',        'Returns to products page | Cart preserved'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-CART', `[${title}] Cart — ${name}`, url, name, 'Cart page | Items in cart',
      `1. ${name} | 2. Verify: ${expected}`, expected, name.includes('calculation') ? 'Critical' : 'High'));
  });
}

// ── Checkout Tests ────────────────────────────────────────────
function generateCheckoutTests(title, url, tests) {
  [
    ['Valid complete order',                'Order placed | Confirmation email | Order number shown'],
    ['Missing required shipping field',     'Validation error on missing field | Cannot proceed'],
    ['Invalid card number',                 'Error: Invalid card number | Not charged'],
    ['Expired card',                        'Error: Card expired | Not charged'],
    ['Insufficient funds',                  'Error: Payment declined | Not charged'],
    ['CVV mismatch',                        'Error: Invalid security code | Not charged'],
    ['Billing address validation',          'Zip/postcode validated | Country required'],
    ['Guest checkout',                      'Can checkout without account | Email required'],
    ['Logged in checkout',                  'Address pre-filled | Saved cards shown'],
    ['Address saved for future',           '"Save this address" checkbox works'],
    ['Order summary visible',              'Items, quantities, prices correct'],
    ['Back to cart',                       'Returns to cart | No data lost'],
    ['Order confirmation page',            'Order number shown | Details correct | Email sent'],
    ['Payment loading state',             'Button shows loading | Cannot double-submit'],
    ['3D Secure flow',                    'Redirect to bank | Return to site | Order confirmed'],
    ['PayPal payment',                    'Redirect to PayPal | Return | Order confirmed'],
    ['Promo code applied at checkout',    'Discount visible in order summary'],
    ['Tax exemption',                     'Tax removed for exempt users/regions'],
    ['International shipping',            'Country selection updates shipping options and cost'],
    ['Order placed while logged out',     'Guest order tracked by email | No account required'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-CHECKOUT', `[${title}] Checkout — ${name}`, url, name, 'Checkout page | Items in cart',
      `1. ${name} | 2. Verify: ${expected}`, expected, name.includes('Valid') || name.includes('Invalid') ? 'Critical' : 'High'));
  });
}

// ── Search Tests ──────────────────────────────────────────────
function generateSearchTests(title, url, tests) {
  [
    ['Search valid keyword',          'Relevant results shown | Keyword highlighted'],
    ['Search empty string',           'All results shown or error message'],
    ['Search no results',             '"No results found" message | Suggestions shown'],
    ['Search special characters',     'Handled gracefully | No errors | Escaped correctly'],
    ['Search SQL injection',          'Input sanitised | No DB error'],
    ['Search XSS',                    'Input escaped | No script execution'],
    ['Search autocomplete',           'Suggestions appear as you type | Relevant options'],
    ['Search history',                'Recent searches shown | Can clear history'],
    ['Filter by category',            'Results filtered to category | Count updates'],
    ['Sort results',                  'Sorting changes order | Correct sort applied'],
    ['Pagination of results',         'Multiple pages navigate correctly'],
    ['Search URL shareable',          'URL contains search query | Can be shared'],
    ['Back button preserves search',  'Back returns to same results | Query preserved'],
    ['Clear search',                  'X button clears input | Results reset'],
    ['Search on Enter key',           'Pressing Enter submits search'],
    ['Advanced search filters',       'Additional filters refine results'],
    ['Search result click tracking',  'Clicking result navigates to correct page'],
    ['Typo tolerance',                'Slight typos return relevant results'],
    ['Plural/singular handling',      '"phones" and "phone" return same results'],
    ['Numeric search',                'Searching numbers returns relevant results'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-SEARCH', `[${title}] Search — ${name}`, url, name, 'Search page loaded',
      `1. ${name} | 2. Verify: ${expected}`, expected, name.includes('SQL') || name.includes('XSS') ? 'Critical' : 'High'));
  });
}

// ── Contact Tests ─────────────────────────────────────────────
function generateContactTests(title, url, tests) {
  [
    ['Valid message sent',            'Success message shown | Email received | Auto-reply sent'],
    ['Name too short',                'Validation error: Name must be at least 3 characters'],
    ['Invalid email',                 'Validation error: Enter a valid email address'],
    ['Message too short',             'Validation error: Message must be at least 20 characters'],
    ['All fields empty',              'Required errors on all required fields'],
    ['XSS in message',                'Input sanitised | No script execution'],
    ['HTML in message',               'HTML tags escaped | Not rendered as HTML'],
    ['Very long message',             'Accepted up to limit | Counter shown | Truncated if needed'],
    ['Spam submission (too fast)',    'Rate limited | CAPTCHA triggered | Error shown'],
    ['File attachment (if supported)', 'File attached | Size limit enforced | Type validated'],
    ['Department selection',          'Correct department receives email'],
    ['Phone number optional',         'Submits without phone | Validation when provided'],
    ['Double submission prevention',  'Submit button disabled after click | No duplicate emails'],
    ['Terms/privacy checkbox',        'Required if present | Form blocked without check'],
    ['Auto-reply received',           'User receives confirmation email within 1 minute'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-CONTACT', `[${title}] Contact — ${name}`, url, name, 'Contact form visible',
      `1. ${name} | 2. Verify: ${expected}`, expected, name.includes('XSS') || name.includes('SQL') ? 'Critical' : 'High'));
  });
}

// ── Pricing Tests ─────────────────────────────────────────────
function generatePricingTests(title, url, tests) {
  [
    ['All plans displayed',           'Free, Pro, Enterprise plans visible | Prices shown'],
    ['Monthly/annual toggle',         'Prices update when switching | Savings shown'],
    ['Feature comparison visible',    'Features listed per plan | Checkmarks/crosses correct'],
    ['CTA button per plan',           'Each plan has a button | Links to correct signup'],
    ['Current plan highlighted',      'If logged in, current plan marked'],
    ['FAQ section',                   'FAQ items expand/collapse | Content helpful'],
    ['Contact sales for enterprise',  'Enterprise CTA opens contact form or modal'],
    ['Free plan limitations clear',   'Limits clearly stated | Not misleading'],
    ['Upgrade from free',             'Upgrade flow accessible | Correct plan pre-selected'],
    ['Trial period shown',            'Trial duration clear | No credit card note'],
    ['Money back guarantee',          'Guarantee terms shown | Visible and clear'],
    ['Currency selector',             'Prices shown in user\'s currency | Correct conversion'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-PRICING', `[${title}] Pricing — ${name}`, url, name, 'Pricing page loaded',
      `1. Verify: ${name} | Steps: ${name}`, expected, 'High'));
  });
}

// ── Generic Page Tests ────────────────────────────────────────
function generateGenericPageTests(title, url, tests) {
  [
    ['Content loads completely',      'All text visible | No placeholder content | No lorem ipsum'],
    ['Images load correctly',         'All images visible | No broken image icons'],
    ['Links are functional',          'All links lead to correct pages | No 404s'],
    ['CTAs are prominent',            'Call-to-action buttons visible | Above fold | Clear text'],
    ['Page scroll works',             'Page scrolls smoothly | Sticky elements stay in place'],
    ['Back button works',             'Browser back navigates correctly | No infinite loops'],
    ['Print layout',                  'Print CSS applied | Content readable when printed'],
    ['Footer links work',             'All footer links navigate correctly | No 404s'],
    ['Social media links',            'Social links open correct profiles in new tab'],
    ['Cookie consent',                'Cookie banner shown | Accept/Decline works | Preference saved'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-GEN', `[${title}] ${name}`, url, name, 'Page loaded',
      `1. ${name} | 2. Verify: ${expected}`, expected, 'Medium'));
  });
}

// ── Form Tests (for any form found/inferred) ──────────────────
function generateFormTests(form, fi, title, url, tests) {
  const label = form.id || `Form ${fi+1}`;

  tests.ui.push(tc('UI-FORM', `[${title}] ${label} — Renders with all fields`, url,
    `${label} visible with all ${form.fields.length} fields`,
    `On ${url} | Form visible`,
    `1. Navigate to ${url} | 2. Locate ${label} | 3. Count fields | 4. Verify ${form.fields.length} fields | 5. Check labels | 6. Check submit button`,
    `All ${form.fields.length} fields visible | Labels present | Submit button enabled | Tab order logical`,
    'Critical'));

  form.fields.forEach((field, fIdx) => {
    const valid   = getSampleValid(field.type, field.name);
    const invalid = getSampleInvalid(field.type);

    if (field.required) {
      tests.ui.push(tc('UI-FIELD', `[${title}] ${label} → "${field.name}" — Required validation`, url,
        `"${field.name}" shows error when empty`,
        `${label} loaded`,
        `1. Leave "${field.name}" empty | 2. Fill all other required fields | 3. Submit | 4. Verify error | 5. Enter "${valid}" | 6. Verify accepted`,
        `Error shown when empty | Accepted with valid value: "${valid}"`,
        'Critical'));
    }

    tests.ui.push(tc('UI-FIELD', `[${title}] ${label} → "${field.name}" — Valid input (${field.type})`, url,
      `"${field.name}" accepts valid ${field.type} input`,
      `${label} loaded`,
      `1. Click "${field.name}" | 2. Enter "${valid}" | 3. Tab away | 4. Verify no error | 5. Verify value retained`,
      `"${valid}" accepted | No validation error | Value retained`,
      field.required ? 'High' : 'Medium'));

    if (invalid) {
      tests.ui.push(tc('UI-FIELD', `[${title}] ${label} → "${field.name}" — Invalid input`, url,
        `"${field.name}" rejects invalid input`,
        `${label} loaded`,
        `1. Enter "${invalid}" in "${field.name}" | 2. Tab away or submit | 3. Verify error shown`,
        `Validation error shown | Helpful message | Field highlighted`,
        'High'));
    }

    tests.security.push(tc('SEC-FIELD', `[${title}] ${label} → "${field.name}" — XSS injection`, url,
      `XSS prevention in "${field.name}"`,
      `${label} loaded`,
      `1. Enter <script>alert('xss-${field.name}')</script> | 2. Submit | 3. Verify no alert | 4. Try <img src=x onerror=alert(1)>`,
      `No JavaScript executes | Input escaped or rejected | HTTP 400 or sanitised`,
      'Critical'));
  });

  tests.ui.push(tc('UI-SUBMIT', `[${title}] ${label} — Valid full submission`, url,
    `${label} submits successfully with all valid data`,
    `${label} loaded | All fields empty`,
    form.fields.map((f,i) => `${i+1}. Enter ${getSampleValid(f.type,f.name)} in "${f.name}"`).concat([`${form.fields.length+1}. Click submit | ${form.fields.length+2}. Verify success`]).join(' | '),
    `Form submits | Success response | No errors | Redirect or success message`,
    'Critical'));

  tests.ui.push(tc('UI-SUBMIT', `[${title}] ${label} — Empty submission blocked`, url,
    `${label} blocks submission with empty required fields`,
    `${label} loaded | Fields empty`,
    `1. Click submit without filling anything | 2. Count errors | 3. Verify form not submitted`,
    `${form.fields.filter(f=>f.required).length} validation errors shown | Form not submitted | Focus on first error`,
    'Critical'));

  tests.security.push(tc('SEC-FORM', `[${title}] ${label} — SQL injection`, url,
    `SQL injection prevention in ${label}`,
    `${label} loaded`,
    `1. Enter ' OR '1'='1 in text fields | 2. Submit | 3. Verify no SQL error | 4. Try '; DROP TABLE users-- | 5. Verify safe`,
    `SQL errors not exposed | Input sanitised | Status 400 or normal response`,
    'Critical'));
}

// ── Button Tests ──────────────────────────────────────────────
function generateButtonTests(btn, title, url, tests) {
  tests.ui.push(tc('UI-BTN', `[${title}] Button: "${btn.text}" — Click`, url,
    `"${btn.text}" triggers expected action`,
    `On ${url} | Button visible`,
    `1. Locate "${btn.text}" button | 2. Verify ${btn.disabled ? 'disabled state' : 'enabled'} | 3. ${btn.disabled ? 'Verify no action on click' : 'Click button'} | 4. Verify result | 5. Test Enter/Space keyboard`,
    `Button ${btn.disabled ? 'disabled and non-interactive' : 'triggers correct action'} | No errors | Keyboard accessible`,
    /delete|remove|cancel|clear/i.test(btn.text) ? 'Critical' : 'High'));

  tests.ui.push(tc('UI-BTN', `[${title}] Button: "${btn.text}" — Loading state`, url,
    `"${btn.text}" shows loading state on async action`,
    `Button visible`,
    `1. Click "${btn.text}" | 2. Verify loading indicator appears | 3. Verify button disabled during loading | 4. Verify loading disappears on completion`,
    `Loading state shown | Button disabled during load | Cannot double-click | Completion state correct`,
    'Medium'));

  if (/delete|remove/i.test(btn.text)) {
    tests.ui.push(tc('UI-BTN', `[${title}] Button: "${btn.text}" — Confirmation dialog`, url,
      `Destructive action requires confirmation`,
      `Data exists to delete`,
      `1. Click "${btn.text}" | 2. Verify confirmation dialog | 3. Click Cancel | 4. Verify NOT deleted | 5. Click "${btn.text}" again | 6. Confirm | 7. Verify deleted`,
      `Confirmation required | Cancel prevents action | Confirm executes | Undo available if applicable`,
      'Critical'));
  }
}

// ── Select Tests ──────────────────────────────────────────────
function generateSelectTests(sel, title, url, tests) {
  tests.ui.push(tc('UI-SEL', `[${title}] Dropdown: "${sel.name}" — All options`, url,
    `"${sel.name}" shows all ${sel.options.length} options`,
    `On ${url}`,
    `1. Click "${sel.name}" | 2. Verify opens | 3. Count options (expect ${sel.options.length}) | 4. Verify options: ${sel.options.slice(0,4).join(', ')} | 5. Select each | 6. Verify selection persists`,
    `${sel.options.length} options shown | Each selectable | Selection persists | Keyboard navigable`,
    sel.required ? 'Critical' : 'High'));

  sel.options.slice(0, 6).forEach(opt => {
    tests.ui.push(tc('UI-SEL', `[${title}] Dropdown: "${sel.name}" → Select "${opt}"`, url,
      `Selecting "${opt}" from "${sel.name}" works correctly`,
      `Dropdown visible`,
      `1. Open "${sel.name}" | 2. Select "${opt}" | 3. Verify "${opt}" shown as selected | 4. Verify any dependent UI updates`,
      `"${opt}" selected | Displayed in field | Dependent fields update if applicable`,
      'High'));
  });

  if (sel.required) {
    tests.ui.push(tc('UI-SEL', `[${title}] Dropdown: "${sel.name}" — Required validation`, url,
      `"${sel.name}" shows error when not selected`,
      `Form with dropdown`,
      `1. Leave "${sel.name}" on default/empty | 2. Submit form | 3. Verify error`,
      `Required error shown | Form not submitted`,
      'Critical'));
  }
}

// ── Table Tests ───────────────────────────────────────────────
function generateTableTests(tbl, title, url, tests) {
  tests.ui.push(tc('UI-TABLE', `[${title}] Table "${tbl.id}" — Data displays`, url,
    `Table shows correct data with all columns`,
    `On ${url} | Data exists`,
    `1. Locate table | 2. Verify headers: ${tbl.headers.slice(0,4).join(', ')} | 3. Verify data rows | 4. Verify data format in cells`,
    `Headers visible | Data rows present | Cells formatted correctly | No empty required cells`,
    'High'));

  if (tbl.headers.length > 0) {
    tbl.headers.slice(0,5).forEach(h => {
      tests.ui.push(tc('UI-TABLE', `[${title}] Table "${tbl.id}" — Sort by "${h}"`, url,
        `Clicking "${h}" header sorts table`,
        `Table visible with data`,
        `1. Click "${h}" header | 2. Verify ascending sort | 3. Click again | 4. Verify descending | 5. Verify sort indicator`,
        `Data sorted by ${h} | Toggle asc/desc | Arrow indicator shown`,
        'Medium'));
    });
  }

  tests.ui.push(tc('UI-TABLE', `[${title}] Table "${tbl.id}" — Responsive`, url,
    `Table scrolls horizontally on mobile`,
    `Viewport 375px`,
    `1. Set viewport 375px | 2. View table | 3. Verify horizontal scroll | 4. Verify columns not hidden unintentionally`,
    `Horizontal scroll appears | All data accessible | Headers remain visible`,
    'High'));

  tests.ui.push(tc('UI-TABLE', `[${title}] Table "${tbl.id}" — Empty state`, url,
    `Table shows empty state when no data`,
    `No data in table`,
    `1. Remove/filter all data | 2. Verify empty state message | 3. Verify add/create button shown`,
    `"No data" message shown | Helpful empty state | Action to add data`,
    'Medium'));
}

// ── Navigation Tests ──────────────────────────────────────────
function generateNavTests(links, title, url, tests) {
  tests.ui.push(tc('UI-NAV', `[${title}] Navigation — All ${links.length} links work`, url,
    `All navigation links functional`,
    `Navigation visible`,
    links.slice(0,10).map((l,i) => `${i+1}. Click "${l.text}" → verify page loads`).join(' | '),
    `All ${links.length} links functional | Correct pages load | No 404s | Active state shown`,
    'Critical'));

  links.slice(0,12).forEach(link => {
    tests.ui.push(tc('UI-NAVLINK', `[${title}] Nav: "${link.text}"`, url,
      `"${link.text}" navigates correctly`,
      `Nav visible`,
      `1. Locate "${link.text}" | 2. Verify visible | 3. Click | 4. Verify URL | 5. Verify content matches`,
      `Navigates to ${link.href} | Correct content | Active state`,
      'High'));
  });

  tests.ui.push(tc('UI-NAV', `[${title}] Mobile Menu — Open/Close`, url,
    `Hamburger menu opens and closes`,
    `Mobile viewport 375px`,
    `1. Set 375px viewport | 2. Locate hamburger | 3. Click | 4. Verify menu opens | 5. Click link | 6. Verify closes | 7. Press Escape | 8. Verify closes`,
    `Menu opens/closes | Links work | Escape closes | Focus trapped | Scroll locked`,
    'High'));
}

// ── Modal Tests ───────────────────────────────────────────────
function generateModalTests(index, title, url, tests) {
  ['Open and close (X button)', 'Close via Escape key', 'Close via backdrop click',
   'Focus trap inside modal', 'Keyboard navigation', 'Scroll lock on body'].forEach(scenario => {
    tests.ui.push(tc('UI-MODAL', `[${title}] Modal ${index} — ${scenario}`, url,
      `Modal ${index}: ${scenario}`,
      `Modal trigger accessible`,
      `1. Open modal ${index} | 2. Test: ${scenario} | 3. Verify behaviour`,
      `Modal ${scenario} works correctly | Accessible | No page behind accessible`,
      'High'));
  });
}

// ── File Input Tests ──────────────────────────────────────────
function generateFileInputTests(fi, title, url, tests) {
  [
    ['Valid file type',    `Upload ${fi.accept || 'valid'} file | Success`,             'File accepted | Preview shown | Name displayed'],
    ['Invalid file type',  'Upload .exe file',                                          'Error: Invalid file type | Not uploaded'],
    ['File too large',     'Upload 20MB file',                                          'Error: File too large | Size limit shown'],
    ['Empty submission',   'Submit without file if required',                           fi.required ? 'Required error shown' : 'Form submits without file'],
    ['Multiple files',     fi.multiple ? 'Select 3 files' : 'Select 2 files at once',  fi.multiple ? 'All files accepted' : 'Only first file used'],
    ['Drag and drop',      'Drag file onto drop zone',                                  'File accepted | Drop zone highlights on drag over'],
  ].forEach(([name, steps, expected]) => {
    tests.ui.push(tc('UI-FILE', `[${title}] Upload "${fi.name}" — ${name}`, url,
      `File upload "${fi.name}": ${name}`,
      `File input visible`,
      `1. ${steps} | 2. Verify: ${expected}`,
      expected, 'High'));
  });
}

// ── Pagination Tests ──────────────────────────────────────────
function generatePaginationTests(pg, title, url, tests) {
  [
    ['First page active on load',   'Page 1 highlighted | Prev button disabled'],
    ['Next page loads',             'Page 2 loads | Different content | URL updates'],
    ['Prev page from page 2',       'Returns to page 1 | Same content'],
    ['Jump to last page',           `Page ${pg.maxPage} loads | Next disabled`],
    ['Page number buttons',         'Clicking page 3 loads page 3 | Correct items'],
    ['Items per page selector',     'Changing to 24/48/96 updates count'],
    ['URL updates per page',        'URL has ?page=X | Shareable | Back works'],
    ['Scroll to top on page change','Page scrolls to top after navigation'],
  ].forEach(([name, expected]) => {
    tests.ui.push(tc('UI-PAGE', `[${title}] Pagination — ${name}`, url,
      `Pagination: ${name}`,
      `Multiple pages of data`,
      `1. ${name} | 2. Verify: ${expected}`,
      expected, 'High'));
  });
}

// ── Tab Tests ─────────────────────────────────────────────────
function generateTabTests(tab, title, url, tests) {
  [`Tab 1 active on load`, `Click each tab shows content`, `Keyboard: Arrow keys navigate`,
   `Tab content lazy-loads`, `Active tab highlighted`, `URL updates on tab change`].forEach(scenario => {
    tests.ui.push(tc('UI-TAB', `[${title}] Tabs (${tab.count}) — ${scenario}`, url,
      `Tab component: ${scenario}`,
      `Tab component visible`,
      `1. ${scenario} | 2. Verify behaviour`,
      `${scenario} works correctly`,
      'High'));
  });
}

// ── Input standalone tests ────────────────────────────────────
function generateInputTests(inp, title, url, tests) {
  const valid = getSampleValid(inp.type, inp.name);
  tests.ui.push(tc('UI-INPUT', `[${title}] Input "${inp.name}" (${inp.type}) — Valid`, url,
    `Input "${inp.name}" accepts valid ${inp.type}`,
    `Input visible`,
    `1. Click "${inp.name}" | 2. Enter "${valid}" | 3. Tab away | 4. Verify accepted`,
    `Accepts "${valid}" | No error`,
    'Medium'));
}

// ─────────────────────────────────────────────────────────────
// GLOBAL TEST SETS
// ─────────────────────────────────────────────────────────────

function generateCrossPageTests(pages) {
  if (pages.length < 2) return [];
  const tests = [];
  tests.push(tc('UI-FLOW', `E2E — Navigate all ${pages.length} pages`, pages[0].url,
    `Full site navigation across all ${pages.length} pages`,
    `App accessible`,
    pages.slice(0,10).map((p,i) => `${i+1}. Visit "${p.title}" (${p.url})`).join(' | '),
    `All pages accessible | No dead ends | Session persists`, 'Critical'));

  tests.push(tc('UI-FLOW', `E2E — Session persists across ${pages.length} pages`, pages[0].url,
    `User session persists navigating all pages`,
    `User logged in`,
    `1. Login | 2. Navigate all pages | 3. Verify still logged in on each | 4. Hard refresh on page 5 | 5. Verify session preserved`,
    `Session persists | Token valid | User data consistent`, 'Critical'));

  tests.push(tc('UI-FLOW', `Browser Back/Forward — ${pages.length} pages`, pages[0].url,
    `Browser history works across all pages`,
    `Browser history enabled`,
    `1. Visit pages in order | 2. Press Back 5 times | 3. Press Forward 5 times | 4. Verify correct pages`,
    `Back/forward navigate correctly | URL updates | Content correct`, 'High'));

  tests.push(tc('UI-FLOW', `Deep Link — All pages directly accessible`, pages[0].url,
    `Every page URL is directly accessible`,
    `SPA routing configured`,
    pages.map((p,i) => `${i+1}. Navigate directly to ${p.url}`).join(' | '),
    `All ${pages.length} pages load when accessed directly | No 404 | No blank page`, 'Critical'));

  return tests;
}

function generateGlobalSecurityTests(pages) {
  const origin = pages[0] ? new URL(pages[0].url).origin : '';
  return [
    ['HTTPS Redirect',             `Visit ${origin.replace('https','http')} | Verify 301 to HTTPS | HSTS header present`],
    ['X-Frame-Options',            `Check X-Frame-Options header | DENY or SAMEORIGIN | Clickjacking blocked`],
    ['X-Content-Type-Options',     `Check header: X-Content-Type-Options: nosniff | Present on all responses`],
    ['Content Security Policy',    `Check CSP header | Restrictive policy | No unsafe-inline scripts`],
    ['HSTS Header',                `Check Strict-Transport-Security | max-age ≥ 31536000 | includeSubDomains`],
    ['Cookie Security',            `Inspect cookies | Secure flag | HttpOnly flag | SameSite=Strict`],
    ['CORS Configuration',         `Cross-origin request to API | Correct origins allowed | Credentials restricted`],
    ['Rate Limiting — Login',      `Send 20 rapid login requests | Verify 429 response | Lockout period`],
    ['Rate Limiting — API',        `Send 100 rapid API requests | Verify rate limit applied`],
    ['SQL Injection — URL Params', `Try ${origin}?id=' OR '1'='1 | Verify safe response`],
    ['Path Traversal',             `Try ${origin}/../../etc/passwd | Verify 400/403`],
    ['Open Redirect',              `Try ${origin}/login?redirect=https://evil.com | Blocked`],
    ['Verbose Errors',             `Trigger 500 error | Verify no stack trace | Generic message`],
    ['JWT Algorithm',              `Inspect JWT | Algorithm is RS256 or HS256 | Not "none"`],
    ['Password Brute Force',       `5 failed logins | Account locked or CAPTCHA triggered`],
    ['Session Fixation',           `Session ID changes after login | Old session invalid`],
    ['CSRF Tokens',                `All state-changing forms have CSRF token | Token validated`],
    ['Sensitive Data in Logs',     `Check server logs | No passwords | No tokens | No PII`],
    ['Dependency Vulnerabilities', `Run npm audit | 0 critical CVEs | Patch high severity`],
    ['File Upload Security',       `Upload PHP/EXE file | Rejected | MIME type validated`],
  ].map(([name, steps]) =>
    tc('SEC-GLOBAL', name, origin, `Security: ${name}`, 'App accessible', steps,
       `${name} security check passes`, 'Critical'));
}

function generateGlobalPerfTests(pages) {
  return [
    ['Homepage LCP < 2.5s',              1,  'LCP < 2.5s'],
    ['Homepage FID < 100ms',             1,  'FID < 100ms'],
    ['Homepage CLS < 0.1',               1,  'CLS < 0.1'],
    ['TTFB < 600ms',                     1,  'TTFB < 600ms'],
    ['Lighthouse Performance ≥80',       1,  'Score ≥ 80'],
    ['10 concurrent users',              10, 'Avg response < 3s'],
    ['50 concurrent users',              50, 'Avg response < 5s'],
    ['100 concurrent users',            100, 'Avg response < 8s'],
    ['500 concurrent users (stress)',   500, 'No crash | Graceful degradation'],
    ['API GET < 200ms',                   1, 'Response < 200ms'],
    ['API POST < 500ms',                  1, 'Response < 500ms'],
    ['DB query < 100ms',                  1, 'Query < 100ms'],
    ['JS bundle < 500KB',                 1, 'Bundle gzipped < 500KB'],
    ['CSS < 100KB',                       1, 'CSS gzipped < 100KB'],
    ['Images WebP/AVIF format',           1, 'Modern image format used'],
    ['Static assets cached',              1, 'Cache-Control: immutable on /static/'],
    ['Memory leak — 1 hour session',      5, 'Memory < 512MB after 1hr'],
    ...pages.slice(0,8).map(p => [`${p.title} loads < 3s`, 1, 'Load < 3s']),
  ].map(([name, users, metric]) =>
    tc('PERF', typeof name === 'string' ? `Perf — ${name}` : `Perf — ${name[0]}`,
       pages[0]?.url || '', `Performance: ${metric}`,
       'Performance tools available',
       `1. Configure ${users} virtual user(s) | 2. Measure: ${name} | 3. Compare to: ${metric}`,
       `${name} meets threshold: ${metric}`, 'High'));
}

function generateApiTests(pages) {
  const origin = pages[0] ? new URL(pages[0].url).origin : '';
  const eps = [
    ['GET',    '/api/health',              false, '200 | {status:"ok"}'],
    ['POST',   '/api/auth/login',          false, '200 | token in response'],
    ['POST',   '/api/auth/signup',         false, '201 | user created'],
    ['POST',   '/api/auth/logout',         true,  '200 | session cleared'],
    ['GET',    '/api/auth/me',             true,  '200 | user object'],
    ['GET',    '/api/users',               true,  '200 | array of users'],
    ['POST',   '/api/users',               true,  '201 | user created'],
    ['GET',    '/api/users/:id',           true,  '200 | user object'],
    ['PUT',    '/api/users/:id',           true,  '200 | updated user'],
    ['DELETE', '/api/users/:id',           true,  '200 or 204'],
    ['GET',    '/api/products',            false, '200 | array of products'],
    ['POST',   '/api/products',            true,  '201 | product created'],
    ['GET',    '/api/products/:id',        false, '200 | product object'],
    ['PUT',    '/api/products/:id',        true,  '200 | updated product'],
    ['DELETE', '/api/products/:id',        true,  '200 or 204'],
    ['GET',    '/api/orders',              true,  '200 | array of orders'],
    ['POST',   '/api/orders',              true,  '201 | order created'],
    ['GET',    '/api/orders/:id',          true,  '200 | order object'],
    ['PATCH',  '/api/orders/:id/status',   true,  '200 | updated status'],
    ['GET',    '/api/settings',            true,  '200 | settings object'],
    ['PUT',    '/api/settings',            true,  '200 | settings updated'],
    ['POST',   '/api/upload',             true,   '200 | file URL returned'],
    ['GET',    '/api/search?q=test',       false, '200 | results array'],
    ['GET',    '/api/categories',          false, '200 | categories array'],
    ['POST',   '/api/contact',             false, '200 | message sent'],
    ['GET',    '/api/notifications',       true,  '200 | notifications array'],
    ['PATCH',  '/api/notifications/:id',   true,  '200 | marked as read'],
    ['POST',   '/api/payments/charge',     true,  '200 | payment confirmed'],
    ['GET',    '/api/payments/history',    true,  '200 | payment history'],
    ['DELETE', '/api/account',             true,  '200 | account deleted'],
  ];

  const tests = [];
  eps.forEach(([method, path, auth, expected]) => {
    tests.push(tc('API', `${method} ${path}`, `${origin}${path}`,
      `Test ${method} ${path}`,
      auth ? 'Valid JWT token' : 'No auth needed',
      `1. Send ${method} to ${origin}${path} | 2. ${auth ? 'Include Bearer token' : 'No auth'} | 3. Verify status | 4. Validate response schema | 5. Check time < 2s`,
      expected, path.includes('auth') || path.includes('payment') ? 'Critical' : 'High'));

    if (auth) {
      tests.push(tc('API', `${method} ${path} — Unauthorised (401)`, `${origin}${path}`,
        `Verify 401 without token`,
        'No JWT token',
        `1. Send ${method} to ${path} | 2. No Authorization header | 3. Verify 401`,
        `HTTP 401 | Error message | No data returned`, 'Critical'));
    }

    if (['POST','PUT','PATCH'].includes(method)) {
      tests.push(tc('API', `${method} ${path} — Invalid payload (400)`, `${origin}${path}`,
        `Verify 400 with empty body`,
        auth ? 'Valid JWT' : 'No auth',
        `1. Send ${method} to ${path} | 2. Body: {} | 3. Verify 400 | 4. Check error message`,
        `HTTP 400 | Descriptive error | No 500`, 'High'));
    }
  });
  return tests;
}

function generateDatabaseTests() {
  return [
    ['Connection pool health',           'SELECT 1',                          'Healthy connection < 50ms'],
    ['Users table — read',               'SELECT COUNT(*) FROM users',        'Returns count < 100ms'],
    ['Users table — write',              'INSERT INTO users RETURNING user_id','UUID returned | Row inserted'],
    ['Users table — update',             'UPDATE users SET full_name=$1',     'Row updated | updated_at trigger fires'],
    ['Users table — soft delete',        'UPDATE users SET is_active=false',  'Row soft-deleted | Not hard deleted'],
    ['Email index performance',          'SELECT * FROM users WHERE email=$1', 'Uses index | < 10ms'],
    ['Projects table CRUD',              'INSERT/SELECT/UPDATE/DELETE projects','All operations < 100ms'],
    ['Test cases — bulk insert',         'INSERT 100 rows into test_cases',   'All 100 inserted < 2s'],
    ['Test cases — filter by project',   'SELECT ... WHERE project_id=$1',    'Uses index | Correct results'],
    ['Test executions — write',          'INSERT INTO test_executions',        'Execution recorded correctly'],
    ['Bug reports — create',             'INSERT INTO bug_reports',            'Bug key unique | Created correctly'],
    ['Foreign key constraint',           'INSERT with invalid UUID FK',        'FK constraint violated | Error returned'],
    ['Transaction — commit',             'BEGIN; INSERT; COMMIT',              'Data persisted | Transaction clean'],
    ['Transaction — rollback',           'BEGIN; error; ROLLBACK',             'No data committed | Clean rollback'],
    ['UUID generation',                  'SELECT uuid_generate_v4()',          'Valid UUID v4 returned'],
    ['JSONB field read/write',           'INSERT/SELECT test_steps JSONB',     'JSONB stored and retrieved correctly'],
    ['updated_at trigger',               'UPDATE any row',                     'updated_at automatically set to NOW()'],
    ['Concurrent writes (10 parallel)',  '10 simultaneous INSERTs',            'No deadlocks | All rows inserted'],
    ['Large result set',                 'SELECT 1000 test_cases',             'Returns in < 500ms | Pagination works'],
    ['Full text search',                 "SELECT WHERE summary ILIKE '%test%'", 'Relevant results | Acceptable performance'],
  ].map(([name, q, expected]) =>
    tc('DB', name, '', `Database: ${name}`, 'Neon DB accessible',
      `1. Connect to DB | 2. Execute: ${q} | 3. Measure time | 4. Verify: ${expected}`,
      expected, name.includes('pool') || name.includes('constraint') ? 'Critical' : 'High'));
}

function generateUnitTests() {
  return [
    ['validateEmail valid',              'validateEmail("user@test.com")',               'Returns true'],
    ['validateEmail invalid',            'validateEmail("notanemail")',                  'Returns false'],
    ['validateEmail empty',              'validateEmail("")',                            'Returns false'],
    ['validateEmail SQL inject',         "validateEmail(\"' OR 1=1\")",                 'Returns false'],
    ['validateUrl valid',                'validateUrl("https://example.com")',           'Returns true'],
    ['validateUrl invalid',              'validateUrl("not a url")',                     'Returns false'],
    ['validateUrl no protocol',          'validateUrl("example.com")',                   'Returns false'],
    ['hashPassword generates',           'hashPassword("pass")',                         'Returns bcrypt string starting $2'],
    ['hashPassword unique salts',        'hashPassword("pass") twice',                  'Returns different hashes'],
    ['comparePassword match',            'comparePassword("pass", hash)',               'Returns true'],
    ['comparePassword no match',         'comparePassword("wrong", hash)',              'Returns false'],
    ['signToken generates',              'signToken({userId:"1"})',                      'Returns valid JWT string'],
    ['verifyToken valid',                'verifyToken(validJwt)',                        'Returns payload'],
    ['verifyToken expired',              'verifyToken(expiredJwt)',                      'Throws TokenExpiredError'],
    ['verifyToken tampered',             'verifyToken(tamperedJwt)',                     'Throws JsonWebTokenError'],
    ['verifyToken wrong secret',         'verifyToken(jwt, wrongSecret)',               'Throws error'],
    ['sanitizeInput removes script',     'sanitize("<script>alert(1)</script>")',        'Returns escaped string'],
    ['sanitizeInput removes img xss',    'sanitize("<img src=x onerror=alert(1)>")',     'Returns escaped string'],
    ["sanitizeInput SQL",                "sanitize(\"' OR '1'='1\")",                   'Returns escaped string'],
    ['paginate page 1',                  'paginate(100,1,10)',                           '{page:1,pages:10,offset:0}'],
    ['paginate last page',               'paginate(100,10,10)',                          '{page:10,offset:90}'],
    ['paginate beyond last',             'paginate(100,99,10)',                          'Returns last valid page'],
    ['paginate zero items',              'paginate(0,1,10)',                             '{pages:0,total:0}'],
    ['formatCurrency USD',               'formatCurrency(2900,"USD")',                   '"$29.00"'],
    ['formatCurrency EUR',               'formatCurrency(1000,"EUR")',                   '"€10.00"'],
    ['formatDate ISO',                   'formatDate(new Date("2024-01-15"))',            '"2024-01-15"'],
    ['rateLimit allows',                 'rateLimit("ip",15,60000) × 15',               'Returns false all 15 times'],
    ['rateLimit blocks',                 'rateLimit("ip",15,60000) × 16',               'Returns true on 16th'],
    ['rateLimit resets',                 'Wait for window | rateLimit again',            'Allows again after window'],
    ['errorHandler 400',                 'errorHandler(ValidationError,req,res)',        'Sends 400 with message'],
    ['errorHandler 500',                 'errorHandler(Error,req,res)',                  'Sends 500 | No stack trace in prod'],
  ].map(([name, code, expected]) =>
    tc('UNIT', name, '', `Unit: ${name}`, 'Jest test environment',
      `1. Import function | 2. Execute: ${code} | 3. Assert: ${expected}`,
      expected, name.includes('SQL') || name.includes('JWT') || name.includes('hash') ? 'Critical' : 'High'));
}

// ── Helper: create a test case object ────────────────────────
function tc(prefix, name, url, description, preconditions, testSteps, expectedResult, priority) {
  return {
    id: nextId(prefix),
    name,
    url: url || '',
    description,
    preconditions,
    testSteps,
    expectedResult,
    priority,
  };
}

// ── Sample values ─────────────────────────────────────────────
function getSampleValid(type, name='') {
  const n = name.toLowerCase();
  if (n.includes('email'))                  return 'user@example.com';
  if (n.includes('phone') || n.includes('tel')) return '+1-555-123-4567';
  if (n.includes('zip') || n.includes('postal')) return '12345';
  if (n.includes('url') || n.includes('website')) return 'https://example.com';
  if (n.includes('date'))                   return '2024-06-15';
  if (n.includes('price') || n.includes('amount')) return '29.99';
  if (n.includes('card'))                   return '4242424242424242';
  if (n.includes('cvv') || n.includes('cvc')) return '123';
  if (n.includes('name') || n.includes('full')) return 'John Smith';
  if (n.includes('password') || n.includes('pass')) return 'SecurePass123!';
  if (n.includes('message') || n.includes('bio')) return 'This is a sample message with sufficient content for validation.';
  if (n.includes('address'))               return '123 Main Street, Apt 4B';
  if (n.includes('city'))                  return 'New York';
  if (n.includes('subject'))               return 'Test Subject Line';
  switch(type) {
    case 'email':    return 'user@example.com';
    case 'password': return 'SecurePass123!';
    case 'tel':      return '+1-555-987-6543';
    case 'number':   return '42';
    case 'url':      return 'https://example.com';
    case 'date':     return '2024-06-15';
    case 'time':     return '14:30';
    case 'search':   return 'test query';
    case 'textarea': return 'This is a detailed text with enough content to pass minimum length requirements.';
    default:         return 'Sample valid text';
  }
}

function getSampleInvalid(type) {
  switch(type) {
    case 'email':    return 'notanemail';
    case 'password': return 'abc';
    case 'tel':      return 'not-a-phone';
    case 'number':   return 'abcdef';
    case 'url':      return 'not a url';
    case 'date':     return '99/99/9999';
    default:         return null;
  }
}
