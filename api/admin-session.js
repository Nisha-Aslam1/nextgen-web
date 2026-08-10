const { requireAdmin, send } = require('./_lib/config');
module.exports = async function handler(req, res) {
  const authenticated = !!requireAdmin(req);
  return send(res, authenticated ? 200 : 401, { authenticated });
};
