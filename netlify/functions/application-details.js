const { getSupabase, json, requireAdmin } = require('./_lib/config');
exports.handler = async (event) => {
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized.' });
  const id = event.queryStringParameters?.id;
  if (!id) return json(400, { error: 'Application ID is required.' });
  const { data, error } = await getSupabase().from('applications').select('*').eq('id', id).single();
  if (error) return json(404, { error: 'Application not found.' });
  return json(200, { data });
};
