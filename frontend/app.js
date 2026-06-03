// API-Konfiguration
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : `http://${window.location.hostname}:3000`;

let kitchenPassword = null; // Gespeichertes Passwort für Koch-Ansicht

const state = {
  menu: null,
  activeCategory: null,
  cart: [],
  orders: [],
  soldOut: {}
};

const elements = {
  guestView: document.querySelector("#guestView"),
  cartView: document.querySelector("#cartView"),
  kitchenView: document.querySelector("#kitchenView"),
  viewToggle: document.querySelector("#viewToggle"),
  backToGuestButton: document.querySelector("#backToGuestButton"),
  backToMenuButton: document.querySelector("#backToMenuButton"),
  cartFab: document.querySelector("#cartFab"),
  cartCount: document.querySelector("#cartCount"),
  categoryTabs: document.querySelector("#categoryTabs"),
  menuGrid: document.querySelector("#menuGrid"),
  cartList: document.querySelector("#cartList"),
  cartTotal: document.querySelector("#cartTotal"),
  clearCartButton: document.querySelector("#clearCartButton"),
  orderForm: document.querySelector("#orderForm"),
  guestName: document.querySelector("#guestName"),
  submitOrderButton: document.querySelector("#submitOrderButton"),
  ordersList: document.querySelector("#ordersList"),
  stockList: document.querySelector("#stockList"),
  deleteOrdersButton: document.querySelector("#deleteOrdersButton"),
  toast: document.querySelector("#toast"),
  customPizzaTemplate: document.querySelector("#customPizzaTemplate")
};

const currency = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

// UUID-Generierung (Fallback für ältere Browser oder HTTP)
function generateUUID() {
  // Versuche crypto.randomUUID() zu nutzen
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback: Generiere UUID v4 manuell
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// API-Hilfsfunktionen
async function apiCall(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Netzwerkfehler' }));
      throw new Error(error.message || error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API-Fehler bei ${endpoint}:`, error);
    throw error;
  }
}

async function apiCallWithAuth(endpoint, options = {}) {
  if (!kitchenPassword) {
    kitchenPassword = prompt('Bitte Passwort für Koch-Ansicht eingeben:');
    if (!kitchenPassword) {
      throw new Error('Passwort erforderlich');
    }
  }

  try {
    const auth = btoa(`:${kitchenPassword}`);
    return await apiCall(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Basic ${auth}`
      }
    });
  } catch (error) {
    if (error.message.includes('Passwort') || error.message.includes('401') || error.message.includes('403')) {
      kitchenPassword = null; // Passwort zurücksetzen bei Fehler
      showToast('Ungültiges Passwort. Bitte erneut versuchen.');
      throw new Error('Authentifizierung fehlgeschlagen');
    }
    throw error;
  }
}

async function init() {
  try {
    // Menü vom Backend laden
    state.menu = await apiCall('/api/menu');
    state.activeCategory = state.menu.categories[0]?.id || null;

    // Ausverkauft-Status laden
    state.soldOut = await apiCall('/api/soldout');

    bindEvents();
    applyInitialView();
    render();
  } catch (error) {
    elements.menuGrid.innerHTML = `<p class="empty-state">Fehler beim Laden: ${error.message}</p>`;
  }
}

function bindEvents() {
  elements.viewToggle.addEventListener("click", () => setView(isKitchenView() ? "guest" : "kitchen"));
  elements.backToGuestButton.addEventListener("click", () => setView("guest"));
  elements.backToMenuButton.addEventListener("click", () => setView("guest"));
  elements.cartFab.addEventListener("click", () => setView("cart"));
  elements.clearCartButton.addEventListener("click", () => {
    state.cart = [];
    renderCart();
  });

  elements.orderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitOrder();
  });

  elements.deleteOrdersButton.addEventListener("click", async () => {
    if (!state.orders.length || !confirm("Alle Bestellungen wirklich loeschen?")) {
      return;
    }

    try {
      await apiCallWithAuth('/api/orders', { method: 'DELETE' });
      state.orders = [];
      renderKitchen();
      showToast("Alle Bestellungen wurden geloescht.");
    } catch (error) {
      if (error.message !== 'Authentifizierung fehlgeschlagen') {
        showToast(`Fehler: ${error.message}`);
      }
    }
  });

  window.addEventListener("popstate", applyInitialView);
}

function applyInitialView() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  setView(["cart", "kitchen"].includes(requestedView) ? requestedView : "guest", false);
}

async function setView(view, updateUrl = true) {
  const cart = view === "cart";
  const kitchen = view === "kitchen";
  elements.guestView.hidden = cart || kitchen;
  elements.cartView.hidden = !cart;
  elements.kitchenView.hidden = !kitchen;
  elements.cartFab.hidden = kitchen || cart;
  elements.viewToggle.setAttribute("aria-label", kitchen ? "Zur Gastansicht wechseln" : "Zur Kochansicht wechseln");

  if (updateUrl) {
    const nextUrl = getViewUrl(view);
    history.pushState({}, "", nextUrl);
  }

  // Bestellungen nur in Koch-Ansicht laden
  if (kitchen) {
    try {
      state.orders = await apiCallWithAuth('/api/orders');
    } catch (error) {
      if (error.message === 'Authentifizierung fehlgeschlagen') {
        // Zurück zur Gastansicht wenn Authentifizierung fehlschlägt
        setView('guest');
        return;
      }
      console.error('Fehler beim Laden der Bestellungen:', error);
      state.orders = [];
    }
  }

  render();
}

