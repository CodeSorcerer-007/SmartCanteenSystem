const user = getUser();
if(user) document.getElementById('user-display').innerText = user.username;

let menu = [];
let cart = JSON.parse(localStorage.getItem('canteen_cart') || '{}');
let currentCategory = 'All';

// Dark mode handled in student.html


async function updateWallet() {
    try {
        const res = await apiCall(`/auth/wallet/${user.id}`);
        document.getElementById('wallet-balance').innerText = '\u20b9' + parseFloat(res.balance).toFixed(2);
    } catch(e) {
        console.error("Failed to load wallet", e);
    }
}

function _clearSkeletons() {
    ['skel-1','skel-2','skel-3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
}

async function loadMenu() {
    try {
        menu = await apiCall(`/menu/?user_id=${user.id}`);
        _clearSkeletons();
        renderCategories();
        renderMenu();
    } catch (e) {
        _clearSkeletons();
        console.error("Load Menu Error:", e);
        const c = document.getElementById('menu-container');
        if (c) c.innerHTML = `<p class="text-muted" style="grid-column:1/-1; text-align:center; padding:3rem;">⚠️ Connection Error: ${e.message}. Please hard-refresh (Ctrl+F5).</p>`;
    }
}

function renderCategories() {
    const categories = [...new Set(menu.map(m => m.category || 'Uncategorized'))];
    const catContainer = document.getElementById('category-filters');
    if (!catContainer) return;
    
    catContainer.innerHTML = ''; // Clear existing buttons
    
    ['All', ...categories, 'Favorites'].forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `btn ${currentCategory === cat ? 'primary-btn' : 'outline'}`;
        btn.style = "border-radius: 20px; white-space: nowrap; padding: 0.25rem 1rem;";
        btn.innerHTML = cat === 'Favorites' ? `<i style="color:#ff4757">♥</i> Favorites` : cat;
        btn.onclick = () => {
            filterCategory(cat);
        };
        catContainer.appendChild(btn);
    });
}

function filterCategory(cat) {
    currentCategory = cat;
    renderCategories(); // re-render to update active states correctly
    renderMenu();
}

function renderMenu() {
    const c = document.getElementById('menu-container');
    const searchVal = document.getElementById('menu-search') ? document.getElementById('menu-search').value.toLowerCase() : '';
    
    let itemsToShow = menu.filter(m => {
        const matchSearch = m.name.toLowerCase().includes(searchVal) || (m.description && m.description.toLowerCase().includes(searchVal));
        return matchSearch;
    });

    if (currentCategory === 'Favorites') {
        itemsToShow = itemsToShow.filter(m => m.is_favorite);
    } else if (currentCategory !== 'All') {
        itemsToShow = itemsToShow.filter(m => (m.category || 'Uncategorized') === currentCategory);
    }
    
    if (itemsToShow.length === 0) {
        c.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 3rem;">No items matched your search.</p>';
        return;
    }
    
    c.innerHTML = itemsToShow.map((item, index) => {
        const outOfStock = item.stock <= 0;
        const stockBadge = `<span class="stock-badge">${item.stock} left</span>`;
        let actionBtn;
        
        if (cart[item.id] > 0) {
            actionBtn = `
                <div class="card-actions" style="margin-top: 1.5rem; justify-content: space-between;">
                    <button class="qty-btn" style="width:40px; height:40px; font-size:1.2rem;" onclick="removeFromCart(${item.id})">−</button>
                    <span style="font-weight: 800; font-size: 1.1rem;">${cart[item.id]} in cart</span>
                    <button class="qty-btn" style="width:40px; height:40px; font-size:1.2rem; background: var(--primary-color); color: white;" onclick="addToCart(${item.id})">+</button>
                </div>
            `;
        } else if (outOfStock) {
            actionBtn = `<button class="btn outline w-100" style="margin-top: 1.5rem;" disabled>Out of Stock</button>`;
        } else {
            actionBtn = `<button class="btn primary-btn w-100" style="margin-top: 1.5rem;" onclick="addToCart(${item.id})">Add to Cart</button>`;
        }

        const heartClass = item.is_favorite ? 'active' : '';
        const heartBtn = `<button class="heart-btn" onclick="toggleFavorite(${item.id})"><i class="heart-icon ${heartClass}">♥</i></button>`;
        const ratingBadge = item.review_count > 0 
            ? `<div style="position:absolute; bottom:10px; right:10px; background:rgba(255,255,255,0.9); padding:0.2rem 0.5rem; border-radius:12px; font-size:0.8rem; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.1); z-index:10; color:#333;">⭐ ${Number(item.average_rating).toFixed(1)} (${item.review_count})</div>` : '';

        let dt = item.diet_type || 'Veg';
        let dtColor = dt === 'Veg' ? '#2ed573' : dt === 'Non-Veg' ? '#ff4757' : '#f1c40f';
        let dtIcon = dt === 'Veg' ? '🟢' : dt === 'Non-Veg' ? '🔴' : '🟡';
        let dietTag = `<span style="border:1px solid ${dtColor}; color:${dtColor}; padding:0.1rem 0.4rem; font-size:0.7rem; border-radius:4px; margin-left:0.5rem; font-weight:800; white-space:nowrap;">${dtIcon} ${dt}</span>`;

        return `
        <div class="card glass-panel animate-fade-up" style="padding:0; position:relative; animation-delay: ${index * 0.05}s">
            ${heartBtn}
            ${stockBadge}
            <img src="${item.image_url || 'https://via.placeholder.com/300'}" alt="${item.name}" class="card-img" style="opacity: ${outOfStock ? 0.5 : 1}">
            ${ratingBadge}
            <div class="card-body">
                <div class="card-title">
                    <h3 style="display:flex; align-items:center;">${item.name} ${dietTag}</h3>
                    <span class="card-price">₹${item.price}</span>
                </div>
                <p class="card-desc">${item.description}</p>
                ${actionBtn}
            </div>
        </div>
        `;
    }).join('');
}

