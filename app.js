// app.js
const express = require('express');
const path    = require('path');

// Adjust these paths to point into services/scrapers
const { scrapeHemkop   } = require('./services/scrapers/hemkopScraper');
const { scrapeIca      } = require('./services/scrapers/icaScraper');
const { scrapeCoop     } = require('./services/scrapers/coopScraper');
const { scrapeMatsmart } = require('./services/scrapers/matSmart');

const app  = express();
const PORT = process.env.PORT || 3000;

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// View engine (if you need it)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');

// Map of store keys to scraper functions
const scrapers = {
  hemkop:   scrapeHemkop,
  ica:      scrapeIca,
  coop:     scrapeCoop,
  matsmart: scrapeMatsmart,
};

// Individual store endpoint
// GET /api/products/:store?search=...
app.get('/api/products/:store', async (req, res) => {
  const store  = req.params.store.toLowerCase();
  const search = req.query.search || '';
  const fn     = scrapers[store];

  if (!fn) {
    return res.status(404).json({ error: `Unknown store '${store}'` });
  }
  if (!search) {
    return res.status(400).json({ error: 'Missing ?search= query parameter' });
  }

  try {
    const products = await fn(search);
    return res.json(products);
  } catch (err) {
    console.error(`❌ ${store} scraper error:`, err);
    return res.status(500).json({ error: 'Scrape failed', details: err.message });
  }
});

// Aggregated endpoint (optional)
// GET /api/products?search=...
app.get('/api/products', async (req, res) => {
  const search = req.query.search || '';
  if (!search) {
    return res.status(400).json({ error: 'Missing ?search= query parameter' });
  }

  const allProducts = [];
  for (const [store, fn] of Object.entries(scrapers)) {
    try {
      const items = await fn(search);
      allProducts.push(...items);
    } catch (e) {
      console.error(`⚠️ ${store} failed:`, e.message);
    }
  }

  return res.json(allProducts);
});

// Front-end entry point
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
