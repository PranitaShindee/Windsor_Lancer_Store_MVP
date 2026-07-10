// ── Rebuild homepage carousel from active adminAdList ─────────────────────
function buildHomepageCarousel() {
  const track   = document.getElementById('adTrack');
  const dotsWrap = document.getElementById('adDots');
  if (!track) return;

  const activeAds = adminAdList.filter(a => a.active !== false);
  if (activeAds.length === 0) return;

  // Build slide HTML for each active ad
  const BG_COLORS = { navy:'#0a1628', gold:'#8B6914', green:'#1a5c2a', red:'#8B1a1a' };

  track.innerHTML = activeAds.map(a => {
    const bg   = BG_COLORS[a.bg] || '#0a1628';
    const title = a.title || '';
    const sub   = a.sub || a.subtitle || '';
    const code  = a.code || a.promoCode || '';
    const btn   = a.btn || a.ctaButton || 'Shop Now';
    return '<div class="ad-slide" style="background:' + bg + ';display:flex;align-items:center;justify-content:space-between;padding:40px 60px;min-height:260px;">' +
      '<div>' +
        '<div style="font-size:28px;font-weight:800;color:#fff;margin-bottom:10px;">' + title + '</div>' +
        '<div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:20px;">' + sub + '</div>' +
        '<div style="display:flex;gap:12px;align-items:center;">' +
          (code ? '<div style="border:1.5px dashed rgba(201,168,76,0.6);padding:6px 14px;border-radius:6px;font-size:13px;font-weight:700;color:#c9a84c;letter-spacing:0.08em;">' + code + '</div>' : '') +
          '<button class="btn btn-gold btn-sm" onclick="showScreen(&quot;listing&quot;)" style="padding:8px 20px;">' + btn + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // Rebuild dots
  if (dotsWrap) {
    dotsWrap.innerHTML = activeAds.map((_,i) =>
      '<span class="ad-dot' + (i===0?' active':'') + '" onclick="adGoTo(' + i + ')"></span>'
    ).join('');
  }

  // Reset carousel position
  if (window.adGoTo) window.adGoTo(0);
}
window.buildHomepageCarousel = buildHomepageCarousel;




// ── Status pill helper ───────────────────────────────────────────────────────
function statusPill(status) {
  var cls = {
    'Processing': 'sp-processing',
    'Shipped':    'sp-shipped',
    'Delivered':  'sp-delivered',
    'Cancelled':  'sp-cancelled'
  };
  return '<span class="status-pill ' + (cls[status] || '') + '">' + (status||'—') + '</span>';
}
window.statusPill = statusPill;

// Safe toast wrapper — works even if main script hasn't loaded yet
function _safeToast(msg, type) {
  if (window.showToast) { window.showToast(msg, type); }
  else { setTimeout(function(){ if(window.showToast) window.showToast(msg, type); }, 500); }
}

// ─────────────────────────────────────────────────────────────
// EXCEL EXPORT REPORTS
// ─────────────────────────────────────────────────────────────

// Helper: cost is estimated at 55% of price (typical retail margin)
function estCost(price)   { return Math.round(price * 0.55 * 100) / 100; }
function estProfit(price) { return Math.round(price * 0.45 * 100) / 100; }
function estMargin(price) { return '45%'; }

// ── Build individual sheet data arrays ────────────────────────
function buildStockSheetData() {
  const headers = ['Product Name','Category','SKU','Price ($)','Stock Qty','Stock Value ($)','Est. Reorder Qty','Status'];
  const rows = adminProducts.map(p => {
    const stockVal = Math.round(p.price * p.stock * 100) / 100;
    const status   = p.stock === 0 ? 'OUT OF STOCK' : p.stock < 10 ? 'LOW — Reorder' : 'OK';
    const reorder  = p.stock < 10 ? Math.max(0, 30 - p.stock) : 0;
    return [p.name, p.cat, p.sku || '—', p.price, p.stock, stockVal, reorder, status];
  });
  const totalStockVal = adminProducts.reduce((s,p) => s + p.price * p.stock, 0).toFixed(2);
  rows.push(['', '', '', '', 'TOTAL STOCK VALUE →', parseFloat(totalStockVal), '', '']);
  return [headers, ...rows];
}

function buildOrdersSheetData() {
  const headers = ['Order #','Customer Name','Email','Items','Order Total ($)','Date','Status'];
  const rows = adminOrderList.map(o => [
    o.id, o.customer, o.email, o.items,
    parseFloat(o.total.replace('$','')),
    o.date, o.status
  ]);
  const revenue = adminOrderList
    .filter(o => o.status !== 'Cancelled')
    .reduce((s,o) => s + parseFloat(o.total.replace('$','')), 0).toFixed(2);
  const cancelled = adminOrderList.filter(o => o.status === 'Cancelled').length;
  rows.push(['','','','','','','']);
  rows.push(['SUMMARY','Total Orders','Revenue (excl. cancelled)','Cancelled Orders','','','']);
  rows.push(['', adminOrderList.length, parseFloat(revenue), cancelled,'','','']);
  return [headers, ...rows];
}

function buildProfitSheetData() {
  const headers = [
    'Product Name','Category','Price ($)','Est. Cost ($)','Gross Profit / Unit ($)',
    'Margin','Stock Qty','Total Revenue Potential ($)','Total Profit Potential ($)'
  ];
  const rows = adminProducts.map(p => {
    const cost    = estCost(p.price);
    const profit  = estProfit(p.price);
    const revPot  = Math.round(p.price * p.stock * 100) / 100;
    const profPot = Math.round(profit * p.stock * 100) / 100;
    return [p.name, p.cat, p.price, cost, profit, estMargin(p.price), p.stock, revPot, profPot];
  });
  const totalRevPot  = adminProducts.reduce((s,p) => s + p.price * p.stock, 0).toFixed(2);
  const totalProfPot = adminProducts.reduce((s,p) => s + estProfit(p.price) * p.stock, 0).toFixed(2);
  rows.push(['','','','','','','','','']);
  rows.push(['TOTALS','','','','','','',parseFloat(totalRevPot), parseFloat(totalProfPot)]);
  // Also add actual revenue from orders
  const actualRevenue = adminOrderList
    .filter(o => o.status !== 'Cancelled')
    .reduce((s,o) => s + parseFloat(o.total.replace('$','')), 0).toFixed(2);
  rows.push(['','','','','','','','','']);
  rows.push(['ACTUAL REVENUE (from orders)','','','','','','', parseFloat(actualRevenue),'']);
  rows.push(['Est. Actual Profit (45% margin)','','','','','','', Math.round(actualRevenue * 0.45 * 100)/100,'']);
  return [headers, ...rows];
}

function buildLowStockSheetData() {
  const headers = ['Product Name','Category','Price ($)','Current Stock','Reorder Qty Suggested','Stock Value ($)','Status'];
  const low = adminProducts.filter(p => p.stock < 20);
  const rows = low.map(p => {
    const status  = p.stock === 0 ? 'URGENT — Out of Stock' : p.stock < 5 ? 'CRITICAL' : 'LOW';
    const reorder = Math.max(0, 30 - p.stock);
    return [p.name, p.cat, p.price, p.stock, reorder, Math.round(p.price*p.stock*100)/100, status];
  });
  if (rows.length === 0) rows.push(['✅ All products are well stocked','','','','','','']);
  return [headers, ...rows];
}

// ── Style helper: apply column widths & bold header row ───────
function styleSheet(ws, colWidths) {
  ws['!cols'] = colWidths.map(w => ({ wch: w }));
}

// ── Export functions ───────────────────────────────────────────
// ── Core download helper — works on file://, http://, everywhere ──
function downloadXLSX(wb, filename) {
  try {
    // Method 1: base64 data URL — works on GitHub Pages, Vercel, file://, everywhere
    const wbout  = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const dataUrl = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + wbout;
    const a = document.createElement('a');
    a.href     = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch(e1) {
    try {
      // Method 2: Blob + object URL fallback
      const wbout2 = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob   = new Blob([wbout2], { type: 'application/octet-stream' });
      const url    = URL.createObjectURL(blob);
      const a2     = document.createElement('a');
      a2.href      = url;
      a2.download  = filename;
      document.body.appendChild(a2);
      a2.click();
      setTimeout(() => { document.body.removeChild(a2); URL.revokeObjectURL(url); }, 300);
    } catch(e2) {
      alert('Download failed. Please try a different browser.');
    }
  }
}

function exportStockReport() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(buildStockSheetData());
  styleSheet(ws, [30,14,12,10,10,14,16,16]);
  XLSX.utils.book_append_sheet(wb, ws, 'Stock & Inventory');
  downloadXLSX(wb, `LancerStore_Stock_${today()}.xlsx`);
  window._safeToast('✅ Stock report downloaded!', 'gold');
}

function exportOrdersReport() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(buildOrdersSheetData());
  styleSheet(ws, [12,20,24,30,14,16,14]);
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  downloadXLSX(wb, `LancerStore_Orders_${today()}.xlsx`);
  window._safeToast('✅ Orders report downloaded!', 'gold');
}

function exportProfitReport() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(buildProfitSheetData());
  styleSheet(ws, [28,14,10,12,18,10,10,20,20]);
  XLSX.utils.book_append_sheet(wb, ws, 'Profit & Revenue');
  downloadXLSX(wb, `LancerStore_Profit_${today()}.xlsx`);
  window._safeToast('✅ Profit report downloaded!', 'gold');
}

