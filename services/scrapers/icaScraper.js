/*  services/scrapers/icaScraper.js  */
const puppeteer = require('puppeteer');
const Product   = require('../../models/productModel');

/* ─── helpers ─────────────────────────────────────────── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitOne(page, selectors, timeout = 30000) {
  for (const sel of selectors) {
    try {
      if (sel.startsWith('//')) {
        const elements = await page.$x(sel);
        if (elements.length > 0) return elements[0];
      } else {
        return await page.waitForSelector(sel, { timeout, visible: true });
      }
    } catch (e) {
      console.log(`Selector "${sel}" not found:`, e.message);
    }
  }
  throw new Error(`None of these selectors appeared:\n${selectors.join('\n')}`);
}

async function jsClick(page, element, { nav = false, timeout = 60000 } = {}) {
  if (!element) throw new Error('Element is null or undefined');
  
  await page.evaluate(el => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, element);
  
  await sleep(500); // Wait for scroll to complete
  
  if (nav) {
    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout }),
      page.evaluate(el => el.click(), element)
    ]);
    return response;
  } else {
    return await page.evaluate(el => el.click(), element);
  }
}

/* ─── main scraper ────────────────────────────────────── */
async function scrapeIca(searchTerms = ['mjölk'], zip = '13142') {
  if (!Array.isArray(searchTerms)) searchTerms = [searchTerms];

  const browser = await puppeteer.launch({
    headless: 'new', // Use new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-default-apps',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  let page;
  try {
    page = await browser.newPage();
    
    // Set a more realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['stylesheet', 'font', 'image'].includes(resourceType)) {
        req.continue();
      } else if (resourceType === 'document' || resourceType === 'script') {
        req.continue();
      } else {
        req.abort();
      }
    });

    console.log('Navigating to ICA homepage...');
    
    /* 1) Go to homepage and handle cookies */
    await page.goto('https://www.ica.se/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });

    // Wait for page to load and handle cookie consent
    await sleep(2000);
    
    try {
      const cookieButton = await page.waitForSelector(
        'button#onetrust-accept-btn-handler, button[id*="accept"], button[class*="accept"]',
        { timeout: 5000 }
      );
      if (cookieButton) {
        await cookieButton.click();
        await sleep(1000);
      }
    } catch (e) {
      console.log('No cookie consent found or already accepted');
    }

    /* 2) Find and click "Handla nu" or similar */
    console.log('Looking for shopping button...');
    
    try {
      const shoppingButton = await waitOne(page, [
        'a[href*="chooseStore"]',
        'a[data-test*="shopping"]',
        '//a[contains(text(), "Handla nu")]',
        '//a[contains(text(), "Handla")]',
        '//button[contains(text(), "Handla nu")]',
        '//button[contains(text(), "Handla")]'
      ]);
      
      console.log('Found shopping button, clicking...');
      
      // Try clicking without waiting for navigation first
      await page.evaluate(el => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, shoppingButton);
      await sleep(500);
      
      // Check if it's a link that should navigate
      const isNavigationLink = await page.evaluate(el => {
        return el.tagName === 'A' && el.href && !el.href.includes('#');
      }, shoppingButton);
      
      if (isNavigationLink) {
        // Use Promise.race to handle cases where navigation might not happen
        const clickPromise = page.evaluate(el => el.click(), shoppingButton);
        const navPromise = page.waitForNavigation({ 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        }).catch(() => null); // Don't fail if no navigation
        
        await Promise.all([clickPromise, navPromise]);
      } else {
        // Just click without waiting for navigation
        await page.evaluate(el => el.click(), shoppingButton);
      }
      
      await sleep(3000);
      
    } catch (e) {
      console.log('Shopping button approach failed, trying direct navigation...');
      // Try going directly to the store selection page
      await page.goto('https://www.ica.se/handla/?chooseStore=true', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    }

    /* 3) Handle store selection */
    console.log('Handling store selection...');
    console.log('Current URL after button click:', page.url());
    
    // Wait for either overlay or redirect
    let storeSelectionFound = false;
    try {
      await page.waitForSelector(
        'input[placeholder*="postnum"], input[data-test*="store"], #zipSearch, input[name="zip"]',
        { timeout: 15000 }
      );
      storeSelectionFound = true;
      console.log('Store selection form found');
    } catch (e) {
      console.log('Store selection form not found, checking current URL...');
      // Maybe we're already on the shopping page
      if (page.url().includes('handlaprivatkund') || page.url().includes('stores')) {
        console.log('Already on shopping page');
        storeSelectionFound = false;
      } else {
        console.log('Trying alternative approach to reach store selection...');
        // Try alternative URLs
        const alternativeUrls = [
          'https://www.ica.se/handla/',
          'https://handlaprivatkund.ica.se/',
          'https://www.ica.se/butiker/'
        ];
        
        for (const url of alternativeUrls) {
          try {
            console.log(`Trying ${url}...`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
            await sleep(2000);
            
            // Check if we can find store selection now
            const found = await page.$('input[placeholder*="postnum"], input[data-test*="store"], #zipSearch, input[name="zip"]');
            if (found) {
              storeSelectionFound = true;
              console.log('Store selection found via alternative URL');
              break;
            }
          } catch (urlError) {
            console.log(`Failed to load ${url}`);
          }
        }
      }
    }

    if (storeSelectionFound) {
      /* 4) Enter postcode */
      console.log(`Entering postcode: ${zip}`);
      
      const zipInput = await waitOne(page, [
        'input[placeholder*="postnum"]',
        'input[data-test*="store"]',
        '#zipSearch',
        'input[name="zip"]'
      ]);
      
      // Clear and enter zip code
      await page.evaluate(el => {
        el.value = '';
        el.focus();
      }, zipInput);
      
      await zipInput.type(zip, { delay: 100 });
      await sleep(1000);
      
      // Try to submit
      try {
        await page.keyboard.press('Enter');
        await sleep(2000);
      } catch (e) {
        // Try to find and click submit button
        try {
          const submitBtn = await page.waitForSelector(
            'button[type="submit"], button[data-test*="search"], .search-button',
            { timeout: 3000 }
          );
          await submitBtn.click();
          await sleep(2000);
        } catch (submitError) {
          console.log('Could not submit zip code form');
        }
      }

      /* 5) Choose first available store */
      console.log('Selecting first store...');
      
      try {
        await page.waitForSelector(
          '.store-card, .ids-store-card, [data-test*="store-card"], .store-list-item',
          { timeout: 15000 }
        );
        
        const storeSelected = await page.evaluate(() => {
          // Look for store selection buttons/links
          const selectors = [
            '.store-card button',
            '.store-card a',
            '.ids-store-card button',
            '.ids-store-card a',
            '[data-test*="store-card"] button',
            '[data-test*="store-card"] a',
            '[data-test*="select-store"]',
            '.store-list-item button',
            '.store-list-item a'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              console.log('Clicking store with selector:', selector);
              element.scrollIntoView({ block: 'center' });
              element.click();
              return true;
            }
          }
          return false;
        });
        
        if (storeSelected) {
          console.log('Store clicked, waiting for navigation...');
          try {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
            console.log('Navigation completed');
          } catch (navError) {
            console.log('Navigation timeout, but continuing...');
            await sleep(3000);
          }
        }
      } catch (e) {
        console.log('Store selection failed:', e.message);
        console.log('Continuing with fallback store ID...');
      }
    }

    /* 6) Extract store ID from URL */
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    const storeIdMatch = currentUrl.match(/stores\/(\d+)/);
    const storeId = storeIdMatch ? storeIdMatch[1] : '1003714'; // fallback
    console.log('Using store ID:', storeId);

    /* 7) Search for products */
    const results = [];

    for (const term of searchTerms) {
      console.log(`Searching for "${term}"...`);
      
      const searchUrl = `https://handlaprivatkund.ica.se/stores/${storeId}/search?q=${encodeURIComponent(term)}`;
      console.log('Search URL:', searchUrl);
      
      try {
        await page.goto(searchUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 60000 
        });
        
        await sleep(3000); // Wait for products to load
        
        const seen = new Set();
        let stagnantRounds = 0;
        let maxRounds = 5; // Limit rounds to prevent infinite loops
        let round = 0;

        while (stagnantRounds < 3 && round < maxRounds) {
          round++;
          console.log(`  Round ${round}, scrolling for more products...`);
          
          // Extract products from current view
          const freshProducts = await page.evaluate(() => {
            const products = [];
            
            // Try multiple selectors for product cards
            const cardSelectors = [
              '.product-card-container',
              '[data-test*="product-card"]',
              '.product-card',
              '.product-item'
            ];
            
            let cards = [];
            for (const selector of cardSelectors) {
              cards = document.querySelectorAll(selector);
              if (cards.length > 0) break;
            }
            
            cards.forEach(card => {
              try {
                // Try multiple selectors for product link
                const linkSelectors = [
                  '[data-test="fop-product-link"]',
                  'a[href*="/product/"]',
                  '.product-link',
                  'a'
                ];
                
                let url = null;
                for (const selector of linkSelectors) {
                  const link = card.querySelector(selector);
                  if (link && link.href && link.href.includes('product')) {
                    url = link.href;
                    break;
                  }
                }
                
                if (!url) return;
                
                // Try multiple selectors for product name
                const nameSelectors = [
                  '[data-test="fop-title"]',
                  '.product-title',
                  '.product-name',
                  'h3',
                  'h2',
                  '.title'
                ];
                
                let name = null;
                for (const selector of nameSelectors) {
                  const nameEl = card.querySelector(selector);
                  if (nameEl && nameEl.textContent.trim()) {
                    name = nameEl.textContent.trim();
                    break;
                  }
                }
                
                // Try multiple selectors for price
                const priceSelectors = [
                  '[data-test="fop-price"]',
                  '.price',
                  '.product-price',
                  '[class*="price"]'
                ];
                
                let priceText = '';
                for (const selector of priceSelectors) {
                  const priceEl = card.querySelector(selector);
                  if (priceEl && priceEl.textContent) {
                    priceText = priceEl.textContent;
                    break;
                  }
                }
                
                // Parse price
                const price = parseFloat(
                  priceText.replace(',', '.').replace(/[^\d.]/g, '')
                );
                
                // Try to get image
                const img = card.querySelector('img')?.src || '';
                
                if (name && !isNaN(price) && price > 0) {
                  products.push({ url, name, price, img });
                }
              } catch (e) {
                console.log('Error processing product card:', e);
              }
            });
            
            return products;
          });

          let newProductsCount = 0;
          for (const product of freshProducts) {
            if (!seen.has(product.url)) {
              seen.add(product.url);
              results.push(new Product(
                product.name,
                product.price,
                'ICA',
                product.url,
                product.img
              ));
              newProductsCount++;
            }
          }

          console.log(`    Found ${newProductsCount} new products (${seen.size} total)`);
          
          if (newProductsCount === 0) {
            stagnantRounds++;
          } else {
            stagnantRounds = 0;
          }

          // Scroll down to load more products
          await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
          });
          
          await sleep(1500); // Wait for new products to load
        }
        
        console.log(`  ✓ Found ${seen.size} products for "${term}"`);
        
      } catch (e) {
        console.error(`Error searching for "${term}":`, e.message);
      }
    }

    console.log(`\nScraping complete! Found ${results.length} products total.`);
    return results;

  } catch (error) {
    console.error('Scraping failed:', error);
    throw error;
  } finally {
    if (page) await page.close();
    await browser.close();
  }
}

module.exports = { scrapeIca };