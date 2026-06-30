// ============================================================
// 订单看板 + 采购清单 + 日历历史 v3
// ============================================================
import { CONFIG } from '../config.js';
import { getSupabase, getProfile } from './supabase.js';
import { store, loadOrders, subscribeOrders } from './store.js';
import { toast } from './ui.js';

let viewMode = 'board'; // board | shoplist | history

export let _ordInited = false;

export async function initOrdersPage() {
  if (_ordInited) return;
  _ordInited = true;
  const profile = getProfile();
  const boardEl = document.getElementById('order-board');

  await loadOrders();
  subscribeOrders(() => loadOrders().then(render));

  document.getElementById('order-tab-board').addEventListener('click', () => { viewMode='board';switchTab('board');render(); });
  document.getElementById('order-tab-shop').addEventListener('click', () => { viewMode='shoplist';switchTab('shop');render(); });
  document.getElementById('order-tab-history').addEventListener('click', () => { viewMode='history';switchTab('history');render(); });

  render();

  if (profile.role === 'chef') {
    boardEl.addEventListener('click', async e => {
      const card = e.target.closest('.order-card');
      if (!card) return;
      const id = card.dataset.id;
      const order = store.orders.find(o => o.id === id);
      if (!order || order.status === 'done' || order.status === 'cancelled') return;
      const nextIdx = CONFIG.ORDER_STATUSES.indexOf(order.status) + 1;
      if (nextIdx >= CONFIG.ORDER_STATUSES.length) return;
      const sb = getSupabase();
      await sb.from('orders').update({ status: CONFIG.ORDER_STATUSES[nextIdx] }).eq('id', id);
      toast(`「${order.dishes?.name||''}」→ ${CONFIG.STATUS_LABELS[CONFIG.ORDER_STATUSES[nextIdx]]}`);
    });
  }
}

function switchTab(active) {
  ['board','shop','history'].forEach(t => {
    const btn = document.getElementById(`order-tab-${t}`);
    btn.classList.toggle('active', t===active);
  });
}

function render() {
  if (viewMode==='shoplist') renderShopList();
  else if (viewMode==='history') renderHistory();
  else renderBoard();
}

// ===== 订单看板 =====
function renderBoard() {
  const el = document.getElementById('order-board');
  const today = new Date(); today.setHours(0,0,0,0);
  const active = store.orders.filter(o => new Date(o.created_at) >= today && o.status !== 'cancelled');

  if (!active.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div>今天还没有订单</div></div>`;
    return;
  }

  const cols = CONFIG.ORDER_STATUSES.filter(s => s !== 'cancelled');
  el.innerHTML = `<div class="board-columns">${cols.map(s => {
    const orders = active.filter(o => o.status === s);
    return `<div class="board-col">
      <div class="board-col-head"><span class="board-col-dot" style="background:${CONFIG.STATUS_COLORS[s]}"></span>${CONFIG.STATUS_LABELS[s]}<span class="board-col-count">${orders.length}</span></div>
      <div class="board-col-body">${orders.map(o => renderOrderCard(o, s !== 'done')).join('')||'<div class="col-empty">-</div>'}</div>
    </div>`;
  }).join('')}</div>`;
}

function renderOrderCard(o, showArrow) {
  const d = o.dishes || {};
  const meal = CONFIG.MEAL_LABELS[o.meal_type] || '';
  return `<div class="order-card" data-id="${o.id}">
    <div class="oc-img">${d.image_url?`<div style="width:100%;height:100%;background:url(${d.image_url}) center/cover;border-radius:7px;"></div>`:'🍽️'}</div>
    <div class="oc-info">
      <div class="oc-name">${d.name||'?'} ${meal?`<span class="meal-tag">${meal}</span>`:''}</div>
      ${o.note?`<div class="oc-note">💬 ${o.note}</div>`:''}
      <div class="oc-time">${fmt(o.created_at)}</div>
    </div>
    ${showArrow&&isChef()?'<div class="oc-arrow">▶</div>':''}
  </div>`;
}

// ===== 日历历史 =====
function renderHistory() {
  const el = document.getElementById('order-board');
  // 按日期分组
  const groups = {};
  store.orders.filter(o => o.status !== 'cancelled').forEach(o => {
    const date = new Date(o.created_at).toLocaleDateString('zh-CN', { month:'numeric', day:'numeric', weekday:'short' });
    if (!groups[date]) groups[date] = { breakfast:[], lunch:[], dinner:[] };
    const meal = o.meal_type || 'dinner';
    if (groups[date][meal]) groups[date][meal].push(o);
  });

  const dates = Object.keys(groups).sort((a,b) => b.localeCompare(a));
  if (!dates.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><div>还没有用餐记录<br><span style="font-size:12px;">下单后这里会出现日历记录</span></div></div>`;
    return;
  }

  el.innerHTML = `<div class="history-wrap">
    <div class="history-summary">共 ${dates.length} 天用餐记录</div>
    ${dates.map(date => `
      <div class="history-day">
        <div class="history-date">📅 ${date}</div>
        ${CONFIG.MEAL_TYPES.filter(m => groups[date][m]?.length).map(m => `
          <div class="history-meal">
            <div class="history-meal-label">${CONFIG.MEAL_LABELS[m]}</div>
            <div class="history-meal-dishes">${groups[date][m].map(o => {
              const d = o.dishes || {};
              return `<span class="history-dish-tag">${d.name||'?'}</span>`;
            }).join('')}</div>
          </div>
        `).join('')}
      </div>
    `).join('')}
  </div>`;
}

