document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------
    // STATE MANAGEMENT
    // ----------------------------------------------------
    let cart = [];
    let currentUser = null;

    // Load user from localStorage
    function loadUser() {
        const storedUser = localStorage.getItem("mb_rice_store_user");
        if (storedUser) {
            try {
                currentUser = JSON.parse(storedUser);
            } catch (e) {
                console.error("Error parsing user storage:", e);
                currentUser = null;
            }
        } else {
            currentUser = null;
        }
        updateHeaderUserUI();
    }

    // Save user to localStorage
    function saveUser(user) {
        currentUser = user;
        if (user) {
            localStorage.setItem("mb_rice_store_user", JSON.stringify(user));
        } else {
            localStorage.removeItem("mb_rice_store_user");
        }
        updateHeaderUserUI();
    }

    // Update Sign In / Profile button text
    function updateHeaderUserUI() {
        const authBtnText = document.getElementById("auth-btn-text");
        if (authBtnText) {
            if (currentUser) {
                const firstName = currentUser.fullname.split(" ")[0];
                authBtnText.innerText = `Hi, ${firstName}`;
            } else {
                authBtnText.innerText = "Sign In";
            }
        }
    }

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
    let lastPlacedOrder = null; // Store last transaction details for receipt copying
    const checkoutBtn = document.getElementById("checkout-btn");
    const checkoutModal = document.getElementById("checkout-modal");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const copyInvoiceBtn = document.getElementById("copy-invoice-btn");
    const modalItemsContainer = document.getElementById("modal-order-items");
    const modalTotalPrice = document.getElementById("modal-total-price");

    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
            if (cart.length === 0) {
                showToast("Your basket is empty!");
                return;
            }

            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // Construct transactional payload
            const orderPayload = {
                user_id: currentUser ? currentUser.id : null,
                items_json: JSON.stringify(cart),
                total_price: subtotal
            };

            // Disable button during network round-trip
            checkoutBtn.disabled = true;
            const originalText = checkoutBtn.innerHTML;
            checkoutBtn.innerHTML = `<span>Saving Order...</span><i class="toast-icon spin" data-lucide="loader-2"></i>`;
            if (window.lucide) window.lucide.createIcons();

            // Send transactional order data to FastAPI server
            fetch("/api/orders/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(orderPayload)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error("Checkout request failed.");
                }
                return response.json();
            })
            .then(order => {
                console.log("Maa Bankeswari Rice Store: Order registered successfully in SQLite:", order);
                lastPlacedOrder = order;

                // Close the cart drawer
                closeCartDrawer();

                // Populate success modal invoice summary
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

                // Inject Order ID into modal header dynamically
                const summaryBox = document.querySelector(".order-summary-box");
                if (summaryBox) {
                    const header = summaryBox.querySelector(".summary-header");
                    if (header) {
                        header.innerHTML = `Order Summary (Order ID: #${order.id})`;
                    }
                }

                // Set final total price in success modal
                if (modalTotalPrice) {
                    modalTotalPrice.innerText = order.total_price.toFixed(2);
                }

                // Clear cart state now that it's stored on backend
                cart = [];
                syncAllUI();

                // If user is logged in, refresh history stats/drawer immediately
                if (currentUser) {
                    fetchOrderHistory();
                }

                // Show success modal
                if (checkoutModal) {
                    checkoutModal.classList.add("active");
                }
            })
            .catch(error => {
                console.error("Maa Bankeswari Rice Store: Checkout error:", error);
                showToast("Could not process order. Please try again!");
            })
            .finally(() => {
                // Restore button states
                checkoutBtn.disabled = false;
                checkoutBtn.innerHTML = originalText;
                if (window.lucide) window.lucide.createIcons();
            });
        });
    }

    // Dynamic copy invoice to clipboard handler
    if (copyInvoiceBtn) {
        copyInvoiceBtn.addEventListener("click", () => {
            if (!lastPlacedOrder) {
                showToast("No active order receipt found.");
                return;
            }

            try {
                const items = JSON.parse(lastPlacedOrder.items_json);
                let receipt = `🌾 MAA BANKESWARI RICE STORE RECEIPT 🌾\n`;
                receipt += `====================================\n`;
                receipt += `Order ID   : #${lastPlacedOrder.id}\n`;
                receipt += `Date/Time  : ${lastPlacedOrder.created_at}\n`;
                receipt += `Status     : Confirmed & Preparing 🚀\n`;
                receipt += `====================================\n\n`;
                receipt += `Items Ordered:\n`;

                items.forEach((item, index) => {
                    const total = (item.price * item.quantity).toFixed(2);
                    receipt += `${index + 1}. ${item.name} - ${item.quantity} ${item.unit} x ₹${item.price.toFixed(2)} = ₹${total}\n`;
                });

                receipt += `\n====================================\n`;
                receipt += `TOTAL BILL : ₹${lastPlacedOrder.total_price.toFixed(2)}\n`;
                receipt += `====================================\n\n`;
                receipt += `Thank you for shopping with us! We will contact you shortly for delivery confirmation.\n`;
                receipt += `📞 Contact Store: +91 9776400523 / +91 674 234567\n`;
                receipt += `📍 Indradhanu Market, IRC Village, Nayapalli, Bhubaneswar`;

                navigator.clipboard.writeText(receipt)
                    .then(() => {
                        showToast("Order Receipt copied to clipboard! 📋");
                    })
                    .catch(err => {
                        console.error("Clipboard write error:", err);
                        showToast("Could not copy receipt. Please copy manually.");
                    });
            } catch (e) {
                console.error("Error formatting receipt data:", e);
                showToast("Error generating receipt formatting.");
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
    // AUTHENTICATION AND PROFILE MODULE
    // ----------------------------------------------------
    const authModalToggle = document.getElementById("auth-modal-toggle");
    const authModal = document.getElementById("auth-modal");
    const closeAuth = document.getElementById("close-auth");

    // Profile drawer elements
    const profileOverlay = document.getElementById("profile-overlay");
    const profileDrawer = document.getElementById("profile-drawer");
    const closeProfile = document.getElementById("close-profile");

    function openAuthModal() {
        if (authModal) {
            authModal.classList.add("active");
            document.body.style.overflow = "hidden";
        }
    }

    function closeAuthModal() {
        if (authModal) {
            authModal.classList.remove("active");
            document.body.style.overflow = "";
        }
    }

    function openProfileDrawer() {
        if (profileDrawer && profileOverlay) {
            profileDrawer.classList.add("active");
            profileOverlay.classList.add("active");
            document.body.style.overflow = "hidden";
            renderProfileDetails();
            fetchOrderHistory();
        }
    }

    function closeProfileDrawer() {
        if (profileDrawer && profileOverlay) {
            profileDrawer.classList.remove("active");
            profileOverlay.classList.remove("active");
            document.body.style.overflow = "";
        }
    }

    if (authModalToggle) {
        authModalToggle.addEventListener("click", () => {
            if (currentUser) {
                openProfileDrawer();
            } else {
                openAuthModal();
            }
        });
    }

    if (closeAuth) closeAuth.addEventListener("click", closeAuthModal);
    if (authModal) {
        authModal.addEventListener("click", (e) => {
            if (e.target === authModal) {
                closeAuthModal();
            }
        });
    }

    if (closeProfile) closeProfile.addEventListener("click", closeProfileDrawer);
    if (profileOverlay) profileOverlay.addEventListener("click", closeProfileDrawer);

    // Tab switcher between login and registration forms
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    function switchAuthTab(activeTab) {
        if (activeTab === "login") {
            if (tabLogin) {
                tabLogin.classList.add("active");
                tabLogin.style.color = "var(--primary)";
                tabLogin.style.borderBottom = "2px solid var(--primary)";
                tabLogin.style.fontWeight = "700";
            }
            if (tabRegister) {
                tabRegister.classList.remove("active");
                tabRegister.style.color = "var(--text-light)";
                tabRegister.style.borderBottom = "2px solid transparent";
                tabRegister.style.fontWeight = "600";
            }
            if (loginForm) loginForm.style.display = "block";
            if (registerForm) registerForm.style.display = "none";
        } else {
            if (tabRegister) {
                tabRegister.classList.add("active");
                tabRegister.style.color = "var(--primary)";
                tabRegister.style.borderBottom = "2px solid var(--primary)";
                tabRegister.style.fontWeight = "700";
            }
            if (tabLogin) {
                tabLogin.classList.remove("active");
                tabLogin.style.color = "var(--text-light)";
                tabLogin.style.borderBottom = "2px solid transparent";
                tabLogin.style.fontWeight = "600";
            }
            if (registerForm) registerForm.style.display = "block";
            if (loginForm) loginForm.style.display = "none";
        }
    }

    if (tabLogin) tabLogin.addEventListener("click", () => switchAuthTab("login"));
    if (tabRegister) tabRegister.addEventListener("click", () => switchAuthTab("register"));

    // Login Submission Handler
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById("login-username");
            const passwordInput = document.getElementById("login-password");

            if (!usernameInput || !passwordInput) return;

            const payload = {
                username: usernameInput.value.trim(),
                password: passwordInput.value
            };

            const submitBtn = loginForm.querySelector("button[type='submit']");
            const originalText = submitBtn ? submitBtn.innerText : "Sign In";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Signing In...";
            }

            fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            })
            .then(async (response) => {
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.detail || "Invalid credentials");
                }
                return response.json();
            })
            .then((user) => {
                saveUser(user);
                closeAuthModal();
                showToast(`Welcome back, ${user.fullname}! 🌾`);

                usernameInput.value = "";
                passwordInput.value = "";
            })
            .catch((err) => {
                console.error("Login failed:", err);
                showToast(err.message || "Invalid username or password!");
            })
            .finally(() => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalText;
                }
            });
        });
    }

    // Registration Submission Handler
    if (registerForm) {
        registerForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const fullnameInput = document.getElementById("reg-fullname");
            const usernameInput = document.getElementById("reg-username");
            const emailInput = document.getElementById("reg-email");
            const passwordInput = document.getElementById("reg-password");

            if (!fullnameInput || !usernameInput || !emailInput || !passwordInput) return;

            const payload = {
                fullname: fullnameInput.value.trim(),
                username: usernameInput.value.trim(),
                email: emailInput.value.trim(),
                password: passwordInput.value
            };

            const submitBtn = registerForm.querySelector("button[type='submit']");
            const originalText = submitBtn ? submitBtn.innerText : "Create Account";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Creating Account...";
            }

            fetch("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            })
            .then(async (response) => {
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.detail || "Registration failed");
                }
                return response.json();
            })
            .then((user) => {
                saveUser(user);
                closeAuthModal();
                showToast(`Account created! Welcome, ${user.fullname}! 🌾`);

                fullnameInput.value = "";
                usernameInput.value = "";
                emailInput.value = "";
                passwordInput.value = "";
            })
            .catch((err) => {
                console.error("Registration failed:", err);
                showToast(err.message || "Could not register account.");
            })
            .finally(() => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalText;
                }
            });
        });
    }

    // Render User Details in Profile Card
    function renderProfileDetails() {
        if (!currentUser) return;
        const profileFullName = document.getElementById("profile-fullname");
        const profileEmail = document.getElementById("profile-email");
        const profileAvatarCircle = document.getElementById("profile-avatar-circle");

        if (profileFullName) profileFullName.innerText = currentUser.fullname;
        if (profileEmail) profileEmail.innerText = currentUser.email;
        if (profileAvatarCircle) {
            profileAvatarCircle.innerText = currentUser.fullname.charAt(0).toUpperCase();
        }
    }

    // Sign out button behavior
    const signOutBtn = document.getElementById("signout-btn");
    if (signOutBtn) {
        signOutBtn.addEventListener("click", () => {
            saveUser(null);
            closeProfileDrawer();
            showToast("Signed out successfully. See you soon! 🌾");
        });
    }

    // Fetch and visualize order history + compute stats
    function fetchOrderHistory() {
        if (!currentUser) return;

        const historyEmpty = document.getElementById("history-empty");
        const historyItemsContainer = document.getElementById("history-items-container");
        const statOrderCount = document.getElementById("stat-order-count");
        const statTotalSpent = document.getElementById("stat-total-spent");

        if (historyItemsContainer) {
            historyItemsContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-light);">
                    <i class="toast-icon spin" data-lucide="loader-2"></i> Loading history...
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
        }

        fetch(`/api/users/${currentUser.id}/orders`)
        .then(response => {
            if (!response.ok) throw new Error("Could not retrieve purchase history");
            return response.json();
        })
        .then(orders => {
            const count = orders.length;
            const totalSpent = orders.reduce((sum, o) => sum + o.total_price, 0);

            if (statOrderCount) statOrderCount.innerText = count;
            if (statTotalSpent) statTotalSpent.innerText = totalSpent.toFixed(2);

            if (count === 0) {
                if (historyEmpty) historyEmpty.style.display = "block";
                if (historyItemsContainer) {
                    historyItemsContainer.style.display = "none";
                    historyItemsContainer.innerHTML = "";
                }
            } else {
                if (historyEmpty) historyEmpty.style.display = "none";
                if (historyItemsContainer) {
                    historyItemsContainer.style.display = "flex";
                    historyItemsContainer.innerHTML = "";

                    const sortedOrders = [...orders].sort((a, b) => b.id - a.id);

                    sortedOrders.forEach(order => {
                        let items = [];
                        try {
                            items = JSON.parse(order.items_json);
                        } catch (e) {
                            console.error("Error parsing order items_json:", e);
                        }

                        let itemsHTML = items.map(item => `
                            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-medium); margin-bottom: 2px;">
                                <span>${item.name} <strong style="color: var(--primary);">x${item.quantity}</strong></span>
                                <span>₹${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        `).join("");

                        const orderCardHTML = `
                            <div class="order-history-card" style="background-color: var(--white); border: 1px solid rgba(27,67,50,0.08); padding: 16px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(27,67,50,0.08); padding-bottom: 8px;">
                                    <span style="font-size: 0.85rem; font-weight: 700; color: var(--primary-dark);">Order #${order.id}</span>
                                    <span style="font-size: 0.75rem; color: var(--text-light);">${order.created_at}</span>
                                </div>
                                <div style="padding: 4px 0;">
                                    ${itemsHTML}
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(27,67,50,0.04); padding-top: 8px; margin-top: 4px;">
                                    <span style="font-size: 0.75rem; background-color: var(--primary-ultra-light); color: var(--success); font-weight: 700; padding: 2px 8px; border-radius: var(--radius-xl); text-transform: uppercase;">Delivered</span>
                                    <span style="font-size: 0.95rem; font-weight: 800; color: var(--primary-dark);">Total: ₹${order.total_price.toFixed(2)}</span>
                                </div>
                            </div>
                        `;
                        historyItemsContainer.insertAdjacentHTML("beforeend", orderCardHTML);
                    });
                }
            }
        })
        .catch(err => {
            console.error("Failed to load order history:", err);
            if (historyItemsContainer) {
                historyItemsContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: var(--danger); font-size: 0.85rem;">
                        Failed to load history. Click close & reopen to retry.
                    </div>
                `;
            }
        });
    }

    // ----------------------------------------------------
    // INITIALIZATION RUN
    // ----------------------------------------------------
    loadCart();
    loadUser();
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
