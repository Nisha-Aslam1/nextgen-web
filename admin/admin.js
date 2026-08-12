const $ = s => document.querySelector(s);
const apiBase = location.hostname.includes('netlify') ? '/.netlify/functions/' : '/api/';
const statuses = ['Pending', 'Under Review', 'Approved', 'Rejected'];
let page = 1; const perPage = 10; let total = 0;

async function api(path, opts = {}) {
  const res = await fetch(apiBase + path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function badge(s) { return `<span class="badge ${String(s || '').replaceAll(' ', '')}">${escapeHtml(s || '')}</span>`; }


const passwordToggle = $('#togglePassword');
if (passwordToggle) {
  passwordToggle.addEventListener('click', () => {
    const passwordInput = $('#adminPassword');
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    passwordToggle.textContent = isHidden ? 'Hide' : 'Show';
    passwordToggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    passwordToggle.setAttribute('aria-pressed', String(isHidden));
  });
}

if ($('#loginForm')) {
  $('#loginForm').setAttribute('autocomplete', 'off');
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    $('#loginNotice').textContent = 'Signing in…';
    try {
      await api('admin-login', { method: 'POST', body: JSON.stringify(Object.fromEntries(f)) });
      e.target.reset();
      location.href = 'dashboard.html';
    } catch (err) {
      $('#loginNotice').textContent = err.message;
    }
  });
}

async function load() {
  try { await api('admin-session'); } catch { location.href = 'index.html'; return; }
  const qs = new URLSearchParams({ page, perPage, search: $('#search').value, status: $('#status').value, from: $('#from').value, to: $('#to').value, sort: $('#sort').value });
  const res = await api(`applications?${qs}`, { headers: {} });
  total = res.count || 0;
  renderCards(res.stats);
  renderRows(res.data || []);
  $('#pageInfo').textContent = `Page ${page} of ${Math.max(1, Math.ceil(total / perPage))}`;
}

function renderCards(stats = {}) {
  const cards = [['Total', stats.total], ['Pending', stats.pending], ['Approved', stats.approved], ['Rejected', stats.rejected], ['Today', stats.today], ['This Month', stats.month]];
  $('#cards').innerHTML = cards.map(([k, v]) => `<div class="card"><b>${v || 0}</b><span>${k}</span></div>`).join('');
}

