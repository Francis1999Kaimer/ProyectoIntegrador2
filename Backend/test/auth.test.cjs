const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const bcrypt = require('bcryptjs');
const { JwtService } = require('@nestjs/jwt');
const { Test } = require('@nestjs/testing');
const { USER_REPOSITORY } = require('../dist/repositories/contracts');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { PasswordService } = require('../dist/auth/password.service');
const SECRET = 'test-only-auth-secret-not-for-deployment-12345';
process.env.JWT_SECRET = SECRET;
process.env.DATABASE_URL = 'mysql://test:test@127.0.0.1:3306/unit_tests';
process.env.NODE_ENV = 'test';
const { AppModule } = require('../dist/app.module');
const PASSWORD = 'unit-test-password-123';
const signer = new JwtService({
  secret: SECRET,
  signOptions: { algorithm: 'HS256', issuer: 'aiblocks-api', audience: 'aiblocks-web', expiresIn: 900 }
});

async function fixture() {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const records = ['student', 'teacher', 'admin'].map((role, i) => ({
    id: '10000000-0000-4000-8000-00000000000' + (i + 1),
    username: 'unit_' + role, email: null, role, status: 'active',
    display_name: 'Unit ' + role, must_change_password: false, password_hash: hash
  }));
  const fake = {
    findById: async id => records.find(u => u.id === id) ?? null,
    findForAuthentication: async name => records.find(u => u.username === name) ?? null,
    findCredentialsById: async id => records.find(u => u.id === id) ?? null,
    updatePassword: async (id, old, next) => {
      const u = records.find(u => u.id === id && u.password_hash === old && u.status === 'active');
      if (!u) return false;
      u.password_hash = next; u.must_change_password = false;
      return true;
    }
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(USER_REPOSITORY).useValue(fake)
    .overrideProvider(PrismaService).useValue({ $queryRaw: async () => [{ ok: 1 }] }).compile();
  const app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  async function call(path, token, body) {
    const response = await fetch(url + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  async function login(role, password = PASSWORD) {
    return call('/auth/login', undefined, { username: 'unit_' + role, password });
  }
  return { app, records, call, login };
}

test('real HTTP pipeline: login, me, safe projections and role matrix', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('/health')).status, 200);
    assert.equal((await f.call('/auth/me')).status, 401);
    for (const role of ['student', 'teacher', 'admin']) {
      const login = await f.login(role);
      assert.equal(login.status, 200);
      assert.equal(login.headers.get('cache-control'), 'no-store');
      assert.equal(login.body.expires_in, 900);
      assert.equal(login.body.user.password_hash, undefined);
      const token = login.body.access_token;
      const me = await f.call('/auth/me', token);
      assert.equal(me.status, 200);
      assert.equal(me.body.password_hash, undefined);
      assert.equal(me.body.role, role);
      for (const target of ['student', 'teacher', 'admin']) {
        assert.equal((await f.call('/auth/access/' + target, token)).status, role === target || role === 'admin' ? 200 : 403);
      }
    }
  } finally { await f.app.close(); }
});

test('HTTP validation rejects extra fields and malformed input before signing', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('/auth/login', undefined, { username: 'unit_student', password: PASSWORD, role: 'admin' })).status, 400);
    assert.equal((await f.call('/auth/login', undefined, { username: {}, password: PASSWORD })).status, 400);
    assert.equal((await f.call('/auth/login', undefined, { username: 'unit_student' })).status, 400);
    assert.equal((await f.login('student', '🙂'.repeat(40))).status, 401, 'UTF-8 >72 bytes is rejected, not truncated');
  } finally { await f.app.close(); }
});

test('wrong password, unknown user and inactive account give the same generic 401', async () => {
  const f = await fixture();
  try {
    const wrong = await f.login('student', 'incorrect');
    const unknown = await f.login('unknown');
    f.records[1].status = 'pending';
    const inactive = await f.login('teacher');
    for (const result of [wrong, unknown, inactive]) {
      assert.equal(result.status, 401);
      assert.equal(result.body.message, 'Credenciales inválidas.');
      assert.equal(result.body.access_token, undefined);
    }
  } finally { await f.app.close(); }
});

test('JWT rejects malformed, altered, expired, foreign audience, algorithm and deleted/suspended users', async () => {
  const f = await fixture();
  try {
    const token = (await f.login('student')).body.access_token;
    const claims = signer.decode(token);
    const { iat, exp, iss, aud, ...data } = claims;
    for (const invalid of [
      'invalid', token.slice(0, -8) + 'tampered',
      signer.sign(data, { expiresIn: -1 }),
      signer.sign(data, { audience: 'another-app' }),
      signer.sign(data, { algorithm: 'HS384' }),
      new JwtService({ secret: 'other-secret-which-is-at-least-32-characters' }).sign(data),
      signer.sign({ ...data, sub: '10000000-0000-4000-8000-000000000099' })
    ]) assert.equal((await f.call('/auth/me', invalid)).status, 401);
    f.records[0].status = 'suspended';
    assert.equal((await f.call('/auth/me', token)).status, 401);
  } finally { await f.app.close(); }
});

test('database role changes take effect immediately; forced password change blocks role routes', async () => {
  const f = await fixture();
  try {
    const token = (await f.login('teacher')).body.access_token;
    f.records[1].role = 'student';
    assert.equal((await f.call('/auth/access/teacher', token)).status, 403);
    assert.equal((await f.call('/auth/access/student', token)).status, 200);
    f.records[1].must_change_password = true;
    assert.equal((await f.call('/auth/access/student', token)).status, 403);
    assert.equal((await f.call('/auth/me', token)).status, 200);
  } finally { await f.app.close(); }
});

test('password change verifies current password, hashes new value and invalidates old JWT', async () => {
  const f = await fixture();
  try {
    const token = (await f.login('student')).body.access_token;
    assert.equal((await f.call('/auth/change-password', token, { current_password: 'incorrect', new_password: 'new-unit-password-123' })).status, 401);
    assert.equal((await f.call('/auth/change-password', token, { current_password: PASSWORD, new_password: 'short' })).status, 400);
    const result = await f.call('/auth/change-password', token, { current_password: PASSWORD, new_password: 'new-unit-password-123' });
    assert.equal(result.status, 200);
    assert.notEqual(f.records[0].password_hash, 'new-unit-password-123');
    assert.equal(bcrypt.getRounds(f.records[0].password_hash), 12);
    assert.equal((await f.call('/auth/me', token)).status, 401);
    assert.equal((await f.login('student', 'new-unit-password-123')).status, 200);
  } finally { await f.app.close(); }
});

test('login rate limiting returns 429 after ten attempts per IP and route', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 10; i++) assert.equal((await f.login('student')).status, 200);
    assert.equal((await f.login('student')).status, 429);
  } finally { await f.app.close(); }
});

test('password policy rejects short and oversized UTF-8 passwords; distinct salted hashes', async () => {
  const passwords = new PasswordService();
  assert.throws(() => passwords.hash('short'));
  assert.throws(() => passwords.hash('🙂'.repeat(20)));
  const first = await passwords.hash('long-unit-password-123');
  const second = await passwords.hash('long-unit-password-123');
  assert.notEqual(first, second);
  assert.equal(await passwords.verify('long-unit-password-123', first), true);
});