function exportFullReport() {
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet(buildStockSheetData());
  styleSheet(ws1, [30,14,12,10,10,14,16,16]);
  XLSX.utils.book_append_sheet(wb, ws1, '1. Stock & Inventory');

  const ws2 = XLSX.utils.aoa_to_sheet(buildOrdersSheetData());
  styleSheet(ws2, [12,20,24,30,14,16,14]);
  XLSX.utils.book_append_sheet(wb, ws2, '2. Orders');

  const ws3 = XLSX.utils.aoa_to_sheet(buildProfitSheetData());
  styleSheet(ws3, [28,14,10,12,18,10,10,20,20]);
  XLSX.utils.book_append_sheet(wb, ws3, '3. Profit & Revenue');

  const ws4 = XLSX.utils.aoa_to_sheet(buildLowStockSheetData());
  styleSheet(ws4, [30,14,10,14,18,14,20]);
  XLSX.utils.book_append_sheet(wb, ws4, '4. Low Stock Alerts');

  downloadXLSX(wb, `LancerStore_FullReport_${today()}.xlsx`);
  window._safeToast('✅ Full report downloaded!', 'gold');
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Live preview table on Reports tab ─────────────────────────
function renderReportsPreview() {
  const tbody = document.getElementById('report-preview-tbody');
  const tfoot = document.getElementById('report-preview-tfoot');
  if (!tbody) return;

  let totalVal = 0;
  tbody.innerHTML = adminProducts.map(p => {
    const stockVal = Math.round(p.price * p.stock * 100) / 100;
    totalVal += stockVal;
    const statusColor = p.stock === 0 ? '#c0392b' : p.stock < 10 ? '#e0a800' : '#27ae60';
    const statusLabel = p.stock === 0 ? '🔴 Out of Stock' : p.stock < 10 ? '🟡 Low Stock' : '🟢 OK';
    return `<tr style="border-top:1px solid #f0f2f5;">
      <td style="padding:12px 16px;">${p.emoji} ${p.name}</td>
      <td style="padding:12px 16px;text-transform:capitalize;">${p.cat}</td>
      <td style="padding:12px 16px;font-weight:700;">$${p.price}</td>
      <td style="padding:12px 16px;">${p.stock}</td>
      <td style="padding:12px 16px;font-weight:700;">$${stockVal.toFixed(2)}</td>
      <td style="padding:12px 16px;color:${statusColor};font-weight:600;">${statusLabel}</td>
    </tr>`;
  }).join('');

  const revenue = adminOrderList
    .filter(o => o.status !== 'Cancelled')
    .reduce((s,o) => s + parseFloat(o.total.replace('$','')), 0).toFixed(2);

  tfoot.innerHTML = `
    <tr style="background:#f5f7fa;font-weight:700;border-top:2px solid #e0e4ea;">
      <td colspan="4" style="padding:12px 16px;">TOTALS</td>
      <td style="padding:12px 16px;">$${totalVal.toFixed(2)} stock value</td>
      <td style="padding:12px 16px;color:var(--navy);">$${revenue} actual revenue</td>
    </tr>`;
}


// ── Safety net: ensure products always render even if async load is slow ──
document.addEventListener('DOMContentLoaded', () => {
  // If home-products is still empty after 300ms, render with whatever data we have
  setTimeout(() => {
    const el = document.getElementById('home-products');
    if (el && !el.innerHTML.trim()) {
      window.renderHomePage?.();
      window.renderListingPage?.();
    }
  }, 300);
});


// (globals defined in main script)
// ── Populate profile screen with real logged-in user data ─────────────────
function renderProfile() {
  const u = currentUser;
  if (!u) return;

  // Initials avatar
  const initials = u.name
    ? u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : u.email.slice(0, 2).toUpperCase();
  const avatarEl = document.getElementById('profile-avatar-initials');
  if (avatarEl) avatarEl.textContent = initials;

  // Name & email
  const nameEl  = document.getElementById('profile-display-name');
  const emailEl = document.getElementById('profile-display-email');
  if (nameEl)  nameEl.textContent  = u.name  || u.email.split('@')[0];
  if (emailEl) emailEl.textContent = u.email || '';

  // Member since — use Firebase uid creation year if available
  const sinceEl = document.getElementById('profile-member-since');
  if (sinceEl) {
    const year = new Date().getFullYear();
    sinceEl.textContent = 'Member since ' + year;
  }

  // Account settings email field
  const emailInput = document.getElementById('profile-email-input');
  if (emailInput) emailInput.value = u.email || '';
}



// ═══════════════════════════════════════════════════════════════════════
// FIRESTORE DATABASE LAYER
// All 5 collections: users, products, orders, advertisements, analytics
// Authors: Sarvesh (schema/auth), Hemit (admin/orders)
// ═══════════════════════════════════════════════════════════════════════

// ── Helper: get Firestore ops (set by Firebase module after login) ───────
function fs() { return window._firestoreOps || null; }

// ══════════════════════════════
// USERS COLLECTION
// ══════════════════════════════
async function fsUpdateUserProfile(name, phone) {
  const f = fs(); if (!f || !window.currentUser) return;
  try {
    await f.updateDoc(f.doc(f.db, 'users', window.currentUser.uid), {
      name, phone: phone || '', updatedAt: f.serverTimestamp()
    });
    window.currentUser.name = name;
    window._safeToast('✅ Profile updated in database!', 'gold');
  } catch(e) { window._safeToast('❌ Could not save: ' + e.message, 'error'); }
}

// ══════════════════════════════
// PRODUCTS COLLECTION
// ══════════════════════════════
async function fsLoadProducts() {
  const f = fs(); if (!f) return;
  try {
    const snap = await f.getDocs(f.collection(f.db, 'products'));
    if (snap.empty) { console.log('Products collection empty — using default products'); return; }
    adminProducts = snap.docs.map(d => {
      var data = d.data();
      return {
        id:          d.id,
        firestoreId: d.id,
        name:        data.name        || '',
        desc:        data.desc        || data.description || (data.category ? data.category + ' item' : 'Lancer gear'),
        price:       data.price       || 0,
        oldPrice:    data.oldPrice    || null,
        emoji:       data.emoji       || '📦',
        cat:         data.category    || data.cat || 'all',
        badge:       data.badge       || '',
        stars:       data.stars       || '★★★★☆',
        rating:      data.rating      || '4.5',
        stock:       data.stock       || 0,
        sku:         data.sku         || '',
        active:      data.active      !== false,
      };
    });
    window.renderHomePage?.(); window.renderListingPage?.();
    // If admin is viewing dashboard, update it too
    const kpiRow = document.getElementById('admin-kpi-row');
    if (kpiRow && kpiRow.innerHTML) window.renderAdminDashboard?.();
    console.log('✅ Products loaded from Firestore:', adminProducts.length);
  } catch(e) { console.warn('Products load failed:', e); }
}

async function fsSaveProduct(product) {
  const f = fs(); if (!f) return;
  try {
    const data = {
      name: product.name, category: product.cat || product.category,
      price: product.price, stock: product.stock,
      sku: product.sku || '', emoji: product.emoji || '📦',
      badge: product.badge || '', rating: product.rating || '4.5',
      active: true, updatedAt: f.serverTimestamp()
    };
    if (product.firestoreId) {
      await f.updateDoc(f.doc(f.db, 'products', product.firestoreId), data);
    } else {
      const ref = await f.addDoc(f.collection(f.db, 'products'), { ...data, createdAt: f.serverTimestamp() });
      product.firestoreId = ref.id;
    }
    window._safeToast('✅ Product saved to database!', 'gold');
  } catch(e) { window._safeToast('❌ Product save failed: ' + e.message, 'error'); }
}

async function fsDeleteProduct(firestoreId) {
  const f = fs(); if (!f || !firestoreId) return;
  try {
    await f.deleteDoc(f.doc(f.db, 'products', firestoreId));
  } catch(e) { console.warn('Product delete failed:', e); }
}

async function fsSeedProducts() {
  const f = fs(); if (!f) return;
  console.log('Seeding products to Firestore...');
  for (const p of adminProducts) {
    try {
      await f.addDoc(f.collection(f.db, 'products'), {
        name: p.name, category: p.cat, price: p.price, stock: p.stock,
        sku: p.sku || 'SKU-' + p.id, emoji: p.emoji,
        badge: p.badge || '', rating: p.rating || '4.5',
        active: true, createdAt: f.serverTimestamp(), updatedAt: f.serverTimestamp()
      });
    } catch(e) { console.warn('Seed error:', e); }
  }
  window._safeToast('✅ Products seeded to Firestore!', 'gold');
}

// ══════════════════════════════
// ORDERS COLLECTION
// ══════════════════════════════
async function fsPlaceOrder(orderData) {
  const f = fs(); if (!f || !window.currentUser) return null;
  try {
    const orderId = 'WL-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
    await f.setDoc(f.doc(f.db, 'orders', orderId), {
      orderId,
      userId:        window.currentUser.uid,
      customerName:  window.currentUser.name,
      customerEmail: window.currentUser.email,
      items:         orderData.items,
      subtotal:      orderData.subtotal,
      tax:           orderData.tax,
      total:         orderData.total,
      status:        'Processing',
      shippingAddress: orderData.address || '',
      paymentMethod: orderData.payment || 'Card',
      trackingNumber: '',
      createdAt:     f.serverTimestamp(),
      updatedAt:     f.serverTimestamp()
    });
    // Update user's totalOrders and totalSpent
    const userRef = f.doc(f.db, 'users', window.currentUser.uid);
    const uSnap   = await f.getDoc(userRef);
    if (uSnap.exists()) {
      await f.updateDoc(userRef, {
        totalOrders: (uSnap.data().totalOrders || 0) + 1,
        totalSpent:  (uSnap.data().totalSpent  || 0) + orderData.total
      });
    }
    window._safeToast('✅ Order ' + orderId + ' placed!', 'gold');
    return orderId;
  } catch(e) {
    window._safeToast('❌ Order failed: ' + e.message, 'error');
    return null;
  }
}

async function fsLoadUserOrders() {
  const f = fs(); if (!f || !window.currentUser) return;
  try {
    const q    = f.query(f.collection(f.db, 'orders'), f.where('userId', '==', window.currentUser.uid));
    const snap = await f.getDocs(q);
    const orders = snap.docs.map(d => d.data());
    renderUserOrders(orders);
  } catch(e) { console.warn('Orders load failed:', e); }
}

function renderUserOrders(orders) {
  const tbody = document.querySelector('#ptab-orders table tbody');
  if (!tbody) return;
  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray4);">No orders yet. Start shopping!</td></tr>';
    return;
  }
  let rows = '';
  orders.forEach(function(o) {
    const dateStr   = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : (o.date || '—');
    const itemsStr  = Array.isArray(o.items) ? o.items.map(function(i){ return i.name + (i.quantity > 1 ? ' x'+i.quantity : ''); }).join(', ') : (o.items || '—');
    const total     = o.total ? '$' + Number(o.total).toFixed(2) : '—';
    const statusCls = (o.status||'').toLowerCase().replace(' ','-');
        var trackBtn   = '<button class="btn btn-sm btn-outline" onclick="showScreen(&#39;tracking&#39;)">Track</button>';
    var reorderBtn = '<button class="btn btn-sm btn-outline">Reorder</button>';
    const actionBtn = o.status === 'Shipped' ? trackBtn : reorderBtn;
    rows += '<tr><td><strong>' + (o.orderId||o.id||'—') + '</strong></td><td>' + dateStr + '</td><td>' + itemsStr + '</td><td><strong>' + total + '</strong></td><td><span class="status-badge status-' + statusCls + '">' + (o.status||'—') + '</span></td><td>' + actionBtn + '</td></tr>';
  });
  tbody.innerHTML = rows;
}

async function fsUpdateOrderStatus(orderId, status) {
  const f = fs(); if (!f) return;
  try {
    await f.updateDoc(f.doc(f.db, 'orders', orderId), {
      status, updatedAt: f.serverTimestamp()
    });
    window._safeToast('✅ Order ' + orderId + ' → ' + status, 'gold');
  } catch(e) { window._safeToast('❌ Update failed: ' + e.message, 'error'); }
}

async function fsLoadAllOrders() {
  const f = fs(); if (!f) return;
  try {
    // No orderBy — avoids needing a Firestore composite index
    const snap = await f.getDocs(f.collection(f.db, 'orders'));
    adminOrderList = snap.docs.map(d => {
      const data = d.data();
      const itemsStr = Array.isArray(data.items)
        ? data.items.map(i => i.name + (i.quantity > 1 ? ' x' + i.quantity : '')).join(', ')
        : (data.items || '—');
      const dateStr = data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleDateString('en-US', {year:'numeric', month:'short', day:'numeric'})
        : '—';
      return {
        id:       data.orderId || d.id,
        customer: data.customerName  || '—',
        email:    data.customerEmail || '—',
        items:    itemsStr,
        total:    '$' + Number(data.total || 0).toFixed(2),
        date:     dateStr,
        status:   data.status || 'Processing'
      };
    });
    // Sort client-side by date descending
    adminOrderList.sort((a, b) => b.id.localeCompare(a.id));
    console.log('✅ Orders loaded from Firestore:', adminOrderList.length);
    window.renderAdminDashboard?.();
    window.renderAdminOrders?.();
  } catch(e) {
    console.error('Admin orders load failed:', e.message);
    window._safeToast('⚠️ Could not load orders: ' + e.message, 'error');
  }
}

// ══════════════════════════════
// ADVERTISEMENTS COLLECTION
// ══════════════════════════════
async function fsLoadAds() {
  const f = fs(); if (!f) return;
  try {
    const snap = await f.getDocs(f.collection(f.db, 'advertisements'));
    if (!snap.empty) {
      adminAdList = snap.docs.map(d => ({
        id:          d.id,
        firestoreId: d.id,
        title:       d.data().title || '',
        sub:         d.data().subtitle || d.data().sub || '',
        code:        d.data().promoCode || d.data().code || '',
        btn:         d.data().ctaButton || d.data().btn || '',
        bg:          d.data().theme || d.data().bg || 'navy',
        active:      d.data().active !== false,
        clicks:      d.data().clicks || 0,
        impressions: d.data().impressions || 0,
      }));
      console.log('✅ Ads loaded from Firestore:', adminAdList.length);
      window.renderAdminAds?.();
      window.buildHomepageCarousel?.();
    }
  } catch(e) { console.warn('Ads load failed:', e); }
}


async function fsSaveAd(ad) {
  const f = fs(); if (!f) return;
  try {
    const data = {
      title:     ad.title || '',
      subtitle:  ad.sub   || ad.subtitle || '',
      promoCode: ad.code  || ad.promoCode || '',
      ctaButton: ad.btn   || ad.ctaButton || '',
      theme:     ad.bg    || ad.theme    || 'navy',
      active:    ad.active === true || ad.active === 'true',
      updatedAt: f.serverTimestamp()
    };
    if (ad.firestoreId) {
      await f.updateDoc(f.doc(f.db, 'advertisements', ad.firestoreId), data);
      console.log('✅ Ad updated in Firestore:', ad.firestoreId, 'active:', data.active);
    }
  } catch(e) { console.warn('Ad save failed:', e.message); }
}

async function fsDeleteAd(firestoreId) {
  const f = fs(); if (!f || !firestoreId) return;
  try { await f.deleteDoc(f.doc(f.db, 'advertisements', firestoreId)); } catch(e) {}
}

// ══════════════════════════════
// ANALYTICS COLLECTION
// ══════════════════════════════
async function fsUpdateAnalytics() {
  const f = fs(); if (!f) return;
  try {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const rev   = adminOrderList.filter(o => o.status !== 'Cancelled')
                    .reduce((s, o) => s + parseFloat((o.total||'0').replace('$','')), 0);
    await f.setDoc(f.doc(f.db, 'analytics', month), {
      month,
      totalRevenue:  Math.round(rev * 100) / 100,
      totalOrders:   adminOrderList.filter(o => o.status !== 'Cancelled').length,
      cancelledOrders: adminOrderList.filter(o => o.status === 'Cancelled').length,
      topProduct:    adminProducts[0]?.name || '—',
      avgOrderValue: adminOrderList.length ? Math.round(rev / adminOrderList.length * 100) / 100 : 0,
      updatedAt:     f.serverTimestamp()
    }, { merge: true });
  } catch(e) { console.warn('Analytics update failed:', e); }
}

// ══════════════════════════════
// ADDRESSES SUBCOLLECTION
// ══════════════════════════════
async function fsSaveAddress(address) {
  const f = fs(); if (!f || !window.currentUser) return;
  try {
    await f.addDoc(f.collection(f.db, 'users', window.currentUser.uid, 'cart'),
      { ...address, type: 'address', createdAt: f.serverTimestamp() });
    // Actually use addresses subcollection
    await f.addDoc(f.collection(f.db, 'users', window.currentUser.uid, 'addresses'),
      { ...address, createdAt: f.serverTimestamp() });
  } catch(e) { console.warn('Address save failed:', e); }
}

