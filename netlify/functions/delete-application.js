const { BUCKET, getSupabase, json, requireAdmin } = require('./_lib/config');
exports.handler = async (event) => {
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized.' });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const { id } = JSON.parse(event.body || '{}');
  if (!id) return json(400, { error: 'Application ID is required.' });
  const supabase = getSupabase();
  const { data, error: loadError } = await supabase.from('applications').select('files').eq('id', id).single();
  if (loadError) return json(404, { error: 'Application not found.' });
  const paths = (data.files || []).map(f => f.path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from('applications').delete().eq('id', id);
  return error ? json(500, { error: 'Could not delete application.' }) : json(200, { ok: true });
};
