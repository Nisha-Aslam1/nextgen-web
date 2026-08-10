const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const APPLICATION_STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected'];
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'application-files';

function env(name, alternates = []) {
  for (const key of [name, ...alternates]) {
    if (process.env[key]) return process.env[key];
  }
  return '';
}

function getSupabase() {
  const url = env('SUPABASE_URL', ['NEXT_PUBLIC_SUPABASE_URL']);
  const key = env('SUPABASE_SERVICE_ROLE_KEY', ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_KEY']);
  if (!url) throw new Error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL.');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function send(res, statusCode, body, headers = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

function safeString(value, max = 1000) {
  if (value === undefined || value === null) return null;
  return String(value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) || null;
}
function splitMulti(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.map(v => safeString(v, 80)).filter(Boolean) : String(value).split(',').map(v => safeString(v, 80)).filter(Boolean);
}
function sanitizeApplication(fields) {
  return {
    sender_name: safeString(fields.senderName, 160), txn_id: safeString(fields.txnId, 120), full_name: safeString(fields.fullName, 160),
    gender: safeString(fields.gender, 80), gender_other: safeString(fields.genderOther, 160), age: fields.age ? Number.parseInt(fields.age, 10) : null,
    city: safeString(fields.city, 120), phone: safeString(fields.phone, 60), email: safeString(fields.email, 180)?.toLowerCase() || null,
    applicant_status: safeString(fields.status, 120), applicant_status_other: safeString(fields.statusOther, 160), association: safeString(fields.association, 180),
    association_other: safeString(fields.associationOther, 180), designation: safeString(fields.designation, 180), heard_from: safeString(fields.heardFrom, 120),
    heard_from_other: safeString(fields.heardFromOther, 180), why_join: safeString(fields.whyJoin, 3000), want_learn: safeString(fields.wantLearn, 3000),
    main_goal: safeString(fields.mainGoal, 3000), skills: splitMulti(fields.skills), skills_other: safeString(fields.skillsOther, 180),
    interest_areas: splitMulti(fields.interestAreas), interest_areas_other: safeString(fields.interestAreasOther, 180), willing_active: safeString(fields.willingActive, 40),
    time_available: safeString(fields.timeAvailable, 80), willing_tasks: safeString(fields.willingTasks, 40), opportunity: safeString(fields.opportunity, 120),
    join_volunteer: safeString(fields.joinVolunteer, 40), preferred_area: safeString(fields.preferredArea, 120), why_volunteer: safeString(fields.whyVolunteer, 3000),
    willing_contribute: safeString(fields.willingContribute, 40), expectations: safeString(fields.expectations, 3000), anything_else: safeString(fields.anythingElse, 3000)
  };
}
function validateApplication(row, requireAll = true) {
  const errors = {};
  if ((requireAll || row.full_name !== null) && !row.full_name) errors.fullName = 'Full name is required.';
  if ((requireAll || row.city !== null) && !row.city) errors.city = 'City is required.';
  if ((requireAll || row.phone !== null) && (!row.phone || row.phone.replace(/[^0-9]/g, '').length < 7)) errors.phone = 'Valid phone / WhatsApp number is required.';
  if ((requireAll || row.email !== null) && (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))) errors.email = 'Valid email address is required.';
  if ((requireAll || row.sender_name !== null) && !row.sender_name) errors.senderName = "Sender's name is required.";
  if (row.age !== null && (!Number.isInteger(row.age) || row.age < 10 || row.age > 100)) errors.age = 'Age must be between 10 and 100.';
  return errors;
}
function sign(payload) {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || '';
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verify(token) {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || '';
  if (!token || !secret) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(data || '').digest('base64url');
  const sigBuf = Buffer.from(sig || ''); const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  return payload.exp && payload.exp > Date.now() ? payload : null;
}
function getCookie(req, name) {
  const cookie = req.headers.cookie || '';
  const found = cookie.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
}
function requireAdmin(req) { return verify(getCookie(req, 'ng_admin_session')); }
function cookieHeader(token, maxAge) { return `ng_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function method(req, res, allowed) { if (!allowed.includes(req.method)) { send(res, 405, { error: 'Method not allowed.' }); return false; } return true; }

module.exports = { APPLICATION_STATUSES, BUCKET, cookieHeader, getSupabase, method, requireAdmin, safeString, sanitizeApplication, send, sign, validateApplication };
