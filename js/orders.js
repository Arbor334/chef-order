// ============================================================
// 共用订单看板 — 实时状态流转
// ============================================================
import { CONFIG } from '../config.js';
import { getSupabase, getProfile } from './supabase.js';
import { store, loadOrders, subscribeOrders } from './store.js';
import { toast } from './ui.js';

export async function initOrdersPage() {
  const boardEl = document.getElementById('order-board');
  const profile = getProfile();

  await loadOrders();
  subscribeOrders(() => loadOrders().then(renderBoard));

  renderBoard();

  // 订单点击切换状态（厨师端）
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
      if (error) { toast('更新失败: ' + error.message, 'error'); }
      else { toast(`「${order.dishes?.name || ''}」→ ${CONFIG.STATUS_LABELS[nextStatus]}`); }
    });
  }
}

function renderBoard() {
  const boardEl = document.getElementById('order-board');
  if (!store.orders.length) {
    boardEl.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <div>暂无订单，等她点菜吧~</div>
    </div>`;
    return;
  }

  // 只显示今天未取消的订单
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeOrders = store.orders.filter(o =>
    new Date(o.created_at) >= today && o.status !== 'cancelled'
  );

  if (!activeOrders.length) {
    boardEl.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🍽️</div>
      <div>今天还没有新订单</div>
    </div>`;
    return;
  }

  const columns = CONFIG.ORDER_STATUSES.filter(s => s !== 'cancelled');
  boardEl.innerHTML = `<div class="board-columns">
    ${columns.map(status => {
      const orders = activeOrders.filter(o => o.status === status);
      return `
        <div class="board-col">
          <div class="board-col-head">
            <span class="board-col-dot" style="background:${CONFIG.STATUS_COLORS[status]}"></span>
            ${CONFIG.STATUS_LABELS[status]}
            <span class="board-col-count">${orders.length}</span>
          </div>
          <div class="board-col-body">
            ${orders.map(o => {
              const d = o.dishes || {};
              return `
                <div class="order-card" data-id="${o.id}" data-status="${o.status}">
                  ${d.image_url ? `<div class="oc-img" style="background-image:url(${d.image_url})"></div>` : ''}
                  <div class="oc-info">
                    <div class="oc-name">${d.name || '未知菜品'}</div>
                    ${o.note ? `<div class="oc-note">💬 ${o.note}</div>` : ''}
                    <div class="oc-time">${formatTime(o.created_at)}</div>
                  </div>
                  ${isChef() && status !== 'done' ? '<div class="oc-arrow">▶</div>' : ''}
                </div>`;
            }).join('') || '<div class="col-empty">-</div>'}
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

function isChef() {
  return getProfile()?.role === 'chef';
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