async function toggleFavorite(itemId) {
    try {
        await apiCall('/interactions/favorites/toggle', 'POST', { user_id: user.id, menu_item_id: itemId });
        loadMenu(); 
    } catch(e) {
        showToast("Error saving favorite", 'error');
    }
}

function addToCart(itemId) {
    const item = menu.find(m => m.id === itemId);
    const currentQty = cart[itemId] || 0;
    
    if (currentQty >= item.stock) {
        showToast(`Only ${item.stock} of ${item.name} available!`, 'error');
        return;
    }
    
    cart[itemId] = currentQty + 1;
    localStorage.setItem('canteen_cart', JSON.stringify(cart));
    renderCart();
    renderMenu();
}

function removeFromCart(itemId) {
    if (!cart[itemId]) return;
    
    cart[itemId] -= 1;
    if (cart[itemId] <= 0) {
        delete cart[itemId];
    }
    localStorage.setItem('canteen_cart', JSON.stringify(cart));
    renderCart();
    renderMenu();
}

function renderCart() {
    const itemsContainer = document.getElementById('cart-items');
    let total = 0;
    
    // Update cart badge
    const badge = document.getElementById('cart-badge');
    const itemCount = Object.values(cart).reduce((a,b) => a+b, 0);
    if (badge) {
        badge.innerText = itemCount;
        badge.style.display = itemCount > 0 ? 'inline-block' : 'none';
    }

    if (Object.keys(cart).length === 0) {
        itemsContainer.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:120px; color:var(--text-muted); gap:0.5rem;"><span style="font-size:2rem;">🧺</span><span style="font-size:0.875rem;">Your cart is empty</span></div>';
        document.getElementById('cart-subtotal').innerText = '0.00';
        document.getElementById('cart-gst').innerText = '0.00';
        document.getElementById('cart-total-price').innerText = '0.00';
        return;
    }
    
    const itemsHTML = Object.entries(cart).map(([itemId, qty]) => {
        const item = menu.find(m => m.id == itemId);
        const itemTotal = item.price * qty;
        total += itemTotal;
        return `
            <div class="cart-item">
                <div style="flex:1;">
                    <strong>${item.name}</strong><br>
                    <span class="text-muted" style="font-size: 0.85rem;">₹${item.price} x ${qty}</span>
                </div>
                <div style="font-weight: 600; color: #1e272e;">₹${itemTotal.toFixed(2)}</div>
            </div>
        `;
    }).join('');
    
    itemsContainer.innerHTML = itemsHTML;
    const discountEl = document.getElementById('cart-discount-row');
    const promoDiscount = window._promoDiscount || 0;
    const discountAmt = total * (promoDiscount / 100);
    const discountedSubtotal = total - discountAmt;
    const gst = discountedSubtotal * 0.05;
    const grandTotal = discountedSubtotal + gst;
    document.getElementById('cart-subtotal').innerText = total.toFixed(2);
    if (discountEl) discountEl.style.display = promoDiscount > 0 ? 'flex' : 'none';
    const discountAmtEl = document.getElementById('cart-discount-amt');
    if (discountAmtEl) discountAmtEl.innerText = discountAmt.toFixed(2);
    document.getElementById('cart-gst').innerText = gst.toFixed(2);
    document.getElementById('cart-total-price').innerText = grandTotal.toFixed(2);
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function openCheckout() {
    if (Object.keys(cart).length === 0) {
        showToast("Your cart is empty!", "error");
        return;
    }
    document.getElementById('checkout-modal').classList.remove('hidden');
}

async function applyPromoCode() {
    const code = document.getElementById('promo-code-input').value.trim();
    if (!code) return;
    try {
        const res = await apiCall('/orders/promo', 'POST', { code });
        window._promoCode = code;
        window._promoDiscount = res.discount_percent;
        document.getElementById('promo-feedback').innerText = `✅ ${res.discount_percent}% discount applied!`;
        document.getElementById('promo-feedback').style.color = 'var(--success)';
        renderCart();
    } catch(e) {
        window._promoCode = null;
        window._promoDiscount = 0;
        document.getElementById('promo-feedback').innerText = '❌ ' + e.message;
        document.getElementById('promo-feedback').style.color = 'var(--danger)';
        renderCart();
    }
}

async function submitOrder() {
    const time = document.getElementById('checkout-time').value;
    const instructions = document.getElementById('checkout-instructions').value;
    const paymentMethod = document.getElementById('checkout-payment').value;
    
    if (!time) {
        showToast("Please enter a pickup time window", "error");
        return;
    }

    if (paymentMethod === 'online') {
        const total = parseFloat(document.getElementById('cart-total-price').innerText);
        document.getElementById('checkout-modal').classList.add('hidden');
        openPaymentGateway(total, { type: 'order', time, instructions, paymentMethod });
        return;
    }

    finalizeOrderSubmission(time, instructions, paymentMethod);
}

async function finalizeOrderSubmission(time, instructions, paymentMethod) {
    if (!time && pendingPaymentAction && pendingPaymentAction.type === 'order') {
        time = pendingPaymentAction.time;
        instructions = pendingPaymentAction.instructions;
        paymentMethod = pendingPaymentAction.paymentMethod;
    }

    try {
        const orderItems = Object.entries(cart).map(([itemId, qty]) => {
            const item = menu.find(m => m.id == itemId);
            return { menu_item_id: item.id, quantity: qty, price: item.price };
        });
        
        await apiCall('/orders/', 'POST', { 
            user_id: user.id, 
            items: orderItems,
            pickup_time: time,
            special_instructions: instructions,
            payment_method: paymentMethod,
            discount_code: window._promoCode || ''
        });
        
        cart = {};
        window._promoCode = null;
        window._promoDiscount = 0;
        localStorage.removeItem('canteen_cart');
        renderCart();
        renderMenu();
        updateWallet();
        closeModal('checkout-modal');
        showToast("Order placed successfully! 🎉", "success");
        showOrders();
        loadMenu();
    } catch(e) {
        showToast(e.message, 'error');
    }
}

// FORMATTING & PAYMENT GATEWAY HELPERS
let pendingPaymentAction = null;
let currentPaymentMethod = 'card';

function switchPaymentTab(method) {
    currentPaymentMethod = method;
    if (method === 'card') {
        document.getElementById('btn-tab-card').classList.add('primary-btn');
        document.getElementById('btn-tab-card').classList.remove('outline');
        document.getElementById('btn-tab-upi').classList.add('outline');
        document.getElementById('btn-tab-upi').classList.remove('primary-btn');
        
        document.getElementById('payment-card-ui').classList.remove('hidden');
        document.getElementById('payment-upi-ui').classList.add('hidden');
    } else {
        document.getElementById('btn-tab-upi').classList.add('primary-btn');
        document.getElementById('btn-tab-upi').classList.remove('outline');
        document.getElementById('btn-tab-card').classList.add('outline');
        document.getElementById('btn-tab-card').classList.remove('primary-btn');
        
        document.getElementById('payment-upi-ui').classList.remove('hidden');
        document.getElementById('payment-card-ui').classList.add('hidden');
    }
}

function formatCardNumber(input) {
    let val = input.value.replace(/\D/g, '');
    let formatted = val.match(/.{1,4}/g)?.join(' ') || '';
    input.value = formatted;
    document.getElementById('card-preview-number').innerText = formatted || 'XXXX XXXX XXXX XXXX';
}

function formatExpiry(input) {
    let val = input.value.replace(/\D/g, '');
    if (val.length >= 3) {
        val = val.substring(0, 2) + '/' + val.substring(2, 4);
    }
    input.value = val;
    document.getElementById('card-preview-expiry').innerText = val || 'MM/YY';
}

function openTopUpModal() {
    document.getElementById('topup-current-balance').innerText = document.getElementById('wallet-balance').innerText;
    document.getElementById('topup-amount').value = '';
    document.getElementById('topup-modal').classList.remove('hidden');
}

function initiateTopUp() {
    const amount = parseFloat(document.getElementById('topup-amount').value);
    if (!amount || amount <= 0) {
        showToast("Please enter a valid amount", "error");
        return;
    }
    closeModal('topup-modal');
    openPaymentGateway(amount, { type: 'topup', amount: amount });
}

function openPaymentGateway(amount, action) {
    document.getElementById('gateway-amount').innerText = amount.toFixed(2);
    document.getElementById('gw-btn-amount').innerText = amount.toFixed(2);
    
    document.getElementById('gw-card-number').value = '';
    document.getElementById('gw-card-expiry').value = '';
    document.getElementById('gw-card-cvv').value = '';
    document.getElementById('gw-card-name').value = '';
    document.getElementById('card-preview-number').innerText = 'XXXX XXXX XXXX XXXX';
    document.getElementById('card-preview-expiry').innerText = 'MM/YY';
    document.getElementById('card-preview-name').innerText = 'JOHN DOE';
    
    document.getElementById('gw-upi-id').value = '';
    const upiData = `upi://pay?pa=canteen@upi&pn=SmartCanteen&am=${amount}`;
    document.getElementById('upi-qr-code').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiData)}`;
    switchPaymentTab('card');
    
    document.getElementById('gw-spinner').classList.add('hidden');
    document.getElementById('gw-pay-btn').classList.remove('disabled');
    
    pendingPaymentAction = action;
    document.getElementById('payment-gateway-modal').classList.remove('hidden');
}

function closePaymentGateway() {
    if (!document.getElementById('gw-spinner').classList.contains('hidden')) return;
    closeModal('payment-gateway-modal');
    pendingPaymentAction = null;
}

async function processPayment() {
    if (currentPaymentMethod === 'card') {
        const num = document.getElementById('gw-card-number').value;
        const exp = document.getElementById('gw-card-expiry').value;
        const cvv = document.getElementById('gw-card-cvv').value;
        const name = document.getElementById('gw-card-name').value;
        
        if (num.length < 19 || exp.length < 5 || cvv.length < 3 || !name) {
            showToast("Please properly fill all card detailing fields", "error");
            return;
        }
    } else {
        const upiId = document.getElementById('gw-upi-id').value;
        if (!upiId && !confirm("No UPI ID entered. Confirm you have scanned and paid via QR?")) {
            return;
        }
    }
    
    document.getElementById('gw-spinner').classList.remove('hidden');
    
    await new Promise(r => setTimeout(r, 2000));
    
    document.getElementById('gw-spinner').classList.add('hidden');
    closeModal('payment-gateway-modal');
    showToast("Payment Processed Securely!", "success");
    
    if (pendingPaymentAction.type === 'topup') {
        try {
            await apiCall('/auth/wallet/topup', 'POST', { user_id: user.id, amount: pendingPaymentAction.amount });
            updateWallet();
            showToast(`₹${pendingPaymentAction.amount.toFixed(2)} added to your wallet!`, "success");
        } catch(e) {
            showToast(e.message, "error");
        }
    } else if (pendingPaymentAction.type === 'order') {
        finalizeOrderSubmission();
    }
}

let userOrders = [];
async function showOrders() {
    const modal = document.getElementById('orders-modal');
    modal.classList.remove('hidden');
    const list = document.getElementById('orders-list');
    list.innerHTML = '<p class="text-muted" style="text-align:center;">Loading orders...</p>';
    
    try {
        userOrders = await apiCall(`/orders/student/${user.id}`);
        const orders = userOrders;
        
        if (orders.length === 0) {
            list.innerHTML = '<p class="text-muted">You have no past orders.</p>';
            return;
        }
        
        list.innerHTML = orders.reverse().map((o, index) => {
            const steps = ['pending', 'preparing', 'ready', 'completed'];
            const currentIndex = steps.indexOf(o.status);
            
            let trackerHTML = `<div class="tracker-container" data-status="${o.status}">`;
            steps.forEach((step, index) => {
                const activeClass = index === currentIndex ? 'active' : '';
                const doneClass = index <= currentIndex ? 'done' : '';
                const shortStep = step === 'pending' ? 'Pend' : step === 'preparing' ? 'Prep' : step === 'ready' ? 'Ready' : 'Done';
                const icon = index === 0 ? '📝' : index === 1 ? '🍳' : index === 2 ? '🛍️' : '✅';
                trackerHTML += `
                    <div class="track-step ${activeClass} ${doneClass}">
                        ${icon}
                        <span class="track-label" style="color:${index <= currentIndex ? 'var(--accent)' : 'var(--text-muted)'}">${shortStep}</span>
                    </div>
                `;
            });
            trackerHTML += `</div>`;
            
            let reviewBtns = '';
            let receiptBtn = '';
            if (o.status === 'completed') {
                reviewBtns = o.items.map(i => `<button class="btn outline" style="padding:0.3rem 0.6rem; font-size:0.8rem; margin-right:0.5rem" onclick="openReviewModal(${o.id}, ${i[0]}, '${i[2].replace(/'/g, "\\'")}')">Rate ${i[2]}</button>`).join('');
                
                const safeOrder = encodeURIComponent(JSON.stringify(o));
                receiptBtn = `<button class="btn nav-btn outline" style="padding:0.3rem 0.6rem; font-size:0.8rem; margin-left:auto" onclick="printReceipt('${safeOrder}')">🖨️ Receipt</button>`;
            }

            return `
            <div class="order-item animate-fade-up" style="display:block; padding-bottom: 2rem; border-bottom: 1px solid rgba(0,0,0,0.1); animation-delay: ${index * 0.1}s;">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem">
                    <strong>Order ${o.order_number}</strong>
                    <span style="font-weight:bold; color:var(--accent)">₹${parseFloat(o.total_price).toFixed(2)}</span>
                </div>
                ${trackerHTML}
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 1.5rem;">
                    <span style="display:inline-block; margin-right: 1rem;"><i style="color:var(--primary)">Pickup:</i> ${o.pickup_time || 'N/A'}</span>
                    <span><i style="color:var(--primary)">Note:</i> ${o.special_instructions || 'None'}</span><br>
                    <div style="margin-top:0.3rem">${o.items.map(i => `${i[1]}x ${i[2]}`).join(', ')}</div>
                    <div style="margin-top:1rem; display:flex; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                        <button class="btn primary-btn" style="padding:0.4rem 1rem; font-size:0.85rem;" onclick="reorder(${o.id})">🔁 Re-order</button>
                        ${reviewBtns}
                        ${receiptBtn}
                    </div>
                </div>
            </div>
            `;
        }).join('');
    } catch(e) {
        console.error("Orders load failed", e);
    }
}

