// 订单看板 + 采购清单 + 日历 v3
import { CONFIG } from '../config.js';
import { getSupabase, getProfile } from './supabase.js';
import { store, loadOrders, subscribeOrders } from './store.js';
import { toast } from './ui.js';

let viewMode = 'board';

export async function initOrdersPage() {
  await loadOrders();
  subscribeOrders(() => loadOrders().then(render));

  // ⚡ onclick 不重复
  document.getElementById('order-tab-board').onclick = () => { viewMode='board';switchTab('board');render(); };
  document.getElementById('order-tab-shop').onclick = () => { viewMode='shoplist';switchTab('shop');render(); };
  document.getElementById('order-tab-history').onclick = () => { viewMode='history';switchTab('history');render(); };

  // 订单点击切换状态（厨师）
  if (getProfile()?.role === 'chef') {
    document.getElementById('order-board').onclick = async e => {
      const card = e.target.closest('.order-card');
      if (!card) return;
      const order = store.orders.find(o => o.id === card.dataset.id);
      if (!order || order.status === 'done' || order.status === 'cancelled') return;
      const next = CONFIG.ORDER_STATUSES.indexOf(order.status) + 1;
      if (next >= CONFIG.ORDER_STATUSES.length) return;
      await getSupabase().from('orders').update({ status: CONFIG.ORDER_STATUSES[next] }).eq('id', order.id);
      toast(`「${order.dishes?.name||''}」→ ${CONFIG.STATUS_LABELS[CONFIG.ORDER_STATUSES[next]]}`);
    };
  }

  render();
}

function switchTab(active) {
  ['board','shop','history'].forEach(t => {
    document.getElementById(`order-tab-${t}`).classList.toggle('active', t===active);
  });
}

function render() {
  if (viewMode==='shoplist') renderShopList();
  else if (viewMode==='history') renderHistory();
  else renderBoard();
}

function renderBoard() {
  const el = document.getElementById('order-board');
  const today = new Date(); today.setHours(0,0,0,0);
  const active = store.orders.filter(o => new Date(o.created_at) >= today && o.status !== 'cancelled');
  if (!active.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div>今天还没有订单</div></div>`; return; }
  const cols = CONFIG.ORDER_STATUSES.filter(s => s !== 'cancelled');
  el.innerHTML = `<div class="board-columns">${cols.map(s => {
    const orders = active.filter(o => o.status === s);
    return `<div class="board-col"><div class="board-col-head"><span class="board-col-dot" style="background:${CONFIG.STATUS_COLORS[s]}"></span>${CONFIG.STATUS_LABELS[s]}<span class="board-col-count">${orders.length}</span></div><div class="board-col-body">${orders.map(o => {
      const d = o.dishes||{}; const meal = CONFIG.MEAL_LABELS[o.meal_type]||'';
      return `<div class="order-card" data-id="${o.id}"><div class="oc-img">${d.image_url?`<div style="width:100%;height:100%;background:url(${d.image_url}) center/cover;border-radius:7px;"></div>`:'🍽️'}</div><div class="oc-info"><div class="oc-name">${d.name||'?'} ${meal?`<span class="meal-tag">${meal}</span>`:''}</div>${o.note?`<div class="oc-note">💬${o.note}</div>`:''}<div class="oc-time">${fmt(o.created_at)}</div></div>${isChef()&&s!=='done'?'<div class="oc-arrow">▶</div>':''}</div>`;
    }).join('')||'<div class="col-empty">-</div>'}</div></div>`;
  }).join('')}</div>`;
}

function renderHistory() {
  const el = document.getElementById('order-board');
  const groups = {};
  store.orders.filter(o => o.status !== 'cancelled').forEach(o => {
    const date = new Date(o.created_at).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric',weekday:'short'});
    if(!groups[date]) groups[date]={breakfast:[],lunch:[],dinner:[]};
    (groups[date][o.meal_type||'dinner']||[]).push(o);
  });
  const dates = Object.keys(groups).sort((a,b)=>b.localeCompare(a));
  if(!dates.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📅</div><div>还没有用餐记录</div></div>`;return;}
  el.innerHTML=`<div class="history-wrap"><div class="history-summary">共${dates.length}天记录</div>${dates.map(date=>`<div class="history-day"><div class="history-date">📅${date}</div>${CONFIG.MEAL_TYPES.filter(m=>groups[date][m]?.length).map(m=>`<div class="history-meal"><div class="history-meal-label">${CONFIG.MEAL_LABELS[m]}</div><div class="history-meal-dishes">${groups[date][m].map(o=>`<span class="history-dish-tag">${o.dishes?.name||'?'}</span>`).join('')}</div></div>`).join('')}</div>`).join('')}</div>`;
}

function renderShopList() {
  const el = document.getElementById('order-board');
  const active = store.orders.filter(o => o.status==='pending'||o.status==='cooking');
  if(!active.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">🛒</div><div>没有需要采购的订单</div></div>`;return;}
  const dm={};
  active.forEach(o=>{const d=o.dishes;if(!d)return;if(!dm[d.name])dm[d.name]={name:d.name,qty:0,ingredients:[]};dm[d.name].qty++;if(d.ingredients)d.ingredients.split(',').map(s=>s.trim()).filter(Boolean).forEach(i=>{if(!dm[d.name].ingredients.includes(i))dm[d.name].ingredients.push(i);});});
  const allIngr=[...new Set(Object.values(dm).flatMap(d=>d.ingredients))].sort();
  const ck=JSON.parse(localStorage.getItem('shoplist-checked')||'[]');
  el.innerHTML=`<div class="shoplist-wrap"><div class="shoplist-summary">${active.length}个订单·${allIngr.length}种食材</div><div class="shoplist-group"><h4>📋采购清单</h4>${allIngr.map(i=>{const c=ck.includes(i);return`<div class="shoplist-item ${c?'done':''}" data-ingr="${i}"><span class="shoplist-check">${c?'✅':'⬜'}</span>${i}</div>`;}).join('')||'<div class="col-empty">暂无</div>'}</div><div class="shoplist-by-dish"><h4>📖按菜品</h4>${Object.values(dm).map(d=>`<div class="shoplist-dish"><div class="shoplist-dish-name">${d.name}×${d.qty}</div><div class="shoplist-dish-ingr">${d.ingredients.join('、')}</div></div>`).join('')}</div>${allIngr.length?`<button class="btn btn-block btn-outline" id="shoplist-clear">清空勾选</button>`:''}</div>`;
  el.querySelectorAll('.shoplist-item').forEach(it=>{it.onclick=()=>{const ingr=it.dataset.ingr;let c=JSON.parse(localStorage.getItem('shoplist-checked')||'[]');c=c.includes(ingr)?c.filter(i=>i!==ingr):[...c,ingr];localStorage.setItem('shoplist-checked',JSON.stringify(c));it.classList.toggle('done');it.querySelector('.shoplist-check').textContent=c.includes(ingr)?'✅':'⬜';};});
  const cb=el.querySelector('#shoplist-clear');if(cb)cb.onclick=()=>{localStorage.removeItem('shoplist-checked');renderShopList();};
}

function isChef(){return getProfile()?.role==='chef';}
function fmt(ts){return new Date(ts).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});}