// ══════════════════════════════
// LOAD TRIGGERS
// ══════════════════════════════
window.loadUserDataFromFirestore = async function() {
  await fsLoadProducts();
  await fsLoadUserOrders();
};

window.loadAdminDataFromFirestore = async function() {
  await fsLoadProducts();
  await fsLoadAllOrders();
  await fsLoadAds();
  await fsUpdateAnalytics();
};

// Seed products to Firestore on first admin login if collection is empty
window.fsSeedProducts = fsSeedProducts;
window.fsPlaceOrder   = fsPlaceOrder;
window.fsUpdateOrderStatus = fsUpdateOrderStatus;
window.fsUpdateUserProfile = fsUpdateUserProfile;
window.fsSaveAddress  = fsSaveAddress;
window.fsSaveAd       = fsSaveAd;
window.fsDeleteAd     = fsDeleteAd;
window.fsSaveProduct  = fsSaveProduct;
window.fsDeleteProduct = fsDeleteProduct;
  
// ── Expose ad functions globally via lazy lookup ─────────────────────────────
window.adToggle       = function(k){ if(typeof toggleAdActive!=='undefined') toggleAdActive(k); else window.toggleAdActive && window.toggleAdActive(k); };
window.adDelete       = function(k){ if(typeof deleteAd!=='undefined') deleteAd(k); else window.deleteAd && window.deleteAd(k); };
window.showAdminAddAd = function(){ var f=document.getElementById('admin-ad-form'); if(f){f.style.display='block';f.scrollIntoView({behavior:'smooth'});} };
// ── DATA ──────────────────────────────────────────
const PRODUCTS = [
  { id:1, name:"Lancer Premium Hoodie", desc:"80/20 cotton-poly blend, embroidered crest", price:45, emoji:"🧥", cat:"hoodies", badge:"Best Seller", stars:"★★★★★", rating:"4.8" },
  { id:2, name:"Lancer Classic T-Shirt", desc:"100% organic cotton, printed logo", price:25, emoji:"👕", cat:"tshirts", badge:"", stars:"★★★★☆", rating:"4.5" },
  { id:3, name:"Lancer Snapback Cap", desc:"One size fits all, embroidered patch", price:20, emoji:"🧢", cat:"caps", badge:"Limited", stars:"★★★★★", rating:"4.7" },
  { id:4, name:"Lancer Varsity Jacket", desc:"Premium wool blend, leather sleeves", price:120, emoji:"🥋", cat:"jackets", badge:"New", stars:"★★★★★", rating:"4.9" },
  { id:5, name:"Lancer Zip Hoodie", desc:"Full-zip, fleece-lined warmth", price:55, emoji:"🫱", cat:"hoodies", badge:"", stars:"★★★★☆", rating:"4.6" },
  { id:6, name:"Lancer Water Bottle", desc:"Stainless steel, 24oz insulated", price:28, emoji:"🍶", cat:"accessories", badge:"", stars:"★★★★☆", rating:"4.4" },
  { id:7, name:"Lancer Fleece Hoodie", desc:"Super soft sherpa lining", price:38, emoji:"🧣", cat:"hoodies", badge:"Sale", stars:"★★★★☆", rating:"4.5", oldPrice:50 },
  { id:8, name:"Lancer Tote Bag", desc:"Heavy canvas, screen-printed logo", price:18, emoji:"👜", cat:"accessories", badge:"", stars:"★★★★☆", rating:"4.3" },
];

let cart = [];
let cartIdCounter = 100;
let promoApplied = false;

