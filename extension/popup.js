(function () {
  "use strict";
  var CONTACT_EMAIL = "faizia995@gmail.com";
  var CHECKUP_PRICE = "$299";
  var WEB_PAGE = "https://faiziahmad.github.io/DomainDoctor/";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var form = document.getElementById("form"), input = document.getElementById("domain");
  var go = document.getElementById("go"), err = document.getElementById("err"), out = document.getElementById("results");

  /* theme, remembered in this browser only */
  try { var t = localStorage.getItem("dd-theme"); if (t) root.setAttribute("data-theme", t); } catch (e) {}
  document.getElementById("mode").addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("dd-theme", next); } catch (e) {}
  });

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function cleanDomain(v) {
    v = (v || "").trim().toLowerCase();
    v = v.replace(/^[a-z]+:\/\//, "").replace(/^[^@\/]*@/, "").split(/[\/?#:]/)[0].replace(/\.$/, "");
    if (v.indexOf("www.") === 0) v = v.slice(4);
    return /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v) ? v : null;
  }

  /* mail.shop.co.uk -> shop.co.uk : email settings live on the main business domain */
  var TWO_PART = /^(co|com|net|org|gov|edu|ac|ltd|plc|me|gen|biz|info)\.[a-z]{2}$/;
  function mainDomain(host) {
    var parts = host.split(".");
    if (parts.length <= 2) return host;
    var last2 = parts.slice(-2).join(".");
    return TWO_PART.test(last2) ? parts.slice(-3).join(".") : last2;
  }

  var SHORT = { spf: "Sender list", dmarc: "Fake-email rule", https: "Secure padlock", dnssec: "Signed settings", caa: "Padlock issuers", mtasts: "Secure incoming mail" };
  var VAL = { good: "OK", warn: "WEAK", bad: "MISSING", tip: "OPTIONAL" };
  function valOf(c) { if (c.st === "tip" && c.pts >= c.weight) return "OK"; if (c.key === "https" && c.st === "warn") return "UNSURE"; return VAL[c.st]; }

  function render(domain, checks) {
    var score = Math.round(checks.reduce(function (a, c) { return a + c.pts; }, 0) / checks.reduce(function (a, c) { return a + c.weight; }, 0) * 100);
    var spf = checks[0], dmarc = checks[1];
    var fakeCls = dmarc.pts >= 25 && spf.st === "good" ? "no" : (dmarc.pts >= 25 || spf.st === "good" ? "maybe" : "yes");
    var stampTxt = { yes: "At risk", maybe: "Partly", no: "Protected" }[fakeCls];
    var verdict = { yes: "Someone could send fake emails as this business.", maybe: "Partly protected against fake emails.", no: "Fake emails in this name get stopped." }[fakeCls];
    var problems = checks.filter(function (c) { return c.st === "bad" || c.st === "warn"; }).length;

    var lines = checks.map(function (c) {
      var val = valOf(c), cls = val === "OK" ? "good" : c.st;
      return '<li><details><summary><span class="car">›</span><span class="lbl">' + SHORT[c.key] + '</span><span class="dots"></span><span class="val v-' + cls + '">' + val + '</span></summary>' +
        '<div class="more"><p><b>' + c.title + '.</b> ' + c.one + '</p>' + c.body +
        (c.fix ? '<div class="fix"><b>HOW TO FIX</b>' + c.fix + '</div>' : "") +
        (c.found && c.found.length ? '<div class="found">found: ' + c.found.map(esc).join("<br>") + '</div>' : "") + '</div></details></li>';
    }).join("");

    var subject = "Full check-up for " + domain;
    var body = "Hi Faizi,\n\nI checked " + domain + " with the DomainDoctor extension and got " + score + "/100 (" + problems + " thing" + (problems === 1 ? "" : "s") + " to fix).\nI'd like to know more about the full " + CHECKUP_PRICE + " check-up.\n\nThanks";
    var mail = "mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);

    out.innerHTML = '<div class="printer"><span class="led"></span></div><div class="feed"><article class="slip" id="slip">' +
      '<div class="s-head"><div class="brand">DOMAINDOCTOR CHECK-UP SLIP</div><div class="dom">' + esc(domain) + '</div></div>' +
      '<hr class="rule"><div class="score"><b id="num">0</b><span>/ 100</span></div><div class="verdict">' + verdict + '</div>' +
      '<div class="stamp ' + fakeCls + '" id="stamp">' + stampTxt + '</div>' +
      '<hr class="rule"><ul class="lines">' + lines + '</ul><div class="hint">tap a line to see the fix</div></article></div>' +
      '<div class="actions"><a class="primary" href="' + esc(mail) + '" target="_blank" rel="noopener">Get it fixed →</a>' +
      '<a href="' + esc(WEB_PAGE + "?d=" + encodeURIComponent(domain)) + '" target="_blank" rel="noopener">Share results</a>' +
      '<button class="wide" type="button" id="copy">copy summary</button></div>';

    var slip = document.getElementById("slip"), num = document.getElementById("num"), stamp = document.getElementById("stamp");
    var items = out.querySelectorAll(".lines li");
    function countUp() {
      if (reduced) { num.textContent = score; return; }
      var t0 = performance.now();
      (function step(t) { var p = Math.min(1, (t - t0) / 800); num.textContent = Math.round(score * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
    }
    if (reduced) {
      items.forEach(function (li) { li.classList.add("in"); }); countUp(); stamp.classList.add("hit");
    } else {
      requestAnimationFrame(function () { requestAnimationFrame(function () { slip.classList.add("out"); }); });
      setTimeout(countUp, 350);
      items.forEach(function (li, i) { setTimeout(function () { li.classList.add("in"); }, 500 + i * 130); });
      setTimeout(function () { stamp.classList.add("hit"); }, 700 + items.length * 130);
    }
    document.getElementById("copy").addEventListener("click", function () {
      var btn = this;
      var s = "DomainDoctor check-up: " + domain + " — " + score + "/100 (" + stampTxt + ")\n" + checks.map(function (c) { return SHORT[c.key] + ": " + valOf(c); }).join("\n");
      if (navigator.clipboard) navigator.clipboard.writeText(s).then(function () { btn.textContent = "copied ✓"; setTimeout(function () { btn.textContent = "copy summary"; }, 1500); }, function () {});
    });
  }

  function run(domain) {
    err.textContent = "";
    go.disabled = true; go.classList.add("busy");
    out.innerHTML = '<div class="printer working"><span class="led"></span></div><p class="loading">Printing the slip for <b>' + esc(domain) + '</b>…</p>';
    var mxP = DD.dns(domain, "MX").then(function (r) { return { status: r.Status, list: DD.answers(r, "MX") }; });
    Promise.all([mxP, DD.txt(domain), DD.txt("_dmarc." + domain), DD.dns(domain, "CAA").then(function (r) { return DD.answers(r, "CAA"); }), DD.txt("_mta-sts." + domain).catch(function () { return { list: [] }; }), DD.httpsWorks(domain)])
      .then(function (res) {
        var mx = res[0], rootTxt = res[1];
        if (mx.status === 3 || rootTxt.status === 3) { out.innerHTML = ""; err.textContent = "Couldn't find \"" + domain + "\". Check the spelling."; return; }
        var hasMail = mx.list.filter(function (m) { return !/^0\s+\.$/.test(m); }).length > 0;
        render(domain, [DD.checkSPF(rootTxt, hasMail), DD.checkDMARC(res[2]), DD.checkHTTPS(res[5]), DD.checkDNSSEC(rootTxt.ad), DD.checkCAA(res[3]), DD.checkMTASTS(res[4], hasMail)]);
      })
      .catch(function () { out.innerHTML = ""; err.textContent = "Couldn't reach the public lookup service. Try again in a moment."; })
      .then(function () { go.disabled = false; go.classList.remove("busy"); });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var d = cleanDomain(input.value);
    if (!d) { err.textContent = "Enter a website like yourbusiness.com"; input.focus(); return; }
    input.value = d; run(d);
  });

  function start(url) {
    var host = "";
    try { var u = new URL(url); if (u.protocol === "http:" || u.protocol === "https:") host = u.hostname; } catch (e) {}
    var d = host && cleanDomain(host);
    if (d) { d = mainDomain(d); input.value = d; run(d); } else { input.focus(); }
  }

  /* ?d= lets the popup be opened directly for testing */
  var pre = new URLSearchParams(location.search).get("d");
  if (pre) start("https://" + pre + "/");
  else if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) { start(tabs && tabs[0] && tabs[0].url || ""); });
  } else input.focus();
})();
