const { getSupabase, requireAdmin, send } = require('./_lib/config');
module.exports = async function handler(req, res) {
  if (!requireAdmin(req)) return send(res, 401, { error: 'Unauthorized.' });
  const id = req.query?.id;
  if (!id) return send(res, 400, { error: 'Application ID is required.' });
  const { data, error } = await getSupabase().from('applications').select('*').eq('id', id).single();
  if (error) return send(res, 404, { error: 'Application not found.' });
  return send(res, 200, { data });
};