function renderRows(rows) {
  $('#rows').innerHTML = rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.reference_code || r.id)}</td><td>${escapeHtml(r.full_name || '')}</td><td>${escapeHtml(r.phone || '')}</td><td>${escapeHtml(r.email || '')}</td><td>${badge(r.status)}</td><td>${new Date(r.created_at).toLocaleString()}</td><td class="actions"><button onclick="viewApp('${r.id}')">View</button><button onclick="editApp('${r.id}')">Edit</button><button class="danger" onclick="delApp('${r.id}')">Delete</button></td></tr>`).join('') : '<tr><td colspan="7">No applications found.</td></tr>';
}

function openImageViewer(url, label) {
  const viewer = $('#imageViewer');
  $('#imageViewerImg').src = url;
  $('#imageViewerImg').alt = label || 'Uploaded payment screenshot';
  $('#imageViewerTitle').textContent = label || 'Payment screenshot';
  $('#imageViewerOpen').href = url;
  viewer.classList.add('show');
}

function closeImageViewer() {
  $('#imageViewer').classList.remove('show');
  $('#imageViewerImg').src = '';
}

async function viewApp(id, edit = false) {
  const { data } = await api(`application-details?id=${encodeURIComponent(id)}`, { headers: {} });
  const files = await Promise.all((data.files || []).map(async f => {
    try { const u = await api(`application-file?path=${encodeURIComponent(f.path)}`, { headers: {} }); return { ...f, url: u.signedUrl }; } catch { return f; }
  }));
  const hidden = ['files'];
  $('#modalBody').innerHTML = `<h2>${edit ? 'Edit' : 'Application'}: ${escapeHtml(data.full_name || data.reference_code)}</h2><p>${badge(data.status)} · Submitted ${new Date(data.created_at).toLocaleString()}</p><label>Status<select id="detailStatus">${statuses.map(s => `<option ${s === data.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label><div class="detail-grid">${Object.entries(data).filter(([k]) => !hidden.includes(k)).map(([k, v]) => `<div class="detail"><span>${escapeHtml(k.replaceAll('_', ' '))}</span>${edit && !['id', 'created_at', 'updated_at', 'reference_code', 'status'].includes(k) ? `<textarea class="edit" data-key="${escapeHtml(k)}">${escapeHtml(Array.isArray(v) ? v.join(', ') : (v ?? ''))}</textarea>` : `<strong>${escapeHtml(Array.isArray(v) ? v.join(', ') : (v ?? ''))}</strong>`}</div>`).join('')}</div><h3>Uploaded files</h3>${files.length ? files.map(f => { const label = f.field === 'paymentScreenshot' ? 'Payment screenshot' : (f.field || 'Uploaded file'); return `<p><strong>${escapeHtml(label)}</strong><br>${f.mimeType?.startsWith('image/') ? `<button type="button" class="image-preview-btn" onclick="openImageViewer('${escapeHtml(f.url || '')}','${escapeHtml(label)}')"><img class="file-preview" src="${escapeHtml(f.url || '')}" alt="${escapeHtml(label)}"><span>Click to view full screen</span></button>` : `<a href="${escapeHtml(f.url || '')}" target="_blank" rel="noopener">Open file</a>`}</p>`; }).join('') : '<p>No files uploaded.</p>'}<p><button class="btn" onclick="saveStatus('${id}')">Save status</button>${edit ? ` <button class="btn" onclick="saveEdit('${id}')">Save edits</button>` : ''}</p>`;
  $('#modal').classList.add('show');
}
async function editApp(id) { viewApp(id, true); }
async function saveStatus(id) { await api('update-status', { method: 'POST', body: JSON.stringify({ id, status: $('#detailStatus').value }) }); await load(); $('#modal').classList.remove('show'); alert('Status updated.'); }
const camel = { sender_name: 'senderName', txn_id: 'txnId', full_name: 'fullName', gender_other: 'genderOther', applicant_status: 'status', applicant_status_other: 'statusOther', association_other: 'associationOther', heard_from: 'heardFrom', heard_from_other: 'heardFromOther', why_join: 'whyJoin', want_learn: 'wantLearn', main_goal: 'mainGoal', interest_areas: 'interestAreas', interest_areas_other: 'interestAreasOther', willing_active: 'willingActive', time_available: 'timeAvailable', willing_tasks: 'willingTasks', join_volunteer: 'joinVolunteer', preferred_area: 'preferredArea', why_volunteer: 'whyVolunteer', willing_contribute: 'willingContribute', anything_else: 'anythingElse' };
async function saveEdit(id) { const row = { id }; document.querySelectorAll('.edit').forEach(t => { row[camel[t.dataset.key] || t.dataset.key] = t.value; }); await api('update-application', { method: 'POST', body: JSON.stringify(row) }); await load(); $('#modal').classList.remove('show'); alert('Application updated.'); }
async function delApp(id) { if (!confirm('Delete this application and associated files?')) return; await api('delete-application', { method: 'POST', body: JSON.stringify({ id }) }); await load(); }
window.viewApp = viewApp; window.editApp = editApp; window.saveStatus = saveStatus; window.saveEdit = saveEdit; window.delApp = delApp; window.openImageViewer = openImageViewer;
if ($('#rows')) {
  $('#applyFilters').onclick = () => { page = 1; load(); };
  $('#prev').onclick = () => { if (page > 1) { page--; load(); } };
  $('#next').onclick = () => { if (page < Math.ceil(total / perPage)) { page++; load(); } };
  $('#closeModal').onclick = () => $('#modal').classList.remove('show');
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').classList.remove('show'); });
  $('#closeImageViewer').onclick = closeImageViewer;
  $('#imageViewer').addEventListener('click', e => { if (e.target.id === 'imageViewer') closeImageViewer(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeImageViewer(); });
  $('#logoutBtn').onclick = async () => { await api('admin-logout', { method: 'POST' }); location.href = 'index.html'; };
  load();
}
