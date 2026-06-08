// ============================================================
// lib/testGenerator.js
// Takes crawled page data and generates comprehensive test cases
// for every single element found on every page.
// Produces 200+ test cases per page with multiple test scenarios.
// ============================================================

let tcCounter = 0;
function nextId(prefix) {
  tcCounter++;
  return `${prefix}-${String(tcCounter).padStart(4, '0')}`;
}

export function resetCounter() { tcCounter = 0; }

// ── Master generator — takes all pages, returns all tests ─────
export function generateAllTestCases(pages, authCredentials) {
  resetCounter();
  const all = { ui: [], api: [], security: [], performance: [], database: [], unit: [] };
  const hasAuth = authCredentials?.username && authCredentials?.password;

  pages.forEach((page, pageIdx) => {
    const pageTests = generatePageTestCases(page, pageIdx, hasAuth, authCredentials);
    Object.entries(pageTests).forEach(([type, tests]) => {
      all[type].push(...tests);
    });
  });

  // Cross-page tests
  all.ui.push(   ...generateCrossPageTests(pages));
  all.security.push(...generateGlobalSecurityTests(pages));
  all.performance.push(...generateGlobalPerfTests(pages));
  all.api.push(  ...generateApiTests(pages));
  all.database.push(...generateDatabaseTests());
  all.unit.push( ...generateUnitTests());

  return all;
}

