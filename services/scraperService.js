const { scrapeHemkop }   = require('./scrapers/hemkopScraper');
const { scrapeIca }      = require('./scrapers/icaScraper');
const { scrapeCoop }     = require('./scrapers/coopScraper');
const { scrapeMatsmart } = require('./scrapers/matSmart');  // ← new

/**
 * Scrapar alla angivna butiker med gemensamt interface
 * @param {string[]} searchTerms Array av sökord (t.ex. ['mjölk'])
 * @returns {Promise<Product[]>} Lista med produkter från alla butiker
 */
exports.scrapeAllStores = async (searchTerms = ['mjölk']) => {
  const allProducts = [];

  // Hemköp
  try {
    const hemkopProducts = await scrapeHemkop(searchTerms);
    allProducts.push(...hemkopProducts);
  } catch (err) {
    console.error('❌ Hemköp failed:', err.message);
  }

  // ICA
  try {
    const icaProducts = await scrapeIca(searchTerms);
    allProducts.push(...icaProducts);
  } catch (err) {
    console.error('❌ ICA failed:', err.message);
  }

  // Coop
  try {
    const coopProducts = await scrapeCoop(searchTerms);
    allProducts.push(...coopProducts);
  } catch (err) {
    console.error('❌ Coop failed:', err.message);
  }

  // Matsmart
  try {
    const matsmartProducts = await scrapeMatsmart(searchTerms);
    allProducts.push(...matsmartProducts);
  } catch (err) {
    console.error('❌ Matsmart failed:', err.message);
  }

  return allProducts;
};