// ── SCREEN NAVIGATION ─────────────────────────────
function showScreen(name) {
  if (name === 'admin-full') {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-admin-full');
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
    return;
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const sc = document.getElementById('screen-' + name);
  if (sc) sc.classList.add('active');
  window.scrollTo(0, 0);

  if (name === 'cart') renderCart();
  if (name === 'checkout') renderCheckout();
  if (name === 'admin') renderAdmin();
  if (name === 'tracking') renderTracking();
  if (name === 'profile') renderProfile();
}

// ── PRODUCT RENDERING ─────────────────────────────
function productCardHTML(p, onclick) {
  const price = p.oldPrice
    ? `<span class="product-price">$${p.price} <s>$${p.oldPrice}</s></span>`
    : `<span class="product-price">$${p.price}.00</span>`;
  const badge = p.badge ? `<div class="product-badge${p.badge==='Sale'?' sale':''}">${p.badge}</div>` : '';
  const primaryImg = p.images && p.images.length
    ? `<img src="${p.images[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt="${p.name}" />`
    : `<div style="font-size:64px;">${p.emoji}</div>`;
  return `
    <div class="product-card" onclick="${onclick}">
      <div class="product-img" style="${p.images && p.images.length ? 'padding:0;overflow:hidden;' : ''}">
        ${primaryImg}
        ${badge}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-stars">${p.stars} <span style="color:var(--gray4);font-size:11px;">(${p.rating})</span></div>
        <div class="product-footer" style="margin-top:10px;">
          ${price}
          <button class="add-btn" onclick="event.stopPropagation();quickAddToCart(${p.id})">+</button>
        </div>
      </div>
    </div>`;
}

function renderHomePage() {
  const el = document.getElementById('home-products');
  if (!el) return;
  el.innerHTML = adminProducts.slice(0,4).map(p => productCardHTML(p, `openDetail(${p.id})`)).join('');
}

function renderListingPage() {
  const el = document.getElementById('listing-products');
  if (!el) return;
  el.innerHTML = adminProducts.map(p => productCardHTML(p, `openDetail(${p.id})`)).join('');
}

// Called by admin after save/delete to refresh store views
function renderProducts() {
  renderHomePage();
  renderListingPage();
}

// ── PRODUCT DETAIL ─────────────────────────────────
let currentProduct = PRODUCTS[0];
let detailQty = 1;

function openDetail(id) {
  currentProduct = adminProducts.find(p => p.id === id) || PRODUCTS.find(p => p.id === id) || adminProducts[0];
  detailQty = 1;
  document.getElementById('detail-name').textContent = currentProduct.name;
  document.getElementById('detail-price').textContent = `$${currentProduct.price}.00`;
  document.getElementById('detail-breadcrumb').textContent = currentProduct.name;
  document.getElementById('detail-qty').textContent = 1;

  const imgs = (currentProduct.images && currentProduct.images.length) ? currentProduct.images : null;
  const mainEl = document.getElementById('detail-main-img');
  const thumbsEl = document.querySelector('.detail-thumbs');

  if (imgs) {
    // Show real uploaded images — CSS handles sizing
    mainEl.innerHTML = `<img src="${imgs[0]}" alt="Product image" />`;
    thumbsEl.innerHTML = imgs.map((src, i) => `
      <div class="detail-thumb ${i===0?'active':''}" onclick="selectThumbImg(this,'${src}')">
        <img src="${src}" alt="" />
      </div>
    `).join('');
  } else {
    // Fall back to emoji
    mainEl.innerHTML = '';
    mainEl.textContent = currentProduct.emoji;
    thumbsEl.innerHTML = `
      <div class="detail-thumb active" onclick="selectThumb(this,'${currentProduct.emoji}')">${currentProduct.emoji}</div>
      <div class="detail-thumb" onclick="selectThumb(this,'👕')">👕</div>
      <div class="detail-thumb" onclick="selectThumb(this,'🏒')">🏒</div>
      <div class="detail-thumb" onclick="selectThumb(this,'📦')">📦</div>
    `;
  }
  showScreen('detail');
}

function changeQty(d) {
  detailQty = Math.max(1, detailQty + d);
  document.getElementById('detail-qty').textContent = detailQty;
}

function selectThumb(el, emoji) {
  document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const mainEl = document.getElementById('detail-main-img');
  mainEl.innerHTML = '';
  mainEl.textContent = emoji;
}

function selectThumbImg(el, src) {
  document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('detail-main-img').innerHTML = `<img src="${src}" alt="Product image" />`;
}

function selectOpt(btn, groupId) {
  document.querySelectorAll(`#${groupId} .option-btn`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function addToCartFromDetail() {
  for (let i = 0; i < detailQty; i++) addToCart(currentProduct);
  showToast(`✓ ${detailQty}× ${currentProduct.name} added to cart`);
}

// ── CART ──────────────────────────────────────────
function quickAddToCart(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (p) { addToCart(p); showToast(`✓ ${p.name} added to cart`); }
}

function addToCart(product) {
  const existing = cart.find(i => i.productId === product.id);
  if (existing) { existing.qty++; }
  else { cart.push({ id: ++cartIdCounter, productId: product.id, name: product.name, price: product.price, emoji: product.emoji, qty: 1 }); }
  updateCartCount();
}

function updateCartCount() {
  const total = cart.reduce((s,i) => s+i.qty, 0);
  document.getElementById('cart-count').textContent = total;
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateCartCount();
  renderCart();
}

function changeCartQty(id, d) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + d);
  renderCart();
}

function getSubtotal() { return cart.reduce((s,i) => s + i.price * i.qty, 0); }
function getTotal(sub) { return sub + 5.99 - (promoApplied ? sub * 0.2 : 0); }

function renderCart() {
  const list = document.getElementById('cart-items-list');
  const sub = getSubtotal();
  const total = getTotal(sub);

  document.getElementById('cart-subtitle').textContent = cart.reduce((s,i)=>s+i.qty,0) + ' items';

  if (cart.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-title">Your cart is empty</div><p style="font-size:14px;color:var(--gray4);margin-top:8px;">Browse our collection and find something you love.</p><button class="btn btn-primary" style="margin-top:20px;" onclick="showScreen('listing')">Shop Now</button></div>`;
  } else {
    list.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-img">${item.emoji}</div>
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-meta">Size: M · Colour: Navy</div>
          <div class="cart-item-qty">
            <button class="qty-btn" style="width:30px;height:30px;font-size:16px;" onclick="changeCartQty(${item.id},-1)">−</button>
            <span style="font-size:15px;font-weight:600;min-width:20px;text-align:center;">${item.qty}</span>
            <button class="qty-btn" style="width:30px;height:30px;font-size:16px;" onclick="changeCartQty(${item.id},1)">+</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <div class="cart-item-price">$${(item.price*item.qty).toFixed(2)}</div>
          <button class="cart-remove" onclick="removeFromCart(${item.id})">✕</button>
        </div>
      </div>`).join('');
  }

  document.getElementById('cart-subtotal').textContent = '$' + sub.toFixed(2);
  document.getElementById('cart-total').textContent = '$' + total.toFixed(2);
  const dr = document.getElementById('discount-row');
  if (promoApplied) {
    dr.style.display = 'flex';
    document.getElementById('discount-val').textContent = '-$' + (sub*0.2).toFixed(2);
  } else { dr.style.display = 'none'; }
}

function applyPromo() {
  const val = document.getElementById('promo-input').value.trim().toUpperCase();
  if (val === 'LANCER20') {
    promoApplied = true;
    renderCart();
    showToast('🎉 Promo code applied! 20% off', 'gold');
  } else {
    showToast('❌ Invalid promo code');
  }
}

function renderCheckout() {
  const sub = getSubtotal();
  const total = getTotal(sub);
  document.getElementById('co-subtotal').textContent = '$' + sub.toFixed(2);
  document.getElementById('co-total').textContent = '$' + total.toFixed(2);
  document.getElementById('checkout-total').textContent = '$' + total.toFixed(2);
  const list = document.getElementById('checkout-items-list');
  list.innerHTML = cart.map(i => `
    <div class="summary-row">
      <span>${i.emoji} ${i.name} ×${i.qty}</span>
      <span>$${(i.price*i.qty).toFixed(2)}</span>
    </div>`).join('');
}

// ── ORDER FLOW ────────────────────────────────────
function placeOrder() {
  const orderId = '#WL-2024-' + (Math.floor(Math.random()*9000)+1000);
  document.getElementById('confirm-order-id').textContent = orderId;
  showScreen('confirm');
  showToast('🎉 Order placed successfully!', 'gold');
}

function renderTracking() {
  const list = document.getElementById('tracking-items');
  const total = document.getElementById('tracking-total');
  const items = cart.length > 0 ? cart : [
    { emoji:'🧥', name:'Lancer Premium Hoodie', qty:1, price:45 },
    { emoji:'🧢', name:'Lancer Snapback Cap', qty:1, price:20 },
  ];
  list.innerHTML = items.map(i => `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:44px;height:44px;background:var(--gray1);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;">${i.emoji}</div>
      <div style="flex:1;font-size:13px;"><div style="font-weight:600;">${i.name}</div><div style="color:var(--gray4);">Qty: ${i.qty}</div></div>
      <div style="font-weight:700;font-size:14px;">$${(i.price*i.qty).toFixed(2)}</div>
    </div>`).join('');
  const t = items.reduce((s,i)=>s+i.price*i.qty,0)+5.99;
  total.textContent = '$'+t.toFixed(2);
}

// ── ADMIN ─────────────────────────────────────────
// ── Cross-device product storage using JSONbin.io (free) ─────────────────
// 1. Sign up free at jsonbin.io
// 2. Create a new bin with [] as content, copy the bin ID
// 3. Go to API Keys, create a key, copy it
// 4. Replace the values below
const JSONBIN_BIN_ID  = 'YOUR_BIN_ID';   // e.g. '6659a1f1acd3cb34a843c1e2'
const JSONBIN_API_KEY = 'YOUR_API_KEY';  // e.g. '$2a$10$...'

let adminProducts = [...PRODUCTS.map(p => ({...p, stock: Math.floor(Math.random()*50)+5}))];
let _jsonbinReady  = JSONBIN_BIN_ID !== 'YOUR_BIN_ID' && JSONBIN_API_KEY !== 'YOUR_API_KEY';

async function saveAdminProductsToStorage() {
  // Always save locally for instant feedback
  try { localStorage.setItem('lancerAdminProducts', JSON.stringify(adminProducts)); } catch(e) {}

  // Also save to cloud if configured
  if (!_jsonbinReady) return;
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
      body: JSON.stringify(adminProducts.map(p => ({
        // Strip base64 images from cloud save (Cloudinary URLs are already compact)
        ...p,
        images: (p.images || []).filter(img => img && !img.startsWith('data:'))
      })))
    });
  } catch(e) { console.warn('Cloud save failed:', e); }
}

async function loadAdminProductsFromStorage() {
  // Try cloud first if configured
  if (_jsonbinReady) {
    try {
      const res  = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_API_KEY }
      });
      const data = await res.json();
      if (Array.isArray(data.record) && data.record.length > 0) {
        adminProducts = data.record;
      }
    } catch(e) { console.warn('Cloud load failed, using local:', e); }
  } else {
    // Fall back to localStorage
    try {
      const raw = localStorage.getItem('lancerAdminProducts');
      if (raw) { adminProducts = JSON.parse(raw); }
    } catch(e) {}
  }
  // Always render after data is ready
  renderHomePage();
  renderListingPage();
}

// Load on startup — renders fire inside after data is ready
loadAdminProductsFromStorage();

function renderAdmin() {
  const tbody = document.getElementById('admin-tbody');
  tbody.innerHTML = adminProducts.map(p => {
    const statusClass = p.stock < 10 ? 'status-badge' : 'status-badge status-delivered';
    const statusText = p.stock < 10 ? 'Low Stock' : 'Active';
    const stockClass = p.stock < 10 ? 'stock-low' : 'stock-ok';
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px;">
        <div style="width:40px;height:40px;background:var(--gray1);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;">${p.emoji}</div>
        <div><div style="font-weight:600;">${p.name}</div><div style="font-size:12px;color:var(--gray4);">SKU: L${p.id.toString().padStart(3,'0')}</div></div>
      </div></td>
      <td>${p.cat.charAt(0).toUpperCase()+p.cat.slice(1)}</td>
      <td><strong>$${p.price}.00</strong></td>
      <td class="${stockClass}">${p.stock}</td>
      <td><span class="${statusClass}" style="font-size:11px;padding:4px 10px;">${statusText}</span></td>
      <td><div class="action-btns">
        <button class="action-btn action-edit" onclick="showToast('✏️ Edit mode for: ${p.name}')">Edit</button>
        <button class="action-btn action-del" onclick="deleteProduct(${p.id})">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
}

function deleteProduct(id) {
  adminProducts = adminProducts.filter(p => p.id !== id);
  renderAdmin();
  showToast('🗑 Product removed');
}

function showAddProduct() {
  const form = document.getElementById('add-product-form');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  if (form.style.display === 'block') form.scrollIntoView({behavior:'smooth', block:'start'});
}

function saveProduct() {
  const name = document.getElementById('new-prod-name').value;
  const price = parseFloat(document.getElementById('new-prod-price').value) || 0;
  const stock = parseInt(document.getElementById('new-prod-stock').value) || 0;
  const cat = document.getElementById('new-prod-cat').value;
  const emoji = document.getElementById('new-prod-emoji').value || '📦';
  if (!name) { showToast('❌ Please enter a product name'); return; }
  const newId = Math.max(...adminProducts.map(p=>p.id)) + 1;
  adminProducts.push({ id: newId, name, price, stock, cat: cat.toLowerCase(), emoji, badge:'New', stars:'★★★★☆', rating:'4.0', desc:'New product' });
  PRODUCTS.push({ id: newId, name, price, stock, cat: cat.toLowerCase(), emoji, badge:'New', stars:'★★★★☆', rating:'4.0', desc:'New product' });
  renderAdmin();
  document.getElementById('add-product-form').style.display = 'none';
  ['new-prod-name','new-prod-price','new-prod-stock','new-prod-sku','new-prod-emoji'].forEach(id => document.getElementById(id).value='');
  showToast('✓ Product added successfully', 'gold');
}

// ── AUTH ──────────────────────────────────────────
function switchAuthTab(tab) {
  const fl = document.getElementById('form-login');
  const fr = document.getElementById('form-register');
  if (fl) fl.style.display    = tab === 'login'    ? 'block' : 'none';
  if (fr) fr.style.display    = tab === 'register' ? 'block' : 'none';
  const tl = document.getElementById('tab-login');
  const tr = document.getElementById('tab-register');
  if (tl) tl.classList.toggle('active', tab === 'login');
  if (tr) tr.classList.toggle('active', tab === 'register');
}


// ── USER AUTH — powered by Firebase (see <script type="module"> in <head>) ──
let currentUser = null;

// Called by old onclick="doLogin()" — delegates to Firebase module
function doLogin() { window._firebaseAuth?.signInEmail(); }

// Called by old onclick="doLogout()" — delegates to Firebase module
function doLogout() { window._firebaseAuth?.signOut(); }

function updateNavForUser() {
  const loginBtn  = document.getElementById('nav-login-btn');
  const logoutBtn = document.getElementById('nav-logout-btn');
  const adminBtn  = document.getElementById('nav-admin-btn');
  if (!loginBtn) return;
  if (currentUser) {
    loginBtn.style.display  = 'none';
    logoutBtn.style.display = 'inline-flex';
    if (adminBtn) adminBtn.style.display = currentUser.role === 'admin' ? 'inline-flex' : 'none';
  } else {
    loginBtn.style.display  = 'inline-flex';
    logoutBtn.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
  }
}

function doRegister() { showScreen('home'); showToast('🎉 Account created! Welcome to Lancer Store', 'gold'); }

// ── MISC ──────────────────────────────────────────
function selectPayMethod(el) {
  document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('active'));
  el.classList.add('active');
}

function setCategory(el) {
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── INIT ──────────────────────────────────────────

// ── AD CAROUSEL ──────────────────────────────────
(function() {
  var total = 4, cur = 0, timer = null, paused = false;
  var track = document.getElementById('adTrack');
  var dotsWrap = document.getElementById('adDots');
  var pausePill = document.getElementById('adPausePill');

  // build dots
  for (var i = 0; i < total; i++) {
    var d = document.createElement('button');
    d.className = 'ad-dot' + (i === 0 ? ' active' : '');
    d.setAttribute('aria-label', 'Slide ' + (i+1));
    (function(idx){ d.onclick = function(){ adGoTo(idx); }; })(i);
    dotsWrap.appendChild(d);
  }

  function updateDots() {
    var dots = dotsWrap.querySelectorAll('.ad-dot');
    dots.forEach(function(d,i){ d.classList.toggle('active', i === cur); });
  }

  window.adGoTo = function(idx) {
    cur = (idx + total) % total;
    track.style.transform = 'translateX(-' + (cur * 100) + '%)';
    updateDots();
  };

  window.adMove = function(dir) {
    adGoTo(cur + dir);
    if (!paused) { clearInterval(timer); startTimer(); }
  };

  function startTimer() {
    timer = setInterval(function(){ adGoTo(cur + 1); }, 4000);
  }

  window.adPause = function() {
    paused = true;
    clearInterval(timer);
    pausePill.classList.add('visible');
  };

  window.adResume = function() {
    paused = false;
    pausePill.classList.remove('visible');
    startTimer();
  };

  startTimer();
})();

// ─────────────────────────────────────────────────────────────
// ADMIN FULL DASHBOARD DATA & LOGIC
// ─────────────────────────────────────────────────────────────

// ── Shared product store (same as adminProducts above but we alias) ──
let adminAdList = [
  { id:1, title:'Winter Sale — 20% Off All Hoodies', sub:'This week only · while stocks last', code:'LANCER20', btn:'Shop the Sale', bg:'navy', active:true },
  { id:2, title:'Tournament Sale 50% Off!', sub:'Student Discount: Extra 20% Off', code:'TOURNAMENT50', btn:'Shop Now', bg:'gold', active:true },
  { id:3, title:'New Arrivals — Spring Collection', sub:'Fresh gear for the new semester', code:'SPRING10', btn:'Explore Now', bg:'green', active:false },
];
let adminAdNextId = 4;

// adminOrderList — populated from Firestore on admin login
let adminOrderList = [];

async function renderAdminFull() {
  const badge = document.getElementById('admin-user-badge');
  const cu = window.currentUser || currentUser; if (badge && cu) badge.textContent = (cu.name || cu.email || 'Admin') + ' · ADMIN';

  // Show loading spinner
  const kpiRow = document.getElementById('admin-kpi-row');
  if (kpiRow) kpiRow.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray4);">⏳ Loading from Firestore...</div>';

  // Always attempt Firestore load
  if (window._firestoreOps) {
    await window.loadAdminDataFromFirestore?.();
  } else {
    // Firestore not ready yet — wait up to 3s then try again
    let tries = 0;
    while (!window._firestoreOps && tries < 6) {
      await new Promise(r => setTimeout(r, 500));
      tries++;
    }
    if (window._firestoreOps) await window.loadAdminDataFromFirestore?.();
  }

  switchAdminTab('dashboard');
}

function switchAdminTab(tab) {
  ['dashboard','products','orders','ads','reports'].forEach(t => {
    const btn   = document.getElementById('atab-' + t);
    const panel = document.getElementById('apanel-' + t);
    if (btn)   btn.classList.toggle('active', t === tab);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'dashboard') renderAdminDashboard();
  if (tab === 'products')  renderAdminProducts();
  if (tab === 'orders')    renderAdminOrders();
  if (tab === 'ads')       renderAdminAds();
  if (tab === 'reports')    renderReportsPreview();
}

// ── DASHBOARD ──────────────────────────────────────────────────
function renderAdminDashboard() {
  const totalOrders   = adminOrderList.length;
  const revenue       = adminOrderList.filter(o => o.status !== 'Cancelled')
                          .reduce((s, o) => s + parseFloat(o.total.replace('$','')), 0).toFixed(2);
  const lowStock      = adminProducts.filter(p => p.stock < 10).length;
  const totalProducts = adminProducts.length;

  document.getElementById('admin-kpi-row').innerHTML = `
    <div class="kpi-card"><div class="kpi-val">${totalOrders}</div><div class="kpi-lbl">Total Orders</div><div class="kpi-delta">↑ 12% this month</div></div>
    <div class="kpi-card"><div class="kpi-val">$${revenue}</div><div class="kpi-lbl">Revenue (Month)</div><div class="kpi-delta">↑ 8% vs last month</div></div>
    <div class="kpi-card"><div class="kpi-val">${lowStock}</div><div class="kpi-lbl">Low Stock Alerts</div><div class="kpi-delta" style="color:#e0a800;">⚠ Reorder needed</div></div>
    <div class="kpi-card"><div class="kpi-val">${totalProducts}</div><div class="kpi-lbl">Products Listed</div><div class="kpi-delta">↑ 3 added this week</div></div>
  `;

  // Recent orders
  const recent = adminOrderList.slice(0, 5);
  document.getElementById('admin-recent-orders').innerHTML =
    '<tr style="background:#f5f7fa;"><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#888;">Order</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#888;">Customer</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#888;">Total</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#888;">Status</th></tr>' +
    recent.map(o => `<tr style="border-top:1px solid #f0f0f0;">
      <td style="padding:10px;">${o.id}</td>
      <td style="padding:10px;">${o.customer}</td>
      <td style="padding:10px;font-weight:700;">${o.total}</td>
      <td style="padding:10px;">${statusPill(o.status)}</td>
    </tr>`).join('');

  // Low stock
  const low = adminProducts.filter(p => p.stock < 10);
  document.getElementById('admin-low-stock').innerHTML = low.length === 0
    ? '<div style="color:#27ae60;font-size:14px;padding:20px 0;">✅ All products have healthy stock levels.</div>'
    : low.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;">
        <div>${p.emoji} ${p.name}</div>
        <div style="font-weight:700;color:${p.stock === 0 ? '#c0392b' : '#e0a800'};">${p.stock === 0 ? 'OUT OF STOCK' : p.stock + ' left'}</div>
      </div>`).join('');
}

// ── PRODUCTS ────────────────────────────────────────────────────
function renderAdminProducts() {
  const tbody = document.getElementById('admin-full-prod-tbody');
  if (!tbody) return;
  tbody.innerHTML = adminProducts.map(p => `
    <tr style="border-top:1px solid #f0f2f5;">
      <td style="padding:14px 16px;">${p.emoji} ${p.name}</td>
      <td style="padding:14px 16px;text-transform:capitalize;">${p.cat}</td>
      <td style="padding:14px 16px;font-weight:700;">$${p.price}</td>
      <td style="padding:14px 16px;">${p.stock}</td>
      <td style="padding:14px 16px;">${p.stock === 0 ? '<span class="status-pill sp-cancelled">Out of Stock</span>' : p.stock < 10 ? '<span class="status-pill sp-processing">Low Stock</span>' : '<span class="status-pill sp-delivered">In Stock</span>'}</td>
      <td style="padding:14px 16px;">
        <button class="btn btn-sm btn-outline" onclick="editAdminProduct(${p.id})" style="margin-right:6px;">✏ Edit</button>
        <button class="btn btn-sm" style="background:#ffeaea;color:#c0392b;" onclick="deleteAdminProduct(${p.id})">🗑</button>
      </td>
    </tr>
  `).join('');
}

// ── Image state for the product form ──────────────────────────
let apfImages = [null, null, null, null, null]; // up to 5 slots

function renderImgSlots() {
  const container = document.getElementById('apf-img-slots');
  if (!container) return;
  container.innerHTML = '';
  apfImages.forEach((img, i) => {
    const slot = document.createElement('div');
    slot.className = 'img-slot';
    if (img) {
      slot.innerHTML = `
        <img src="${img}" alt="Product image ${i+1}" />
        <button class="slot-remove" onclick="removeAdminImg(${i})" title="Remove">✕</button>
        ${i === 0 ? '<div class="slot-primary-badge">PRIMARY</div>' : ''}
      `;
    } else {
      slot.innerHTML = `
        <div class="slot-add-icon">+</div>
        <div class="slot-add-text">Add photo</div>
      `;
      slot.onclick = () => { window._imgSlotTarget = i; document.getElementById('apf-img-input').click(); };
    }
    container.appendChild(slot);
  });
  // Add-more button if <5 images and at least one slot filled
  const filled = apfImages.filter(Boolean).length;
  if (filled === 5) return;
}

// ── Cloudinary config — update with your own cloud name & upload preset ──
// 1. Sign up free at cloudinary.com
// 2. Go to Settings → Upload → Add upload preset → set to "Unsigned"
// 3. Replace the values below with yours
const CLOUDINARY_CLOUD_NAME   = 'YOUR_CLOUD_NAME';    // e.g. 'lancer-store'
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET'; // e.g. 'lancer_products'

async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  fd.append('folder', 'lancer-store-products');
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST', body: fd
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
  return data.secure_url; // permanent https:// URL, works on all devices
}

