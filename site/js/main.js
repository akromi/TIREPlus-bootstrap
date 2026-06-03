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
    '/search/': '/fr/recherche/',
    '/appointments/': '/fr/rendez-vous/',
    '/faq/': '/fr/faq/',
    '/contact-us/': '/fr/contactez-nous/',
    '/services/ac-service/': '/fr/services/service-ac/',
    '/services/battery/': '/fr/services/batterie/',
    '/services/brakes/': '/fr/services/freins/',
    '/services/driveon-inspection/': '/fr/services/inspection-driveon/',
    '/services/exhaust-repairs/': '/fr/services/reparations-echappement/',
    '/services/fluid-flush/': '/fr/services/rincage-fluides/',
    '/services/general-repairs/': '/fr/services/reparations-generales/',
    '/services/oil-change/': '/fr/services/changement-huile/',
    '/services/radiator-coolant/': '/fr/services/radiateur-refroidissement/',
    '/services/road-force-balancing/': '/fr/services/equilibrage-road-force/',
    '/services/suspension/': '/fr/services/suspension/',
    '/services/tires/': '/fr/services/pneus/',
    '/services/wheel-alignment/': '/fr/services/alignement-roues/',
    '/fr/': '/',
    '/fr/a-propos/': '/about/',
    '/fr/recherche/': '/search/',
    '/fr/rendez-vous/': '/appointments/',
    '/fr/faq/': '/faq/',
    '/fr/contactez-nous/': '/contact-us/',
    '/fr/services/service-ac/': '/services/ac-service/',
    '/fr/services/batterie/': '/services/battery/',
    '/fr/services/freins/': '/services/brakes/',
    '/fr/services/inspection-driveon/': '/services/driveon-inspection/',
    '/fr/services/reparations-echappement/': '/services/exhaust-repairs/',
    '/fr/services/rincage-fluides/': '/services/fluid-flush/',
    '/fr/services/reparations-generales/': '/services/general-repairs/',
    '/fr/services/changement-huile/': '/services/oil-change/',
    '/fr/services/radiateur-refroidissement/': '/services/radiator-coolant/',
    '/fr/services/equilibrage-road-force/': '/services/road-force-balancing/',
    '/fr/services/suspension/': '/services/suspension/',
    '/fr/services/pneus/': '/services/tires/',
    '/fr/services/alignement-roues/': '/services/wheel-alignment/'
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