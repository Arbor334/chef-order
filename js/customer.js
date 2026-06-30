// ============================================================
// 对象端 v4 — 双栏布局 + Banner + 垂直分类侧栏
// ============================================================
import { CONFIG } from '../config.js';
import { getSupabase, getUser } from './supabase.js';
import { store, loadDishes, loadFavorites, loadBanner, emit } from './store.js';
import { toast, modal } from './ui.js';
import { DISH_EMOJI, catGradient } from './shared.js';

let cart = [];
let activeCat = CONFIG.CATEGORIES[0];
let sidebarEl, gridEl, favGridEl, favSection, gridSection;

export async function initCustomerPage() {
  const user = getUser();
  sidebarEl = document.getElementById('cust-sidebar');
  gridEl = document.getElementById('cust-grid');
  favGridEl = document.getElementById('cust-fav-grid');
  favSection = document.getElementById('cust-fav-section');
  gridSection = document.getElementById('cust-grid-section');

  await loadDishes();
  await loadFavorites(user.id);
  await renderBanner();
  // 动态设置 banner 高度
  const bannerEl = document.getElementById('cust-banner');
  if (bannerEl) {
    const h = bannerEl.offsetHeight;
    document.documentElement.style.setProperty('--banner-h', h + 'px');
  }
  renderSidebar();
  renderDishList(activeCat);

  // 侧栏点击
  sidebarEl.addEventListener('click', e => {
    const item = e.target.closest('.sidebar-cat');
    if (!item) return;
    activeCat = item.dataset.cat;
    renderSidebar();
    renderDishList(activeCat);
    favSection.classList.add('hidden');
    gridSection.classList.remove('hidden');
  });

  // 收藏
  document.getElementById('cust-fav-tab').addEventListener('click', () => {
    renderFavorites();
    favSection.classList.remove('hidden');
    gridSection.classList.add('hidden');
    sidebarEl.querySelectorAll('.sidebar-cat').forEach(c => c.classList.remove('active'));
  });

  // 菜品列表事件
  gridEl.addEventListener('click', handleDishClick);
  favGridEl.addEventListener('click', handleDishClick);

  document.getElementById('cust-cart-btn').addEventListener('click', () => showCartModal());
  document.getElementById('cust-submit').addEventListener('click', submitOrder);
  updateCartBadge();
}

// ==================== Banner ====================
async function renderBanner() {
  try {
    const banner = await loadBanner();
    const msgEl = document.getElementById('cust-banner-msg');
    const bgEl = document.getElementById('cust-banner-bg');
    if (msgEl) msgEl.textContent = banner.message || '今天想吃点什么？';
    if (bgEl && banner.image_url) {
      bgEl.style.backgroundImage = `url(${banner.image_url})`;
      bgEl.classList.add('has-bg');
    }
  } catch (_) {}
}

// ==================== 侧栏 ====================
function renderSidebar() {
  sidebarEl.innerHTML = CONFIG.CATEGORIES.map(c => {
    const icon = CONFIG.CATEGORY_ICONS[c] || '🍽️';
    const count = store.dishes.filter(d => d.category === c).length;
    const isHotpot = c === CONFIG.HOTPOT_CATEGORY;
    return `<div class="sidebar-cat ${c === activeCat ? 'active' : ''} ${isHotpot ? 'hotpot' : ''}" data-cat="${c}">
      <span class="sidebar-cat-icon">${icon}</span>
      <span class="sidebar-cat-name">${c.replace('猪肉','猪').replace('牛肉','牛').replace('羊肉','羊').replace('鸡肉','鸡').replace('素菜','素').replace('海鲜','海鲜').replace('火锅','火锅').replace('汤品','汤').replace('凉菜','凉').replace('主食','主食').replace('小吃','小吃').replace('饮品','饮')}</span>
      ${count > 0 ? `<span class="sidebar-cat-count">${count}</span>` : ''}
    </div>`;
  }).join('');
}

