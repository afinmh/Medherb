// Pastikan init tetap berjalan meski DOMContentLoaded sudah lewat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { console.info('[admin] DOMContentLoaded'); initializeApp(); });
} else {
    console.info('[admin] init (document already ready)');
    initializeApp();
}

function initializeApp() {
    console.info('[admin] initializeApp called');
    // 2. Periksa akses, hentikan jika bukan admin
    if (!checkAdminAccess()) return;

    // 3. Muat semua data dummy
    loadDashboardData();

    // 4. Atur semua event listener interaktif
    setupEventListeners();

    // 5. Ganti semua ikon Feather
    feather.replace();
}

function checkAdminAccess() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || user.role !== 'admin') {
            window.location.href = '../login.html'; // Alihkan tanpa alert untuk pengalaman lebih cepat
            return false;
        }
        return true;
    } catch (error) {
        window.location.href = '../login.html';
        return false;
    }
}

function setupEventListeners() {
    if (window.__adminListenersBound) {
        console.info('[admin] setupEventListeners skipped (already bound)');
        return;
    }
    window.__adminListenersBound = true;
    console.info('[admin] setupEventListeners');
    // Toggle sidebar di mobile (delegated + reusable)
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    console.info('[admin] elements', { hasSidebar: !!sidebar, hasOverlay: !!sidebarOverlay, hasToggle: !!sidebarToggle });

    const toggleSidebar = (show) => {
        if (!sidebar) return;
        const willShow = typeof show === 'boolean' ? show : !sidebar.classList.contains('show');
        sidebar.classList.toggle('show', willShow);
        if (sidebarOverlay) sidebarOverlay.classList.toggle('show', willShow);
        document.body.style.overflow = willShow ? 'hidden' : '';
        console.info('[admin] toggleSidebar', { willShow });
    };

    // Button by id
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.info('[admin] toggle button clicked');
            toggleSidebar();
        });
    } else {
        // Fallback: event delegation only when button not found at init
        document.addEventListener('click', (e) => {
            const btn = e.target && (e.target.closest ? e.target.closest('#sidebar-toggle') : null);
            if (btn) {
                e.preventDefault();
                console.info('[admin] delegated toggle click');
                toggleSidebar();
            }
        });
    }

    // Tutup sidebar saat overlay diklik
    if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => { console.info('[admin] overlay click'); toggleSidebar(false); });
    }

    // Tutup sidebar dengan tombol ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('show')) {
            console.info('[admin] ESC pressed');
            toggleSidebar(false);
        }
    });

    // Tombol Logout
    const logoutButton = document.querySelector('.btn-logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Toggle notifications dropdown
    const notifToggle = document.getElementById('notif-toggle');
    const notifDropdown = document.getElementById('notif-dropdown');
    if (notifToggle && notifDropdown) {
        notifToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle('show');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!notifDropdown.contains(e.target) && e.target !== notifToggle) {
                notifDropdown.classList.remove('show');
            }
        });

        // Close on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                notifDropdown.classList.remove('show');
            }
        });
    }
}

function handleLogout() {
    Swal.fire({
        title: 'Anda yakin ingin keluar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#5A7D7C',
        cancelButtonColor: '#E53E3E',
        confirmButtonText: 'Ya, keluar',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = '../login.html';
        }
    });
}

function loadDashboardData() {
    loadAdminProfile();
    loadDashboardStats();
    loadRecentActivity();
}

function loadAdminProfile() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return;
        
        const userName = user.name || 'Admin';
        const userInitial = userName.charAt(0).toUpperCase();
    const welcomeEl = document.getElementById('welcome-message');
    if (welcomeEl) welcomeEl.textContent = `Selamat Datang, ${userName}!`;
    const nameEl = document.getElementById('admin-name-sidebar');
    if (nameEl) nameEl.textContent = userName;
    const avatarEl = document.getElementById('admin-avatar-sidebar');
    if (avatarEl) avatarEl.textContent = userInitial;

    } catch (error) {
        console.error('Gagal memuat profil admin:', error);
    }
}

function loadDashboardStats() {
    // Herbal count (ambil dari /api/herbalpedia)
    const usersEl = document.getElementById('total-users');
    const plantsEl = document.getElementById('total-plants');
    const journalsEl = document.getElementById('total-journals');
    if (plantsEl) plantsEl.textContent = '...';
    if (usersEl) usersEl.textContent = '...';
    if (journalsEl) journalsEl.textContent = '...';

    // Ambil total users (role=user) dari API /api/users
    {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        fetch('/api/users?limit=1&page=1&role=user', { signal: controller.signal, headers: { 'Accept': 'application/json' } })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const total = data?.pagination?.totalUsers;
                if (typeof total === 'number') {
                    if (usersEl) usersEl.textContent = formatNumber(total);
                } else {
                    if (usersEl) usersEl.textContent = '-';
                }
            })
            .catch((err) => {
                console.error('Gagal memuat total pengguna:', err);
                if (usersEl) usersEl.textContent = '-';
            });
    }

    // Ambil total dokumen jurnal dari API Next.js /api/documents
    // Kita cukup ambil 1 item saja agar ringan; count tetap "exact" dari Supabase
    {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        fetch('/api/documents?limit=1&page=1', { signal: controller.signal, headers: { 'Accept': 'application/json' } })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const total = data?.pagination?.totalDocuments;
                if (typeof total === 'number') {
                    if (journalsEl) journalsEl.textContent = formatNumber(total);
                } else {
                    if (journalsEl) journalsEl.textContent = '-';
                }
            })
            .catch((err) => {
                console.error('Gagal memuat total jurnal:', err);
                if (journalsEl) journalsEl.textContent = '-';
            });
    }

    // Ambil total herbal dari API /api/herbalpedia
    {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        fetch('/api/herbalpedia?limit=1&page=1', { signal: controller.signal, headers: { 'Accept': 'application/json' } })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const total = data?.pagination?.totalItems;
                if (typeof total === 'number') {
                    if (plantsEl) plantsEl.textContent = formatNumber(total);
                } else {
                    if (plantsEl) plantsEl.textContent = '-';
                }
            })
            .catch((err) => {
                console.error('Gagal memuat total herbal:', err);
                if (plantsEl) plantsEl.textContent = '-';
            });
    }
}

