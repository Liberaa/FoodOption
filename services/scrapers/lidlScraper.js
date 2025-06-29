/* services/scrapers/lidlScraper.js */
const puppeteer = require('puppeteer');
const Product   = require('../../models/productModel');

/* ───────────────── helpers ───────────────── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* click the first element whose text contains `needle` (case-insensitive) */
async function clickByText(page, needle) {
  const lowers = needle.toLowerCase();
  const handles = await page.$$('button, a');
  for (const h of handles) {
    const txt = (await (await h.getProperty('textContent')).jsonValue() || '').toLowerCase();
    if (txt.includes(lowers)) {
      await page.evaluate(el => { el.scrollIntoView({block:'center'}); el.click(); }, h);
      return true;
    }
  }
  return false;
}

/* kill cookie / consent banner every time */
async function clearConsent(page) {
  if (await clickByText(page, 'godkänn')) return;
  if (await clickByText(page, 'acceptera')) return;
  const btn = await page.$('button#onetrust-accept-btn-handler') ||
              await page.$('[data-testid="uc-accept-all-button"]');
  if (btn) await page.evaluate(el => el.click(), btn);
}

/* selector list for promo tiles (Shadow host included) */
const TILE_SEL =
  'lidl-product-tile,' +
  'article[data-automation-id="product-tile"],' +
  'article.product-tile,' +
  'div[data-testid="product-tile"],' +
  'div[data-test="product-tile"],' +
  'li.product-tile,' +
  'li.grid__item';

/* scrape a single campaign page */
async function scrapePromo(page, url) {
  console.log('🔍 Lidl promo:', url);
  await page.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });
  await clearConsent(page);

  try { await page.waitForSelector(TILE_SEL, { timeout:30000 }); }
  catch { console.log('   ⚠️  no tiles found'); return []; }

  const seen = new Set(), list = [];
  let stagnant = 0;

  while (stagnant < 3) {
    const batch = await page.evaluate(sel => {
      const arr = [];
      document.querySelectorAll(sel).forEach(host => {
        const root = host.shadowRoot || host;
        const a = root.querySelector('a[href*="/p/"]');
        if (!a) return;
        const url = a.href;
        const name = root.querySelector('[data-automation-id="product-title"], .product-title, h2, h3')?.textContent.trim();
        const priceTxt = root.querySelector('[data-automation-id="product-price"], .price__value, .m-price__price, .price')?.textContent || '';
        const price = parseFloat(priceTxt.replace(',', '.').replace(/[^\d.]/g, ''));
        const img = root.querySelector('img')?.src || '';
        if (url && name && !isNaN(price)) arr.push({ url, name, price, img });
      });
      return arr;
    }, TILE_SEL);

    let fresh = 0;
    for (const p of batch) {
      if (!seen.has(p.url)) {
        seen.add(p.url);
        list.push(new Product(p.name, p.price, 'Lidl (kampanj)', p.url, p.img));
        fresh++;
      }
    }
    stagnant = fresh ? 0 : stagnant + 1;
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await sleep(800);
  }
  console.log(`   ↳ ${list.length} produkter`);
  return list;
}

/* ───────────── main entry ───────────── */
async function scrapeLidlPromo(urls = [
  'https://www.lidl.se/c/helgens-superklipp/a10073698?channel=store&tabCode=Current_Sales_Week'
]) {
  if (!Array.isArray(urls)) urls = [urls];

  const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width:1366, height:768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/125 Safari/537.36');

    /* preload store cookie */
    await page.setCookie({
      name:'selectedStoreId',
      value:'0102',                // Lidl Kungsholmen
      domain:'.lidl.se',
      path:'/',
      expires: Math.floor(Date.now()/1000)+60*60*24*30
    });

    const all = [];
    for (const u of urls) all.push(...await scrapePromo(page, u));
    return all;

  } finally { await browser.close(); }
}

module.exports = { scrapeLidlPromo };