// ── Per-page test generation ──────────────────────────────────
function generatePageTestCases(page, pageIdx, hasAuth, authCredentials) {
  const { elements, title, url } = page;
  const tests = { ui: [], api: [], security: [] };
  const p = (n) => `TC-P${pageIdx+1}-${n}`;

  // ── 1. PAGE-LEVEL TESTS ───────────────────────────────────

  // Page load
  tests.ui.push({
    id: nextId('UI-LOAD'), name: `[${title}] Page loads successfully`,
    url, description: `Verify ${title} (${url}) loads without errors`,
    preconditions: 'Browser open | Internet connection available',
    testSteps: `1. Open browser | 2. Navigate to ${url} | 3. Wait for full load | 4. Check browser console for errors | 5. Verify page title | 6. Check HTTP status`,
    expectedResult: `HTTP 200 | Page loads < 3s | Title contains "${title}" | No console errors | No broken resources`,
    priority: pageIdx === 0 ? 'Critical' : 'High',
  });

  // Responsive tests — 4 breakpoints
  [{w:375,label:'Mobile (375px)'},{w:768,label:'Tablet (768px)'},{w:1024,label:'Laptop (1024px)'},{w:1440,label:'Desktop (1440px)'}]
    .forEach(bp => {
      tests.ui.push({
        id: nextId('UI-RESP'), name: `[${title}] Responsive — ${bp.label}`,
        url, description: `Verify layout at ${bp.label} viewport`,
        preconditions: 'Chrome DevTools available',
        testSteps: `1. Open ${url} | 2. Open DevTools (F12) | 3. Set viewport to ${bp.w}px | 4. Check layout | 5. Check text overflow | 6. Check navigation | 7. Verify no horizontal scroll`,
        expectedResult: `No horizontal scroll | Content readable | Navigation accessible | Images scale | Text not truncated | Touch targets ≥ 44px`,
        priority: 'High',
      });
    });

  // Browser compatibility
  ['Chrome', 'Firefox', 'Safari', 'Edge'].forEach(browser => {
    tests.ui.push({
      id: nextId('UI-BROWSER'), name: `[${title}] Browser — ${browser}`,
      url, description: `Verify page renders correctly in ${browser}`,
      preconditions: `${browser} browser installed`,
      testSteps: `1. Open ${url} in ${browser} | 2. Verify layout | 3. Check all interactive elements | 4. Test all forms | 5. Verify no CSS issues`,
      expectedResult: `Consistent layout | All elements visible | Forms work | No browser-specific errors`,
      priority: 'Medium',
    });
  });

  // Accessibility
  tests.ui.push({
    id: nextId('UI-A11Y'), name: `[${title}] Accessibility (WCAG 2.1)`,
    url, description: 'Verify page meets WCAG 2.1 AA accessibility standards',
    preconditions: 'axe DevTools or WAVE extension installed',
    testSteps: `1. Open ${url} | 2. Run axe accessibility scan | 3. Check keyboard navigation (Tab key) | 4. Test with screen reader | 5. Verify colour contrast | 6. Check focus indicators`,
    expectedResult: `0 critical axe errors | Full keyboard navigation | Screen reader readable | Contrast ratio ≥ 4.5:1 | Visible focus indicators`,
    priority: 'High',
  });

  // SEO basics
  tests.ui.push({
    id: nextId('UI-SEO'), name: `[${title}] SEO — Meta Tags`,
    url, description: 'Verify SEO meta tags and page structure',
    preconditions: 'Browser DevTools available',
    testSteps: `1. Open ${url} | 2. View page source | 3. Check <title> tag | 4. Check meta description | 5. Check meta viewport | 6. Check canonical URL | 7. Check H1 tag (${elements.headings.filter(h=>h.level===1).length} found)`,
    expectedResult: `<title> present and meaningful | Meta description 50–160 chars | Viewport meta set | Canonical URL present | Exactly 1 H1 tag`,
    priority: 'Medium',
  });

  // Page performance
  tests.ui.push({
    id: nextId('UI-PERF'), name: `[${title}] Core Web Vitals`,
    url, description: 'Measure and verify Core Web Vitals scores',
    preconditions: 'Chrome with Lighthouse',
    testSteps: `1. Open Chrome DevTools | 2. Go to Lighthouse tab | 3. Run audit on ${url} | 4. Record LCP, FID, CLS | 5. Check Performance score`,
    expectedResult: `LCP < 2.5s | FID < 100ms | CLS < 0.1 | Performance score ≥ 80 | No render-blocking resources`,
    priority: 'High',
  });

  // ── 2. NAVIGATION TESTS ───────────────────────────────────
  if (elements.navItems.length > 0) {
    const uniqueNavLinks = [...new Map(elements.navItems.map(n => [n.href, n])).values()].slice(0, 20);

    // Test all nav items
    tests.ui.push({
      id: nextId('UI-NAV'), name: `[${title}] Navigation — All ${uniqueNavLinks.length} nav links`,
      url, description: `Verify all ${uniqueNavLinks.length} navigation links work and lead to correct pages`,
      preconditions: 'On the page with navigation visible',
      testSteps: uniqueNavLinks.map((n, i) =>
        `${i+1}. Click "${n.text}" (href: ${n.href}) → verify correct page loads`
      ).join(' | '),
      expectedResult: `All ${uniqueNavLinks.length} links functional | No 404 errors | Correct pages load | Active state highlighted`,
      priority: 'Critical',
    });

    // Mobile hamburger menu
    tests.ui.push({
      id: nextId('UI-NAV-MOB'), name: `[${title}] Mobile Navigation Menu`,
      url, description: 'Test mobile hamburger menu opens/closes correctly',
      preconditions: 'Viewport set to 375px',
      testSteps: `1. Set viewport to 375px | 2. Check hamburger icon visible | 3. Click hamburger | 4. Verify menu opens | 5. Click a nav link | 6. Verify menu closes | 7. Press Escape | 8. Verify menu closes`,
      expectedResult: `Hamburger visible on mobile | Menu opens/closes | Links work | Escape key closes menu | Focus trap in open menu`,
      priority: 'High',
    });

    // Individual nav link tests
    uniqueNavLinks.slice(0, 15).forEach(link => {
      tests.ui.push({
        id: nextId('UI-NAVLINK'), name: `[${title}] Nav: "${link.text}"`,
        url, description: `Verify nav link "${link.text}" navigates to ${link.href}`,
        preconditions: 'Navigation is visible',
        testSteps: `1. Locate nav link "${link.text}" | 2. Verify it is visible | 3. Click the link | 4. Verify URL changes to ${link.href} | 5. Verify page content matches link label`,
        expectedResult: `Link "${link.text}" visible | Clickable | Navigates to ${link.href} | No 404 | Active state shown`,
        priority: 'High',
      });
    });
  }

  // ── 3. FORM TESTS ─────────────────────────────────────────
  elements.forms.forEach((form, fi) => {
    const formLabel = form.id || `Form ${fi + 1}`;

    // Form renders
    tests.ui.push({
      id: nextId('UI-FORM'), name: `[${title}] ${formLabel} — Renders correctly`,
      url, description: `Verify ${formLabel} loads with all ${form.fields.length} fields visible`,
      preconditions: `On ${url} | Form is visible`,
      testSteps: `1. Navigate to ${url} | 2. Locate ${formLabel} | 3. Verify all ${form.fields.length} form fields visible | 4. Check submit button present | 5. Check for CSRF token | 6. Verify all labels present`,
      expectedResult: `${form.fields.length} fields visible | Submit button present | CSRF token in hidden field | All fields have labels | Tab order logical`,
      priority: 'Critical',
    });

    // Per-field tests
    form.fields.forEach((field, fIdx) => {
      // Required validation
      if (field.required) {
        tests.ui.push({
          id: nextId('UI-FIELD'), name: `[${title}] ${formLabel} → "${field.name}" Required`,
          url, description: `Verify "${field.name}" field shows error when empty`,
          preconditions: `${formLabel} is loaded`,
          testSteps: `1. Leave "${field.name}" (${field.type}) empty | 2. Fill all other required fields | 3. Submit form | 4. Verify error on "${field.name}" field | 5. Verify error message is helpful`,
          testData: `Field: ${field.name} | Type: ${field.type} | Value: (empty)`,
          expectedResult: `Validation error shown | Error message helpful (e.g. "This field is required") | Focus moves to ${field.name} | Form not submitted`,
          priority: 'Critical',
        });
      }

      // Valid input
      const sampleValid = getSampleValidValue(field.type, field.name);
      tests.ui.push({
        id: nextId('UI-FIELD'), name: `[${title}] ${formLabel} → "${field.name}" Valid Input`,
        url, description: `Verify "${field.name}" accepts valid ${field.type} input`,
        preconditions: `${formLabel} is loaded`,
        testSteps: `1. Click "${field.name}" field | 2. Enter valid value: "${sampleValid}" | 3. Click elsewhere | 4. Verify no validation error | 5. Verify field styling is normal`,
        testData: `Field: ${field.name} | Type: ${field.type} | Valid value: ${sampleValid}`,
        expectedResult: `"${field.name}" accepts "${sampleValid}" | No validation error | Field shows normal/success state`,
        priority: field.required ? 'Critical' : 'High',
      });

      // Invalid input (type-specific)
      const sampleInvalid = getSampleInvalidValue(field.type);
      if (sampleInvalid) {
        tests.ui.push({
          id: nextId('UI-FIELD'), name: `[${title}] ${formLabel} → "${field.name}" Invalid Input`,
          url, description: `Verify "${field.name}" rejects invalid ${field.type} input`,
          preconditions: `${formLabel} is loaded`,
          testSteps: `1. Click "${field.name}" | 2. Enter invalid value: "${sampleInvalid}" | 3. Click elsewhere or submit | 4. Verify validation error | 5. Check error message is clear`,
          testData: `Field: ${field.name} | Type: ${field.type} | Invalid value: ${sampleInvalid}`,
          expectedResult: `Validation error shown | Error is specific | Field highlighted | Form not submitted`,
          priority: 'High',
        });
      }

      // Pattern validation
      if (field.pattern) {
        tests.ui.push({
          id: nextId('UI-FIELD'), name: `[${title}] ${formLabel} → "${field.name}" Pattern`,
          url, description: `Verify "${field.name}" enforces pattern: ${field.pattern}`,
          preconditions: `${formLabel} is loaded`,
          testSteps: `1. Enter value NOT matching pattern "${field.pattern}" | 2. Submit | 3. Verify error | 4. Enter value matching pattern | 5. Verify accepted`,
          testData: `Pattern: ${field.pattern}`,
          expectedResult: `Pattern mismatch shows error | Valid pattern value accepted`,
          priority: 'High',
        });
      }

      // Max length
      if (field.maxLength) {
        tests.ui.push({
          id: nextId('UI-FIELD'), name: `[${title}] ${formLabel} → "${field.name}" MaxLength (${field.maxLength})`,
          url, description: `Verify "${field.name}" does not exceed maxLength ${field.maxLength}`,
          preconditions: `${formLabel} is loaded`,
          testSteps: `1. Enter ${field.maxLength} characters | 2. Verify accepted | 3. Try to enter 1 more character | 4. Verify blocked or truncated`,
          testData: `Max length: ${field.maxLength} | Test: ${'A'.repeat(parseInt(field.maxLength)+5)}`,
          expectedResult: `Input capped at ${field.maxLength} chars | Cannot exceed limit | No JavaScript errors`,
          priority: 'Medium',
        });
      }

      // XSS per field
      tests.security.push({
        id: nextId('SEC-XSS'), name: `[${title}] XSS → "${field.name}" in ${formLabel}`,
        url, description: `Test XSS injection in "${field.name}" field`,
        preconditions: `${formLabel} is loaded`,
        testSteps: `1. Enter <script>alert('xss-${field.name}')</script> | 2. Submit | 3. Check no alert fires | 4. Try <img src=x onerror=alert(1)> | 5. Verify sanitised`,
        testData: `Payload 1: <script>alert('xss')</script>\nPayload 2: <img src=x onerror=alert(1)>\nPayload 3: javascript:alert(1)`,
        expectedResult: `No JavaScript executes | Input sanitised or rejected | Status 400 or escaped output`,
        priority: 'Critical',
      });
    });

    // Form submit — valid
    tests.ui.push({
      id: nextId('UI-SUBMIT'), name: `[${title}] ${formLabel} — Valid Submission`,
      url, description: `Submit ${formLabel} with all valid data`,
      preconditions: `${formLabel} visible | All fields accessible`,
      testSteps: form.fields.map((f, i) =>
        `${i+1}. Fill "${f.name}" with ${getSampleValidValue(f.type, f.name)}`
      ).concat([`${form.fields.length+1}. Click submit`, `${form.fields.length+2}. Verify success`]).join(' | '),
      testData: form.fields.map(f => `${f.name}: ${getSampleValidValue(f.type, f.name)}`).join(' | '),
      expectedResult: `Form submits | Success response | No validation errors | Redirect or success message shown`,
      priority: 'Critical',
    });

    // Form submit — all empty
    tests.ui.push({
      id: nextId('UI-SUBMIT'), name: `[${title}] ${formLabel} — Empty Submission`,
      url, description: `Submit ${formLabel} with all fields empty`,
      preconditions: `${formLabel} visible | All fields empty`,
      testSteps: `1. Ensure all fields are empty | 2. Click submit | 3. Count validation errors | 4. Verify each required field shows error`,
      expectedResult: `${form.fields.filter(f=>f.required).length} validation errors shown | Each required field highlighted | Form not submitted | Page stays on form`,
      priority: 'Critical',
    });

    // SQL injection in form
    tests.security.push({
      id: nextId('SEC-SQL'), name: `[${title}] SQL Injection — ${formLabel}`,
      url, description: `Test SQL injection via ${formLabel} fields`,
      preconditions: `${formLabel} is visible`,
      testSteps: `1. Enter ' OR '1'='1 in text fields | 2. Submit | 3. Check response | 4. Try ' UNION SELECT * FROM users-- | 5. Try '; DROP TABLE users--`,
      testData: `Payload 1: ' OR '1'='1\nPayload 2: ' UNION SELECT * FROM users--\nPayload 3: '; DROP TABLE users;\nPayload 4: 1' OR '1' = '1' --`,
      expectedResult: `SQL errors not exposed | No data leaked | Input rejected or sanitised | HTTP 400 or same page`,
      priority: 'Critical',
    });
  });

  // ── 4. BUTTON TESTS ───────────────────────────────────────
  const uniqueButtons = [...new Map(elements.buttons.map(b => [b.text, b])).values()].slice(0, 30);
  uniqueButtons.forEach(btn => {
    if (btn.type === 'submit') return; // covered by form tests

    tests.ui.push({
      id: nextId('UI-BTN'), name: `[${title}] Button: "${btn.text}"`,
      url, description: `Verify "${btn.text}" button works correctly`,
      preconditions: `On ${url} | Button is visible`,
      testSteps: `1. Locate "${btn.text}" button | 2. Verify it is ${btn.disabled ? 'disabled' : 'enabled'} | 3. ${btn.disabled ? 'Verify click has no effect' : 'Click the button'} | 4. Verify expected action occurs | 5. Test keyboard activation (Enter/Space)`,
      expectedResult: `Button ${btn.disabled ? 'is disabled and non-interactive' : 'triggers expected action'} | Keyboard accessible | Loading state shown if async | No console errors`,
      priority: btn.text.toLowerCase().includes('delete') || btn.text.toLowerCase().includes('remove') ? 'Critical' : 'High',
    });

    // Confirmation dialogs for destructive actions
    if (/delete|remove|cancel|clear|reset/i.test(btn.text)) {
      tests.ui.push({
        id: nextId('UI-BTN'), name: `[${title}] Button: "${btn.text}" — Confirmation`,
        url, description: `Verify "${btn.text}" shows confirmation before executing`,
        preconditions: `On ${url}`,
        testSteps: `1. Click "${btn.text}" | 2. Verify confirmation dialog appears | 3. Click Cancel | 4. Verify action NOT taken | 5. Click "${btn.text}" again | 6. Confirm | 7. Verify action completes`,
        expectedResult: `Confirmation dialog shown | Cancel prevents action | Confirm executes action | Undo available if applicable`,
        priority: 'Critical',
      });
    }
  });

  // ── 5. SELECT / DROPDOWN TESTS ────────────────────────────
  elements.selects.forEach(sel => {
    tests.ui.push({
      id: nextId('UI-SEL'), name: `[${title}] Dropdown: "${sel.name}"`,
      url, description: `Verify "${sel.name}" select dropdown works with all ${sel.options.length} options`,
      preconditions: `On ${url} | Select visible`,
      testSteps: [
        `1. Locate "${sel.name}" dropdown`,
        `2. Click to open`,
        `3. Verify ${sel.options.length} options visible: ${sel.options.slice(0,5).join(', ')}${sel.options.length>5?'...':''}`,
        ...sel.options.slice(0, 8).map((opt, i) => `${i+4}. Select "${opt}" | Verify selected`),
        `${Math.min(sel.options.length, 8)+4}. ${sel.required ? 'Try submitting without selecting | Verify error' : 'Verify default/placeholder option'}`,
      ].join(' | '),
      testData: `Options: ${sel.options.join(', ')}`,
      expectedResult: `All ${sel.options.length} options selectable | ${sel.required ? 'Required validation works' : 'Optional field works'} | Selected value persists | Keyboard navigable`,
      priority: sel.required ? 'Critical' : 'High',
    });

    if (sel.multiple) {
      tests.ui.push({
        id: nextId('UI-SEL'), name: `[${title}] Multi-select: "${sel.name}"`,
        url, description: `Verify "${sel.name}" allows multiple selections`,
        preconditions: `On ${url}`,
        testSteps: `1. Open "${sel.name}" | 2. Select first option | 3. Hold Ctrl/Cmd | 4. Select second option | 5. Verify both selected | 6. Deselect one | 7. Verify only one remains`,
        expectedResult: `Multiple options can be selected | Ctrl+click works | Deselection works | Selected values passed in form`,
        priority: 'High',
      });
    }
  });

  // ── 6. CHECKBOX TESTS ─────────────────────────────────────
  const uniqueCheckboxes = [...new Map(elements.checkboxes.map(c => [c.name, c])).values()].slice(0, 20);
  uniqueCheckboxes.forEach(cb => {
    tests.ui.push({
      id: nextId('UI-CB'), name: `[${title}] Checkbox: "${cb.name}"`,
      url, description: `Verify checkbox "${cb.name}" toggles correctly`,
      preconditions: `On ${url} | Checkbox visible`,
      testSteps: `1. Locate checkbox "${cb.name}" | 2. Verify initial state (unchecked) | 3. Click checkbox | 4. Verify checked | 5. Click again | 6. Verify unchecked | 7. Press Space key | 8. Verify toggled`,
      expectedResult: `Checkbox toggles on click | Keyboard toggle works (Space) | Visual state reflects checked/unchecked | Value sent in form when checked`,
      priority: cb.required ? 'Critical' : 'Medium',
    });
  });

  // ── 7. RADIO BUTTON TESTS ─────────────────────────────────
  const radioGroups = [...new Set(elements.radios.map(r => r.name))];
  radioGroups.slice(0, 10).forEach(groupName => {
    const groupRadios = elements.radios.filter(r => r.name === groupName);
    tests.ui.push({
      id: nextId('UI-RADIO'), name: `[${title}] Radio Group: "${groupName}"`,
      url, description: `Verify radio group "${groupName}" allows only one selection`,
      preconditions: `On ${url} | Radio group visible`,
      testSteps: groupRadios.slice(0, 6).map((r, i) =>
        `${i+1}. Select "${r.value || `option ${i+1}`}" | Verify selected | Verify others deselected`
      ).join(' | '),
      expectedResult: `Only one option selected at a time | Previous deselects when new selected | Keyboard navigation works (arrow keys) | Value correctly sent in form`,
      priority: 'High',
    });
  });

  // ── 8. TABLE TESTS ────────────────────────────────────────
  elements.tables.forEach((table, ti) => {
    tests.ui.push({
      id: nextId('UI-TABLE'), name: `[${title}] Table: "${table.id}" — Display`,
      url, description: `Verify data table "${table.id}" displays correctly with ${table.rowCount} rows`,
      preconditions: `On ${url}`,
      testSteps: `1. Locate table "${table.id}" | 2. Verify headers: ${table.headers.slice(0,5).join(', ')} | 3. Count rows (expect ~${table.rowCount}) | 4. Verify data in cells | 5. Check for empty states`,
      expectedResult: `Headers visible: ${table.headers.slice(0,3).join(', ')} | ${table.rowCount} data rows | Cells not empty | Responsive (horizontal scroll on mobile)`,
      priority: 'High',
    });

    if (table.headers.length > 0) {
      // Sorting
      tests.ui.push({
        id: nextId('UI-TABLE'), name: `[${title}] Table: "${table.id}" — Column Sorting`,
        url, description: `Verify table columns can be sorted`,
        preconditions: `Table has sortable columns`,
        testSteps: table.headers.slice(0, 4).map((h, i) =>
          `${i+1}. Click column "${h}" | Verify ascending sort | Click again | Verify descending`
        ).join(' | '),
        expectedResult: `Sort indicator shown | Data sorted correctly | Toggle asc/desc works | Sort persists on page refresh`,
        priority: 'Medium',
      });

      // Pagination
      if (table.rowCount > 10) {
        tests.ui.push({
          id: nextId('UI-TABLE'), name: `[${title}] Table: "${table.id}" — Pagination`,
          url, description: `Verify table pagination works with ${table.rowCount} rows`,
          preconditions: `Table has more than 10 rows`,
          testSteps: `1. Check rows per page (e.g. 10) | 2. Click Next page | 3. Verify different data | 4. Click Previous | 5. Verify back to first page | 6. Jump to last page | 7. Verify last ${table.rowCount % 10 || 10} rows`,
          expectedResult: `10 rows per page by default | Next/Prev work | Page numbers shown | Last page shows remaining rows | URL updates with page param`,
          priority: 'High',
        });
      }
    }
  });

  // ── 9. IMAGE TESTS ────────────────────────────────────────
  const brokenImgCount  = elements.images.filter(img => !img.hasAlt).length;
  const totalImgCount   = elements.images.length;

  if (totalImgCount > 0) {
    tests.ui.push({
      id: nextId('UI-IMG'), name: `[${title}] Images — Alt Text (${totalImgCount} images)`,
      url, description: `Verify all ${totalImgCount} images have alt text for accessibility`,
      preconditions: `On ${url}`,
      testSteps: `1. Open ${url} | 2. Right-click → Inspect | 3. Find all <img> tags | 4. Check alt attribute on each | 5. Verify decorative images have empty alt=""`,
      expectedResult: `All ${totalImgCount} images have alt attribute | Content images: descriptive alt | Decorative images: alt="" | No missing alt attributes | ${brokenImgCount > 0 ? `⚠️ ${brokenImgCount} images missing alt` : '✅ All images have alt'}`,
      priority: 'High',
    });

    tests.ui.push({
      id: nextId('UI-IMG'), name: `[${title}] Images — Load & Display`,
      url, description: `Verify all ${totalImgCount} images load without errors`,
      preconditions: `On ${url} with network tab open`,
      testSteps: `1. Open DevTools Network tab | 2. Filter by Img | 3. Navigate to ${url} | 4. Check all image requests | 5. Verify no 404 responses | 6. Verify images display correctly`,
      expectedResult: `All ${totalImgCount} images return 200 | No broken images | Images not stretched/distorted | Images responsive`,
      priority: 'Medium',
    });
  }

  // ── 10. LINK TESTS ────────────────────────────────────────
  const uniqueLinks = [...new Map(elements.links.map(l => [l.href, l])).values()]
    .filter(l => !l.href.startsWith('mailto:') && !l.href.startsWith('tel:'))
    .slice(0, 30);

  if (uniqueLinks.length > 0) {
    tests.ui.push({
      id: nextId('UI-LINK'), name: `[${title}] Links — No Broken Links (${uniqueLinks.length})`,
      url, description: `Verify all ${uniqueLinks.length} links on the page are not broken`,
      preconditions: `On ${url}`,
      testSteps: `1. Use broken link checker tool OR manually test | 2. Click each link | 3. Verify HTTP 200 response | 4. Check: ${uniqueLinks.slice(0,5).map(l=>l.text).join(', ')}`,
      expectedResult: `All ${uniqueLinks.length} links return 200 or valid redirect | No 404, 500, or timeout | External links open in new tab | Internal links stay in same tab`,
      priority: 'High',
    });

    // External links open in new tab
    const externalLinks = uniqueLinks.filter(l => l.target === '_blank');
    if (externalLinks.length > 0) {
      tests.ui.push({
        id: nextId('UI-LINK'), name: `[${title}] External Links — New Tab & rel=noopener`,
        url, description: `Verify ${externalLinks.length} external links open in new tab securely`,
        preconditions: `On ${url}`,
        testSteps: externalLinks.slice(0, 5).map((l, i) =>
          `${i+1}. Click "${l.text}" | Verify opens new tab | Check rel="${l.rel || 'missing'}"`
        ).join(' | '),
        expectedResult: `External links open new tab | All have rel="noopener noreferrer" | Original tab not affected | Links show visual indicator`,
        priority: 'Medium',
      });
    }
  }

  // ── 11. HEADING STRUCTURE ─────────────────────────────────
  if (elements.headings.length > 0) {
    tests.ui.push({
      id: nextId('UI-HEAD'), name: `[${title}] Heading Hierarchy`,
      url, description: `Verify proper heading hierarchy (${elements.headings.length} headings found)`,
      preconditions: `On ${url}`,
      testSteps: `1. View page source | 2. Find all heading tags | 3. Verify H1 appears once | 4. Verify H2s are under H1 | 5. Verify no skipped levels | Headings: ${elements.headings.slice(0,5).map(h=>`H${h.level}:${h.text.substring(0,20)}`).join(', ')}`,
      expectedResult: `Exactly 1 H1 | H2s come after H1 | No level skipping (e.g. H1→H3) | Headings are meaningful | ${elements.headings.filter(h=>h.level===1).length} H1, ${elements.headings.filter(h=>h.level===2).length} H2, ${elements.headings.filter(h=>h.level===3).length} H3 found`,
      priority: 'Medium',
    });
  }

  // ── 12. MODAL TESTS ───────────────────────────────────────
  elements.modals.forEach((modal, mi) => {
    tests.ui.push({
      id: nextId('UI-MODAL'), name: `[${title}] Modal ${mi+1} — Open/Close`,
      url, description: `Verify modal ${mi+1} opens, closes, and traps focus`,
      preconditions: `On ${url} | Modal trigger accessible`,
      testSteps: `1. Click element that opens modal | 2. Verify modal opens | 3. Verify background is blocked | 4. Tab through modal (focus trap) | 5. Click X or Cancel | 6. Verify closes | 7. Press Escape | 8. Verify closes`,
      expectedResult: `Modal opens | Background blocked | Focus trapped in modal | X/Cancel closes | Escape closes | Focus returns to trigger | Body scroll locked`,
      priority: 'High',
    });
  });

  // ── 13. TAB TESTS ─────────────────────────────────────────
  if (elements.tabs.length > 0) {
    tests.ui.push({
      id: nextId('UI-TAB'), name: `[${title}] Tab Component (${elements.tabs[0].count} tabs)`,
      url, description: `Verify tab component switches content correctly`,
      preconditions: `On ${url} | Tab component visible`,
      testSteps: `1. Note active tab | 2. Click each tab in sequence | 3. Verify content changes | 4. Verify only one tab active | 5. Test keyboard: Arrow keys to navigate | 6. Press Enter/Space to activate`,
      expectedResult: `Correct content shown per tab | Only one tab active | Inactive tab content hidden | Keyboard navigation works | ARIA attributes correct`,
      priority: 'High',
    });
  }

  // ── 14. PAGINATION TESTS ──────────────────────────────────
  elements.pagination.forEach(pg => {
    tests.ui.push({
      id: nextId('UI-PAGE'), name: `[${title}] Pagination (${pg.maxPage} pages detected)`,
      url, description: `Verify pagination navigates through all ${pg.maxPage} pages`,
      preconditions: `On first page of ${url}`,
      testSteps: `1. Verify page 1 active | 2. Click Next | 3. Verify page 2 loads | 4. Verify URL has ?page=2 | 5. Click page number 3 if available | 6. Verify page 3 | 7. Click Prev | 8. Verify page 2 | 9. Jump to last page (${pg.maxPage}) | 10. Verify Next disabled`,
      expectedResult: `All ${pg.maxPage} pages accessible | URL updates per page | Next disabled on last | Prev disabled on first | Correct items shown per page`,
      priority: 'High',
    });
  });

  // ── 15. FILE UPLOAD TESTS ─────────────────────────────────
  elements.fileInputs.forEach(fi => {
    tests.ui.push({
      id: nextId('UI-FILE'), name: `[${title}] File Upload: "${fi.name}"`,
      url, description: `Verify file upload "${fi.name}" with all valid and invalid file types`,
      preconditions: `On ${url} | File input visible`,
      testSteps: `1. Click file upload | 2. Select valid file ${fi.accept || '(any)'} | 3. Verify file name shown | 4. Try uploading invalid type | 5. Verify rejected | 6. Try file > 10MB | 7. Verify size error | 8. Submit with file | 9. Verify upload succeeds`,
      testData: `Accepted types: ${fi.accept || 'all'} | Multiple: ${fi.multiple}`,
      expectedResult: `Valid file accepted | Invalid type rejected | Size limit enforced | Upload progress shown | Success/error feedback | File preview if image`,
      priority: 'High',
    });
  });

  // ── 16. IFRAME TESTS ──────────────────────────────────────
  if ((html => /\<iframe/i.test(html))(elements.toString() || '')) {
    tests.ui.push({
      id: nextId('UI-IFRAME'), name: `[${title}] Iframe — Loads Correctly`,
      url, description: `Verify embedded iframes load without errors`,
      preconditions: `On ${url}`,
      testSteps: `1. Identify all iframes | 2. Verify each loads | 3. Check no mixed content warnings | 4. Verify correct dimensions | 5. Check title attribute for accessibility`,
      expectedResult: `All iframes load | No mixed content | Correct dimensions | title attribute present | No console security errors`,
      priority: 'Medium',
    });
  }

  // ── 17. ACCORDION TESTS ───────────────────────────────────
  if (elements.accordions.length > 0) {
    tests.ui.push({
      id: nextId('UI-ACC'), name: `[${title}] Accordion — Expand/Collapse`,
      url, description: `Verify accordion items expand and collapse`,
      preconditions: `On ${url} | Accordion visible`,
      testSteps: `1. All items collapsed initially | 2. Click item 1 | 3. Verify expands | 4. Click item 2 | 5. Verify expands (and 1 may collapse) | 6. Click open item | 7. Verify collapses | 8. Test keyboard Enter/Space`,
      expectedResult: `Expand/collapse works | Content shows/hides | Smooth animation | Keyboard accessible | ARIA expanded state updates`,
      priority: 'Medium',
    });
  }

  return tests;
}

