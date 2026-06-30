// ============================================================
// 对象端 v3 — 美团风格：单列大卡片 + 分类图标 + 火锅专区
// ============================================================
import { CONFIG } from '../config.js';
import { getSupabase, getUser } from './supabase.js';
import { store, loadDishes, loadFavorites, emit } from './store.js';
import { toast, modal } from './ui.js';
import { DISH_EMOJI, catGradient } from './shared.js';

let cart = [];
let activeCat = CONFIG.CATEGORIES[0];

export async function initCustomerPage() {
  const user = getUser();
  const catBar = document.getElementById('cust-cats');
  const listEl = document.getElementById('cust-grid');
  const favListEl = document.getElementById('cust-fav-grid');
  const cartBtn = document.getElementById('cust-cart-btn');
  const cartCount = document.getElementById('cust-cart-count');
  const cartDetail = document.getElementById('cust-cart-detail');
  const favTab = document.getElementById('cust-fav-tab');

  await loadDishes();
  await loadFavorites(user.id);

  renderCatTabs();
  renderDishList(activeCat, listEl);
  renderFavorites();
  updateCartBadge();

  // 分类切换
  catBar.addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    activeCat = tab.dataset.cat;
    renderCatTabs();
    renderDishList(activeCat, listEl);
    document.getElementById('cust-fav-section').classList.add('hidden');
    document.getElementById('cust-grid-section').classList.remove('hidden');
    document.getElementById('cust-grid').scrollIntoView({ behavior:'smooth', block:'start' });
  });

  // 收藏 tab
  favTab.addEventListener('click', () => {
    renderFavorites();
    document.getElementById('cust-grid-section').classList.add('hidden');
    document.getElementById('cust-fav-section').classList.remove('hidden');
    catBar.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  });

  // 列表点击 → 详情
  listEl.addEventListener('click', e => {
    const addBtn = e.target.closest('.dish-card-add');
    const card = e.target.closest('.dish-card');
    if (!card) return;
    const id = card.dataset.id;
    const dish = store.dishes.find(d => d.id === id);
    if (!dish) return;
    if (addBtn) { toggleCartItem(dish, listEl); return; }
    showDishDetail(dish, listEl);
  });

  favListEl.addEventListener('click', e => {
    const addBtn = e.target.closest('.dish-card-add');
    const card = e.target.closest('.dish-card');
    if (!card) return;
    const id = card.dataset.id;
    const dish = store.dishes.find(d => d.id === id);
    if (!dish) return;
    if (addBtn) { toggleCartItem(dish, favListEl); return; }
    showDishDetail(dish, favListEl);
  });

  cartBtn.addEventListener('click', () => showCartModal());
  document.getElementById('cust-submit').addEventListener('click', submitOrder);
}

// ==================== 分类 Tab ====================
function renderCatTabs() {
  const catBar = document.getElementById('cust-cats');
  catBar.innerHTML = CONFIG.CATEGORIES.map(c => {
    const icon = CONFIG.CATEGORY_ICONS[c] || '🍽️';
    const isHotpot = c === CONFIG.HOTPOT_CATEGORY;
    return `<button class="cat-tab ${c === activeCat ? 'active' : ''} ${isHotpot ? 'hotpot' : ''}" data-cat="${c}">
      <span class="cat-emoji">${icon}</span>
      <span>${c}</span>
    </button>`;
  }).join('');
}

