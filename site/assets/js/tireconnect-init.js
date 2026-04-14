(function () {
  var cfg = window.TC_CONFIG || {};
  var page = window.TC_PAGE || { type: "tires" };
  var loadingEl = document.getElementById("tc-loading");
  var errorEl = document.getElementById("tc-error");

  function hideLoading() { if (loadingEl) loadingEl.classList.add("d-none"); }
  function showError() { if (errorEl) errorEl.classList.remove("d-none"); }

  if (!window.TCWidget) { hideLoading(); showError(); return; }

  var params = { apikey: cfg.apiKey, container: "tireconnect" };
  if (cfg.locale) params.locale = cfg.locale;
  if (cfg.locationId) params.locationId = cfg.locationId;
  if (cfg.locationId && typeof cfg.locationLock === "boolean") params.locationLock = cfg.locationLock;

  var initPromise;
  try {
    initPromise = page.type === "wheels" ? window.TCWidget.initWheels(params) : window.TCWidget.init(params);
  } catch (e) {
    console.error("TireConnect init threw:", e);
    hideLoading(); showError(); return;
  }

  Promise.resolve(initPromise)
    .then(function() { hideLoading(); })
    .catch(function(e) { console.error("TireConnect init failed:", e); hideLoading(); showError(); });
})();