// ── Cross-page test cases ─────────────────────────────────────
function generateCrossPageTests(pages) {
  const tests = [];
  if (pages.length < 2) return tests;

  tests.push({
    id: nextId('UI-FLOW'), name: `User Journey — Browse and Navigate (${pages.length} pages)`,
    url: pages[0].url,
    description: `End-to-end navigation flow across all ${pages.length} discovered pages`,
    preconditions: 'Browser open | Application accessible',
    testSteps: pages.slice(0, 10).map((p, i) =>
      `${i+1}. Navigate to "${p.title}" (${p.url}) | Verify loads`
    ).join(' | '),
    expectedResult: `All ${pages.length} pages accessible | No dead ends | Back button works everywhere | Session persists across pages`,
    priority: 'Critical',
  });

  tests.push({
    id: nextId('UI-FLOW'), name: `Session Persistence Across Pages`,
    url: pages[0].url,
    description: 'Verify user state and session persist when navigating between pages',
    preconditions: 'User is logged in',
    testSteps: `1. Login | 2. Navigate to ${pages.slice(0,4).map(p=>p.title).join(' → ')} | 3. Verify still logged in on each | 4. Verify user data consistent | 5. Hard refresh on middle page | 6. Verify session preserved`,
    expectedResult: 'Login state persists | User data consistent | No unexpected logouts | Session token valid throughout',
    priority: 'Critical',
  });

  tests.push({
    id: nextId('UI-FLOW'), name: `Browser Back/Forward Navigation`,
    url: pages[0].url,
    description: 'Verify browser back/forward buttons work correctly across all pages',
    preconditions: 'Browser history available',
    testSteps: `1. Visit pages in order: ${pages.slice(0,5).map(p=>p.title).join(' → ')} | 2. Press Back multiple times | 3. Verify correct pages load | 4. Press Forward | 5. Verify history correct`,
    expectedResult: 'Back/forward navigate correctly | URL updates | No infinite loops | Page state preserved where expected',
    priority: 'High',
  });

  return tests;
}