async function handleAdminImgUpload(input) {
  const files = Array.from(input.files).slice(0, 5);
  if (!files.length) return;

  // Show status
  const status = document.getElementById('apf-upload-status');
  if (status) status.style.display = 'block';

  // Check if Cloudinary is configured
  const cloudinaryReady = CLOUDINARY_CLOUD_NAME !== 'YOUR_CLOUD_NAME' && CLOUDINARY_UPLOAD_PRESET !== 'YOUR_UPLOAD_PRESET';

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    const targetSlot = typeof window._imgSlotTarget === 'number' ? window._imgSlotTarget : fi;
    window._imgSlotTarget = null;

    if (cloudinaryReady) {
      // Upload to cloud → permanent URL
      try {
        if (status) status.textContent = `⏳ Uploading image ${fi+1} of ${files.length}...`;
        const url = await uploadToCloudinary(file);
        apfImages[targetSlot] = url;
        renderImgSlots();
      } catch(e) {
        showToast('❌ Upload failed: ' + e.message, 'error');
      }
    } else {
      // Cloudinary not configured → fall back to base64 with warning
      await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
          apfImages[targetSlot] = e.target.result;
          renderImgSlots();
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
  }

  if (status) status.style.display = 'none';
  input.value = '';

  if (!cloudinaryReady) {
    showToast('⚠️ Using local storage — images will notsync across devices. Set up Cloudinary to fix this.', 'error');
  }
}

function removeAdminImg(i) {
  apfImages[i] = null;
  // Compact: shift remaining images left
  apfImages = [...apfImages.filter(Boolean), ...Array(5).fill(null)].slice(0, 5);
  renderImgSlots();
}

function showAdminAddProd() {
  document.getElementById('apf-name').value  = '';
  document.getElementById('apf-price').value = '';
  document.getElementById('apf-stock').value = '';
  document.getElementById('apf-sku').value   = '';
  document.getElementById('apf-emoji').value = '';
  document.getElementById('apf-edit-id').value = '';
  apfImages = [null, null, null, null, null];
  renderImgSlots();
  document.getElementById('admin-prod-form-title').textContent = 'Add New Product';
  document.getElementById('admin-prod-form').style.display = 'block';
  document.getElementById('admin-prod-form').scrollIntoView({ behavior:'smooth' });
}

function editAdminProduct(id) {
  const p = adminProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('apf-name').value  = p.name;
  document.getElementById('apf-price').value = p.price;
  document.getElementById('apf-stock').value = p.stock;
  document.getElementById('apf-sku').value   = p.sku || '';
  document.getElementById('apf-emoji').value = p.emoji;
  document.getElementById('apf-edit-id').value = id;
  // Load existing images if any
  apfImages = p.images ? [...p.images, ...Array(5).fill(null)].slice(0,5) : [null,null,null,null,null];
  renderImgSlots();
  document.getElementById('admin-prod-form-title').textContent = 'Edit Product';
  document.getElementById('admin-prod-form').style.display = 'block';
  document.getElementById('admin-prod-form').scrollIntoView({ behavior:'smooth' });
}

function saveAdminProduct() {
  const name  = document.getElementById('apf-name').value.trim();
  const price = parseFloat(document.getElementById('apf-price').value);
  const stock = parseInt(document.getElementById('apf-stock').value);
  const cat   = document.getElementById('apf-cat').value;
  const sku   = document.getElementById('apf-sku').value.trim();
  const emoji = document.getElementById('apf-emoji').value.trim() || '📦';
  const editId = document.getElementById('apf-edit-id').value;
  const images = apfImages.filter(Boolean); // only non-null
  if (!name || isNaN(price) || isNaN(stock)) { showToast('❌ Please fill all required fields', 'error'); return; }
  if (editId) {
    const p = adminProducts.find(x => x.id === parseInt(editId));
    if (p) { p.name = name; p.price = price; p.stock = stock; p.cat = cat.toLowerCase(); p.sku = sku; p.emoji = emoji; p.images = images; }
    showToast('✅ Product updated!', 'gold');
  } else {
    const newId = Math.max(...adminProducts.map(p => p.id)) + 1;
    adminProducts.push({ id:newId, name, price, stock, cat:cat.toLowerCase(), sku, emoji, images, badge:'New', stars:'★★★★☆', rating:'4.0', desc:'New product' });
    showToast('✅ Product added!', 'gold');
  }
  apfImages = [null,null,null,null,null];
  document.getElementById('admin-prod-form').style.display = 'none';
  saveAdminProductsToStorage().then(() => { renderAdminProducts(); renderProducts(); });
  const saved = adminProducts.find(p => p.name === document.getElementById('apf-name')?.value.trim()); if(saved) window.fsSaveProduct?.(saved);
}

function deleteAdminProduct(id) {
  if (!confirm('Delete this product?')) return;
  adminProducts = adminProducts.filter(p => p.id !== id);
  saveAdminProductsToStorage().then(() => { renderAdminProducts(); renderProducts(); });
  const saved = adminProducts.find(p => p.name === document.getElementById('apf-name')?.value.trim()); if(saved) window.fsSaveProduct?.(saved);
  showToast('🗑 Product deleted', 'gold');
}

