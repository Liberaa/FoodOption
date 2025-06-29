const puppeteer      = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
const Product        = require('../../models/productModel');
puppeteer.use(StealthPlugin());

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ───────── brutalt stäng alla cookie-popuper ─────────────── */
async function killCookies(page) {
  const SEL = [
    '#onetrust-accept-btn-handler',
    '.cmpboxbtnyes', 'a.cmpboxbtnyes',
    '[data-testid="accept-cookies-button"]'
  ].join(',');
  for (let i = 0; i < 8; i++) {
    let hit = false;
    for (const f of page.frames()) {
      const btns = await f.$$(SEL);
      for (const b of btns) { await b.click().catch(()=>{}); hit = true; }
    }
    if (!hit) break;
    await sleep(400);
  }
}

/* ───────── plocka produkter ur __NEXT_DATA__ ─────────────── */
function extractFromNext(rawJson) {
  try {
    const data = JSON.parse(rawJson);
    const recurse = obj => {
      if (!obj || typeof obj !== 'object') return [];
      if (Array.isArray(obj) && obj.length && obj[0]?.name && obj[0]?.price)
        return obj;
      return Object.values(obj).flatMap(recurse);
    };
    return recurse(data);
  } catch { return []; }
}

/* ───────── DOM-fallback (brett) ──────────────────────────── */
async function domFallback(page) {
  /* scrolla lite så allt hinner renderas */
  await page.evaluate('window.scrollTo(0, 0)');
  for (let y = 0; y < 4; y++) {
    await page.evaluate(h => window.scrollBy(0, h), 500 + y * 500);
    await sleep(400);
  }

  return await page.$$eval('a[href*="/handla/varor/"]', links => {
    const hits = [];
    links.forEach(a => {
      const card = a.closest('article, div, li') || a;
      const txt  = card.innerText || '';
      const m    = txt.match(/(\d+,\d{2})/);          // pris med komma
      if (!m) return;
      const name = txt.split('\n')[0].trim();
      const price = parseFloat(m[1].replace(',','.'));
      const img = card.querySelector('img')?.src || '';
      if (name && !isNaN(price)) hits.push({name,price,url:a.href,img});
    });
    return hits;
  });
}

/* ───────── skrapa ett sökord ─────────────────────────────── */
async function scrapeOne(page, term) {
  console.log(`🔍 "${term}"`);

  const url = `https://www.coop.se/globalt-sok/?query=${encodeURIComponent(term)}`;
  await page.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });
  await sleep(1200);
  await killCookies(page);

  /* 1️⃣ försök __NEXT_DATA__ */
  let hits = await page.evaluate(() => {
    const raw = document.querySelector('#__NEXT_DATA__')?.textContent || '';
    return raw;
  });
  hits = extractFromNext(hits);
  console.log(`   NEXT_DATA-träffar: ${hits.length}`);

  /* 2️⃣ fallback DOM om tomt */
  if (!hits.length) {
    console.log('   ⏳ DOM-fallback …');
    hits = await domFallback(page);
    console.log(`   DOM-träffar: ${hits.length}`);
  }

  return hits.map(p => new Product(
    p.name,
    parseFloat(String(p.price).replace(',', '.')),
    'Coop',
    p.url.startsWith('http') ? p.url : `https://www.coop.se${p.url}`,
    p.img || p.images?.[0]?.url || ''
  ));
}

/* ───────── publikt API ───────────────────────────────────── */
async function scrapeCoop(searchTerms = ['mjölk']) {
  if (!Array.isArray(searchTerms)) searchTerms = [searchTerms];

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1366, height: 768 }
  });

  try {
    const page = await browser.newPage();
    const all  = [];
    for (const t of searchTerms) all.push(...await scrapeOne(page, t));
    return all;
  } finally { await browser.close(); }
}

module.exports = { scrapeCoop };
