const { send } = require('./_lib/config');
module.exports = async function handler(req, res) {
  return send(res, 200, { ok: true }, { 'Set-Cookie': 'ng_admin_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' });
};
