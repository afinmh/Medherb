(function(){
  document.addEventListener('DOMContentLoaded', () => {
    // reuse access and sidebar events from admin.js
    try { if (!window.checkAdminAccess || !checkAdminAccess()) return; } catch {}
    try { if (window.setupEventListeners) setupEventListeners(); } catch {}
    feather.replace();

    initRefsPage();
  });

  const state = { page: 1, limit: 10, totalPages: 1 };

  function initRefsPage(){
    loadPage(1);
    bindModal();
  bindCreate();
  }

  function loadPage(page){
    state.page = page;
    const tbody = document.getElementById('refs-tbody');
    const pager = document.getElementById('refs-pagination');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5">Memuat...</td></tr>';
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
        renderTable(docs);
        renderPagination();
      })
      .catch(err => {
        console.error('Gagal memuat referensi:', err);
        if (tbody) tbody.innerHTML = '<tr><td colspan="5">Gagal memuat data.</td></tr>';
      });
  }

  function renderTable(docs){
    const tbody = document.getElementById('refs-tbody');
    if (!tbody) return;
    if (!docs.length) {
      tbody.innerHTML = '<tr><td colspan="5">Tidak ada data.</td></tr>';
      return;
    }
    tbody.innerHTML = docs.map(d => `
      <tr data-id="${d.id}">
        <td>${escapeHtml(d.judul || '')}</td>
        <td>${escapeHtml(d.penulis || '-')}</td>
        <td>${d.tahun ?? '-'}</td>
        <td>
          <a class="pdf-link" href="${d.file_url}" target="_blank" rel="noopener">
            <i data-feather="file-text"></i>
            <span>PDF</span>
          </a>
        </td>
        <td>
          ${d.is_processed ? `
            <span class="btn-processed" title="Selesai diproses">
              <i data-feather="check-circle"></i>
              <span>Proses</span>
            </span>
          ` : `
            <button class="btn-process" data-process title="Proses sekarang">
              <i data-feather="loader"></i>
              <span>Proses</span>
            </button>
          `}
          <button class="btn-icon" data-edit><i data-feather="edit-2"></i></button>
          <button class="btn-icon danger" data-delete><i data-feather="trash-2"></i></button>
        </td>
      </tr>
    `).join('');
    feather.replace();

    tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', onEdit));
    tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', onDelete));
    tbody.querySelectorAll('[data-process]').forEach(btn => btn.addEventListener('click', onProcess));
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
    const tr = e.currentTarget.closest('tr');
    const id = tr?.getAttribute('data-id');
    if (!id) return;

    fetch(`/api/documents/${id}`)
      .then(r => r.json())
      .then(({ document }) => openEditModal(document))
      .catch(err => Swal.fire('Error','Gagal memuat data.','error'));
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
    if (show) modal.classList.add('show'); else modal.classList.remove('show');
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
    } else {
      modal.classList.remove('show');
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
    const tr = e.currentTarget.closest('tr');
    const id = tr?.getAttribute('data-id');
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
      if (!res.isConfirmed) return;
      fetch(`/api/documents/${id}`, { method:'DELETE' })
        .then(r => { if(!r.ok) throw new Error('HTTP '+r.status); })
        .then(() => { Swal.fire('Terhapus','Referensi dihapus.','success'); loadPage(1); })
        .catch(() => Swal.fire('Error','Gagal menghapus.','error'));
    });
  }

  // Proses dokumen: panggil endpoint pembersihan lalu tandai sebagai processed
  function onProcess(e){
    const btn = e.currentTarget;
    const tr = btn.closest('tr');
    const id = tr?.getAttribute('data-id');
    if (!id) return;

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i data-feather="loader"></i><span>Memproses...</span>';
    feather.replace({ elements: [btn] });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

  fetch(`/api/documents/${id}/process`, { method: 'POST', signal: controller.signal })
      .then(async res => {
        clearTimeout(timeout);
        if (!res.ok) throw new Error('HTTP '+res.status);
        return res.json();
      })
      .then(data => {
    console.log('[Process][Client] metadata:', data?.metadata, 'chunks:', data?.chunk_count, 'length:', data?.length);
        // Tandai processed di DB
        return fetch(`/api/documents/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_processed: true })
        });
      })
      .then(async res => {
        if (!res.ok) throw new Error('PATCH HTTP '+res.status);
        return res.json();
      })
      .then(() => {
        const badge = document.createElement('span');
        badge.className = 'btn-processed';
        badge.title = 'Selesai diproses';
        badge.innerHTML = '<i data-feather="check-circle"></i><span>Proses</span>';
        btn.replaceWith(badge);
        feather.replace({ elements: [badge] });
        Swal.fire('Selesai', 'Dokumen berhasil dibersihkan.', 'success');
      })
      .catch(err => {
        console.error('Gagal memproses dokumen:', err);
        Swal.fire('Error', 'Gagal memproses dokumen.', 'error');
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
