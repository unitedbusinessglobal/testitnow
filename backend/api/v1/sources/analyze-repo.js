// ============================================================
// api/v1/sources/analyze-repo.js
// Fetches GitHub/GitLab repo structure and generates test cases
// from: file tree, README, package.json, routes, API files
// POST /api/v1/sources/analyze-repo
// ============================================================

import { query }                from '../../../lib/db.js';
import { requireAuth, setCors } from '../../../lib/auth.js';
import { generateAllTestCases, resetCounter } from '../../../lib/testGenerator.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const { sourceId, repoOwner, repoName, branch = 'main', provider = 'github', accessToken, projectId } = req.body || {};

  if (!repoOwner || !repoName) {
    return res.status(400).json({ error: 'repoOwner and repoName are required' });
  }

  try {
    // ── Fetch repo data ──────────────────────────────────────
    const repoData = await fetchRepoData(provider, repoOwner, repoName, branch, accessToken);
    console.log(`[analyze-repo] Fetched ${repoData.files.length} files from ${repoOwner}/${repoName}`);

    // ── Generate test cases from repo structure ────────────
    resetCounter();
    const generated = generateRepoTestCases(repoData, repoOwner, repoName, branch, provider);
    const total     = Object.values(generated).reduce((s,a) => s + a.length, 0);
    console.log(`[analyze-repo] Generated ${total} test cases`);

    // ── Save to DB ─────────────────────────────────────────
    if (projectId) {
      const saved = { ui:[], api:[], security:[], performance:[], database:[], unit:[] };
      let savedCount = 0;

      for (const [type, list] of Object.entries(generated)) {
        if (!list.length) continue;
        const chunks = chunkArray(list, 100);

        for (const chunk of chunks) {
          try {
            const values = [];
            const params = [];
            let pIdx = 1;

            for (const tc of chunk) {
              const key = (tc.id || `REPO-${type.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`).substring(0,99);
              values.push(`($${pIdx},$${pIdx+1},$${pIdx+2},$${pIdx+3},$${pIdx+4},$${pIdx+5},$${pIdx+6},$${pIdx+7},$${pIdx+8},$${pIdx+9},'Draft',$${pIdx+10},$${pIdx+11})`);
              params.push(
                key, projectId, type,
                (tc.name||'Test').substring(0,499),
                tc.description ? tc.description.substring(0,2000) : null,
                tc.preconditions ? tc.preconditions.substring(0,1000) : null,
                tc.testSteps ? JSON.stringify({steps:tc.testSteps.split(' | ')}) : null,
                tc.testData  ? JSON.stringify({data:tc.testData}) : null,
                tc.expectedResult ? tc.expectedResult.substring(0,2000) : null,
                tc.priority || 'High',
                decoded.userId,
                sourceId || null,
              );
              pIdx += 12;
            }

            const { rows } = await query(
              `INSERT INTO test_cases
                 (test_case_key,project_id,test_case_type,summary,description,
                  preconditions,test_steps,test_data,expected_result,priority,status,created_by,source_id)
               VALUES ${values.join(',')}
               ON CONFLICT (test_case_key) DO UPDATE SET summary=EXCLUDED.summary,updated_at=NOW()
               RETURNING test_case_id, test_case_key`,
              params,
            );
            rows.forEach((row,i) => {
              saved[type].push({...chunk[i], dbId:row.test_case_id, dbKey:row.test_case_key});
              savedCount++;
            });
          } catch (e) {
            console.error(`[analyze-repo] Insert error:`, e.message.substring(0,100));
            chunk.forEach(tc => saved[type].push(tc));
          }
        }
      }

      // Update source stats
      if (sourceId) {
        await query(
          `UPDATE sources SET
             last_analyzed_at = NOW(),
             analysis_count   = analysis_count + 1,
             cached_test_count = $1
           WHERE source_id = $2`,
          [savedCount, sourceId],
        );
      }

      return res.status(200).json({
        success: true,
        generated: saved,
        meta: {
          provider, repoOwner, repoName, branch,
          filesAnalyzed: repoData.files.length,
          totalGenerated: total,
          savedToDB: savedCount,
          breakdown: Object.fromEntries(Object.entries(saved).map(([k,v])=>[k,v.length])),
          detectedStack: repoData.stack,
          routes: repoData.routes.slice(0,20),
        },
      });
    }

    return res.status(200).json({
      success: true, generated,
      meta: { provider, repoOwner, repoName, branch, totalGenerated: total, detectedStack: repoData.stack },
    });

  } catch (err) {
    console.error('[analyze-repo]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── Fetch repo structure from GitHub or GitLab ────────────────
async function fetchRepoData(provider, owner, repo, branch, token) {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'TestItNow/1.0',
  };
  if (token) {
    headers['Authorization'] = provider === 'github'
      ? `Bearer ${token}`
      : `Bearer ${token}`;
  }

  let files     = [];
  let readme    = '';
  let pkgJson   = null;
  let routes    = [];
  let stack     = [];

  try {
    if (provider === 'github') {
      // Get file tree
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        { headers }
      );
      if (!treeRes.ok) throw new Error(`GitHub API error: ${treeRes.status} ${treeRes.statusText}`);
      const treeData = await treeRes.json();
      files = (treeData.tree || []).filter(f => f.type === 'blob').map(f => f.path);

      // Fetch key files
      readme  = await fetchFileContent(`https://api.github.com/repos/${owner}/${repo}/contents/README.md`, headers);
      pkgJson = await fetchFileContent(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, headers);

    } else if (provider === 'gitlab') {
      const projectPath = encodeURIComponent(`${owner}/${repo}`);
      const treeRes = await fetch(
        `https://gitlab.com/api/v4/projects/${projectPath}/repository/tree?recursive=true&per_page=200&ref=${branch}`,
        { headers: { ...headers, ...(token ? {'PRIVATE-TOKEN': token} : {}) } }
      );
      if (!treeRes.ok) throw new Error(`GitLab API error: ${treeRes.status} ${treeRes.statusText}`);
      const treeData = await treeRes.json();
      files = (treeData || []).filter(f => f.type === 'blob').map(f => f.path);
    }

    // Detect tech stack from files
    stack = detectStack(files, pkgJson);

    // Extract routes from file paths
    routes = extractRoutesFromFiles(files, stack);

  } catch (err) {
    console.warn(`[fetchRepoData] ${err.message} — using file list only`);
    files = [];
  }

  return { files, readme, pkgJson, routes, stack, owner, repo, branch };
}

