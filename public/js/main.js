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

  // Create loading state HTML
  function createLoadingHTML() {
    return `
      <div class="loading">
        <div class="loading-spinner"></div>
        <div>Searching products...</div>
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
  }

  // Create skeleton cards for loading state
  function createSkeletonCards(count = 6) {
    return Array.from({ length: count }, () => `
      <div class="product-skeleton">
        <div class="skeleton-img"></div>
        <div class="skeleton-content">
          <div class="skeleton-title"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-link"></div>
        </div>
      </div>
    `).join('');
  }

  // Create progressive loading state that shows skeleton cards
  function showProgressiveLoading() {
    container.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <div>Searching across ${stores.length} stores...</div>
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
      <div id="skeleton-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; margin-top: 2rem;">
        ${createSkeletonCards(8)}
      </div>
    `;
  }

  // Update loading progress
  function updateLoadingProgress(completedRequests, totalRequests) {
    const loadingDiv = container.querySelector('.loading div:nth-child(2)');
    if (loadingDiv) {
      loadingDiv.textContent = `Searching stores... (${completedRequests}/${totalRequests} complete)`;
    }
  }

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
      container.innerHTML = `
        <div class="empty">
          <h3>No products found</h3>
          <p>Try adjusting your search terms or check back later.</p>
        </div>
      `;
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

    // Render grouped products with smooth transition
    container.style.opacity = '0';
    container.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      container.innerHTML = '';
      Object.entries(productsByStore).forEach(([storeName, storeProducts]) => {
        const section = document.createElement('section');
        section.className = 'store-section';
        section.innerHTML = `
          <h2 style="
            color: var(--text-primary);
            font-size: 1.5rem;
            font-weight: 600;
            margin: 2rem 0 1rem 0;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid var(--border);
            position: relative;
          ">
            <span style="
              background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            ">${storeName}</span>
            <span style="
              color: var(--text-muted);
              font-size: 0.875rem;
              font-weight: 400;
              margin-left: 0.5rem;
            ">(${storeProducts.length} products)</span>
          </h2>
          <div style="
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
          ">
            ${storeProducts.map(p => `
              <div class="product">
                <img src="${p.image}" alt="${p.name}" class="product-img" 
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                <div style="
                  display: none;
                  height: 180px;
                  background: var(--surface-elevated);
                  align-items: center;
                  justify-content: center;
                  color: var(--text-muted);
                  font-size: 0.875rem;
                  border-bottom: 1px solid var(--border);
                ">No image available</div>
                <h3>${p.name}</h3>
                <p style="margin-bottom: 1rem;">
                  <strong style="color: var(--primary-color); font-size: 1.125rem;">
                    ${p.price.toLocaleString('sv-SE')} SEK
                  </strong>
                </p>
                <a href="${p.url}" target="_blank" rel="noopener noreferrer">
                  View at ${p.store} →
                </a>
              </div>
            `).join('')}
          </div>
        `;
        container.appendChild(section);
      });

      // Smooth transition back in
      container.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
    }, 150);
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

    // Show progressive loading with skeleton cards
    showProgressiveLoading();
    allProducts = [];
    
    // Track completed requests
    let completedRequests = 0;
    const totalRequests = stores.length;

    // Add some visual feedback to the search button
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Searching...';
    submitButton.disabled = true;
    submitButton.style.opacity = '0.7';

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
          // You could add error handling UI here
        })
        .finally(() => {
          completedRequests++;
          updateLoadingProgress(completedRequests, totalRequests);
          
          // When all requests are complete, render the results
          if (completedRequests === totalRequests) {
            // Small delay to show completion state
            setTimeout(() => {
              renderProducts(allProducts);
              
              // Reset search button
              submitButton.textContent = originalText;
              submitButton.disabled = false;
              submitButton.style.opacity = '1';
            }, 500);
          }
        });
    });
  });
});