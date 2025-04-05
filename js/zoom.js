document.addEventListener('DOMContentLoaded', () => {
    // Elementos do modal
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const closeModal = document.querySelector('.close-modal');

    // Verifica se os elementos existem antes de adicionar eventos
    if (modal && modalImg && closeModal) {
        // Evento para abrir o modal
        document.querySelectorAll('.sidebar img').forEach(img => {
            img.addEventListener('click', () => {
                modal.style.display = 'flex';
                modalImg.src = img.src;
            });
        });

        // Evento para fechar com o botão
        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Evento para fechar clicando fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    } else {
        console.error('Elementos do modal não encontrados!');
    }
});