(function () {
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const paletteBtn = document.getElementById('paletteToggle');
  const saved = localStorage.getItem('hb-theme');
  const savedPalette = localStorage.getItem('hb-palette');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (prefersDark ? 'dark' : 'light');
  const initialPalette = savedPalette === 'mint' ? 'mint' : 'sweet';

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem('hb-theme', theme);
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function setPalette(palette) {
    root.setAttribute('data-palette', palette);
    localStorage.setItem('hb-palette', palette);
    if (paletteBtn) paletteBtn.textContent = palette === 'mint' ? '薄荷' : '甜粉';
  }

  setTheme(initial);
  setPalette(initialPalette);

  if (btn) {
    btn.addEventListener('click', function () {
      const now = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(now);
    });
  }

  if (paletteBtn) {
    paletteBtn.addEventListener('click', function () {
      const now = root.getAttribute('data-palette') === 'mint' ? 'sweet' : 'mint';
      setPalette(now);
    });
  }

  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('in');
        });
      },
      { threshold: 0.2 }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  const scroller = document.getElementById('characterScroll');
  if (scroller) {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    scroller.addEventListener('mousedown', (e) => {
      isDown = true;
      scroller.style.cursor = 'grabbing';
      startX = e.pageX - scroller.offsetLeft;
      scrollLeft = scroller.scrollLeft;
    });
    scroller.addEventListener('mouseleave', () => {
      isDown = false;
      scroller.style.cursor = 'grab';
    });
    scroller.addEventListener('mouseup', () => {
      isDown = false;
      scroller.style.cursor = 'grab';
    });
    scroller.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scroller.offsetLeft;
      const walk = (x - startX) * 1.2;
      scroller.scrollLeft = scrollLeft - walk;
    });
  }

  const hero = document.getElementById('heroSection');
  if (hero) {
    const layers = Array.from(hero.querySelectorAll('.parallax-layer'));
    const runParallax = (x, y) => {
      layers.forEach((layer) => {
        const depth = Number(layer.getAttribute('data-depth') || 0);
        layer.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0)`;
      });
    };
    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      runParallax(x * 0.15, y * 0.12);
    });
    hero.addEventListener('mouseleave', () => runParallax(0, 0));
  }

  const carousel = document.getElementById('shotCarousel');
  const dotsWrap = document.getElementById('carouselDots');
  const modal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  const modalCaption = document.getElementById('modalCaption');
  const closeBtn = document.querySelector('.img-modal-close');

  if (carousel) {
    const track = carousel.querySelector('.carousel-track');
    const slides = Array.from(carousel.querySelectorAll('.shot'));
    const prev = carousel.querySelector('.carousel-btn.prev');
    const next = carousel.querySelector('.carousel-btn.next');
    const dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll('.dot')) : [];
    let index = 0;
    let timer = null;

    const sync = () => {
      if (!track) return;
      track.style.transform = `translateX(-${index * 100}%)`;
      slides.forEach((s, i) => s.classList.toggle('active', i === index));
      dots.forEach((d, i) => d.classList.toggle('active', i === index));
    };

    const go = (nextIndex) => {
      index = (nextIndex + slides.length) % slides.length;
      sync();
    };

    const startAuto = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => go(index + 1), 4200);
    };

    const stopAuto = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    if (prev) prev.addEventListener('click', () => go(index - 1));
    if (next) next.addEventListener('click', () => go(index + 1));
    dots.forEach((d) => d.addEventListener('click', () => go(Number(d.dataset.index || 0))));
    carousel.addEventListener('mouseenter', stopAuto);
    carousel.addEventListener('mouseleave', startAuto);
    carousel.addEventListener('touchstart', stopAuto, { passive: true });
    carousel.addEventListener('touchend', startAuto, { passive: true });

    slides.forEach((slide) => {
      const img = slide.querySelector('img');
      const cap = slide.querySelector('figcaption');
      if (!img) return;
      img.addEventListener('click', () => {
        if (!modal || !modalImage || !modalCaption) return;
        modalImage.src = img.src;
        modalImage.alt = img.alt || '预览图';
        modalCaption.textContent = cap ? cap.textContent || '' : '';
        if (typeof modal.showModal === 'function') modal.showModal();
      });
    });

    sync();
    startAuto();
  }

  const lazyImgs = Array.from(document.querySelectorAll('img[data-src]'));
  if ('IntersectionObserver' in window && lazyImgs.length > 0) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        const real = img.getAttribute('data-src');
        if (real) {
          img.src = real;
          img.removeAttribute('data-src');
        }
        io.unobserve(img);
      });
    }, { rootMargin: '180px' });
    lazyImgs.forEach((img) => {
      img.addEventListener('load', () => {
        const shot = img.closest('.shot');
        if (shot) shot.classList.remove('loading');
      }, { once: true });
      io.observe(img);
    });
  } else {
    lazyImgs.forEach((img) => {
      const real = img.getAttribute('data-src');
      if (real) img.src = real;
      const shot = img.closest('.shot');
      if (shot) shot.classList.remove('loading');
    });
  }

  if (modal && closeBtn) {
    closeBtn.addEventListener('click', () => modal.close());
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      const inDialog =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inDialog) modal.close();
    });
  }
})();