async function fetchFileContent(url, headers) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch { return null; }
}

// ── Detect tech stack from files ──────────────────────────────
function detectStack(files, pkgJson) {
  const stack = [];
  const allFiles = files.join(' ').toLowerCase();

  if (pkgJson) {
    try {
      const pkg = typeof pkgJson === 'string' ? JSON.parse(pkgJson) : pkgJson;
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.react)      stack.push('React');
      if (deps.next)       stack.push('Next.js');
      if (deps.vue)        stack.push('Vue.js');
      if (deps.angular)    stack.push('Angular');
      if (deps.express)    stack.push('Express.js');
      if (deps.fastify)    stack.push('Fastify');
      if (deps.nestjs || deps['@nestjs/core']) stack.push('NestJS');
      if (deps.typescript) stack.push('TypeScript');
      if (deps.prisma || deps['@prisma/client']) stack.push('Prisma');
      if (deps.mongoose)   stack.push('MongoDB/Mongoose');
      if (deps.sequelize)  stack.push('Sequelize');
      if (deps.pg)         stack.push('PostgreSQL');
      if (deps.jest || deps.vitest) stack.push('Testing Framework');
      if (deps.stripe)     stack.push('Stripe Payments');
      if (deps.socket || deps['socket.io']) stack.push('WebSockets');
    } catch {}
  }

  if (allFiles.includes('.py') || allFiles.includes('requirements.txt')) stack.push('Python');
  if (allFiles.includes('.go') || allFiles.includes('go.mod'))            stack.push('Go');
  if (allFiles.includes('.java') || allFiles.includes('pom.xml'))         stack.push('Java');
  if (allFiles.includes('.php') || allFiles.includes('composer.json'))    stack.push('PHP');
  if (allFiles.includes('.rb') || allFiles.includes('gemfile'))           stack.push('Ruby on Rails');
  if (allFiles.includes('dockerfile'))                                     stack.push('Docker');
  if (allFiles.includes('kubernetes') || allFiles.includes('k8s'))        stack.push('Kubernetes');

  return [...new Set(stack)];
}

