# DomainDoctor

**A check-up for your business domain.** Can someone send emails pretending to be you? Is your padlock about to expire? Has someone registered a look-alike of your domain? DomainDoctor finds out in plain English and tells you exactly how to fix it.

It uses **public information only**: the same records every email service reads, plus one normal visit to your homepage. Nothing on a website is scanned or tested.

## What's inside

| Part | What it does | Where |
|---|---|---|
| **Free check-up** | A one-page site. Type a domain and get a printed "check-up slip" with a score, a stamp (*Protected / Partly protected / At risk*) and fixes for each line. | [`index.html`](index.html) |
| **DomainDoctor Weekly** | Checks each client every week and emails a plain-English report of what changed and what to do. | [`monitor/`](monitor/) |
| **Outreach playbook** | How to find clients, rules for staying trusted, and 3 email templates. | [`docs/OUTREACH.md`](docs/OUTREACH.md) |

## How it makes money

```
Free check-up page   →   $299 full check-up   →   DomainDoctor Weekly ($29–149/mo)
      (bait)               (first payment)             (monthly income)
```

## Put the free check-up online

1. Settings → Pages → Deploy from branch → `main` / root.
2. It goes live at `https://faiziahmad.github.io/DomainDoctor/`.
3. Share links like `…/DomainDoctor/?d=theirbusiness.com` so the check runs straight away.

Your contact email and the check-up price are set at the top of the script in `index.html` (`CONTACT_EMAIL`, `CHECKUP_PRICE`).

## Run the weekly monitor

```bash
cd monitor
pip install -e .
domaindoctor check yourbusiness.com
```

See [`monitor/README.md`](monitor/README.md) for clients, email sending and running it every week.

---

Made by [Faizi Ahmad](https://github.com/faiziahmad) · faizia995@gmail.com
