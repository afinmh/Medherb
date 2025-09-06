(function(){
  document.addEventListener('DOMContentLoaded', () => {
    try { if (!window.checkAdminAccess || !checkAdminAccess()) return; } catch {}
    try { if (window.setupEventListeners) setupEventListeners(); } catch {}
    feather.replace();
    initUsersPage();
  });

  const state = { page: 1, limit: 10, totalPages: 1 };

  function initUsersPage(){
    loadPage(1);
    bindEditModal();
  }

  function loadPage(page){
    state.page = page;
    const tbody = document.getElementById('users-tbody');
    const pager = document.getElementById('users-pagination');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6">Memuat...</td></tr>';
    if (pager) pager.innerHTML = '';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
  fetch(`/api/users?page=${page}&limit=${state.limit}&role=user`, { signal: controller.signal })
      .then(async res => { clearTimeout(timeout); if (!res.ok) throw new Error('HTTP '+res.status); return res.json(); })
      .then(data => {
        const items = Array.isArray(data?.users) ? data.users : [];
        const pag = data?.pagination || {};
        state.totalPages = pag.totalPages || 1;
        renderTable(items);
        renderPagination();
      })
      .catch(err => {
        console.error('Gagal memuat pengguna:', err);
        if (tbody) tbody.innerHTML = '<tr><td colspan="6">Gagal memuat data.</td></tr>';
      });
  }

  function renderTable(items){
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
  if (!items.length) { tbody.innerHTML = '<tr><td colspan="7">Tidak ada data.</td></tr>'; return; }
  tbody.innerHTML = items.map(u => `
      <tr data-id="${u.id}">
    <td class="text-ellipsis">${escapeHtml(trunc(u.name || '', 24))}</td>
    <td class="text-ellipsis">${escapeHtml(trunc(u.email || '', 28))}</td>
    <td>${u.password_set ? 'Ya' : 'Tidak'}</td>
    <td>${escapeHtml(u.role || '')}</td>
        <td>${u.is_verified ? 'Ya' : 'Tidak'}</td>
        <td>${formatDateID(u.created_at)}</td>
        <td>
          <button class="btn-icon" data-edit><i data-feather="edit-2"></i></button>
          <button class="btn-icon danger" data-delete><i data-feather="trash-2"></i></button>
        </td>
      </tr>
    `).join('');
    feather.replace();
    tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', onEdit));
    tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', onDelete));
  }

  function renderPagination(){
    const el = document.getElementById('users-pagination'); if (!el) return;
    const { page, totalPages } = state;
    const btn = (p, label, disabled=false, active=false) => `<button class="page-btn ${active?'active':''}" ${disabled?'disabled':''} data-page="${p}">${label}</button>`;
    let html = '';
    html += btn(Math.max(1, page-1), 'Prev', page<=1);
    for (let i=1;i<=totalPages;i++) html += btn(i, i, false, i===page);
    html += btn(Math.min(totalPages, page+1), 'Next', page>=totalPages);
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(b => b.addEventListener('click', (e) => {
      const p = parseInt(e.currentTarget.getAttribute('data-page'));
      if (!isNaN(p) && p !== state.page) loadPage(p);
    }));
  }

  function onEdit(e){
    const tr = e.currentTarget.closest('tr');
    const id = tr?.getAttribute('data-id');
    if (!id) return;
    fetch(`/api/users/${id}`).then(r => r.json()).then(({ user }) => openEditModal(user)).catch(()=>Swal.fire('Error','Gagal memuat data.','error'));
  }

  function openEditModal(user){
    setEditModal(true);
    document.getElementById('user-edit-id').value = user.id;
    document.getElementById('user-edit-name').value = user.name || '';
    document.getElementById('user-edit-role').value = user.role || 'user';
  const chk = document.getElementById('user-edit-verified');
  chk.checked = !!user.is_verified;
  updateVerifiedText();
  }

  function bindEditModal(){
    const modal = document.getElementById('user-edit-modal'); if (!modal) return;
    modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) setEditModal(false); });
    document.getElementById('user-save-edit').addEventListener('click', saveEdit);
    document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') setEditModal(false); });
    const chk = document.getElementById('user-edit-verified');
    if (chk) chk.addEventListener('change', updateVerifiedText);
  }

  function updateVerifiedText(){
    const chk = document.getElementById('user-edit-verified');
    const lbl = document.getElementById('verified-status');
    if (lbl) lbl.textContent = chk?.checked ? 'Ya' : 'Tidak';
  }

  function setEditModal(show){
    const modal = document.getElementById('user-edit-modal');
    if (!modal) return; if (show) modal.classList.add('show'); else modal.classList.remove('show');
  }

  function saveEdit(){
    const id = document.getElementById('user-edit-id').value;
    const payload = {
      name: document.getElementById('user-edit-name').value.trim(),
      role: document.getElementById('user-edit-role').value.trim() || 'user',
      is_verified: document.getElementById('user-edit-verified').checked
    };
  if (!payload.name) { Swal.fire('Validasi','Nama wajib diisi.','warning'); return; }
    fetch(`/api/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(async res => { if (!res.ok) throw new Error('HTTP '+res.status); return res.json(); })
      .then(() => { setEditModal(false); Swal.fire('Berhasil','Pengguna diperbarui.','success'); loadPage(state.page); })
      .catch(()=>Swal.fire('Error','Gagal menyimpan perubahan.','error'));
  }

  function onDelete(e){
    const tr = e.currentTarget.closest('tr'); const id = tr?.getAttribute('data-id'); if (!id) return;
    Swal.fire({ title:'Hapus pengguna?', text:'Tindakan tidak dapat dibatalkan.', icon:'warning', showCancelButton:true, confirmButtonColor:'#E53E3E' })
      .then(res => { if (!res.isConfirmed) return; return fetch(`/api/users/${id}`, { method:'DELETE' }); })
      .then(r => { if (r && !r.ok) throw new Error('HTTP '+r.status); Swal.fire('Terhapus','Pengguna dihapus.','success'); loadPage(1); })
      .catch(()=>Swal.fire('Error','Gagal menghapus.','error'));
  }

  function formatDateID(dateStr){
    if (!dateStr) return '-'; const d = new Date(dateStr); if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); }
  function trunc(s, n){ s = String(s); return s.length>n ? s.slice(0,n-1)+"…" : s; }
})();
