const { getSupabase, json, requireAdmin, sanitizeApplication, validateApplication } = require('./_lib/config');
exports.handler = async (event) => {
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized.' });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const body = JSON.parse(event.body || '{}');
  if (!body.id) return json(400, { error: 'Application ID is required.' });
  const row = sanitizeApplication(body);
  const errors = validateApplication(row, false);
  if (Object.keys(errors).length) return json(400, { error: 'Please fix validation errors.', errors });
  const { error } = await getSupabase().from('applications').update({ ...row, updated_at: new Date().toISOString() }).eq('id', body.id);
  return error ? json(500, { error: 'Could not update application.' }) : json(200, { ok: true });
};
