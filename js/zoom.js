document.addEventListener('DOMContentLoaded', function () {
    const images = [
        { zoom: 'zoomImage1', overlay: 'overlay1', large: 'largeImage1' },
        { zoom: 'zoomImage2', overlay: 'overlay2', large: 'largeImage2' },
        { zoom: 'zoomImage3', overlay: 'overlay3', large: 'largeImage3' }
    ];

    images.forEach(({ zoom, overlay, large }) => {
        const zoomImage = document.getElementById(zoom);
        const overlayElement = document.getElementById(overlay);
        const largeImage = document.getElementById(large);

        zoomImage.addEventListener('click', function () {
            overlayElement.style.display = 'flex';
        });

        overlayElement.addEventListener('click', function () {
            overlayElement.style.display = 'none';
        });

        largeImage.addEventListener('click', function (event) {
            event.stopPropagation();
        });
    });
});