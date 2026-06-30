// ============================================================
// 对象端 — 浏览点菜 v2 (含详情浮窗、步骤、食材)
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
  const gridEl = document.getElementById('cust-grid');
  const favGridEl = document.getElementById('cust-fav-grid');
  const catBar = document.getElementById('cust-cats');
  const cartBtn = document.getElementById('cust-cart-btn');
  const cartCount = document.getElementById('cust-cart-count');
  const cartDetail = document.getElementById('cust-cart-detail');
  const favTab = document.getElementById('cust-fav-tab');

  await loadDishes();
  await loadFavorites(user.id);
  renderCatTabs();
  renderDishGrid(activeCat);
  renderFavorites();
  updateCartBadge();

  catBar.addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    activeCat = tab.dataset.cat;
    renderCatTabs();
    renderDishGrid(activeCat);
    document.getElementById('cust-fav-section').classList.add('hidden');
    document.getElementById('cust-grid-section').classList.remove('hidden');
  });

  favTab.addEventListener('click', () => {
    renderFavorites();
    document.getElementById('cust-grid-section').classList.add('hidden');
    document.getElementById('cust-fav-section').classList.remove('hidden');
    catBar.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  });

  // 菜品点击 → 看详情 或 直接加入
  gridEl.addEventListener('click', e => {
    const card = e.target.closest('.dish-card');
    if (!card) return;
    const id = card.dataset.id;
    const dish = store.dishes.find(d => d.id === id);
    if (!dish) return;
    showDishDetail(dish);
  });

  favGridEl.addEventListener('click', e => {
    const card = e.target.closest('.dish-card');
    if (!card) return;
    const id = card.dataset.id;
    const dish = store.dishes.find(d => d.id === id);
    if (!dish) return;
    showDishDetail(dish);
  });

  cartBtn.addEventListener('click', () => showCartModal());
  document.getElementById('cust-submit').addEventListener('click', submitOrder);
}

function renderCatTabs() {
  const catBar = document.getElementById('cust-cats');
  catBar.innerHTML = CONFIG.CATEGORIES.map(c =>
    `<button class="cat-tab ${c === activeCat ? 'active' : ''}" data-cat="${c}">${c.split(' ')[0]}</button>`
  ).join('');
}

function renderDishGrid(cat) {
  const gridEl = document.getElementById('cust-grid');
  const dishes = store.dishes.filter(d => d.category === cat);
  if (!dishes.length) {
    gridEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div>这个分类还没有菜品</div></div>`;
    return;
  }
  gridEl.innerHTML = dishes.map(d => renderDishCard(d)).join('');
}

function renderFavorites() {
  const gridEl = document.getElementById('cust-fav-grid');
  const favs = store.dishes.filter(d => store.favorites.has(d.id));
  if (!favs.length) {
    gridEl.innerHTML = `<div class="empty-state"><div class="empty-icon">❤️</div><div>还没有收藏<br><span style="font-size:12px;">点过的菜会自动收藏</span></div></div>`;
    return;
  }
  gridEl.innerHTML = favs.map(d => renderDishCard(d)).join('');
}

function renderDishCard(d) {
  const inCart = cart.some(c => c.dish_id === d.id);
  const emoji = DISH_EMOJI[d.name] || '🍽️';
  const hasImg = d.image_url && d.image_url.length > 10;
  const imgHtml = hasImg
    ? `<div class="dc-img" style="background-image:url(${d.image_url});background-size:cover;"></div>`
    : `<div class="dc-img dc-img-empty"><span class="dc-emoji">${emoji}</span></div>`;

  return `
    <div class="dish-card ${inCart ? 'in-cart' : ''}" data-id="${d.id}">
      ${imgHtml}
      <div class="dc-body">
        <div class="dc-name">${d.name}</div>
        <div class="dc-footer">
          <span class="dc-time">⏱ ${d.cooking_time || 15}min</span>
        </div>
      </div>
      ${inCart ? '<div class="dc-badge">✓</div>' : ''}
    </div>`;
}

// 菜品详情浮窗
function showDishDetail(dish) {
  const steps = dish.steps ? dish.steps.split('\n').filter(s => s.trim()) : [];
  const ingr = dish.ingredients ? dish.ingredients.split(',').map(s => s.trim()).filter(Boolean) : [];
  const emoji = DISH_EMOJI[dish.name] || '🍽️';
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

  const actionText = inCart ? '从购物车移除' : '➕ 我要点这个';
  const actionCls = inCart ? 'btn-danger' : 'btn-primary';

  modal(dish.name, html, [
    { text: '关闭', value: 'close' },
    { text: actionText, value: 'toggle', cls: actionCls }
  ]).then(action => {
    if (action === 'toggle') toggleCartItem(dish);
  });
}

function toggleCartItem(dish) {
  const idx = cart.findIndex(c => c.dish_id === dish.id);
  if (idx >= 0) {
    cart.splice(idx, 1);
    toast(`已移除「${dish.name}」`);
  } else {
    cart.push({ dish_id: dish.id, dish, note: '' });
    toast(`已加入「${dish.name}」 ✅`);
  }
  updateCartBadge();
  // 刷新当前视图
  if (!document.getElementById('cust-fav-section').classList.contains('hidden')) {
    renderFavorites();
  } else {
    renderDishGrid(activeCat);
  }
}

function updateCartBadge() {
  const count = document.getElementById('cust-cart-count');
  const detail = document.getElementById('cust-cart-detail');
  count.textContent = cart.length;
  count.style.display = cart.length > 0 ? 'inline-flex' : 'none';
  detail.textContent = cart.length > 0 ? `已选 ${cart.length} 道菜` : '点击菜品加入';
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
    <div class="cart-summary">共 ${cart.length} 道菜 · 预计 ${totalTime} 分钟</div>
  `, [
    { text: '继续加菜', value: 'cancel' },
    { text: '确认下单 🍳', value: 'confirm', cls: 'btn-primary' }
  ]);

  // 收集备注
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
  const favIds = orders.map(o => o.dish_id).filter(id => !store.favorites.has(id));
  if (favIds.length) {
    const { error: favErr } = await sb.from('favorites').upsert(
      favIds.map(dish_id => ({ user_id: user.id, dish_id })),
      { onConflict: 'user_id,dish_id', ignoreDuplicates: true }
    );
    if (!favErr) favIds.forEach(id => store.favorites.add(id));
  }

  cart = [];
  updateCartBadge();
  document.querySelector('.modal-overlay')?.remove();
  toast('下单成功！厨师马上开始做 🍳', 'success');
  emit('order-placed');
}
