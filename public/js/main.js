document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api/products');
  const data = await res.json();

  const container = document.getElementById('product-list');
  container.innerHTML = data.map(product =>
    `<div><strong>${product.name}</strong>: ${product.price} SEK @ ${product.store} <a href="${product.url}" target="_blank">View</a></div>`
  ).join('');
});