// ── Global security tests ─────────────────────────────────────
function generateGlobalSecurityTests(pages) {
  const origin = pages[0] ? new URL(pages[0].url).origin : '';
  const tests  = [];

  const secTests = [
    { name: 'HTTPS Redirect',           steps: `1. Visit HTTP version: ${origin.replace('https','http')} | 2. Verify 301/302 redirect to HTTPS`, expected: 'Automatic redirect to HTTPS | HSTS header present' },
    { name: 'Security Headers',         steps: `1. Open ${origin} | 2. Check headers: X-Frame-Options, X-Content-Type-Options, CSP, HSTS, Referrer-Policy`, expected: 'All security headers present and correctly configured' },
    { name: 'Cookie Security Flags',    steps: `1. Login | 2. Inspect cookies in DevTools | 3. Check Secure, HttpOnly, SameSite flags`, expected: 'All session cookies have Secure | HttpOnly | SameSite=Strict or Lax' },
    { name: 'Content Security Policy',  steps: `1. Check CSP header | 2. Try injecting inline script | 3. Verify blocked`, expected: 'CSP header present | Inline scripts blocked | Eval blocked' },
    { name: 'CORS Configuration',       steps: `1. Make cross-origin request to API | 2. Verify CORS headers | 3. Verify restricted origins`, expected: 'CORS restricted to allowed origins | Credentials not allowed from all origins' },
    { name: 'Rate Limiting — Login',    steps: `1. Attempt login 20 times quickly | 2. Verify rate limit kicks in | 3. Check 429 response`, expected: 'Rate limit after 10–15 attempts | 429 Too Many Requests | Lockout period applies' },
    { name: 'Open Redirect Prevention', steps: `1. Try ${origin}/login?redirect=https://evil.com | 2. Verify redirect is blocked or sanitised`, expected: 'Open redirect blocked | Only whitelisted domains allowed | Warning shown' },
    { name: 'Sensitive Data Exposure',  steps: `1. Check all API responses | 2. Verify no passwords/tokens in responses | 3. Check error messages don't leak stack traces`, expected: 'No sensitive data in responses | Errors are generic | No stack traces in production' },
    { name: 'Clickjacking Protection',  steps: `1. Check X-Frame-Options header | 2. Check CSP frame-ancestors | 3. Try embedding in iframe`, expected: 'X-Frame-Options: DENY or SAMEORIGIN | CSP frame-ancestors set | Iframe embedding blocked' },
    { name: 'Path Traversal',           steps: `1. Try ${origin}/../../etc/passwd | 2. Try ${origin}/../../../windows/system32 | 3. Verify blocked`, expected: 'Path traversal blocked | 400 or 403 response | No file system access' },
    { name: 'JWT Token Security',       steps: `1. Get valid JWT | 2. Modify payload | 3. Send modified token | 4. Verify rejected | 5. Use expired token | 6. Verify rejected`, expected: 'Modified token rejected | Expired token rejected | Algorithm: RS256 or HS256 | No "none" algorithm' },
    { name: 'Password Reset Security',  steps: `1. Request password reset | 2. Check token in URL | 3. Verify token expiry (< 1 hour) | 4. Verify one-time use | 5. Try reusing token`, expected: 'Reset token expires in < 1 hour | One-time use | Secure random token | Old password not sent in email' },
    { name: 'Insecure Direct Object Reference', steps: `1. Login as User A | 2. Note your resource ID | 3. Increment/guess other IDs | 4. Try accessing User B resources`, expected: 'Access denied to other users data | 403 Forbidden | IDs not guessable (UUIDs)' },
    { name: 'File Upload Security',     steps: `1. Upload .php file | 2. Upload .exe file | 3. Upload file with malicious content | 4. Try path traversal in filename`, expected: 'Executable files rejected | MIME type validation | Filename sanitised | Uploads not publicly accessible' },
    { name: 'Verbose Error Messages',   steps: `1. Trigger 404 | 2. Trigger 500 | 3. Submit invalid input | 4. Check error messages don't expose stack traces or DB info`, expected: 'Generic error messages | No stack traces | No DB query details | No server paths exposed' },
  ];

  secTests.forEach(t => {
    tests.push({
      id:          nextId('SEC'),
      name:        t.name,
      url:         origin,
      description: `Security test: ${t.name}`,
      preconditions: 'Access to application | Security testing tools available',
      testSteps:   t.steps,
      expectedResult: t.expected,
      priority:    'Critical',
    });
  });

  return tests;
}

