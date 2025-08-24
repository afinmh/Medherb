document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

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

            if (data.retrieved_docs && data.retrieved_docs.length > 0) {
                showSourceButtonHtml = `<button class="source-toggle" data-action="show">Lihat Sumber</button>`;
                sourcesHtml = `
                    <div class="sources-container hidden">
                        ${data.retrieved_docs.map(doc => `
                            <div class="doc-item">
                                <p class="doc-title">${doc.rank}. ${doc.title}</p>
                                <p class="doc-meta">(Similarity: ${doc.similarity})</p>
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