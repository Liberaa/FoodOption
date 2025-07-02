// services/scrapers/coopScraper.js
const puppeteer = require('puppeteer');
const Product   = require('../../models/productModel');

const sleep = ms => new Promise(res => setTimeout(res, ms));

/**
 * Accept any visible cookie banner.
 */
async function handleCookies(page) {
  await sleep(1000);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => /acceptera|godkänn|accept/i.test(b.textContent));
    if (btn && btn.offsetParent !== null) btn.click();
  });
  await sleep(500);
}

/**
 * Perform a search by clicking into the search input on the Coop varor page,
 * typing the term, pressing Enter, and waiting for navigation to complete.
 */
async function performSearch(page, term) {
  console.log(`🔍 Performing search for "${term}"`);
  await page.goto('https://www.coop.se/handla/varor/', {
    waitUntil: 'networkidle2', timeout: 30000
  });
  await handleCookies(page);

  const inputSelector = 'input[data-testid="search-input"]';
  await page.waitForSelector(inputSelector, { timeout: 10000 });
  await page.click(inputSelector);
  await page.focus(inputSelector);
  // Clear any existing text
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');

  await page.type(inputSelector, term, { delay: 100 });
  await Promise.all([
    page.keyboard.press('Enter'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
  ]);

  await handleCookies(page);
  // Wait for results grid
  await page.waitForSelector('ul.Grid-items > li.Grid-cell', { timeout: 30000 });
  console.log(`✅ Search results loaded for "${term}"`);
}

/**
 * Scrape products from a single search result page.
 */
async function scrapeResultsPage(page, pageNum) {
  console.log(`📄 Scraping results page ${pageNum}`);
  if (pageNum > 1) {
    const url = new URL(page.url());
    url.searchParams.set('page', pageNum);
    await page.goto(url.toString(), {
      waitUntil: 'networkidle2', timeout: 30000
    });
    await handleCookies(page);
    await page.waitForSelector('ul.Grid-items > li.Grid-cell', { timeout: 30000 });
  }
  await sleep(500);

  const products = await page.$$eval('ul.Grid-items > li.Grid-cell', cards =>
    cards.map(card => {
      const link = card.querySelector('a[href*="/handla/varor/"]');
      if (!link) return null;

      // Name from aria-label or fallback to alt/text
      const aria = link.getAttribute('aria-label');
      let name = aria ? aria.split(',')[0].trim() : null;
      if (!name) {
        const img = card.querySelector('img');
        name = img?.alt?.trim() || card.textContent.split('\n')[0].trim();
      }
      if (!name) return null;

      // URL
      let href = link.href || link.getAttribute('href');
      if (href.startsWith('/')) href = location.origin + href;

      // Image
      const imgEl = card.querySelector('img');
      let image = imgEl
        ? (imgEl.src || imgEl.getAttribute('data-src') || '')
        : '';
      if (image.startsWith('//')) image = location.protocol + image;

      // Price per item: "kr/st"
      const priceEl = Array.from(card.querySelectorAll('div'))
        .find(el => /kr\s*\/st/.test(el.innerText));
      if (!priceEl) return null;
      const m = priceEl.innerText.match(/([\d\.,]+)\s*kr/);
      if (!m) return null;
      const price = parseFloat(m[1].replace(',', '.'));

      return { name, price, url: href, image, store: 'Coop' };
    }).filter(x => x)
  );

  console.log(`🔢 Found ${products.length} items on page ${pageNum}`);
  return products;
}

/**
 * Main scraper entry point: runs a search for the given term and scrapes up to maxPages.
 */
async function scrapeCoop(searchTerms = ['mjölk'], maxPages = 5) {
  console.log('🚀 Starting Coop scraper…');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1366, height: 768 }
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8' });

  try {
    const term = Array.isArray(searchTerms) ? searchTerms[0] : searchTerms;
    await performSearch(page, term);

    let allProducts = [];
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const items = await scrapeResultsPage(page, pageNum);
      if (items.length === 0) break;
      allProducts.push(...items);
    }

    // Deduplicate by name+price
    const seen = new Set();
    const unique = allProducts.filter(p => {
      const key = `${p.name}|${p.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`\n🎉 Done! ${unique.length} unique products found for "${term}".`);
    return unique.map(p => new Product(p.name, p.price, p.store, p.url, p.image));
  } catch (err) {
    console.error('❌ Scrape failed:', err);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeCoop };
