const { BUCKET, getSupabase, requireAdmin, send } = require('./_lib/config');
module.exports = async function handler(req, res) {
  if (!requireAdmin(req)) return send(res, 401, { error: 'Unauthorized.' });
  const path = req.query?.path;
  if (!path) return send(res, 400, { error: 'File path is required.' });
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 60 * 5);
  if (error) return send(res, 404, { error: 'File not available.' });
  return send(res, 200, { signedUrl: data.signedUrl });
};
