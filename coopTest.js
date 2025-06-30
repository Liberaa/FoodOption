const { scrapeCoop } = require('./services/scrapers/coopScraper');

(async () => {
  try {
    // Scrape up to 3 pages of results for 'mjölk'
    const products = await scrapeCoop(['mjölk'], 3);
    
    console.log('\n===============================');
    console.log(`✅ FINAL RESULTS: ${products.length} products scraped`);
    console.log('===============================\n');
    
    // Group products by page (rough estimation)
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Price: ${product.price ? product.price + ' kr' : 'N/A'}`);
      console.log(`   URL: ${product.url}`);
      console.log(`   Store: ${product.store}`);
      console.log('---');
    });
    
  } catch (err) {
    console.error('❌ Error scraping Coop:', err);
  }
})();