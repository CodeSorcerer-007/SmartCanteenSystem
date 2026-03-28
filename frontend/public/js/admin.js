const user = getUser();
if(user && user.role !== 'admin') {
    alert("Unauthorized");
    logout();
}

function switchAdminTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.admin-tab').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    
    document.querySelectorAll('.admin-nav .nav-btn').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.nav-btn').classList.add('active');
    
    if(tabId === 'live-orders') loadLiveOrders();
    if(tabId === 'menu-manage') loadMenuAdmin();
    if(tabId === 'ai-predict') loadPredictions();
    if(tabId === 'analytics') loadAnalytics();
    if(tabId === 'promo-manage') loadPromoCodes();
}

let previousOrderCount = 0;
const alertSound = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

async function loadLiveOrders() {
    try {
        const orders = await apiCall('/orders/live');
        
        if (orders.length > previousOrderCount && previousOrderCount !== 0) {
            alertSound.play().catch(e => console.log('Audio blocked'));
            showToast("\ud83d\udd14 New Order Received!", "success");
        }
        previousOrderCount = orders.length;

        // Update status counter badges
        const pending   = orders.filter(o => o.status === 'pending').length;
        const preparing = orders.filter(o => o.status === 'preparing').length;
        const ready     = orders.filter(o => o.status === 'ready').length;
        const pEl = document.getElementById('cnt-pending');
        const rpEl = document.getElementById('cnt-preparing');
        const rdEl = document.getElementById('cnt-ready');
        if (pEl)  pEl.innerText  = `${pending} Pending`;
        if (rpEl) rpEl.innerText = `${preparing} Preparing`;
        if (rdEl) rdEl.innerText = `${ready} Ready`;

        const c = document.getElementById('live-queue-container');
        
        if (orders.length === 0) {
            c.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);"><div style="font-size:3rem; margin-bottom:1rem;">\u2705</div><p style="font-size:1.1rem; font-weight:600;">All clear! No active orders.</p></div>';
            return;
        }

        c.innerHTML = orders.map((o, index) => `
            <div class="queue-card-v2 animate-fade-up" data-status="${o.status}" style="animation-delay:${index * 0.05}s;">
                <div class="queue-header">
                    <div>
                        <div style="font-weight:800; font-size:1rem; margin-bottom:0.2rem;">${o.order_number}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">\ud83d\udc64 ${o.username}</div>
                    </div>
                    <span class="status-badge status-${o.status}">${o.status}</span>
                </div>
                <div class="order-items-list">
                    ${o.items.map(i => `<div><span>${i[1]}</span><strong>\u00d7${i[0]}</strong></div>`).join('')}
                </div>
                <div class="queue-meta">
                    <span>\u23f0 ${o.pickup_time || 'ASAP'}</span>
                    ${o.special_instructions ? `<span>\ud83d\udcdd ${o.special_instructions}</span>` : ''}
                    <span>\ud83d\udcb0 \u20b9${parseFloat(o.total_price).toFixed(2)}</span>
                </div>
                <select class="queue-select" onchange="updateStatus(${o.id}, this.value)">
                    <option value="pending"   ${o.status==='pending'   ?'selected':''}>\u23f3 Pending</option>
                    <option value="preparing" ${o.status==='preparing' ?'selected':''}>\ud83c\udf73 Preparing</option>
                    <option value="ready"     ${o.status==='ready'     ?'selected':''}>\u2705 Ready for Pickup</option>
                    <option value="completed" ${o.status==='completed' ?'selected':''}>\ud83d\udce6 Completed</option>
                </select>
            </div>
        `).join('');
    } catch(e) {}
}

async function updateStatus(orderId, newStatus) {
    try {
        await apiCall(`/orders/${orderId}/status`, 'PUT', {status: newStatus});
        loadLiveOrders();
    } catch(e) {
        alert("Failed to update status");
    }
}

function getStatusColor(st) {
    if(st === 'pending') return '#f39c12';
    if(st === 'preparing') return '#3498db';
    if(st === 'ready') return '#2ecc71';
    return '#95a5a6';
}

async function loadPredictions() {
    try {
        const stats = await apiCall('/orders/analytics');

        const data = await apiCall('/orders/predictions');
        document.getElementById('prediction-container').innerHTML = `
            <div class="glass-panel" style="padding: 2.5rem; border-left: 5px solid var(--accent); line-height: 1.8;">
                <p style="font-size:1.1rem; text-align: left;">${data.prediction}</p>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(0,0,0,0.1)">
                    <strong>Top Sellers: </strong>
                    ${stats.top_items ? stats.top_items.map(i => `<span style="background:var(--accent); color:white; padding:0.2rem 0.6rem; border-radius:12px; font-size:0.8rem; margin-right:0.5rem">${i.name} (${i.count})</span>`).join('') : ''}
                </div>
            </div>
        `;
    } catch(e) {
        showToast(e.message, 'error');
    }
}

