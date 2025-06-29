const scraperService = require('../services/scraperService');

exports.getCheapestProducts = async (req, res) => {
  try {
    const results = await scraperService.scrapeHemkop();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to scrape products' });
  }
};
