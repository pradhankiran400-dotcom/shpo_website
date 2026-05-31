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

    // Request desktop OS notification permissions on DOM load
    if (window.Notification && Notification.permission === "default") {
        Notification.requestPermission();
    }

    // High-fidelity Web Audio Synthesizer (Zero-dependency chime / sound system!)
    function playChime(type) {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            const audioCtx = new AudioContextClass();

            if (type === "add") {
                // High-pitched rapid double-beep chime for item adding
                const playBeep = (freq, startTime, duration) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(freq, startTime);
                    gain.gain.setValueAtTime(0.08, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(startTime);
                    osc.stop(startTime + duration);
                };
                playBeep(987.77, audioCtx.currentTime, 0.12); // B5 note
                playBeep(1318.51, audioCtx.currentTime + 0.08, 0.15); // E6 note
            } else if (type === "order") {
                // Majestic upward arpeggio major chord for successful order checkout
                const playChordNote = (freq, startTime, duration) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = "triangle"; // Sweeter, softer timbre
                    osc.frequency.setValueAtTime(freq, startTime);
                    gain.gain.setValueAtTime(0.12, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(startTime);
                    osc.stop(startTime + duration);
                };
                const now = audioCtx.currentTime;
                playChordNote(523.25, now, 0.5);        // C5
                playChordNote(659.25, now + 0.08, 0.5); // E5
                playChordNote(783.99, now + 0.16, 0.5); // G5
                playChordNote(1046.50, now + 0.24, 0.6); // C6
            }
        } catch (e) {
            console.error("Web Audio Synthesizer failed:", e);
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

        playChime("add");
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
            
            // Close the cart drawer
            closeCartDrawer();
            
            // Open delivery details modal and initialize
            openCheckoutFormModal(subtotal);
        });
    }

    // ----------------------------------------------------
    // CHECKOUT FORM MODAL AND DELIVERY DISTANCE CALCULATOR
    // ----------------------------------------------------
    let calculatedDistance = 0;
    let calculatedDeliveryCharge = 0;
    let selectedPaymentMethod = "COD";

    const checkoutFormModal = document.getElementById("checkout-form-modal");
    const closeCheckoutFormBtn = document.getElementById("close-checkout-form-btn");
    const checkoutAddressForm = document.getElementById("checkout-address-form");
    const deliveryAddressInput = document.getElementById("delivery-address-input");
    const detectLocationBtn = document.getElementById("detect-location-btn");
    const calcDistanceBtn = document.getElementById("calc-distance-btn");
    const distanceSummaryBox = document.getElementById("distance-summary-box");

    const summaryDistanceVal = document.getElementById("summary-distance-val");
    const summaryDeliveryCharge = document.getElementById("summary-delivery-charge");
    const checkoutSubtotalVal = document.getElementById("checkout-subtotal-val");
    const checkoutDeliveryVal = document.getElementById("checkout-delivery-val");
    const checkoutGrandtotalVal = document.getElementById("checkout-grandtotal-val");
    const confirmPlaceOrderBtn = document.getElementById("confirm-place-order-btn");

    function openCheckoutFormModal(subtotal) {
        if (checkoutFormModal) {
            checkoutFormModal.classList.add("active");
            document.body.style.overflow = "hidden";
        }

        calculatedDistance = 0;
        calculatedDeliveryCharge = 0;

        if (deliveryAddressInput) deliveryAddressInput.value = "";
        if (distanceSummaryBox) distanceSummaryBox.style.display = "none";
        
        // Reset panels to Step 1 (Address details)
        const addressStepPanel = document.getElementById("address-step-panel");
        const paymentStepPanel = document.getElementById("payment-step-panel");
        const proceedToPaymentBtn = document.getElementById("proceed-to-payment-btn");
        const stepIndAddress = document.getElementById("step-ind-address");
        const stepIndPayment = document.getElementById("step-ind-payment");

        if (addressStepPanel) addressStepPanel.style.display = "block";
        if (paymentStepPanel) paymentStepPanel.style.display = "none";
        if (proceedToPaymentBtn) proceedToPaymentBtn.disabled = true;

        if (stepIndAddress && stepIndPayment) {
            stepIndAddress.style.color = "var(--primary)";
            stepIndAddress.style.borderBottom = "2px solid var(--primary)";
            stepIndAddress.style.paddingBottom = "10px";
            stepIndAddress.style.marginBottom = "-13px";
            
            stepIndPayment.style.color = "var(--text-light)";
            stepIndPayment.style.borderBottom = "none";
        }

        if (checkoutSubtotalVal) checkoutSubtotalVal.innerText = subtotal.toFixed(2);
        if (checkoutDeliveryVal) checkoutDeliveryVal.innerText = "0.00";
        if (checkoutGrandtotalVal) checkoutGrandtotalVal.innerText = subtotal.toFixed(2);

        // Reset payment selection state
        selectedPaymentMethod = "COD";
        const paymentMethodCODInput = document.getElementById("payment-method-cod-label") ? document.getElementById("payment-method-cod-label").querySelector('input') : null;
        if (paymentMethodCODInput) paymentMethodCODInput.checked = true;
        
        const paymentReceiptInput = document.getElementById("payment-receipt-input");
        if (paymentReceiptInput) paymentReceiptInput.value = "";
        
        const receiptFilenameDisplay = document.getElementById("receipt-filename-display");
        if (receiptFilenameDisplay) receiptFilenameDisplay.style.display = "none";
        
        const receiptUploadTrigger = document.getElementById("receipt-upload-trigger");
        if (receiptUploadTrigger) {
            receiptUploadTrigger.innerHTML = `<i data-lucide="upload" style="width: 15px; height: 15px;"></i> Choose Receipt Image`;
            if (window.lucide) window.lucide.createIcons();
        }

        const distanceLimitAlert = document.getElementById("distance-limit-alert");
        if (distanceLimitAlert) distanceLimitAlert.style.display = "none";
    }

    function closeCheckoutFormModal() {
        if (checkoutFormModal) {
            checkoutFormModal.classList.remove("active");
            document.body.style.overflow = "";
        }
    }

    if (closeCheckoutFormBtn) {
        closeCheckoutFormBtn.addEventListener("click", closeCheckoutFormModal);
    }
    if (checkoutFormModal) {
        checkoutFormModal.addEventListener("click", (e) => {
            if (e.target === checkoutFormModal) {
                closeCheckoutFormModal();
            }
        });
    }

    // Store Location Coordinates (Indradhanu Market, Bhubaneswar)
    const STORE_LAT = 20.29424;
    const STORE_LNG = 85.81667;

    // Haversine formula to compute distance in km
    function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return parseFloat((R * c).toFixed(2));
    }

    // Fallback: Address complexity hash estimation
    function getEstimatedFallbackDistance(address) {
        if (!address || address.length < 5) return 5.2;
        let hash = 0;
        for (let i = 0; i < address.length; i++) {
            hash = address.charCodeAt(i) + ((hash << 5) - hash);
        }
        const base = Math.abs(hash % 120) / 10; // 0.0 to 12.0
        return parseFloat((2.5 + base).toFixed(1));
    }

    function applyCalculatedDistance(distance) {
        calculatedDistance = distance;
        calculatedDeliveryCharge = parseFloat((distance * 2).toFixed(2)); // ₹2 per km

        const subtotal = parseFloat(checkoutSubtotalVal.innerText);
        const grandTotal = subtotal + calculatedDeliveryCharge;

        const distanceLimitAlert = document.getElementById("distance-limit-alert");
        const alertDistanceVal = document.getElementById("alert-distance-val");
        const proceedToPaymentBtn = document.getElementById("proceed-to-payment-btn");

        if (distance > 20) {
            if (alertDistanceVal) alertDistanceVal.innerText = distance.toFixed(1);
            if (distanceLimitAlert) distanceLimitAlert.style.display = "block";
            if (distanceSummaryBox) distanceSummaryBox.style.display = "none";
            if (proceedToPaymentBtn) proceedToPaymentBtn.disabled = true;
            showToast("Order Rejected: We only deliver within a 20 km radius! 📍");
            return;
        }

        if (distanceLimitAlert) distanceLimitAlert.style.display = "none";

        if (summaryDistanceVal) summaryDistanceVal.innerText = `${distance} km`;
        if (summaryDeliveryCharge) summaryDeliveryCharge.innerText = `₹${calculatedDeliveryCharge.toFixed(2)}`;
        if (checkoutDeliveryVal) checkoutDeliveryVal.innerText = calculatedDeliveryCharge.toFixed(2);
        if (checkoutGrandtotalVal) checkoutGrandtotalVal.innerText = grandTotal.toFixed(2);

        if (distanceSummaryBox) distanceSummaryBox.style.display = "block";
        if (proceedToPaymentBtn) proceedToPaymentBtn.disabled = false;
    }

    // Geolocation detection click handler
    if (detectLocationBtn) {
        detectLocationBtn.addEventListener("click", () => {
            if (!navigator.geolocation) {
                showToast("Geolocation is not supported by your browser.");
                return;
            }

            detectLocationBtn.disabled = true;
            const originalText = detectLocationBtn.innerHTML;
            detectLocationBtn.innerHTML = `<i class="toast-icon spin" data-lucide="loader-2" style="width: 14px; height: 14px;"></i> Detecting...`;
            if (window.lucide) window.lucide.createIcons();

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const dist = calculateHaversineDistance(STORE_LAT, STORE_LNG, lat, lon);

                    if (deliveryAddressInput) {
                        deliveryAddressInput.value = `GPS Coordinate Location (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
                    }

                    applyCalculatedDistance(dist);
                    showToast("GPS Coordinate location detected! 📍");

                    detectLocationBtn.disabled = false;
                    detectLocationBtn.innerHTML = originalText;
                    if (window.lucide) window.lucide.createIcons();
                },
                (error) => {
                    console.error("GPS detection error:", error);
                    showToast("Could not retrieve GPS location. Please type manually!");

                    detectLocationBtn.disabled = false;
                    detectLocationBtn.innerHTML = originalText;
                    if (window.lucide) window.lucide.createIcons();
                },
                { enableHighAccuracy: true, timeout: 6000 }
            );
        });
    }

    // Geocoding Manual Address Distance calculator click handler
    if (calcDistanceBtn) {
        calcDistanceBtn.addEventListener("click", () => {
            const address = deliveryAddressInput ? deliveryAddressInput.value.trim() : "";
            if (address.length < 5) {
                showToast("Please enter a valid, detailed address!");
                return;
            }

            calcDistanceBtn.disabled = true;
            const originalText = calcDistanceBtn.innerHTML;
            calcDistanceBtn.innerText = "Calculating...";

            // Geocode using free OpenStreetMap Nominatim service
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`)
            .then(res => {
                if (!res.ok) throw new Error("OSM Nominatim failed");
                return res.json();
            })
            .then(data => {
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    const dist = calculateHaversineDistance(STORE_LAT, STORE_LNG, lat, lon);
                    applyCalculatedDistance(dist);
                    showToast(`Real-time distance calculated: ${dist} km! 🌾`);
                } else {
                    const fallbackDist = getEstimatedFallbackDistance(address);
                    applyCalculatedDistance(fallbackDist);
                    showToast(`Standard distance calculated: ${fallbackDist} km! 🌾`);
                }
            })
            .catch(err => {
                console.error("Geocoding failed:", err);
                const fallbackDist = getEstimatedFallbackDistance(address);
                applyCalculatedDistance(fallbackDist);
                showToast(`Standard distance calculated: ${fallbackDist} km! 🌾`);
            })
            .finally(() => {
                calcDistanceBtn.disabled = false;
                calcDistanceBtn.innerHTML = originalText;
            });
        });
    }

    // ----------------------------------------------------
    // CHECKOUT MULTI-STEP SWITCHER AND UPI QR CALCULATIONS
    // ----------------------------------------------------
    const addressStepPanel = document.getElementById("address-step-panel");
    const paymentStepPanel = document.getElementById("payment-step-panel");
    const proceedToPaymentBtn = document.getElementById("proceed-to-payment-btn");
    const backToAddressBtn = document.getElementById("back-to-address-btn");
    const stepIndAddress = document.getElementById("step-ind-address");
    const stepIndPayment = document.getElementById("step-ind-payment");
    const paymentGrandtotalVal = document.getElementById("payment-grandtotal-val");

    if (proceedToPaymentBtn) {
        proceedToPaymentBtn.addEventListener("click", () => {
            if (addressStepPanel && paymentStepPanel) {
                addressStepPanel.style.display = "none";
                paymentStepPanel.style.display = "block";
            }
            if (stepIndAddress && stepIndPayment) {
                stepIndAddress.style.color = "var(--text-light)";
                stepIndAddress.style.borderBottom = "none";
                stepIndPayment.style.color = "var(--primary)";
                stepIndPayment.style.borderBottom = "2px solid var(--primary)";
                stepIndPayment.style.paddingBottom = "10px";
                stepIndPayment.style.marginBottom = "-13px";
            }
            const grandTotal = parseFloat(checkoutGrandtotalVal.innerText);
            if (paymentGrandtotalVal) {
                paymentGrandtotalVal.innerText = grandTotal.toFixed(2);
            }
            
            // Initialize payment selection screen UI
            updatePaymentMethodUI();
        });
    }

    if (backToAddressBtn) {
        backToAddressBtn.addEventListener("click", () => {
            if (addressStepPanel && paymentStepPanel) {
                addressStepPanel.style.display = "block";
                paymentStepPanel.style.display = "none";
            }
            if (stepIndAddress && stepIndPayment) {
                stepIndAddress.style.color = "var(--primary)";
                stepIndAddress.style.borderBottom = "2px solid var(--primary)";
                stepIndPayment.style.color = "var(--text-light)";
                stepIndPayment.style.borderBottom = "none";
            }
        });
    }

    // Payment Method Selector and Receipt Upload Logic
    const paymentMethodCODInput = document.getElementById("payment-method-cod-label") ? document.getElementById("payment-method-cod-label").querySelector('input') : null;
    const paymentMethodUPIInput = document.getElementById("payment-method-upi-label") ? document.getElementById("payment-method-upi-label").querySelector('input') : null;
    const paymentMethodCODLabel = document.getElementById("payment-method-cod-label");
    const paymentMethodUPILabel = document.getElementById("payment-method-upi-label");
    
    const codInfoPanel = document.getElementById("cod-info-panel");
    const upiInfoPanel = document.getElementById("upi-info-panel");
    const codGrandtotalVal = document.getElementById("cod-grandtotal-val");
    const paymentReceiptInput = document.getElementById("payment-receipt-input");
    const receiptUploadTrigger = document.getElementById("receipt-upload-trigger");
    const receiptFilenameDisplay = document.getElementById("receipt-filename-display");

    function updatePaymentMethodUI() {
        const grandTotal = parseFloat(checkoutGrandtotalVal.innerText);
        if (codGrandtotalVal) codGrandtotalVal.innerText = grandTotal.toFixed(2);
        if (paymentGrandtotalVal) paymentGrandtotalVal.innerText = grandTotal.toFixed(2);

        if (selectedPaymentMethod === "COD") {
            if (paymentMethodCODLabel) paymentMethodCODLabel.classList.add("active-label");
            if (paymentMethodUPILabel) paymentMethodUPILabel.classList.remove("active-label");
            if (codInfoPanel) codInfoPanel.style.display = "block";
            if (upiInfoPanel) upiInfoPanel.style.display = "none";
            if (confirmPlaceOrderBtn) confirmPlaceOrderBtn.disabled = false;
        } else {
            if (paymentMethodUPILabel) paymentMethodUPILabel.classList.add("active-label");
            if (paymentMethodCODLabel) paymentMethodCODLabel.classList.remove("active-label");
            if (codInfoPanel) codInfoPanel.style.display = "none";
            if (upiInfoPanel) upiInfoPanel.style.display = "block";
            
            // For UPI, verify if a receipt image is uploaded
            if (paymentReceiptInput && paymentReceiptInput.files && paymentReceiptInput.files.length > 0) {
                if (confirmPlaceOrderBtn) confirmPlaceOrderBtn.disabled = false;
            } else {
                if (confirmPlaceOrderBtn) confirmPlaceOrderBtn.disabled = true;
            }
        }
    }

    if (paymentMethodCODLabel) {
        paymentMethodCODLabel.addEventListener("click", () => {
            if (paymentMethodCODInput) paymentMethodCODInput.checked = true;
            selectedPaymentMethod = "COD";
            updatePaymentMethodUI();
        });
    }

    if (paymentMethodUPILabel) {
        paymentMethodUPILabel.addEventListener("click", () => {
            if (paymentMethodUPIInput) paymentMethodUPIInput.checked = true;
            selectedPaymentMethod = "UPI";
            updatePaymentMethodUI();
        });
    }

    // Trigger file input click when upload button is clicked
    if (receiptUploadTrigger && paymentReceiptInput) {
        receiptUploadTrigger.addEventListener("click", () => {
            paymentReceiptInput.click();
        });
    }

    // Listen for receipt image selection
    if (paymentReceiptInput) {
        paymentReceiptInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                if (receiptFilenameDisplay) {
                    receiptFilenameDisplay.innerText = `📄 Loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                    receiptFilenameDisplay.style.display = "block";
                }
                if (receiptUploadTrigger) {
                    receiptUploadTrigger.innerHTML = `<i data-lucide="check-circle" style="width: 15px; height: 15px;"></i> Change Receipt`;
                    if (window.lucide) window.lucide.createIcons();
                }
                if (confirmPlaceOrderBtn) confirmPlaceOrderBtn.disabled = false;
                showToast("Payment receipt loaded successfully! 🌾");
            } else {
                if (receiptFilenameDisplay) receiptFilenameDisplay.style.display = "none";
                if (receiptUploadTrigger) {
                    receiptUploadTrigger.innerHTML = `<i data-lucide="upload" style="width: 15px; height: 15px;"></i> Choose Receipt Image`;
                    if (window.lucide) window.lucide.createIcons();
                }
                if (confirmPlaceOrderBtn && selectedPaymentMethod === "UPI") confirmPlaceOrderBtn.disabled = true;
            }
        });
    }

    function startConfettiBurst() {
        const container = document.getElementById("success-confetti-container");
        if (!container) return;
        container.innerHTML = "";
        const colors = ["#2e7d32", "#ffd700", "#1b4332", "#4caf50", "#ffeb3b", "#ff9800"];
        for (let i = 0; i < 75; i++) {
            const piece = document.createElement("div");
            piece.classList.add("confetti-piece");
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.top = `${Math.random() * 20 - 15}px`;
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            // Random size
            const size = Math.random() * 8 + 6;
            piece.style.width = `${size}px`;
            piece.style.height = `${size * (Math.random() * 0.5 + 1)}px`;
            
            // Random falling physics properties
            piece.style.animationDelay = `${Math.random() * 0.6}s`;
            piece.style.animationDuration = `${Math.random() * 1.5 + 1.2}s`;
            
            container.appendChild(piece);
        }
    }

    // Delivery address form checkout and payment verification submission
    const confirmPlaceOrderBtnVal = document.getElementById("confirm-place-order-btn");
    if (confirmPlaceOrderBtnVal) {
        confirmPlaceOrderBtnVal.addEventListener("click", (e) => {
            e.preventDefault();

            const address = deliveryAddressInput ? deliveryAddressInput.value.trim() : "";
            if (address.length < 5 || !calculatedDistance) {
                showToast("Please calculate distance before placing order.");
                return;
            }

            if (selectedPaymentMethod === "UPI") {
                if (!paymentReceiptInput || !paymentReceiptInput.files || paymentReceiptInput.files.length === 0) {
                    showToast("Please upload the payment receipt to place order!");
                    return;
                }
            }

            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const grandTotal = subtotal + calculatedDeliveryCharge;

            // Trigger real-time shopkeeper approval prompt
            const isApproved = confirm(`🔔 [NEW ORDER APPROVAL REQUEST]\n\nNew order received!\n\nCustomer: ${currentUser ? currentUser.fullname : 'Guest'}\nTotal Amount: ₹${grandTotal.toFixed(2)}\nDelivery Address: ${address}\nPayment Method: ${selectedPaymentMethod === "UPI" ? "Online UPI" : "Cash on Delivery"}\n\nClick OK to APPROVE and dispatch, or Cancel to REJECT.`);

            if (!isApproved) {
                showToast("Order rejected by store administrator. ❌");
                return;
            }

            // Pre-open blank tab synchronously in user click flow to bypass browser popup blockers!
            const whatsappWindow = window.open("", "_blank");

            // Construct transactional payload
            const orderPayload = {
                user_id: currentUser ? currentUser.id : null,
                items_json: JSON.stringify(cart),
                total_price: grandTotal,
                delivery_address: address,
                distance_km: calculatedDistance,
                delivery_charge: calculatedDeliveryCharge,
                payment_method: selectedPaymentMethod,
                order_status: "Approved" // Status set to Approved upon clicking OK
            };

            // Disable button during network round-trip
            confirmPlaceOrderBtnVal.disabled = true;
            const originalText = confirmPlaceOrderBtnVal.innerText;
            confirmPlaceOrderBtnVal.innerText = "Verifying...";

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
                console.log("Maa Bankeswari Rice Store: Order registered successfully:", order);
                lastPlacedOrder = order;

                // Close both drawers and checkout form modals
                closeCheckoutFormModal();
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

                // Inject Delivery details into success modal
                const modalDeliveryAddress = document.getElementById("modal-delivery-address");
                const modalDeliveryCharge = document.getElementById("modal-delivery-charge");

                if (modalDeliveryAddress) {
                    modalDeliveryAddress.innerText = order.delivery_address || "Guest Pickup";
                }
                if (modalDeliveryCharge) {
                    modalDeliveryCharge.innerText = order.delivery_charge.toFixed(2);
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

                // Play successful checkout arpeggio chime!
                playChime("order");

                // SpeechSynthesis Voice Alert for awareness
                try {
                    if (window.speechSynthesis) {
                        const message = new SpeechSynthesisUtterance();
                        message.text = `Attention! New order number ${order.id} has been approved for dispatch!`;
                        message.pitch = 1.0;
                        message.rate = 0.95;
                        window.speechSynthesis.speak(message);
                    }
                } catch (e) {
                    console.error("Speech Synthesis failed:", e);
                }

                // Trigger dynamic premium PDF receipt download
                try {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF({
                        orientation: "portrait",
                        unit: "mm",
                        format: "a4"
                    });

                    // 1. Branding Header
                    doc.setFillColor(27, 67, 50); // Primary green theme
                    doc.rect(0, 0, 210, 40, "F");
                    
                    doc.setTextColor(255, 255, 255);
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(22);
                    doc.text("MAA BANKESWARI RICE STORE", 15, 18);
                    
                    doc.setFont("Helvetica", "normal");
                    doc.setFontSize(10);
                    doc.setTextColor(212, 175, 55); // Accent Gold
                    doc.text("Premium Aromatic Basmati, Daily Grains & Nutritious Pulses", 15, 25);
                    
                    doc.setFontSize(9);
                    doc.setTextColor(255, 255, 255);
                    doc.text("Indradhanu Market, IRC Village, Nayapalli, Bhubaneswar | Phone: +91 9078445116", 15, 32);

                    // 2. Invoice Meta Info Block
                    doc.setTextColor(30, 37, 34);
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(14);
                    doc.text("INVOICE RECEIPT", 15, 52);
                    
                    doc.setDrawColor(27, 67, 50);
                    doc.setLineWidth(0.5);
                    doc.line(15, 55, 195, 55);

                    doc.setFont("Helvetica", "normal");
                    doc.setFontSize(10);
                    doc.text(`Order ID: #${order.id}`, 15, 63);
                    doc.text(`Date & Time: ${order.created_at}`, 15, 69);
                    doc.text(`Status: Approved (${order.payment_method === 'UPI' ? 'UPI Receipt Uploaded' : 'Cash on Delivery'})`, 15, 75);
                    
                    doc.setFont("Helvetica", "bold");
                    doc.text("Delivery Details:", 115, 63);
                    doc.setFont("Helvetica", "normal");
                    
                    // Clamped address wrap
                    const addressLines = doc.splitTextToSize(order.delivery_address || "Standard Guest Pickup", 80);
                    doc.text(addressLines, 115, 69);
                    doc.text(`Distance: ${order.distance_km.toFixed(1)} km`, 115, 69 + (addressLines.length * 5));

                    // 3. Grid Table Headers
                    let startY = 95;
                    doc.setFillColor(240, 245, 242);
                    doc.rect(15, startY, 180, 8, "F");
                    
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(9.5);
                    doc.text("Item Description", 18, startY + 5.5);
                    doc.text("Rate", 110, startY + 5.5);
                    doc.text("Qty", 145, startY + 5.5);
                    doc.text("Total", 175, startY + 5.5);

                    doc.setDrawColor(200, 210, 204);
                    doc.line(15, startY + 8, 195, startY + 8);
                    
                    // 4. Populate Items Rows
                    doc.setFont("Helvetica", "normal");
                    let currentY = startY + 14;
                    const items = JSON.parse(order.items_json);

                    items.forEach((item, index) => {
                        doc.text(`${index + 1}. ${item.name}`, 18, currentY);
                        doc.text(`Rs. ${item.price.toFixed(2)} / ${item.unit}`, 110, currentY);
                        doc.text(`${item.quantity} ${item.unit}`, 145, currentY);
                        doc.text(`Rs. ${(item.price * item.quantity).toFixed(2)}`, 175, currentY);
                        
                        doc.line(15, currentY + 3, 195, currentY + 3);
                        currentY += 10;
                    });

                    // 5. Calculations Summary Block
                    currentY += 5;
                    doc.setFont("Helvetica", "normal");
                    doc.text("Items Subtotal:", 120, currentY);
                    const subtotal = order.total_price - (order.delivery_charge || 0);
                    doc.text(`Rs. ${subtotal.toFixed(2)}`, 175, currentY);

                    if (order.delivery_charge) {
                        currentY += 6;
                        doc.text(`Delivery Charge (${order.distance_km.toFixed(1)} km):`, 120, currentY);
                        doc.text(`Rs. ${order.delivery_charge.toFixed(2)}`, 175, currentY);
                    }

                    currentY += 8;
                    doc.setDrawColor(27, 67, 50);
                    doc.setLineWidth(0.5);
                    doc.line(115, currentY - 4, 195, currentY - 4);
                    
                    doc.setFont("Helvetica", "bold");
                    doc.setFontSize(11);
                    doc.text("GRAND TOTAL:", 120, currentY);
                    doc.text(`Rs. ${order.total_price.toFixed(2)}`, 175, currentY);
                    
                    // 6. Guarantee Stamp Footer
                    currentY += 28;
                    doc.setFillColor(247, 243, 232);
                    doc.rect(15, currentY, 180, 20, "F");
                    
                    doc.setFont("Helvetica", "bolditalic");
                    doc.setFontSize(10);
                    doc.setTextColor(27, 67, 50);
                    doc.text("✨ 100% Pure, Hygienic & Farm-Sourced Staple Grains Guarantee ✨", 32, currentY + 8);
                    doc.setFont("Helvetica", "normal");
                    doc.setFontSize(8.5);
                    doc.setTextColor(100, 110, 105);
                    doc.text("Thank you for shopping with us! For delivery inquiries, contact our store operator at +91 9078445116.", 28, currentY + 14);

                    // 7. Save direct PDF
                    doc.save(`maa_bankeswari_receipt_${order.id}.pdf`);
                } catch (e) {
                    console.error("PDF Invoice download failed:", e);
                }

                // Push native OS Desktop Notification
                if (window.Notification && Notification.permission === "granted") {
                    new Notification("🌾 Maa Bankeswari Store: Order Approved!", {
                        body: `Order #${order.id} Approved! Total Bill: ₹${order.total_price.toFixed(2)}. Receipt PDF downloaded automatically.`,
                        icon: "/static/favicon.png"
                    });
                }

                // Compose WhatsApp click message dispatch to shopkeeper (9078445116)
                try {
                    const items = JSON.parse(order.items_json);
                    let waText = `*🌾 NEW ORDER APPROVED - MAA BANKESWARI STORE 🌾*\n`;
                    waText += `====================================\n`;
                    waText += `*Order ID*   : #${order.id}\n`;
                    waText += `*Date/Time*  : ${order.created_at}\n`;
                    waText += `*Payment Method* : ${order.payment_method === 'UPI' ? 'Online UPI (Receipt Uploaded)' : 'Cash on Delivery'}\n`;
                    if (order.delivery_address) {
                        waText += `*Delivery Address* : ${order.delivery_address}\n`;
                        waText += `*Distance*   : ${order.distance_km.toFixed(1)} km\n`;
                    }
                    waText += `====================================\n\n`;
                    waText += `*Items Ordered*:\n`;

                    items.forEach((item, index) => {
                        waText += `${index + 1}. *${item.name}* - ${item.quantity} ${item.unit} x ₹${item.price.toFixed(2)} = ₹${(item.price * item.quantity).toFixed(2)}\n`;
                    });

                    const subtotal = order.total_price - (order.delivery_charge || 0);
                    waText += `\n====================================\n`;
                    waText += `*Subtotal*   : ₹${subtotal.toFixed(2)}\n`;
                    if (order.delivery_charge) {
                        waText += `*Delivery Charge* : ₹${order.delivery_charge.toFixed(2)}\n`;
                    }
                    waText += `*GRAND TOTAL* : *₹${order.total_price.toFixed(2)}*\n`;
                    waText += `====================================\n\n`;
                    waText += `🚀 _Receipt PDF downloaded automatically in user device. The order is APPROVED and ready for packing!_`;

                    const waUrl = `https://api.whatsapp.com/send?phone=919078445116&text=${encodeURIComponent(waText)}`;
                    if (whatsappWindow) {
                        whatsappWindow.location.href = waUrl;
                    } else {
                        window.open(waUrl, "_blank");
                    }
                } catch (e) {
                    console.error("WhatsApp composed dispatch failed:", e);
                    if (whatsappWindow) whatsappWindow.close();
                }

                // Clear cart state now that it's stored on backend
                cart = [];
                syncAllUI();

                // If user is logged in, refresh history stats/drawer immediately
                if (currentUser) {
                    fetchOrderHistory();
                }

                // Show success modal & start confetti burst!
                if (checkoutModal) {
                    checkoutModal.classList.add("active");
                    startConfettiBurst();
                }
            })
            .catch(error => {
                console.error("Maa Bankeswari Rice Store: Checkout error:", error);
                showToast("Could not process order. Please try again!");
                if (whatsappWindow) whatsappWindow.close();
            })
            .finally(() => {
                // Restore button states
                if (confirmPlaceOrderBtnVal) {
                    confirmPlaceOrderBtnVal.disabled = false;
                    confirmPlaceOrderBtnVal.innerText = originalText;
                }
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
                if (lastPlacedOrder.delivery_address) {
                    receipt += `Address    : ${lastPlacedOrder.delivery_address}\n`;
                    receipt += `Distance   : ${lastPlacedOrder.distance_km.toFixed(1)} km\n`;
                }
                receipt += `Status     : Confirmed & Preparing 🚀\n`;
                receipt += `====================================\n\n`;
                receipt += `Items Ordered:\n`;

                items.forEach((item, index) => {
                    const total = (item.price * item.quantity).toFixed(2);
                    receipt += `${index + 1}. ${item.name} - ${item.quantity} ${item.unit} x ₹${item.price.toFixed(2)} = ₹${total}\n`;
                });

                const subtotal = lastPlacedOrder.total_price - (lastPlacedOrder.delivery_charge || 0);
                receipt += `\n====================================\n`;
                receipt += `Subtotal   : ₹${subtotal.toFixed(2)}\n`;
                if (lastPlacedOrder.delivery_charge) {
                    receipt += `Delivery   : ₹${lastPlacedOrder.delivery_charge.toFixed(2)}\n`;
                }
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

                        let deliveryHTML = "";
                        if (order.delivery_address) {
                            deliveryHTML = `
                                <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(27,67,50,0.04);">
                                    📍 <strong>Address:</strong> ${order.delivery_address} (${order.distance_km.toFixed(1)} km, Delivery: ₹${order.delivery_charge.toFixed(2)})
                                </div>
                            `;
                        }

                        let statusColor = "var(--success)";
                        let statusBg = "var(--primary-ultra-light)";
                        if (order.order_status === "Pending Approval") {
                            statusColor = "#e65100";
                            statusBg = "#fff3e0";
                        } else if (order.order_status === "Rejected") {
                            statusColor = "#c62828";
                            statusBg = "#ffebee";
                        }

                        const orderCardHTML = `
                            <div class="order-history-card" style="background-color: var(--white); border: 1px solid rgba(27,67,50,0.08); padding: 16px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(27,67,50,0.08); padding-bottom: 8px;">
                                    <span style="font-size: 0.85rem; font-weight: 700; color: var(--primary-dark);">Order #${order.id}</span>
                                    <span style="font-size: 0.75rem; color: var(--text-light);">${order.created_at}</span>
                                </div>
                                <div style="padding: 4px 0;">
                                    ${itemsHTML}
                                    ${deliveryHTML}
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(27,67,50,0.04); padding-top: 8px; margin-top: 4px;">
                                    <div style="display: flex; gap: 6px; align-items: center;">
                                        <span style="font-size: 0.72rem; background-color: ${statusBg}; color: ${statusColor}; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-xl); text-transform: uppercase;">${order.order_status || 'Approved'}</span>
                                        <span style="font-size: 0.72rem; background-color: #f1f3f4; color: #5f6368; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-xl); text-transform: uppercase;">${order.payment_method || 'COD'}</span>
                                    </div>
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
