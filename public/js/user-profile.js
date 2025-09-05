// public/js/user-profile.js
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in and is a regular user
    if (typeof checkPageAccess === 'function') {
        checkPageAccess('user');
    }

    // Initialize page elements and event listeners
    initializeProfilePage();

    // Load user profile data
    loadUserProfile();
});

function initializeProfilePage() {
    // Initialize Feather icons
    feather.replace();

    // Setup menu navigation
    const menuLinks = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            // Update active link
            menuLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update active content
            contentSections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });
        });
    });

    // Handle profile form submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }

    // Handle logout
    const logoutButton = document.querySelector('.btn-logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Handle sidebar toggle for mobile
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992 && 
                !sidebar.contains(e.target) && 
                !sidebarToggle.contains(e.target) &&
                sidebar.classList.contains('show')) {
                sidebar.classList.remove('show');
            }
        });
    }
}

function handleLogout() {
    Swal.fire({
        title: 'Anda yakin ingin keluar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4A6C6A',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Ya, keluar',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = '../login.html';
        }
    });
}

async function loadUserProfile() {
    try {
        const userStr = localStorage.getItem('user');
        const token = localStorage.getItem('access_token');

        // Set default values first
        const defaultName = 'User';
        const defaultEmail = 'user@example.com';
        const defaultInitial = 'U';

        // Set default values in UI
        document.getElementById('sidebar-profile-name').textContent = defaultName;
        document.getElementById('sidebar-profile-email').textContent = defaultEmail;
        
        // Set default avatar with favicon.png
        const avatarContainer = document.getElementById('sidebar-avatar-container');
        avatarContainer.innerHTML = `<img src="../favicon.png" alt="Avatar" class="sidebar-avatar">`;

        if (!userStr || !token) {
            console.warn('No user data found, using favicon as default avatar');
            return;
        }

        const user = JSON.parse(userStr);

        // Update sidebar user info with real data
        if (user.name) {
            document.getElementById('sidebar-profile-name').textContent = user.name;
        }
        if (user.email) {
            document.getElementById('sidebar-profile-email').textContent = user.email;
        }

        // Update avatar in sidebar
        if (user.avatar || user.picture) {
            // Use Google avatar if available, fallback to user.avatar
            const avatarUrl = user.picture || user.avatar;
            avatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="sidebar-avatar" onerror="this.onerror=null; this.src='../favicon.png';">`;
        } else {
            // Use favicon.png as fallback instead of initials
            avatarContainer.innerHTML = `<img src="../favicon.png" alt="Avatar" class="sidebar-avatar">`;
        }

        // Populate form fields in the 'Profil' section
        const fullNameInput = document.getElementById('full-name');
        const emailInput = document.getElementById('email');
        
        if (fullNameInput && user.name) {
            fullNameInput.value = user.name;
        }
        if (emailInput && user.email) {
            emailInput.value = user.email;
        }

        // Fetch additional profile data (like phone number) from API
        try {
            const response = await fetch('/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const profileData = await response.json();
                const phoneInput = document.getElementById('phone');
                if (phoneInput && profileData.profile?.phone) {
                    phoneInput.value = profileData.profile.phone;
                }
            }
        } catch (apiError) {
            console.warn('Could not fetch additional profile data:', apiError);
        }

    } catch (error) {
        console.error('Error loading profile:', error);
        // Keep default values if there's an error
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();

    const fullName = document.getElementById('full-name').value;
    const phone = document.getElementById('phone').value;
    const token = localStorage.getItem('access_token');

    if (!token) {
        Swal.fire({
            title: 'Sesi Berakhir',
            text: 'Anda harus login terlebih dahulu untuk menyimpan perubahan.',
            icon: 'warning',
            confirmButtonColor: '#4A6C6A'
        });
        return;
    }

    // Show loading indicator
    Swal.fire({
        title: 'Menyimpan...',
        text: 'Mohon tunggu sebentar',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // API call to update profile
        const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: fullName, phone: phone })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Gagal memperbarui profil');
        }

        // Update local storage
        const user = JSON.parse(localStorage.getItem('user'));
        user.name = fullName;
        localStorage.setItem('user', JSON.stringify(user));

        // Update UI elements
        document.getElementById('sidebar-profile-name').textContent = fullName;
        
        // Update avatar initial
        const avatarContainer = document.getElementById('sidebar-avatar-container');
        const currentUser = JSON.parse(localStorage.getItem('user'));
        
        // Use Google avatar, user avatar, or favicon as fallback
        if (currentUser.picture || currentUser.avatar) {
            const avatarUrl = currentUser.picture || currentUser.avatar;
            avatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="sidebar-avatar" onerror="this.onerror=null; this.src='../favicon.png';">`;
        } else {
            avatarContainer.innerHTML = `<img src="../favicon.png" alt="Avatar" class="sidebar-avatar">`;
        }
        
        // Update the navbar if updateAuthSection function exists
        if (typeof updateAuthSection === 'function') {
            updateAuthSection();
        }

        Swal.fire({
            title: 'Berhasil!',
            text: 'Profil Anda telah berhasil diperbarui.',
            icon: 'success',
            confirmButtonColor: '#4A6C6A'
        });

    } catch (error) {
        console.error('Error updating profile:', error);
        Swal.fire({
            title: 'Error!',
            text: error.message || 'Terjadi kesalahan saat memperbarui profil.',
            icon: 'error',
            confirmButtonColor: '#4A6C6A'
        });
    }
}
