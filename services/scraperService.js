const puppeteer = require('puppeteer');
const Product = require('../models/productModel');

exports.scrapeHemkop = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const searchTerm = 'mjölk';

  await page.goto(`https://www.hemkop.se/sok?q=${encodeURIComponent(searchTerm)}`, {
    waitUntil: 'networkidle2'
  });

  const products = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-test="product-list"] article')).map(el => {
      const name = el.querySelector('[data-test="product-title"]')?.textContent.trim();
      const priceText = el.querySelector('[data-test="product-price"]')?.textContent.trim();
      const price = parseFloat(priceText?.replace(',', '.')?.replace(/[^\d.]/g, '')) || null;
      const url = el.querySelector('a')?.href;
      return { name, price, url: 'https://www.hemkop.se' + url, store: 'Hemköp' };
    });
  });

  await browser.close();
  return products.filter(p => p.name && p.price && p.url).map(p => new Product(p.name, p.price, p.store, p.url));
};
