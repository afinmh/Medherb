document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

    // Authentication State Management
    initializeAuth();

    // Elemen Chat
    const chatBubble = document.getElementById('chat-bubble');
    const chatWindow = document.getElementById('chat-window');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const collapseChatBtn = document.getElementById('collapse-chat-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    // Fungsi utilitas
    const scrollToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Fungsi untuk menyimpan percakapan ke localStorage
// Fungsi untuk menyimpan percakapan (pastikan sudah benar)
const saveConversation = () => {
    const messages = [];
    chatMessages.querySelectorAll('.message').forEach(msgElement => {
        const sender = msgElement.classList.contains('user-message') ? 'user' : 'bot';
        
        const contentElement = msgElement.querySelector('.message-content').cloneNode(true);
        const statusElement = contentElement.querySelector('#model-status');
        if (statusElement) {
            statusElement.remove();
        }
        const content = contentElement.innerHTML;

        if (content.trim() !== '') {
            messages.push({ sender, content });
        }
    });
    localStorage.setItem('chatHistory', JSON.stringify(messages));
};

const addMessage = (content, sender) => {
    // 1. Membuat DIV PEMBUNGKUS LUAR
    const messageWrapper = document.createElement('div');
    // 2. Memberi DUA kelas: 'message' dan 'user-message' (atau 'bot-message')
    messageWrapper.className = `message ${sender}-message`;

    // 3. Membuat DIV KONTEN DALAM
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = content;

    // 4. Memasukkan div konten ke dalam div pembungkus
    messageWrapper.appendChild(messageContent);
    // 5. Memasukkan semuanya ke dalam area chat
    chatMessages.appendChild(messageWrapper);
    
    scrollToBottom();
    
    if (sender !== 'initial') {
        saveConversation();
    }
    return messageWrapper;
};

// Fungsi untuk memuat percakapan (pastikan sudah benar)
const loadConversation = () => {
    const history = JSON.parse(localStorage.getItem('chatHistory'));
    if (history && history.length > 0) {
        // Memanggil fungsi addMessage yang sudah diperbaiki
        history.forEach(msg => addMessage(msg.content, msg.sender));
    } else {
        const initialMsgContent = `<p>Halo! Saya asisten SiMbah. Ada yang bisa saya bantu terkait tanaman herbal?</p><small id="model-status">Menghubungkan ke server...</small>`;
        addMessage(initialMsgContent, 'bot');
    }
};

    // Event Listener untuk Tombol Header
    chatBubble.addEventListener('click', () => {
        chatWindow.classList.remove('hidden');
        chatBubble.classList.add('hidden');
    });

    closeChatBtn.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    });

    collapseChatBtn.addEventListener('click', () => {
        chatWindow.classList.toggle('collapsed');
        // Ganti ikon panah
        const icon = collapseChatBtn.querySelector('i');
        icon.setAttribute('data-feather', chatWindow.classList.contains('collapsed') ? 'chevron-up' : 'chevron-down');
        feather.replace();
    });

    clearChatBtn.addEventListener('click', () => {
        if (confirm('Anda yakin ingin menghapus semua riwayat obrolan ini?')) {
            localStorage.removeItem('chatHistory');
            chatMessages.innerHTML = ''; // Hapus dari UI
            loadConversation(); // Muat ulang pesan selamat datang
            checkModelStatus(); // Cek status model lagi
        }
    });

    // Cek status model AI
    // GANTI FUNGSI LAMA ANDA DENGAN YANG INI
    const checkModelStatus = async () => {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();

            // --- AWAL PERBAIKAN ---
            if (data.isReady) {
                // 1. Selalu aktifkan input dan tombol jika model siap.
                chatInput.disabled = false;
                sendBtn.disabled = false;

                // 2. Cari elemen status.
                const modelStatusEl = document.getElementById('model-status');
                
                // 3. HANYA perbarui teksnya JIKA elemen itu ada.
                if (modelStatusEl) {
                    modelStatusEl.textContent = 'Terhubung. Siap menerima pertanyaan!';
                }
            } else {
                // Jika model belum siap, coba lagi nanti.
                const modelStatusEl = document.getElementById('model-status');
                if (modelStatusEl) {
                    modelStatusEl.textContent = 'Sedang menyiapkan model AI...';
                }
                setTimeout(checkModelStatus, 3000);
            }
            // --- AKHIR PERBAIKAN ---

        } catch (error) {
            const modelStatusEl = document.getElementById('model-status');
            if (modelStatusEl) {
                modelStatusEl.textContent = 'Gagal terhubung ke server.';
            }
            console.error("Gagal memeriksa status model:", error);
        }
    };
    
    // Kirim pesan
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const question = chatInput.value.trim();
        if (!question) return;

        addMessage(`<p>${question}</p>`, 'user');
        chatInput.value = '';

        const typingIndicator = addMessage(
            `<div class="typing-indicator"><span></span><span></span><span></span></div>`, 'bot'
        );

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question }),
            });
            const data = await response.json();
            
            typingIndicator.remove();

            if (!response.ok) throw new Error(data.error || 'Terjadi kesalahan.');

            const cleanedAnswer = data.answer.replace(/\*\*/g, '');
            let sourcesHtml = '';
            let showSourceButtonHtml = '';

            // ... kode Anda yang lain ...

            if (data.retrieved_docs && data.retrieved_docs.length > 0) {
                showSourceButtonHtml = `<button class="source-toggle" data-action="show">Lihat Sumber</button>`;
                sourcesHtml = `
                    <div class="sources-container hidden">
                        ${data.retrieved_docs.map(doc => `
                            <div class="doc-item">
                                <a href="${doc.file_url || '#'}" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                class="doc-title-link"
                                style="font-weight: bold; color: #303d3fff; text-decoration: none;"
                                >
                                    ${doc.rank}. ${doc.title}
                                </a>
                                <p class="doc-meta">
                                    ${doc.author ? `Penulis: ${doc.author}` : ''}
                                    ${doc.year ? ` | Tahun: ${doc.year}` : ''}
                                    ${doc.similarity ? ` | Similarity: ${doc.similarity}` : ''}
                                </p>
                                <p class="doc-snippet">"${doc.snippet}"</p>
                            </div>
                        `).join('')}
                        <button class="source-toggle" data-action="hide">Tutup Sumber</button>
                    </div>`;
            }
            
            addMessage(
                `<p>${cleanedAnswer.replace(/\n/g, '<br>')}</p>
                 ${showSourceButtonHtml}
                 ${sourcesHtml}`,
                'bot'
            );

        } catch (error) {
            typingIndicator.remove();
            addMessage(`<p>Maaf, terjadi error: ${error.message}</p>`, 'bot');
        }
    });

    // Event delegation untuk tombol "Lihat Sumber"
    chatMessages.addEventListener('click', (e) => {
        if (e.target.matches('.source-toggle')) {
            const action = e.target.dataset.action;
            const messageContent = e.target.closest('.message-content');
            const showButton = messageContent.querySelector('.source-toggle[data-action="show"]');
            const sourcesContainer = messageContent.querySelector('.sources-container');

            if (action === 'show') {
                showButton.classList.add('hidden');
                sourcesContainer.classList.remove('hidden');
            } else if (action === 'hide') {
                sourcesContainer.classList.add('hidden');
                showButton.classList.remove('hidden');
            }
            scrollToBottom();
        }
    });

    // Inisialisasi
    loadConversation();
    checkModelStatus();
});

