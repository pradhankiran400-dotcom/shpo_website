document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------
    // STATE MANAGEMENT
    // ----------------------------------------------------
    let cart = [];
    let currentUser = null;
    let uploadedReceiptUrl = null;
    let chatHistory = [];

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
            initUserPolling();
        } else {
            localStorage.removeItem("mb_rice_store_user");
            stopUserPolling();
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

            // Enforce login/registration before ordering
            if (!currentUser) {
                showToast("Please sign in or register to place your order! 🌾");
                closeCartDrawer();
                openAuthModal();
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

    // Checkout Selectors
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

    // Leaflet Interactive Map State Variables
    let checkoutMap = null;
    let storeMarker = null;
    let deliveryMarker = null;
    let routeLine = null;

    // Initialize interactive Leaflet map inside checkout modal
    function initCheckoutMap() {
        if (checkoutMap) {
            // Map already created: trigger resize invalidation and reset pin states
            setTimeout(() => {
                checkoutMap.invalidateSize();
                deliveryMarker.setLatLng([STORE_LAT, STORE_LNG]);
                if (routeLine) {
                    checkoutMap.removeLayer(routeLine);
                    routeLine = null;
                }
                checkoutMap.setView([STORE_LAT, STORE_LNG], 14);
            }, 150);
            return;
        }

        try {
            // Instantiate map
            checkoutMap = L.map('checkout-map', {
                zoomControl: true,
                attributionControl: false
            }).setView([STORE_LAT, STORE_LNG], 14);

            // Add smooth tile layer (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(checkoutMap);

            // Elegant, animated DivIcons matching store's forest green & gold design theme
            const storeIcon = L.divIcon({
                className: 'store-custom-marker',
                html: `<div style="background-color: var(--primary); border: 2px solid var(--accent); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; box-shadow: var(--shadow-md);">🌾</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const deliveryIcon = L.divIcon({
                className: 'delivery-custom-marker',
                html: `<div style="background-color: var(--accent); border: 2px solid var(--primary-dark); color: var(--primary-dark); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; box-shadow: var(--shadow-md); transform-origin: bottom center; animation: marker-float 2.5s infinite ease-in-out;">📍</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            // Inject CSS keyframes for marker floating micro-animation dynamically if not present
            if (!document.getElementById("marker-float-style")) {
                const style = document.createElement("style");
                style.id = "marker-float-style";
                style.innerHTML = `
                    @keyframes marker-float {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-6px); }
                    }
                `;
                document.head.appendChild(style);
            }

            // Fixed Store Marker
            storeMarker = L.marker([STORE_LAT, STORE_LNG], { icon: storeIcon }).addTo(checkoutMap);
            storeMarker.bindPopup(`
                <div class="store-popup-title">🌾 Maa Bankeswari Store</div>
                <div style="font-size: 0.72rem; color: var(--text-medium); margin-top: 4px;">Indradhanu Market, IRC Village</div>
            `).openPopup();

            // Draggable Delivery Pin
            deliveryMarker = L.marker([STORE_LAT, STORE_LNG], {
                icon: deliveryIcon,
                draggable: true
            }).addTo(checkoutMap);

            deliveryMarker.bindPopup(`
                <div class="delivery-popup-title">📍 Your Delivery Location</div>
                <div style="font-size: 0.72rem; color: var(--text-medium); margin-top: 4px; font-weight: 700;">Drag me or click map to set delivery spot!</div>
            `).openPopup();

            // Dynamically redraw dotted connecting route path polyline
            function updateRoutePolyline(latlng) {
                const points = [
                    [STORE_LAT, STORE_LNG],
                    [latlng.lat, latlng.lng]
                ];
                if (routeLine) {
                    routeLine.setLatLngs(points);
                } else {
                    routeLine = L.polyline(points, {
                        color: '#1b4332',
                        weight: 3.5,
                        dashArray: '6, 8',
                        opacity: 0.75
                    }).addTo(checkoutMap);
                }
            }

            // Reverse Geocoding through OpenStreetMap's Nominatim service
            function reverseGeocodePosition(lat, lng) {
                if (deliveryAddressInput) {
                    deliveryAddressInput.value = "Fetching address details from map pin... ⏳";
                }
                
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
                .then(res => {
                    if (!res.ok) throw new Error("API Connection Failed");
                    return res.json();
                })
                .then(data => {
                    if (data && data.display_name) {
                        if (deliveryAddressInput) {
                            deliveryAddressInput.value = data.display_name;
                        }
                    } else {
                        if (deliveryAddressInput) {
                            deliveryAddressInput.value = `Pinned Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
                        }
                    }
                })
                .catch(err => {
                    console.error("OSM Reverse Geocode error:", err);
                    if (deliveryAddressInput) {
                        deliveryAddressInput.value = `Pinned Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
                    }
                });
            }

            // Unified location state transition
            function executeLocationChange(latlng) {
                deliveryMarker.setLatLng(latlng);
                updateRoutePolyline(latlng);

                const distance = calculateHaversineDistance(STORE_LAT, STORE_LNG, latlng.lat, latlng.lng);
                applyCalculatedDistance(distance);

                reverseGeocodePosition(latlng.lat, latlng.lng);
            }

            // Drag handler
            deliveryMarker.on('dragend', () => {
                const latlng = deliveryMarker.getLatLng();
                executeLocationChange(latlng);
                deliveryMarker.bindPopup(`
                    <div class="delivery-popup-title">📍 Selected Location</div>
                    <div style="font-size: 0.72rem; color: var(--text-medium); margin-top: 4px; font-weight: 700;">Distance: ${calculatedDistance.toFixed(1)} km</div>
                `).openPopup();
            });

            // Map click handler
            checkoutMap.on('click', (e) => {
                executeLocationChange(e.latlng);
                deliveryMarker.bindPopup(`
                    <div class="delivery-popup-title">📍 Selected Location</div>
                    <div style="font-size: 0.72rem; color: var(--text-medium); margin-top: 4px; font-weight: 700;">Distance: ${calculatedDistance.toFixed(1)} km</div>
                `).openPopup();
            });

            // Safety layout tick
            setTimeout(() => {
                checkoutMap.invalidateSize();
            }, 100);

        } catch (error) {
            console.error("Could not construct Leaflet interactive map:", error);
        }
    }

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
        uploadedReceiptUrl = null;
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

        // Initialize and display interactive map
        initCheckoutMap();

        // Proactively fetch high-accuracy browser geolocation to auto-center map pin
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    const dist = calculateHaversineDistance(STORE_LAT, STORE_LNG, lat, lon);

                    // Check if within delivery zone to avoid auto-locking far away mock locations
                    if (dist <= 20 && checkoutMap && deliveryMarker) {
                        const latlng = { lat: lat, lng: lon };
                        deliveryMarker.setLatLng(latlng);
                        checkoutMap.setView([lat, lon], 14);
                        
                        const points = [[STORE_LAT, STORE_LNG], [lat, lon]];
                        if (routeLine) {
                            routeLine.setLatLngs(points);
                        } else {
                            routeLine = L.polyline(points, {
                                color: '#1b4332',
                                weight: 3.5,
                                dashArray: '6, 8',
                                opacity: 0.75
                            }).addTo(checkoutMap);
                        }

                        applyCalculatedDistance(dist);

                        if (deliveryAddressInput) {
                            deliveryAddressInput.value = "Fetching current location address details... ⏳";
                        }
                        
                        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`)
                        .then(res => res.json())
                        .then(data => {
                            if (data && data.display_name && deliveryAddressInput) {
                                deliveryAddressInput.value = data.display_name;
                            }
                        })
                        .catch(err => console.error("Auto center geocode failed:", err));
                    }
                },
                (err) => console.log("Standard browser auto-geolocation prompt skipped/denied."),
                { enableHighAccuracy: true, timeout: 3500 }
            );
        }
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

    // Geolocation detection click handler integrated with Leaflet map
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

                    applyCalculatedDistance(dist);

                    // Update Leaflet map and marker coordinates dynamically
                    if (checkoutMap && deliveryMarker) {
                        const latlng = { lat: lat, lng: lon };
                        deliveryMarker.setLatLng(latlng);
                        checkoutMap.setView([lat, lon], 15);

                        // Update connecting dotted polyline
                        const points = [[STORE_LAT, STORE_LNG], [lat, lon]];
                        if (routeLine) {
                            routeLine.setLatLngs(points);
                        } else {
                            routeLine = L.polyline(points, {
                                color: '#1b4332',
                                weight: 3.5,
                                dashArray: '6, 8',
                                opacity: 0.75
                            }).addTo(checkoutMap);
                        }

                        deliveryMarker.bindPopup(`
                            <div class="delivery-popup-title">📍 Detected Location</div>
                            <div style="font-size: 0.72rem; color: var(--text-medium); margin-top: 4px;">Distance: ${dist.toFixed(1)} km</div>
                        `).openPopup();
                    }

                    // Perform reverse geocoding to fill in street address cleanly
                    if (deliveryAddressInput) {
                        deliveryAddressInput.value = "Translating coordinates to address... ⏳";
                    }

                    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.display_name && deliveryAddressInput) {
                            deliveryAddressInput.value = data.display_name;
                            showToast("Location resolved and address updated! 📍");
                        } else {
                            if (deliveryAddressInput) {
                                deliveryAddressInput.value = `GPS Coordinate Location (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
                            }
                            showToast("GPS location detected! 📍");
                        }
                    })
                    .catch(err => {
                        console.error("OSM Geocoding reverse resolution failed:", err);
                        if (deliveryAddressInput) {
                            deliveryAddressInput.value = `GPS Coordinate Location (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
                        }
                        showToast("GPS location detected! 📍");
                    })
                    .finally(() => {
                        detectLocationBtn.disabled = false;
                        detectLocationBtn.innerHTML = originalText;
                        if (window.lucide) window.lucide.createIcons();
                    });
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

    // Geocoding Manual Address Distance calculator click handler integrated with Leaflet map
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

                    // Update Leaflet map and marker coordinates dynamically based on search results
                    if (checkoutMap && deliveryMarker) {
                        const latlng = { lat: lat, lng: lon };
                        deliveryMarker.setLatLng(latlng);
                        checkoutMap.setView([lat, lon], 15);

                        // Update connecting dotted polyline
                        const points = [[STORE_LAT, STORE_LNG], [lat, lon]];
                        if (routeLine) {
                            routeLine.setLatLngs(points);
                        } else {
                            routeLine = L.polyline(points, {
                                color: '#1b4332',
                                weight: 3.5,
                                dashArray: '6, 8',
                                opacity: 0.75
                            }).addTo(checkoutMap);
                        }

                        deliveryMarker.bindPopup(`
                            <div class="delivery-popup-title">📍 Searched Pin</div>
                            <div style="font-size: 0.72rem; color: var(--text-medium); margin-top: 4px;">Distance: ${dist.toFixed(1)} km</div>
                        `).openPopup();
                    }

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
            
            // Load store settings dynamically to construct payee UPI ID
            fetch("/api/settings")
            .then(res => {
                if (!res.ok) throw new Error("Could not fetch store settings");
                return res.json();
            })
            .then(data => {
                const storeUpi = data.store_upi_id || "9078445116@ybl";
                const transactionRef = `MB${Date.now()}`;
                const upiLink = `upi://pay?pa=${storeUpi}&pn=MaaBankeswariStore&mc=5411&tr=${transactionRef}&am=${grandTotal.toFixed(2)}&cu=INR&tn=MaaBankeswariOrder`;
                
                // Get QR Code image element directly by ID
                const qrImage = document.getElementById("checkout-qr-image");
                if (qrImage) {
                    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiLink)}`;
                }
                
                // Add a dynamic click to pay button for mobile phone users
                let payButton = document.getElementById("pay-via-app-btn");
                if (!payButton && upiInfoPanel) {
                    payButton = document.createElement("a");
                    payButton.id = "pay-via-app-btn";
                    payButton.className = "btn btn-primary";
                    payButton.style.display = "inline-flex";
                    payButton.style.alignItems = "center";
                    payButton.style.justifyContent = "center";
                    payButton.style.gap = "6px";
                    payButton.style.width = "100%";
                    payButton.style.height = "38px";
                    payButton.style.marginTop = "12px";
                    payButton.style.fontSize = "0.85rem";
                    payButton.style.fontWeight = "700";
                    payButton.style.textDecoration = "none";
                    
                    const qrWrapper = upiInfoPanel.querySelector(".qr-code-wrapper");
                    if (qrWrapper) {
                        qrWrapper.appendChild(payButton);
                    }
                }
                
                if (payButton) {
                    payButton.href = upiLink;
                    payButton.innerHTML = `📱 Tap to Pay ₹${grandTotal.toFixed(2)} in UPI App`;
                }
            })
            .catch(err => {
                console.error("Error setting dynamic UPI QR code:", err);
            });
            
            // For UPI, verify if a receipt image is uploaded
            if (uploadedReceiptUrl) {
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
                
                // Hide any previous mismatch error banner
                const mismatchBanner = document.getElementById("receipt-mismatch-error-banner");
                if (mismatchBanner) mismatchBanner.style.display = "none";
                
                // Pack file in FormData
                const formData = new FormData();
                formData.append("file", file);

                if (receiptFilenameDisplay) {
                    receiptFilenameDisplay.innerText = `⏳ Uploading: ${file.name}...`;
                    receiptFilenameDisplay.style.display = "block";
                    receiptFilenameDisplay.style.color = "var(--text-medium)";
                }

                if (confirmPlaceOrderBtn) {
                    confirmPlaceOrderBtn.disabled = true;
                    confirmPlaceOrderBtn.innerText = "Uploading...";
                }

                fetch("/api/orders/upload-receipt", {
                    method: "POST",
                    body: formData
                })
                .then(response => {
                    if (!response.ok) throw new Error("Receipt upload failed");
                    return response.json();
                })
                .then(data => {
                    uploadedReceiptUrl = data.receipt_image_url;
                    showToast("Payment receipt uploaded successfully! 🌾");
                    if (receiptFilenameDisplay) {
                        receiptFilenameDisplay.innerText = `📄 Uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                        receiptFilenameDisplay.style.display = "block";
                        receiptFilenameDisplay.style.color = "var(--success)";
                    }
                    if (receiptUploadTrigger) {
                        receiptUploadTrigger.innerHTML = `<i data-lucide="check-circle" style="width: 15px; height: 15px;"></i> Change Receipt`;
                        if (window.lucide) window.lucide.createIcons();
                    }
                })
                .catch(err => {
                    console.error("Receipt upload error:", err);
                    showToast("Failed to upload receipt. Please retry!");
                    uploadedReceiptUrl = null;
                    if (receiptFilenameDisplay) {
                        receiptFilenameDisplay.innerText = `❌ Upload Failed: ${file.name}`;
                        receiptFilenameDisplay.style.display = "block";
                        receiptFilenameDisplay.style.color = "var(--danger)";
                    }
                    if (receiptUploadTrigger) {
                        receiptUploadTrigger.innerHTML = `<i data-lucide="upload" style="width: 15px; height: 15px;"></i> Choose Receipt Image`;
                        if (window.lucide) window.lucide.createIcons();
                    }
                })
                .finally(() => {
                    if (confirmPlaceOrderBtn) {
                        confirmPlaceOrderBtn.innerText = "Verify & Place Order";
                    }
                    updatePaymentMethodUI();
                });
            } else {
                uploadedReceiptUrl = null;
                if (receiptFilenameDisplay) receiptFilenameDisplay.style.display = "none";
                if (receiptUploadTrigger) {
                    receiptUploadTrigger.innerHTML = `<i data-lucide="upload" style="width: 15px; height: 15px;"></i> Choose Receipt Image`;
                    if (window.lucide) window.lucide.createIcons();
                }
                updatePaymentMethodUI();
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
                if (!uploadedReceiptUrl) {
                    showToast("Please upload the payment receipt to place order!");
                    return;
                }
            }

            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const grandTotal = subtotal + calculatedDeliveryCharge;

            // Construct transactional payload with initial status Pending Approval
            const deliveryLatLng = deliveryMarker ? deliveryMarker.getLatLng() : null;
            const orderPayload = {
                user_id: currentUser ? currentUser.id : null,
                items_json: JSON.stringify(cart),
                total_price: grandTotal,
                delivery_address: address,
                distance_km: calculatedDistance,
                delivery_charge: calculatedDeliveryCharge,
                payment_method: selectedPaymentMethod,
                order_status: "Pending Approval",
                receipt_image_url: uploadedReceiptUrl,
                phone_number: currentUser ? currentUser.phone_number : "",
                delivery_lat: deliveryLatLng ? deliveryLatLng.lat : null,
                delivery_lng: deliveryLatLng ? deliveryLatLng.lng : null
            };

            // Disable button during network round-trip
            confirmPlaceOrderBtnVal.disabled = true;
            const originalText = confirmPlaceOrderBtnVal.innerText;
            confirmPlaceOrderBtnVal.innerText = "Placing Order...";

            // Send transactional order data to FastAPI server
            fetch("/api/orders/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(orderPayload)
            })
            .then(async response => {
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    const detail = errData.detail || "Checkout request failed.";
                    throw new Error(detail);
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
                
                if (selectedPaymentMethod === "UPI") {
                    const mismatchBanner = document.getElementById("receipt-mismatch-error-banner");
                    const mismatchText = document.getElementById("receipt-mismatch-error-text");
                    
                    if (mismatchBanner && mismatchText) {
                        mismatchText.innerText = error.message || "The uploaded image failed receipt amount verification or security checks.";
                        mismatchBanner.style.display = "block";
                        
                        // Smoothly scroll the error banner into view inside modal
                        mismatchBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                    
                    // Reset the uploaded receipt states so they are forced to reupload a new one
                    uploadedReceiptUrl = null;
                    const receiptFilenameDisplay = document.getElementById("receipt-filename-display");
                    if (receiptFilenameDisplay) {
                        receiptFilenameDisplay.style.display = "none";
                        receiptFilenameDisplay.innerText = "";
                    }
                    const receiptUploadTrigger = document.getElementById("receipt-upload-trigger");
                    if (receiptUploadTrigger) {
                        receiptUploadTrigger.innerHTML = `<i data-lucide="upload" style="width: 15px; height: 15px;"></i> Choose Receipt Image`;
                        if (window.lucide) window.lucide.createIcons();
                    }
                    const paymentReceiptInput = document.getElementById("payment-receipt-input");
                    if (paymentReceiptInput) {
                        paymentReceiptInput.value = "";
                    }
                    updatePaymentMethodUI();
                }
                
                showToast(error.message || "Could not process order. Please try again!");
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

    // OTP State Variables
    let activeOTP = "";
    let pendingUserPayload = null;

    const otpModal = document.getElementById("otp-modal");
    const closeOtpBtn = document.getElementById("close-otp");
    const otpVerifyBtn = document.getElementById("otp-verify-btn");
    const otpResendBtn = document.getElementById("otp-resend-btn");
    const otpCodeInput = document.getElementById("otp-code-input");
    const otpPhoneDisplay = document.getElementById("otp-phone-display");
    const mockSmsToast = document.getElementById("mock-sms-toast");
    const mockOtpVal = document.getElementById("mock-otp-val");

    function closeOtpModal() {
        if (otpModal) {
            otpModal.classList.remove("active");
        }
        document.body.style.overflow = "";
    }

    if (closeOtpBtn) {
        closeOtpBtn.addEventListener("click", closeOtpModal);
    }

    // Function to trigger mock SMS simulation alert
    function triggerMockSMS(phone, code) {
        if (otpPhoneDisplay) otpPhoneDisplay.innerText = phone;
        if (mockOtpVal) mockOtpVal.innerText = code;
        if (mockSmsToast) {
            mockSmsToast.style.display = "block";
            // Pulse chime for SMS arrival sound!
            setTimeout(() => {
                playChime("add"); 
                showToast(`💬 SMS received on ${phone}!`);
            }, 500);
        }
    }

    // Registration Form Submission -> Intercept and trigger OTP
    if (registerForm) {
        registerForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const fullnameInput = document.getElementById("reg-fullname");
            const usernameInput = document.getElementById("reg-username");
            const emailInput = document.getElementById("reg-email");
            const phoneInput = document.getElementById("reg-phone");
            const passwordInput = document.getElementById("reg-password");

            if (!fullnameInput || !usernameInput || !emailInput || !phoneInput || !passwordInput) return;

            const phone = phoneInput.value.trim();
            if (phone.length < 10) {
                showToast("Please enter a valid 10-digit phone number!", false);
                return;
            }

            // Save payload for subsequent database registration upon verification
            pendingUserPayload = {
                fullname: fullnameInput.value.trim(),
                username: usernameInput.value.trim(),
                email: emailInput.value.trim(),
                phone_number: phone,
                password: passwordInput.value
            };

            // Generate a secure 6-digit OTP code on the fly
            activeOTP = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Close register modal & open OTP modal
            closeAuthModal();
            if (otpModal) {
                otpModal.classList.add("active");
                document.body.style.overflow = "hidden";
            }
            if (otpCodeInput) otpCodeInput.value = "";

            // Simulate SMS routing
            triggerMockSMS(phone, activeOTP);
        });
    }

    // Resend OTP Simulator Click Handler
    if (otpResendBtn) {
        otpResendBtn.addEventListener("click", () => {
            if (!pendingUserPayload) return;
            activeOTP = Math.floor(100000 + Math.random() * 900000).toString();
            if (otpCodeInput) otpCodeInput.value = "";
            triggerMockSMS(pendingUserPayload.phone_number, activeOTP);
            showToast("Simulated SMS OTP resent successfully! 🌾");
        });
    }

    // Verify OTP & Complete Backend Registration
    if (otpVerifyBtn) {
        otpVerifyBtn.addEventListener("click", () => {
            const enteredOTP = otpCodeInput ? otpCodeInput.value.trim() : "";
            if (enteredOTP.length !== 6) {
                showToast("Please enter the complete 6-digit OTP code!", false);
                return;
            }

            if (enteredOTP !== activeOTP) {
                playChime("reject");
                showToast("Verification Failed: Invalid OTP code! ❌", false);
                return;
            }

            // OTP verified! Submit payload to database
            otpVerifyBtn.disabled = true;
            const originalText = otpVerifyBtn.innerText;
            otpVerifyBtn.innerText = "Registering...";

            fetch("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(pendingUserPayload)
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
                closeOtpModal();
                playChime("order"); // Upward chord success sound
                showToast(`Welcome to Maa Bankeswari Store, ${user.fullname}! 🎉`);

                // Reset forms
                const fullnameInput = document.getElementById("reg-fullname");
                const usernameInput = document.getElementById("reg-username");
                const emailInput = document.getElementById("reg-email");
                const phoneInput = document.getElementById("reg-phone");
                const passwordInput = document.getElementById("reg-password");
                if (fullnameInput) fullnameInput.value = "";
                if (usernameInput) usernameInput.value = "";
                if (emailInput) emailInput.value = "";
                if (phoneInput) phoneInput.value = "";
                if (passwordInput) passwordInput.value = "";
                
                pendingUserPayload = null;
                activeOTP = "";
            })
            .catch((err) => {
                console.error("OTP Registration submit failed:", err);
                showToast(err.message || "Could not register account.", false);
            })
            .finally(() => {
                if (otpVerifyBtn) {
                    otpVerifyBtn.disabled = false;
                    otpVerifyBtn.innerText = originalText;
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

                        let trackBtnHTML = "";
                        if (order.order_status === "Approved") {
                            trackBtnHTML = `
                                <button class="btn btn-primary track-delivery-btn" 
                                    data-id="${order.id}" 
                                    data-lat="${order.delivery_lat || ''}" 
                                    data-lng="${order.delivery_lng || ''}" 
                                    data-distance="${order.distance_km || ''}" 
                                    style="height: 32px; font-size: 0.8rem; border-radius: var(--radius-sm); margin-top: 8px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;">
                                    <i data-lucide="map-pin" style="width: 14px; height: 14px;"></i> Track Live Delivery
                                </button>
                            `;
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
                                ${trackBtnHTML}
                            </div>
                        `;
                        historyItemsContainer.insertAdjacentHTML("beforeend", orderCardHTML);
                    });

                    // Bind click handlers to track-delivery-btn elements
                    const trackBtns = historyItemsContainer.querySelectorAll(".track-delivery-btn");
                    trackBtns.forEach(btn => {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            const orderId = parseInt(btn.getAttribute("data-id"));
                            const lat = parseFloat(btn.getAttribute("data-lat")) || null;
                            const lng = parseFloat(btn.getAttribute("data-lng")) || null;
                            const distance = parseFloat(btn.getAttribute("data-distance")) || 5.0;
                            
                            // Close profile drawer first
                            closeProfileDrawer();
                            
                            // Launch live tracking map modal
                            openTrackingModal(orderId, lat, lng, distance);
                        };
                    });
                    
                    // Re-render Lucide icons inside history
                    if (window.lucide) window.lucide.createIcons();
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
    // CHATBOT WIDGET CONTROLLER ("LAXMI")
    // ----------------------------------------------------
    const chatbotLauncher = document.getElementById("chatbot-launcher");
    const chatbotWindow = document.getElementById("chatbot-window");
    const chatbotCloseBtn = document.getElementById("chatbot-close-btn");
    const chatbotInputForm = document.getElementById("chatbot-input-form");
    const chatbotUserInput = document.getElementById("chatbot-user-input");
    const chatbotMessagesLog = document.getElementById("chatbot-messages-log");
    const chatbotPromptContainer = document.getElementById("chatbot-prompt-container");

    // Chatbot Welcome Greeting Dialog
    function initializeChatbot() {
        if (!chatbotMessagesLog) return;
        chatbotMessagesLog.innerHTML = "";
        
        appendBotMessage("Namaste! 🙏 Welcome to **Maa Bankeswari Rice Store**! I am **Laxmi**, your virtual grain assistant. How can I help you choose the perfect premium grains or check details today? 🌾");
    }

    // Toggle chatbot window drawer
    function toggleChatbot() {
        if (chatbotWindow) {
            chatbotWindow.classList.toggle("active");
            if (chatbotWindow.classList.contains("active")) {
                if (chatbotUserInput) chatbotUserInput.focus();
                // Play a pleasant add sound chime!
                playChime("add");
            }
        }
    }

    if (chatbotLauncher) chatbotLauncher.addEventListener("click", toggleChatbot);
    if (chatbotCloseBtn) chatbotCloseBtn.addEventListener("click", () => {
        if (chatbotWindow) chatbotWindow.classList.remove("active");
    });

    // Append standard user chat bubble
    function appendUserMessage(text) {
        if (!chatbotMessagesLog) return;
        const formatted = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const row = `
            <div class="chat-msg-row user-row">
                <div class="chat-bubble">${formatted}</div>
            </div>
        `;
        chatbotMessagesLog.insertAdjacentHTML("beforeend", row);
        chatbotMessagesLog.scrollTop = chatbotMessagesLog.scrollHeight;
    }

    // Append dynamic bot message bubble with markdown bold helpers
    function appendBotMessage(htmlContent) {
        if (!chatbotMessagesLog) return;
        
        // Custom simple bold parser to allow neat markdown layout (**bold**)
        const parsed = htmlContent
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>");
            
        const row = `
            <div class="chat-msg-row bot-row">
                <div class="chat-bubble">${parsed}</div>
            </div>
        `;
        chatbotMessagesLog.insertAdjacentHTML("beforeend", row);
        chatbotMessagesLog.scrollTop = chatbotMessagesLog.scrollHeight;
        
        if (window.lucide) window.lucide.createIcons();
    }

    // Show three bouncing typing indicator dots
    let typingIndicatorElement = null;
    function showTypingIndicator() {
        if (!chatbotMessagesLog || typingIndicatorElement) return;
        
        const html = `
            <div class="chat-msg-row bot-row" id="chatbot-typing-row">
                <div class="typing-indicator-bubble">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        chatbotMessagesLog.insertAdjacentHTML("beforeend", html);
        typingIndicatorElement = document.getElementById("chatbot-typing-row");
        chatbotMessagesLog.scrollTop = chatbotMessagesLog.scrollHeight;
    }

    // Hide typing indicator
    function removeTypingIndicator() {
        if (typingIndicatorElement) {
            typingIndicatorElement.remove();
            typingIndicatorElement = null;
        }
    }

    // Chatbot Local Fallback Keyword Match Ruleset
    function getFallbackChatbotResponse(query) {
        const lower = query.toLowerCase();
        if (lower.includes("hello") || lower.includes("hi ") || lower.includes("namaste") || lower.includes("hey")) {
            return "Hello there! 🙏 Hope you are having an amazing day. I am here to help you find premium aromatic rice, nutritious unpolished dals, or estimate delivery charges. How can I assist you? 🌾";
        } else if (lower.includes("price") || lower.includes("cost") || lower.includes("how much")) {
            return "We pride ourselves on offering **wholesale milling rates**! You can browse the storefront catalog to view live rates. For instance:\n" +
                   "- **Laxmi Premium Grains**: ₹65 / kg\n" +
                   "- **Special Basmati Rice**: ₹120 / kg\n" +
                   "- **Premium Biryani Rice**: ₹135 / kg\n" +
                   "- **Nutritious Moog Dal**: ₹100 / kg\n\n" +
                   "Simply click **Add** on any item to add it to your shopping basket! 🛍️";
        } else if (lower.includes("delivery") || lower.includes("charge") || lower.includes("fee") || lower.includes("km") || lower.includes("distance") || lower.includes("map")) {
            return "Our store is located at **Indradhanu Market, Nayapalli, Bhubaneswar** 📍. We calculate delivery charges dynamically:\n" +
                   "- **Rate**: ₹2.00 per kilometer\n" +
                   "- **Delivery Radius**: Up to 20 km max\n\n" +
                   "When you checkout, you can visually pin your location on our **interactive Leaflet Map**! The system will auto-calculate distance and add the delivery fee to your grand total seamlessly. 🚚";
        } else if (lower.includes("payment") || lower.includes("upi") || lower.includes("cash") || lower.includes("pay") || lower.includes("cod")) {
            return "We offer two convenient payment options at checkout:\n" +
                   "1. 💵 **Cash on Delivery (COD)**: Pay the operator directly when the grains arrive at your doorstep.\n" +
                   "2. 📱 **UPI Online Transfer**: Scan the QR code, upload your transaction receipt snapshot directly, and submit. The shopkeeper will verify it instantly! ⚡";
        } else if (lower.includes("offer") || lower.includes("discount") || lower.includes("deal") || lower.includes("special")) {
            return "✨ **Today's Special Store Offers**:\n" +
                   "- **10% OFF** on Organic Moog Dal bulk purchases!\n" +
                   "- **Free Delivery** estimates if you pick up directly from our storefront!\n" +
                   "- Aromatic Superfine Rice has been restocked direct from farm millings at a special price of just ₹55/kg!\n\n" +
                   "Add them to your basket today! 🌾";
        } else if (lower.includes("basmati") || lower.includes("biryani") || lower.includes("aromatic") || lower.includes("best rice")) {
            return "For special occasions and biryani, we highly recommend our **Special Basmati Rice (₹120/kg)** or **Premium Biryani Rice (₹135/kg)**. They feature extra-long grains and exquisite natural aroma! For daily home meals, **Laxmi Premium Grains (₹65/kg)** is a household favorite. 🌾";
        } else if (lower.includes("dal") || lower.includes("pulses") || lower.includes("moog") || lower.includes("harada")) {
            return "We stock nutrient-dense, high-protein **Organic Moog Dal (₹100/kg)** which is hand-sorted and unpolished to retain 100% natural nourishment. Perfect for a healthy family meal! 🍲";
        } else if (lower.includes("order") || lower.includes("how to buy") || lower.includes("checkout")) {
            return "It is extremely easy to order!\n" +
                   "1. Click **Add** on your favorite rice or dals.\n" +
                   "2. Open **My Cart** in the top right.\n" +
                   "3. Click **Proceed to Checkout**.\n" +
                   "4. Pin your location on the Leaflet Map, select a payment method, and click **Verify & Place Order**!\n\n" +
                   "Once placed, the shopkeeper receives it in real-time, processes your request, and contacts you! 🛒";
        } else if (lower.includes("contact") || lower.includes("owner") || lower.includes("phone") || lower.includes("number") || lower.includes("whatsapp")) {
            return "You can connect with the store manager directly:\n" +
                   "- 📞 **Phone Call**: +91 9776400523\n" +
                   "- 💬 **WhatsApp**: +91 9078445116\n" +
                   "- 📍 **Address**: Indradhanu Market, IRC Village, Nayapalli, Bhubaneswar, Odisha\n\n" +
                   "We are happy to answer bulk wholesale questions! 🌾";
        } else {
            return "I appreciate your message! I'm constantly learning about premium grains. If you have questions about rice types, dals, delivery estimation (₹2/km), or online UPI payments, please ask! Or you can directly connect with our shop operator at **+91 9776400523**! 🌾";
        }
    }

    // Chatbot Smart Response Generator Router calling Backend AI
    function processUserMessage(query) {
        showTypingIndicator();
        
        // Push user query to history
        chatHistory.push({ role: "user", parts: query });

        fetch("/api/chatbot", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: query,
                history: chatHistory.slice(0, -1).slice(-6) // Up to last 6 chat items (excluding the latest query)
            })
        })
        .then(async (response) => {
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || "Chatbot API call failed");
            }
            return response.json();
        })
        .then((data) => {
            removeTypingIndicator();
            appendBotMessage(data.reply);
            chatHistory.push({ role: "model", parts: data.reply });
        })
        .catch((err) => {
            console.warn("Maa Bankeswari Chatbot: API fallback to keyword ruleset:", err);
            // Fallback response with slight artificial delay
            setTimeout(() => {
                removeTypingIndicator();
                const fallbackResponse = getFallbackChatbotResponse(query);
                appendBotMessage(fallbackResponse);
                chatHistory.push({ role: "model", parts: fallbackResponse });
            }, 600);
        });
    }

    // Input form submit handler
    if (chatbotInputForm) {
        chatbotInputForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const text = chatbotUserInput.value.trim();
            if (!text) return;

            appendUserMessage(text);
            chatbotUserInput.value = "";
            processUserMessage(text);
        });
    }

    // Prompt Chips quick click handler
    if (chatbotPromptContainer) {
        chatbotPromptContainer.addEventListener("click", (e) => {
            const chip = e.target.closest(".chat-prompt-chip");
            if (!chip) return;

            const query = chip.getAttribute("data-query");
            appendUserMessage(query);
            processUserMessage(query);
        });
    }

    // ----------------------------------------------------
    // LIVE ORDER TRACING & MAP SIMULATION SYSTEM
    // ----------------------------------------------------
    let trackingMap = null;
    let trackingStoreMarker = null;
    let trackingUserMarker = null;
    let trackingBoyMarker = null;
    let trackingRouteLine = null;
    let trackingAnimationInterval = null;

    const trackingModal = document.getElementById("tracking-modal");
    const closeTrackingModal = document.getElementById("close-tracking-modal");

    function closeTrackingModalFn() {
        if (trackingModal) {
            trackingModal.classList.remove("active");
            document.body.style.overflow = "";
        }
        if (trackingAnimationInterval) {
            clearInterval(trackingAnimationInterval);
            trackingAnimationInterval = null;
        }
    }

    if (closeTrackingModal) {
        closeTrackingModal.addEventListener("click", closeTrackingModalFn);
    }
    if (trackingModal) {
        trackingModal.addEventListener("click", (e) => {
            if (e.target === trackingModal) {
                closeTrackingModalFn();
            }
        });
    }

    function openTrackingModal(orderId, deliveryLat, deliveryLng, distanceKm) {
        if (trackingModal) {
            trackingModal.classList.add("active");
            document.body.style.overflow = "hidden";
        }

        const orderIdEl = document.getElementById("tracking-order-id");
        if (orderIdEl) orderIdEl.innerText = `#${orderId}`;

        const statusBadge = document.getElementById("tracking-status-badge");
        if (statusBadge) {
            statusBadge.innerText = "Order Confirmed";
            statusBadge.style.color = "var(--primary)";
            statusBadge.style.backgroundColor = "var(--primary-ultra-light)";
            statusBadge.style.borderColor = "rgba(45,106,79,0.15)";
        }

        // Reset progress bar
        const progressBar = document.getElementById("tracking-progress-bar");
        if (progressBar) progressBar.style.width = "0%";

        // Reset timeline steps
        const steps = [1, 2, 3, 4].map(num => document.getElementById(`tracking-step-${num}`));
        steps.forEach(step => {
            if (step) {
                step.className = "";
                const dot = step.querySelector(".timeline-dot");
                if (dot) {
                    dot.style.backgroundColor = "var(--text-light)";
                    dot.style.boxShadow = "0 0 0 2px var(--text-light)";
                }
                const label = step.querySelector("span");
                if (label) {
                    label.style.color = "var(--text-medium)";
                    label.style.fontWeight = "400";
                }
            }
        });

        // Clear any running animation
        if (trackingAnimationInterval) {
            clearInterval(trackingAnimationInterval);
            trackingAnimationInterval = null;
        }

        // Use defaults if coordinates are missing (prevent issues with old test data)
        const finalLat = deliveryLat || (STORE_LAT + 0.015 + Math.random() * 0.01);
        const finalLng = deliveryLng || (STORE_LNG + 0.015 + Math.random() * 0.01);
        const distance = distanceKm || calculateHaversineDistance(STORE_LAT, STORE_LNG, finalLat, finalLng);

        // Initialize map
        setTimeout(() => {
            if (!trackingMap) {
                try {
                    trackingMap = L.map('tracking-map', {
                        zoomControl: true,
                        attributionControl: false
                    }).setView([STORE_LAT, STORE_LNG], 14);

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 19
                    }).addTo(trackingMap);
                } catch (e) {
                    console.error("Leaflet loading error:", e);
                    return;
                }
            } else {
                trackingMap.invalidateSize();
                // Remove old layers
                if (trackingStoreMarker) trackingMap.removeLayer(trackingStoreMarker);
                if (trackingUserMarker) trackingMap.removeLayer(trackingUserMarker);
                if (trackingBoyMarker) trackingMap.removeLayer(trackingBoyMarker);
                if (trackingRouteLine) trackingMap.removeLayer(trackingRouteLine);
            }

            // Custom Icons
            const storeIcon = L.divIcon({
                className: 'store-custom-marker',
                html: `<div style="background-color: var(--primary); border: 2px solid var(--accent); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; box-shadow: var(--shadow-md);">🌾</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const userIcon = L.divIcon({
                className: 'user-custom-marker',
                html: `<div style="background-color: var(--accent); border: 2px solid var(--primary-dark); color: var(--primary-dark); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; box-shadow: var(--shadow-md); transform-origin: bottom center;">🏠</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const boyIcon = L.divIcon({
                className: 'delivery-boy-marker',
                html: `<div style="background-color: var(--primary-light); border: 2px solid var(--white); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; box-shadow: var(--shadow-md); animation: marker-float 1.5s infinite ease-in-out;">🛵</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            // Add markers
            trackingStoreMarker = L.marker([STORE_LAT, STORE_LNG], { icon: storeIcon }).addTo(trackingMap)
                .bindPopup("<div class='store-popup-title'>🌾 Maa Bankeswari Store</div>");
            
            trackingUserMarker = L.marker([finalLat, finalLng], { icon: userIcon }).addTo(trackingMap)
                .bindPopup("<div class='delivery-popup-title'>📍 Your Location</div>");

            // Route path
            trackingRouteLine = L.polyline([[STORE_LAT, STORE_LNG], [finalLat, finalLng]], {
                color: '#40916c',
                weight: 3.5,
                dashArray: '6, 8',
                opacity: 0.75
            }).addTo(trackingMap);

            // Center map to show both markers
            const bounds = L.latLngBounds([[STORE_LAT, STORE_LNG], [finalLat, finalLng]]);
            trackingMap.fitBounds(bounds, { padding: [40, 40] });

            // Initialize Delivery Boy at Store Location
            trackingBoyMarker = L.marker([STORE_LAT, STORE_LNG], { icon: boyIcon }).addTo(trackingMap);

            // Start position simulation
            const startTime = Date.now();
            const animationDuration = 45000; // 45 seconds total journey duration
            
            const distanceEl = document.getElementById("tracking-distance-val");
            const etaEl = document.getElementById("tracking-eta-val");

            function setStepStatus(stepNum, status) {
                const step = document.getElementById(`tracking-step-${stepNum}`);
                if (!step) return;
                
                const dot = step.querySelector(".timeline-dot");
                const label = step.querySelector("span");
                
                if (status === "active") {
                    step.classList.remove("step-done");
                    step.classList.add("step-active");
                    if (dot) {
                        dot.style.backgroundColor = "";
                        dot.style.boxShadow = "";
                    }
                    if (label) {
                        label.style.color = "";
                        label.style.fontWeight = "";
                    }
                } else if (status === "done") {
                    step.classList.remove("step-active");
                    step.classList.add("step-done");
                    if (dot) {
                        dot.style.backgroundColor = "";
                        dot.style.boxShadow = "";
                    }
                    if (label) {
                        label.style.color = "";
                        label.style.fontWeight = "";
                    }
                }
            }

            trackingAnimationInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(1.0, elapsed / animationDuration);

                // Update coordinates
                const currLat = STORE_LAT + (finalLat - STORE_LAT) * progress;
                const currLng = STORE_LNG + (finalLng - STORE_LNG) * progress;
                trackingBoyMarker.setLatLng([currLat, currLng]);

                // Update UI stats
                const remainingDist = (distance * (1 - progress)).toFixed(2);
                const remainingETA = Math.ceil(remainingDist * 3);

                if (distanceEl) distanceEl.innerText = `${remainingDist} km`;
                if (etaEl) etaEl.innerText = progress >= 0.98 ? "Arrived!" : `${remainingETA} mins`;

                if (progressBar) progressBar.style.width = `${progress * 100}%`;

                // Update status timeline
                if (progress >= 0.98) {
                    if (statusBadge) {
                        statusBadge.innerText = "Arrived";
                        statusBadge.style.color = "var(--success)";
                        statusBadge.style.backgroundColor = "rgba(46,125,50,0.08)";
                        statusBadge.style.borderColor = "var(--success)";
                    }
                    setStepStatus(1, "done");
                    setStepStatus(2, "done");
                    setStepStatus(3, "done");
                    setStepStatus(4, "active");
                    
                    clearInterval(trackingAnimationInterval);
                    trackingAnimationInterval = null;
                    
                    showToast("🛵 Your delivery boy has arrived at your location!");
                    playChime("order");
                } else if (progress >= 0.5) {
                    if (statusBadge) {
                        statusBadge.innerText = "Out for Delivery";
                        statusBadge.style.color = "var(--warning)";
                        statusBadge.style.backgroundColor = "rgba(239,108,0,0.08)";
                        statusBadge.style.borderColor = "var(--warning)";
                    }
                    setStepStatus(1, "done");
                    setStepStatus(2, "done");
                    setStepStatus(3, "active");
                    setStepStatus(4, "");
                } else if (progress >= 0.15) {
                    if (statusBadge) {
                        statusBadge.innerText = "Dispatched";
                        statusBadge.style.color = "var(--primary)";
                        statusBadge.style.backgroundColor = "var(--primary-ultra-light)";
                        statusBadge.style.borderColor = "var(--primary)";
                    }
                    setStepStatus(1, "done");
                    setStepStatus(2, "active");
                    setStepStatus(3, "");
                    setStepStatus(4, "");
                } else {
                    if (statusBadge) {
                        statusBadge.innerText = "Order Confirmed";
                        statusBadge.style.color = "var(--primary)";
                        statusBadge.style.backgroundColor = "var(--primary-ultra-light)";
                        statusBadge.style.borderColor = "rgba(45,106,79,0.15)";
                    }
                    setStepStatus(1, "active");
                    setStepStatus(2, "");
                    setStepStatus(3, "");
                    setStepStatus(4, "");
                }
            }, 100);

        }, 200);
    }

    // ----------------------------------------------------
    // BACKGROUND REAL-TIME ORDER STATUS POLLING
    // ----------------------------------------------------
    let orderPollingInterval = null;
    let knownApprovedOrders = new Set();
    let isFirstPoll = true;

    function initUserPolling() {
        if (!currentUser) return;
        
        stopUserPolling();
        
        knownApprovedOrders.clear();
        isFirstPoll = true;
        
        // Pre-populate known approved orders silently to avoid redundant alerts on reload
        fetch(`/api/users/${currentUser.id}/orders`)
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(orders => {
            orders.forEach(o => {
                if (o.order_status === "Approved") {
                    knownApprovedOrders.add(o.id);
                }
            });
            isFirstPoll = false;
        })
        .catch(() => {
            isFirstPoll = false;
        });

        // Poll every 6 seconds
        orderPollingInterval = setInterval(pollOrderStatus, 6000);
    }

    function stopUserPolling() {
        if (orderPollingInterval) {
            clearInterval(orderPollingInterval);
            orderPollingInterval = null;
        }
        knownApprovedOrders.clear();
        isFirstPoll = true;
    }

    function pollOrderStatus() {
        if (!currentUser) return;
        
        fetch(`/api/users/${currentUser.id}/orders`)
        .then(response => {
            if (!response.ok) throw new Error("Could not poll orders");
            return response.json();
        })
        .then(orders => {
            let justApprovedOrder = null;
            
            orders.forEach(order => {
                if (order.order_status === "Approved") {
                    if (!knownApprovedOrders.has(order.id)) {
                        knownApprovedOrders.add(order.id);
                        if (!isFirstPoll) {
                            justApprovedOrder = order;
                        }
                    }
                }
            });
            
            isFirstPoll = false;
            
            if (justApprovedOrder) {
                // Play notification sound, show toast, and launch live tracking map suddenly!
                playChime("order");
                showToast(`🎉 Order #${justApprovedOrder.id} has been approved! Live delivery tracking started.`);
                
                // Refresh drawer metrics and order list if currently open
                fetchOrderHistory();
                
                // Launch tracking modal
                openTrackingModal(
                    justApprovedOrder.id, 
                    justApprovedOrder.delivery_lat, 
                    justApprovedOrder.delivery_lng, 
                    justApprovedOrder.distance_km
                );
            }
        })
        .catch(err => {
            console.warn("Silent order polling error:", err);
        });
    }

    // Load initial conversation states
    initializeChatbot();

    // ----------------------------------------------------
    // INITIALIZATION RUN
    // ----------------------------------------------------
    loadCart();
    loadUser();
    syncAllUI();

    if (currentUser) {
        initUserPolling();
    }
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
