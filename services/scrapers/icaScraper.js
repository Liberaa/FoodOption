const puppeteer = require('puppeteer');
const Product = require('../../models/productModel');

const scrapeIca = async (searchTerms = ['mjölk']) => {
  if (!Array.isArray(searchTerms)) searchTerms = [searchTerms];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  const allProducts = [];

  for (const term of searchTerms) {
    console.log(`🔍 ICA: ${term}`);
    await page.goto(`https://handla.ica.se/search/?q=${encodeURIComponent(term)}`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Accept cookies if prompted
    try {
      await page.waitForSelector('button#onetrust-accept-btn-handler', { timeout: 5000 });
      await page.click('button#onetrust-accept-btn-handler');
      console.log('✅ ICA cookies accepted');
    } catch {
      console.log('ℹ️ ICA: No cookie popup');
    }

    // Scroll to load more results
    let prevHeight;
    try {
      while (true) {
        prevHeight = await page.evaluate('document.body.scrollHeight');
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await new Promise(resolve => setTimeout(resolve, 1500));
        const newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight === prevHeight) break;
      }
    } catch (err) {
      console.log('⚠️ ICA scroll error:', err.message);
    }

    // Wait for products
    await page.waitForSelector('.product-card', { timeout: 10000 });

    const products = await page.evaluate(() => {
      const items = [];
      const cards = document.querySelectorAll('.product-card');

      cards.forEach(card => {
        const name = card.querySelector('.product__name')?.textContent?.trim();
        const priceText = card.querySelector('.price')?.textContent?.trim();
        const price = parseFloat(priceText?.replace(',', '.').replace(/[^\d.]/g, ''));
        const url = card.querySelector('a')?.href;
        const image = card.querySelector('img')?.src;

        if (name && price && url && image) {
          items.push({
            name,
            price,
            url,
            image,
            store: 'ICA'
          });
        }
      });

      return items;
    });

    console.log(`✅ ICA: Found ${products.length} products for "${term}"`);
    allProducts.push(...products);
  }

  await browser.close();
  return allProducts.map(p => new Product(p.name, p.price, p.store, p.url, p.image));
};

module.exports = { scrapeIca };
