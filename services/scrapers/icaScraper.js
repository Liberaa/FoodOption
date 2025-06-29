// services/scrapers/icaScraper.js
const puppeteer = require('puppeteer');
const Product = require('../../models/productModel');

async function scrapeIca(searchTerms = ['mjölk']) {
  if (!Array.isArray(searchTerms)) searchTerms = [searchTerms];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  // Go to ICA
  await page.goto('https://www.ica.se/', { waitUntil: 'networkidle2', timeout: 60000 });

  // Step 1: Accept cookies
  try {
    await page.waitForSelector('button#onetrust-accept-btn-handler', { timeout: 5000 });
    await page.click('button#onetrust-accept-btn-handler');
    console.log('🍪 Accepted cookies');
  } catch {
    console.log('ℹ️ No cookie popup');
  }

  // Step 2: Click "Handla nu"
  try {
    await page.waitForSelector('a[href*="chooseStore=true"]', { timeout: 8000 });
    await page.evaluate(() => {
      const link = document.querySelector('a[href*="chooseStore=true"]');
      if (link) link.click();
    });
    console.log('🛒 Clicked "Handla nu"');
    await new Promise(res => setTimeout(res, 3000));
  } catch (err) {
    console.warn('⚠️ Could not click "Handla nu":', err.message);
  }

  // Step 3: Input postal code and click "Sök"
  try {
    await page.waitForSelector('#zipSearch', { timeout: 10000 });
    await page.type('#zipSearch', '13142');
    console.log('📮 Typed postal code');
    await new Promise(res => setTimeout(res, 1000));
    await page.click('button.ids-button');
    console.log('🔍 Clicked "Sök"');
    await new Promise(res => setTimeout(res, 3000));
  } catch (err) {
    console.warn('⚠️ Failed to input zip code or click Sök:', err.message);
  }

  // Step 4: Click "Välj butik och handla"
  try {
    await page.waitForSelector('.ids-store-card__buttons a.ids-button--primary', { timeout: 10000 });
    await page.click('.ids-store-card__buttons a.ids-button--primary');
    console.log('🏬 Clicked "Välj butik och handla"');
    await new Promise(res => setTimeout(res, 3000));
  } catch (err) {
    console.warn('⚠️ Could not click store card:', err.message);
  }

  const allProducts = [];

  for (const term of searchTerms) {
    console.log(`🔍 ICA: Searching for "${term}"`);
    await page.goto(`https://handlaprivatkund.ica.se/stores/1004282/search?q=${encodeURIComponent(term)}`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    try {
      await page.waitForSelector('div.product-card-container', { timeout: 10000 });
      await new Promise(res => setTimeout(res, 1000));
    } catch (err) {
      console.warn('⚠️ Product cards not fully loaded:', err.message);
      continue;
    }

    const products = await page.evaluate(() => {
      const items = [];
      const cards = document.querySelectorAll('div.product-card-container');

      cards.forEach(card => {
        const name = card.querySelector('h3[data-test="fop-title"]')?.textContent?.trim();
        const priceText = card.querySelector('[data-test="fop-price"]')?.textContent?.trim();
        const price = parseFloat(priceText?.replace(',', '.').replace(/[^\d.]/g, ''));
        const url = card.querySelector('a[data-test="fop-product-link"]')?.href;
        const image = card.querySelector('img[data-test="lazy-load-image"]')?.src;

        if (name && price && url && image) {
          items.push({ name, price, url, image, store: 'ICA' });
        }
      });

      return items;
    });

    console.log(`✅ ICA found ${products.length} items for "${term}"`);
    allProducts.push(...products);
  }

  await browser.close();
  return allProducts.map(p => new Product(p.name, p.price, p.store, p.url, p.image));
}

module.exports = { scrapeIca };
