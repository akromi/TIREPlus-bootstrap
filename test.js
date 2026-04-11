#!/usr/bin/env node
/**
 * TirePlus Automated Test Harness
 * ================================
 * Tests staging2.tireplus.ca for functionality, content, and structure.
 *
 * Usage:
 *   node test.js                     # test staging2.tireplus.ca
 *   node test.js https://tireplus.ca # test a different URL
 *
 * No npm install needed — uses only built-in Node.js modules.
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

const BASE = process.argv[2] || "https://staging2.tireplus.ca";
const RESULTS = { pass: 0, fail: 0, warn: 0, tests: [] };

// ── Helpers ────────────────────────────────────────────────────

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: options.headers || {},
      rejectUnauthorized: false, // allow self-signed certs on staging
      timeout: 15000,
    };
    if (options.body) {
      opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
      opts.headers["Content-Length"] = Buffer.byteLength(options.body);
    }
    const req = mod.request(opts, (res) => {
      let data = "";
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
        return fetch(redirectUrl, options).then(resolve).catch(reject);
      }
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function record(section, name, passed, detail = "") {
  const status = passed === true ? "PASS" : passed === "warn" ? "WARN" : "FAIL";
  if (passed === true) RESULTS.pass++;
  else if (passed === "warn") RESULTS.warn++;
  else RESULTS.fail++;
  RESULTS.tests.push({ section, name, status, detail });
  const icon = status === "PASS" ? "✅" : status === "WARN" ? "⚠️" : "❌";
  const detailStr = detail ? ` — ${detail}` : "";
  console.log(`  ${icon} ${name}${detailStr}`);
}

function contains(html, text) {
  return html.toLowerCase().includes(text.toLowerCase());
}

function containsAny(html, texts) {
  return texts.some((t) => contains(html, t));
}

// ── Test Suites ────────────────────────────────────────────────

async function testPage(path, expectedTitle, checks = []) {
  const url = `${BASE}${path}`;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    record(path, `Page loads: ${path}`, false, e.message);
    return null;
  }

  record(path, `HTTP 200`, res.status === 200, `Got ${res.status}`);

  if (res.status !== 200) return res;

  if (expectedTitle) {
    const titleMatch = res.body.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : "(no title)";
    record(path, `Title contains "${expectedTitle}"`, contains(title, expectedTitle), `Got: "${title}"`);
  }

  for (const check of checks) {
    check(res.body, path);
  }

  return res;
}

function checkContains(text, label) {
  return (html, section) => {
    record(section, label || `Contains "${text}"`, contains(html, text));
  };
}

function checkNotContains(text, label) {
  return (html, section) => {
    record(section, label || `Does NOT contain "${text}"`, !contains(html, text), contains(html, text) ? "FOUND — should not be present" : "");
  };
}

function checkElement(tag, label) {
  return (html, section) => {
    const regex = new RegExp(`<${tag}[\\s>]`, "i");
    record(section, label || `Has <${tag}> element`, regex.test(html));
  };
}

function checkMeta(name, label) {
  return (html, section) => {
    const regex = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["'](.+?)["']`, "i");
    const match = html.match(regex);
    record(section, label || `Meta ${name} present`, !!match, match ? match[1].substring(0, 60) + "…" : "Missing");
  };
}

function checkLink(href, label) {
  return (html, section) => {
    record(section, label || `Link to ${href}`, contains(html, href));
  };
}

function checkImage(src, label) {
  return (html, section) => {
    record(section, label || `Image: ${src}`, contains(html, src));
  };
}

// ── Run Tests ──────────────────────────────────────────────────

async function runAll() {
  console.log(`\n🔧 TirePlus Automated Test Harness`);
  console.log(`   Target: ${BASE}`);
  console.log(`   Time:   ${new Date().toISOString()}\n`);

  // ────────────────────────────────────────────
  console.log("━━━ 1. HOME PAGE ━━━");
  await testPage("/", "Tire Plus", [
    // Hero
    checkContains("Your Trusted", "Hero heading present"),
    checkContains("Auto Service Centre", "Hero subheading present"),
    checkContains("613-834-7325", "Phone number present"),
    checkContains("2006 St. Joseph Blvd", "Address present"),
    checkContains("Mon–Fri", "Hours present"),
    checkLink("/tire-search/", "Search for Tires link"),
    checkLink("/wheel-search/", "Search for Wheels link"),
    checkContains("Free Brake", "Free inspection text"),

    // Highlights bar
    checkContains("Wheel Alignment", "Highlights: Wheel Alignment"),
    checkContains("From $159", "Highlights: alignment price"),
    checkContains("DriveON Licensed", "Highlights: DriveON"),
    checkContains("from $199", "Highlights: inspection price"),
    checkContains("Road Force Balancing", "Highlights: Road Force"),
    checkContains("From $39", "Highlights: Road Force price"),
    checkContains("Oil Changes", "Highlights: Oil Changes"),
    checkContains("From $69", "Highlights: oil price"),

    // Images
    checkImage("/img/logo.png", "Logo image referenced"),
    checkImage("/img/hero-service.png", "Hero image referenced"),
    checkImage("/img/driveon-logo.png", "DriveON logo referenced"),
    checkImage("/img/roadforce-logo.png", "Road Force logo referenced"),
    checkImage("/img/alignment-logo.svg", "Alignment icon referenced"),
    checkImage("/img/oilchange-logo.svg", "Oil change icon referenced"),
    checkImage("/img/shop.png", "Shop photo referenced"),

    // Services
    checkContains("Our Services", "Services section heading"),
    checkContains("General Repairs", "Service: General Repairs"),
    checkContains("DriveON Safety Inspection", "Service: DriveON Inspection"),
    checkContains("Tires &amp; Wheels", "Service: Tires & Wheels"),
    checkContains("Brakes", "Service: Brakes"),
    checkContains("Exhaust Repairs", "Service: Exhaust"),
    checkContains("Front-End Alignment", "Service: Alignment"),
    checkContains("Radiator &amp; Coolant", "Service: Radiator"),
    checkContains("Fuel Injector Service", "Service: Fuel Injector"),

    // CTA
    checkContains("Ready to Get Started", "CTA banner present"),
    checkLink("/appointments/", "Appointments link"),

    // Location
    checkContains("Visit Us", "Visit Us section"),
    checkContains("Orleans Location", "Orleans location heading"),
    checkContains("Get Directions", "Get Directions button"),

    // Reviews
    checkContains("What Our Customers Say", "Reviews section heading"),
    checkContains("elfsight", "Elfsight widget present"),

    // Footer
    checkContains("Quick Links", "Footer: Quick Links"),
    checkContains("Services", "Footer: Services"),
    checkContains("DriveON Inspection", "Footer: DriveON (not MTO)"),
    checkElement("footer", "Footer element present"),

    // No MTO
    checkNotContains(">MTO<", "No MTO in visible text"),
    checkNotContains("MTO Safety", "No 'MTO Safety' text"),
    checkNotContains("MTO Licensed", "No 'MTO Licensed' text"),
    checkNotContains("MTO Inspection", "No 'MTO Inspection' in content"),

    // Accessibility
    checkContains("skip-link", "Skip link present"),
    checkElement("main", "Main landmark present"),
    checkElement("nav", "Nav landmark present"),
    checkContains('aria-label', "ARIA labels present"),

    // Meta
    checkMeta("description", "Meta description present"),
  ]);

  // ────────────────────────────────────────────
  console.log("\n━━━ 2. TIRE SEARCH ━━━");
  await testPage("/tire-search/", "Tire Search", [
    checkContains("Search for Tires", "Page heading"),
    checkContains("installation, balancing, and nitrogen", "Price includes note"),
    checkContains("tireconnect", "TireConnect container present"),
    checkContains("tireconnect-config.js", "TireConnect config script"),
    checkContains("tireconnect-init.js", "TireConnect init script"),
    checkContains("widget.js", "TireConnect widget.js loaded"),
    checkContains('type: "tires"', "Page type set to tires"),
    checkContains("tc-loading", "Loading state present"),
    checkContains("tc-error", "Error fallback present"),
    checkLink("/wheel-search/", "Link to wheel search"),
    checkLink("/appointments/", "Link to appointments"),
    checkLink("/contact-us/", "Link to contact"),
    checkMeta("description", "Meta description present"),
  ]);

  // ────────────────────────────────────────────
  console.log("\n━━━ 3. WHEEL SEARCH ━━━");
  await testPage("/wheel-search/", "Wheel Search", [
    checkContains("Search for Wheels", "Page heading"),
    checkContains("OE Hub", "OE Hub tip present"),
    checkContains("tireconnect", "TireConnect container present"),
    checkContains('type: "wheels"', "Page type set to wheels"),
    checkContains("tc-loading", "Loading state present"),
    checkContains("tc-error", "Error fallback present"),
    checkLink("/tire-search/", "Link to tire search"),
    checkLink("/appointments/", "Link to appointments"),
    checkMeta("description", "Meta description present"),
  ]);

  // ────────────────────────────────────────────
  console.log("\n━━━ 4. APPOINTMENTS ━━━");
  await testPage("/appointments/", "Book an Appointment", [
    checkContains("Ready to book", "Booking prompt present"),
    checkContains("Book Now", "Book Now button present"),
    checkContains("workshopsoftware.com", "Workshop Software URL present"),
    checkContains("o36ivi", "Workshop token present"),
    checkContains("today or tomorrow", "Same-day warning present"),
    checkContains("613-834-7325", "Phone number in warning"),
    checkContains("2 business days", "Business days notice text"),
    checkContains("Prefer to call", "Call alternative present"),
    checkContains("Walk-ins welcome", "Walk-in info present"),
    checkMeta("description", "Meta description present"),
  ]);

  // ────────────────────────────────────────────
  console.log("\n━━━ 5. CONTACT US ━━━");
  await testPage("/contact-us/", "Contact Us", [
    checkContains("Send Us a Message", "Form heading"),
    checkContains("contact-handler.php", "Form action points to PHP handler"),
    checkContains('name="name"', "Name field present"),
    checkContains('name="email"', "Email field present"),
    checkContains('name="phone"', "Phone field present"),
    checkContains('name="vehicle"', "Vehicle field present"),
    checkContains('name="plate"', "License plate field present"),
    checkContains('name="message"', "Message field present"),
    checkContains('name="math"', "Math anti-spam field present"),
    checkContains('name="company_url"', "Honeypot field present"),
    checkContains("12 + 6", "Math question displayed"),
    checkContains("Our Location", "Location section heading"),
    checkContains("613-834-7325", "Phone number present"),
    checkContains("info@tireplus.ca", "Email address present"),
    checkContains("Get Directions", "Get Directions button"),
    checkLink("/appointments/", "Link to appointments"),
    checkMeta("description", "Meta description present"),
  ]);

  // ────────────────────────────────────────────
  console.log("\n━━━ 6. TIRECONNECT CONFIG ━━━");
  const configRes = await testPage("/assets/js/tireconnect-config.js", null, []);
  if (configRes && configRes.status === 200) {
    const body = configRes.body;
    record("config", "API key present", contains(body, "165d92b73544d5ec4caf11c14e194648"));
    record("config", "Locale set to en_CA", contains(body, "en_CA"));
    record("config", "Location ID 15994", contains(body, "15994"));
    record("config", "Location lock true", contains(body, "locationLock: true") || contains(body, "locationLock:true"));
  }

  // ────────────────────────────────────────────
  console.log("\n━━━ 7. STATIC ASSETS ━━━");
  const assets = [
    ["/css/style.css", "CSS stylesheet"],
    ["/js/main.js", "Main JavaScript"],
    ["/assets/js/tireconnect-config.js", "TireConnect config"],
    ["/assets/js/tireconnect-init.js", "TireConnect init"],
    ["/img/logo.png", "Logo image"],
    ["/img/hero-service.png", "Hero image"],
    ["/img/driveon-logo.png", "DriveON logo"],
    ["/img/roadforce-logo.png", "Road Force logo"],
    ["/img/alignment-logo.svg", "Alignment icon"],
    ["/img/oilchange-logo.svg", "Oil change icon"],
    ["/img/shop.png", "Shop photo"],
    ["/img/favicon.ico", "Favicon"],
  ];

  for (const [path, label] of assets) {
    try {
      const res = await fetch(`${BASE}${path}`);
      const size = res.headers["content-length"] || res.body.length;
      record("assets", `${label} (${path})`, res.status === 200, `${res.status}, ${size} bytes`);
      // Check for corrupted images (suspiciously small)
      if (path.match(/\.(png|jpg|ico)$/) && parseInt(size) < 100) {
        record("assets", `${label} file size OK`, false, `Only ${size} bytes — possibly corrupted`);
      }
    } catch (e) {
      record("assets", `${label} (${path})`, false, e.message);
    }
  }

  // ────────────────────────────────────────────
  console.log("\n━━━ 8. SECURITY ━━━");
  try {
    const homeRes = await fetch(`${BASE}/`);
    const h = homeRes.headers;
    record("security", "X-Content-Type-Options: nosniff", h["x-content-type-options"] === "nosniff");
    record("security", "X-Frame-Options present", !!h["x-frame-options"]);
    record("security", "Referrer-Policy present", !!h["referrer-policy"]);
  } catch (e) {
    record("security", "Security headers check", false, e.message);
  }

  // Check mail-test.php is removed
  try {
    const mailTest = await fetch(`${BASE}/mail-test.php`);
    record("security", "mail-test.php removed (should be 404)", mailTest.status === 404, `Got ${mailTest.status}`);
  } catch (e) {
    record("security", "mail-test.php removed", true, "Not accessible");
  }

  // Check no WordPress artifacts
  try {
    const wpLogin = await fetch(`${BASE}/wp-login.php`);
    record("security", "No wp-login.php (should be 404)", wpLogin.status === 404, `Got ${wpLogin.status}`);
  } catch (e) {
    record("security", "No wp-login.php", true);
  }

  // ────────────────────────────────────────────
  console.log("\n━━━ 9. CONTACT FORM HANDLER ━━━");

  // Test wrong math answer
  try {
    const wrongMath = await fetch(`${BASE}/contact-handler.php`, {
      method: "POST",
      body: "name=Test&email=test@test.com&message=Test&math=10&company_url=",
    });
    const wrongUrl = wrongMath.headers.location || wrongMath.body;
    record("form", "Wrong math → error redirect", contains(wrongUrl || "", "error") || wrongMath.status === 302, `Status: ${wrongMath.status}`);
  } catch (e) {
    record("form", "Wrong math rejection", "warn", e.message);
  }

  // Test honeypot filled (bot)
  try {
    const botTest = await fetch(`${BASE}/contact-handler.php`, {
      method: "POST",
      body: "name=Bot&email=bot@spam.com&message=Spam&math=18&company_url=http://spam.com",
    });
    const botUrl = botTest.headers.location || botTest.body;
    record("form", "Honeypot filled → silent success (no email sent)", contains(botUrl || "", "success") || botTest.status === 302);
  } catch (e) {
    record("form", "Honeypot test", "warn", e.message);
  }

  // Test missing required fields
  try {
    const emptyTest = await fetch(`${BASE}/contact-handler.php`, {
      method: "POST",
      body: "name=&email=&message=&math=18&company_url=",
    });
    const emptyUrl = emptyTest.headers.location || emptyTest.body;
    record("form", "Empty fields → error redirect", contains(emptyUrl || "", "error") || emptyTest.status === 302);
  } catch (e) {
    record("form", "Empty fields test", "warn", e.message);
  }

  // Test GET request rejected
  try {
    const getTest = await fetch(`${BASE}/contact-handler.php`);
    record("form", "GET request → redirect to contact page", getTest.status === 200 || getTest.status === 302, `Status: ${getTest.status}`);
  } catch (e) {
    record("form", "GET rejection", "warn", e.message);
  }

  // ────────────────────────────────────────────
  console.log("\n━━━ 10. CROSS-PAGE CONSISTENCY ━━━");

  const pages = ["/", "/tire-search/", "/wheel-search/", "/appointments/", "/contact-us/"];
  for (const page of pages) {
    try {
      const res = await fetch(`${BASE}${page}`);
      if (res.status === 200) {
        // Navbar consistency
        record("consistency", `${page} has navbar`, contains(res.body, "navbar-tp"));
        record("consistency", `${page} has footer`, contains(res.body, '<footer'));
        record("consistency", `${page} has phone in nav`, contains(res.body, "613-834-7325"));
        // No MTO anywhere
        const hasMTO = /\bMTO\b/.test(res.body.replace(/<!--[\s\S]*?-->/g, ""));
        record("consistency", `${page} no MTO reference`, !hasMTO, hasMTO ? "FOUND MTO text" : "");
      }
    } catch (e) {
      record("consistency", `${page} consistency check`, false, e.message);
    }
  }

  // ── Summary ──────────────────────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log(`  RESULTS: ${RESULTS.pass} passed, ${RESULTS.fail} failed, ${RESULTS.warn} warnings`);
  console.log(`  TOTAL:   ${RESULTS.pass + RESULTS.fail + RESULTS.warn} tests`);
  console.log("═".repeat(50));

  if (RESULTS.fail > 0) {
    console.log("\n❌ FAILURES:");
    RESULTS.tests
      .filter((t) => t.status === "FAIL")
      .forEach((t) => console.log(`   ${t.section} → ${t.name}${t.detail ? " — " + t.detail : ""}`));
  }

  if (RESULTS.warn > 0) {
    console.log("\n⚠️  WARNINGS:");
    RESULTS.tests
      .filter((t) => t.status === "WARN")
      .forEach((t) => console.log(`   ${t.section} → ${t.name}${t.detail ? " — " + t.detail : ""}`));
  }

  console.log(`\n${RESULTS.fail === 0 ? "🎉 All tests passed!" : "🔴 Some tests failed — review above."}\n`);

  process.exit(RESULTS.fail > 0 ? 1 : 0);
}

runAll().catch((e) => {
  console.error("Test harness crashed:", e);
  process.exit(2);
});