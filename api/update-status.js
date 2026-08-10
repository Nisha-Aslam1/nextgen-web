const { APPLICATION_STATUSES, getSupabase, method, requireAdmin, send } = require('./_lib/config');
module.exports = async function handler(req, res) {
  if (!requireAdmin(req)) return send(res, 401, { error: 'Unauthorized.' });
  if (!method(req, res, ['POST'])) return;
  const { id, status } = req.body || {};
  if (!id || !APPLICATION_STATUSES.includes(status)) return send(res, 400, { error: 'Valid ID and status are required.' });
  const { error } = await getSupabase().from('applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  return error ? send(res, 500, { error: 'Could not update status.' }) : send(res, 200, { ok: true });
};
