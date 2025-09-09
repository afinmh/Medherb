(function(){
  document.addEventListener('DOMContentLoaded', () => {
    try { if (!window.checkAdminAccess || !checkAdminAccess()) return; } catch {}
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
    const grid = document.getElementById('users-grid');
    const pager = document.getElementById('users-pagination');
    if (grid) grid.innerHTML = '<div>Memuat...</div>';
    if (pager) pager.innerHTML = '';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const token = localStorage.getItem('access_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  fetch(`/api/users?page=${page}&limit=${state.limit}`, { signal: controller.signal, headers })
      .then(async res => { clearTimeout(timeout); if (!res.ok) throw new Error('HTTP '+res.status); return res.json(); })
      .then(data => {
        const itemsRaw = Array.isArray(data?.users) ? data.users : [];
        // Exclude primary admin account by email
        const items = itemsRaw.filter(u => String(u?.email || '').toLowerCase() !== 'admin@gmail.com');
        const pag = data?.pagination || {};
        state.totalPages = pag.totalPages || 1;
        renderGrid(items);
        renderPagination();
      })
      .catch(err => {
        console.error('Gagal memuat pengguna:', err);
        if (grid) grid.innerHTML = '<div>Gagal memuat data.</div>';
      });
  }

  function initials(name){
    const s = String(name||'').trim(); if (!s) return '?';
    const parts = s.split(/\s+/).slice(0,2);
    return parts.map(p=>p[0]).join('').toUpperCase();
  }

  function renderGrid(items){
    const grid = document.getElementById('users-grid');
    if (!grid) return;
    if (!items.length) { grid.innerHTML = '<div>Tidak ada data.</div>'; return; }
    grid.classList.add('cards-grid');
    grid.innerHTML = items.map(u => {
      const imgUrl = u.avatar_url || u.gambar_url || '';
      const avatar = imgUrl
        ? `<div class="user-avatar"><img src="${imgUrl}" alt="${escapeHtml(u.name||'')}" onerror="this.onerror=null; this.src='/favicon.png';"></div>`
        : `<div class="user-avatar">${initials(u.name)}</div>`;
      return `
      <div class="herb-card" data-id="${u.id}">
        <div class="herb-body">
          <div class="user-header">
            ${avatar}
            <div style="flex:1">
              <div class="title-row">
                <div class="herb-title user-name">${escapeHtml(u.name || '-')}</div>
                <div class="chip user-role">${escapeHtml(u.role || 'user')}</div>
              </div>
              <div class="user-email">${escapeHtml(u.email || '-')}</div>
            </div>
          </div>
          <div class="herb-meta">
            <div class="meta-row">
              <div>Pass set: ${u.password_set ? '<span class="badge yes">Ya</span>' : '<span class="badge no">Tidak</span>'}</div>
              <div>Verified: ${u.is_verified ? '<span class="badge yes">Ya</span>' : '<span class="badge no">Tidak</span>'}</div>
            </div>
            <div class="meta-col">Dibuat: <span class="chip">${formatDateID(u.created_at)}</span></div>
          </div>
        </div>
        <div class="herb-footer">
          <div class="actions">
            <button class="btn-icon" data-edit title="Edit"><i data-feather="edit-2"></i></button>
            <button class="btn-icon danger" data-delete title="Hapus"><i data-feather="trash-2"></i></button>
          </div>
        </div>
      </div>
    `; }).join('');
    feather.replace();
    grid.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', onEdit));
    grid.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', onDelete));
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
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i data-feather="loader" class="spin"></i>';
    feather.replace({ elements: [btn] });
    const card = btn.closest('.herb-card');
    const id = card?.getAttribute('data-id');
    if (!id) { btn.disabled = false; btn.innerHTML = original; feather.replace({ elements: [btn] }); return; }
    {
      const token = localStorage.getItem('access_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      fetch(`/api/users/${id}`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(({ user }) => { openEditModal(user); })
      .catch(()=>Swal.fire('Error','Gagal memuat data.','error'))
      .finally(() => { btn.disabled = false; btn.innerHTML = original; feather.replace({ elements: [btn] }); });
    }
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
    const token = localStorage.getItem('access_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`/api/users/${id}`, { method: 'PATCH', headers, body: JSON.stringify(payload) })
      .then(async res => { if (!res.ok) throw new Error('HTTP '+res.status); return res.json(); })
      .then(() => { setEditModal(false); Swal.fire('Berhasil','Pengguna diperbarui.','success'); loadPage(state.page); })
      .catch(()=>Swal.fire('Error','Gagal menyimpan perubahan.','error'));
  }

  function onDelete(e){
    const btn = e.currentTarget;
    const card = btn.closest('.herb-card');
    const id = card?.getAttribute('data-id'); if (!id) return;
  const token = localStorage.getItem('access_token');
  if (!token) { Swal.fire('Sesi berakhir','Silakan login ulang sebagai admin.','warning'); return; }
    Swal.fire({ title:'Hapus pengguna?', text:'Tindakan tidak dapat dibatalkan.', icon:'warning', showCancelButton:true, confirmButtonColor:'#E53E3E', cancelButtonText:'Batal' })
      .then(res => {
        if (!res.isConfirmed) return null; // cancel, stop here
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.dataset._orig = original;
        btn.innerHTML = '<i data-feather="loader" class="spin"></i>';
        feather.replace({ elements: [btn] });
    return fetch(`/api/users/${id}`, { method:'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => { if (!r.ok) throw new Error('HTTP '+r.status); return r; })
          .then(() => { Swal.fire('Terhapus','Pengguna dihapus.','success'); loadPage(1); })
          .finally(() => { btn.disabled = false; btn.innerHTML = btn.dataset._orig || original; feather.replace({ elements: [btn] }); delete btn.dataset._orig; });
      })
      .catch(err => { if (err) Swal.fire('Error','Gagal menghapus.','error'); });
  }

  function formatDateID(dateStr){
    if (!dateStr) return '-'; const d = new Date(dateStr); if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); }
  function trunc(s, n){ s = String(s); return s.length>n ? s.slice(0,n-1)+"…" : s; }
})();