// ==================== 菜品列表 ====================
function renderDishList(cat) {
  const dishes = store.dishes.filter(d => d.category === cat);
  const isHotpot = cat === CONFIG.HOTPOT_CATEGORY;

  if (!dishes.length) {
    gridEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div>暂无菜品</div></div>`;
    return;
  }

  const banner = isHotpot ? `
    <div class="hotpot-banner">
      <span class="hb-icon">🔥</span>
      <span>火锅食材自由搭配</span>
    </div>` : '';

  gridEl.innerHTML = banner + `<div class="dish-list">${dishes.map(d => renderDishCard(d)).join('')}</div>`;
}

function renderFavorites() {
  const favs = store.dishes.filter(d => store.favorites.has(d.id));
  if (!favs.length) {
    favGridEl.innerHTML = `<div class="empty-state"><div class="empty-icon">❤️</div><div>还没有收藏<br><span style="font-size:12px;">点过的菜会自动收藏</span></div></div>`;
    return;
  }
  favGridEl.innerHTML = `<div class="dish-list">${favs.map(d => renderDishCard(d)).join('')}</div>`;
}

function renderDishCard(d) {
  const inCart = cart.some(c => c.dish_id === d.id);
  const emoji = DISH_EMOJI[d.name] || CONFIG.CATEGORY_ICONS[d.category] || '🍽️';
  const hasImg = d.image_url && d.image_url.length > 10;
  const gradient = catGradient(d.category);
  const steps = d.steps ? d.steps.split('\n').filter(s => s.trim()) : [];
  const ingr = d.ingredients ? d.ingredients.split(',').map(s => s.trim()).filter(Boolean) : [];

  return `
    <div class="dish-card ${inCart ? 'in-cart' : ''}" data-id="${d.id}">
      <div class="dish-card-img" style="background:${gradient};">
        ${hasImg ? `<img src="${d.image_url}" alt="${d.name}"/>` : `<span style="font-size:38px;">${emoji}</span>`}
      </div>
      <div class="dish-card-body">
        <div class="dish-card-title">${d.name}</div>
        <div class="dish-card-tags">
          ${steps.length ? `<span class="dish-card-tag steps">📝 ${steps.length}步</span>` : ''}
          ${ingr.length ? `<span class="dish-card-tag">🛒 ${ingr.length}种</span>` : ''}
        </div>
        <div class="dish-card-bottom">
          <span class="dish-card-time">⏱ ${d.cooking_time || 15}min</span>
          <button class="dish-card-add ${inCart ? 'in-cart' : ''}">${inCart ? '✓' : '+'}</button>
        </div>
      </div>
    </div>`;
}

function handleDishClick(e) {
  const addBtn = e.target.closest('.dish-card-add');
  const card = e.target.closest('.dish-card');
  if (!card) return;
  const id = card.dataset.id;
  const dish = store.dishes.find(d => d.id === id);
  if (!dish) return;
  if (addBtn) { toggleCartItem(dish); return; }
  showDishDetail(dish);
}

// ==================== 详情 ====================
function showDishDetail(dish) {
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
    <div class="dish-detail-section"><h4>🛒 食材清单</h4>
    <div class="ingredient-chips">${ingr.map(i => `<span class="ingredient-chip">${i}</span>`).join('')}</div></div>` : ''}
    ${steps.length ? `
    <div class="dish-detail-section"><h4>📝 做菜步骤</h4>
    <ol class="dish-detail-steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol></div>` : ''}
  `;

  const btnText = inCart ? '移除 ✕' : '➕ 我要点这个';
  const btnCls = inCart ? 'btn-outline' : 'btn-primary';
  modal(dish.name, html, [
    { text: '关闭', value: 'close' },
    { text: btnText, value: 'toggle', cls: btnCls }
  ]).then(action => { if (action === 'toggle') toggleCartItem(dish); });
}

// ==================== 购物车 ====================
function toggleCartItem(dish) {
  const idx = cart.findIndex(c => c.dish_id === dish.id);
  if (idx >= 0) { cart.splice(idx, 1); toast(`已移除「${dish.name}」`); }
  else { cart.push({ dish_id: dish.id, dish, note: '' }); toast(`已加入「${dish.name}」 ✅`, 'success'); }
  updateCartBadge();
  refreshView();
}

function refreshView() {
  if (!favSection.classList.contains('hidden')) renderFavorites();
  else renderDishList(activeCat);
}

function updateCartBadge() {
  const count = document.getElementById('cust-cart-count');
  const detail = document.getElementById('cust-cart-detail');
  count.textContent = cart.length;
  count.style.display = cart.length > 0 ? 'inline-flex' : 'none';
  const names = cart.map(c => c.dish.name).join('、');
  detail.textContent = cart.length > 0 ? `已选 ${cart.length} 道: ${names}` : '点击菜品加入';
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

  const totalTime = cart.reduce((s, c) => s + (c.dish.cooking_time || 15), 0);
  const result = await modal('🛒 我的点菜单', `
    <div class="cart-list">${listHtml}</div>
    <div class="cart-summary">共 ${cart.length} 道 · 预计 ${totalTime} 分钟</div>
  `, [
    { text: '继续加菜', value: 'cancel' },
    { text: '确认下单 🍳', value: 'confirm', cls: 'btn-primary' }
  ]);

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
      if (cart.length) showCartModal(); else refreshView();
    });
  });

  if (result !== 'confirm') return;
  document.getElementById('cust-submit').click();
}

async function submitOrder() {
  if (!cart.length) return;
  const sb = getSupabase();
  const user = getUser();
  const orders = cart.map(c => ({ dish_id: c.dish_id, customer_id: user.id, status: 'pending', note: c.note || null }));
  const { error } = await sb.from('orders').insert(orders);
  if (error) { toast('下单失败: ' + error.message, 'error'); return; }

  const newFavIds = orders.map(o => o.dish_id).filter(id => !store.favorites.has(id));
  if (newFavIds.length) {
    await sb.from('favorites').upsert(newFavIds.map(dish_id => ({ user_id: user.id, dish_id })), { onConflict: 'user_id,dish_id', ignoreDuplicates: true });
    newFavIds.forEach(id => store.favorites.add(id));
  }

  cart = [];
  updateCartBadge();
  document.querySelector('.modal-overlay')?.remove();
  toast('下单成功！厨师马上开始做 🍳', 'success');
  emit('order-placed');
  refreshView();
}
