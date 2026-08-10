const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET'];
const APPLICATION_STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected'];
const BUCKET = 'application-files';

function getSupabase() {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function safeString(value, max = 1000) {
  if (value === undefined || value === null) return null;
  return String(value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) || null;
}

function sanitizeApplication(fields) {
  return {
    sender_name: safeString(fields.senderName, 160),
    txn_id: safeString(fields.txnId, 120),
    full_name: safeString(fields.fullName, 160),
    gender: safeString(fields.gender, 80),
    gender_other: safeString(fields.genderOther, 160),
    age: fields.age ? Number.parseInt(fields.age, 10) : null,
    city: safeString(fields.city, 120),
    phone: safeString(fields.phone, 60),
    email: safeString(fields.email, 180)?.toLowerCase() || null,
    applicant_status: safeString(fields.status, 120),
    applicant_status_other: safeString(fields.statusOther, 160),
    association: safeString(fields.association, 180),
    association_other: safeString(fields.associationOther, 180),
    designation: safeString(fields.designation, 180),
    heard_from: safeString(fields.heardFrom, 120),
    heard_from_other: safeString(fields.heardFromOther, 180),
    why_join: safeString(fields.whyJoin, 3000),
    want_learn: safeString(fields.wantLearn, 3000),
    main_goal: safeString(fields.mainGoal, 3000),
    skills: Array.isArray(fields.skills) ? fields.skills.map(v => safeString(v, 80)).filter(Boolean) : splitMulti(fields.skills),
    skills_other: safeString(fields.skillsOther, 180),
    interest_areas: Array.isArray(fields.interestAreas) ? fields.interestAreas.map(v => safeString(v, 80)).filter(Boolean) : splitMulti(fields.interestAreas),
    interest_areas_other: safeString(fields.interestAreasOther, 180),
    willing_active: safeString(fields.willingActive, 40),
    time_available: safeString(fields.timeAvailable, 80),
    willing_tasks: safeString(fields.willingTasks, 40),
    opportunity: safeString(fields.opportunity, 120),
    join_volunteer: safeString(fields.joinVolunteer, 40),
    preferred_area: safeString(fields.preferredArea, 120),
    why_volunteer: safeString(fields.whyVolunteer, 3000),
    willing_contribute: safeString(fields.willingContribute, 40),
    expectations: safeString(fields.expectations, 3000),
    anything_else: safeString(fields.anythingElse, 3000)
  };
}

function splitMulti(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : String(value).split(',').map(v => safeString(v, 80)).filter(Boolean);
}

function validateApplication(row, requireAll = true) {
  const errors = {};
  if (requireAll || row.full_name !== null) {
    if (!row.full_name) errors.fullName = 'Full name is required.';
  }
  if (requireAll || row.city !== null) {
    if (!row.city) errors.city = 'City is required.';
  }
  if (requireAll || row.phone !== null) {
    if (!row.phone || row.phone.replace(/[^0-9]/g, '').length < 7) errors.phone = 'Valid phone / WhatsApp number is required.';
  }
  if (requireAll || row.email !== null) {
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.email = 'Valid email address is required.';
  }
  if (requireAll || row.sender_name !== null) {
    if (!row.sender_name) errors.senderName = "Sender's name is required.";
  }
  if (row.age !== null && (!Number.isInteger(row.age) || row.age < 10 || row.age > 100)) errors.age = 'Age must be between 10 and 100.';
  return errors;
}

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verify(token) {
  if (!token || !process.env.SESSION_SECRET) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(data || '').digest('base64url');
  const sigBuf = Buffer.from(sig || '');
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}
function getCookie(event, name) {
  const cookie = event.headers.cookie || event.headers.Cookie || '';
  const found = cookie.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
}
function requireAdmin(event) {
  return verify(getCookie(event, 'ng_admin_session'));
}
function cookieHeader(token, maxAge) {
  const secure = process.env.NETLIFY_DEV ? '' : ' Secure;';
  return `ng_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAge}`;
}

module.exports = { APPLICATION_STATUSES, BUCKET, cookieHeader, getSupabase, json, requireAdmin, safeString, sanitizeApplication, sign, validateApplication };
