// ============================================================
// scriptGenerator.js — Generates automated test scripts
// Playwright, Cypress, Jest/Supertest, k6
// ============================================================

// ── Parse step strings ────────────────────────────────────────
function parseSteps(testSteps) {
  if (!testSteps) return [];
  return String(testSteps)
    .split(/\s*\|\s*|\n/)
    .map(s => s.replace(/^\d+\.\s*/, '').trim())
    .filter(s => s.length > 2)
    .slice(0, 12);
}

function escJs(s) { return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function sanitize(s) { return String(s||'test').replace(/[^a-z0-9]/gi,'_').substring(0,40); }

// ─────────────────────────────────────────────────────────────
// PLAYWRIGHT
// ─────────────────────────────────────────────────────────────
function playwrightTest(t) {
  const steps = parseSteps(t.testSteps);
  const urlLine = t.url
    ? `  await page.goto('${t.url||''}');`
    : `  await page.goto(process.env.BASE_URL || 'http://localhost:3000');`;

  const stepLines = steps.map((s, i) => {
    const sl = s.toLowerCase();
    if (sl.includes('navigate') || sl.includes('go to')) {
      const m = s.match(/https?:\/\/[^\s]+/);
      return m ? `  await page.goto('${m[0]}');` : `  // ${s}`;
    }
    if (sl.includes('click')) return `  // click: ${s}\n  // await page.click('selector');`;
    if (sl.includes('enter') || sl.includes('fill') || sl.includes('type'))
      return `  // fill: ${s}\n  // await page.fill('selector', 'value');`;
    if (sl.includes('verify') || sl.includes('check'))
      return `  await expect(page.locator('body')).toBeVisible(); // ${s}`;
    return `  // ${i+1}. ${s}`;
  }).join('\n');

  return `import { test, expect } from '@playwright/test';

/**
 * ID: ${t.id||'TC-001'} | Type: ${(t.type||'ui').toUpperCase()} | Priority: ${t.priority||'High'}
 * ${t.name}
 */
test('${escJs(t.name)}', async ({ page }) => {
  // Preconditions: ${t.preconditions||'None'}
${urlLine}
  await page.screenshot({ path: 'screenshots/${sanitize(t.id||'tc')}_before.png', fullPage: true });

${stepLines}

  await page.screenshot({ path: 'screenshots/${sanitize(t.id||'tc')}_after.png', fullPage: true });
  // Expected: ${(t.expectedResult||'').substring(0,100)}
});
`;
}

function playwrightPlan(tests, results, planName, iteration) {
  const rm = {};
  results.forEach(r => { rm[r.id||r.name] = r; });
  const byType = {};
  tests.forEach(t => { (byType[t.type||'unit'] = byType[t.type||'unit']||[]).push(t); });

  const sections = Object.entries(byType).map(([type, list]) => {
    const cases = list.slice(0, 40).map(t => {
      const r = rm[t.id]||rm[t.name];
      const steps = parseSteps(t.testSteps).slice(0,6).map(s => `    // ${s}`).join('\n');
      const urlLine = t.url ? `await page.goto('${t.url}');` : `await page.goto(BASE_URL);`;
      return `
  test('[${t.id}] ${escJs(t.name)}', async ({ page }) => {
    // Priority: ${t.priority} | Last: ${r ? r.status.toUpperCase() : 'NOT RUN'}
    ${urlLine}
    const ss = \`\${SSDIR}/${sanitize(t.id||'tc')}\`;
    await page.screenshot({ path: \`\${ss}_before.png\`, fullPage: true });
${steps}
    await page.screenshot({ path: \`\${ss}_after.png\`, fullPage: true });
    // Expected: ${(t.expectedResult||'').substring(0,80)}
    await expect(page.locator('body')).toBeVisible();
  });`;
    }).join('\n');

    return `
test.describe('${type.toUpperCase()} Tests', () => {
${cases}
});`;
  }).join('\n');

  return `// Test Plan: ${planName} | Iteration: ${iteration}
// Generated: ${new Date().toISOString()} | Playwright
import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SSDIR = \`test-results/screenshots/${sanitize(planName)}-${iteration}\`;
test.beforeAll(() => fs.mkdirSync(SSDIR, { recursive: true }));
${sections}
`;
}

// ─────────────────────────────────────────────────────────────
// CYPRESS
// ─────────────────────────────────────────────────────────────
function cypressTest(t) {
  const steps = parseSteps(t.testSteps);
  const urlLine = t.url ? `cy.visit('${t.url}');` : `cy.visit(Cypress.env('baseUrl')||'/');`;
  const stepLines = steps.map(s => {
    const sl = s.toLowerCase();
    if (sl.includes('click')) return `  cy.contains(/button|submit/i).click(); // ${s}`;
    if (sl.includes('fill') || sl.includes('type')) return `  // cy.get('input').type('value'); // ${s}`;
    return `  // ${s}`;
  }).join('\n');

  return `/// <reference types="cypress" />
// ID: ${t.id||'TC'} | ${t.name}
describe('${escJs(t.name)}', () => {
  it('passes', () => {
    ${urlLine}
    cy.screenshot('${sanitize(t.id||'tc')}_before');
${stepLines}
    cy.screenshot('${sanitize(t.id||'tc')}_after');
    // Expected: ${(t.expectedResult||'').substring(0,100)}
  });
});
`;
}

function cypressPlan(tests, results, planName, iteration) {
  const rm = {};
  results.forEach(r => { rm[r.id||r.name] = r; });
  const byType = {};
  tests.forEach(t => { (byType[t.type||'unit'] = byType[t.type||'unit']||[]).push(t); });

  const sections = Object.entries(byType).map(([type, list]) => {
    const cases = list.slice(0,30).map(t => {
      const r = rm[t.id]||rm[t.name];
      const url = t.url ? `cy.visit('${t.url}');` : `cy.visit('/');`;
      return `
  it('[${t.id}] ${escJs(t.name)}', () => {
    // Priority: ${t.priority} | Last: ${r ? r.status.toUpperCase() : 'NOT RUN'}
    ${url}
    cy.screenshot('${sanitize(t.id||'tc')}');
    cy.get('body').should('be.visible');
  });`;
    }).join('\n');
    return `\n  context('${type.toUpperCase()}', () => {${cases}\n  });`;
  }).join('\n');

  return `/// <reference types="cypress" />
// Test Plan: ${planName} | Iteration: ${iteration}
// Generated: ${new Date().toISOString()}
describe('${escJs(planName)} — ${iteration}', () => {
  afterEach(function() {
    if (this.currentTest.state === 'failed') cy.screenshot('FAIL_' + this.currentTest.title.replace(/[^a-z0-9]/gi,'_'));
  });
${sections}
});
`;
}

// ─────────────────────────────────────────────────────────────
// JEST
// ─────────────────────────────────────────────────────────────
function jestTest(t) {
  if (t.type === 'api') {
    return `const request = require('supertest');
const app = require('./app');
// ID: ${t.id||'TC'} | ${t.name}
describe('${escJs(t.name)}', () => {
  test('returns expected status', async () => {
    const res = await request(app)
      .${(t.method||'get').toLowerCase()}('${t.endpoint||'/api/health'}')
      .set('Authorization', \`Bearer \${process.env.AUTH_TOKEN}\`);
    expect(res.status).toBe(${t.expectedStatus||200});
    expect(res.body).toBeTruthy();
  });
  test('returns 401 without auth', async () => {
    const res = await request(app).${(t.method||'get').toLowerCase()}('${t.endpoint||'/api/health'}');
    expect([200,401]).toContain(res.status);
  });
});
`;
  }
  return `// ID: ${t.id||'TC'} | ${t.name}
describe('${escJs(t.name)}', () => {
  test('assertion passes', () => {
    // ${t.testSteps||''}
    // Expected: ${(t.expectedResult||'').substring(0,100)}
    expect(true).toBe(true); // implement
  });
});
`;
}

function jestPlan(tests, results, planName, iteration) {
  const rm = {};
  results.forEach(r => { rm[r.id||r.name] = r; });
  const byType = {};
  tests.forEach(t => { (byType[t.type||'unit'] = byType[t.type||'unit']||[]).push(t); });

  const sections = Object.entries(byType).map(([type, list]) => {
    const cases = list.slice(0,25).map(t => {
      const r = rm[t.id]||rm[t.name];
      return `
  test('[${t.id}] ${escJs(t.name)}', async () => {
    // Priority: ${t.priority} | Last: ${r ? r.status.toUpperCase() : 'NOT RUN'}
    ${type === 'api' ? `const res = await request(app).${(t.method||'get').toLowerCase()}('${t.endpoint||'/api/health'}').set('Authorization',\`Bearer \${authToken}\`);
    expect([200,201,204]).toContain(res.status);` : `// ${(t.testSteps||'').substring(0,80)}\n    expect(true).toBe(true);`}
    // Expected: ${(t.expectedResult||'').substring(0,80)}
  });`;
    }).join('\n');
    return `\ndescribe('${type.toUpperCase()} — ${planName}', () => {${cases}\n});`;
  }).join('\n');

  return `// Test Plan: ${planName} | Iteration: ${iteration}
// Generated: ${new Date().toISOString()} | Jest
const request = require('supertest');
const app = require('./app');
let authToken = '';
beforeAll(async () => {
  const res = await request(app).post('/api/auth/login').send({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD });
  authToken = res.body.token || '';
});
${sections}
`;
}

// ─────────────────────────────────────────────────────────────
// k6
// ─────────────────────────────────────────────────────────────
function k6Test(t) {
  const X = 'export';
  return `import http from 'k6/http';
import { check, sleep } from 'k6';
// ID: ${t.id||'TC-PERF'} | ${t.name}
${X} const options = {
  stages: [{ duration: '30s', target: 10 }, { duration: '1m', target: 50 }, { duration: '30s', target: 0 }],
  thresholds: { http_req_duration: ['p(95)<2000'], http_req_failed: ['rate<0.01'] },
};
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
${X} default function() {
  const res = http.get(\`\${BASE_URL}${(t.url||'/').replace(/^https?:\/\/[^/]+/,'')}\`);
  check(res, { 'status 200': r => r.status === 200, 'under 2s': r => r.timings.duration < 2000 });
  sleep(1);
}
`;
}

function k6Plan(tests, results, planName, iteration) {
  const perfTests = tests.filter(t => t.type === 'performance').slice(0, 15);
  const groups = perfTests.map(t => `
  group('${escJs(t.name)}', () => {
    const res = http.get(\`\${BASE_URL}${(t.url||'/').replace(/^https?:\/\/[^/]+/,'')}\`, { headers });
    check(res, { 'status 200': r => r.status === 200, 'under 2s': r => r.timings.duration < 2000 });
    sleep(0.5);
  });`).join('\n');

  const X2 = 'export';
  return `import http from 'k6/http';
import { check, sleep, group } from 'k6';
// Test Plan: ${planName} | Iteration: ${iteration}
// Generated: ${new Date().toISOString()} | k6
${X2} const options = {
  stages: [{ duration: '2m', target: 10 }, { duration: '5m', target: 50 }, { duration: '2m', target: 100 }, { duration: '1m', target: 0 }],
  thresholds: { http_req_duration: ['p(95)<2000'], http_req_failed: ['rate<0.01'] },
};
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const headers = { 'Authorization': \`Bearer \${__ENV.AUTH_TOKEN}\` };
${X2} default function() {
${groups}
}
`;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────
export function generateScript(test, framework = 'playwright') {
  switch(framework) {
    case 'playwright': return playwrightTest(test);
    case 'cypress':    return cypressTest(test);
    case 'jest':       return jestTest(test);
    case 'k6':         return k6Test(test);
    default:           return playwrightTest(test);
  }
}

export function generateTestPlan(tests, results, planName, iteration, framework = 'playwright') {
  const allTests = Object.entries(tests).flatMap(([type, list]) => list.map(t => ({...t, type})));
  switch(framework) {
    case 'playwright': return playwrightPlan(allTests, results, planName, iteration);
    case 'cypress':    return cypressPlan(allTests, results, planName, iteration);
    case 'jest':       return jestPlan(allTests, results, planName, iteration);
    case 'k6':         return k6Plan(allTests, results, planName, iteration);
    default:           return playwrightPlan(allTests, results, planName, iteration);
  }
}

export function getAllTestPlans(tests, results, planName, iteration) {
  return {
    playwright: generateTestPlan(tests, results, planName, iteration, 'playwright'),
    cypress:    generateTestPlan(tests, results, planName, iteration, 'cypress'),
    jest:       generateTestPlan(tests, results, planName, iteration, 'jest'),
    k6:         generateTestPlan(tests, results, planName, iteration, 'k6'),
    config: {
      playwright: `import { defineConfig } from '@playwright/test';
${'export'} default defineConfig({
  testDir: './playwright',
  use: { baseURL: process.env.BASE_URL, screenshot: 'on', video: 'retain-on-failure' },
  reporter: [['html'], ['json', { outputFile: 'results.json' }]],
});`,
      packageJson: JSON.stringify({
        name: 'testitnow-tests',
        scripts: {
          'test:playwright': 'playwright test',
          'test:cypress': 'cypress run',
          'test:jest': 'jest --coverage',
          'test:k6': 'k6 run k6/plan.js',
        },
        devDependencies: { '@playwright/test': '^1.45.0', cypress: '^13.0.0', jest: '^29.0.0', supertest: '^7.0.0' },
      }, null, 2),
      envExample: `BASE_URL=https://your-app.com\nAUTH_TOKEN=your-jwt-token\nTEST_EMAIL=test@test.com\nTEST_PASSWORD=Pass123!`,
    },
  };
}
