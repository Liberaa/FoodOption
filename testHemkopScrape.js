const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
    userDataDir: './tmp/puppeteer',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const searchTerm = 'mjölk';

  console.log('Navigating to Hemköp...');
  await page.goto(`https://www.hemkop.se/sok?q=${encodeURIComponent(searchTerm)}`, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Accept cookie popup
  try {
    await page.waitForSelector('button#onetrust-accept-btn-handler', { timeout: 5000 });
    await page.click('button#onetrust-accept-btn-handler');
    console.log('Accepted cookies');
  } catch {
    console.log('No cookie popup found');
  }

  // Wait until at least one product appears
  await page.waitForSelector('div[data-testid="product-container"]', { timeout: 15000 });

  // Scrape product data
  const products = await page.evaluate(() => {
    const productEls = document.querySelectorAll('div[data-testid="product-container"]');
    const items = [];

    productEls.forEach(el => {
      const name = el.querySelector('p[data-testid="product-title"]')?.textContent?.trim();
      const priceText = el.querySelector('span[data-testid="price-container"]')?.textContent?.trim();
      const price = parseFloat(priceText?.replace(',', '.'));
      const url = el.querySelector('a[data-testid="link-area"]')?.href;

      if (name && price && url) {
        items.push({
          name,
          price,
          url,
          store: 'Hemköp'
        });
      }
    });

    return items;
  });

  await browser.close();

  // Output the scraped result
  console.log(`\n✅ Scraped ${products.length} products:\n`);
  console.log(products);
})();
