import http from 'http';
import app from '../api/index.js';

const PORT = 3099;
const server = http.createServer(app);

async function runTests() {
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`[TEST] Vercel API test server listening on port ${PORT}`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // Test 1: GET /api/public/journal
    console.log('\nTest 1: GET /api/public/journal');
    const res1 = await fetch(`http://localhost:${PORT}/api/public/journal`);
    const data1 = await res1.json();
    assert(res1.status === 200, `Status is 200 (got ${res1.status})`);
    assert(typeof data1.isPublished === 'boolean', `isPublished is boolean (${data1.isPublished})`);

    // Test 2: GET /public/journal (direct fallback without prefix)
    console.log('\nTest 2: GET /public/journal (fallback without prefix)');
    const res2 = await fetch(`http://localhost:${PORT}/public/journal`);
    const data2 = await res2.json();
    assert(res2.status === 200, `Status is 200 (got ${res2.status})`);
    assert(typeof data2.isPublished === 'boolean', `isPublished is boolean (${data2.isPublished})`);

    // Test 3: GET /api/health
    console.log('\nTest 3: GET /api/health');
    const res3 = await fetch(`http://localhost:${PORT}/api/health`);
    const data3 = await res3.json();
    assert(res3.status === 200, `Status is 200 (got ${res3.status})`);
    assert(data3.status === 'ok', `status is ok (${data3.status})`);

    // Test 4: POST /api/admin/publish with validation
    console.log('\nTest 4: POST /api/admin/publish (CSRF Origin & validation)');
    const invalidPayloadRes = await fetch(`http://localhost:${PORT}/api/admin/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: `localhost:${PORT}`,
        Origin: `http://localhost:${PORT}`,
      },
      body: JSON.stringify({ invalid: true }),
    });
    const invalidData = await invalidPayloadRes.json();
    assert(invalidPayloadRes.status === 400, `Status is 400 for invalid payload (got ${invalidPayloadRes.status})`);
    assert(typeof invalidData.error === 'string', `Returns validation error: ${invalidData.error}`);

    // Test 5: Verify old auth endpoints return 404 (removed)
    console.log('\nTest 5: Verify old auth endpoints are removed');
    const resMe = await fetch(`http://localhost:${PORT}/api/auth/me`);
    const dataMe = await resMe.json();
    assert(resMe.status === 404, `GET /api/auth/me is 404 (got ${resMe.status})`);
    assert(dataMe.error === 'API route not found', `Returns JSON error`);

    const resLogin = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test' }),
    });
    const dataLogin = await resLogin.json();
    assert(resLogin.status === 404, `POST /api/auth/login is 404 (got ${resLogin.status})`);
    assert(dataLogin.error === 'API route not found', `Returns JSON error`);

    // Test 6: Non-existent API route must return JSON 404, NEVER HTML
    console.log('\nTest 6: GET /api/nonexistent (JSON 404 check, NEVER HTML)');
    const res6 = await fetch(`http://localhost:${PORT}/api/nonexistent`);
    const contentType6 = res6.headers.get('content-type') || '';
    const data6 = await res6.json();
    assert(res6.status === 404, `Status is 404`);
    assert(contentType6.includes('application/json'), `Content-Type is JSON (${contentType6})`);
    assert(data6.error === 'API route not found', `Returned JSON error`);

    console.log(`\n========================================`);
    console.log(`Vercel API Verification Results: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
