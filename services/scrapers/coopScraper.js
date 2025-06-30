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
 * Load a Coop search or category page, wait for the grid to render,
 * then extract product data from each card.
 * Supports any searchTerm (e.g. 'mjölk', 'ägg', etc.).
 */
async function scrapePage(page, term, pageNum) {
  // Build URL dynamically: either category or search
  const baseUrl = `https://www.coop.se/handla/varor/`;
  // Use search parameter
  const url = pageNum === 1
    ? `${baseUrl}?search=${encodeURIComponent(term)}`
    : `${baseUrl}?search=${encodeURIComponent(term)}&page=${pageNum}`;

  console.log(`🔍 Loading ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await handleCookies(page);

  // Wait for product grid cells
  await page.waitForSelector('ul.Grid-items > li.Grid-cell', { timeout: 15000 });
  await sleep(500);

  // Extract each product card
  const items = await page.$$eval('ul.Grid-items > li.Grid-cell', cards =>
    cards.map(card => {
      const link = card.querySelector('a[href*="/handla/varor/"]');
      if (!link) return null;

      // Name: use aria-label if available, else image alt or first line
      const aria = link.getAttribute('aria-label');
      let name = aria ? aria.split(',')[0].trim() : null;
      if (!name) {
        const img = card.querySelector('img');
        name = img?.alt?.trim() || card.innerText.split('\n')[0].trim();
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

      // Price: find element containing "kr/st"
      const priceEl = Array.from(card.querySelectorAll('div'))
        .find(el => /kr\s*\/st/.test(el.innerText));
      if (!priceEl) return null;
      const m = priceEl.innerText.match(/([\d\.,]+)\s*kr/);
      if (!m) return null;
      const price = parseFloat(m[1].replace(',', '.'));

      return { name, price, url: href, image, store: 'Coop' };
    }).filter(x => x)
  );

  console.log(`📊 ${items.length} products found for "${term}" on page ${pageNum}`);
  return items;
}

/**
 * scrapeCoop(searchTerms, maxPages)
 * Performs a Coop search for each term, scraping up to maxPages of results.
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
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8' });

  try {
    const term = Array.isArray(searchTerms) ? searchTerms[0] : searchTerms;
    let allProducts = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const products = await scrapePage(page, term, pageNum);
      if (products.length === 0) break;
      allProducts.push(...products);
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