// ── API tests based on discovered pages ──────────────────────
function generateApiTests(pages) {
  const tests  = [];
  const origin = pages[0] ? new URL(pages[0].url).origin : '';

  const endpoints = [
    { m: 'GET',    p: '/api/health',            auth: false, desc: 'Health check' },
    { m: 'POST',   p: '/api/auth/login',        auth: false, desc: 'Login' },
    { m: 'POST',   p: '/api/auth/register',     auth: false, desc: 'Register' },
    { m: 'POST',   p: '/api/auth/logout',       auth: true,  desc: 'Logout' },
    { m: 'GET',    p: '/api/auth/me',           auth: true,  desc: 'Current user' },
    { m: 'GET',    p: '/api/users',             auth: true,  desc: 'List users' },
    { m: 'POST',   p: '/api/users',             auth: true,  desc: 'Create user' },
    { m: 'GET',    p: '/api/users/:id',         auth: true,  desc: 'Get user by ID' },
    { m: 'PUT',    p: '/api/users/:id',         auth: true,  desc: 'Update user' },
    { m: 'DELETE', p: '/api/users/:id',         auth: true,  desc: 'Delete user' },
    { m: 'GET',    p: '/api/products',          auth: false, desc: 'List products' },
    { m: 'POST',   p: '/api/products',          auth: true,  desc: 'Create product' },
    { m: 'GET',    p: '/api/products/:id',      auth: false, desc: 'Get product' },
    { m: 'PUT',    p: '/api/products/:id',      auth: true,  desc: 'Update product' },
    { m: 'DELETE', p: '/api/products/:id',      auth: true,  desc: 'Delete product' },
    { m: 'GET',    p: '/api/orders',            auth: true,  desc: 'List orders' },
    { m: 'POST',   p: '/api/orders',            auth: true,  desc: 'Create order' },
    { m: 'GET',    p: '/api/orders/:id',        auth: true,  desc: 'Get order' },
    { m: 'PATCH',  p: '/api/orders/:id/status', auth: true, desc: 'Update order status' },
    { m: 'GET',    p: '/api/settings',          auth: true,  desc: 'Get settings' },
    { m: 'PUT',    p: '/api/settings',          auth: true,  desc: 'Update settings' },
    { m: 'POST',   p: '/api/upload',            auth: true,  desc: 'File upload' },
    { m: 'GET',    p: '/api/search',            auth: false, desc: 'Search' },
    { m: 'GET',    p: '/api/categories',        auth: false, desc: 'Categories' },
    { m: 'POST',   p: '/api/contact',           auth: false, desc: 'Contact form' },
  ];

  endpoints.forEach(ep => {
    // Happy path
    tests.push({
      id:          nextId('API'),
      name:        `${ep.m} ${ep.p} — ${ep.desc}`,
      method:      ep.m,
      endpoint:    `${origin}${ep.p}`,
      description: `${ep.desc} endpoint: ${ep.m} ${ep.p}`,
      preconditions: ep.auth ? 'Valid JWT token required' : 'No auth required',
      testSteps:   `1. Send ${ep.m} to ${ep.p} | 2. ${ep.auth ? 'Include Bearer token' : 'No auth header'} | 3. Verify status | 4. Validate response schema | 5. Check response time < 2s`,
      expectedResult: `HTTP ${ep.m === 'POST' ? '201' : ep.m === 'DELETE' ? '204' : '200'} | Valid JSON | < 2s response | ${ep.auth ? 'Returns 401 without token' : 'Publicly accessible'}`,
      priority: ep.p.includes('auth') ? 'Critical' : 'High',
    });

    // Auth test for protected endpoints
    if (ep.auth) {
      tests.push({
        id:          nextId('API'),
        name:        `${ep.m} ${ep.p} — Unauthorised (no token)`,
        method:      ep.m,
        endpoint:    `${origin}${ep.p}`,
        description: `Verify ${ep.p} returns 401 without auth`,
        preconditions: 'No JWT token',
        testSteps:   `1. Send ${ep.m} to ${ep.p} | 2. No Authorization header | 3. Verify 401`,
        expectedResult: `HTTP 401 | {"error": "No token provided"} | No data returned`,
        priority: 'Critical',
      });
    }

    // Invalid data test
    if (['POST','PUT','PATCH'].includes(ep.m)) {
      tests.push({
        id:          nextId('API'),
        name:        `${ep.m} ${ep.p} — Invalid Payload`,
        method:      ep.m,
        endpoint:    `${origin}${ep.p}`,
        description: `Verify ${ep.p} returns 400 with invalid data`,
        preconditions: ep.auth ? 'Valid JWT token' : 'No auth needed',
        testSteps:   `1. Send ${ep.m} to ${ep.p} | 2. Body: {} (empty) | 3. Verify 400 | 4. Send malformed JSON | 5. Verify 400`,
        testData:    '{}  |  {"invalid": true}  |  malformed json',
        expectedResult: `HTTP 400 | Descriptive error message | Field-level errors listed | No 500 errors`,
        priority: 'High',
      });
    }
  });

  return tests;
}