function reorder(orderId) {
    const o = userOrders.find(x => x.id === orderId);
    if (!o) return;
    o.items.forEach(i => {
        cart[i[0]] = (cart[i[0]] || 0) + i[1];
    });
    localStorage.setItem('canteen_cart', JSON.stringify(cart));
    closeModal('orders-modal');
    renderCart();
    renderMenu();
    showToast("Items instantly added back to cart! 🔁", "success");
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.add('hidden');
    }
}

loadMenu();
updateWallet();

// Smart order polling — only re-fetches status, doesn't re-render whole modal
let _orderPollStatuses = {};
setInterval(async () => {
    if (document.getElementById('orders-modal').classList.contains('hidden')) return;
    try {
        const fresh = await apiCall(`/orders/student/${user.id}`);
        let changed = false;
        fresh.forEach(o => {
            if (_orderPollStatuses[o.id] !== o.status) {
                changed = true;
                _orderPollStatuses[o.id] = o.status;
            }
        });
        if (changed) showOrders(); // only full re-render when something actually changed
    } catch(e) {}
}, 5000);

function openReviewModal(orderId, itemId, itemName) {
    document.getElementById('review-order-id').value = orderId;
    document.getElementById('review-item-id').value = itemId;
    document.getElementById('review-comment').value = '';
    document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false);
    document.getElementById('review-modal').classList.remove('hidden');
}

