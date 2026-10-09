require('dotenv').config();
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:' + (process.env.PORT || '3000');
async function call(path, token, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  return { status: response.status, body: await response.json() };
}
async function main() {
  const password = process.env.DEMO_PASSWORD;
  assert.ok(password, 'Falta contraseña demo.');
  assert.equal((await call('/auth/me')).status, 401);
  console.log('PASS: sin token -> 401.');
  const wrong = await call('/auth/login', undefined, { username: 'aiblocks_demo_student', password: 'wrong-demo-password' });
  assert.equal(wrong.status, 401);
  console.log('PASS: contraseña incorrecta -> 401.');
  for (const role of ['student', 'teacher', 'admin']) {
    const login = await call('/auth/login', undefined, { username: 'aiblocks_demo_' + role, password });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, role);
    assert.equal(login.body.user.password_hash, undefined);
    const token = login.body.access_token;
    assert.equal((await call('/auth/me', token)).status, 200);
    for (const target of ['student', 'teacher', 'admin']) {
      assert.equal((await call('/auth/access/' + target, token)).status, role === target || role === 'admin' ? 200 : 403);
    }
    console.log('PASS: ' + role + ' -> login, perfil y permisos esperados; sin hash en respuesta.');
  }
  assert.equal((await call('/auth/me', 'invalid')).status, 401);
  console.log('PASS: token inválido -> 401.');
  console.log('PASS: autenticación y matriz de roles en la API local. No se modificaron contraseñas ni registros por esta prueba.');
}
main().catch(() => {
  console.error('FAIL: revisa API iniciada, cuentas demo, contraseña y límite de login (10/min). No compartas tokens ni secretos.');
  process.exitCode = 1;
});