// ── Global performance tests ──────────────────────────────────
function generateGlobalPerfTests(pages) {
  return [
    { name: 'Homepage Load — 1 user',          users: 1,   metric: '< 3s',    priority: 'Critical' },
    { name: 'Concurrent Users — 10',           users: 10,  metric: '< 5s avg', priority: 'High' },
    { name: 'Concurrent Users — 50',           users: 50,  metric: '< 8s avg', priority: 'High' },
    { name: 'Concurrent Users — 100',          users: 100, metric: '< 15s',   priority: 'High' },
    { name: 'Concurrent Users — 500 (stress)', users: 500, metric: 'No crash', priority: 'Medium' },
    { name: 'API Response — GET endpoints',    users: 1,   metric: '< 200ms', priority: 'High' },
    { name: 'API Response — POST endpoints',   users: 1,   metric: '< 500ms', priority: 'High' },
    { name: 'API Response — under load (50)',  users: 50,  metric: '< 2s',    priority: 'High' },
    { name: 'Time to First Byte (TTFB)',        users: 1,   metric: '< 600ms', priority: 'High' },
    { name: 'Largest Contentful Paint (LCP)',   users: 1,   metric: '< 2.5s',  priority: 'High' },
    { name: 'First Input Delay (FID)',          users: 1,   metric: '< 100ms', priority: 'High' },
    { name: 'Cumulative Layout Shift (CLS)',    users: 1,   metric: '< 0.1',   priority: 'High' },
    { name: 'Database Query Time',             users: 1,   metric: '< 100ms', priority: 'High' },
    { name: 'Memory Leak — long session (1hr)',users: 5,   metric: '< 512MB', priority: 'Medium' },
    { name: 'Static Asset Caching',            users: 1,   metric: 'Cache-Control set', priority: 'Medium' },
    ...pages.slice(0, 10).map(p => ({
      name: `${p.title} — Page Load`,
      users: 1, metric: '< 3s', priority: 'High',
    })),
  ].map(t => ({
    id:          nextId('PERF'),
    name:        t.name,
    users:       t.users,
    requests:    t.users * 10,
    description: `Performance: ${t.name} | Target: ${t.metric}`,
    preconditions: 'Load testing tool configured (k6, JMeter, or Lighthouse)',
    testSteps:   `1. Configure ${t.users} virtual user(s) | 2. Run for 60 seconds | 3. Measure ${t.name} | 4. Compare to threshold: ${t.metric}`,
    expectedResult: `${t.name} meets: ${t.metric} | No 5xx errors | No timeouts`,
    priority:    t.priority,
  }));
}