async function submitReview() {
    const orderId = document.getElementById('review-order-id').value;
    const itemId = document.getElementById('review-item-id').value;
    const comment = document.getElementById('review-comment').value;
    const ratingEl = document.querySelector('input[name="rating"]:checked');
    
    if (!ratingEl) {
        showToast("Please select a star rating", "error");
        return;
    }
    
    try {
        await apiCall('/interactions/reviews', 'POST', {
            user_id: user.id,
            menu_item_id: parseInt(itemId),
            order_id: parseInt(orderId),
            rating: parseInt(ratingEl.value),
            comment: comment
        });
        closeModal('review-modal');
        showToast("Thanks for your review!");
        loadMenu();
    } catch(e) {
        showToast(e.message, 'error');
    }
}

function printReceipt(orderStr) {
    const o = JSON.parse(decodeURIComponent(orderStr));
    const win = window.open('', '_blank');
    const itemsHtml = o.items.map(i => `<div style="display:flex;justify-content:space-between;margin-bottom:0.5rem"><span>${i[1]}x ${i[2]}</span><span>&#8377;${(parseFloat(i[3])*i[1]).toFixed(2)}</span></div>`).join('');
    
    win.document.write(`
        <html><head><title>Receipt #${o.order_number}</title>
        <style>
            body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 350px; margin: 0 auto; color: #333; }
            .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 1rem; margin-bottom: 1rem; }
            .total { border-top: 2px dashed #ccc; padding-top: 1rem; margin-top: 1rem; font-weight: bold; font-size: 1.2rem; text-align: right; }
            .meta { font-size: 0.8rem; color: #666; text-align: center; margin-bottom: 1rem;}
            .badge { display:inline-block; background:#4f46e5; color:white; padding:0.2rem 0.6rem; border-radius:8px; font-size:0.75rem; margin-top:0.5rem; }
        </style>
        </head><body>
            <div class="header">
                <h2 style="margin:0;color:#4f46e5">&#127833; Smart Canteen</h2>
                <p style="margin:0.5rem 0 0">Official Order Receipt</p>
            </div>
            <div class="meta">
                <strong>Order ID:</strong> ${o.order_number}<br>
                <strong>Date:</strong> ${new Date().toLocaleString()}<br>
                <strong>Pickup:</strong> ${o.pickup_time || 'ASAP'}<br>
                <strong>Payment:</strong> <span class="badge">${o.payment_method || 'wallet'}</span>
            </div>
            <div style="margin-bottom: 1rem;">${itemsHtml}</div>
            <div class="total">Total (incl. 5% GST): &#8377;${parseFloat(o.total_price).toFixed(2)}</div>
            <div style="text-align:center; margin-top: 2rem; font-size: 0.9rem; color: #888;">
                Thank you for ordering!
            </div>
            <script>window.print();<\/script>
        </body></html>
    `);
    win.document.close();
}

