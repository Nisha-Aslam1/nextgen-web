const { APPLICATION_STATUSES, getSupabase, json, requireAdmin } = require('./_lib/config');
exports.handler = async (event) => {
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized.' });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const { id, status } = JSON.parse(event.body || '{}');
  if (!id || !APPLICATION_STATUSES.includes(status)) return json(400, { error: 'Valid ID and status are required.' });
  const { error } = await getSupabase().from('applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  return error ? json(500, { error: 'Could not update status.' }) : json(200, { ok: true });
};
