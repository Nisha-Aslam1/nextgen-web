const { json, requireAdmin } = require('./_lib/config');
exports.handler = async (event) => json(requireAdmin(event) ? 200 : 401, { authenticated: !!requireAdmin(event) });
