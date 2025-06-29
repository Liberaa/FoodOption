const { scrapeIca } = require('./services/scrapers/icaScraper');

(async () => {
  try {
    const products = await scrapeIca(['mjölk']);
    console.log('✅ Scraped products:', products.length);
    console.dir(products, { depth: null });
  } catch (err) {
    console.error('❌ Error scraping ICA:', err);
  }
})();
