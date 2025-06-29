const scraperService = require('../services/scraperService');

exports.getCheapestProducts = async (req, res) => {
  const search = req.query.search || 'mjölk';
  const searchTerms = search.split(',').map(s => s.trim());

  try {
    const products = await scraperService.scrapeAllStores(searchTerms);
    res.json(products);
  } catch (err) {
    console.error('❌ Scraping failed:', err); // FULL error object
    res.status(500).json({ error: err.message || 'Scraping error occurred.' });
  }
};
