const { json } = require('./_lib/config');
exports.handler = async () => json(200, { ok: true }, { 'Set-Cookie': 'ng_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
