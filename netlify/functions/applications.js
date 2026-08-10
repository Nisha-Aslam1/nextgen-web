const { getSupabase, json, requireAdmin, safeString } = require('./_lib/config');
exports.handler = async (event) => {
  if (!requireAdmin(event)) return json(401, { error: 'Unauthorized.' });
  const supabase = getSupabase();
  const qs = event.queryStringParameters || {};
  const page = Math.max(parseInt(qs.page || '1', 10), 1), perPage = Math.min(Math.max(parseInt(qs.perPage || '10', 10), 1), 50);
  let q = supabase.from('applications').select('id,reference_code,full_name,phone,email,status,created_at,updated_at', { count: 'exact' });
  if (qs.status) q = q.eq('status', qs.status);
  if (qs.from) q = q.gte('created_at', qs.from);
  if (qs.to) q = q.lte('created_at', qs.to);
  if (qs.search) q = q.or(`full_name.ilike.%${safeString(qs.search,80)}%,phone.ilike.%${safeString(qs.search,80)}%,email.ilike.%${safeString(qs.search,80)}%,reference_code.ilike.%${safeString(qs.search,80)}%`);
  q = q.order('created_at', { ascending: qs.sort === 'oldest' }).range((page-1)*perPage, page*perPage-1);
  const { data, count, error } = await q; if (error) return json(500, { error: 'Could not load applications.' });
  const { data: all } = await supabase.from('applications').select('status,created_at');
  const today = new Date().toISOString().slice(0,10); const month = today.slice(0,7);
  const stats = { total: all?.length || 0, pending: 0, approved: 0, rejected: 0, today: 0, month: 0 };
  for (const r of all || []) { if (r.status === 'Pending') stats.pending++; if (r.status === 'Approved') stats.approved++; if (r.status === 'Rejected') stats.rejected++; if (r.created_at?.startsWith(today)) stats.today++; if (r.created_at?.startsWith(month)) stats.month++; }
  return json(200, { data, count, page, perPage, stats });
};
