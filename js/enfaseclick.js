function highlightText(anoClass) {
    const elements = document.querySelectorAll('.' + anoClass);
    elements.forEach(element => {
        element.classList.add('enfaseclick');
    });

    setTimeout(() => {
        elements.forEach(element => {
            element.classList.remove('enfaseclick');
        });
    }, 10000);
}