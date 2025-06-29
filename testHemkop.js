const { scrapeHemkop } = require('./services/scrapers/hemkopScraper');

(async () => {
  try {
    const products = await scrapeHemkop(['mjölk']);
    console.log(`✅ Scraped ${products.length} products:`);
    console.log(products);
  } catch (err) {
    console.error('❌ Error scraping Hemköp:', err);
  }
})();