function isKitchenView() {
  return !elements.kitchenView.hidden;
}

function render() {
  if (!state.menu) {
    return;
  }

  renderCategories();
  renderMenu();
  renderCart();
  renderKitchen();
}

function renderCategories() {
  elements.categoryTabs.innerHTML = state.menu.categories.map((category) => `
    <button
      class="tab-button ${category.id === state.activeCategory ? "is-active" : ""}"
      type="button"
      data-category="${category.id}"
      aria-pressed="${category.id === state.activeCategory}"
    >
      ${escapeHtml(category.name)}
    </button>
  `).join("");

  elements.categoryTabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCategory = button.dataset.category;
      renderCategories();
      renderMenu();
    });
  });
}

function renderMenu() {
  const category = state.menu.categories.find((entry) => entry.id === state.activeCategory);
  const items = category?.items || [];

  elements.menuGrid.innerHTML = items.map((item) => {
    const soldOut = isSoldOut(item);
    const ingredientText = item.ingredients?.length ? item.ingredients.join(", ") : "Keine Zutaten angegeben";
    const freePrice = renderDiscountPrice(getItemPrice(item));

    return `
      <article class="menu-card ${soldOut ? "is-sold-out" : ""}">
        <div class="card-main">
          <div>
            <p class="card-kicker">${soldOut ? "Ausverkauft" : "Verfuegbar"}</p>
            <h3>${escapeHtml(item.name)}</h3>
          </div>
          <span class="price-pill">${freePrice}</span>
        </div>
        <p>${escapeHtml(item.description || "")}</p>
        <p class="ingredients">${escapeHtml(ingredientText)}</p>
        <div class="card-actions">
          ${item.customizable ? `<button class="secondary-button" type="button" data-custom="${item.id}" ${soldOut ? "disabled" : ""}>Zutaten waehlen</button>` : ""}
          <button class="primary-button" type="button" data-add="${item.id}" ${soldOut ? "disabled" : ""}>
            ${soldOut ? "Nicht bestellbar" : "Hinzufuegen"}
          </button>
        </div>
        ${item.customizable ? `<div class="custom-target" id="custom-${item.id}"></div>` : ""}
      </article>
    `;
  }).join("");

  elements.menuGrid.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = findItem(button.dataset.add);
      if (item?.customizable) {
        showCustomPizzaForm(item);
        return;
      }
      addToCart(createCartItem(item));
    });
  });

  elements.menuGrid.querySelectorAll("[data-custom]").forEach((button) => {
    button.addEventListener("click", () => showCustomPizzaForm(findItem(button.dataset.custom)));
  });
}

function showCustomPizzaForm(item) {
  const target = document.querySelector(`#custom-${item.id}`);
  if (!target || target.childElementCount) {
    target.innerHTML = "";
    return;
  }

  const fragment = elements.customPizzaTemplate.content.cloneNode(true);
  const form = fragment.querySelector("form");
  const list = fragment.querySelector(".ingredient-list");
  const baseIngredients = new Set(item.ingredients || []);

  list.innerHTML = state.menu.ingredients.map((ingredient) => {
    const checked = baseIngredients.has(ingredient) ? "checked" : "";
    const disabled = baseIngredients.has(ingredient) ? "disabled" : "";
    return `
      <label class="check-row">
        <input type="checkbox" value="${escapeHtml(ingredient)}" ${checked} ${disabled}>
        <span>${escapeHtml(ingredient)}</span>
      </label>
    `;
  }).join("");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = [...form.querySelectorAll("input:checked")].map((input) => input.value);
    const extras = selected.filter((ingredient) => !baseIngredients.has(ingredient));
    const price = item.price + extras.length * (item.pricePerExtraIngredient || 0);

    addToCart(createCartItem(item, {
      name: `${item.name} (${selected.join(", ")})`,
      price,
      ingredients: selected
    }));
    target.innerHTML = "";
  });

  target.append(fragment);
}

function addToCart(cartItem) {
  state.cart.push(cartItem);
  renderCart();
  showToast(`${cartItem.baseName} wurde hinzugefuegt.`);
}

function createCartItem(item, override = {}) {
  return {
    id: generateUUID(),
    menuId: item.id,
    baseName: item.name,
    name: override.name || item.name,
    price: override.price ?? getItemPrice(item),
    finalPrice: 0,
    ingredients: override.ingredients || item.ingredients || []
  };
}