// ── ORDERS ──────────────────────────────────────────────────────
function renderAdminOrders() {
  const filterStatus = (document.getElementById('order-status-filter')?.value || '').toLowerCase();
  const search       = (document.getElementById('order-search')?.value || '').toLowerCase();
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;
  let list = adminOrderList.filter(o => {
    const matchStatus = !filterStatus || o.status.toLowerCase() === filterStatus;
    const matchSearch = !search || o.id.toLowerCase().includes(search) || o.customer.toLowerCase().includes(search);
    return matchStatus && matchSearch;
  });
  tbody.innerHTML = list.map(o => `
    <tr style="border-top:1px solid #f0f2f5;">
      <td style="padding:14px 16px;font-weight:700;color:var(--navy);">${o.id}</td>
      <td style="padding:14px 16px;"><div>${o.customer}</div><div style="font-size:11px;color:#888;">${o.email}</div></td>
      <td style="padding:14px 16px;">${o.items}</td>
      <td style="padding:14px 16px;font-weight:700;">${o.total}</td>
      <td style="padding:14px 16px;">${o.date}</td>
      <td style="padding:14px 16px;">${statusPill(o.status)}</td>
      <td style="padding:14px 16px;">
        <select style="padding:6px 10px;border:1.5px solid #e0e4ea;border-radius:8px;font-size:12px;font-family:'DM Sans',sans-serif;" onchange="updateOrderStatus('${o.id}', this.value)">
          <option ${o.status==='Processing'?'selected':''}>Processing</option>
          <option ${o.status==='Shipped'   ?'selected':''}>Shipped</option>
          <option ${o.status==='Delivered' ?'selected':''}>Delivered</option>
          <option ${o.status==='Cancelled' ?'selected':''}>Cancelled</option>
        </select>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="padding:30px;text-align:center;color:#888;">No orders match your filter.</td></tr>';
}

function updateOrderStatus(id, status) {
  const o = adminOrderList.find(x => x.id === id);
  if (o) { o.status = status; showToast('✅ Order ' + id + ' → ' + status, 'gold'); renderAdminOrders(); window.fsUpdateOrderStatus?.(id, status); }
}

// ── ADS ─────────────────────────────────────────────────────────
function renderAdminAds() {
  var list = document.getElementById('admin-ads-list');
  if (!list) return;
  var html = '';
  adminAdList.forEach(function(a) {
    var adKey  = String(a.firestoreId || a.id);
    var bgCls  = a.bg === 'gold' ? 'gold-ad' : a.bg === 'red' ? 'red-ad' : a.bg === 'green' ? 'green-ad' : '';
    var live   = a.active
      ? '<span style="background:#d4edda;color:#155724;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">LIVE</span>'
      : '<span style="background:#f8d7da;color:#721c24;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">DRAFT</span>';
    html += '<div class="ad-card ' + bgCls + '" data-adkey="' + adKey + '">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">';
    html += '<div style="font-weight:700;font-size:15px;">' + (a.title||'') + '</div>' + live;
    html += '</div>';
    html += '<div style="font-size:13px;color:#666;margin-bottom:8px;">' + (a.sub||a.subtitle||'') + '</div>';
    html += '<div style="font-size:12px;margin-bottom:12px;"><strong>Code:</strong> ' + (a.code||a.promoCode||'') + ' | <strong>CTA:</strong> ' + (a.btn||a.ctaButton||'') + '</div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button class="btn btn-sm btn-outline ad-toggle-btn" data-adkey="' + adKey + '">' + (a.active ? '⏸ Pause' : '▶ Activate') + '</button>';
    html += '<button class="btn btn-sm ad-delete-btn" style="background:#ffeaea;color:#c0392b;" data-adkey="' + adKey + '">🗑 Delete</button>';
    html += '</div></div>';
  });
  list.innerHTML = html;

  // Event delegation — attach once after rendering
  list.onclick = function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var key = btn.getAttribute('data-adkey');
    if (!key) return;
    if (btn.classList.contains('ad-toggle-btn')) {
      toggleAdActive(key);
    } else if (btn.classList.contains('ad-delete-btn')) {
      deleteAd(key);
    }
  };
}

function toggleAdActive(key) {
  var a = adminAdList.find(function(x){ return String(x.id)===String(key)||String(x.firestoreId)===String(key); });
  if (!a) return;
  a.active = !a.active;
  if (window.fsSaveAd) window.fsSaveAd(a);
  renderAdminAds();
  if (window.buildHomepageCarousel) window.buildHomepageCarousel();
  showToast(a.active ? '▶ Ad is now LIVE' : '⏸ Ad paused', 'gold');
}
function deleteAd(key) {
  if (!confirm('Delete this ad?')) return;
  var a = adminAdList.find(function(x){ return String(x.id)===String(key)||String(x.firestoreId)===String(key); });
  if (a && a.firestoreId && window.fsDeleteAd) window.fsDeleteAd(a.firestoreId);
  adminAdList = adminAdList.filter(function(x){ return String(x.id)!==String(key)&&String(x.firestoreId)!==String(key); });
  renderAdminAds();
  if (window.buildHomepageCarousel) window.buildHomepageCarousel();
  showToast('🗑 Ad deleted', 'gold');
}
function adToggle(key) { toggleAdActive(key); }
function adDelete(key) { deleteAd(key); }

async function fsSaveAd(ad) {
  const f = fs(); if (!f) return;
  try {
    const data = {
      title:     ad.title || '',
      subtitle:  ad.sub   || ad.subtitle || '',
      promoCode: ad.code  || ad.promoCode || '',
      ctaButton: ad.btn   || ad.ctaButton || '',
      theme:     ad.bg    || ad.theme    || 'navy',
      active:    ad.active === true || ad.active === 'true',
      updatedAt: f.serverTimestamp()
    };
    if (ad.firestoreId) {
      await f.updateDoc(f.doc(f.db, 'advertisements', ad.firestoreId), data);
      console.log('✅ Ad updated in Firestore:', ad.firestoreId, 'active:', data.active);
    }
  } catch(e) { console.warn('Ad save failed:', e.message); }
}

async function fsDeleteAd(firestoreId) {
  const f = fs(); if (!f || !firestoreId) return;
  try { await f.deleteDoc(f.doc(f.db, 'advertisements', firestoreId)); } catch(e) {}
}

// ══════════════════════════════
// ANALYTICS COLLECTION
// ══════════════════════════════
async function fsUpdateAnalytics() {
  const f = fs(); if (!f) return;
  try {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const rev   = adminOrderList.filter(o => o.status !== 'Cancelled')
                    .reduce((s, o) => s + parseFloat((o.total||'0').replace('$','')), 0);
    await f.setDoc(f.doc(f.db, 'analytics', month), {
      month,
      totalRevenue:  Math.round(rev * 100) / 100,
      totalOrders:   adminOrderList.filter(o => o.status !== 'Cancelled').length,
      cancelledOrders: adminOrderList.filter(o => o.status === 'Cancelled').length,
      topProduct:    adminProducts[0]?.name || '—',
      avgOrderValue: adminOrderList.length ? Math.round(rev / adminOrderList.length * 100) / 100 : 0,
      updatedAt:     f.serverTimestamp()
    }, { merge: true });
  } catch(e) { console.warn('Analytics update failed:', e); }
}

// ══════════════════════════════
// ADDRESSES SUBCOLLECTION
// ══════════════════════════════
async function fsSaveAddress(address) {
  const f = fs(); if (!f || !window.currentUser) return;
  try {
    await f.addDoc(f.collection(f.db, 'users', window.currentUser.uid, 'cart'),
      { ...address, type: 'address', createdAt: f.serverTimestamp() });
    // Actually use addresses subcollection
    await f.addDoc(f.collection(f.db, 'users', window.currentUser.uid, 'addresses'),
      { ...address, createdAt: f.serverTimestamp() });
  } catch(e) { console.warn('Address save failed:', e); }
}

// ══════════════════════════════
// LOAD TRIGGERS
// ══════════════════════════════
window.loadUserDataFromFirestore = async function() {
  await fsLoadProducts();
  await fsLoadUserOrders();
};

window.loadAdminDataFromFirestore = async function() {
  await fsLoadProducts();
  await fsLoadAllOrders();
  await fsLoadAds();
  await fsUpdateAnalytics();
};

// Seed products to Firestore on first admin login if collection is empty
window.fsSeedProducts = fsSeedProducts;
window.fsPlaceOrder   = fsPlaceOrder;
window.fsUpdateOrderStatus = fsUpdateOrderStatus;
window.fsUpdateUserProfile = fsUpdateUserProfile;
window.fsSaveAddress  = fsSaveAddress;
window.fsSaveAd       = fsSaveAd;
window.fsDeleteAd     = fsDeleteAd;
window.fsSaveProduct  = fsSaveProduct;
window.fsDeleteProduct = fsDeleteProduct;
  

// ── Save new ad to Firestore ─────────────────────────────────────────────────
async function saveAdminAd() {
  var title  = (document.getElementById('adf-title')?.value || '').trim();
  var sub    = (document.getElementById('adf-sub')?.value   || '').trim();
  var code   = (document.getElementById('adf-code')?.value  || '').trim();
  var btn    = (document.getElementById('adf-btn')?.value   || '').trim();
  var bg     = document.getElementById('adf-bg')?.value     || 'navy';
  var active = (document.getElementById('adf-active')?.value || '1') === '1';
  if (!title) { showToast('❌ Please enter a title', 'error'); return; }

  // Write directly to Firestore
  var f = window._firestoreOps;
  if (f) {
    try {
      var ref = await f.addDoc(f.collection(f.db, 'advertisements'), {
        title:       title,
        subtitle:    sub,
        promoCode:   code,
        ctaButton:   btn,
        theme:       bg,
        active:      active,
        clicks:      0,
        impressions: 0,
        createdAt:   f.serverTimestamp(),
        updatedAt:   f.serverTimestamp()
      });
      // Add to local list with the real Firestore ID
      adminAdList.push({ id: ref.id, firestoreId: ref.id, title: title, sub: sub, code: code, btn: btn, bg: bg, active: active });
      showToast('✅ Ad saved to Firebase!', 'gold');
    } catch(e) {
      showToast('❌ Firebase save failed: ' + e.message, 'error');
      return;
    }
  } else {
    // Firestore not ready — save locally only
    adminAdList.push({ id: Date.now(), title: title, sub: sub, code: code, btn: btn, bg: bg, active: active });
    showToast('⚠️ Saved locally only (not signed in)', 'gold');
  }

  document.getElementById('admin-ad-form').style.display = 'none';
  renderAdminAds();
  buildHomepageCarousel();
  // Clear form
  ['adf-title','adf-sub','adf-code','adf-btn'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
}

// ── Show add ad form ─────────────────────────────────────────────────────────
function showAdminAddAd() {
  var f = document.getElementById('admin-ad-form');
  if (f) { f.style.display = 'block'; f.scrollIntoView({behavior:'smooth'}); }
}

// ── DATA ──────────────────────────────────────────
// (PRODUCTS already defined above)

// cart already declared above
let promoApplied = false;

// ── SCREEN NAVIGATION ─────────────────────────────
function showScreen(name) {
  if (name === 'admin-full') {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-admin-full');
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
    return;
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const sc = document.getElementById('screen-' + name);
  if (sc) sc.classList.add('active');
  window.scrollTo(0, 0);

  if (name === 'cart') renderCart();
  if (name === 'checkout') renderCheckout();
  if (name === 'admin') renderAdmin();
  if (name === 'tracking') renderTracking();
  if (name === 'profile') renderProfile();
}

// ── PRODUCT RENDERING ─────────────────────────────
function productCardHTML(p, onclick) {
  const price = p.oldPrice
    ? `<span class="product-price">$${p.price} <s>$${p.oldPrice}</s></span>`
    : `<span class="product-price">$${p.price}.00</span>`;
  const badge = p.badge ? `<div class="product-badge${p.badge==='Sale'?' sale':''}">${p.badge}</div>` : '';
  const primaryImg = p.images && p.images.length
    ? `<img src="${p.images[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt="${p.name}" />`
    : `<div style="font-size:64px;">${p.emoji}</div>`;
  return `
    <div class="product-card" onclick="${onclick}">
      <div class="product-img" style="${p.images && p.images.length ? 'padding:0;overflow:hidden;' : ''}">
        ${primaryImg}
        ${badge}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-stars">${p.stars} <span style="color:var(--gray4);font-size:11px;">(${p.rating})</span></div>
        <div class="product-footer" style="margin-top:10px;">
          ${price}
          <button class="add-btn" onclick="event.stopPropagation();quickAddToCart(${p.id})">+</button>
        </div>
      </div>
    </div>`;
}

function renderHomePage() {
  const el = document.getElementById('home-products');
  if (!el) return;
  el.innerHTML = adminProducts.slice(0,4).map(p => productCardHTML(p, `openDetail(${p.id})`)).join('');
}

function renderListingPage() {
  const el = document.getElementById('listing-products');
  if (!el) return;
  el.innerHTML = adminProducts.map(p => productCardHTML(p, `openDetail(${p.id})`)).join('');
}

// Called by admin after save/delete to refresh store views
function renderProducts() {
  renderHomePage();
  renderListingPage();
}

// ── PRODUCT DETAIL ─────────────────────────────────
let currentProduct = PRODUCTS[0];
let detailQty = 1;

function openDetail(id) {
  currentProduct = adminProducts.find(p => p.id === id) || PRODUCTS.find(p => p.id === id) || adminProducts[0];
  detailQty = 1;
  document.getElementById('detail-name').textContent = currentProduct.name;
  document.getElementById('detail-price').textContent = `$${currentProduct.price}.00`;
  document.getElementById('detail-breadcrumb').textContent = currentProduct.name;
  document.getElementById('detail-qty').textContent = 1;

  const imgs = (currentProduct.images && currentProduct.images.length) ? currentProduct.images : null;
  const mainEl = document.getElementById('detail-main-img');
  const thumbsEl = document.querySelector('.detail-thumbs');

  if (imgs) {
    // Show real uploaded images — CSS handles sizing
    mainEl.innerHTML = `<img src="${imgs[0]}" alt="Product image" />`;
    thumbsEl.innerHTML = imgs.map((src, i) => `
      <div class="detail-thumb ${i===0?'active':''}" onclick="selectThumbImg(this,'${src}')">
        <img src="${src}" alt="" />
      </div>
    `).join('');
  } else {
    // Fall back to emoji
    mainEl.innerHTML = '';
    mainEl.textContent = currentProduct.emoji;
    thumbsEl.innerHTML = `
      <div class="detail-thumb active" onclick="selectThumb(this,'${currentProduct.emoji}')">${currentProduct.emoji}</div>
      <div class="detail-thumb" onclick="selectThumb(this,'👕')">👕</div>
      <div class="detail-thumb" onclick="selectThumb(this,'🏒')">🏒</div>
      <div class="detail-thumb" onclick="selectThumb(this,'📦')">📦</div>
    `;
  }
  showScreen('detail');
}

function changeQty(d) {
  detailQty = Math.max(1, detailQty + d);
  document.getElementById('detail-qty').textContent = detailQty;
}

function selectThumb(el, emoji) {
  document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const mainEl = document.getElementById('detail-main-img');
  mainEl.innerHTML = '';
  mainEl.textContent = emoji;
}

function selectThumbImg(el, src) {
  document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('detail-main-img').innerHTML = `<img src="${src}" alt="Product image" />`;
}

function selectOpt(btn, groupId) {
  document.querySelectorAll(`#${groupId} .option-btn`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function addToCartFromDetail() {
  for (let i = 0; i < detailQty; i++) addToCart(currentProduct);
  showToast(`✓ ${detailQty}× ${currentProduct.name} added to cart`);
}

// ── CART ──────────────────────────────────────────
function quickAddToCart(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (p) { addToCart(p); showToast(`✓ ${p.name} added to cart`); }
}

function addToCart(product) {
  const existing = cart.find(i => i.productId === product.id);
  if (existing) { existing.qty++; }
  else { cart.push({ id: ++cartIdCounter, productId: product.id, name: product.name, price: product.price, emoji: product.emoji, qty: 1 }); }
  updateCartCount();
}

function updateCartCount() {
  const total = cart.reduce((s,i) => s+i.qty, 0);
  document.getElementById('cart-count').textContent = total;
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateCartCount();
  renderCart();
}

function changeCartQty(id, d) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + d);
  renderCart();
}

function getSubtotal() { return cart.reduce((s,i) => s + i.price * i.qty, 0); }
function getTotal(sub) { return sub + 5.99 - (promoApplied ? sub * 0.2 : 0); }

function renderCart() {
  const list = document.getElementById('cart-items-list');
  const sub = getSubtotal();
  const total = getTotal(sub);

  document.getElementById('cart-subtitle').textContent = cart.reduce((s,i)=>s+i.qty,0) + ' items';

  if (cart.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-title">Your cart is empty</div><p style="font-size:14px;color:var(--gray4);margin-top:8px;">Browse our collection and find something you love.</p><button class="btn btn-primary" style="margin-top:20px;" onclick="showScreen('listing')">Shop Now</button></div>`;
  } else {
    list.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-img">${item.emoji}</div>
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-meta">Size: M · Colour: Navy</div>
          <div class="cart-item-qty">
            <button class="qty-btn" style="width:30px;height:30px;font-size:16px;" onclick="changeCartQty(${item.id},-1)">−</button>
            <span style="font-size:15px;font-weight:600;min-width:20px;text-align:center;">${item.qty}</span>
            <button class="qty-btn" style="width:30px;height:30px;font-size:16px;" onclick="changeCartQty(${item.id},1)">+</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <div class="cart-item-price">$${(item.price*item.qty).toFixed(2)}</div>
          <button class="cart-remove" onclick="removeFromCart(${item.id})">✕</button>
        </div>
      </div>`).join('');
  }

  document.getElementById('cart-subtotal').textContent = '$' + sub.toFixed(2);
  document.getElementById('cart-total').textContent = '$' + total.toFixed(2);
  const dr = document.getElementById('discount-row');
  if (promoApplied) {
    dr.style.display = 'flex';
    document.getElementById('discount-val').textContent = '-$' + (sub*0.2).toFixed(2);
  } else { dr.style.display = 'none'; }
}

function applyPromo() {
  const val = document.getElementById('promo-input').value.trim().toUpperCase();
  if (val === 'LANCER20') {
    promoApplied = true;
    renderCart();
    showToast('🎉 Promo code applied! 20% off', 'gold');
  } else {
    showToast('❌ Invalid promo code');
  }
}

function renderCheckout() {
  const sub = getSubtotal();
  const total = getTotal(sub);
  document.getElementById('co-subtotal').textContent = '$' + sub.toFixed(2);
  document.getElementById('co-total').textContent = '$' + total.toFixed(2);
  document.getElementById('checkout-total').textContent = '$' + total.toFixed(2);
  const list = document.getElementById('checkout-items-list');
  list.innerHTML = cart.map(i => `
    <div class="summary-row">
      <span>${i.emoji} ${i.name} ×${i.qty}</span>
      <span>$${(i.price*i.qty).toFixed(2)}</span>
    </div>`).join('');
}

// ── ORDER FLOW ────────────────────────────────────
function placeOrder() {
  const orderId = '#WL-2024-' + (Math.floor(Math.random()*9000)+1000);
  document.getElementById('confirm-order-id').textContent = orderId;
  showScreen('confirm');
  showToast('🎉 Order placed successfully!', 'gold');
}

function renderTracking() {
  const list = document.getElementById('tracking-items');
  const total = document.getElementById('tracking-total');
  const items = cart.length > 0 ? cart : [
    { emoji:'🧥', name:'Lancer Premium Hoodie', qty:1, price:45 },
    { emoji:'🧢', name:'Lancer Snapback Cap', qty:1, price:20 },
  ];
  list.innerHTML = items.map(i => `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:44px;height:44px;background:var(--gray1);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;">${i.emoji}</div>
      <div style="flex:1;font-size:13px;"><div style="font-weight:600;">${i.name}</div><div style="color:var(--gray4);">Qty: ${i.qty}</div></div>
      <div style="font-weight:700;font-size:14px;">$${(i.price*i.qty).toFixed(2)}</div>
    </div>`).join('');
  const t = items.reduce((s,i)=>s+i.price*i.qty,0)+5.99;
  total.textContent = '$'+t.toFixed(2);
}

// ── ADMIN ─────────────────────────────────────────
// ── Cross-device product storage using JSONbin.io (free) ─────────────────
// 1. Sign up free at jsonbin.io
// 2. Create a new bin with [] as content, copy the bin ID
// 3. Go to API Keys, create a key, copy it
// 4. Replace the values below
const JSONBIN_BIN_ID  = 'YOUR_BIN_ID';   // e.g. '6659a1f1acd3cb34a843c1e2'
const JSONBIN_API_KEY = 'YOUR_API_KEY';  // e.g. '$2a$10$...'

let adminProducts = [...PRODUCTS.map(p => ({...p, stock: Math.floor(Math.random()*50)+5}))];
let _jsonbinReady  = JSONBIN_BIN_ID !== 'YOUR_BIN_ID' && JSONBIN_API_KEY !== 'YOUR_API_KEY';

async function saveAdminProductsToStorage() {
  // Always save locally for instant feedback
  try { localStorage.setItem('lancerAdminProducts', JSON.stringify(adminProducts)); } catch(e) {}

  // Also save to cloud if configured
  if (!_jsonbinReady) return;
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
      body: JSON.stringify(adminProducts.map(p => ({
        // Strip base64 images from cloud save (Cloudinary URLs are already compact)
        ...p,
        images: (p.images || []).filter(img => img && !img.startsWith('data:'))
      })))
    });
  } catch(e) { console.warn('Cloud save failed:', e); }
}

async function loadAdminProductsFromStorage() {
  // Try cloud first if configured
  if (_jsonbinReady) {
    try {
      const res  = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_API_KEY }
      });
      const data = await res.json();
      if (Array.isArray(data.record) && data.record.length > 0) {
        adminProducts = data.record;
      }
    } catch(e) { console.warn('Cloud load failed, using local:', e); }
  } else {
    // Fall back to localStorage
    try {
      const raw = localStorage.getItem('lancerAdminProducts');
      if (raw) { adminProducts = JSON.parse(raw); }
    } catch(e) {}
  }
  // Always render after data is ready
  renderHomePage();
  renderListingPage();
}

// Load on startup — renders fire inside after data is ready
loadAdminProductsFromStorage();

function renderAdmin() {
  const tbody = document.getElementById('admin-tbody');
  tbody.innerHTML = adminProducts.map(p => {
    const statusClass = p.stock < 10 ? 'status-badge' : 'status-badge status-delivered';
    const statusText = p.stock < 10 ? 'Low Stock' : 'Active';
    const stockClass = p.stock < 10 ? 'stock-low' : 'stock-ok';
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px;">
        <div style="width:40px;height:40px;background:var(--gray1);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;">${p.emoji}</div>
        <div><div style="font-weight:600;">${p.name}</div><div style="font-size:12px;color:var(--gray4);">SKU: L${p.id.toString().padStart(3,'0')}</div></div>
      </div></td>
      <td>${p.cat.charAt(0).toUpperCase()+p.cat.slice(1)}</td>
      <td><strong>$${p.price}.00</strong></td>
      <td class="${stockClass}">${p.stock}</td>
      <td><span class="${statusClass}" style="font-size:11px;padding:4px 10px;">${statusText}</span></td>
      <td><div class="action-btns">
        <button class="action-btn action-edit" onclick="showToast('✏️ Edit mode for: ${p.name}')">Edit</button>
        <button class="action-btn action-del" onclick="deleteProduct(${p.id})">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
}

function deleteProduct(id) {
  adminProducts = adminProducts.filter(p => p.id !== id);
  renderAdmin();
  showToast('🗑 Product removed');
}

function showAddProduct() {
  const form = document.getElementById('add-product-form');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  if (form.style.display === 'block') form.scrollIntoView({behavior:'smooth', block:'start'});
}

function saveProduct() {
  const name = document.getElementById('new-prod-name').value;
  const price = parseFloat(document.getElementById('new-prod-price').value) || 0;
  const stock = parseInt(document.getElementById('new-prod-stock').value) || 0;
  const cat = document.getElementById('new-prod-cat').value;
  const emoji = document.getElementById('new-prod-emoji').value || '📦';
  if (!name) { showToast('❌ Please enter a product name'); return; }
  const newId = Math.max(...adminProducts.map(p=>p.id)) + 1;
  adminProducts.push({ id: newId, name, price, stock, cat: cat.toLowerCase(), emoji, badge:'New', stars:'★★★★☆', rating:'4.0', desc:'New product' });
  PRODUCTS.push({ id: newId, name, price, stock, cat: cat.toLowerCase(), emoji, badge:'New', stars:'★★★★☆', rating:'4.0', desc:'New product' });
  renderAdmin();
  document.getElementById('add-product-form').style.display = 'none';
  ['new-prod-name','new-prod-price','new-prod-stock','new-prod-sku','new-prod-emoji'].forEach(id => document.getElementById(id).value='');
  showToast('✓ Product added successfully', 'gold');
}

// ── AUTH ──────────────────────────────────────────
function switchAuthTab(tab) {
  const fl = document.getElementById('form-login');
  const fr = document.getElementById('form-register');
  if (fl) fl.style.display    = tab === 'login'    ? 'block' : 'none';
  if (fr) fr.style.display    = tab === 'register' ? 'block' : 'none';
  const tl = document.getElementById('tab-login');
  const tr = document.getElementById('tab-register');
  if (tl) tl.classList.toggle('active', tab === 'login');
  if (tr) tr.classList.toggle('active', tab === 'register');
}


// ── USER AUTH — powered by Firebase (see <script type="module"> in <head>) ──
let currentUser = null;

// Called by old onclick="doLogin()" — delegates to Firebase module
function doLogin() { window._firebaseAuth?.signInEmail(); }

// Called by old onclick="doLogout()" — delegates to Firebase module
function doLogout() { window._firebaseAuth?.signOut(); }

function updateNavForUser() {
  const loginBtn  = document.getElementById('nav-login-btn');
  const logoutBtn = document.getElementById('nav-logout-btn');
  const adminBtn  = document.getElementById('nav-admin-btn');
  if (!loginBtn) return;
  if (currentUser) {
    loginBtn.style.display  = 'none';
    logoutBtn.style.display = 'inline-flex';
    if (adminBtn) adminBtn.style.display = currentUser.role === 'admin' ? 'inline-flex' : 'none';
  } else {
    loginBtn.style.display  = 'inline-flex';
    logoutBtn.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
  }
}

function doRegister() { showScreen('home'); showToast('🎉 Account created! Welcome to Lancer Store', 'gold'); }

// ── MISC ──────────────────────────────────────────
function selectPayMethod(el) {
  document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('active'));
  el.classList.add('active');
}

function setCategory(el) {
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── INIT ──────────────────────────────────────────

// ── AD CAROUSEL ──────────────────────────────────
(function() {
  var total = 4, cur = 0, timer = null, paused = false;
  var track = document.getElementById('adTrack');
  var dotsWrap = document.getElementById('adDots');
  var pausePill = document.getElementById('adPausePill');

  // build dots
  for (var i = 0; i < total; i++) {
    var d = document.createElement('button');
    d.className = 'ad-dot' + (i === 0 ? ' active' : '');
    d.setAttribute('aria-label', 'Slide ' + (i+1));
    (function(idx){ d.onclick = function(){ adGoTo(idx); }; })(i);
    dotsWrap.appendChild(d);
  }

  function updateDots() {
    var dots = dotsWrap.querySelectorAll('.ad-dot');
    dots.forEach(function(d,i){ d.classList.toggle('active', i === cur); });
  }

  window.adGoTo = function(idx) {
    cur = (idx + total) % total;
    track.style.transform = 'translateX(-' + (cur * 100) + '%)';
    updateDots();
  };

  window.adMove = function(dir) {
    adGoTo(cur + dir);
    if (!paused) { clearInterval(timer); startTimer(); }
  };

  function startTimer() {
    timer = setInterval(function(){ adGoTo(cur + 1); }, 4000);
  }

  window.adPause = function() {
    paused = true;
    clearInterval(timer);
    pausePill.classList.add('visible');
  };

  window.adResume = function() {
    paused = false;
    pausePill.classList.remove('visible');
    startTimer();
  };

  startTimer();
})();

// ─────────────────────────────────────────────────────────────
// ADMIN FULL DASHBOARD DATA & LOGIC
// ─────────────────────────────────────────────────────────────

// ── Shared product store (same as adminProducts above but we alias) ──
let adminAdList = [
  { id:1, title:'Winter Sale — 20% Off All Hoodies', sub:'This week only · while stocks last', code:'LANCER20', btn:'Shop the Sale', bg:'navy', active:true },
  { id:2, title:'Tournament Sale 50% Off!', sub:'Student Discount: Extra 20% Off', code:'TOURNAMENT50', btn:'Shop Now', bg:'gold', active:true },
  { id:3, title:'New Arrivals — Spring Collection', sub:'Fresh gear for the new semester', code:'SPRING10', btn:'Explore Now', bg:'green', active:false },
];
let adminAdNextId = 4;

// adminOrderList — populated from Firestore on admin login
let adminOrderList = [];

async function renderAdminFull() {
  const badge = document.getElementById('admin-user-badge');
  const cu = window.currentUser || currentUser; if (badge && cu) badge.textContent = (cu.name || cu.email || 'Admin') + ' · ADMIN';

  // Show loading spinner
  const kpiRow = document.getElementById('admin-kpi-row');
  if (kpiRow) kpiRow.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray4);">⏳ Loading from Firestore...</div>';

  // Always attempt Firestore load
  if (window._firestoreOps) {
    await window.loadAdminDataFromFirestore?.();
  } else {
    // Firestore not ready yet — wait up to 3s then try again
    let tries = 0;
    while (!window._firestoreOps && tries < 6) {
      await new Promise(r => setTimeout(r, 500));
      tries++;
    }
    if (window._firestoreOps) await window.loadAdminDataFromFirestore?.();
  }

  switchAdminTab('dashboard');
}

function switchAdminTab(tab) {
  ['dashboard','products','orders','ads','reports'].forEach(t => {
    const btn   = document.getElementById('atab-' + t);
    const panel = document.getElementById('apanel-' + t);
    if (btn)   btn.classList.toggle('active', t === tab);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'dashboard') renderAdminDashboard();
  if (tab === 'products')  renderAdminProducts();
  if (tab === 'orders')    renderAdminOrders();
  if (tab === 'ads')       renderAdminAds();
  if (tab === 'reports')    renderReportsPreview();
}

// ── DASHBOARD ──────────────────────────────────────────────────
function renderAdminDashboard() {
  const totalOrders   = adminOrderList.length;
  const revenue       = adminOrderList.filter(o => o.status !== 'Cancelled')
                          .reduce((s, o) => s + parseFloat(o.total.replace('$','')), 0).toFixed(2);
  const lowStock      = adminProducts.filter(p => p.stock < 10).length;
  const totalProducts = adminProducts.length;

  document.getElementById('admin-kpi-row').innerHTML = `
    <div class="kpi-card"><div class="kpi-val">${totalOrders}</div><div class="kpi-lbl">Total Orders</div><div class="kpi-delta">↑ 12% this month</div></div>
    <div class="kpi-card"><div class="kpi-val">$${revenue}</div><div class="kpi-lbl">Revenue (Month)</div><div class="kpi-delta">↑ 8% vs last month</div></div>
    <div class="kpi-card"><div class="kpi-val">${lowStock}</div><div class="kpi-lbl">Low Stock Alerts</div><div class="kpi-delta" style="color:#e0a800;">⚠ Reorder needed</div></div>
    <div class="kpi-card"><div class="kpi-val">${totalProducts}</div><div class="kpi-lbl">Products Listed</div><div class="kpi-delta">↑ 3 added this week</div></div>
  `;

  // Recent orders
  const recent = adminOrderList.slice(0, 5);
  document.getElementById('admin-recent-orders').innerHTML =
    '<tr style="background:#f5f7fa;"><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#888;">Order</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#888;">Customer</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#888;">Total</th><th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#888;">Status</th></tr>' +
    recent.map(o => `<tr style="border-top:1px solid #f0f0f0;">
      <td style="padding:10px;">${o.id}</td>
      <td style="padding:10px;">${o.customer}</td>
      <td style="padding:10px;font-weight:700;">${o.total}</td>
      <td style="padding:10px;">${statusPill(o.status)}</td>
    </tr>`).join('');

  // Low stock
  const low = adminProducts.filter(p => p.stock < 10);
  document.getElementById('admin-low-stock').innerHTML = low.length === 0
    ? '<div style="color:#27ae60;font-size:14px;padding:20px 0;">✅ All products have healthy stock levels.</div>'
    : low.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;">
        <div>${p.emoji} ${p.name}</div>
        <div style="font-weight:700;color:${p.stock === 0 ? '#c0392b' : '#e0a800'};">${p.stock === 0 ? 'OUT OF STOCK' : p.stock + ' left'}</div>
      </div>`).join('');
}

// ── PRODUCTS ────────────────────────────────────────────────────
function renderAdminProducts() {
  const tbody = document.getElementById('admin-full-prod-tbody');
  if (!tbody) return;
  tbody.innerHTML = adminProducts.map(p => `
    <tr style="border-top:1px solid #f0f2f5;">
      <td style="padding:14px 16px;">${p.emoji} ${p.name}</td>
      <td style="padding:14px 16px;text-transform:capitalize;">${p.cat}</td>
      <td style="padding:14px 16px;font-weight:700;">$${p.price}</td>
      <td style="padding:14px 16px;">${p.stock}</td>
      <td style="padding:14px 16px;">${p.stock === 0 ? '<span class="status-pill sp-cancelled">Out of Stock</span>' : p.stock < 10 ? '<span class="status-pill sp-processing">Low Stock</span>' : '<span class="status-pill sp-delivered">In Stock</span>'}</td>
      <td style="padding:14px 16px;">
        <button class="btn btn-sm btn-outline" onclick="editAdminProduct(${p.id})" style="margin-right:6px;">✏ Edit</button>
        <button class="btn btn-sm" style="background:#ffeaea;color:#c0392b;" onclick="deleteAdminProduct(${p.id})">🗑</button>
      </td>
    </tr>
  `).join('');
}

// ── Image state for the product form ──────────────────────────
let apfImages = [null, null, null, null, null]; // up to 5 slots

function renderImgSlots() {
  const container = document.getElementById('apf-img-slots');
  if (!container) return;
  container.innerHTML = '';
  apfImages.forEach((img, i) => {
    const slot = document.createElement('div');
    slot.className = 'img-slot';
    if (img) {
      slot.innerHTML = `
        <img src="${img}" alt="Product image ${i+1}" />
        <button class="slot-remove" onclick="removeAdminImg(${i})" title="Remove">✕</button>
        ${i === 0 ? '<div class="slot-primary-badge">PRIMARY</div>' : ''}
      `;
    } else {
      slot.innerHTML = `
        <div class="slot-add-icon">+</div>
        <div class="slot-add-text">Add photo</div>
      `;
      slot.onclick = () => { window._imgSlotTarget = i; document.getElementById('apf-img-input').click(); };
    }
    container.appendChild(slot);
  });
  // Add-more button if <5 images and at least one slot filled
  const filled = apfImages.filter(Boolean).length;
  if (filled === 5) return;
}

// ── Cloudinary config — update with your own cloud name & upload preset ──
// 1. Sign up free at cloudinary.com
// 2. Go to Settings → Upload → Add upload preset → set to "Unsigned"
// 3. Replace the values below with yours
const CLOUDINARY_CLOUD_NAME   = 'YOUR_CLOUD_NAME';    // e.g. 'lancer-store'
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET'; // e.g. 'lancer_products'

async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  fd.append('folder', 'lancer-store-products');
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST', body: fd
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
  return data.secure_url; // permanent https:// URL, works on all devices
}