// ── Extract routes from file structure ────────────────────────
function extractRoutesFromFiles(files, stack) {
  const routes = [];

  // Next.js app router
  files.filter(f => f.match(/app\/(.+)\/page\.(tsx?|jsx?)$/)).forEach(f => {
    const match = f.match(/app\/(.+)\/page\./);
    if (match) routes.push({ path: '/' + match[1].replace(/\[(.+?)\]/g, ':$1'), source: 'nextjs-app-router' });
  });

  // Next.js pages router
  files.filter(f => f.match(/pages\/(.+)\.(tsx?|jsx?)$/) && !f.includes('_app') && !f.includes('_document')).forEach(f => {
    const match = f.match(/pages\/(.+)\./);
    if (match) routes.push({ path: '/' + match[1].replace(/index$/, '').replace(/\[(.+?)\]/g, ':$1'), source: 'nextjs-pages' });
  });

  // Express/Fastify routes
  files.filter(f => f.match(/routes?\//i)).forEach(f => {
    const name = f.split('/').pop().replace(/\.(ts|js)x?$/, '');
    if (name && !name.startsWith('_') && !name.startsWith('.')) {
      routes.push({ path: '/' + name.replace(/\.router$/, '').replace(/Route$/, ''), source: 'express-routes' });
    }
  });

  // API directory
  files.filter(f => f.match(/api\/(.+)\.(ts|js)x?$/)).forEach(f => {
    const match = f.match(/api\/(.+)\./);
    if (match) routes.push({ path: '/api/' + match[1], source: 'api-file' });
  });

  // Controllers
  files.filter(f => f.match(/controllers?\//i)).forEach(f => {
    const name = f.split('/').pop().replace(/\.(ts|js)x?$/, '').replace(/controller/i, '');
    if (name) routes.push({ path: '/' + name.toLowerCase(), source: 'controller' });
  });

  return [...new Map(routes.map(r => [r.path, r])).values()].slice(0, 50);
}

