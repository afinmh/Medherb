(function(){
  document.addEventListener('DOMContentLoaded', () => {
    // reuse access and sidebar events from admin.js
    try { if (!window.checkAdminAccess || !checkAdminAccess()) return; } catch {}
    feather.replace();

    initRefsPage();
  });

  const state = { page: 1, limit: 9, totalPages: 1 };

  function initRefsPage(){
    loadPage(1);
    bindModal();
  bindCreate();
  }

  function loadPage(page){
    state.page = page;
    const grid = document.getElementById('refs-grid');
    const pager = document.getElementById('refs-pagination');
    if (grid) grid.innerHTML = '<div>Memuat...</div>';
    if (pager) pager.innerHTML = '';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch(`/api/documents?page=${page}&limit=${state.limit}`, { signal: controller.signal })
      .then(async res => {
        clearTimeout(timeout);
        if (!res.ok) throw new Error('HTTP '+res.status);
        return res.json();
      })
      .then(data => {
        const docs = Array.isArray(data?.documents) ? data.documents : [];
        const pag = data?.pagination || {};
        state.totalPages = pag.totalPages || 1;
        renderGrid(docs);
        renderPagination();
      })
      .catch(err => {
        console.error('Gagal memuat referensi:', err);
        if (grid) grid.innerHTML = '<div>Gagal memuat data.</div>';
      });
  }

  function renderGrid(docs){
    const grid = document.getElementById('refs-grid');
    if (!grid) return;
    if (!docs.length) { grid.innerHTML = '<div>Tidak ada data.</div>'; return; }
    grid.classList.add('cards-grid');
    grid.innerHTML = docs.map(d => `
      <div class="herb-card" data-id="${d.id}">
        <div class="herb-body">
          <div class="title-row">
            <div class="herb-title">${escapeHtml(d.judul || '-')}</div>
            <div class="chip">${d.tahun ?? '-'}</div>
          </div>
          <div class="herb-sub">${escapeHtml(d.penulis || '-')}</div>
          <div class="herb-meta">
            <div class="meta-row">
              <div>Processed: ${d.is_processed ? '<span class="badge yes">Yes</span>' : '<span class="badge no">No</span>'}</div>
              <div>File: <a class="pdf-link" href="${d.file_url}" target="_blank" rel="noopener">PDF</a></div>
            </div>
            <div class="meta-col">Dibuat: <span class="chip">${formatDateID(d.created_at)}</span></div>
          </div>
        </div>
        <div class="herb-footer">
          <div class="actions">
            ${d.is_processed ? `<span class="btn-processed" title="Selesai diproses"><i data-feather="check-circle"></i><span>Proses</span></span>` : `<button class="btn-process" data-process title="Proses sekarang"><i data-feather="loader"></i><span>Proses</span></button>`}
            <button class="btn-icon" data-edit title="Edit"><i data-feather="edit-2"></i></button>
            <button class="btn-icon danger" data-delete title="Hapus"><i data-feather="trash-2"></i></button>
          </div>
        </div>
      </div>
    `).join('');
    feather.replace();
    grid.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', onEdit));
    grid.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', onDelete));
    grid.querySelectorAll('[data-process]').forEach(btn => btn.addEventListener('click', onProcess));
  }

  function renderPagination(){
    const el = document.getElementById('refs-pagination');
    if (!el) return;
    const { page, totalPages } = state;

    const btn = (p, label, disabled=false, active=false) => `
      <button class="page-btn ${active?'active':''}" ${disabled?'disabled':''} data-page="${p}">${label}</button>
    `;

    let html = '';
    html += btn(Math.max(1, page-1), 'Prev', page<=1);
    for (let i=1;i<=totalPages;i++) {
      html += btn(i, i, false, i===page);
    }
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
    btn.disabled = true; btn.innerHTML = '<i data-feather="loader" class="spin"></i>';
    feather.replace({ elements: [btn] });
    const card = btn.closest('.herb-card');
    const id = card?.getAttribute('data-id');
    if (!id) { btn.disabled = false; btn.innerHTML = original; feather.replace({ elements: [btn] }); return; }
    fetch(`/api/documents/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(({ document }) => openEditModal(document))
      .catch(() => Swal.fire('Error','Gagal memuat data.','error'))
      .finally(() => { btn.disabled = false; btn.innerHTML = original; feather.replace({ elements: [btn] }); });
  }

  function openEditModal(doc){
    const modal = document.getElementById('edit-modal');
    if (!modal) return;
    setModal(true);
    document.getElementById('edit-id').value = doc.id;
    document.getElementById('edit-judul').value = doc.judul || '';
    document.getElementById('edit-penulis').value = doc.penulis || '';
    document.getElementById('edit-tahun').value = doc.tahun ?? '';
  }

  function bindModal(){
    const modal = document.getElementById('edit-modal');
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-close]')) setModal(false);
    });
    document.getElementById('save-edit').addEventListener('click', saveEdit);
    document.addEventListener('keydown', (e)=>{
      if (e.key==='Escape') setModal(false);
    });
  }

  function bindCreate(){
    const openBtn = document.getElementById('add-ref');
    const modal = document.getElementById('create-modal');
    const saveBtn = document.getElementById('save-create');
    if (!openBtn || !modal || !saveBtn) return;
    openBtn.addEventListener('click', () => setCreateModal(true));
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-close]')) setCreateModal(false);
    });
    saveBtn.addEventListener('click', saveCreate);
    document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') setCreateModal(false); });
  }

  function setCreateModal(show){
    const modal = document.getElementById('create-modal');
    if (!modal) return;
    if (show) { modal.classList.add('show'); document.body.style.overflow='hidden'; }
    else { modal.classList.remove('show'); document.body.style.overflow=''; }
  }

  function saveCreate(){
    const judul = document.getElementById('create-judul').value.trim();
    const penulis = document.getElementById('create-penulis').value.trim() || null;
    const tahun = toIntOrNull(document.getElementById('create-tahun').value);
    const fileInput = document.getElementById('create-file');
    const file = fileInput?.files?.[0];
    if (!judul || !file) {
      Swal.fire('Validasi','Judul dan File PDF wajib diisi.','warning');
      return;
    }
    const form = new FormData();
    form.append('judul', judul);
    if (penulis) form.append('penulis', penulis);
    if (tahun !== null) form.append('tahun', String(tahun));
    form.append('file', file);

    fetch('/api/documents/upload', {
      method: 'POST',
      body: form
    }).then(async res => {
      if (!res.ok) throw new Error('HTTP '+res.status);
      return res.json();
    }).then(() => {
      setCreateModal(false);
      Swal.fire('Berhasil','Referensi berhasil ditambahkan.','success');
      loadPage(1);
    }).catch(err => {
      console.error(err);
      Swal.fire('Error','Gagal menambahkan referensi.','error');
    });
  }

  function setModal(show){
    const modal = document.getElementById('edit-modal');
    if (!modal) return;
    if (show){
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    } else {
      modal.classList.remove('show');
      document.body.style.overflow = '';
    }
  }

  function saveEdit(){
    const id = document.getElementById('edit-id').value;
    const payload = {
      judul: document.getElementById('edit-judul').value.trim(),
      penulis: document.getElementById('edit-penulis').value.trim() || null,
      tahun: toIntOrNull(document.getElementById('edit-tahun').value)
    };

    if (!payload.judul) {
      Swal.fire('Validasi','Judul wajib diisi.','warning');
      return;
    }

    fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(async res => {
      if (!res.ok) throw new Error('HTTP '+res.status);
      return res.json();
    }).then(() => {
      setModal(false);
      Swal.fire('Berhasil','Referensi berhasil diperbarui.','success');
      loadPage(state.page);
    }).catch(err => {
      console.error(err);
      Swal.fire('Error','Gagal menyimpan perubahan.','error');
    });
  }

  function onDelete(e){
    const btn = e.currentTarget;
    const card = btn.closest('.herb-card');
    const id = card?.getAttribute('data-id');
    if (!id) return;
    Swal.fire({
      title:'Hapus referensi ini?',
      text:'Tindakan ini tidak dapat dibatalkan.',
      icon:'warning',
      showCancelButton:true,
      confirmButtonText:'Hapus',
      cancelButtonText:'Batal',
      confirmButtonColor:'#E53E3E'
    }).then(res => {
      if (!res.isConfirmed) return null;
      const original = btn.innerHTML; btn.disabled = true;
      btn.innerHTML = '<i data-feather="loader" class="spin"></i>';
      feather.replace({ elements: [btn] });
      return fetch(`/api/documents/${id}`, { method:'DELETE' })
        .then(r => { if (!r.ok) throw new Error('HTTP '+r.status); return r; })
        .then(r => { if (!r) return null; Swal.fire('Terhapus','Referensi dihapus.','success'); loadPage(1); return r; })
        .finally(() => { btn.disabled = false; btn.innerHTML = original; feather.replace({ elements: [btn] }); });
    }).catch(() => { /* ignore */ });
  }

  // Proses dokumen: panggil endpoint pembersihan lalu tandai sebagai processed
  function onProcess(e){
    const btn = e.currentTarget;
    const card = btn.closest('.herb-card');
    const id = card?.getAttribute('data-id');
    const originalHTML = btn.innerHTML;
    if (!id) {
      console.warn('[Process][Client] No id found for process button, aborting.');
      // restore UI just in case
      btn.disabled = false;
      btn.innerHTML = originalHTML;
      feather.replace({ elements: [btn] });
      return;
    }

    console.log('[Process][Client] start processing id=', id);
    btn.disabled = true;
    btn.innerHTML = '<i data-feather="loader"></i><span>Memproses...</span>';
    feather.replace({ elements: [btn] });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    fetch(`/api/documents/${id}/process`, { method: 'POST', signal: controller.signal })
      .then(async res => {
        clearTimeout(timeout);
        if (!res.ok) {
          const txt = await res.text().catch(()=>null);
          console.error('[Process][Client] process endpoint returned', res.status, txt);
          throw new Error('HTTP '+res.status);
        }
        return res.json();
      })
      .then(data => {
        console.log('[Process][Client] process response metadata:', data?.metadata, 'chunks:', data?.chunk_count, 'length:', data?.length, 'inserted:', data?.inserted_count);
        // Tandai processed di DB
        return fetch(`/api/documents/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_processed: true })
        });
      })
      .then(async res => {
        if (!res.ok) {
          const t = await res.text().catch(()=>null);
          console.error('[Process][Client] patch returned', res.status, t);
          throw new Error('PATCH HTTP '+res.status);
        }
        return res.json();
      })
      .then(() => {
        const badge = document.createElement('span');
        badge.className = 'btn-processed';
        badge.title = 'Selesai diproses';
        badge.innerHTML = '<i data-feather="check-circle"></i><span>Proses</span>';
        btn.replaceWith(badge);
        feather.replace({ elements: [badge] });
        Swal.fire('Selesai', 'Dokumen berhasil diproses.', 'success');
      })
      .catch(err => {
        console.error('Gagal memproses dokumen:', err);
        Swal.fire('Error', 'Gagal memproses dokumen.', 'error');
        try { clearTimeout(timeout); } catch(_){}
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        feather.replace({ elements: [btn] });
      });
  }

  function toIntOrNull(v){
    const n = parseInt(v); return isNaN(n) ? null : n;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
  }
})();