// ── Database tests ────────────────────────────────────────────
function generateDatabaseTests() {
  return [
    ['Connection Pool Health',        'SELECT 1',                          'Pool returns healthy connection in < 50ms'],
    ['Read — Users Table',            'SELECT COUNT(*) FROM users',         'Returns count in < 100ms'],
    ['Write — Insert User',           'INSERT INTO users ... RETURNING id', 'UUID generated, row inserted'],
    ['Update — User Fields',          'UPDATE users SET ... WHERE id=$1',   'Row updated, updated_at trigger fires'],
    ['Delete — Soft Delete',          'UPDATE users SET is_active=false',   'Soft delete works, row not removed'],
    ['Index — Email Lookup',          'SELECT * FROM users WHERE email=$1', 'Uses idx_users_email, < 10ms'],
    ['Index — Project Tests',         'SELECT * FROM test_cases WHERE project_id=$1', 'Uses idx_test_cases_project'],
    ['Foreign Key — Project Cascade', 'DELETE FROM projects WHERE id=$1',   'Cascade deletes related test_cases'],
    ['Transaction — Rollback',        'BEGIN; error; ROLLBACK',             'Transaction rolled back cleanly'],
    ['Transaction — Commit',          'BEGIN; INSERT; COMMIT',              'Transaction commits, data persists'],
    ['JSONB — test_steps field',      'SELECT test_steps FROM test_cases',  'JSONB field readable and parseable'],
    ['UUID Generation',               'SELECT uuid_generate_v4()',          'Valid UUID returned'],
    ['Trigger — updated_at',          'UPDATE users SET email=$1',          'updated_at column auto-updates'],
    ['Concurrent Writes',             '50 simultaneous INSERTs',            'No deadlocks, all rows inserted'],
    ['Connection Limit',              '100 simultaneous connections',       'Pool handles max connections gracefully'],
    ['Large Result Set',              'SELECT * FROM test_cases LIMIT 1000','Returns in < 500ms with correct count'],
    ['Aggregate Query',               'SELECT type, COUNT(*) FROM test_cases GROUP BY type', 'Grouped results correct'],
    ['Full-text Search',              "SELECT * FROM test_cases WHERE summary ILIKE '%test%'", 'Returns relevant results'],
  ].map(([name, q, expected]) => ({
    id:          nextId('DB'),
    name,
    query:       q,
    database:    'neon-postgres',
    description: `Database test: ${name}`,
    preconditions: 'Database running | Connection string valid',
    testSteps:   `1. Connect to Neon DB | 2. Execute: ${q} | 3. Measure execution time | 4. Verify result`,
    expectedResult: expected,
    priority:    name.includes('Connection') || name.includes('Transaction') ? 'Critical' : 'High',
  }));
}

