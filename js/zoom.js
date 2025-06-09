document.addEventListener('DOMContentLoaded', () => {
    // Abrir modal
    document.querySelectorAll('.sidebar img').forEach(img => {
        img.addEventListener('click', () => {
            const modal = document.getElementById('imageModal');
            const modalImg = document.getElementById('modalImage');
            modal.style.display = 'flex';
            modalImg.src = img.src;
        });
    });

    // Fechar modal
    const closeModal = document.querySelector('.close-modal');
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            document.getElementById('imageModal').style.display = 'none';
        });
    }

    // Fechar ao clicar fora da imagem
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
});