// Analytics logic
let _revenueChart = null;
async function loadAnalytics() {
    try {
        const stats = await apiCall('/orders/analytics');
        document.getElementById('stat-revenue').innerText = `₹${parseFloat(stats.total_revenue).toFixed(2)}`;
        document.getElementById('stat-online-revenue').innerText = `₹${parseFloat(stats.online_revenue).toFixed(2)}`;
        document.getElementById('stat-other-revenue').innerText = `₹${parseFloat(stats.other_revenue).toFixed(2)}`;
        document.getElementById('stat-orders').innerText = stats.total_orders;
        document.getElementById('stat-top').innerText = stats.top_item;

        // Build 7-day chart
        const chartData = stats.chart_data || {};
        const labels = [];
        const values = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            labels.push(d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }));
            values.push(parseFloat(chartData[key] || 0).toFixed(2));
        }

        const ctx = document.getElementById('revenue-chart');
        if (ctx) {
            if (_revenueChart) _revenueChart.destroy();
            _revenueChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Revenue (₹)',
                        data: values,
                        backgroundColor: 'rgba(79,70,229,0.2)',
                        borderColor: '#4f46e5',
                        borderWidth: 2,
                        borderRadius: 8,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    } catch(e) {
        console.error('Failed to load analytics', e);
    }
}

async function loadPromoCodes() {
    try {
        const codes = await apiCall('/orders/promos');
        const c = document.getElementById('promo-list');
        if (!c) return;
        c.innerHTML = codes.map(p => `
            <div class="card" style="padding:1rem; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="font-size:1.1rem; color:var(--primary-color);">${p.code}</strong>
                    <span style="margin-left:1rem; background:var(--body-bg); padding:0.2rem 0.6rem; border-radius:8px; font-size:0.85rem;">${p.discount_percent}% OFF</span>
                </div>
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <span style="font-size:0.8rem; color:${p.active ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">${p.active ? 'Active' : 'Inactive'}</span>
                    <button class="btn outline" style="padding:0.3rem 0.7rem; font-size:0.8rem;" onclick="togglePromo(${p.id}, ${p.active})">${p.active ? 'Deactivate' : 'Activate'}</button>
                </div>
            </div>
        `).join('') || '<p class="text-muted">No promo codes yet.</p>';
    } catch(e) { showToast(e.message, 'error'); }
}

async function togglePromo(id, isActive) {
    try {
        await apiCall('/orders/promos/' + id, 'PUT', { active: !isActive });
        loadPromoCodes();
        showToast(isActive ? 'Promo deactivated' : 'Promo activated!', 'success');
    } catch(e) { showToast(e.message, 'error'); }
}

async function createPromoCode() {
    const code = document.getElementById('new-promo-code').value.trim().toUpperCase();
    const pct = parseInt(document.getElementById('new-promo-pct').value);
    if (!code || !pct || pct < 1 || pct > 100) {
        showToast('Enter a valid code and discount %', 'error'); return;
    }
    try {
        await apiCall('/orders/promos', 'POST', { code, discount_percent: pct });
        document.getElementById('new-promo-code').value = '';
        document.getElementById('new-promo-pct').value = '';
        loadPromoCodes();
        showToast(`Promo code ${code} created!`, 'success');
    } catch(e) { showToast(e.message, 'error'); }
}

// Polling for live orders
let currentTab = 'live-orders';

// Apply dark mode on load if saved
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('dark-mode-btn').innerText = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
}

function checkAdmin() {
    // Placeholder for actual admin check logic if needed
    // For now, it just ensures the initial state is set.
}

document.addEventListener('DOMContentLoaded', () => {
    checkAdmin();
    loadLiveOrders();
    if (localStorage.getItem('theme') === 'dark') {
        document.getElementById('dark-mode-btn').innerText = '☀️ Light Mode';
    }
});

setInterval(() => {
    if(currentTab === 'live-orders') {
        loadLiveOrders();
    }
}, 5000);

// Init
loadLiveOrders();

let adminMenu = [];

