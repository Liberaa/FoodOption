// matSmartTest.js
// Simple test script for the Matsmart scraper
// Usage: node matSmartTest.js

const { scrapeMatsmart } = require('./services/scrapers/matSmart');

(async () => {
  try {
    // Change search term and page count as needed
    const searchTerm = process.argv[2] || 'mjölk';
    const maxPages   = parseInt(process.argv[3], 10) || 3;

    console.log(`🚀 Testing Matsmart scraper for term "${searchTerm}" (maxPages=${maxPages})`);
    const products = await scrapeMatsmart([searchTerm], maxPages);

    console.log(`\n🎉 Found ${products.length} products:`);
    products.forEach((p, i) => {
      console.log(`${i+1}. ${p.name}`);
      console.log(`   Price: ${p.price} kr`);
      console.log(`   URL:   ${p.url}`);
      console.log(`   Image: ${p.image}`);
      console.log('---');
    });
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
})();
