const { getSupabase, method, requireAdmin, sanitizeApplication, send, validateApplication } = require('./_lib/config');
module.exports = async function handler(req, res) {
  if (!requireAdmin(req)) return send(res, 401, { error: 'Unauthorized.' });
  if (!method(req, res, ['POST'])) return;
  const body = req.body || {};
  if (!body.id) return send(res, 400, { error: 'Application ID is required.' });
  const row = sanitizeApplication(body);
  const errors = validateApplication(row, false);
  if (Object.keys(errors).length) return send(res, 400, { error: 'Please fix validation errors.', errors });
  const { error } = await getSupabase().from('applications').update({ ...row, updated_at: new Date().toISOString() }).eq('id', body.id);
  return error ? send(res, 500, { error: 'Could not update application.' }) : send(res, 200, { ok: true });
};