// ===== 采购清单 =====
function renderShopList() {
  const el = document.getElementById('order-board');
  const active = store.orders.filter(o => o.status === 'pending' || o.status === 'cooking');
  if (!active.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><div>没有需要采购的订单</div></div>`;
    return;
  }
  const dishMap = {};
  active.forEach(o => {
    const d = o.dishes; if (!d) return;
    if (!dishMap[d.name]) dishMap[d.name] = { name:d.name, qty:0, ingredients:[] };
    dishMap[d.name].qty++;
    if (d.ingredients) d.ingredients.split(',').map(s=>s.trim()).filter(Boolean).forEach(i => { if(!dishMap[d.name].ingredients.includes(i)) dishMap[d.name].ingredients.push(i); });
  });
  const allIngr = [...new Set(Object.values(dishMap).flatMap(d=>d.ingredients))].sort();
  const checked = JSON.parse(localStorage.getItem('shoplist-checked')||'[]');

  el.innerHTML = `<div class="shoplist-wrap">
    <div class="shoplist-summary">${active.length}个订单 · ${allIngr.length}种食材</div>
    <div class="shoplist-group"><h4>📋 购物清单</h4>
      ${allIngr.map(i => {
        const ck = checked.includes(i);
        return `<div class="shoplist-item ${ck?'done':''}" data-ingr="${i}"><span class="shoplist-check">${ck?'✅':'⬜'}</span>${i}</div>`;
      }).join('')||'<div class="col-empty">暂无食材</div>'}
    </div>
    <div class="shoplist-by-dish"><h4>📖 按菜品</h4>
      ${Object.values(dishMap).map(d=>`<div class="shoplist-dish"><div class="shoplist-dish-name">${d.name}×${d.qty}</div><div class="shoplist-dish-ingr">${d.ingredients.join('、')}</div></div>`).join('')}
    </div>
    ${allIngr.length?`<button class="btn btn-block btn-outline" id="shoplist-clear">清空勾选</button>`:''}
  </div>`;

  el.querySelectorAll('.shoplist-item').forEach(item => item.addEventListener('click', () => {
    const ingr = item.dataset.ingr;
    let ck = JSON.parse(localStorage.getItem('shoplist-checked')||'[]');
    ck = ck.includes(ingr) ? ck.filter(i=>i!==ingr) : [...ck, ingr];
    localStorage.setItem('shoplist-checked',JSON.stringify(ck));
    item.classList.toggle('done'); item.querySelector('.shoplist-check').textContent = ck.includes(ingr)?'✅':'⬜';
  }));
  const cb = el.querySelector('#shoplist-clear');
  if(cb) cb.addEventListener('click',()=>{localStorage.removeItem('shoplist-checked');renderShopList();});
}

function isChef(){return getProfile()?.role==='chef';}
function fmt(ts){return new Date(ts).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});}
