document.addEventListener('DOMContentLoaded', () => {
    // Elementos do modal
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const closeModal = document.querySelector('.close-modal');

    // Verifica se os elementos existem
    if (modal && modalImg && closeModal) {
        // Abrir modal ao clicar nas imagens da sidebar
        document.querySelectorAll('.sidebar img').forEach(img => {
            img.addEventListener('click', () => {
                modal.style.display = 'flex';
                modalImg.src = img.src;
            });
        });

        // Fechar modal com o botão "X"
        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Fechar modal ao clicar fora da imagem
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    } else {
        console.error('Elementos do modal não encontrados. Verifique o HTML!');
    }
});