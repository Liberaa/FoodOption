document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const container = document.getElementById('product-list');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    container.innerHTML = 'Searching...';

    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<p>No products found.</p>';
        return;
      }

      container.innerHTML = data.map(product => `
        <div class="product">
          <img src="${product.image}" alt="${product.name}" class="product-img" />
          <h3>${product.name}</h3>
          <p>${product.price} SEK @ ${product.store}</p>
          <a href="${product.url}" target="_blank">View Product</a>
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = 'Error loading products.';
      console.error(err);
    }
  });
});
