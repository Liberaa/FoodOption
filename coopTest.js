const { scrapeCoop } = require('./services/scrapers/coopScraper');

(async () => {
  try {
    const products = await scrapeCoop(['mjölk']);
    console.log('✅ Scraped products:', products.length);
    console.dir(products, { depth: null });
  } catch (err) {
    console.error('❌ Error scraping Coop:', err);
  }
})();