// ══════════════════════════════════════════════════════════════
// 🎊 CONFETTI BURST
// ══════════════════════════════════════════════════════════════
function launchConfetti() {
    const colors = ['#4f46e5','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
    for (let i = 0; i < 90; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-particle';
        const size = Math.random() * 10 + 6;
        p.style.cssText = `
            width:${size}px; height:${size * (Math.random() > 0.5 ? 1 : 0.4)}px;
            background:${colors[Math.floor(Math.random() * colors.length)]};
            border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
            left:${Math.random() * 100}vw; top:-15px;
            animation: confettiFall ${1.5 + Math.random() * 2}s linear ${Math.random() * 0.6}s forwards;
        `;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 4000);
    }
}

// ══════════════════════════════════════════════════════════════
// ⭐ FEATURED CAROUSEL
// ══════════════════════════════════════════════════════════════
let _carouselIdx = 0;
let _carouselItems = [];
let _carouselTimer = null;

function renderFeaturedCarousel(items) {
    // Show top 4 available items sorted by rating
    _carouselItems = items
        .filter(i => i.stock > 0)
        .sort((a, b) => (parseFloat(b.average_rating) || 0) - (parseFloat(a.average_rating) || 0))
        .slice(0, 4);

    if (_carouselItems.length < 2) { 
        document.getElementById('featured-section').style.display = 'none';
        return; 
    }

    document.getElementById('featured-section').style.display = 'block';
    const track = document.getElementById('carousel-track');
    const dotsEl = document.getElementById('carousel-dots');

    const gradients = [
        'linear-gradient(135deg, #312e81 0%, #4338ca 60%, #6366f1 100%)',
        'linear-gradient(135deg, #065f46 0%, #059669 60%, #10b981 100%)',
        'linear-gradient(135deg, #7c2d12 0%, #c2410c 60%, #f97316 100%)',
        'linear-gradient(135deg, #1e1b4b 0%, #6d28d9 60%, #8b5cf6 100%)',
    ];

    track.innerHTML = _carouselItems.map((item, i) => `
        <div class="carousel-slide" style="background:${gradients[i % gradients.length]};" onclick="addToCart(${item.id})">
            <img src="${item.image_url || 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=200&fit=crop'}" 
                 alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=200&fit=crop'">
            <div class="carousel-slide-body">
                <div class="carousel-slide-label">⭐ ${item.review_count > 0 ? item.average_rating + ' rated · ' : ''}${item.category || 'Featured'}</div>
                <div class="carousel-slide-name">${item.name}</div>
                <div class="carousel-slide-desc">${item.description || 'Try this today!'}</div>
                <div style="display:flex; align-items:center; gap:1rem;">
                    <div class="carousel-slide-price">₹${item.price}</div>
                    <button class="carousel-add-btn" onclick="event.stopPropagation(); addToCart(${item.id})">+ Add to Cart</button>
                </div>
            </div>
        </div>
    `).join('');

    dotsEl.innerHTML = _carouselItems.map((_, i) => 
        `<button class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></button>`
    ).join('');

    _carouselIdx = 0;
    clearInterval(_carouselTimer);
    _carouselTimer = setInterval(carouselNext, 4000);
}

