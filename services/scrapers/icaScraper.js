/*  services/scrapers/icaScraper.js  */
const puppeteer = require('puppeteer');
const Product   = require('../../models/productModel');

/* ─── helpers ─────────────────────────────────────────── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitOne(page, selectors, timeout = 30000) {
  for (const sel of selectors) {
    try {
      return sel.startsWith('//')
        ? (await page.$x(sel))[0]
        : await page.waitForSelector(sel, { timeout, visible: true });
    } catch {}
  }
  throw new Error(`none of these appeared:\n${selectors.join('\n')}`);
}

async function jsClick(page, h, { nav=false, timeout=60000 }={}) {
  await page.evaluate(el => el.scrollIntoView({block:'center'}), h);
  const click = page.evaluate(el => el.click(), h);
  return nav
    ? Promise.all([ page.waitForNavigation({waitUntil:'networkidle2', timeout}), click ])
    : click;
}

/* ─── main scraper ────────────────────────────────────── */
async function scrapeIca(searchTerms=['mjölk'], zip='13142') {
  if (!Array.isArray(searchTerms)) searchTerms = [searchTerms];

  const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width:1366, height:768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/125 Safari/537.36');

    /* 1) home & cookies */
    await page.goto('https://www.ica.se/', { waitUntil:'networkidle2', timeout:60000 });
    const cookie = await page.$('button#onetrust-accept-btn-handler');
    if (cookie) await cookie.click();

    /* 2) “Handla nu” */
    const handla = await waitOne(page, [
      'a[href*="chooseStore=true"]',
      '//a[contains(., "Handla nu")]',
      '//button[contains(., "Handla nu")]'
    ]);
    await jsClick(page, handla);

    /* 3) overlay vs redirect */
    const overlay = await Promise.race([
      page.waitForSelector('#zipSearch, input[data-test="store-search-input"]',
                           {timeout:6000}).then(()=>true).catch(()=>false),
      page.waitForNavigation({waitUntil:'domcontentloaded',timeout:6000})
          .then(()=>false).catch(()=>false)
    ]);
    if (!overlay)
      await page.waitForSelector('#zipSearch, input[data-test="store-search-input"]');

    /* 4) postcode */
    const zipInput = await waitOne(page, [
      '#zipSearch','input[data-test="store-search-input"]','input[name="zip"]'
    ]);
    await zipInput.click({clickCount:3});
    await zipInput.type(zip, {delay:30});
    await page.keyboard.press('Enter');

    /* 5) choose first store */
    await page.waitForSelector('.ids-store-card');
    await page.evaluate(()=>{
      const el=document.querySelector('.ids-store-card button, .ids-store-card a');
      el?.scrollIntoView({block:'center'}); el?.click();
    });
    await page.waitForNavigation({waitUntil:'networkidle2'});

    /* 6) store-id */
    const storeId = (page.url().match(/stores\/(\d+)/)||[])[1]||'1003714';

    /* 7) search loop with “crawl-all-views” logic ---------- */
    const results = [];

    for (const term of searchTerms) {
      console.log(`söker “${term}”…`);
      await page.goto(
        `https://handlaprivatkund.ica.se/stores/${storeId}/search?q=${encodeURIComponent(term)}`,
        { waitUntil:'networkidle2', timeout:60000 });

      const seen = new Set();          // dedupe by product URL
      let stagnant = 0;                // break after 3 no-new rounds

      while (stagnant < 3) {
        /* harvest current 10 visible cards */
        const fresh = await page.evaluate(() => {
          const out=[];
          document.querySelectorAll('div.product-card-container').forEach(card=>{
            const url=card.querySelector('[data-test="fop-product-link"]')?.href;
            if(!url) return;
            const name = card.querySelector('[data-test="fop-title"]')?.textContent.trim();
            const price=parseFloat(
              (card.querySelector('[data-test="fop-price"]')?.textContent||'')
                .replace(',', '.').replace(/[^\d.]/g, ''));
            const img = card.querySelector('img[data-test="lazy-load-image"]')?.src;
            out.push({url,name,price,img});
          });
          return out;
        });

        let newCount=0;
        for(const p of fresh){
          if(!seen.has(p.url) && p.name && !isNaN(p.price)){
            seen.add(p.url);
            results.push(new Product(p.name, p.price, 'ICA', p.url, p.img));
            newCount++;
          }
        }
        stagnant = newCount ? 0 : stagnant+1;

        /* scroll a viewport height; ICA swaps card data here */
        await page.evaluate(()=>window.scrollBy(0, window.innerHeight));
        await sleep(800);
      }
      console.log(`  ↳ ${[...seen].length} produkter`);
    }

    return results;

  } finally { await browser.close(); }
}

module.exports = { scrapeIca };
