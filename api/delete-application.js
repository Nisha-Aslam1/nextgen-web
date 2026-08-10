const { BUCKET, getSupabase, method, requireAdmin, send } = require('./_lib/config');
module.exports = async function handler(req, res) {
  if (!requireAdmin(req)) return send(res, 401, { error: 'Unauthorized.' });
  if (!method(req, res, ['POST'])) return;
  const { id } = req.body || {};
  if (!id) return send(res, 400, { error: 'Application ID is required.' });
  const supabase = getSupabase();
  const { data, error: loadError } = await supabase.from('applications').select('files').eq('id', id).single();
  if (loadError) return send(res, 404, { error: 'Application not found.' });
  const paths = (data.files || []).map(file => file.path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from('applications').delete().eq('id', id);
  return error ? send(res, 500, { error: 'Could not delete application.' }) : send(res, 200, { ok: true });
};
