// ============================================================
// 对象端 — 浏览点菜
// ============================================================
import { CONFIG } from '../config.js';
import { getSupabase, getUser } from './supabase.js';
import { store, loadDishes, loadOrders, loadFavorites, subscribeOrders, emit } from './store.js';
import { toast } from './ui.js';

let cart = [];                    // { dish_id, dish, note }
let activeCat = CONFIG.CATEGORIES[0];

export async function initCustomerPage() {
  const user = getUser();
  const gridEl = document.getElementById('cust-grid');
  const favGridEl = document.getElementById('cust-fav-grid');
  const catBar = document.getElementById('cust-cats');
  const cartBtn = document.getElementById('cust-cart-btn');
  const cartCount = document.getElementById('cust-cart-count');
  const favTab = document.getElementById('cust-fav-tab');

  await loadDishes();
  await loadFavorites(user.id);
  renderCatTabs();
  renderDishGrid(activeCat);
  renderFavorites();

  // 分类切换
  catBar.addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    activeCat = tab.dataset.cat;
    renderCatTabs();
    renderDishGrid(activeCat);
    document.getElementById('cust-fav-section').classList.add('hidden');
    document.getElementById('cust-grid-section').classList.remove('hidden');
  });

  // 我的收藏
  favTab.addEventListener('click', () => {
    document.getElementById('cust-grid-section').classList.add('hidden');
    document.getElementById('cust-fav-section').classList.remove('hidden');
    catBar.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  });

  // 菜品点击 → 加入购物车
  gridEl.addEventListener('click', e => {
    const card = e.target.closest('.dish-card');
    if (!card) return;
    const id = card.dataset.id;
    const dish = store.dishes.find(d => d.id === id);
    if (!dish) return;

    const existing = cart.find(c => c.dish_id === id);
    if (existing) {
      cart = cart.filter(c => c.dish_id !== id);
      card.classList.remove('in-cart');
      toast(`已移除「${dish.name}」`);
    } else {
      cart.push({ dish_id: id, dish, note: '' });
      card.classList.add('in-cart');
      toast(`已加入「${dish.name}」`);
    }
    updateCartBadge();
  });

  // 收藏网格点击
  favGridEl.addEventListener('click', async e => {
    const card = e.target.closest('.dish-card');
    if (!card) return;
    const id = card.dataset.id;
    const dish = store.dishes.find(d => d.id === id);
    if (!dish) return;

    const existing = cart.find(c => c.dish_id === id);
    if (existing) {
      cart = cart.filter(c => c.dish_id !== id);
      card.classList.remove('in-cart');
      toast(`已移除「${dish.name}」`);
    } else {
      cart.push({ dish_id: id, dish, note: '' });
      card.classList.add('in-cart');
      toast(`已加入「${dish.name}」`);
    }
    updateCartBadge();
  });

  // 购物车按钮
  cartBtn.addEventListener('click', () => showCartModal());
  document.getElementById('cust-submit').addEventListener('click', submitOrder);

  updateCartBadge();
}

function renderCatTabs() {
  const catBar = document.getElementById('cust-cats');
  catBar.innerHTML = CONFIG.CATEGORIES.map(c =>
    `<button class="cat-tab ${c === activeCat ? 'active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');
}

function renderDishGrid(cat) {
  const gridEl = document.getElementById('cust-grid');
  const dishes = store.dishes.filter(d => d.category === cat);
  if (!dishes.length) {
    gridEl.innerHTML = `<div class="empty-state"><div>暂无菜品</div></div>`;
    return;
  }
  gridEl.innerHTML = dishes.map(d => {
    const inCart = cart.some(c => c.dish_id === d.id);
    const img = d.image_url
      ? `<div class="dc-img" style="background-image:url(${d.image_url})"></div>`
      : `<div class="dc-img dc-img-empty">🍽️</div>`;
    return `
      <div class="dish-card ${inCart ? 'in-cart' : ''}" data-id="${d.id}">
        ${img}
        <div class="dc-body">
          <div class="dc-name">${d.name}</div>
          <div class="dc-meta">${d.ingredients || ''}</div>
          <div class="dc-footer">
            <span class="dc-time">⏱${d.cooking_time || 15}min</span>
            ${inCart ? '<span class="dc-check">✅</span>' : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderFavorites() {
  const gridEl = document.getElementById('cust-fav-grid');
  const favs = store.dishes.filter(d => store.favorites.has(d.id));
  if (!favs.length) {
    gridEl.innerHTML = `<div class="empty-state"><div>还没有收藏，点菜后自动收藏</div></div>`;
    return;
  }
  gridEl.innerHTML = favs.map(d => {
    const inCart = cart.some(c => c.dish_id === d.id);
    const img = d.image_url
      ? `<div class="dc-img" style="background-image:url(${d.image_url})"></div>`
      : `<div class="dc-img dc-img-empty">🍽️</div>`;
    return `
      <div class="dish-card ${inCart ? 'in-cart' : ''}" data-id="${d.id}">
        ${img}
        <div class="dc-body">
          <div class="dc-name">${d.name}</div>
          <div class="dc-footer">
            <span class="dc-time">⏱${d.cooking_time || 15}min</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function updateCartBadge() {
  const count = document.getElementById('cust-cart-count');
  count.textContent = cart.length;
  count.style.display = cart.length > 0 ? 'inline-flex' : 'none';
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

  const actions = [
    { text: '取消', value: 'cancel' },
    { text: '确认下单', value: 'confirm', cls: 'btn-primary' }
  ];

  const result = await modal('确认点菜', `
    <div class="cart-list">${listHtml}</div>
    <div class="cart-summary">共 ${cart.length} 道菜</div>
  `, actions);

  // 收集备注
  document.querySelectorAll('.cart-note').forEach(input => {
    const idx = parseInt(input.dataset.idx);
    if (cart[idx]) cart[idx].note = input.value.trim();
  });

  // 处理移除按钮
  document.querySelectorAll('.cart-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      cart.splice(idx, 1);
      if (cart.length) showCartModal();
      else { document.querySelector('.modal-overlay')?.remove(); updateCartBadge(); }
    });
  });

  if (result !== 'confirm') return;
  // 实际下单在 submitOrder 中
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
  if (error) {
    toast('下单失败: ' + error.message, 'error');
    return;
  }

  // 自动收藏下单的菜
  const favIds = orders.map(o => o.dish_id).filter(id => !store.favorites.has(id));
  if (favIds.length) {
    const favRows = favIds.map(dish_id => ({ user_id: user.id, dish_id }));
    const { error: favErr } = await sb.from('favorites').insert(favRows);
    if (!favErr) favIds.forEach(id => store.favorites.add(id));
  }

  cart = [];
  updateCartBadge();
  document.querySelector('.modal-overlay')?.remove();
  toast('下单成功！厨师马上开始做 🍳');
  emit('order-placed');
}
