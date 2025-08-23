document.addEventListener('DOMContentLoaded', () => {
    // Panggil Feather Icons
    feather.replace();

    // Elemen Chat
    const chatBubble = document.getElementById('chat-bubble');
    const chatWindow = document.getElementById('chat-window');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const modelStatus = document.getElementById('model-status');

    // Tampilkan/Sembunyikan Jendela Chat dan Ikon
    chatBubble.addEventListener('click', () => {
        chatWindow.classList.remove('hidden');
        chatBubble.classList.add('hidden'); // Sembunyikan ikon saat chat dibuka
    });
    closeChatBtn.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
        chatBubble.classList.remove('hidden'); // Tampilkan lagi ikon saat chat ditutup
    });

    // Fungsi untuk scroll ke pesan terakhir
    const scrollToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Fungsi untuk menambahkan pesan ke UI
    const addMessage = (content, sender) => {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `message ${sender}-message`;
        messageWrapper.innerHTML = content;
        chatMessages.appendChild(messageWrapper);
        scrollToBottom();
        return messageWrapper;
    };
    
    // Cek status model AI
    const checkModelStatus = async () => {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            if (data.isReady) {
                modelStatus.textContent = 'Terhubung. Siap menerima pertanyaan!';
                chatInput.disabled = false;
                sendBtn.disabled = false;
            } else {
                modelStatus.textContent = 'Sedang menyiapkan model AI...';
                setTimeout(checkModelStatus, 2000);
            }
        } catch (error) {
            modelStatus.textContent = 'Gagal terhubung ke server.';
        }
    };
    
    checkModelStatus();

    // Kirim pesan
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const question = chatInput.value.trim();
        if (!question) return;

        addMessage(`<div class="message-content"><p>${question}</p></div>`, 'user');
        chatInput.value = '';

        const typingIndicator = addMessage(
            `<div class="message-content typing-indicator"><span></span><span></span><span></span></div>`,
            'bot'
        );

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question }),
            });
            const data = await response.json();
            
            typingIndicator.remove();

            if (!response.ok) {
                throw new Error(data.error || 'Terjadi kesalahan.');
            }

            // PERBAIKAN: Hapus karakter '**' dari jawaban
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
                    </div>
                `;
            }
            
            // Gunakan `cleanedAnswer` untuk menampilkan jawaban
            addMessage(
                `<div class="message-content">
                    <p>${cleanedAnswer.replace(/\n/g, '<br>')}</p>
                    ${showSourceButtonHtml}
                    ${sourcesHtml}
                </div>`, 
                'bot'
            );

        } catch (error) {
            typingIndicator.remove();
            addMessage(`<div class="message-content"><p>Maaf, terjadi error: ${error.message}</p></div>`, 'bot');
        }
    });

    // Event delegation untuk tombol "Lihat Sumber" dan "Tutup Sumber"
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
});