// Authentication Management Functions
function initializeAuth() {
    // Check for authentication tokens in URL (for OAuth redirect)
    checkUrlForTokens();
    
    // Update navbar based on auth state
    updateNavbarAuth();
    
    // Setup auth event listeners
    setupAuthEventListeners();
    
    // Check page access permissions
    checkPageAccess();
}

function checkUrlForTokens() {
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const type = urlParams.get('type');
    
    if (accessToken) {
        try {
            const payload = JSON.parse(atob(accessToken.split('.')[1]));
            const userData = {
                id: payload.sub,
                email: payload.email,
                name: payload.user_metadata?.full_name || payload.email,
                avatar: payload.user_metadata?.avatar_url,
                avatar_url: payload.user_metadata?.avatar_url,
                provider: payload.app_metadata?.provider
            };
            
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('access_token', accessToken);
            
            // Store refresh token if available
            if (refreshToken) {
                localStorage.setItem('refresh_token', refreshToken);
            }
            
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Update navbar
            updateNavbarAuth();
            
            console.log('Authentication successful, user logged in');
        } catch (error) {
            console.error('Error parsing token:', error);
        }
    }
}

function updateNavbarAuth() {
    const navbarExtra = document.querySelector('.navbar-extra');
    if (!navbarExtra) return;
    
    // Find existing auth elements and remove them
    const existingAuth = navbarExtra.querySelector('.login-btn, .user-profile');
    if (existingAuth) {
        existingAuth.remove();
    }
    
    const user = getCurrentUser();
    
    if (user) {
        // User is logged in - show profile
        const userProfile = createUserProfile(user);
        navbarExtra.insertBefore(userProfile, navbarExtra.firstChild);
    } else {
        // User is not logged in - show login button
        const loginBtn = createLoginButton();
        navbarExtra.insertBefore(loginBtn, navbarExtra.firstChild);
    }
    
    // Re-initialize Feather icons
    feather.replace();
}

