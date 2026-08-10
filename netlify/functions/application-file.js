const { BUCKET, getSupabase, json, requireAdmin } = require('./_lib/config');
exports.handler = async (event) => {
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized.' });
  const path = event.queryStringParameters?.path;
  if (!path) return json(400, { error: 'File path is required.' });
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 60 * 5);
  if (error) return json(404, { error: 'File not available.' });
  return json(200, { signedUrl: data.signedUrl });
};
