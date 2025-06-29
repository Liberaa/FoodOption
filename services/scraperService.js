const { scrapeHemkop } = require('./scrapers/hemkopScraper');
const { scrapeIca } = require('./scrapers/icaScraper');

exports.scrapeAllStores = async (searchTerms = ['mjölk']) => {
  const allProducts = [];

  try {
    const hemkopProducts = await scrapeHemkop(searchTerms);
    allProducts.push(...hemkopProducts);
  } catch (err) {
    console.error('❌ Hemköp failed:', err.message);
  }

  try {
    const icaProducts = await scrapeIca(searchTerms);
    allProducts.push(...icaProducts);
  } catch (err) {
    console.error('❌ ICA failed:', err.message);
  }

  return allProducts;
};
