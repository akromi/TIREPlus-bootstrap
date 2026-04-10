(function () {
  const cfg = window.TC_CONFIG || {};
  const page = window.TC_PAGE || { type: "tires" };

  const loadingEl = document.getElementById("tc-loading");
  const errorEl = document.getElementById("tc-error");

  function hideLoading() {
    if (loadingEl) loadingEl.classList.add("d-none");
  }

  function showError() {
    if (errorEl) errorEl.classList.remove("d-none");
  }

  if (!window.TCWidget) {
    hideLoading();
    showError();
    return;
  }

  const baseParams = {
    apikey: cfg.apiKey,
    container: "tireconnect"
  };

  // Optional params (only add if set)
  if (cfg.locale) baseParams.locale = cfg.locale;
  if (cfg.locationId) baseParams.locationId = cfg.locationId;
  if (cfg.locationId && typeof cfg.locationLock === "boolean") baseParams.locationLock = cfg.locationLock;

  let initPromise;

  try {
    if (page.type === "wheels") {
      initPromise = window.TCWidget.initWheels(baseParams);
    } else {
      initPromise = window.TCWidget.init(baseParams);
    }
  } catch (e) {
    console.error("TireConnect init threw:", e);
    hideLoading();
    showError();
    return;
  }

  Promise.resolve(initPromise)
    .then(() => hideLoading())
    .catch((e) => {
      console.error("TireConnect init failed:", e);
      hideLoading();
      showError();
    });
})();
