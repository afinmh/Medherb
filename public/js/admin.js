document.addEventListener('DOMContentLoaded', function() {
    // 1. Inisialisasi utama aplikasi
    initializeApp();
});

function initializeApp() {
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
    // Toggle sidebar di mobile
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    // Tombol Logout
    const logoutButton = document.querySelector('.btn-logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
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
}

function loadAdminProfile() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return;
        
        const userName = user.name || 'Admin';
        const userInitial = userName.charAt(0).toUpperCase();

        document.getElementById('welcome-message').textContent = `Selamat Datang, ${userName}!`;
        document.getElementById('admin-name-sidebar').textContent = userName;
        document.getElementById('admin-avatar-sidebar').textContent = userInitial;

    } catch (error) {
        console.error('Gagal memuat profil admin:', error);
    }
}

function loadDashboardStats() {
    // Simulasi data dummy
    setTimeout(() => {
        document.getElementById('total-users').textContent = '1,247';
        document.getElementById('total-plants').textContent = '821';
        document.getElementById('total-journals').textContent = '4,590';
    }, 500);
}
