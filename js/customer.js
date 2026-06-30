// ============================================================
// 对象端 v6 — 与厨师共享同一菜单布局，只能点菜
// ============================================================
import { CONFIG } from '../config.js';
import { getSupabase, getUser } from './supabase.js';
import { store, loadDishes, loadFavorites, loadBanner, emit } from './store.js';
import { toast, modal } from './ui.js';
import { DISH_EMOJI, catGradient } from './shared.js';

let cart = [], activeCat = CONFIG.CATEGORIES[0];

export async function initCustomerPage() {
  const user = getUser();
  await loadDishes();
  await loadFavorites(user.id);
  await renderBanner();

  // 隐藏厨师专属
  document.getElementById('chef-fab').style.display = 'none';
  document.getElementById('chef-banner-edit').style.display = 'none';

  // 显示购物车栏
  const cartBar = document.getElementById('cust-cart-bar');
  cartBar.style.display = 'flex';

  renderSidebar();
  renderDishList(activeCat);
  updateCartBar();

  // 侧栏点击
  document.getElementById('chef-sidebar').addEventListener('click', e => {
    const item = e.target.closest('.sidebar-cat');
    if (!item) return;
    activeCat = item.dataset.cat;
    renderSidebar();
    renderDishList(activeCat);
  });

  // 菜品点击
  document.getElementById('chef-main').addEventListener('click', e => {
    const add = e.target.closest('.cust-card-add');
    const card = e.target.closest('.chef-card');
    if (!card) return;
    const id = card.dataset.id;
    const dish = store.dishes.find(d => d.id === id);
    if (!dish) return;
    if (add) { toggleCart(dish); return; }
    showDishDetail(dish);
  });

  // 购物车
  document.getElementById('cust-cart-btn').addEventListener('click', () => showCartModal());
  document.getElementById('cust-submit').addEventListener('click', submitOrder);
}

async function renderBanner() {
  try {
    const b = await loadBanner();
    document.getElementById('cust-banner-msg').textContent = b.message || '今天想吃点什么？';
    const bg = document.getElementById('cust-banner-bg');
    if (b.image_url) { bg.style.backgroundImage = `url(${b.image_url})`; bg.classList.add('has-bg'); }
  } catch (_) {}
}

function renderSidebar() {
  document.getElementById('chef-sidebar').innerHTML = CONFIG.CATEGORIES.map(c => {
    const count = store.dishes.filter(d => d.category === c).length;
    return `<div class="sidebar-cat ${c===activeCat?'active':''}" data-cat="${c}">
      <span class="sidebar-cat-icon">${CONFIG.CATEGORY_ICONS[c]||'🍽️'}</span>
      <span class="sidebar-cat-name">${c}</span>
      ${count>0?`<span class="sidebar-cat-count">${count}</span>`:''}
    </div>`;
  }).join('');
}

