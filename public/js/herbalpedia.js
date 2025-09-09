(function(){
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.checkAdminAccess || !checkAdminAccess()) return;
    feather.replace();
    initPage();
  });

  const state = { page: 1, limit: 6, totalPages: 1, reqSeq: 0 };

  function initPage(){
    bindModal();
    bindCreate();
    loadPage(1);
  }

  function bindCreate(){
    const btn = document.getElementById('add-herb');
    if (!btn) return;
    btn.addEventListener('click', () => openModal());
  }

  function bindModal(){
    const modal = document.getElementById('herb-modal');
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-close]')) closeModal();
    });
    document.getElementById('save-herb')?.addEventListener('click', onSave);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    const fileEl = document.getElementById('gambar_file');
    if (fileEl) {
      fileEl.addEventListener('change', () => {
        const f = fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
        updateImagePreview(f, null);
      });
    }
  }

  function openModal(item){
    const modal = document.getElementById('herb-modal');
    if (!modal) return;
    document.getElementById('herb-modal-title').textContent = item ? 'Edit Herbal' : 'Tambah Herbal';
    document.getElementById('herb-id').value = item?.id || '';
    document.getElementById('nama_umum').value = item?.nama_umum || '';
    document.getElementById('nama_ilmiah').value = item?.nama_ilmiah || '';
    document.getElementById('bagian').value = item?.bagian || '';
    document.getElementById('manfaat').value = item?.manfaat || '';
    document.getElementById('cara_penggunaan').value = item?.cara_penggunaan || '';
    document.getElementById('status').value = item?.status || 'pending';
  const fileEl = document.getElementById('gambar_file');
  if (fileEl) fileEl.value = '';
  // set preview
  updateImagePreview(null, item?.gambar_url || null);
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
  }
  function closeModal(){
  document.getElementById('herb-modal')?.classList.remove('show');
  document.body.style.overflow = '';
  }

  function onSave(){
    const id = document.getElementById('herb-id').value.trim();
    const payload = collectPayload();
    if (!payload) return;

    const fileEl = document.getElementById('gambar_file');
    const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;

    const proceed = (finalPayload) => {
      const method = id ? 'PATCH' : 'POST';
      const url = id ? `/api/herbalpedia/${id}` : '/api/herbalpedia';
      if (method === 'PATCH' && !file && (finalPayload.gambar_url == null)) {
        // avoid clearing existing image when not uploading a new file
        delete finalPayload.gambar_url;
      }
      const token = localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      fetch(url, {
        method,
        headers,
        body: JSON.stringify(finalPayload)
      }).then(async res => {
        if (!res.ok) throw new Error('HTTP '+res.status);
        return res.json();
      }).then(() => {
        closeModal();
        Swal.fire('Berhasil', id ? 'Herbal diperbarui.' : 'Herbal ditambahkan.', 'success');
        loadPage(1);
      }).catch(err => {
        console.error('Simpan herbal gagal:', err);
        Swal.fire('Error', 'Gagal menyimpan herbal.', 'error');
      });
    };

    if (file) {
      const fd = new FormData();
      fd.append('nama', document.getElementById('nama_umum').value.trim());
      fd.append('file', file);
  fetch('/api/herbalpedia/upload', { method: 'POST', body: fd })
        .then(async res => { if(!res.ok) throw new Error('HTTP '+res.status); return res.json(); })
  .then(({ url }) => { const u = url && url.includes('?') ? url : `${url}?v=${Date.now()}`; proceed({ ...payload, gambar_url: u }); })
        .catch(err => { console.error('Upload gambar gagal:', err); Swal.fire('Error','Gagal upload gambar.','error'); });
    } else {
      proceed(payload);
    }
  }

  function collectPayload(){
    const nama_umum = document.getElementById('nama_umum').value.trim();
    const nama_ilmiah = valOrNull(document.getElementById('nama_ilmiah').value);
    const bagian = valOrNull(document.getElementById('bagian').value);
    const manfaat = valOrNull(document.getElementById('manfaat').value);
    const cara_penggunaan = valOrNull(document.getElementById('cara_penggunaan').value);
  // gambar_url ditentukan dari upload jika ada file; tetap izinkan url manual untuk kompatibilitas lama
  const gambarUrlEl = document.getElementById('gambar_url');
  const gambar_url = gambarUrlEl ? valOrNull(gambarUrlEl.value) : null;
    const status = document.getElementById('status').value;

    if (!nama_umum) {
      Swal.fire('Validasi', 'Nama umum wajib diisi.', 'warning');
      return null;
    }
    if (bagian && bagian.length > 500) { Swal.fire('Validasi','Bagian <= 500 karakter.','warning'); return null; }
    if (manfaat && manfaat.length > 1000) { Swal.fire('Validasi','Manfaat <= 1000 karakter.','warning'); return null; }
    if (cara_penggunaan && cara_penggunaan.length > 2000) { Swal.fire('Validasi','Cara penggunaan <= 2000 karakter.','warning'); return null; }

    return { nama_umum, nama_ilmiah, bagian, manfaat, cara_penggunaan, gambar_url, status };
  }

  function loadPage(page){
    state.page = page;
    const mySeq = ++state.reqSeq;
    const grid = document.getElementById('herb-grid');
    const pager = document.getElementById('herb-pagination');
    if (grid) grid.innerHTML = '<div>Memuat...</div>';
    if (pager) pager.innerHTML = '';

    fetch(`/api/herbalpedia?page=${page}&limit=${state.limit}`)
      .then(async res => { if(!res.ok) throw new Error('HTTP '+res.status); return res.json(); })
      .then(data => {
        if (mySeq !== state.reqSeq) return; // stale response; ignore
        const items = Array.isArray(data?.items) ? data.items : [];
        // Deduplicate by id (defensive)
        const seen = new Set();
        const uniq = [];
        for (const it of items) { const id = it && it.id; if (!id || seen.has(id)) continue; seen.add(id); uniq.push(it); }
        const pag = data?.pagination || {}; state.totalPages = pag.totalPages || 1;
        renderGrid(uniq); renderPagination();
      })
      .catch(err => {
        console.error('Gagal memuat herbal:', err);
        if (grid) grid.innerHTML = '<div>Gagal memuat data.</div>';
      });
  }

  function renderGrid(items){
    const grid = document.getElementById('herb-grid'); if(!grid) return;
    if (!items.length) { grid.innerHTML = '<div>Tidak ada data.</div>'; return; }
    grid.innerHTML = items.map(renderCard).join('');
    feather.replace();
    grid.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', onEdit));
    grid.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', onDelete));
    // Resolve uploader names after render
    grid.querySelectorAll('.uploaded-name').forEach(async (el) => {
      const uid = el.getAttribute('data-user');
      if (!uid) return;
      const target = el;
      try {
        const res = await fetch(`/api/users/${uid}`);
        if (res.ok) {
          const data = await res.json();
          // verify element still mounted and data-user unchanged
          if (target.isConnected && target.getAttribute('data-user') === uid) {
            target.textContent = data?.user?.name || target.textContent;
          }
        }
      } catch {}
    });
  }

  function renderCard(item){
    const img = item.gambar_url || 'https://placehold.co/600x400?text=Herbal';
    const yesNo = (v) => v && String(v).trim().length > 0 ? '<span class="badge yes">Yes</span>' : '<span class="badge no">No</span>';
    const statusBadge = (s) => {
      s = (s||'').toLowerCase();
      if (s === 'approved') return '<span class="badge status-approved">approved</span>';
      if (s === 'rejected') return '<span class="badge status-rejected">rejected</span>';
      return '<span class="badge status-pending">pending</span>';
    };
    const created = formatDateID(item.created_at);
    const uploadedBy = item.uploaded_by ? shortId(item.uploaded_by) : '-';
  return `
      <div class="herb-card" data-id="${item.id}">
    <div class="herb-media"><img src="${img}" alt="${escapeHtml(item.nama_umum || 'Herbal')}" class="herb-img" onerror="this.src='https://placehold.co/600x400?text=Herbal'" /></div>
        <div class="herb-body">
          <div class="title-row">
            <div class="herb-title">${escapeHtml(item.nama_umum || '-')}</div>
            <div>${statusBadge(item.status)}</div>
          </div>
          <div class="herb-sub"><em>${escapeHtml(item.nama_ilmiah || '-')}</em></div>
          <div class="herb-sub">Bagian: ${escapeHtml(item.bagian || '-')}</div>
          <div class="herb-meta">
            <div class="meta-row">
              <div>Manfaat: ${yesNo(item.manfaat)}</div>
              <div>Panduan: ${yesNo(item.cara_penggunaan)}</div>
            </div>
            <div class="meta-col">Creator: <span class="uploaded-name chip" data-user="${item.uploaded_by || ''}">${uploadedBy}</span></div>
            <div class="meta-col">Dibuat: <span class="chip">${created}</span></div>
          </div>
        </div>
        <div class="herb-footer">
          <div class="actions">
            <button class="btn-icon" data-edit title="Edit"><i data-feather="edit-2"></i></button>
            <button class="btn-icon danger" data-delete title="Hapus"><i data-feather="trash-2"></i></button>
          </div>
        </div>
      </div>
    `;
  }

  function renderPagination(){
    const el = document.getElementById('herb-pagination'); if(!el) return;
    const { page, totalPages } = state;
    let html = '';
    const btn = (p, label, disabled=false, active=false) => `<button class="page-btn ${active?'active':''}" ${disabled?'disabled':''} data-page="${p}">${label}</button>`;
    html += btn(Math.max(1, page-1), 'Prev', page<=1);
    for (let i=1;i<=totalPages;i++){ html += btn(i, i, false, i===page); }
    html += btn(Math.min(totalPages, page+1), 'Next', page>=totalPages);
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(b => b.addEventListener('click', (e)=>{
      const p = parseInt(e.currentTarget.getAttribute('data-page')); if(!isNaN(p) && p !== state.page) loadPage(p);
    }));
  }

  function onEdit(e){
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i data-feather="loader" class="spin"></i>';
    feather.replace({ elements: [btn] });
    const card = btn.closest('.herb-card');
    const id = card?.getAttribute('data-id'); if(!id) { btn.disabled=false; btn.innerHTML=original; feather.replace({ elements:[btn] }); return; }
    fetch(`/api/herbalpedia/${id}`).then(async r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(({ item }) => openModal(item))
      .catch(()=> Swal.fire('Error','Gagal memuat data.','error'))
      .finally(()=>{ btn.disabled=false; btn.innerHTML=original; feather.replace({ elements:[btn] }); });
  }

  function onDelete(e){
    const btn = e.currentTarget;
    const card = btn.closest('.herb-card');
    const id = card?.getAttribute('data-id'); if(!id) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      Swal.fire('Sesi berakhir','Silakan login ulang sebagai admin.','warning');
      return;
    }
    Swal.fire({ title:'Hapus herbal ini?', text:'Tindakan ini tidak dapat dibatalkan.', icon:'warning', showCancelButton:true, confirmButtonText:'Hapus', cancelButtonText:'Batal', confirmButtonColor:'#E53E3E' })
      .then(res => {
        if(!res.isConfirmed) return null;
        const original = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i data-feather="loader" class="spin"></i>';
        feather.replace({ elements: [btn] });
        return fetch(`/api/herbalpedia/${id}`, { method:'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r; })
          .then(() => { Swal.fire('Terhapus','Data dihapus.','success'); loadPage(1); })
          .finally(() => { btn.disabled = false; btn.innerHTML = original; feather.replace({ elements: [btn] }); });
      })
      .catch(()=> {/* ignore */});
  }

  function valOrNull(v){ v = String(v||'').trim(); return v ? v : null; }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); }
  function shortId(id){ return id ? id.slice(0,8) + '…' : '-'; }
  function formatDateID(dateStr){ if(!dateStr) return '-'; const d = new Date(dateStr); if(isNaN(d.getTime())) return '-'; return d.toLocaleDateString('id-ID',{ day:'2-digit', month:'short', year:'numeric' }); }

  function updateImagePreview(file, fallbackUrl){
    const wrap = document.getElementById('gambar_preview');
    const img = document.getElementById('gambar_preview_img');
    if (!wrap || !img) return;
    let url = null;
    if (file) {
      url = URL.createObjectURL(file);
    } else if (fallbackUrl) {
      url = fallbackUrl;
    }
    if (url) {
      img.src = url;
      wrap.style.display = '';
    } else {
      img.removeAttribute('src');
      wrap.style.display = 'none';
    }
  }
})();
