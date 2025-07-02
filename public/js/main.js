document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const container = document.getElementById('product-list');
  const sortSelect = document.getElementById('sort-select');

  // Store all products for sorting
  let allProducts = [];

  // List of stores & their URL-keys
  const stores = [
    { key: 'hemkop', label: 'Hemköp' },
    { key: 'ica', label: 'ICA' },
    { key: 'coop', label: 'Coop' },
    { key: 'matsmart', label: 'Matsmart' }
  ];

  // Sort products based on selected option
  function sortProducts(products, sortType) {
    const sorted = [...products]; // Create a copy to avoid mutating original
    
    switch (sortType) {
      case 'price-asc':
        return sorted.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return sorted.sort((a, b) => b.price - a.price);
      case 'none':
      default:
        return sorted; // Keep original order (relevance)
    }
  }

  // Render products in the container
  function renderProducts(products) {
    if (!products || products.length === 0) {
      container.innerHTML = '<p>No products found.</p>';
      return;
    }

    const sortedProducts = sortProducts(products, sortSelect.value);
    
    // Group products by store
    const productsByStore = {};
    sortedProducts.forEach(product => {
      if (!productsByStore[product.store]) {
        productsByStore[product.store] = [];
      }
      productsByStore[product.store].push(product);
    });

    // Render grouped products
    container.innerHTML = '';
    Object.entries(productsByStore).forEach(([storeName, storeProducts]) => {
      const section = document.createElement('section');
      section.className = 'store-section';
      section.innerHTML = `
        <h2>${storeName}</h2>
        ${storeProducts.map(p => `
          <div class="product">
            <img src="${p.image}" alt="${p.name}" class="product-img" />
            <h3>${p.name}</h3>
            <p>${p.price.toLocaleString('sv-SE')} SEK @ ${p.store}</p>
            <a href="${p.url}" target="_blank">View</a>
          </div>
        `).join('')}
      `;
      container.appendChild(section);
    });
  }

  // Handle sort change
  sortSelect.addEventListener('change', () => {
    if (allProducts.length > 0) {
      renderProducts(allProducts);
    }
  });

  // Handle form submission
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;

    // Clear previous results and reset products array
    container.innerHTML = '<p>Loading...</p>';
    allProducts = [];
    
    // Track completed requests
    let completedRequests = 0;
    const totalRequests = stores.length;

    // For each store, fetch results
    stores.forEach(({ key, label }) => {
      fetch(`/api/products/${key}?search=${encodeURIComponent(q)}`)
        .then(res => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        })
        .then(products => {
          // Add store info to each product if not already present
          if (Array.isArray(products)) {
            products.forEach(product => {
              if (!product.store) {
                product.store = label;
              }
              allProducts.push(product);
            });
          }
        })
        .catch(err => {
          console.error(`${label} error:`, err);
        })
        .finally(() => {
          completedRequests++;
          // When all requests are complete, render the results
          if (completedRequests === totalRequests) {
            renderProducts(allProducts);
          }
        });
    });
  });
});