function formatNumber(num) {
    try {
        return new Intl.NumberFormat('id-ID').format(num);
    } catch (e) {
        return String(num);
    }
}

function loadRecentActivity() {
    // 1) Aktivitas pengguna terbaru (ikon user-plus)
    const userItemIcon = document.querySelector('.recent-activity .activity-item i[data-feather="user-plus"]');
    const userItem = userItemIcon ? userItemIcon.parentElement : null;
    if (userItem) {
        const textEl = userItem.querySelector('.activity-text');
        const timeEl = userItem.querySelector('.activity-time');
        if (textEl) textEl.textContent = 'Memuat pengguna terbaru...';
        if (timeEl) timeEl.textContent = '';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        fetch('/api/users?limit=1&page=1&role=user', { signal: controller.signal, headers: { 'Accept': 'application/json' } })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const usr = Array.isArray(data?.users) ? data.users[0] : null;
                if (!usr) {
                    if (textEl) textEl.textContent = 'Belum ada pengguna.';
                    if (timeEl) timeEl.textContent = '-';
                    return;
                }
                const name = usr.name || 'Pengguna Baru';
                const createdAt = usr.created_at || usr.createdAt || null;
                const shortName = truncateWords(name, 3);
                if (textEl) textEl.textContent = `Pengguna ${shortName} baru saja mendaftar.`;
                if (timeEl) timeEl.textContent = formatDateID(createdAt);
            })
            .catch((err) => {
                console.error('Gagal memuat pengguna terbaru:', err);
                if (textEl) textEl.textContent = 'Gagal memuat pengguna terbaru.';
                if (timeEl) timeEl.textContent = '-';
            });
    }

    // 2) Aktivitas jurnal terbaru (ikon book-open)
    const journalItemIcon = document.querySelector('.recent-activity .activity-item i[data-feather="book-open"]');
    const journalItem = journalItemIcon ? journalItemIcon.parentElement : null;
    if (journalItem) {
        const textEl = journalItem.querySelector('.activity-text');
        const timeEl = journalItem.querySelector('.activity-time');
        if (textEl) textEl.textContent = 'Memuat jurnal terbaru...';
        if (timeEl) timeEl.textContent = '';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        fetch('/api/documents?limit=1&page=1', { signal: controller.signal, headers: { 'Accept': 'application/json' } })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const doc = Array.isArray(data?.documents) ? data.documents[0] : null;

                if (!doc) {
                    if (textEl) textEl.textContent = 'Belum ada jurnal.';
                    if (timeEl) timeEl.textContent = '-';
                    return;
                }

                const title = doc.judul || 'Tanpa Judul';
                const createdAt = doc.created_at || doc.createdAt || null;
                const shortTitle = truncateWords(title, 3);
                if (textEl) textEl.textContent = `Jurnal "${shortTitle}" baru saja ditambahkan.`;
                if (timeEl) timeEl.textContent = formatDateID(createdAt);
            })
            .catch((err) => {
                console.error('Gagal memuat aktivitas jurnal terbaru:', err);
                if (textEl) textEl.textContent = 'Gagal memuat jurnal terbaru.';
                if (timeEl) timeEl.textContent = '-';
            });
    }

    // 3) Aktivitas herbal terbaru (gunakan ikon feather)
    const herbIcon = document.querySelector('.recent-activity .activity-item i[data-feather="feather"]');
    const herbItem = herbIcon ? herbIcon.parentElement : null;
    if (herbItem) {
        const textEl = herbItem.querySelector('.activity-text');
        const timeEl = herbItem.querySelector('.activity-time');
        if (textEl) textEl.textContent = 'Memuat herbal terbaru...';
        if (timeEl) timeEl.textContent = '';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        fetch('/api/herbalpedia?limit=1&page=1', { signal: controller.signal, headers: { 'Accept': 'application/json' } })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const item = Array.isArray(data?.items) ? data.items[0] : null;
                if (!item) {
                    if (textEl) textEl.textContent = 'Belum ada data herbal.';
                    if (timeEl) timeEl.textContent = '-';
                    return;
                }
                const title = item.nama_umum || 'Herbal baru';
                const createdAt = item.created_at || null;
                const shortTitle = truncateWords(title, 3);
                if (textEl) textEl.textContent = `Herbal "${shortTitle}" baru saja ditambahkan.`;
                if (timeEl) timeEl.textContent = formatDateID(createdAt);
            })
            .catch((err) => {
                console.error('Gagal memuat herbal terbaru:', err);
                if (textEl) textEl.textContent = 'Gagal memuat herbal terbaru.';
                if (timeEl) timeEl.textContent = '-';
            });
    }
}

function truncateWords(text, count) {
    try {
        const words = String(text).trim().split(/\s+/);
        const slice = words.slice(0, count).join(' ');
        return words.length > count ? `${slice}..` : slice;
    } catch {
        return String(text);
    }
}

function formatDateID(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
