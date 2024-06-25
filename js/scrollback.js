// Salva a posição do scroll antes de sair da página
window.addEventListener('beforeunload', function () {
    sessionStorage.setItem('scrollPosition', window.scrollY);
});

// Restaura a posição do scroll quando a página é carregada
window.addEventListener('load', function () {
    if (sessionStorage.getItem('scrollPosition') !== null) {
        window.scrollTo(0, sessionStorage.getItem('scrollPosition'));
        sessionStorage.removeItem('scrollPosition');
    }
});