// Simple avatar cache helpers (data URL)
function getCachedAvatar() {
    try { return localStorage.getItem('avatar_data_url') || null; } catch { return null; }
}
function setCachedAvatar(dataUrl) {
    try { if (dataUrl) localStorage.setItem('avatar_data_url', dataUrl); } catch {}
}
function clearCachedAvatar() {
    try { localStorage.removeItem('avatar_data_url'); } catch {}
}

function createLoginButton() {
    const loginBtn = document.createElement('a');
    loginBtn.href = '/login.html';
    loginBtn.className = 'login-btn';
    loginBtn.innerHTML = '<i data-feather="log-in"></i> Masuk';
    return loginBtn;
}

function createUserProfile(user) {
    const userProfile = document.createElement('div');
    userProfile.className = 'user-profile';
    
    // Debug: print avatar sources
    try {
        const cached = getCachedAvatar();
        console.debug('[Avatar][Navbar] sources:', {
            cached: cached ? `data-url(${cached.length} chars)` : null,
            user_avatar: user?.avatar || null,
            user_avatar_url: user?.avatar_url || null,
            user_picture: user?.picture || null
        });
    } catch {}

    const avatar = getCachedAvatar() || user.avatar_url || user.avatar || user.picture || '/favicon.png'; // prefer DB avatar
    const displayName = user.name || user.email;
    
    userProfile.innerHTML = `
    <img src="${avatar}" alt="${displayName}" class="user-avatar" onerror="this.src='/favicon.png'">
        <span class="user-name">${displayName}</span>
        <i data-feather="chevron-down"></i>
    <div class="user-dropdown">
            <a href="#" class="dropdown-item" data-action="profile">
                <i data-feather="user"></i>
                Profil Saya
            </a>
            <div class="dropdown-divider"></div>
            <a href="#" class="dropdown-item" data-action="logout">
                <i data-feather="log-out"></i>
                Keluar
            </a>
        </div>
    `;
    
    return userProfile;
}

function setupAuthEventListeners() {
    // Handle user profile dropdown
    document.addEventListener('click', (e) => {
        const userProfile = e.target.closest('.user-profile');
        const dropdown = document.querySelector('.user-dropdown');
        
        if (userProfile && dropdown) {
            e.preventDefault();
            dropdown.classList.toggle('show');
        } else if (dropdown && !dropdown.contains(e.target)) {
            // Close dropdown when clicking outside
            dropdown.classList.remove('show');
        }
        
        // Handle dropdown actions
        if (e.target.closest('.dropdown-item')) {
            e.preventDefault();
            const action = e.target.closest('.dropdown-item').dataset.action;
            handleDropdownAction(action);
        }
    });
}

