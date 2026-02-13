(function () {
  const mainImage = document.getElementById('assetGalleryMainImage');
  const mainButton = document.getElementById('assetGalleryMainButton');
  const galleryModal = document.getElementById('assetGalleryModal');
  const carouselElement = document.getElementById('assetGalleryCarousel');
  const thumbs = Array.from(document.querySelectorAll('.asset-gallery-thumb'));

  if (!mainImage || !mainButton || thumbs.length === 0) {
    return;
  }

  let activeIndex = 0;

  function activateThumb(activeThumb) {
    thumbs.forEach(function (thumb) {
      thumb.classList.remove('border-primary');
      thumb.classList.add('border-light');
    });
    activeThumb.classList.remove('border-light');
    activeThumb.classList.add('border-primary');
  }

  function setMainFromThumb(thumb) {
    const imageUrl = thumb.getAttribute('data-image-url');
    const imageAlt = thumb.getAttribute('data-image-alt') || 'Asset Bild';
    const indexValue = parseInt(thumb.getAttribute('data-image-index') || '0', 10);
    if (!imageUrl) {
      return;
    }
    mainImage.src = imageUrl;
    mainImage.alt = imageAlt;
    activeIndex = Number.isNaN(indexValue) ? 0 : indexValue;
    activateThumb(thumb);
  }

  thumbs.forEach(function (thumb) {
    thumb.addEventListener('mouseenter', function () {
      setMainFromThumb(thumb);
    });
    thumb.addEventListener('focus', function () {
      setMainFromThumb(thumb);
    });
    thumb.addEventListener('click', function () {
      setMainFromThumb(thumb);
    });
  });

  if (galleryModal && carouselElement && typeof bootstrap !== 'undefined' && bootstrap.Carousel) {
    const carousel = bootstrap.Carousel.getOrCreateInstance(carouselElement, { interval: false, ride: false });
    mainButton.addEventListener('click', function () {
      carousel.to(activeIndex);
    });
  }
})();