async function handleAdminImgUpload(input) {
  const files = Array.from(input.files).slice(0, 5);
  if (!files.length) return;

  // Show status
  const status = document.getElementById('apf-upload-status');
  if (status) status.style.display = 'block';

  // Check if Cloudinary is configured
  const cloudinaryReady = CLOUDINARY_CLOUD_NAME !== 'YOUR_CLOUD_NAME' && CLOUDINARY_UPLOAD_PRESET !== 'YOUR_UPLOAD_PRESET';

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    const targetSlot = typeof window._imgSlotTarget === 'number' ? window._imgSlotTarget : fi;
    window._imgSlotTarget = null;

    if (cloudinaryReady) {
      // Upload to cloud → permanent URL
      try {
        if (status) status.textContent = `⏳ Uploading image ${fi+1} of ${files.length}...`;
        const url = await uploadToCloudinary(file);
        apfImages[targetSlot] = url;
        renderImgSlots();
      } catch(e) {
        showToast('❌ Upload failed: ' + e.message, 'error');
      }
    } else {
      // Cloudinary not configured → fall back to base64 with warning
      await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
          apfImages[targetSlot] = e.target.result;
          renderImgSlots();
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
  }

  if (status) status.style.display = 'none';
  input.value = '';

  if (!cloudinaryReady) {
    showToast('⚠️ Using local storage — images will notsync across devices. Set up Cloudinary to fix this.', 'error');
  }
}