// ── Generate test cases from repo data ────────────────────────
function generateRepoTestCases(repoData, owner, repo, branch, provider) {
  const { files, routes, stack } = repoData;
  const repoUrl = provider === 'github'
    ? `https://github.com/${owner}/${repo}`
    : `https://gitlab.com/${owner}/${repo}`;

  const all = { ui:[], api:[], security:[], performance:[], database:[], unit:[] };
  let counter = 1;
  const id = (prefix) => `REPO-${prefix}-${String(counter++).padStart(4,'0')}`;

  // ── 1. Repository structure tests ─────────────────────────
  const structureTests = [
    [`Repository accessible at ${repoUrl}`,       'Clone repo | Verify accessible | Check permissions'],
    [`Branch "${branch}" exists`,                  `git checkout ${branch} | Verify branch exists`],
    [`README.md exists and is complete`,           'Check README | Title | Description | Installation | Usage | Contributing'],
    [`.gitignore present and correct`,             'Check .gitignore | node_modules excluded | .env excluded | build/ excluded'],
    [`package.json / requirements.txt valid`,      'Validate dependency file | No audit vulnerabilities | Correct version ranges'],
    [`No secrets committed`,                       'Search for API keys | Passwords | Connection strings in all files'],
    [`CI/CD pipeline configured`,                  'Check .github/workflows or .gitlab-ci.yml | Pipeline valid | Tests run on push'],
    [`Environment variables documented`,           'Check .env.example | All vars documented | No defaults for secrets'],
    [`License file present`,                       'Check LICENSE | Compatible with usage | Correct copyright'],
    [`Code structure follows conventions`,         'Directory structure logical | Separation of concerns | No circular deps'],
  ];

  structureTests.forEach(([name, steps]) => {
    all.unit.push({ id:id('REPO-STRUCT'), name:`[Repo] ${name}`, description:`Repository structure: ${name}`,
      preconditions:'Repository access | Git installed', testSteps:steps,
      expectedResult:`${name} passes`, priority:'High' });
  });

  // ── 2. Tech stack specific tests ──────────────────────────
  stack.forEach(tech => {
    const techTests = getTechTests(tech, repoUrl);
    techTests.forEach(([name, steps, expected, type]) => {
      all[type || 'unit'].push({
        id: id(`TECH-${tech.toUpperCase().replace(/\W/g,'').substring(0,6)}`),
        name: `[${tech}] ${name}`,
        description: `${tech} specific: ${name}`,
        preconditions: `${tech} environment configured`,
        testSteps: steps,
        expectedResult: expected,
        priority: 'High',
      });
    });
  });

  // ── 3. Route-based tests ──────────────────────────────────
  routes.forEach((route, ri) => {
    const isApi   = route.path.startsWith('/api');
    const hasParam = route.path.includes(':');

    if (isApi) {
      ['GET','POST','PUT','DELETE','PATCH'].slice(0, hasParam ? 4 : 2).forEach(method => {
        all.api.push({
          id: id('ROUTE-API'),
          name: `[${route.source}] ${method} ${route.path}`,
          method, endpoint: route.path,
          description: `Test API route ${method} ${route.path} from ${route.source}`,
          preconditions: 'App running | Auth token available',
          testSteps: `1. Send ${method} request to ${route.path} | 2. With valid payload | 3. Verify status | 4. Validate response schema | 5. Check response time`,
          expectedResult: `Status ${method==='POST'?'201':method==='DELETE'?'204':'200'} | Valid response | < 500ms`,
          priority: ri < 5 ? 'Critical' : 'High',
        });

        // Auth test
        all.api.push({
          id: id('ROUTE-API-AUTH'),
          name: `[${route.source}] ${method} ${route.path} — Unauthorised`,
          method, endpoint: route.path,
          description: `Verify ${route.path} requires auth`,
          preconditions: 'No auth token',
          testSteps: `1. Send ${method} to ${route.path} | 2. No Authorization header | 3. Verify 401`,
          expectedResult: 'HTTP 401 | Error message | No data returned',
          priority: 'Critical',
        });
      });

      // Security per route
      all.security.push({
        id: id('ROUTE-SEC'),
        name: `[Security] ${route.path} — SQL injection`,
        endpoint: route.path,
        description: `SQL injection test on ${route.path}`,
        preconditions: 'Route accessible',
        testSteps: `1. Send request to ${route.path} | 2. Inject SQL: ' OR '1'='1 | 3. Check response`,
        expectedResult: 'Input rejected | No DB error | HTTP 400',
        priority: 'Critical',
      });

    } else {
      // UI route
      all.ui.push({
        id: id('ROUTE-UI'),
        name: `[${route.source}] Page: ${route.path}`,
        url: route.path,
        description: `UI test for route ${route.path} (from ${route.source})`,
        preconditions: 'App running in browser',
        testSteps: `1. Navigate to ${route.path} | 2. Verify page loads | 3. Verify correct component renders | 4. Check no console errors | 5. Verify responsive`,
        expectedResult: `${route.path} renders correctly | No errors | Responsive on all breakpoints`,
        priority: 'High',
      });
    }
  });

  // ── 4. File-type based tests ──────────────────────────────
  // Component files
  const componentFiles = files.filter(f => f.match(/\.(tsx?|jsx?)$/) && !f.includes('.test.') && !f.includes('.spec.'));
  componentFiles.slice(0, 30).forEach(file => {
    all.unit.push({
      id: id('COMP'),
      name: `[Unit] Component: ${file.split('/').pop().replace(/\.(tsx?|jsx?)$/,'')}`,
      description: `Unit test for ${file}`,
      preconditions: 'Jest/Vitest installed | Component importable',
      testSteps: `1. Import component from ${file} | 2. Render with default props | 3. Verify renders without error | 4. Test all props | 5. Test user interactions | 6. Check snapshot`,
      expectedResult: 'Renders without errors | All props work | Interactions correct | Snapshot matches',
      priority: 'High',
    });
  });

  // Test files (verify they exist and pass)
  const testFiles = files.filter(f => f.match(/\.(test|spec)\.(tsx?|jsx?|py|go|java)$/));
  testFiles.forEach(file => {
    all.unit.push({
      id: id('TEST-FILE'),
      name: `[Existing Test] ${file.split('/').pop()}`,
      description: `Verify existing test file ${file} passes`,
      preconditions: 'Test runner installed | Dependencies installed',
      testSteps: `1. Run test file: ${file} | 2. Verify 0 failures | 3. Check coverage | 4. Verify no flaky tests`,
      expectedResult: `All tests in ${file} pass | Coverage ≥ 80% | Tests deterministic`,
      priority: 'Critical',
    });
  });

  // Database migration files
  const migrationFiles = files.filter(f => f.includes('migration') || f.includes('migrate'));
  if (migrationFiles.length) {
    all.database.push({
      id: id('DB-MIGRATE'),
      name: `[DB] ${migrationFiles.length} migration files — Run and verify`,
      description: 'Verify all database migrations run cleanly',
      preconditions: 'Database running | Migration tool installed',
      testSteps: `1. Run migrations: ${migrationFiles.slice(0,5).join(', ')} | 2. Verify no errors | 3. Check schema matches | 4. Rollback and reapply`,
      expectedResult: 'All migrations succeed | Schema correct | Rollback works | Idempotent',
      priority: 'Critical',
    });
  }

  // ── 5. Security tests for repo ────────────────────────────
  const secTests = [
    ['Dependency vulnerabilities', `npm audit / pip check | Verify 0 critical CVEs`, 'No critical vulnerabilities in dependencies'],
    ['Secret scanning', 'Search for hardcoded secrets | API keys | Passwords | Tokens', 'No secrets committed to repo'],
    ['SAST scan', 'Run static analysis | Check for SQL injection patterns | XSS patterns', 'No SAST findings'],
    ['License compliance', 'Check all dependency licenses | Verify GPL/MIT compatibility', 'All licenses compatible'],
    ['Docker security', files.some(f=>f.toLowerCase().includes('dockerfile')) ? 'Scan Dockerfile | Verify base image | Check for root user' : 'N/A - No Dockerfile', 'Base image trusted | No root | Minimal attack surface'],
  ];
  secTests.forEach(([name, steps, expected]) => {
    all.security.push({
      id: id('REPO-SEC'),
      name: `[Repo Security] ${name}`,
      description: `Repository security: ${name}`,
      preconditions: 'Security tools available',
      testSteps: steps,
      expectedResult: expected,
      priority: 'Critical',
    });
  });

  // ── 6. Performance tests ──────────────────────────────────
  const perfTests = [
    ['Build time', 'npm run build | Measure total build time | Target < 60s'],
    ['Bundle size analysis', 'npm run build | Check output size | JS < 500KB gzipped'],
    ['Lighthouse CI', 'Run lighthouse on deployed app | All scores > 80'],
    ['Load testing', 'k6 run load test | 100 virtual users | P95 < 2s'],
    ['Memory usage', 'Monitor app under load | Heap < 512MB | No memory leak'],
  ];
  perfTests.forEach(([name, steps]) => {
    all.performance.push({
      id: id('REPO-PERF'),
      name: `[Performance] ${name}`,
      description: `Performance: ${name}`,
      preconditions: 'Build tools available',
      testSteps: steps,
      expectedResult: `${name} meets target`,
      priority: 'High',
    });
  });

  return all;
}

