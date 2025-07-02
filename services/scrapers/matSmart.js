// services/scrapers/matSmart.js
const puppeteer = require('puppeteer');
const Product   = require('../../models/productModel');

const sleep = ms => new Promise(res => setTimeout(res, ms));

/**
 * Close any cookie banner
 */
async function closeCookies(page) {
  await sleep(500);
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const txt = (await btn.evaluate(n => n.textContent)).trim();
    if (/godkänn kakor|accept cookies|acceptera kakor/i.test(txt)) {
      await btn.click();
      break;
    }
  }
  await sleep(500);
}

/**
 * Navigate via the site’s search input
 */
async function goToSearch(page, term) {
  console.log(`🔍 Opening Matsmart front page`);
  await page.goto('https://www.matsmart.se', { waitUntil: 'networkidle2' });
  await closeCookies(page);

  console.log(`✏️ Typing search term: "${term}"`);
  const inputSel = 'input[name="query"]';
  await page.waitForSelector(inputSel, { visible: true });
  await page.click(inputSel);
  await page.type(inputSel, term, { delay: 100 });
  await page.keyboard.press('Enter');

  console.log(`⏳ Waiting for search results…`);
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

  await page.waitForSelector('a[href*="/produkt/"]', { timeout: 30000 });
  console.log(`✅ Search results loaded`);
}

/**
 * Extract products from current page by scanning product links
 */
async function extractProducts(page) {
  const products = await page.$$eval('a[href*="/produkt/"]', links => {
    const seen = new Set();
    return links.map(link => {
      const card = link.closest('article, li, div');
      if (!card) return null;
      const name = link.textContent.trim();
      if (!name) return null;

      let url = link.href;
      if (url.startsWith('/')) url = location.origin + url;

      const img = card.querySelector('img');
      const image = img ? (img.src || img.getAttribute('data-src') || '') : '';

      const priceMatch = card.textContent.match(/(\d+[\d\.,]*)\s*kr/i);
      if (!priceMatch) return null;
      const price = parseFloat(priceMatch[1].replace(',', '.'));

      const key = `${name}|${price}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return { name, price, url, image, store: 'Matsmart' };
    }).filter(Boolean);
  });
  return products;
}

/**
 * Scrape Matsmart search results for given term across pages
 */
async function scrapeMatsmart(searchTerms = ['mjölk'], maxPages = 5) {
  const term = Array.isArray(searchTerms) ? searchTerms[0] : searchTerms;
  console.log(`🚀 Starting Matsmart scraper for "${term}"`);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page    = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 ...');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8' });

  let all = [];
  try {
    await goToSearch(page, term);
    for (let i = 1; i <= maxPages; i++) {
      if (i > 1) {
        const url = new URL(page.url());
        url.searchParams.set('page', i);
        console.log(`📄 Navigating to page ${i}: ${url.toString()}`);
        await page.goto(url.toString(), { waitUntil: 'networkidle2', timeout: 30000 });
        await closeCookies(page);
      }
      console.log(`📄 Scraping page ${i}`);
      const items = await extractProducts(page);
      console.log(`🔢 Found ${items.length} items on page ${i}`);
      if (!items.length) break;
      all.push(...items);
    }
  } catch (err) {
    console.error('❌ Scrape failed:', err);
  } finally {
    await browser.close();
  }

  console.log(`\n🎉 Total unique products: ${all.length}`);
  return all.map(p => new Product(p.name, p.price, p.store, p.url, p.image));
}

module.exports = { scrapeMatsmart };
