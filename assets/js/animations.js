console.log('Animations JS loaded');

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initial Page Load Animations
  const animateOnLoadSelectors = [
    'header',
    '.featured-banner',
    '.profile',
    'h1:first-of-type'
  ];

  animateOnLoadSelectors.forEach((selector, index) => {
    const elements = document.querySelectorAll(selector);
    console.log(`Selector ${selector} found ${elements.length} elements`);
    elements.forEach(el => {
      el.classList.add('animate-on-load');
      el.style.animationDelay = `${index * 0.1}s`;
    });
  });

  // 2. Scroll Reveal Animations
  const scrollRevealSelectors = [
    'main > section', // Paper theme homepage posts are sections
    'main > article',
    '.post-entry',
    '.entry',
    '.project-card',
    '.related-post-card',
    '.archive-year',
    '.search-result',
    '.prose h2',
    '.prose h3',
    '.prose img',
    '.prose pre',
    '.prose blockquote'
  ];

  // Helper to add scroll-reveal class
  const elementsToReveal = document.querySelectorAll(scrollRevealSelectors.join(','));

  elementsToReveal.forEach((el, index) => {
    el.classList.add('scroll-reveal');
  });

  // 3. Intersection Observer for Scroll Reveal
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1 // Trigger when 10% visible
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // Only animate once
      }
    });
  }, observerOptions);

  document.querySelectorAll('.scroll-reveal').forEach(el => {
    observer.observe(el);
  });

  // 4. Micro-interactions

  // Add 'clicked' class to buttons for click effect
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousedown', function () {
      this.style.transform = 'scale(0.95)';
    });
    btn.addEventListener('mouseup', function () {
      this.style.transform = 'scale(1)';
    });
    btn.addEventListener('mouseleave', function () {
      this.style.transform = 'scale(1)';
    });
  });

  // 5. 3D Card Tilt Effect
  const tiltCards = document.querySelectorAll('.featured-card, .project-card');

  tiltCards.forEach(card => {
    card.classList.add('tilt-card');

    let isMouseInside = false;
    let frameId = null;

    card.addEventListener('mouseenter', () => {
      isMouseInside = true;
    });

    card.addEventListener('mousemove', (e) => {
      if (!isMouseInside) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Limit rotation degrees strictly
      const maxRotation = 15;
      const rotateX = Math.max(-maxRotation, Math.min(maxRotation, (y - centerY) / 8));
      const rotateY = Math.max(-maxRotation, Math.min(maxRotation, (centerX - x) / 8));

      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
        card.style.transition = 'none'; // Prevent transition fighting with JS
      });
    });

    card.addEventListener('mouseleave', () => {
      isMouseInside = false;
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }

      requestAnimationFrame(() => {
        card.style.transition = 'transform 0.5s ease-out';
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
      });
    });
  });

  // 6. Number Counter Animation
  const countUpElements = document.querySelectorAll('#total-posts, #posts-this-year, #active-days, .stat-value');

  const countUpObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const finalValue = parseInt(el.textContent, 10);

        if (!isNaN(finalValue) && finalValue > 0) {
          el.classList.add('count-up');
          animateCount(el, 0, finalValue, 1000);
        }

        countUpObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  function animateCount(el, start, end, duration) {
    const startTime = performance.now();

    function updateCount(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(start + (end - start) * easeOutQuart);

      el.textContent = currentValue;

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        el.textContent = end;
        el.classList.add('is-visible');
      }
    }

    requestAnimationFrame(updateCount);
  }

  countUpElements.forEach(el => countUpObserver.observe(el));

  // 7. Enhanced link interactions - add ripple class
  document.querySelectorAll('.prose a:not(.anchor)').forEach(link => {
    link.classList.add('ripple-link');
  });

  console.log('Advanced animations initialized');
});
