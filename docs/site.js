(function () {
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  const reducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) {
    document.querySelectorAll('[data-idle-frames]').forEach((image) => {
      const frames = image
        .getAttribute('data-idle-frames')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean);
      if (frames.length <= 1) return;

      let frameIndex = 0;
      setInterval(() => {
        frameIndex = (frameIndex + 1) % frames.length;
        image.classList.add('is-swapping');
        window.setTimeout(() => {
          image.src = frames[frameIndex];
          image.classList.remove('is-swapping');
        }, 240);
      }, 7000);
    });
  }
})();
