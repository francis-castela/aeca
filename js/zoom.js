document.addEventListener('DOMContentLoaded', function () {
    const images = [
        { zoom: 'zoomImage1', overlay: 'overlay1', large: 'largeImage1' },
        { zoom: 'zoomImage2', overlay: 'overlay2', large: 'largeImage2' },
        { zoom: 'zoomImage3', overlay: 'overlay3', large: 'largeImage3' },
        { zoom: 'zoomImage4', overlay: 'overlay4', large: 'largeImage4' },
        { zoom: 'zoomImage5', overlay: 'overlay5', large: 'largeImage5' },
        { zoom: 'zoomImage6', overlay: 'overlay6', large: 'largeImage6' },
        { zoom: 'zoomImage7', overlay: 'overlay7', large: 'largeImage7' },
        { zoom: 'zoomImage8', overlay: 'overlay8', large: 'largeImage8' },
        { zoom: 'zoomImage9', overlay: 'overlay9', large: 'largeImage9' }
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