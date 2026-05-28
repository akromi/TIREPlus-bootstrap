document.addEventListener('DOMContentLoaded', function () {
  /* Dynamic copyright year */
  var yearEl = document.getElementById('copyright-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* Active nav link highlighting */
  var currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('.navbar-tp .nav-link').forEach(function (link) {
    var href = link.getAttribute('href');
    if (!href) return;
    var linkPath = href.replace(/\/+$/, '') || '/';
    if (linkPath === currentPath) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });

  /* Close offcanvas on nav click (mobile) */
  var offcanvasEl = document.getElementById('mainNav');
  if (offcanvasEl) {
    var bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl, { backdrop: true });
    offcanvasEl.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth < 992) bsOffcanvas.hide();
      });
    });
  }

  /* Language toggle — stay on equivalent page */
  var langMap = {
    '/': '/fr/',
    '/about/': '/fr/a-propos/',
    '/tire-search/': '/fr/recherche-pneus/',
    '/wheel-search/': '/fr/recherche-roues/',
    '/appointments/': '/fr/rendez-vous/',
    '/contact-us/': '/fr/contactez-nous/',
    '/fr/': '/',
    '/fr/a-propos/': '/about/',
    '/fr/recherche-pneus/': '/tire-search/',
    '/fr/recherche-roues/': '/wheel-search/',
    '/fr/rendez-vous/': '/appointments/',
    '/fr/contactez-nous/': '/contact-us/'
  };
  var langToggle = document.querySelector('a[title="Français"], a[title="English"]');
  if (langToggle) {
    var path = window.location.pathname.replace(/\/*$/, '/') || '/';
    if (langMap[path]) langToggle.setAttribute('href', langMap[path]);
  }

  /* Lazy-load iframes when visible */
  if ('IntersectionObserver' in window) {
    var lazyFrames = document.querySelectorAll('iframe[data-src]');
    var frameObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.src = entry.target.dataset.src;
          entry.target.removeAttribute('data-src');
          frameObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '200px' });
    lazyFrames.forEach(function (f) { frameObserver.observe(f); });
  }

  /* Conversion event tracking (no-op if gtag not loaded, e.g. on staging) */
  function trackEvent(name, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params || {});
    }
  }
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) {
      trackEvent('phone_call', { phone_number: href.replace('tel:', '') });
    } else if (link.classList.contains('btn-cta')) {
      trackEvent('cta_click', {
        cta_label: (link.textContent || '').trim().slice(0, 50),
        cta_destination: href
      });
    }
  });
});