// ==================== 美团风格单列大卡片 ====================
function renderDishList(cat, targetEl) {
  const dishes = store.dishes.filter(d => d.category === cat);
  const isHotpot = cat === CONFIG.HOTPOT_CATEGORY;

  if (!dishes.length) {
    targetEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div>这个分类还没有菜品<br><span style="font-size:12px;">喊厨师添加吧</span></div></div>`;
    return;
  }

  const banner = isHotpot ? `
    <div class="hotpot-banner">
      <span class="hb-icon">🔥</span>
      <span>火锅食材自由搭配 —— 想吃什么点什么，一样一份刚刚好</span>
    </div>` : '';

  targetEl.innerHTML = banner + `<div class="dish-list">${dishes.map(d => renderDishCard(d)).join('')}</div>`;
}

function renderDishCard(d) {
  const inCart = cart.some(c => c.dish_id === d.id);
  const emoji = DISH_EMOJI[d.name] || CONFIG.CATEGORY_ICONS[d.category] || '🍽️';
  const hasImg = d.image_url && d.image_url.length > 10;
  const gradient = catGradient(d.category);
  const steps = d.steps ? d.steps.split('\n').filter(s => s.trim()) : [];
  const ingr = d.ingredients ? d.ingredients.split(',').map(s => s.trim()).filter(Boolean) : [];

  const imgHtml = hasImg
    ? `<img src="${d.image_url}" alt="${d.name}"/>`
    : `<span style="font-size:40px;">${emoji}</span>`;

  return `
    <div class="dish-card ${inCart ? 'in-cart' : ''}" data-id="${d.id}">
      <div class="dish-card-img" style="background:${gradient};">${imgHtml}</div>
      <div class="dish-card-body">
        <div class="dish-card-title">${d.name}</div>
        ${ingr.length ? `<div class="dish-card-desc">${ingr.slice(0, 3).join(' · ')}${ingr.length > 3 ? '...' : ''}</div>` : ''}
        <div class="dish-card-tags">
          ${steps.length ? `<span class="dish-card-tag steps">📝 ${steps.length}步</span>` : ''}
          ${ingr.length ? `<span class="dish-card-tag">🛒 ${ingr.length}种</span>` : ''}
        </div>
        <div class="dish-card-bottom">
          <span class="dish-card-time">⏱ ${d.cooking_time || 15}分钟</span>
          <button class="dish-card-add ${inCart ? 'in-cart' : ''}">${inCart ? '✓' : '+'}</button>
        </div>
      </div>
      ${inCart ? '<div class="dish-card-badge">已选</div>' : ''}
    </div>`;
}

function renderFavorites() {
  const el = document.getElementById('cust-fav-grid');
  const favs = store.dishes.filter(d => store.favorites.has(d.id));
  if (!favs.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">❤️</div><div>还没有收藏<br><span style="font-size:12px;">点过的菜会自动收藏</span></div></div>`;
    return;
  }
  el.innerHTML = `<div class="dish-list">${favs.map(d => renderDishCard(d)).join('')}</div>`;
}

// ==================== 菜品详情浮窗 ====================
function showDishDetail(dish, listEl) {
  const steps = dish.steps ? dish.steps.split('\n').filter(s => s.trim()) : [];
  const ingr = dish.ingredients ? dish.ingredients.split(',').map(s => s.trim()).filter(Boolean) : [];
  const emoji = DISH_EMOJI[dish.name] || CONFIG.CATEGORY_ICONS[dish.category] || '🍽️';
  const inCart = cart.some(c => c.dish_id === dish.id);
  const hasImg = dish.image_url && dish.image_url.length > 10;

  const imgHtml = hasImg
    ? `<div class="dish-detail-img" style="background-image:url(${dish.image_url});background-size:cover;"></div>`
    : `<div class="dish-detail-img" style="background:${catGradient(dish.category)};">${emoji}</div>`;

  const html = `
    ${imgHtml}
    <div class="dish-detail-name">${dish.name}</div>
    <div class="dish-detail-meta">
      <span class="dish-detail-tag">${dish.category}</span>
      <span class="dish-detail-tag time">⏱ ${dish.cooking_time || 15} 分钟</span>
      ${inCart ? '<span class="dish-detail-tag" style="background:var(--acd);color:var(--ac);">已在购物车 ✓</span>' : ''}
    </div>
    ${ingr.length ? `
    <div class="dish-detail-section">
      <h4>🛒 食材清单</h4>
      <div class="ingredient-chips">${ingr.map(i => `<span class="ingredient-chip">${i}</span>`).join('')}</div>
    </div>` : ''}
    ${steps.length ? `
    <div class="dish-detail-section">
      <h4>📝 做菜步骤</h4>
      <ol class="dish-detail-steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
    </div>` : ''}
  `;

  const btnText = inCart ? '从购物车移除 ✕' : '➕ 我要点这个';
  const btnCls = inCart ? 'btn-outline' : 'btn-primary';

  modal(dish.name, html, [
    { text: '关闭', value: 'close' },
    { text: btnText, value: 'toggle', cls: btnCls }
  ]).then(action => {
    if (action === 'toggle') toggleCartItem(dish, listEl);
  });
}

