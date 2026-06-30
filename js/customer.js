// ============================================================
// 对象端 v6 — onclick 防重复
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

  document.getElementById('chef-fab').style.display = 'none';
  document.getElementById('chef-banner-edit').style.display = 'none';
  document.getElementById('cust-banner').style.cursor = 'auto';
  document.getElementById('cust-cart-bar').style.display = 'flex';

  renderSidebar();
  renderDishList(activeCat);
  updateCartBar();

  // ⚡ onclick 不会重复叠加
  document.getElementById('chef-sidebar').onclick = e => {
    const item = e.target.closest('.sidebar-cat');
    if (!item) return;
    activeCat = item.dataset.cat;
    renderSidebar();
    renderDishList(activeCat);
  };

  document.getElementById('chef-main').onclick = e => {
    const add = e.target.closest('.cust-card-add');
    const card = e.target.closest('.chef-card');
    if (!card) return;
    const dish = store.dishes.find(d => d.id === card.dataset.id);
    if (!dish) return;
    if (add) { toggleCart(dish); return; }
    showDishDetail(dish);
  };

  document.getElementById('cust-cart-btn').onclick = () => showCartModal();
  document.getElementById('cust-submit').onclick = submitOrder;

  // Banner 定时刷新
  setInterval(() => renderBanner(), 8000);
}

async function renderBanner() {
  try {
    const b = await loadBanner();
    const m = document.getElementById('cust-banner-msg');
    const g = document.getElementById('cust-banner-bg');
    if (!m) return;
    m.textContent = b.message || '今天想吃点什么？';
    if (b.image_url) { g.style.backgroundImage = `url(${b.image_url})`; g.classList.add('has-bg'); }
    else { g.style.backgroundImage = ''; g.classList.remove('has-bg'); }
  } catch (_) {}
}

function renderSidebar() {
  document.getElementById('chef-sidebar').innerHTML = CONFIG.CATEGORIES.map(c => {
    const cnt = store.dishes.filter(d => d.category === c).length;
    return `<div class="sidebar-cat ${c===activeCat?'active':''}" data-cat="${c}">
      <span class="sidebar-cat-icon">${CONFIG.CATEGORY_ICONS[c]||'🍽️'}</span>
      <span class="sidebar-cat-name">${c}</span>
      ${cnt>0?`<span class="sidebar-cat-count">${cnt}</span>`:''}
    </div>`;
  }).join('');
}

