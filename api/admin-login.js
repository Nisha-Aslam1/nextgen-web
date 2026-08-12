const crypto = require('crypto');
const { cookieHeader, method, send, sign } = require('./_lib/config');
const attempts = new Map();
function safeEqual(a, b) { const ab = Buffer.from(a || ''); const bb = Buffer.from(b || ''); return ab.length === bb.length && crypto.timingSafeEqual(ab, bb); }
module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  const hit = attempts.get(ip) || { count: 0, until: 0 };
  if (hit.until > Date.now()) return send(res, 429, { error: 'Too many login attempts. Please wait and try again.' });
  const { username = '', password = '' } = req.body || {};
  const ok = safeEqual(username, process.env.ADMIN_USERNAME || '') && safeEqual(password, process.env.ADMIN_PASSWORD || '');
  if (!ok) {
    const count = hit.count + 1;
    attempts.set(ip, { count, until: count >= 5 ? Date.now() + 15 * 60 * 1000 : 0 });
    return send(res, 401, { error: 'Invalid username or password.' });
  }
  attempts.delete(ip);
  const token = sign({ sub: 'admin', exp: Date.now() + 8 * 60 * 60 * 1000 });
  return send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(token) });
};