// ── Tech-stack specific tests ─────────────────────────────────
function getTechTests(tech, repoUrl) {
  const tests = {
    'React': [
      ['Components render without errors',       'Import each component | Render with RTL | Verify no crash',              'All components render cleanly',                    'unit'],
      ['Props validation (TypeScript/PropTypes)', 'Check each component has typed props | Verify no any types',             'Props typed correctly | No implicit any',           'unit'],
      ['State management works',                 'Test useState/useReducer | Test context | Test Redux if used',            'State updates correctly | No stale state',          'unit'],
      ['useEffect cleanup',                       'Verify effects have cleanup | No memory leaks on unmount',               'Effects cleaned up on unmount | No warnings',       'unit'],
      ['React Router routes',                    'Navigate to each route | Verify component renders | Test 404',            'All routes render correct component',               'ui'],
      ['Error boundaries',                       'Throw error in child | Verify error boundary catches | UI not crashed',   'Error boundary catches errors | Fallback shown',    'unit'],
    ],
    'Next.js': [
      ['SSR pages render correctly',             'Request each SSR page | Verify HTML in response | Check SEO tags',        'SSR pages return HTML | Meta tags present',         'ui'],
      ['API routes respond correctly',           'Test each /api/* route | Verify response | Check status codes',           'All API routes functional',                         'api'],
      ['Static generation (SSG) works',          'Run next build | Verify static pages generated | Check _next folder',    'Static pages generated | Fast load time',           'unit'],
      ['Image optimisation',                     'Check next/image usage | Verify WebP served | Verify lazy loading',       'Images optimised | WebP format | Lazy loaded',      'performance'],
      ['Middleware functions',                   'Test middleware/index.ts | Auth redirect | Header injection',              'Middleware applies correctly | Redirects work',      'unit'],
      ['Environment variables',                 'Check NEXT_PUBLIC_ vars | Verify server-only vars not exposed',            'Public vars accessible client-side | Private secure','unit'],
    ],
    'Express.js': [
      ['All routes return correct status',       'Test each route | GET/POST/PUT/DELETE | Verify status codes',            'All routes return expected status',                 'api'],
      ['Error middleware works',                 'Trigger errors | Verify error middleware catches | JSON error response', 'Errors handled | No stack traces in prod',          'api'],
      ['Request validation',                     'Send invalid body | Verify 400 | Check error message detail',            'Invalid requests rejected with 400',                'api'],
      ['Rate limiting configured',               'Send 100 rapid requests | Verify 429 after limit | Check headers',       'Rate limiting active | 429 returned correctly',     'security'],
      ['CORS headers correct',                   'Cross-origin request | Verify CORS headers | Blocked origins rejected', 'CORS correctly configured',                         'security'],
      ['Authentication middleware',              'Request protected route without token | Verify 401 | With token verify 200', 'Auth middleware works correctly',               'security'],
    ],
    'TypeScript': [
      ['No TypeScript errors',                   'npx tsc --noEmit | Verify 0 errors',                                     '0 TypeScript compilation errors',                   'unit'],
      ['Strict mode enabled',                    'Check tsconfig.json | strict: true | noImplicitAny: true',               'Strict mode enabled | No implicit any',             'unit'],
      ['Types exported correctly',               'Check types/index.ts | All public types exported | No any types',        'Types complete and correct | No any',               'unit'],
    ],
    'PostgreSQL': [
      ['Connection pool health',                 'SELECT 1 | Verify connection | Check pool size',                         'Pool healthy | Connection < 50ms',                  'database'],
      ['Migrations run cleanly',                 'Run all migrations | Verify schema | Rollback test',                     'All migrations succeed | Rollback works',           'database'],
      ['Indexes on foreign keys',                'Check all FK columns have indexes | EXPLAIN queries',                    'All FKs indexed | Queries use indexes',             'database'],
      ['Transactions work correctly',            'Test BEGIN/COMMIT/ROLLBACK | Concurrent write test',                     'Transactions atomic | No deadlocks',               'database'],
    ],
    'Stripe Payments': [
      ['Webhook signature verification',         'Send webhook without signature | Verify rejected | With signature accepted', 'Signatures verified | Invalid rejected',       'security'],
      ['Test mode vs live mode',                 'Verify STRIPE_SECRET_KEY starts with sk_test_ in test | sk_live_ in prod', 'Correct keys per environment',                 'unit'],
      ['Payment success flow',                   'Use test card 4242... | Complete payment | Verify webhook | Order created', 'Payment succeeds | Order created | Webhook handled', 'api'],
      ['Payment failure flow',                   'Use declined card 4000... | Verify error | No order created',            'Failure handled gracefully | User notified',        'api'],
    ],
    'Docker': [
      ['Dockerfile builds successfully',         'docker build . | Verify 0 errors | Check image size',                   'Image builds < 5 min | Size < 500MB',               'unit'],
      ['Container starts correctly',             'docker run image | Verify app starts | Check health endpoint',           'Container starts | Health check passes',            'unit'],
      ['Environment variables injected',        'docker run --env-file .env | Verify vars available | No hardcoded values', 'Env vars injected correctly',                  'unit'],
      ['Docker Compose services start',         'docker-compose up | All services healthy | Dependencies wait',            'All services start | Health checks pass',           'unit'],
    ],
  };

  return tests[tech] || [];
}

function chunkArray(arr, size) {
  const out = [];
  for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size));
  return out;
}