function renderDishList(cat) {
  const el = document.getElementById('chef-main');
  const dishes = store.dishes.filter(d => d.category === cat);
  if (!dishes.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div>暂无菜品</div></div>`; return; }
  const isHotpot = cat === CONFIG.HOTPOT_CATEGORY;
  const banner = isHotpot ? `<div class="hotpot-banner">🔥 火锅食材自由搭配</div>` : '';
  el.innerHTML = banner + `<div class="dish-list">${dishes.map(d => {
    const inCart = cart.some(c => c.dish_id === d.id);
    const emoji = DISH_EMOJI[d.name]||CONFIG.CATEGORY_ICONS[d.category]||'🍽️';
    const hasImg = d.image_url&&d.image_url.length>10;
    const rating = (4.0+Math.random()*1.0).toFixed(1);
    return `<div class="chef-card" data-id="${d.id}">
      <div class="chef-card-img" style="background:${catGradient(d.category)};">${hasImg?`<img src="${d.image_url}" alt="${d.name}"/>`:emoji}</div>
      <div class="chef-card-body">
        <div class="chef-card-title">${d.name}</div>
        <div class="chef-card-meta"><span class="chef-card-tag accent">⏱${d.cooking_time||15}min</span><span class="chef-card-tag" style="color:var(--star);">⭐${rating}</span></div>
        <div class="chef-card-bottom">
          <span class="chef-card-price">${d.price?'¥'+d.price:''}</span>
          <button class="cust-card-add ${inCart?'in-cart':''}" style="width:32px;height:32px;border-radius:50%;background:${inCart?'var(--success)':'var(--ac)'};color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;">${inCart?'✓':'+'}</button>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function showDishDetail(dish) {
  const steps = dish.steps?dish.steps.split('\n').filter(s=>s.trim()):[];
  const ingr = dish.ingredients?dish.ingredients.split(',').map(s=>s.trim()).filter(Boolean):[];
  const inCart = cart.some(c=>c.dish_id===dish.id);
  const hasImg = dish.image_url&&dish.image_url.length>10;
  const emoji = DISH_EMOJI[dish.name]||'🍽️';
  const html = `${hasImg?`<div class="dish-detail-img" style="background-image:url(${dish.image_url});background-size:cover;"></div>`:`<div class="dish-detail-img" style="background:${catGradient(dish.category)};">${emoji}</div>`}
    <div class="dish-detail-name">${dish.name}</div>
    <div class="dish-detail-meta"><span class="dish-detail-tag" style="color:var(--danger);font-weight:700;">${dish.price?'¥'+dish.price:''}</span>${inCart?'<span class="dish-detail-tag" style="background:var(--acd);color:var(--ac);">已在购物车</span>':''}</div>
    ${ingr.length?`<div class="dish-detail-section"><h4>🛒 食材</h4><div class="ingredient-chips">${ingr.map(i=>`<span class="ingredient-chip">${i}</span>`).join('')}</div></div>`:''}
    ${steps.length?`<div class="dish-detail-section"><h4>📝 步骤</h4><ol class="dish-detail-steps">${steps.map(s=>`<li>${s}</li>`).join('')}</ol></div>`:''}`;
  modal(dish.name,html,[{text:'关闭',value:'no'},{text:inCart?'移除':'➕ 我要点',value:'ok',cls:inCart?'btn-outline':'btn-primary'}]).then(r=>{r.overlay.remove();if(r.value==='ok')toggleCart(dish);});
}

function toggleCart(dish) {
  const idx=cart.findIndex(c=>c.dish_id===dish.id);
  if(idx>=0){cart.splice(idx,1);toast(`已移除「${dish.name}」`);}
  else{cart.push({dish_id:dish.id,dish,note:''});toast(`已加入「${dish.name}」✅`,'success');}
  updateCartBar();renderDishList(activeCat);
}

function updateCartBar() {
  const c=document.getElementById('cust-cart-count'),t=document.getElementById('cust-cart-total'),d=document.getElementById('cust-cart-detail');
  c.textContent=cart.length;c.style.display=cart.length>0?'flex':'none';
  t.textContent='¥'+cart.reduce((s,c)=>s+(c.dish.price||0),0);
  d.textContent=cart.length>0?`已选 ${cart.length} 道`:'空空如也 🥲';
}

async function showCartModal() {
  if(!cart.length){toast('还没选菜','info');return;}
  const html=cart.map((c,i)=>`<div class="cart-item"><div class="cart-info"><div class="cart-name">${c.dish.name}<span class="cart-time">⏱${c.dish.cooking_time||15}min · ¥${c.dish.price||0}</span></div><input class="cart-note" data-idx="${i}" type="text" placeholder="备注: 少辣/不要香菜..." value="${c.note}"/></div><button class="cart-remove" data-idx="${i}">✕</button></div>`).join('');
  const mealHtml=CONFIG.MEAL_TYPES.map(m=>`<label class="meal-radio"><input type="radio" name="meal-type" value="${m}" ${m==='dinner'?'checked':''}/><span>${CONFIG.MEAL_LABELS[m]}</span></label>`).join('');
  const sum=cart.reduce((s,c)=>s+(c.dish.price||0),0);
  const result=await modal('🛒 购物车',`<div class="cart-list">${html}</div><div class="meal-select"><div class="meal-label">这顿是：</div><div class="meal-options">${mealHtml}</div></div><div class="cart-summary">共${cart.length}道·¥${sum}</div>`,[{text:'继续加',value:'no'},{text:'确认下单🍳',value:'ok',cls:'btn-primary'}]);
  result.overlay.querySelectorAll('.cart-note').forEach(inp=>{const i=parseInt(inp.dataset.idx);if(cart[i])cart[i].note=inp.value.trim();});
  result.overlay.querySelectorAll('.cart-remove').forEach(b=>{b.onclick=()=>{const i=parseInt(b.dataset.idx);cart.splice(i,1);result.overlay.remove();updateCartBar();if(cart.length)showCartModal();else renderDishList(activeCat);};});
  if(result.value!=='ok'){result.overlay.remove();return;}
  document.getElementById('cust-submit').click();
}

async function submitOrder() {
  if(!cart.length)return;const sb=getSupabase(),user=getUser();
  const mealType=document.querySelector('input[name="meal-type"]:checked')?.value||'dinner';
  const orders=cart.map(c=>({dish_id:c.dish_id,customer_id:user.id,status:'pending',note:c.note||null,meal_type:mealType}));
  const {error}=await sb.from('orders').insert(orders);
  if(error){toast('下单失败','error');return;}
  const newFavs=orders.map(o=>o.dish_id).filter(id=>!store.favorites.has(id));
  if(newFavs.length){await sb.from('favorites').upsert(newFavs.map(dish_id=>({user_id:user.id,dish_id})),{onConflict:'user_id,dish_id',ignoreDuplicates:true});newFavs.forEach(id=>store.favorites.add(id));}
  const totalTime=orders.reduce((s,o)=>s+(store.dishes.find(d=>d.id===o.dish_id)?.cooking_time||15),0);
  const names=orders.map(o=>store.dishes.find(d=>d.id===o.dish_id)?.name||'?').join('、');
  cart=[];updateCartBar();document.querySelector('.modal-overlay')?.remove();
  const okModal = await modal('✅ 下单成功！',`<div style="text-align:center;padding:12px"><div style="font-size:56px;">🍳</div><div style="font-size:16px;font-weight:700;">${names}</div><div style="font-size:13px;color:var(--tx2);margin-top:8px;">预计${totalTime}分钟后开吃✨</div></div>`,[{text:'好的👌',value:'ok',cls:'btn-primary'}]);
  okModal.overlay.remove();
  emit('order-placed');renderDishList(activeCat);
}