function removeAdminImg(i) {
  apfImages[i] = null;
  // Compact: shift remaining images left
  apfImages = [...apfImages.filter(Boolean), ...Array(5).fill(null)].slice(0, 5);
  renderImgSlots();
}

function showAdminAddProd() {
  document.getElementById('apf-name').value  = '';
  document.getElementById('apf-price').value = '';
  document.getElementById('apf-stock').value = '';
  document.getElementById('apf-sku').value   = '';
  document.getElementById('apf-emoji').value = '';
  document.getElementById('apf-edit-id').value = '';
  apfImages = [null, null, null, null, null];
  renderImgSlots();
  document.getElementById('admin-prod-form-title').textContent = 'Add New Product';
  document.getElementById('admin-prod-form').style.display = 'block';
  document.getElementById('admin-prod-form').scrollIntoView({ behavior:'smooth' });
}

function editAdminProduct(id) {
  const p = adminProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('apf-name').value  = p.name;
  document.getElementById('apf-price').value = p.price;
  document.getElementById('apf-stock').value = p.stock;
  document.getElementById('apf-sku').value   = p.sku || '';
  document.getElementById('apf-emoji').value = p.emoji;
  document.getElementById('apf-edit-id').value = id;
  // Load existing images if any
  apfImages = p.images ? [...p.images, ...Array(5).fill(null)].slice(0,5) : [null,null,null,null,null];
  renderImgSlots();
  document.getElementById('admin-prod-form-title').textContent = 'Edit Product';
  document.getElementById('admin-prod-form').style.display = 'block';
  document.getElementById('admin-prod-form').scrollIntoView({ behavior:'smooth' });
}

function saveAdminProduct() {
  const name  = document.getElementById('apf-name').value.trim();
  const price = parseFloat(document.getElementById('apf-price').value);
  const stock = parseInt(document.getElementById('apf-stock').value);
  const cat   = document.getElementById('apf-cat').value;
  const sku   = document.getElementById('apf-sku').value.trim();
  const emoji = document.getElementById('apf-emoji').value.trim() || '📦';
  const editId = document.getElementById('apf-edit-id').value;
  const images = apfImages.filter(Boolean); // only non-null
  if (!name || isNaN(price) || isNaN(stock)) { showToast('❌ Please fill all required fields', 'error'); return; }
  if (editId) {
    const p = adminProducts.find(x => x.id === parseInt(editId));
    if (p) { p.name = name; p.price = price; p.stock = stock; p.cat = cat.toLowerCase(); p.sku = sku; p.emoji = emoji; p.images = images; }
    showToast('✅ Product updated!', 'gold');
  } else {
    const newId = Math.max(...adminProducts.map(p => p.id)) + 1;
    adminProducts.push({ id:newId, name, price, stock, cat:cat.toLowerCase(), sku, emoji, images, badge:'New', stars:'★★★★☆', rating:'4.0', desc:'New product' });
    showToast('✅ Product added!', 'gold');
  }
  apfImages = [null,null,null,null,null];
  document.getElementById('admin-prod-form').style.display = 'none';
  saveAdminProductsToStorage().then(() => { renderAdminProducts(); renderProducts(); });
  const saved = adminProducts.find(p => p.name === document.getElementById('apf-name')?.value.trim()); if(saved) window.fsSaveProduct?.(saved);
}

function deleteAdminProduct(id) {
  if (!confirm('Delete this product?')) return;
  adminProducts = adminProducts.filter(p => p.id !== id);
  saveAdminProductsToStorage().then(() => { renderAdminProducts(); renderProducts(); });
  const saved = adminProducts.find(p => p.name === document.getElementById('apf-name')?.value.trim()); if(saved) window.fsSaveProduct?.(saved);
  showToast('🗑 Product deleted', 'gold');
}

// ── ORDERS ──────────────────────────────────────────────────────
function renderAdminOrders() {
  const filterStatus = (document.getElementById('order-status-filter')?.value || '').toLowerCase();
  const search       = (document.getElementById('order-search')?.value || '').toLowerCase();
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;
  let list = adminOrderList.filter(o => {
    const matchStatus = !filterStatus || o.status.toLowerCase() === filterStatus;
    const matchSearch = !search || o.id.toLowerCase().includes(search) || o.customer.toLowerCase().includes(search);
    return matchStatus && matchSearch;
  });
  tbody.innerHTML = list.map(o => `
    <tr style="border-top:1px solid #f0f2f5;">
      <td style="padding:14px 16px;font-weight:700;color:var(--navy);">${o.id}</td>
      <td style="padding:14px 16px;"><div>${o.customer}</div><div style="font-size:11px;color:#888;">${o.email}</div></td>
      <td style="padding:14px 16px;">${o.items}</td>
      <td style="padding:14px 16px;font-weight:700;">${o.total}</td>
      <td style="padding:14px 16px;">${o.date}</td>
      <td style="padding:14px 16px;">${statusPill(o.status)}</td>
      <td style="padding:14px 16px;">
        <select style="padding:6px 10px;border:1.5px solid #e0e4ea;border-radius:8px;font-size:12px;font-family:'DM Sans',sans-serif;" onchange="updateOrderStatus('${o.id}', this.value)">
          <option ${o.status==='Processing'?'selected':''}>Processing</option>
          <option ${o.status==='Shipped'   ?'selected':''}>Shipped</option>
          <option ${o.status==='Delivered' ?'selected':''}>Delivered</option>
          <option ${o.status==='Cancelled' ?'selected':''}>Cancelled</option>
        </select>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="padding:30px;text-align:center;color:#888;">No orders match your filter.</td></tr>';
}

function updateOrderStatus(id, status) {
  const o = adminOrderList.find(x => x.id === id);
  if (o) { o.status = status; showToast('✅ Order ' + id + ' → ' + status, 'gold'); renderAdminOrders(); window.fsUpdateOrderStatus?.(id, status); }
}

// ── ADS ─────────────────────────────────────────────────────────
function renderAdminAds() {
  const list = document.getElementById('admin-ads-list');
  if (!list) return;
  var html = '';
  adminAdList.forEach(function(a) {
    var adKey  = String(a.firestoreId || a.id);
    var bgCls  = a.bg === 'gold' ? 'gold-ad' : a.bg === 'red' ? 'red-ad' : a.bg === 'green' ? 'green-ad' : '';
    var liveLbl = a.active
      ? '<span style="background:#d4edda;color:#155724;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">LIVE</span>'
      : '<span style="background:#f8d7da;color:#721c24;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">DRAFT</span>';
    var sub   = a.sub || a.subtitle || '';
    var code  = a.code || a.promoCode || '';
    var btn   = a.btn || a.ctaButton || 'Shop Now';
    var pauseLabel = a.active ? '⏸ Pause' : '▶ Activate';
    html += '<div class="ad-card ' + bgCls + '">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">';
    html += '<div style="font-weight:700;font-size:15px;">' + a.title + '</div>';
    html += liveLbl + '</div>';
    html += '<div style="font-size:13px;color:#666;margin-bottom:8px;">' + sub + '</div>';
    html += '<div style="font-size:12px;margin-bottom:12px;"><strong>Code:</strong> ' + code + ' &nbsp;|&nbsp; <strong>CTA:</strong> ' + btn + '</div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button class="btn btn-sm btn-outline" onclick="adToggle(\''+adKey+'\')">' + pauseLabel + '</button>';
    html += '<button class="btn btn-sm" style="background:#ffeaea;color:#c0392b;" onclick="adDelete(\''+adKey+'\')">🗑 Delete</button>';
    html += '</div></div>';
  });
  list.innerHTML = html;
}
window.renderAdminAds       = typeof renderAdminAds       !== 'undefined' ? renderAdminAds       : function(){};
window.renderHomePage       = typeof renderHomePage       !== 'undefined' ? renderHomePage       : function(){};
window.renderListingPage    = typeof renderListingPage    !== 'undefined' ? renderListingPage    : function(){};
window.renderProducts       = typeof renderProducts       !== 'undefined' ? renderProducts       : function(){};