function goToSlide(i) {
    _carouselIdx = i;
    document.getElementById('carousel-track').style.transform = `translateX(-${i * 100}%)`;
    document.querySelectorAll('.carousel-dot').forEach((d, j) => d.classList.toggle('active', j === i));
}

function carouselNext() {
    goToSlide((_carouselIdx + 1) % _carouselItems.length);
}

function carouselPrev() {
    goToSlide((_carouselIdx - 1 + _carouselItems.length) % _carouselItems.length);
}

// ══════════════════════════════════════════════════════════════
// ⏱️ WAIT TIME ESTIMATOR
// ══════════════════════════════════════════════════════════════
async function updateWaitTime() {
    try {
        const orders = await apiCall('/orders/live');
        const activeCount = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
        const chipEl = document.getElementById('wait-chip-container');
        if (!chipEl) return;
        const mins = activeCount === 0 ? 5 : Math.min(activeCount * 3 + 5, 30);
        const busy = activeCount > 5;
        chipEl.innerHTML = `<span class="wait-chip ${busy ? 'busy' : ''}">
            ${busy ? '🔥' : '⏱️'} ${busy ? 'Kitchen is busy — ' : ''}Est. wait: ~${mins} mins
            ${activeCount > 0 ? `<span style="opacity:0.7; font-size:0.72rem; margin-left:0.3rem;">(${activeCount} orders ahead)</span>` : ''}
        </span>`;
    } catch(e) {
        const chipEl = document.getElementById('wait-chip-container');
        if (chipEl) chipEl.innerHTML = '';
    }
}

