const { scrapeIca } = require('./services/scrapers/icaScraper');

(async () => {
  try {
    const products = await scrapeIca(['mjölk']);
    console.log(`✅ ICA scraped ${products.length} products`);
    console.log(products);
  } catch (err) {
    console.error('❌ ICA scrape error:', err);
  }
})();