async function loadMenuAdmin() {
    try {
        adminMenu = await apiCall('/menu/');
        const c = document.getElementById('admin-menu-list');
        c.innerHTML = adminMenu.map((m, index) => `
            <div class="card glass-panel animate-fade-up" style="padding:0; animation-delay: ${index * 0.05}s;">
                <img src="${m.image_url || 'https://via.placeholder.com/300'}" class="card-img" style="height:140px">
                <div class="card-body">
                    <div class="card-title">
                        <h3>${m.name}</h3>
                        <span class="card-price">₹${m.price}</span>
                    </div>
                    <p class="card-desc" style="margin-bottom:0.5rem">${m.description}</p>
                    <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.85rem; font-weight: bold; background: rgba(0,0,0,0.05); padding: 0.2rem 0.6rem; border-radius: 8px;">Stock: ${m.stock} | ${m.diet_type || 'Veg'}</span>
                        <label style="display:flex; align-items:center; cursor:pointer;" onclick="toggleStock(${m.id}, event)">
                            <span style="font-weight:600; font-size:0.85rem; color:${m.available ? 'var(--success)' : 'var(--danger)'}; border-bottom: 1px dashed ${m.available ? 'var(--success)' : 'var(--danger)'};">${m.available ? 'Available' : 'Out of Stock'}</span>
                        </label>
                    </div>
                    <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
                        <button class="btn outline" style="flex:1" onclick="openMenuModal(${m.id})">⚙️ Edit</button>
                        <button class="btn outline" style="flex:0 0 50px; border-color:var(--danger); color:var(--danger)" onclick="deleteMenuItem(${m.id}, '${m.name.replace(/'/g, "\\'")}')">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('') || '<p>No menu items.</p>';
    } catch(e) {
        console.error(e);
    }
}

async function deleteMenuItem(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?\nThis will remove it from the menu entirely.`)) return;
    
    try {
        await apiCall('/menu/' + id, 'DELETE');
        showToast(`"${name}" deleted successfully`, 'success');
        loadMenuAdmin();
    } catch(e) {
        showToast(e.message, 'error');
    }
}

async function toggleStock(id, e) {
    if (e) e.preventDefault();
    const item = adminMenu.find(m => m.id === id);
    if(!item) return;
    try {
        await apiCall('/menu/' + id, 'PUT', { ...item, available: !item.available });
        loadMenuAdmin();
        showToast(!item.available ? "Marked Available!" : "Marked Out of Stock!", "success");
    } catch(err) {
        showToast("Failed to toggle stock", "error");
    }
}

function openMenuModal(id = null) {
    const modal = document.getElementById('menu-modal');
    modal.classList.remove('hidden');
    
    if (id) {
        document.getElementById('menu-modal-title').innerText = "Edit Menu Item";
        const item = adminMenu.find(m => m.id === id);
        document.getElementById('edit-menu-id').value = item.id;
        document.getElementById('menu-name').value = item.name;
        document.getElementById('menu-desc').value = item.description;
        document.getElementById('menu-price').value = item.price;
        document.getElementById('menu-stock').value = item.stock || 0;
        document.getElementById('menu-category').value = item.category || 'Uncategorized';
        document.getElementById('menu-diet').value = item.diet_type || 'Veg';
        document.getElementById('menu-img').value = item.image_url || '';
        document.getElementById('menu-avail').value = item.available ? "true" : "false";
        document.getElementById('menu-img-upload').value = '';
    } else {
        document.getElementById('menu-modal-title').innerText = "Add Menu Item";
        document.getElementById('menu-form').reset();
        document.getElementById('edit-menu-id').value = '';
        document.getElementById('menu-img-upload').value = '';
    }
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

async function handleMenuSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-menu-id').value;
    const fileInput = document.getElementById('menu-img-upload');
    
    let imageUrl = document.getElementById('menu-img').value;
    
    // Convert to base64 if a file is attached
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        if (file.size > 2 * 1024 * 1024) { // Max 2MB checking
            alert("Please upload an image smaller than 2MB.");
            return;
        }
        try {
            imageUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        } catch (err) {
            alert("Error reading file");
            return;
        }
    }
    
    const data = {
        name: document.getElementById('menu-name').value,
        description: document.getElementById('menu-desc').value,
        price: parseFloat(document.getElementById('menu-price').value),
        stock: parseInt(document.getElementById('menu-stock').value, 10),
        category: document.getElementById('menu-category').value,
        diet_type: document.getElementById('menu-diet').value,
        image_url: imageUrl,
        available: document.getElementById('menu-avail').value === "true"
    };

    try {
        if (id) {
            await apiCall('/menu/' + id, 'PUT', data);
        } else {
            await apiCall('/menu/', 'POST', data);
        }
        closeModal('menu-modal');
        loadMenuAdmin();
        alert("Menu updated successfully!");
    } catch(err) {
        alert(err.message);
    }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.add('hidden');
    }
}