function renderCart() {
  elements.cartCount.textContent = String(state.cart.length);
  elements.cartFab.setAttribute("aria-label", `Warenkorb oeffnen, ${state.cart.length} Artikel`);

  if (!state.cart.length) {
    elements.cartList.innerHTML = `<p class="empty-state">Noch nichts im Warenkorb.</p>`;
  } else {
    elements.cartList.innerHTML = state.cart.map((item) => `
      <div class="cart-item">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span class="cart-price">${renderDiscountPrice(item.price)}</span>
        </div>
        <button class="icon-button small" type="button" data-remove="${item.id}" aria-label="${escapeHtml(item.name)} entfernen">×</button>
      </div>
    `).join("");
  }

  elements.cartTotal.textContent = currency.format(state.cart.reduce((sum, item) => sum + item.price, 0));
  elements.submitOrderButton.disabled = !state.cart.length;

  elements.cartList.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      state.cart = state.cart.filter((item) => item.id !== button.dataset.remove);
      renderCart();
    });
  });
}

async function submitOrder() {
  const guestName = elements.guestName.value.trim();
  if (!guestName) {
    elements.guestName.focus();
    showToast("Bitte einen Namen eingeben.");
    return;
  }

  if (!state.cart.length) {
    showToast("Der Warenkorb ist leer.");
    return;
  }

  const order = {
    guestName,
    totalBeforeDiscount: state.cart.reduce((sum, item) => sum + item.price, 0),
    totalAfterDiscount: 0,
    items: state.cart.map(({ id, ...item }) => item)
  };

  try {
    await apiCall('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order)
    });

    state.cart = [];
    elements.orderForm.reset();
    renderCart();
    setView("guest");
    showToast("Bestellung gespeichert. Guten Appetit!");
  } catch (error) {
    showToast(`Fehler beim Speichern: ${error.message}`);
  }
}

function renderKitchen() {
  if (!state.menu) {
    return;
  }

  renderOrders();
  renderStockList();
}

function renderOrders() {
  if (!state.orders.length) {
    elements.ordersList.innerHTML = `<p class="empty-state">Noch keine Bestellungen eingegangen.</p>`;
    return;
  }

  elements.ordersList.innerHTML = state.orders.map((order) => {
    const date = new Date(order.createdAt);
    const items = order.items.map((item) => `<li>${escapeHtml(item.name)}</li>`).join("");

    return `
      <article class="order-card ${order.status === "done" ? "is-done" : ""}">
        <div class="card-main">
          <div>
            <p class="card-kicker">${order.status === "done" ? "Erledigt" : "Offen"}</p>
            <h3>${escapeHtml(order.guestName)}</h3>
          </div>
          <span class="price-pill">${date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
        </div>
        <ul>${items}</ul>
        <p class="ingredients">Originalsumme ${currency.format(order.totalBeforeDiscount)} · bezahlt 0,00 €</p>
        <button class="primary-button" type="button" data-status="${order.id}">
          ${order.status === "done" ? "Wieder oeffnen" : "Als erledigt markieren"}
        </button>
      </article>
    `;
  }).join("");

  elements.ordersList.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const order = state.orders.find((entry) => entry.id === button.dataset.status);
      const newStatus = order.status === "done" ? "open" : "done";

      try {
        await apiCallWithAuth(`/api/orders/${order.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus })
        });
        order.status = newStatus;
        renderOrders();
      } catch (error) {
        if (error.message !== 'Authentifizierung fehlgeschlagen') {
          showToast(`Fehler: ${error.message}`);
        }
      }
    });
  });
}

function renderStockList() {
  const rows = state.menu.categories.flatMap((category) => category.items.map((item) => ({ category, item })));

  elements.stockList.innerHTML = rows.map(({ category, item }) => `
    <label class="stock-row">
      <span>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(category.name)}</small>
      </span>
      <input type="checkbox" data-sold-out="${item.id}" ${isSoldOut(item) ? "checked" : ""}>
    </label>
  `).join("");

  elements.stockList.querySelectorAll("[data-sold-out]").forEach((input) => {
    input.addEventListener("change", async () => {
      state.soldOut[input.dataset.soldOut] = input.checked;
      
      try {
        await apiCallWithAuth('/api/soldout', {
          method: 'PUT',
          body: JSON.stringify(state.soldOut)
        });
        renderMenu();
        renderStockList();
      } catch (error) {
        if (error.message !== 'Authentifizierung fehlgeschlagen') {
          showToast(`Fehler: ${error.message}`);
        }
        // Status zurücksetzen bei Fehler
        state.soldOut[input.dataset.soldOut] = !input.checked;
        input.checked = !input.checked;
      }
    });
  });
}

function getViewUrl(view) {
  const url = new URL(window.location.href);
  if (view === "guest") {
    url.searchParams.delete("view");
  } else {
    url.searchParams.set("view", view);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function findItem(id) {
  return state.menu.categories.flatMap((category) => category.items).find((item) => item.id === id);
}

function isSoldOut(item) {
  return state.soldOut[item.id] ?? Boolean(item.soldOut);
}

function getItemPrice(item) {
  return Number(item.price || 0);
}

function renderDiscountPrice(price) {
  return `
    <span class="old-price">${currency.format(price)}</span>
    <span class="new-price">0,00 €</span>
  `;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 3200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
