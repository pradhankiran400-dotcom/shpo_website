document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------
    // STATE MANAGEMENT
    // ----------------------------------------------------
    let cart = [];

    // Load cart from localStorage
    function loadCart() {
        const storedCart = localStorage.getItem("mb_rice_store_cart");
        if (storedCart) {
            try {
                cart = JSON.parse(storedCart);
            } catch (e) {
                console.error("Error parsing cart storage:", e);
                cart = [];
            }
        } else {
            cart = [];
        }
    }

    // Save cart to localStorage
    function saveCart() {
        localStorage.setItem("mb_rice_store_cart", JSON.stringify(cart));
    }

    // ----------------------------------------------------
    // CORE UI UPDATE FUNCTIONS
    // ----------------------------------------------------

    // Update Header Badge and Cart Count Titles
    function updateCartStats() {
        const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        // Update header badge
        const badge = document.getElementById("cart-badge-count");
        if (badge) {
            badge.innerText = totalItemsCount;
            // Play a small pop animation
            badge.classList.remove("pop-badge");
            void badge.offsetWidth; // Trigger reflow
            badge.classList.add("pop-badge");
        }

        // Update cart drawer header title count
        const cartCountTitle = document.getElementById("cart-count-title");
        if (cartCountTitle) {
            cartCountTitle.innerText = `${totalItemsCount} ${totalItemsCount === 1 ? 'item' : 'items'}`;
        }
    }

    // Synchronize Card ADD Buttons with Cart Quantities
    function syncCardButtons() {
        const actionContainers = document.querySelectorAll(".product-action-container");
        
        actionContainers.forEach(container => {
            const productId = parseInt(container.getAttribute("data-id"));
            const name = container.getAttribute("data-name");
            const price = parseFloat(container.getAttribute("data-price"));
            const image = container.getAttribute("data-image");
            const unit = container.getAttribute("data-unit");

            const cartItem = cart.find(item => item.id === productId);
            const parentCard = container.closest(".product-card");

            if (cartItem && cartItem.quantity > 0) {
                // Item is in cart -> Render Swiggy style - Qty + controller
                container.innerHTML = `
                    <div class="card-qty-controller">
                        <button class="card-qty-btn decrease-card-qty" data-id="${productId}">-</button>
                        <span class="card-qty-val">${cartItem.quantity}</span>
                        <button class="card-qty-btn increase-card-qty" data-id="${productId}">+</button>
                    </div>
                `;
                if (parentCard) {
                    parentCard.classList.add("in-cart-border");
                }
            } else {
                // Item not in cart -> Render default Add button
                container.innerHTML = `
                    <button class="add-to-cart-btn">
                        <i data-lucide="plus"></i>
                        <span>Add</span>
                    </button>
                `;
                if (parentCard) {
                    parentCard.classList.remove("in-cart-border");
                }
            }
        });

        // Reinitialize dynamic Lucide icons for new elements
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // Render the Cart Drawer Details
    function updateCartDrawer() {
        const cartEmptyState = document.getElementById("cart-empty");
        const cartItemsList = document.getElementById("cart-items-container");
        const cartFooterView = document.getElementById("cart-footer-view");
        
        updateCartStats();

        if (cart.length === 0) {
            // Show empty cart view
            if (cartEmptyState) cartEmptyState.style.display = "flex";
            if (cartItemsList) cartItemsList.style.display = "none";
            if (cartFooterView) cartFooterView.style.display = "none";
            return;
        }

        // Show cart list and footer
        if (cartEmptyState) cartEmptyState.style.display = "none";
        if (cartItemsList) {
            cartItemsList.style.display = "flex";
            cartItemsList.innerHTML = ""; // Clear existing

            // Populate cart items
            cart.forEach(item => {
                const itemTotal = (item.price * item.quantity).toFixed(2);
                const itemHTML = `
                    <div class="cart-item">
                        <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                        <div class="cart-item-details">
                            <div class="cart-item-title">${item.name}</div>
                            <div class="cart-item-price-desc">₹${item.price.toFixed(2)} / ${item.unit}</div>
                            <div class="cart-item-controls">
                                <div class="quantity-controller">
                                    <button class="qty-btn decrease-drawer-qty" data-id="${item.id}">
                                        <i data-lucide="minus"></i>
                                    </button>
                                    <span class="qty-val">${item.quantity}</span>
                                    <button class="qty-btn increase-drawer-qty" data-id="${item.id}">
                                        <i data-lucide="plus"></i>
                                    </button>
                                </div>
                                <span class="cart-item-total">₹${itemTotal}</span>
                                <button class="remove-item-btn" data-id="${item.id}">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                cartItemsList.insertAdjacentHTML("beforeend", itemHTML);
            });

            // Re-render Lucide icons inside the drawer list
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }

        // Calculate pricing totals
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const subtotalElement = document.getElementById("cart-subtotal");
        const totalElement = document.getElementById("cart-total");

        if (subtotalElement) subtotalElement.innerText = subtotal.toFixed(2);
        if (totalElement) totalElement.innerText = subtotal.toFixed(2); // Store Delivery is FREE

        if (cartFooterView) cartFooterView.style.display = "block";
    }

    // Master UI syncing pipeline
    function syncAllUI() {
        saveCart();
        syncCardButtons();
        updateCartDrawer();
    }

    // ----------------------------------------------------
    // CART MUTATION OPERATIONS
    // ----------------------------------------------------

    // Add item to cart
    function addToCart(id, name, price, image, unit) {
        const existingItem = cart.find(item => item.id === id);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: id,
                name: name,
                price: price,
                image: image,
                unit: unit,
                quantity: 1
            });
        }

        showToast(`Added ${name} to your basket! 🌾`);
        syncAllUI();
    }

    // Update quantity of a cart item
    function updateItemQuantity(id, delta) {
        const item = cart.find(item => item.id === id);
        if (!item) return;

        item.quantity += delta;
        if (item.quantity <= 0) {
            // Remove item
            cart = cart.filter(cartItem => cartItem.id !== id);
            showToast(`Removed ${item.name} from basket`);
        }
        syncAllUI();
    }

    // Completely remove item from cart
    function removeItem(id) {
        const item = cart.find(item => item.id === id);
        if (item) {
            cart = cart.filter(cartItem => cartItem.id !== id);
            showToast(`Removed ${item.name}`);
        }
        syncAllUI();
    }

    // ----------------------------------------------------
    // TOAST NOTIFICATIONS
    // ----------------------------------------------------
    let toastTimeout;
    function showToast(message) {
        const toast = document.getElementById("toast-notify");
        const toastMsg = document.getElementById("toast-message");

        if (toast && toastMsg) {
            toastMsg.innerText = message;
            toast.classList.add("active");

            // Clear previous timeouts if rapidly clicking
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                toast.classList.remove("active");
            }, 2500);
        }
    }

    // ----------------------------------------------------
    // DELEGATED CLICK LISTENERS (Cards & Drawer Actions)
    // ----------------------------------------------------

    // Grid interaction delegation
    const grid = document.getElementById("products-grid");
    if (grid) {
        grid.addEventListener("click", (e) => {
            // Find parent action container
            const container = e.target.closest(".product-action-container");
            if (!container) return;

            const id = parseInt(container.getAttribute("data-id"));
            const name = container.getAttribute("data-name");
            const price = parseFloat(container.getAttribute("data-price"));
            const image = container.getAttribute("data-image");
            const unit = container.getAttribute("data-unit");

            // Case 1: Clicked default ADD button
            if (e.target.closest(".add-to-cart-btn")) {
                addToCart(id, name, price, image, unit);
                return;
            }

            // Case 2: Clicked increase (+) inside card controller
            if (e.target.classList.contains("increase-card-qty")) {
                updateItemQuantity(id, 1);
                return;
            }

            // Case 3: Clicked decrease (-) inside card controller
            if (e.target.classList.contains("decrease-card-qty")) {
                updateItemQuantity(id, -1);
                return;
            }
        });
    }

    // Drawer list interaction delegation
    const drawerList = document.getElementById("cart-items-container");
    if (drawerList) {
        drawerList.addEventListener("click", (e) => {
            const btn = e.target.closest("button");
            if (!btn) return;

            const id = parseInt(btn.getAttribute("data-id"));

            if (btn.classList.contains("increase-drawer-qty")) {
                updateItemQuantity(id, 1);
            } else if (btn.classList.contains("decrease-drawer-qty")) {
                updateItemQuantity(id, -1);
            } else if (btn.classList.contains("remove-item-btn")) {
                removeItem(id);
            }
        });
    }

    // ----------------------------------------------------
    // CART DRAWER DYNAMICS (Toggle & Overlay)
    // ----------------------------------------------------
    const cartToggle = document.getElementById("cart-toggle");
    const closeCart = document.getElementById("close-cart");
    const startShoppingBtn = document.getElementById("start-shopping");
    const cartOverlay = document.getElementById("cart-overlay");
    const cartDrawer = document.getElementById("cart-drawer");

    function openCartDrawer() {
        if (cartDrawer && cartOverlay) {
            cartDrawer.classList.add("active");
            cartOverlay.classList.add("active");
            document.body.style.overflow = "hidden"; // Prevent background scroll
        }
    }

    function closeCartDrawer() {
        if (cartDrawer && cartOverlay) {
            cartDrawer.classList.remove("active");
            cartOverlay.classList.remove("active");
            document.body.style.overflow = ""; // Restore background scroll
        }
    }

    if (cartToggle) cartToggle.addEventListener("click", openCartDrawer);
    if (closeCart) closeCart.addEventListener("click", closeCartDrawer);
    if (cartOverlay) cartOverlay.addEventListener("click", closeCartDrawer);
    if (startShoppingBtn) startShoppingBtn.addEventListener("click", closeCartDrawer);

    // ----------------------------------------------------
    // LIVE SEARCH & CATEGORY FILTER STYLES
    // ----------------------------------------------------
    const searchInput = document.getElementById("search-input");
    const filterTabs = document.querySelectorAll(".filter-tab");
    const clearSearchBtn = document.getElementById("clear-search-btn");
    const noResultsView = document.getElementById("no-results-view");

    let currentCategory = "all";
    let searchQuery = "";

    function filterProducts() {
        const productCards = document.querySelectorAll(".product-card");
        let visibleCount = 0;

        productCards.forEach(card => {
            const cardCategory = card.getAttribute("data-category").toLowerCase();
            const cardName = card.getAttribute("data-name").toLowerCase();

            const matchesCategory = (currentCategory === "all" || cardCategory === currentCategory);
            const matchesSearch = cardName.includes(searchQuery);

            if (matchesCategory && matchesSearch) {
                card.style.display = "flex";
                visibleCount++;
            } else {
                card.style.display = "none";
            }
        });

        // Show/Hide Empty State search results
        if (noResultsView) {
            if (visibleCount === 0) {
                noResultsView.style.display = "block";
            } else {
                noResultsView.style.display = "none";
            }
        }
    }

    // Category Tabs click handler
    filterTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            filterTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            currentCategory = tab.getAttribute("data-category").toLowerCase();
            filterProducts();
        });
    });

    // Search bar live handler
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            filterProducts();
        });
    }

    // Clear search empty state action
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            searchQuery = "";
            currentCategory = "all";
            
            filterTabs.forEach(t => {
                if (t.getAttribute("data-category") === "all") {
                    t.classList.add("active");
                } else {
                    t.classList.remove("active");
                }
            });

            filterProducts();
        });
    }

    // ----------------------------------------------------
    // CHECKOUT MODAL AND BILLING PROCESS
    // ----------------------------------------------------
    const checkoutBtn = document.getElementById("checkout-btn");
    const checkoutModal = document.getElementById("checkout-modal");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const modalItemsContainer = document.getElementById("modal-order-items");
    const modalTotalPrice = document.getElementById("modal-total-price");

    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
            if (cart.length === 0) {
                showToast("Your basket is empty!");
                return;
            }

            // Close the cart drawer
            closeCartDrawer();

            // Populate checkout modal billing breakdown
            if (modalItemsContainer) {
                modalItemsContainer.innerHTML = "";
                cart.forEach(item => {
                    const row = `
                        <div class="summary-item">
                            <span>${item.name} <strong>x ${item.quantity}</strong></span>
                            <span>₹${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    `;
                    modalItemsContainer.insertAdjacentHTML("beforeend", row);
                });
            }

            // Set final price
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            if (modalTotalPrice) {
                modalTotalPrice.innerText = subtotal.toFixed(2);
            }

            // Clear the cart
            cart = [];
            syncAllUI();

            // Show Checkout Modal
            if (checkoutModal) {
                checkoutModal.classList.add("active");
            }
        });
    }

    // Close checkout success modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", () => {
            if (checkoutModal) {
                checkoutModal.classList.remove("active");
            }
        });
    }

    // Click outside to close success modal
    if (checkoutModal) {
        checkoutModal.addEventListener("click", (e) => {
            if (e.target === checkoutModal) {
                checkoutModal.classList.remove("active");
            }
        });
    }

    // ----------------------------------------------------
    // INITIALIZATION RUN
    // ----------------------------------------------------
    loadCart();
    syncAllUI();
});

// Custom Dynamic CSS Animation for Header Badge Bounce
const badgeBounceStyle = document.createElement("style");
badgeBounceStyle.innerHTML = `
    @keyframes popBadge {
        0% { transform: scale(1); }
        50% { transform: scale(1.3); }
        100% { transform: scale(1); }
    }
    .pop-badge {
        animation: popBadge 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
`;
document.head.appendChild(badgeBounceStyle);
