/* DomainDoctor check logic, shared with the web page (index.html).
   Public lookups only: DNS over HTTPS plus one normal homepage visit. */
var DD = (function () {
  "use strict";
  /* ---------- public DNS lookups (DNS over HTTPS) ---------- */
  var RESOLVERS = [
    function (n, t) { return "https://dns.google/resolve?name=" + encodeURIComponent(n) + "&type=" + t + "&do=1"; },
    function (n, t) { return "https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent(n) + "&type=" + t + "&do=1"; }
  ];
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, ms); })]); }
  function dns(name, type) {
    var i = 0;
    function attempt() {
      var url = RESOLVERS[i](name, type);
      return withTimeout(fetch(url, { headers: { accept: "application/dns-json" } }), 7000)
        .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
        .catch(function (e) { i++; if (i < RESOLVERS.length) return attempt(); throw e; });
    }
    return attempt();
  }
  var TYPE_NUM = { TXT: 16, MX: 15, CAA: 257, A: 1 };
  function answers(res, type) {
    return (res.Answer || []).filter(function (a) { return a.type === TYPE_NUM[type]; }).map(function (a) { return a.data; });
  }
  function txtJoin(d) { // "v=spf1 " "include:x" -> v=spf1 include:x
    var parts = d.match(/"((?:[^"\\]|\\.)*)"/g);
    return parts ? parts.map(function (p) { return p.slice(1, -1).replace(/\\"/g, '"'); }).join("") : d;
  }
  function txt(name) { return dns(name, "TXT").then(function (r) { return { status: r.Status, list: answers(r, "TXT").map(txtJoin), ad: !!r.AD }; }); }

  function httpsWorks(domain) {
    var tryUrl = function (u) { return withTimeout(fetch(u, { mode: "no-cors", cache: "no-store", redirect: "follow" }), 9000).then(function () { return true; }); };
    return tryUrl("https://" + domain + "/").catch(function () { return tryUrl("https://www." + domain + "/"); }).catch(function () { return false; });
  }

  /* ---------- checks ---------- */
  function checkSPF(r, hasMail) {
    var spf = r.list.filter(function (s) { return /^v=spf1(\s|$)/i.test(s); });
    var c = { key: "spf", title: "List of who can send your emails", weight: 20 };
    if (!spf.length) {
      return Object.assign(c, { st: "bad", pill: "Missing", pts: 0, one: "Anyone could send email that looks like it came from you.",
        body: "<p>Your domain doesn't publish a list of the services allowed to send email for you (called an <b>SPF record</b>). Email providers can't tell your real emails from fake ones.</p>",
        fix: "Add a TXT record at your domain provider. Your email provider (Google Workspace, Microsoft 365, etc.) gives you the exact value. For Google Workspace it looks like:<pre>v=spf1 include:_spf.google.com ~all</pre>" + (hasMail ? "" : "If you don't send email from this domain at all, use:<pre>v=spf1 -all</pre>") });
    }
    if (spf.length > 1) {
      return Object.assign(c, { st: "bad", pill: "Broken", pts: 5, one: "You have more than one list, so email providers ignore them.", found: spf,
        body: "<p>Only one SPF record is allowed. With two or more, email providers treat it as an error.</p>",
        fix: "Merge them into one TXT record that starts with <code>v=spf1</code> and contains all your senders." });
    }
    var s = spf[0], m = s.match(/([+?~-])?all\b/i), q = m ? (m[1] || "+") : null;
    if (q === "-" || q === "~") {
      return Object.assign(c, { st: "good", pill: "Good", pts: 20, one: q === "-" ? "Strict list in place. Nice." : "List in place.", found: spf,
        body: "<p>Your domain lists the services allowed to send email for you, and tells providers to distrust anything else.</p>" });
    }
    return Object.assign(c, { st: "warn", pill: "Too open", pts: 8, one: "The list exists but lets anyone through.", found: spf,
      body: "<p>Your SPF record ends in a way that doesn't reject unknown senders" + (q === "+" ? " (it effectively allows <b>everyone</b>)" : "") + ".</p>",
      fix: "Change the ending to <code>~all</code> (or <code>-all</code> once you're sure every sender is listed)." });
  }

  function checkDMARC(r) {
    var rec = r.list.filter(function (s) { return /^v=DMARC1/i.test(s); });
    var c = { key: "dmarc", title: "Rule for what happens to fake emails", weight: 30 };
    var fix = "Add a TXT record named <code>_dmarc</code> at your domain provider. A safe starting point:<pre>v=DMARC1; p=quarantine; rua=mailto:you@yourbusiness.com</pre>After a few weeks with no problems, change <code>p=quarantine</code> to <code>p=reject</code>.";
    if (!rec.length) {
      return Object.assign(c, { st: "bad", pill: "Missing", pts: 0, one: "Fake emails in your name are delivered like real ones.",
        body: "<p>There's no <b>DMARC</b> rule, so email providers don't know what to do with emails that fail your checks. Most will simply deliver them. Gmail and Yahoo also now expect this for businesses.</p>", fix: fix });
    }
    var p = (rec[0].match(/(?:^|;)\s*p\s*=\s*(\w+)/i) || [])[1];
    p = p ? p.toLowerCase() : "";
    if (p === "reject") return Object.assign(c, { st: "good", pill: "Strong", pts: 30, one: "Fake emails get blocked.", found: rec, body: "<p>Emails that pretend to be you are rejected. This is the best setting.</p>" });
    if (p === "quarantine") return Object.assign(c, { st: "good", pill: "Good", pts: 25, one: "Fake emails go to spam.", found: rec, body: "<p>Emails that pretend to be you are sent to spam. Moving to <code>p=reject</code> later blocks them completely.</p>" });
    return Object.assign(c, { st: "warn", pill: "Watching only", pts: 10, one: "The rule exists but fake emails still get through.", found: rec,
      body: "<p>Your DMARC rule is set to <code>p=none</code>, which only reports problems. It doesn't stop anything.</p>", fix: "Once your real emails are passing, change <code>p=none</code> to <code>p=quarantine</code>, then later to <code>p=reject</code>." });
  }

  function checkHTTPS(ok) {
    var c = { key: "https", title: "Website opens with a secure padlock", weight: 25 };
    if (ok) return Object.assign(c, { st: "good", pill: "Good", pts: 25, one: "Visitors see the padlock.", body: "<p>Your website loads over a secure connection (HTTPS), so what visitors type stays private.</p>" });
    return Object.assign(c, { st: "warn", pill: "Couldn't confirm", pts: 8, one: "We couldn't open a secure version of your site.",
      body: "<p>We couldn't load your website over HTTPS. The site may be down, blocking checks, or missing a certificate.</p>",
      fix: "Most hosts offer a free certificate (Let's Encrypt) with one click. Turn it on and make sure <code>http://</code> redirects to <code>https://</code>." });
  }

  function checkDNSSEC(ad) {
    var c = { key: "dnssec", title: "Domain settings are signed", weight: 10 };
    if (ad) return Object.assign(c, { st: "good", pill: "Good", pts: 10, one: "Your domain's answers can't be quietly swapped.", body: "<p><b>DNSSEC</b> is on, so people are sent to the real you, not a look-alike.</p>" });
    return Object.assign(c, { st: "tip", pill: "Nice to have", pts: 3, one: "An extra layer that's switched off.",
      body: "<p><b>DNSSEC</b> adds a signature to your domain settings so nobody can quietly redirect your visitors or emails.</p>",
      fix: "Many domain providers (Cloudflare, Google Domains, Namecheap) let you turn on DNSSEC with one switch." });
  }

  function checkCAA(list) {
    var c = { key: "caa", title: "Only chosen companies can issue your padlock", weight: 7 };
    if (list.length) return Object.assign(c, { st: "good", pill: "Good", pts: 7, one: "You've limited who can create certificates for you.", found: list, body: "<p>A <b>CAA record</b> limits which companies can issue security certificates for your domain.</p>" });
    return Object.assign(c, { st: "tip", pill: "Nice to have", pts: 2, one: "Any certificate company could issue one for your domain.",
      body: "<p>A <b>CAA record</b> tells certificate companies which of them you trust. It's a small, free extra step.</p>",
      fix: "If you use Let's Encrypt, add a CAA record:<pre>0 issue \"letsencrypt.org\"</pre>" });
  }

  function checkMTASTS(r, hasMail) {
    var c = { key: "mtasts", title: "Emails to you travel securely", weight: 8 };
    var rec = r.list.filter(function (s) { return /^v=STSv1/i.test(s); });
    if (rec.length) return Object.assign(c, { st: "good", pill: "Good", pts: 8, one: "Incoming email must use a secure connection.", found: rec, body: "<p><b>MTA-STS</b> is on, so emails sent to you can't be read on the way.</p>" });
    return Object.assign(c, { st: "tip", pill: hasMail ? "Nice to have" : "Not needed", pts: hasMail ? 3 : 8, one: hasMail ? "Emails to you may travel without protection." : "This domain doesn't receive email.",
      body: hasMail ? "<p><b>MTA-STS</b> makes other email services use a secure connection when sending to you.</p>" : "<p>No mail servers found, so this doesn't apply.</p>",
      fix: hasMail ? "This needs a small policy file on your website plus one TXT record. Your email provider's help pages cover it, or I can set it up for you." : "" });
  }

  return { dns: dns, answers: answers, txt: txt, httpsWorks: httpsWorks,
    checkSPF: checkSPF, checkDMARC: checkDMARC, checkHTTPS: checkHTTPS,
    checkDNSSEC: checkDNSSEC, checkCAA: checkCAA, checkMTASTS: checkMTASTS };
})();