function handleDropdownAction(action) {
    const dropdown = document.querySelector('.user-dropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    
    switch (action) {
        case 'profile':
            // Handle role-based profile routing
            redirectToProfile();
            break;
        case 'logout':
            logout();
            break;
    }
}

// Role-based routing functions
async function redirectToProfile() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    // Fetch latest user data with role
    try {
        const userData = await fetchUserProfile();
        if (userData && userData.role) {
            const role = userData.role.toLowerCase();
            if (role === 'admin') {
                window.location.href = '/admin/profile.html';
            } else {
                window.location.href = '/user/profile.html';
            }
        } else {
            // Default to user profile if role not found
            window.location.href = '/user/profile.html';
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        // Fallback to user profile
        window.location.href = '/user/profile.html';
    }
}

// redirectToSettings removed per request

// Fetch user profile with role from API
async function fetchUserProfile() {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        throw new Error('No access token');
    }

    const response = await fetch('/api/auth/profile', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user profile');
    }

    const data = await response.json();
    // Debug: log API avatar payload
    try {
        console.debug('[Avatar][API] /api/auth/profile user:', {
            avatar: data?.user?.avatar || null,
            avatar_url: data?.user?.avatar_url || null,
            name: data?.user?.name || null,
            email: data?.user?.email || null
        });
    } catch {}
    
    // Update stored user data with role
    if (data.user) {
        const currentUser = getCurrentUser();
        const updatedUser = {
            ...currentUser,
            ...data.user
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        // Try caching avatar as data URL for reliable display
    const avatarUrl = data.user.avatar_url || data.user.avatar || data.user.picture;
        if (avatarUrl) {
            try {
                const r = await fetch(avatarUrl, { cache: 'no-store' });
                if (r.ok) {
                    const blob = await r.blob();
                    // Only cache smallish images (< 2.5MB) to avoid exceeding quota
                    if (blob.size < 2.5 * 1024 * 1024) {
                        const reader = new FileReader();
                        const p = new Promise(res => { reader.onloadend = () => res(reader.result); });
                        reader.readAsDataURL(blob);
                        const dataUrl = await p;
            setCachedAvatar(dataUrl);
            console.debug('[Avatar][Cache] cached data URL with size (chars):', dataUrl.length);
                    }
                }
            } catch (e) {
        console.debug('[Avatar][Cache] failed to cache avatar:', e?.message || e);
            }
        }
        updateNavbarAuth(); // Update navbar with new user data
    }
    
    return data.user;
}

// Page protection function
function checkPageAccess() {
    const currentPath = window.location.pathname;
    const user = getCurrentUser();
    
    // If user is not logged in and trying to access protected pages
    if (!user && (currentPath.includes('/user/') || currentPath.includes('/admin/'))) {
        window.location.href = '/login.html';
        return false;
    }
    
    // If user is logged in, check role-based access
    if (user) {
        fetchUserProfile().then(userData => {
            if (userData && userData.role) {
                const userRole = userData.role.toLowerCase();
                
                // Admin trying to access user pages
                if (userRole === 'admin' && currentPath.includes('/user/')) {
                    window.location.href = currentPath.replace('/user/', '/admin/');
                    return false;
                }
                
                // User trying to access admin pages
                if (userRole === 'user' && currentPath.includes('/admin/')) {
                    Swal.fire({
                        title: 'Akses Ditolak',
                        text: 'Anda tidak memiliki izin untuk mengakses halaman admin.',
                        icon: 'error',
                        confirmButtonColor: '#5A7D7C',
                        confirmButtonText: 'OK'
                    }).then(() => {
                        window.location.href = currentPath.replace('/admin/', '/user/');
                    });
                    return false;
                }
            }
        }).catch(error => {
            console.error('Error checking page access:', error);
            // On error, redirect to login
            window.location.href = '/login.html';
        });
    }
    
    return true;
}

function logout() {
    // Show confirmation dialog
    Swal.fire({
        title: 'Keluar dari Akun?',
        text: 'Anda yakin ingin keluar dari akun Anda?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#5A7D7C',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            performLogout();
        }
    });
}

function performLogout() {
    const accessToken = localStorage.getItem('access_token');
    
    // Show loading
    Swal.fire({
        title: 'Logging out...',
        text: 'Sedang memproses logout',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    // Call logout API if we have a token
    if (accessToken) {
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        }).then(response => {
            if (response.ok) {
                console.log('Server logout successful');
            } else {
                console.log('Server logout failed, continuing with client logout');
            }
        }).catch(error => {
            console.log('Logout API error:', error);
        }).finally(() => {
            // Always perform client-side logout regardless of server response
            performClientLogout();
        });
    } else {
        // No token, just perform client-side logout
        performClientLogout();
    }
}

function performClientLogout() {
    // Clear local storage
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    
    // Clear any other auth-related data
    localStorage.removeItem('refresh_token');
    clearCachedAvatar();
    
    // Update navbar
    updateNavbarAuth();
    
    // Show success message
    Swal.fire({
        title: 'Logout Berhasil!',
        text: 'Anda telah berhasil keluar dari akun',
        icon: 'success',
        confirmButtonColor: '#5A7D7C',
        confirmButtonText: 'OK',
        timer: 2000,
        timerProgressBar: true
    }).then(() => {
        // Optional: redirect to home page if not already there
        if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
            window.location.href = '/index.html';
        }
    });
}

function getCurrentUser() {
    try {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

function isAuthenticated() {
    return getCurrentUser() !== null;
}