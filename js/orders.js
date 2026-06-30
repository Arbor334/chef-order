// ============================================================
// 订单看板 + 采购清单 v2
// ============================================================
import { CONFIG } from '../config.js';
import { getSupabase, getProfile } from './supabase.js';
import { store, loadOrders, subscribeOrders } from './store.js';
import { toast } from './ui.js';

let viewMode = 'board'; // 'board' | 'shoplist'

export async function initOrdersPage() {
  const profile = getProfile();
  const boardEl = document.getElementById('order-board');

  await loadOrders();
  subscribeOrders(() => loadOrders().then(render));

  // 切换 tab
  document.getElementById('order-tab-board').addEventListener('click', () => {
    viewMode = 'board';
    document.getElementById('order-tab-board').classList.add('active');
    document.getElementById('order-tab-shop').classList.remove('active');
    render();
  });
  document.getElementById('order-tab-shop').addEventListener('click', () => {
    viewMode = 'shoplist';
    document.getElementById('order-tab-shop').classList.add('active');
    document.getElementById('order-tab-board').classList.remove('active');
    render();
  });

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
      const nextStatus = CONFIG.ORDER_STATUSES[nextIdx];
      const sb = getSupabase();
      const { error } = await sb.from('orders').update({ status: nextStatus }).eq('id', id);
      if (error) { toast('更新失败', 'error'); }
      else { toast(`「${order.dishes?.name || ''}」→ ${CONFIG.STATUS_LABELS[nextStatus]}`); }
    });
  }
}

function render() {
  if (viewMode === 'shoplist') renderShopList();
  else renderBoard();
}

// ===== 订单看板 =====
function renderBoard() {
  const el = document.getElementById('order-board');
  const today = new Date(); today.setHours(0,0,0,0);
  const active = store.orders.filter(o => new Date(o.created_at) >= today && o.status !== 'cancelled');

  if (!active.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div>暂无订单</div></div>`;
    return;
  }

  const cols = CONFIG.ORDER_STATUSES.filter(s => s !== 'cancelled');
  el.innerHTML = `<div class="board-columns">${cols.map(s => {
    const orders = active.filter(o => o.status === s);
    return `<div class="board-col">
      <div class="board-col-head"><span class="board-col-dot" style="background:${CONFIG.STATUS_COLORS[s]}"></span>${CONFIG.STATUS_LABELS[s]}<span class="board-col-count">${orders.length}</span></div>
      <div class="board-col-body">${orders.map(o => {
        const d = o.dishes || {};
        return `<div class="order-card" data-id="${o.id}">
          <div class="oc-img">${d.image_url?`<div style="width:100%;height:100%;background:url(${d.image_url}) center/cover;border-radius:7px;"></div>`:'🍽️'}</div>
          <div class="oc-info"><div class="oc-name">${d.name||'?'}</div>${o.note?`<div class="oc-note">💬 ${o.note}</div>`:''}<div class="oc-time">${fmt(o.created_at)}</div></div>
          ${isChef()&&s!=='done'?'<div class="oc-arrow">▶</div>':''}
        </div>`;
      }).join('')||'<div class="col-empty">-</div>'}</div>
    </div>`;
  }).join('')}</div>`;
}

// ===== 采购清单 =====
function renderShopList() {
  const el = document.getElementById('order-board');
  // 聚合 pending + cooking 订单的所有菜品食材
  const active = store.orders.filter(o => o.status === 'pending' || o.status === 'cooking');
  if (!active.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><div>没有需要采购的订单<br><span style="font-size:12px;">等待她下单中</span></div></div>`;
    return;
  }

  // 按菜品聚合
  const dishMap = {};
  active.forEach(o => {
    const d = o.dishes;
    if (!d) return;
    const key = d.name;
    if (!dishMap[key]) dishMap[key] = { name: d.name, qty: 0, ingredients: [] };
    dishMap[key].qty++;
    if (d.ingredients) {
      d.ingredients.split(',').map(s => s.trim()).filter(Boolean).forEach(i => {
        if (!dishMap[key].ingredients.includes(i)) dishMap[key].ingredients.push(i);
      });
    }
  });

  // 汇总所有食材（去重）
  const allIngr = [...new Set(Object.values(dishMap).flatMap(d => d.ingredients))].sort();
  const checked = JSON.parse(localStorage.getItem('shoplist-checked') || '[]');

  el.innerHTML = `
    <div class="shoplist-wrap">
      <div class="shoplist-summary">${active.length} 个订单 · ${Object.keys(dishMap).length} 种菜品 · ${allIngr.length} 种食材</div>
      <div class="shoplist-group">
        <h4>📋 购物清单</h4>
        ${allIngr.map(i => {
          const isChecked = checked.includes(i);
          return `<div class="shoplist-item ${isChecked?'done':''}" data-ingr="${i}">
            <span class="shoplist-check">${isChecked?'✅':'⬜'}</span>
            <span class="shoplist-name">${i}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="shoplist-by-dish">
        <h4>📖 按菜品详情</h4>
        ${Object.values(dishMap).map(d => `
          <div class="shoplist-dish">
            <div class="shoplist-dish-name">${d.name} ×${d.qty}</div>
            <div class="shoplist-dish-ingr">${d.ingredients.join('、') || '无食材信息'}</div>
          </div>
        `).join('')}
      </div>
      ${allIngr.length ? `<button class="btn btn-block btn-outline" id="shoplist-clear">清空勾选</button>` : ''}
    </div>`;

  // 勾选/取消
  el.querySelectorAll('.shoplist-item').forEach(item => {
    item.addEventListener('click', () => {
      const ingr = item.dataset.ingr;
      let checked = JSON.parse(localStorage.getItem('shoplist-checked') || '[]');
      if (checked.includes(ingr)) checked = checked.filter(i => i !== ingr);
      else checked.push(ingr);
      localStorage.setItem('shoplist-checked', JSON.stringify(checked));
      item.classList.toggle('done');
      item.querySelector('.shoplist-check').textContent = checked.includes(ingr) ? '✅' : '⬜';
    });
  });
  const clearBtn = el.querySelector('#shoplist-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    localStorage.removeItem('shoplist-checked');
    renderShopList();
  });
}

function isChef() { return getProfile()?.role === 'chef'; }
function fmt(ts) { return new Date(ts).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}); }
