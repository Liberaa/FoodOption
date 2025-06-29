const { scrapeLidlPromo } = require('./services/scrapers/lidlScraper');

(async () => {
  try {
    const products = await scrapeLidlPromo(
      'https://www.lidl.se/c/helgens-superklipp/a10073698?channel=store&tabCode=Current_Sales_Week'
    );
    console.log('✅ Scraped products:', products.length);
    console.dir(products, { depth: null });
  } catch (e) {
    console.error('❌ Error scraping Lidl:', e);
  }
})();