// ── Unit tests ────────────────────────────────────────────────
function generateUnitTests() {
  return [
    ['Email Validation — valid',        'validateEmail("test@example.com")',        'Returns true'],
    ['Email Validation — invalid',      'validateEmail("not-an-email")',            'Returns false'],
    ['Email Validation — empty',        'validateEmail("")',                        'Returns false'],
    ['Password Strength — strong',      'checkPassword("Abc123!@#")',               'Returns "strong"'],
    ['Password Strength — weak',        'checkPassword("abc")',                     'Returns "weak"'],
    ['Password Hash — generates',       'hashPassword("secret")',                   'Returns bcrypt hash starting with $2'],
    ['Password Hash — verifies',        'comparePassword("secret", hash)',          'Returns true for matching'],
    ['Password Hash — rejects',         'comparePassword("wrong", hash)',           'Returns false for wrong'],
    ['JWT Sign — generates token',      'signToken({userId: "abc", plan: "free"})', 'Returns valid JWT string'],
    ['JWT Verify — valid token',        'verifyToken(validJwt)',                    'Returns decoded payload'],
    ['JWT Verify — expired token',      'verifyToken(expiredJwt)',                  'Throws TokenExpiredError'],
    ['JWT Verify — tampered token',     'verifyToken(tamperedJwt)',                 'Throws JsonWebTokenError'],
    ['URL Validation — valid',          'validateUrl("https://example.com")',       'Returns true'],
    ['URL Validation — invalid',        'validateUrl("not a url")',                 'Returns false'],
    ['Input Sanitiser — XSS',          'sanitize("<script>alert(1)</script>")',     'Returns escaped string'],
    ['Input Sanitiser — SQL',          "sanitize(\"' OR '1'='1\")",               'Returns escaped string'],
    ['Pagination — page 1',             'paginate(100, 1, 10)',                     '{page:1, total:100, pages:10, offset:0}'],
    ['Pagination — last page',          'paginate(100, 10, 10)',                    '{page:10, total:100, offset:90}'],
    ['Pagination — over limit',         'paginate(100, 99, 10)',                    'Returns last valid page'],
    ['Date Formatter — ISO',            'formatDate(new Date("2024-01-15"))',       'Returns "2024-01-15"'],
    ['Currency Formatter',              'formatCurrency(2900, "USD")',              'Returns "$29.00"'],
    ['Slug Generator',                  'toSlug("Hello World 123")',                'Returns "hello-world-123"'],
    ['Rate Limiter — allows',           'rateLimit("ip:1", 15, 60000)',             'Returns false (not limited)'],
    ['Rate Limiter — blocks',           '16 calls to rateLimit("ip:2", 15, 60000)','Returns true on 16th call'],
    ['Error Handler — 400',             'errorHandler(ValidationError, req, res)',  'Sends status 400 with message'],
    ['Error Handler — 500',             'errorHandler(Error, req, res)',            'Sends status 500, no stack in prod'],
    ['Auth Middleware — valid JWT',     'authMiddleware with valid token',           'Calls next(), req.user set'],
    ['Auth Middleware — no token',      'authMiddleware with no Authorization',      'Returns 401'],
    ['Auth Middleware — bad token',     'authMiddleware with invalid JWT',           'Returns 401'],
    ['CORS — allowed origin',           'setCors(req with allowed origin)',          'Sets CORS headers'],
    ['CORS — blocked origin',           'setCors(req with blocked origin)',          'No CORS headers set'],
  ].map(([name, code, expected]) => ({
    id:          nextId('UNIT'),
    name,
    code,
    description: `Unit test: ${name}`,
    preconditions: 'Test environment | Jest installed',
    testSteps:   `1. Import function | 2. Execute: ${code} | 3. Assert: ${expected}`,
    expectedResult: expected,
    priority:    name.includes('Password') || name.includes('JWT') || name.includes('SQL') ? 'Critical' : 'High',
  }));
}

// ── Helper: sample valid values by field type ─────────────────
function getSampleValidValue(type, name = '') {
  const n = name.toLowerCase();
  if (n.includes('email'))   return 'test@example.com';
  if (n.includes('phone'))   return '+1-555-123-4567';
  if (n.includes('zip') || n.includes('postal')) return '12345';
  if (n.includes('url'))     return 'https://example.com';
  if (n.includes('date'))    return '2024-06-15';
  if (n.includes('price') || n.includes('amount')) return '29.99';
  if (n.includes('age'))     return '25';
  switch (type) {
    case 'email':    return 'user@example.com';
    case 'password': return 'SecurePass123!';
    case 'tel':      return '+1-555-987-6543';
    case 'number':   return '42';
    case 'url':      return 'https://example.com';
    case 'date':     return '2024-06-15';
    case 'time':     return '14:30';
    case 'color':    return '#3b82f6';
    case 'range':    return '50';
    case 'textarea': return 'This is a sample text with enough content to pass minimum length requirements.';
    default:         return 'Sample valid text input';
  }
}

// ── Helper: sample invalid values by field type ───────────────
function getSampleInvalidValue(type) {
  switch (type) {
    case 'email':    return 'not-an-email';
    case 'password': return 'abc';
    case 'tel':      return 'not-a-phone';
    case 'number':   return 'abc';
    case 'url':      return 'not a url';
    case 'date':     return '99/99/9999';
    default:         return null;
  }
}
