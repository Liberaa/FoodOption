const puppeteer = require('puppeteer');
const Product = require('../../models/productModel');

const scrapeHemkop = async (searchTerms = ['mjölk']) => {
  if (!Array.isArray(searchTerms)) {
    searchTerms = [searchTerms];
  }

  const browser = await puppeteer.launch({
    headless: true,
    slowMo: 0,
    userDataDir: './tmp/puppeteer',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const allProducts = [];

  for (const term of searchTerms) {
    console.log(`🔍 Searching Hemköp for: ${term}`);
    await page.goto(`https://www.hemkop.se/sok?q=${encodeURIComponent(term)}`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Accept cookies if needed
    try {
      await page.waitForSelector('button#onetrust-accept-btn-handler', { timeout: 5000 });
      await page.click('button#onetrust-accept-btn-handler');
      console.log('✅ Accepted cookies');
    } catch {
      console.log('ℹ️ No cookie popup');
    }

    // Click all "Visa fler produkter" buttons until they disappear
    let loadMore = true;
    while (loadMore) {
      try {
        const buttons = await page.$$('button[data-testid="button"]');
        let found = false;

        for (const btn of buttons) {
          const text = await page.evaluate(el => el.textContent, btn);
          if (text.includes('Visa fler produkter')) {
            console.log('🔁 Clicking: Visa fler produkter');
            await btn.click();
            await new Promise(resolve => setTimeout(resolve, 1500)); // Manual wait
            found = true;
            break;
          }
        }

        if (!found) {
          loadMore = false;
        }
      } catch (err) {
        console.log('⚠️ Error clicking "Visa fler produkter":', err.message);
        loadMore = false;
      }
    }

    // Wait for product elements
    await page.waitForSelector('div[data-testid="product-container"]', { timeout: 10000 });

    const products = await page.evaluate(() => {
      const items = [];
      const productEls = document.querySelectorAll('div[data-testid="product-container"]');

      productEls.forEach(el => {
        const name = el.querySelector('p[data-testid="product-title"]')?.textContent?.trim();
        const priceText = el.querySelector('span[data-testid="price-container"]')?.textContent?.trim();
        const price = parseFloat(priceText?.replace(',', '.'));
        const url = el.querySelector('a[data-testid="link-area"]')?.href;

        const imgEl = el.querySelector('img');
        const image =
          imgEl?.getAttribute('src') ||
          imgEl?.getAttribute('data-src') ||
          imgEl?.getAttribute('srcset')?.split(' ')[0];

        if (name && price && url && image) {
          items.push({
            name,
            price,
            url,
            image,
            store: 'Hemköp'
          });
        }
      });

      return items;
    });

    console.log(`✅ Found ${products.length} total products for "${term}"`);
    allProducts.push(...products);
  }

  await browser.close();

  return allProducts.map(p => new Product(p.name, p.price, p.store, p.url, p.image));
};

module.exports = { scrapeHemkop };
