const PRICE = 10;
const CART_STORAGE_KEY = "super10-cart";
const REVIEW_STORAGE_KEY = "super10-reviews";
const baseReviewStats = { average: 0, total: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };

const starterReviews = [];

const starterProducts = [
  { id: "p1", name: "Batom vermelho cremoso", category: "Maquiagem", description: "Cor vibrante para realçar seu visual.", image: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=700&q=80", stock: 12, isNew: false },
  { id: "p2", name: "Kit de maquiagem colorido", category: "Maquiagem", description: "Uma seleção prática para criar seu look.", image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=700&q=80", stock: 8, isNew: false },
  { id: "p3", name: "Máscara facial hidratante", category: "Skincare", description: "Seu pequeno ritual de autocuidado.", image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=700&q=80", stock: 9, isNew: true },
  { id: "p4", name: "Potes organizadores para alimentos", category: "Potes plásticos", description: "Recipientes práticos para guardar alimentos.", image: "https://images.unsplash.com/photo-1688366150258-bee7b2d02479?auto=format&fit=crop&w=700&q=80", stock: 15, isNew: false },
  { id: "p5", name: "Espátula de cozinha", category: "Cozinha", description: "Uma ajudinha versátil para suas receitas.", image: "https://images.unsplash.com/photo-1589983006655-4ef9a756ebe3?auto=format&fit=crop&w=700&q=80", stock: 10, isNew: false },
  { id: "p6", name: "Organizador de gaveta", category: "Utilidades domésticas", description: "Caixas práticas para manter a gaveta em ordem.", image: "https://images.unsplash.com/photo-1569820229202-fcd68422edf8?auto=format&fit=crop&w=700&q=80", stock: 6, isNew: true },
  { id: "p7", name: "Blocos de montar coloridos", category: "Brinquedos e jogos", description: "Peças coloridas para criar brincadeiras divertidas.", image: "https://images.unsplash.com/photo-1560961911-ba7ef651a56c?auto=format&fit=crop&w=700&q=80", stock: 7, isNew: false },
  { id: "p8", name: "Paleta de maquiagem compacta", category: "Maquiagem", description: "Cores para completar e renovar seu visual.", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=700&q=80", stock: 11, isNew: true },
  { id: "p9", name: "Necessaire com produtos de beleza", category: "Maquiagem", description: "Leve seus itens de beleza para onde for.", image: "https://images.unsplash.com/photo-1512206991021-e91d9403abfb?auto=format&fit=crop&w=700&q=80", stock: 5, isNew: false },
  { id: "p10", name: "Garrafa reutilizável", category: "Utilidades domésticas", description: "Uma garrafa prática para levar na rotina.", image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=700&q=80", stock: 0, isNew: false },
  { id: "p11", name: "Kit de pincéis de maquiagem", category: "Maquiagem", description: "Pincéis essenciais para sua produção.", image: "https://images.unsplash.com/photo-1507092183626-4e8793315843?auto=format&fit=crop&w=700&q=80", stock: 4, isNew: false },
  { id: "p12", name: "Jogo de cartas para família", category: "Brinquedos e jogos", description: "Um clássico para animar qualquer encontro.", image: "https://images.unsplash.com/photo-1531415505195-40f140d44392?auto=format&fit=crop&w=700&q=80", stock: 10, isNew: true }
];

function loadStored(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.error(`Não foi possível carregar ${key} do armazenamento local.`, error);
    return fallback;
  }
}

function saveStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Não foi possível salvar ${key} no armazenamento local.`, error);
    alert("Não foi possível salvar as alterações neste navegador. Verifique o espaço disponível e as permissões.");
  }
}

let products = starterProducts;
let databaseConnected = false;
let orderCompleted = false;
let cart = loadStored(CART_STORAGE_KEY, []);
if (!Array.isArray(cart)) {
  console.error("A sacola salva está inválida; iniciando uma sacola vazia.");
  cart = [];
}

const productGrid = document.querySelector("#product-grid");
const cartDrawer = document.querySelector("#cart-drawer");
const overlay = document.querySelector("#overlay");
const categoryFilter = document.querySelector("#category-filter");
const searchInput = document.querySelector("#search-input");
const searchForm = document.querySelector("#product-search");
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const databaseStatus = document.querySelector("#database-status");

async function apiRequest(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options && options.headers)
    }
  });
  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error(`O servidor respondeu com um formato inválido (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(result.error || `Falha na API (HTTP ${response.status}).`);
  }
  return result;
}

function showDatabaseStatus(message, isOffline) {
  databaseStatus.textContent = message;
  databaseStatus.classList.toggle("is-offline", isOffline);
  document.querySelector("#open-admin").disabled = isOffline;
}

async function refreshCatalog() {
  const result = await apiRequest("/api/products");
  if (!Array.isArray(result)) {
    throw new Error("O servidor retornou um catálogo inválido.");
  }
  products = result.map(product => ({
    ...product,
    stock: Number(product.stock),
    isNew: Boolean(product.isNew)
  }));
  databaseConnected = true;
  renderProducts();
  renderCart();
  renderAdminList();
  showDatabaseStatus("Catálogo conectado ao banco de dados SQLite.", false);
}

async function initializeCatalog() {
  try {
    await refreshCatalog();
  } catch (error) {
    databaseConnected = false;
    console.error("Não foi possível conectar ao banco de dados do catálogo.", error);
    showDatabaseStatus("Banco indisponível. Inicie o servidor local pelo PowerShell; o catálogo exibido é apenas demonstrativo.", true);
  }
}

async function saveProductToDatabase(product, id) {
  if (!databaseConnected) {
    throw new Error("O banco de dados está desconectado. Inicie o servidor do site antes de editar produtos.");
  }
  const path = id ? `/api/products/${encodeURIComponent(id)}` : "/api/products";
  await apiRequest(path, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(product)
  });
  await refreshCatalog();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function safeImageUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function normalizeSearchText(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function filteredProducts() {
  const query = normalizeSearchText(searchInput.value.trim()).split(/\s+/).filter(Boolean);
  const category = categoryFilter.value;
  return products.filter(product => {
    const matchesCategory = !category || (category === "Novidades" ? product.isNew : product.category === category);
    const text = normalizeSearchText(`${product.name} ${product.description} ${product.category}`);
    return matchesCategory && query.every(term => text.includes(term));
  });
}

function renderProducts() {
  const filtered = filteredProducts();
  document.querySelector("#result-count").textContent = `${filtered.length} ${filtered.length === 1 ? "achadinho" : "achadinhos"}`;
  document.querySelector("#empty-state").hidden = filtered.length !== 0;
  productGrid.innerHTML = filtered.map(product => {
    const image = safeImageUrl(product.image);
    return `<article class="product-card">
      <div class="product-photo">
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">` : ""}
        <span class="product-tag">${product.isNew ? "Novidade" : escapeHtml(product.category)}</span>
      </div>
      <div class="product-info">
        <p class="product-category">${escapeHtml(product.category)}</p>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-description">${escapeHtml(product.description)}</p>
        ${product.stock <= 0 ? '<p class="stock-note">Avise-me quando voltar</p>' : product.stock <= 3 ? `<p class="stock-note">Restam ${product.stock} unidades</p>` : ""}
        <div class="product-footer"><span class="product-price">R$ 10<small>,00</small></span><button class="add-button" data-add="${escapeHtml(product.id)}" type="button" aria-label="Adicionar ${escapeHtml(product.name)} à sacola" ${product.stock <= 0 ? "disabled" : ""}>+</button></div>
      </div>
    </article>`;
  }).join("");
}

function renderCart() {
  cart = cart.filter(item => products.some(product => product.id === item.id && product.stock > 0));
  cart = cart.map(item => {
    const product = products.find(entry => entry.id === item.id);
    return { ...item, quantity: Math.min(Math.max(1, Number(item.quantity) || 1), product.stock) };
  });
  saveStored(CART_STORAGE_KEY, cart);
  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
  document.querySelector("#cart-count").textContent = totalItems;
  document.querySelector("#drawer-count").textContent = `(${totalItems})`;
  document.querySelector("#cart-total").textContent = money.format(totalItems * PRICE);
  document.querySelector("#cart-summary").classList.toggle("is-hidden", cart.length === 0);
  document.querySelector("#cart-empty").classList.toggle("is-visible", cart.length === 0);
  document.querySelector("#cart-empty h3").textContent = orderCompleted ? "Sacola finalizada" : "Sua sacola está esperando";
  document.querySelector("#cart-empty p").textContent = orderCompleted
    ? "A sacola foi limpa neste navegador. O pedido não foi enviado à loja."
    : "Encontre seu próximo achadinho.";
  document.querySelector("#cart-items").innerHTML = cart.map(item => {
    const product = products.find(entry => entry.id === item.id);
    const image = safeImageUrl(product.image);
    return `<article class="cart-line">
      ${image ? `<img src="${escapeHtml(image)}" alt="">` : '<div></div>'}
      <div><h3>${escapeHtml(product.name)}</h3><p>${money.format(PRICE)} cada</p>
        <div class="quantity-control"><button data-quantity="${escapeHtml(product.id)}" data-change="-1" type="button" aria-label="Diminuir quantidade">−</button><span>${item.quantity}</span><button data-quantity="${escapeHtml(product.id)}" data-change="1" type="button" aria-label="Aumentar quantidade" ${item.quantity >= product.stock ? "disabled" : ""}>+</button></div>
      </div>
      <button class="remove-item" data-remove="${escapeHtml(product.id)}" type="button" aria-label="Remover ${escapeHtml(product.name)}">×</button>
    </article>`;
  }).join("");
}

function renderAdminList() {
  document.querySelector("#admin-product-list").innerHTML = products.map(product => `
    <div class="admin-product-row">
      <div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)} · ${money.format(PRICE)} · ${product.stock} em estoque</small></div>
      <div class="admin-row-actions"><label class="sr-only" for="stock-${escapeHtml(product.id)}">Estoque de ${escapeHtml(product.name)}</label><input id="stock-${escapeHtml(product.id)}" data-stock="${escapeHtml(product.id)}" type="number" min="0" step="1" value="${product.stock}" aria-label="Estoque de ${escapeHtml(product.name)}"><button data-edit="${escapeHtml(product.id)}" type="button">Editar</button><button class="delete-product" data-delete="${escapeHtml(product.id)}" type="button">Excluir</button></div>
    </div>`).join("");
}

function openCart() {
  renderCart();
  cartDrawer.classList.add("is-open");
  cartDrawer.setAttribute("aria-hidden", "false");
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeCart() {
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  document.body.style.overflow = "";
  if (orderCompleted) {
    orderCompleted = false;
    renderCart();
  }
}

function addToCart(id) {
  const product = products.find(item => item.id === id);
  if (!product || product.stock <= 0) return;
  const existing = cart.find(item => item.id === id);
  if (existing) {
    if (existing.quantity >= product.stock) {
      alert("Você já adicionou todo o estoque disponível deste produto.");
      return;
    }
    existing.quantity += 1;
  } else {
    cart.push({ id, quantity: 1 });
  }
  renderCart();
  const button = productGrid.querySelector(`[data-add="${CSS.escape(id)}"]`);
  if (button) {
    button.textContent = "✓";
    window.setTimeout(() => { if (button.isConnected) button.textContent = "+"; }, 900);
  }
}

function completeOrder() {
  if (cart.length === 0) return;
  cart = [];
  orderCompleted = true;
  renderCart();
}

let reviews = loadStored(REVIEW_STORAGE_KEY, starterReviews);
if (!Array.isArray(reviews)) reviews = starterReviews;
reviews = reviews.filter(review => !/^r[1-6]$/.test(String(review && review.id)));
if (reviews.length === 0) saveStored(REVIEW_STORAGE_KEY, []);
let reviewFilter = "all";

function renderReviewSummary() {
  const total = baseReviewStats.total + reviews.filter(review => !starterReviews.some(item => item.id === review.id)).length;
  const distribution = { ...baseReviewStats.distribution };
  reviews.forEach(review => {
    if (!starterReviews.some(item => item.id === review.id)) {
      const rating = Math.max(1, Math.min(5, Number(review.rating)));
      distribution[rating] = (distribution[rating] || 0) + 1;
    }
  });

  let weightedTotal = 0;
  Object.entries(distribution).forEach(([rating, count]) => {
    weightedTotal += Number(rating) * Number(count);
  });
  const average = (total ? weightedTotal / total : 0).toFixed(1).replace(".", ",");
  document.querySelector("#rating-average").textContent = average;
  document.querySelector("#rating-total").textContent = `Baseado em ${total} avaliações`;
  document.querySelector("#average-stars").setAttribute("aria-label", `Nota média: ${average} de 5`);

  document.querySelector("#rating-bars").innerHTML = [5, 4, 3, 2, 1].map(rating => {
    const count = distribution[rating] || 0;
    const percent = total ? Math.round((count / total) * 100) : 0;
    return `<div class="rating-bar"><span>${rating}</span><div class="rating-bar-track"><span style="width:${percent}%"></span></div><span>${percent}%</span></div>`;
  }).join("");
}

function renderReviews() {
  const visible = reviews.filter(review => {
    if (reviewFilter === "all") return true;
    if (reviewFilter === "2") return Number(review.rating) <= 2;
    return Number(review.rating) === Number(reviewFilter);
  });

  document.querySelector("#review-empty").hidden = visible.length !== 0;
  document.querySelector("#review-empty").textContent = reviews.length === 0
    ? "Ainda não há avaliações. Seja o primeiro a avaliar a Super10."
    : "Não encontramos avaliações com esta nota.";
  document.querySelector("#review-list").innerHTML = visible.map(review => {
    const safeName = escapeHtml(review.name);
    const initials = safeName.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
    return `<article class="review-card">
      <div class="review-card-header">
        <div class="review-author"><span class="review-avatar">${escapeHtml(initials)}</span><div><strong>${safeName}</strong><small>${escapeHtml(review.date || "Agora")}</small></div></div>
        <div class="stars" aria-label="${Number(review.rating)} de 5 estrelas">${"★".repeat(Number(review.rating))}${"☆".repeat(5 - Number(review.rating))}</div>
      </div>
      <blockquote>“${escapeHtml(review.text)}”</blockquote>
      <button class="helpful-button" type="button" data-helpful="${escapeHtml(review.id)}">♡ Esta avaliação foi útil · ${Number(review.helpful) || 0}</button>
    </article>`;
  }).join("");
  renderReviewSummary();
}

function resetProductForm() {
  document.querySelector("#product-form").reset();
  document.querySelector("#edit-id").value = "";
  document.querySelector("#admin-stock").value = 10;
  document.querySelector("#save-product").textContent = "Adicionar produto";
  document.querySelector("#cancel-edit").hidden = true;
}

function startEditingProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  document.querySelector("#edit-id").value = product.id;
  document.querySelector("#admin-name").value = product.name;
  document.querySelector("#admin-category").value = product.category;
  document.querySelector("#admin-description").value = product.description;
  document.querySelector("#admin-image").value = product.image;
  document.querySelector("#admin-stock").value = product.stock;
  document.querySelector("#save-product").textContent = "Salvar alterações";
  document.querySelector("#cancel-edit").hidden = false;
  document.querySelector("#admin-name").focus();
}

document.querySelector("#current-year").textContent = new Date().getFullYear();
renderProducts();
renderCart();
renderReviews();
initializeCatalog();

searchInput.addEventListener("input", renderProducts);
searchInput.addEventListener("focus", () => {
  if (window.matchMedia("(max-width: 740px)").matches) searchForm.classList.add("is-open");
});
searchForm.addEventListener("submit", event => {
  event.preventDefault();
  if (window.matchMedia("(max-width: 740px)").matches && !searchForm.classList.contains("is-open")) {
    searchForm.classList.add("is-open");
    searchInput.focus();
    return;
  }
  renderProducts();
  document.querySelector("#produtos").scrollIntoView({ behavior: "smooth" });
});
categoryFilter.addEventListener("change", renderProducts);
document.querySelector("#clear-filters").addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "";
  renderProducts();
});
document.querySelector("#category-list").addEventListener("click", event => {
  const category = event.target.closest("[data-category]")?.dataset.category;
  if (!category) return;
  categoryFilter.value = category;
  renderProducts();
  document.querySelector("#produtos").scrollIntoView({ behavior: "smooth" });
});
document.querySelector("[data-show-new]").addEventListener("click", () => {
  categoryFilter.value = "Novidades";
  renderProducts();
});

document.querySelector("#review-filter").addEventListener("click", event => {
  const button = event.target.closest("[data-rating]");
  if (!button) return;
  reviewFilter = button.dataset.rating;
  document.querySelectorAll("#review-filter button").forEach(item => item.classList.toggle("is-active", item === button));
  renderReviews();
});

document.querySelector("#review-list").addEventListener("click", event => {
  const button = event.target.closest("[data-helpful]");
  if (!button) return;
  const review = reviews.find(item => item.id === button.dataset.helpful);
  if (!review) return;
  review.helpful = (Number(review.helpful) || 0) + 1;
  saveStored(REVIEW_STORAGE_KEY, reviews);
  renderReviews();
});

const reviewDialog = document.querySelector("#review-dialog");
document.querySelector("#open-review").addEventListener("click", () => {
  reviewDialog.showModal();
  document.querySelector("#review-text").focus();
});
document.querySelector("#close-review").addEventListener("click", () => reviewDialog.close());
document.querySelector("#cancel-review").addEventListener("click", () => reviewDialog.close());
reviewDialog.addEventListener("click", event => {
  if (event.target === reviewDialog) reviewDialog.close();
});

document.querySelector("#star-picker").addEventListener("change", event => {
  const labels = [...document.querySelectorAll("#star-picker label")];
  const selected = Number(event.target.value);
  labels.forEach(label => {
    label.classList.toggle("is-selected", Number(label.querySelector("input").value) <= selected);
  });
});

document.querySelectorAll("#star-picker label").forEach(label => {
  label.addEventListener("mouseenter", () => {
    const preview = Number(label.querySelector("input").value);
    document.querySelectorAll("#star-picker label").forEach(item => {
      item.classList.toggle("is-preview", Number(item.querySelector("input").value) <= preview);
    });
  });
  label.addEventListener("mouseleave", () => {
    document.querySelectorAll("#star-picker label").forEach(item => item.classList.remove("is-preview"));
  });
});

document.querySelector("#review-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const rating = Number(form.get("rating"));
  const text = String(form.get("text")).trim();
  if (!rating || !text) return;

  reviews.unshift({
    id: `r-${Date.now()}`,
    name: "Cliente anônimo",
    rating,
    text,
    date: "Agora",
    helpful: 0
  });
  saveStored(REVIEW_STORAGE_KEY, reviews);
  reviewFilter = "all";
  document.querySelectorAll("#review-filter button").forEach(button => button.classList.toggle("is-active", button.dataset.rating === "all"));
  document.querySelectorAll("#star-picker label").forEach(label => label.classList.remove("is-selected"));
  event.currentTarget.reset();
  renderReviews();
  reviewDialog.close();
});

productGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");
  if (button) addToCart(button.dataset.add);
});
document.querySelector("#cart-items").addEventListener("click", event => {
  const quantityButton = event.target.closest("[data-quantity]");
  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    cart = cart.filter(item => item.id !== removeButton.dataset.remove);
    renderCart();
  } else if (quantityButton) {
    const item = cart.find(entry => entry.id === quantityButton.dataset.quantity);
    const product = products.find(entry => entry.id === quantityButton.dataset.quantity);
    if (!item || !product) return;
    item.quantity = Math.min(product.stock, item.quantity + Number(quantityButton.dataset.change));
    if (item.quantity <= 0) cart = cart.filter(entry => entry.id !== item.id);
    renderCart();
  }
});
document.querySelector("#open-cart").addEventListener("click", openCart);
document.querySelectorAll("[data-close-drawer], #continue-shopping").forEach(button => button.addEventListener("click", closeCart));
overlay.addEventListener("click", closeCart);
document.querySelector("#checkout-button").addEventListener("click", () => {
  completeOrder();
});

const adminDialog = document.querySelector("#admin-dialog");
document.querySelector("#open-admin").addEventListener("click", () => {
  renderAdminList();
  adminDialog.showModal();
});
document.querySelector("#close-admin").addEventListener("click", () => adminDialog.close());
adminDialog.addEventListener("click", event => {
  if (event.target === adminDialog) adminDialog.close();
});
document.querySelector("#cancel-edit").addEventListener("click", resetProductForm);
document.querySelector("#product-form").addEventListener("submit", async event => {
  event.preventDefault();
  const id = document.querySelector("#edit-id").value;
  const imageField = document.querySelector("#admin-image").value.trim();
  const product = {
    name: document.querySelector("#admin-name").value.trim(),
    category: document.querySelector("#admin-category").value,
    description: document.querySelector("#admin-description").value.trim(),
    image: safeImageUrl(imageField) || "https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?auto=format&fit=crop&w=700&q=80",
    stock: Math.max(0, Math.floor(Number(document.querySelector("#admin-stock").value))),
    isNew: !id
  };
  if (id) {
    const oldProduct = products.find(item => item.id === id);
    if (oldProduct) product.isNew = oldProduct.isNew;
  }
  const submitButton = document.querySelector("#save-product");
  submitButton.disabled = true;
  try {
    await saveProductToDatabase(product, id);
    resetProductForm();
  } catch (error) {
    console.error("Não foi possível salvar o produto no banco de dados.", error);
    alert(error.message);
  } finally {
    submitButton.disabled = false;
  }
});
document.querySelector("#admin-product-list").addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) startEditingProduct(editButton.dataset.edit);
  if (deleteButton) {
    const product = products.find(item => item.id === deleteButton.dataset.delete);
    if (!product || !window.confirm(`Remover "${product.name}" do catálogo?`)) return;
    deleteButton.disabled = true;
    try {
      await apiRequest(`/api/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
      cart = cart.filter(item => item.id !== product.id);
      await refreshCatalog();
    } catch (error) {
      console.error("Não foi possível remover o produto do banco de dados.", error);
      alert(error.message);
      deleteButton.disabled = false;
    }
  }
});
document.querySelector("#admin-product-list").addEventListener("change", async event => {
  const input = event.target.closest("[data-stock]");
  if (!input) return;
  const stock = Math.max(0, Math.floor(Number(input.value) || 0));
  const product = products.find(item => item.id === input.dataset.stock);
  if (!product) return;
  input.disabled = true;
  try {
    await saveProductToDatabase({ ...product, stock }, product.id);
  } catch (error) {
    console.error("Não foi possível atualizar o estoque no banco de dados.", error);
    alert(error.message);
    input.disabled = false;
  }
});

const menuToggle = document.querySelector(".menu-toggle");
menuToggle.addEventListener("click", () => {
  const isOpen = document.querySelector(".main-nav").classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
});
document.querySelectorAll(".main-nav a").forEach(link => link.addEventListener("click", () => {
  document.querySelector(".main-nav").classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir menu");
}));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && cartDrawer.classList.contains("is-open")) closeCart();
});
