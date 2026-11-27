import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { request } from '@playwright/test';

export function settings(env) {
  const url = new URL(env.AUTH_VERIFY_ORIGIN);
  const idle = Number(env.AUTH_VERIFY_IDLE_SECONDS);
  const absolute = env.AUTH_VERIFY_ABSOLUTE_SECONDS === undefined ? undefined : Number(env.AUTH_VERIFY_ABSOLUTE_SECONDS);
  if (env.AUTH_VERIFY_SYNTHETIC !== 'yes' || url.protocol !== 'https:' ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      !env.AUTH_VERIFY_CREDENTIALS || !Number.isInteger(idle) || idle < 1 || idle > 3600) {
    throw new Error('Explicit synthetic HTTPS origin, private credentials file and idle seconds (1–3600) required.');
  }
  if (absolute !== undefined && (!Number.isSafeInteger(absolute) || absolute <= idle || absolute > 86_400)) {
    throw new Error('Absolute seconds must exceed idle seconds and fit within one day.');
  }
  return { origin: url.origin, idle, ...(absolute === undefined ? {} : { absolute }) };
}

async function main() {
  const { origin, idle, absolute } = settings(process.env);
  const fixture = JSON.parse(readFileSync(process.env.AUTH_VERIFY_CREDENTIALS, 'utf8'));
  if (!fixture.administrator || !fixture.password) throw new Error('Missing synthetic administrator credentials.');
  const prefix = `synthetic-auth06-${randomBytes(6).toString('hex')}`;
  const password = randomBytes(24).toString('base64url');
  const results = [];
  const contexts = [];
  const created = [];
  let admin;
  let absoluteVerified = false;
  let stage = 'trusted HTTPS readiness';
  const check = (ok) => { if (!ok) throw new Error('Check failed.'); };
  const pass = () => { results.push({ check: stage, status: 'passed' }); console.log(`PASS: ${stage}`); };
  async function context(headers = {}) {
    const api = await request.newContext({ baseURL: origin, timeout: 90000, maxRedirects: 0, extraHTTPHeaders: headers });
    contexts.push(api);
    return api;
  }
  async function login(api, identifier, secret = password) {
    return api.post('/api/v1/auth/login', { headers: { Origin: origin }, data: { loginIdentifier: identifier, password: secret } });
  }
  async function csrf() {
    const response = await admin.get('/api/v1/auth/session');
    check(response.status() === 200);
    return { Origin: origin, 'X-CSRF-Token': (await response.json()).csrfToken };
  }
  async function create(suffix) {
    const response = await admin.post('/api/v1/admin/staff', {
      headers: await csrf(), data: { loginIdentifier: `${prefix}-${suffix}`, password, roles: ['billing'] },
    });
    check(response.status() === 201);
    const staff = await response.json();
    created.push(staff.id);
    return staff;
  }
  try {
    const anonymous = await context();
    const ready = await anonymous.get('/api/v1/ready');
    console.log(`Readiness HTTP status: ${ready.status()}`);
    check(ready.status() === 200);
    for (const route of ['/auth/session', '/patients', '/admin/staff']) {
      check((await anonymous.get(`/api/v1${route}`)).status() === 401);
    }
    pass();
    stage = 'administrator login, secure host cookie and role boundaries';
    admin = await context();
    const response = await login(admin, fixture.administrator, fixture.password);
    console.log(`Administrator login HTTP status: ${response.status()}`);
    check(response.status() === 200);
    stage = 'authentication response prohibits caching';
    check(response.headers()['cache-control'] === 'no-store');
    stage = 'secure host-only session cookie attributes';
    const header = response.headers()['set-cookie'] ?? '';
    check(header.startsWith('__Host-ayurflow_session=') && /; Secure/i.test(header) &&
      /; HttpOnly/i.test(header) && /; SameSite=Lax/i.test(header) && /; Path=\//i.test(header) && !/; Domain=/i.test(header));
    stage = 'administrator role boundaries';
    const staffList = await admin.get('/api/v1/admin/staff');
    const patientList = await admin.get('/api/v1/patients?q=Synthetic');
    console.log(`Administrator staff/patient HTTP statuses: ${staffList.status()}/${patientList.status()}`);
    check(staffList.status() === 200 && patientList.status() === 403);
    pass();
    stage = 'missing/stale CSRF and foreign Origin preserve staff state';
    const stale = await csrf();
    const fresh = await csrf();
    const data = { loginIdentifier: `${prefix}-denied`, password, roles: ['billing'] };
    for (const headers of [{ Origin: origin }, stale, { ...fresh, Origin: 'https://foreign.invalid' }]) {
      check((await admin.post('/api/v1/admin/staff', { headers, data })).status() === 403);
    }
    // The exact denied identifier must still be available after all rejected requests.
    const accepted = await admin.post('/api/v1/admin/staff', { headers: fresh, data });
    check(accepted.status() === 201);
    created.push((await accepted.json()).id);
    pass();
    stage = 'role change and disabling revoke sessions; disabled login is generic';
    const target = await create('managed');
    const managed = await context();
    check((await login(managed, target.loginIdentifier)).status() === 200);
    check((await managed.get('/api/v1/admin/staff')).status() === 403);
    check((await admin.put(`/api/v1/admin/staff/${target.id}/roles`, { headers: await csrf(), data: { roles: ['receptionist'] } })).status() === 200);
    check((await managed.get('/api/v1/patients?q=Synthetic')).status() === 401);
    check((await login(managed, target.loginIdentifier)).status() === 200);
    check((await managed.get('/api/v1/patients?q=Synthetic')).status() === 200);
    check((await admin.post(`/api/v1/admin/staff/${target.id}/disable`, { headers: await csrf() })).status() === 204);
    check((await managed.get('/api/v1/patients?q=Synthetic')).status() === 401);
    const disabled = await login(managed, target.loginIdentifier);
    check(disabled.status() === 401 && (await disabled.json()).error.code === 'invalid_credentials');
    pass();
    stage = 'logout rejects replay of the former session';
    const logoutTarget = await create('logout');
    const loggedIn = await context();
    const loggedResponse = await login(loggedIn, logoutTarget.loginIdentifier);
    check(loggedResponse.status() === 200);
    const cookies = (await loggedIn.storageState()).cookies;
    const cookie = cookies.find(item => item.name === '__Host-ayurflow_session');
    check(Boolean(cookie));
    check((await loggedIn.post('/api/v1/auth/logout', { headers: { Origin: origin, 'X-CSRF-Token': (await loggedResponse.json()).csrfToken } })).status() === 204);
    const replay = await context({ Cookie: `${cookie.name}=${cookie.value}` });
    check((await replay.get('/api/v1/auth/session')).status() === 401);
    pass();
    stage = 'configured three-failure identifier throttling';
    const throttle = await create('throttle');
    const attacker = await context();
    for (let i = 0; i < 3; i++) check((await login(attacker, throttle.loginIdentifier, 'synthetic-wrong-password')).status() === 401);
    const blocked = await login(attacker, throttle.loginIdentifier);
    check(blocked.status() === 401 && (await blocked.json()).error.code === 'invalid_credentials');
    pass();
    stage = 'configured idle expiry rejects an untouched session';
    const idleTarget = await create('idle');
    const idleContext = await context();
    check((await login(idleContext, idleTarget.loginIdentifier)).status() === 200);
    for (let remaining = idle + 3; remaining > 0; remaining -= 30) {
      console.log(`Waiting for idle expiry: ${Math.min(30, remaining)} seconds`);
      await new Promise(resolve => setTimeout(resolve, Math.min(30, remaining) * 1000));
    }
    check((await idleContext.get('/api/v1/auth/session')).status() === 401);
    pass();
    stage = 'identifier login succeeds after the configured cooldown';
    check((await login(attacker, throttle.loginIdentifier)).status() === 200);
    pass();
    if (absolute !== undefined) {
      stage = 'configured absolute expiry rejects an active session';
      const target = await create('absolute');
      const active = await context();
      const loginStartedAt = Date.now();
      const signedIn = await login(active, target.loginIdentifier);
      check(signedIn.status() === 200);
      const expiresAt = Date.parse((await signedIn.json()).expiresAt);
      check(expiresAt >= loginStartedAt + absolute * 1000 - 5000 &&
        expiresAt <= Date.now() + absolute * 1000 + 5000);
      const cookie = (await active.storageState()).cookies.find(item => item.name === '__Host-ayurflow_session');
      check(Boolean(cookie));
      const interval = Math.min(30_000, Math.floor(idle * 1000 / 3));
      const lastProbe = expiresAt - interval;
      let lastActive = Date.now();
      let keepalives = 0;
      console.log(`Checking absolute expiry after about ${absolute} seconds, with regular activity.`);
      while (Date.now() < lastProbe) {
        await delay(Math.min(interval, lastProbe - Date.now()));
        const response = await active.get('/api/v1/auth/session');
        check(response.status() === 200 && Date.parse((await response.json()).expiresAt) === expiresAt);
        await response.dispose();
        lastActive = Date.now();
        keepalives++;
      }
      check(keepalives > 0);
      const replay = await context({ Cookie: `${cookie.name}=${cookie.value}` });
      await delay(Math.max(0, expiresAt - Date.now() + Math.min(interval, 1000)));
      check(Date.now() - lastActive < idle * 1000);
      // Send the original token even if the cookie jar would drop it at expiry.
      check((await replay.get('/api/v1/auth/session')).status() === 401);
      results.push({ check: stage, status: 'passed', keepalives });
      absoluteVerified = true;
      console.log(`PASS: ${stage} after ${keepalives} successful keepalives`);
    }
  } catch {
    results.push({ check: stage, status: 'failed' });
    console.error(`FAIL: ${stage}; private responses and credentials omitted.`);
    process.exitCode = 1;
  } finally {
    if (admin) {
      try {
        // The administrator may itself have expired during the idle check.
        check((await login(admin, fixture.administrator, fixture.password)).status() === 200);
        for (const id of created) check((await admin.post(`/api/v1/admin/staff/${id}/disable`, { headers: await csrf() })).status() === 204);
        check((await admin.post('/api/v1/auth/logout', { headers: await csrf() })).status() === 204);
        results.push({ check: 'synthetic accounts disabled and administrator logged out', status: 'passed' });
      } catch {
        results.push({ check: 'synthetic cleanup', status: 'failed' });
        process.exitCode = 1;
      }
    }
    for (const api of contexts) await api.dispose();
    mkdirSync('.cache/auth-deployed', { recursive: true });
    writeFileSync('.cache/auth-deployed/results.json', JSON.stringify({
      date: new Date().toISOString(), origin, idleSeconds: idle, absoluteSeconds: absolute, prefix, results,
      pending: [...(absoluteVerified ? [] : ['absolute expiry with keepalive']),
        'hosting and proxy log inspection', 'independent review and final DEC07 policy'],
    }, null, 2));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Verification setup failed; private details omitted.'); process.exitCode = 1; });
}
