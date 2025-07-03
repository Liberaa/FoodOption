const puppeteer = require('puppeteer');
const Product = require('../../models/productModel');

class WillysScraper {
  constructor() {
    this.baseUrl = 'https://www.willys.se/sok?q=';
    this.browser = null;
    this.page = null;
  }

  async init() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.page = await this.browser.newPage();
      
      // Set user agent to avoid being blocked
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });
      
      console.log('Browser initialized successfully');
    } catch (error) {
      console.error('Error initializing browser:', error);
      throw error;
    }
  }

  async scrapeProducts(searchTerm) {
    try {
      const url = `${this.baseUrl}${encodeURIComponent(searchTerm)}`;
      console.log(`Navigating to: ${url}`);
      
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for products to load
      await this.page.waitForSelector('[data-testid="product-item"]', { timeout: 10000 });

      // Extract product data
      const products = await this.page.evaluate(() => {
        const productElements = document.querySelectorAll('[data-testid="product-item"]');
        const products = [];

        productElements.forEach(element => {
          try {
            const nameElement = element.querySelector('[data-testid="product-name"]');
            const priceElement = element.querySelector('[data-testid="product-price"]');
            const imageElement = element.querySelector('img');
            const linkElement = element.querySelector('a');
            const brandElement = element.querySelector('[data-testid="product-brand"]');
            const unitElement = element.querySelector('[data-testid="product-unit"]');

            if (nameElement && priceElement) {
              const product = {
                name: nameElement.textContent.trim(),
                price: priceElement.textContent.trim(),
                image: imageElement ? imageElement.src : null,
                link: linkElement ? linkElement.href : null,
                brand: brandElement ? brandElement.textContent.trim() : null,
                unit: unitElement ? unitElement.textContent.trim() : null,
                store: 'Willys',
                scrapedAt: new Date().toISOString()
              };

              // Clean price data
              const priceMatch = product.price.match(/(\d+[,.]?\d*)/);
              if (priceMatch) {
                product.cleanPrice = parseFloat(priceMatch[1].replace(',', '.'));
              }

              products.push(product);
            }
          } catch (error) {
            console.warn('Error processing product element:', error);
          }
        });

        return products;
      });

      console.log(`Found ${products.length} products`);
      return products;
    } catch (error) {
      console.error('Error scraping products:', error);
      throw error;
    }
  }

  async saveProducts(products) {
    try {
      const savedProducts = [];
      
      for (const productData of products) {
        try {
          const product = new Product(productData);
          const savedProduct = await product.save();
          savedProducts.push(savedProduct);
        } catch (error) {
          console.error('Error saving product:', productData.name, error);
        }
      }
      
      console.log(`Saved ${savedProducts.length} products to database`);
      return savedProducts;
    } catch (error) {
      console.error('Error saving products:', error);
      throw error;
    }
  }

  async scrapeAndSave(searchTerm) {
    try {
      await this.init();
      const products = await this.scrapeProducts(searchTerm);
      
      if (products.length > 0) {
        const savedProducts = await this.saveProducts(products);
        return savedProducts;
      } else {
        console.log('No products found');
        return [];
      }
    } catch (error) {
      console.error('Error in scrapeAndSave:', error);
      throw error;
    } finally {
      await this.close();
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        console.log('Browser closed');
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }

  // Method to get product details from a specific product page
  async getProductDetails(productUrl) {
    try {
      await this.page.goto(productUrl, { waitUntil: 'networkidle2' });
      
      const productDetails = await this.page.evaluate(() => {
        const details = {};
        
        // Extract additional product information
        const descriptionElement = document.querySelector('[data-testid="product-description"]');
        const ingredientsElement = document.querySelector('[data-testid="product-ingredients"]');
        const nutritionElement = document.querySelector('[data-testid="product-nutrition"]');
        const categoryElement = document.querySelector('[data-testid="product-category"]');
        
        if (descriptionElement) details.description = descriptionElement.textContent.trim();
        if (ingredientsElement) details.ingredients = ingredientsElement.textContent.trim();
        if (nutritionElement) details.nutrition = nutritionElement.textContent.trim();
        if (categoryElement) details.category = categoryElement.textContent.trim();
        
        return details;
      });
      
      return productDetails;
    } catch (error) {
      console.error('Error getting product details:', error);
      return {};
    }
  }
}

module.exports = WillysScraper;