// ══════════════════════════════════════════════════════════════
// 📊 MY STATS MODAL
// ══════════════════════════════════════════════════════════════
async function showMyStats() {
    document.getElementById('stats-modal').classList.remove('hidden');

    try {
        const [orders, walletRes] = await Promise.all([
            apiCall(`/orders/student/${user.id}`),
            apiCall(`/auth/wallet/${user.id}`)
        ]);

        const totalSpent = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
        const wallet = parseFloat(walletRes.balance || 0);

        // Favourite item (most ordered)
        const itemCounts = {};
        orders.forEach(o => {
            (o.items || []).forEach(i => {
                itemCounts[i[2] || i[1]] = (itemCounts[i[2] || i[1]] || 0) + (i[1] || 1);
            });
        });
        const favItem = Object.entries(itemCounts).sort((a,b) => b[1]-a[1])[0];

        // Animate stats in
        animateCount('s-total-spent', totalSpent, true);
        animateCount('s-total-orders', orders.length);
        document.getElementById('s-fav-item').innerText = favItem ? favItem[0] : 'N/A';
        animateCount('s-wallet', wallet, true);

        // Budget progress
        const budget = 1000;
        const pct = Math.min((totalSpent / budget) * 100, 100);
        document.getElementById('s-budget-pct').innerText = pct.toFixed(0) + '%';
        document.getElementById('s-budget-msg').innerText = `₹${totalSpent.toFixed(0)} of ₹${budget} monthly budget`;
        setTimeout(() => {
            document.getElementById('s-budget-bar').style.width = pct + '%';
        }, 200);

        // Recent orders list
        const recentEl = document.getElementById('s-recent-orders');
        if (orders.length === 0) {
            recentEl.innerHTML = '<p class="text-muted" style="text-align:center; padding:1rem; font-size:0.875rem;">No orders yet. Place your first order!</p>';
        } else {
            recentEl.innerHTML = orders.slice(0, 5).map(o => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; background:var(--body-bg); border-radius:var(--radius); border:1px solid var(--border);">
                    <div>
                        <div style="font-weight:700; font-size:0.875rem;">${o.order_number}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${o.items ? o.items.map(i => i[1] || i[2]).join(', ') : ''}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:800; color:var(--primary); font-size:0.9rem;">₹${parseFloat(o.total_price).toFixed(0)}</div>
                        <span class="status-badge status-${o.status}" style="font-size:0.65rem;">${o.status}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch(e) {
        document.getElementById('s-recent-orders').innerHTML = '<p class="text-muted" style="text-align:center; padding:1rem; font-size:0.875rem;">Could not load stats. Is the backend running?</p>';
    }
}

// ══════════════════════════════════════════════════════════════
// 🔢 ANIMATED NUMBER COUNTER
// ══════════════════════════════════════════════════════════════
function animateCount(elId, target, isCurrency = false) {
    const el = document.getElementById(elId);
    if (!el) return;
    const start = 0;
    const duration = 1000;
    const startTime = performance.now();
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = start + (target - start) * eased;
        el.innerText = isCurrency ? '₹' + value.toFixed(0) : Math.floor(value).toString();
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ══════════════════════════════════════════════════════════════
// 🔄 FLOATING CART SYNC
// ══════════════════════════════════════════════════════════════
function updateFloatCart() {
    const count = Object.values(cart).reduce((a,b) => a+b, 0);
    const total = parseFloat(document.getElementById('cart-total-price')?.innerText || 0);
    const fc = document.getElementById('float-cart');
    const fcc = document.getElementById('float-cart-count');
    const fcp = document.getElementById('float-cart-price');
    if (fcc) fcc.innerText = count;
    if (fcp) fcp.innerText = '₹' + total.toFixed(0);
    if (fc && count > 0 && window.scrollY > 200) fc.classList.add('visible');
    if (fc && count === 0) fc.classList.remove('visible');
}

// Hook into renderCart safely
const __origRenderCart_base = renderCart;
window.renderCart = function() {
    __origRenderCart_base();
    if (typeof updateFloatCart === 'function') updateFloatCart();
};

// ══════════════════════════════════════════════════════════════
// 🏷️ DYNAMIC BADGE INJECTION
// ══════════════════════════════════════════════════════════════
function _injectMenuBadges() {
    if (!menu || !menu.length) return;
    const cards = document.querySelectorAll('#menu-container .card');
    const visibleItems = menu.filter(item => {
        const search = (document.getElementById('menu-search')?.value || '').toLowerCase();
        const matchCat = currentCategory === 'All' || item.category === currentCategory;
        const matchSearch = !search || item.name.toLowerCase().includes(search) || (item.description || '').toLowerCase().includes(search);
        return matchCat && matchSearch && item.stock > 0;
    });

    cards.forEach((card, idx) => {
        const item = visibleItems[idx];
        if (!item || card.querySelector('.menu-badge-row')) return;
        const badges = [];
        if (item.review_count >= 3 && item.average_rating >= 4.0) badges.push('<span class="mbadge mbadge-hot">🔥 Popular</span>');
        if (item.stock > 0 && item.stock <= 5) badges.push(`<span class="mbadge mbadge-low">⚡ Only ${item.stock} left!</span>`);
        if (item.id >= (menu.length > 3 ? menu[menu.length - 3].id : 0)) badges.push('<span class="mbadge mbadge-new">✨ New</span>');
        if (badges.length > 0) {
            const row = document.createElement('div');
            row.className = 'menu-badge-row';
            row.innerHTML = badges.join('');
            card.style.position = 'relative';
            card.insertBefore(row, card.firstChild);
        }
    });

    if (menu.length > 1 && !document.getElementById('carousel-track').children.length) {
        renderFeaturedCarousel(menu);
    }
}

// Patching logic safely to avoid hoisting recursion
const __origRenderMenu = renderMenu;
window.renderMenu = function() {
    __origRegerMenu_manual();
    setTimeout(_injectMenuBadges, 50);
    if (typeof updateWaitTime === 'function') updateWaitTime();
};
function __origRegerMenu_manual() {
    __origRenderMenu();
}

// ══════════════════════════════════════════════════════════════
// 🎉 PATCH finalizeOrderSubmission
// ══════════════════════════════════════════════════════════════
// 🎉 PATCH finalizeOrderSubmission safely
const __origFinalizeOrder_base = finalizeOrderSubmission;
window.finalizeOrderSubmission = async function(time, instructions, paymentMethod) {
    try {
        const orderItems = Object.entries(cart).map(([itemId, qty]) => {
            const item = menu.find(m => m.id == itemId);
            return { menu_item_id: item.id, quantity: qty, price: item.price };
        });

        const res = await apiCall('/orders/', 'POST', {
            user_id: user.id,
            items: orderItems,
            pickup_time: time,
            special_instructions: instructions,
            payment_method: paymentMethod,
            discount_code: window._promoCode || ''
        });

        cart = {};
        window._promoCode = null;
        window._promoDiscount = 0;
        localStorage.removeItem('canteen_cart');
        renderCart();
        renderMenu();
        updateWallet();
        closeModal('checkout-modal');

        if (typeof showSuccessOverlay === 'function') {
            showSuccessOverlay(res?.order_number, time);
        } else {
            showToast("Order placed successfully! 🎉", "success");
        }
        loadMenu();
    } catch(e) {
        showToast(e.message || 'Order failed. Try again.', 'error');
    }
}