// ==================== 购物车 ====================
function toggleCartItem(dish, listEl) {
  const idx = cart.findIndex(c => c.dish_id === dish.id);
  if (idx >= 0) {
    cart.splice(idx, 1);
    toast(`已移除「${dish.name}」`);
  } else {
    cart.push({ dish_id: dish.id, dish, note: '' });
    toast(`已加入「${dish.name}」 ✅`, 'success');
  }
  updateCartBadge();
  refreshCurrentView(listEl);
}

function refreshCurrentView(listEl) {
  if (listEl && listEl !== document.getElementById('cust-fav-grid')) {
    renderDishList(activeCat, listEl);
  }
  if (!document.getElementById('cust-fav-section').classList.contains('hidden')) {
    renderFavorites();
  }
}

function updateCartBadge() {
  const count = document.getElementById('cust-cart-count');
  const detail = document.getElementById('cust-cart-detail');
  count.textContent = cart.length;
  count.style.display = cart.length > 0 ? 'inline-flex' : 'none';
  const names = cart.map(c => c.dish.name).join('、');
  detail.textContent = cart.length > 0 ? `已选 ${cart.length} 道：${names}` : '点击菜品加入';
}

async function showCartModal() {
  if (!cart.length) { toast('还没有选菜哦', 'info'); return; }

  const listHtml = cart.map((c, i) => `
    <div class="cart-item">
      <div class="cart-info">
        <div class="cart-name">${c.dish.name} <span class="cart-time">⏱${c.dish.cooking_time || 15}min</span></div>
        <input class="cart-note" data-idx="${i}" type="text" placeholder="备注: 少辣 / 不要香菜..." value="${c.note}"/>
      </div>
      <button class="cart-remove" data-idx="${i}">✕</button>
    </div>
  `).join('');

  const totalTime = cart.reduce((sum, c) => sum + (c.dish.cooking_time || 15), 0);

  const result = await modal('🛒 我的点菜单', `
    <div class="cart-list">${listHtml}</div>
    <div class="cart-summary">共 ${cart.length} 道 · 预计 ${totalTime} 分钟</div>
  `, [
    { text: '继续加菜', value: 'cancel' },
    { text: '确认下单 🍳', value: 'confirm', cls: 'btn-primary' }
  ]);

  // 收集备注和绑定删除
  document.querySelectorAll('.cart-note').forEach(input => {
    const idx = parseInt(input.dataset.idx);
    if (cart[idx]) cart[idx].note = input.value.trim();
  });
  document.querySelectorAll('.cart-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      cart.splice(idx, 1);
      document.querySelector('.modal-overlay')?.remove();
      updateCartBadge();
      if (cart.length) showCartModal();
      else {
        const gridEl = document.getElementById('cust-grid');
        renderDishList(activeCat, gridEl);
      }
    });
  });

  if (result !== 'confirm') return;
  document.getElementById('cust-submit').click();
}

async function submitOrder() {
  if (!cart.length) return;
  const sb = getSupabase();
  const user = getUser();

  const orders = cart.map(c => ({
    dish_id: c.dish_id,
    customer_id: user.id,
    status: 'pending',
    note: c.note || null,
  }));

  const { error } = await sb.from('orders').insert(orders);
  if (error) { toast('下单失败: ' + error.message, 'error'); return; }

  // 自动收藏
  const newFavIds = orders.map(o => o.dish_id).filter(id => !store.favorites.has(id));
  if (newFavIds.length) {
    await sb.from('favorites').upsert(
      newFavIds.map(dish_id => ({ user_id: user.id, dish_id })),
      { onConflict: 'user_id,dish_id', ignoreDuplicates: true }
    );
    newFavIds.forEach(id => store.favorites.add(id));
  }

  cart = [];
  updateCartBadge();
  document.querySelector('.modal-overlay')?.remove();
  toast('下单成功！厨师马上开始做 🍳', 'success');
  emit('order-placed');

  // 刷新
  const gridEl = document.getElementById('cust-grid');
  renderDishList(activeCat, gridEl);
}
