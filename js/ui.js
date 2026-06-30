// ============================================================
// 通用 UI 组件 — toast, modal, card, form helpers
// ============================================================

// Toast 提示
let _toastTimer;
export function toast(msg, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast toast-${type}`;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// Modal 弹窗
export function modal(title, content, actions = []) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-head">${title}</div>
        <div class="modal-body">${content}</div>
        <div class="modal-foot">${actions.map((a, i) =>
          `<button class="btn ${a.cls || ''}" data-idx="${i}">${a.text}</button>`
        ).join('')}</div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) { overlay.remove(); resolve({ value: null, overlay }); }
    });
    overlay.querySelectorAll('.modal-foot .btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        // ⚡ 不立刻删除 DOM，caller 需要先读表单值
        resolve({ value: actions[idx]?.value ?? idx, overlay });
      });
    });
  });
}

// 菜品卡片 HTML
export function dishCard(dish, opts = {}) {
  const { showActions = false, isFavorite = false, onAction } = opts;
  const img = dish.image_url
    ? `<div class="dc-img" style="background-image:url(${dish.image_url})"></div>`
    : `<div class="dc-img dc-img-empty">🍽️</div>`;

  const favIcon = isFavorite ? '❤️' : '🤍';

  return `
    <div class="dish-card" data-id="${dish.id}">
      ${img}
      <div class="dc-body">
        <div class="dc-name">${dish.name}</div>
        <div class="dc-meta">${dish.ingredients || ''}</div>
        <div class="dc-footer">
          <span class="dc-time">⏱ ${dish.cooking_time || 15}min</span>
          <span class="dc-cat">${dish.category}</span>
        </div>
      </div>
      ${showActions ? `
      <div class="dc-actions">
        <button class="dc-btn dc-fav" data-action="fav" data-id="${dish.id}">${favIcon}</button>
      </div>` : ''}
    </div>`;
}

// 加载指示器
export function showLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '<div class="loading">加载中...</div>';
}

export function hideLoading(containerId) {
  // managed by content replacement
}
