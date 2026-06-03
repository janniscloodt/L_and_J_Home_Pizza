const STORAGE_KEYS = {
  orders: "pizzaHome.orders",
  soldOut: "pizzaHome.soldOut"
};

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

async function init() {
  state.orders = readStorage(STORAGE_KEYS.orders, []);
  state.soldOut = readStorage(STORAGE_KEYS.soldOut, {});

  try {
    const response = await fetch("menu.json");
    if (!response.ok) {
      throw new Error("Menue konnte nicht geladen werden.");
    }

    state.menu = await response.json();
    state.activeCategory = state.menu.categories[0]?.id || null;
    bindEvents();
    applyInitialView();
    render();
  } catch (error) {
    elements.menuGrid.innerHTML = `<p class="empty-state">${error.message}</p>`;
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

  elements.deleteOrdersButton.addEventListener("click", () => {
    if (!state.orders.length || !confirm("Alle Bestellungen wirklich loeschen?")) {
      return;
    }

    state.orders = [];
    writeStorage(STORAGE_KEYS.orders, state.orders);
    renderKitchen();
    showToast("Alle Bestellungen wurden geloescht.");
  });

  window.addEventListener("popstate", applyInitialView);
}

function applyInitialView() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  setView(["cart", "kitchen"].includes(requestedView) ? requestedView : "guest", false);
}

function setView(view, updateUrl = true) {
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
    id: crypto.randomUUID(),
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

function submitOrder() {
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
    id: crypto.randomUUID(),
    guestName,
    createdAt: new Date().toISOString(),
    status: "open",
    totalBeforeDiscount: state.cart.reduce((sum, item) => sum + item.price, 0),
    totalAfterDiscount: 0,
    items: state.cart.map(({ id, ...item }) => item)
  };

  state.orders.unshift(order);
  writeStorage(STORAGE_KEYS.orders, state.orders);
  state.cart = [];
  elements.orderForm.reset();
  renderCart();
  renderKitchen();
  setView("guest");
  showToast("Bestellung gespeichert. Guten Appetit!");
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
    button.addEventListener("click", () => {
      const order = state.orders.find((entry) => entry.id === button.dataset.status);
      order.status = order.status === "done" ? "open" : "done";
      writeStorage(STORAGE_KEYS.orders, state.orders);
      renderOrders();
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
    input.addEventListener("change", () => {
      state.soldOut[input.dataset.soldOut] = input.checked;
      writeStorage(STORAGE_KEYS.soldOut, state.soldOut);
      renderMenu();
      renderStockList();
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

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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