function renderDishList(cat) {
  const el = document.getElementById('chef-main');
  const dishes = store.dishes.filter(d => d.category === cat);
  if (!dishes.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div>暂无菜品</div></div>`; return; }
  const isHotpot = cat === CONFIG.HOTPOT_CATEGORY;
  const banner = isHotpot ? `<div class="hotpot-banner">🔥 火锅食材自由搭配</div>` : '';
  el.innerHTML = banner + `<div class="dish-list">${dishes.map(renderCustCard).join('')}</div>`;
}

function renderCustCard(d) {
  const inCart = cart.some(c => c.dish_id === d.id);
  const emoji = DISH_EMOJI[d.name] || CONFIG.CATEGORY_ICONS[d.category] || '🍽️';
  const hasImg = d.image_url && d.image_url.length > 10;
  const gradient = catGradient(d.category);
  const rating = (4.0 + Math.random() * 1.0).toFixed(1);

  return `<div class="chef-card" data-id="${d.id}">
    <div class="chef-card-img" style="background:${gradient};">
      ${hasImg ? `<img src="${d.image_url}" alt="${d.name}"/>` : emoji}
    </div>
    <div class="chef-card-body">
      <div class="chef-card-title">${d.name}</div>
      <div class="chef-card-meta">
        <span class="chef-card-tag accent">⏱ ${d.cooking_time||15}min</span>
        <span class="chef-card-tag" style="color:var(--star);">⭐ ${rating}</span>
      </div>
      <div class="chef-card-bottom">
        <span class="chef-card-price">${d.price ? '¥' + d.price : ''}</span>
        <button class="cust-card-add ${inCart?'in-cart':''}" style="width:32px;height:32px;border-radius:50%;background:${inCart?'var(--success)':'var(--ac)'};color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;">${inCart?'✓':'+'}</button>
      </div>
    </div>
  </div>`;
}

function showDishDetail(dish) {
  const steps = dish.steps ? dish.steps.split('\n').filter(s => s.trim()) : [];
  const ingr = dish.ingredients ? dish.ingredients.split(',').map(s => s.trim()).filter(Boolean) : [];
  const inCart = cart.some(c => c.dish_id === dish.id);
  const hasImg = dish.image_url && dish.image_url.length > 10;
  const emoji = DISH_EMOJI[dish.name] || '🍽️';
  const html = `${hasImg ? `<div class="dish-detail-img" style="background-image:url(${dish.image_url});background-size:cover;"></div>` : `<div class="dish-detail-img" style="background:${catGradient(dish.category)};">${emoji}</div>`}
    <div class="dish-detail-name">${dish.name}</div>
    <div class="dish-detail-meta">
      <span class="dish-detail-tag" style="color:var(--danger);font-weight:700;">${dish.price ? '¥' + dish.price : ''}</span>
      ${inCart ? '<span class="dish-detail-tag" style="background:var(--acd);color:var(--ac);">已在购物车</span>' : ''}
    </div>
    ${ingr.length ? `<div class="dish-detail-section"><h4>🛒 食材</h4><div class="ingredient-chips">${ingr.map(i => `<span class="ingredient-chip">${i}</span>`).join('')}</div></div>` : ''}
    ${steps.length ? `<div class="dish-detail-section"><h4>📝 步骤</h4><ol class="dish-detail-steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol></div>` : ''}`;
  modal(dish.name, html, [
    { text: '关闭', value: 'close' },
    { text: inCart ? '移除' : '➕ 我要点这个', value: 'toggle', cls: inCart ? 'btn-outline' : 'btn-primary' }
  ]).then(a => { if (a === 'toggle') toggleCart(dish); });
}

function toggleCart(dish) {
  const idx = cart.findIndex(c => c.dish_id === dish.id);
  if (idx >= 0) { cart.splice(idx, 1); toast(`已移除「${dish.name}」`); }
  else { cart.push({ dish_id: dish.id, dish, note: '' }); toast(`已加入「${dish.name}」✅`, 'success'); }
  updateCartBar();
  renderDishList(activeCat);
}

function updateCartBar() {
  const count = document.getElementById('cust-cart-count');
  const total = document.getElementById('cust-cart-total');
  const detail = document.getElementById('cust-cart-detail');
  count.textContent = cart.length;
  count.style.display = cart.length > 0 ? 'flex' : 'none';
  const sum = cart.reduce((s, c) => s + (c.dish.price || 0), 0);
  total.textContent = `¥${sum}`;
  detail.textContent = cart.length > 0 ? `已选 ${cart.length} 道` : '空空如也 🥲';
}

async function showCartModal() {
  if (!cart.length) { toast('还没选菜', 'info'); return; }
  const html = cart.map((c, i) => `<div class="cart-item">
    <div class="cart-info"><div class="cart-name">${c.dish.name} <span class="cart-time">⏱${c.dish.cooking_time||15}min · ¥${c.dish.price||0}</span></div>
    <input class="cart-note" data-idx="${i}" type="text" placeholder="备注: 少辣/不要香菜..." value="${c.note}"/></div>
    <button class="cart-remove" data-idx="${i}">✕</button></div>`).join('');
  const sum = cart.reduce((s, c) => s + (c.dish.price || 0), 0);
  const r = await modal('🛒 购物车', `<div class="cart-list">${html}</div><div class="cart-summary">共 ${cart.length} 道 · ¥${sum}</div>`,
    [{ text: '继续加', value: 'cancel' }, { text: '确认下单 🍳', value: 'ok', cls: 'btn-primary' }]);
  document.querySelectorAll('.cart-note').forEach(inp => { const i = parseInt(inp.dataset.idx); if (cart[i]) cart[i].note = inp.value.trim(); });
  document.querySelectorAll('.cart-remove').forEach(b => { b.addEventListener('click', () => { const i = parseInt(b.dataset.idx); cart.splice(i, 1); document.querySelector('.modal-overlay')?.remove(); updateCartBar(); if (cart.length) showCartModal(); else renderDishList(activeCat); }); });
  if (r !== 'ok') return;
  document.getElementById('cust-submit').click();
}

async function submitOrder() {
  if (!cart.length) return;
  const sb = getSupabase(), user = getUser();
  const orders = cart.map(c => ({ dish_id: c.dish_id, customer_id: user.id, status: 'pending', note: c.note || null }));
  const { error } = await sb.from('orders').insert(orders);
  if (error) { toast('下单失败', 'error'); return; }
  const newFavs = orders.map(o => o.dish_id).filter(id => !store.favorites.has(id));
  if (newFavs.length) { await sb.from('favorites').upsert(newFavs.map(dish_id => ({ user_id: user.id, dish_id })), { onConflict: 'user_id,dish_id', ignoreDuplicates: true }); newFavs.forEach(id => store.favorites.add(id)); }
  cart = []; updateCartBar(); document.querySelector('.modal-overlay')?.remove();
  toast('下单成功！厨师马上开始做 🍳', 'success'); emit('order-placed'); renderDishList(activeCat);
}
