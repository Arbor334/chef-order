// ============================================================
// 厨师端 — 菜单管理 v2 (含步骤、食材、实时预览)
// ============================================================
import { CONFIG } from '../config.js';
import { getSupabase, getUser } from './supabase.js';
import { store, loadDishes, loadOrders, subscribeOrders } from './store.js';
import { toast, modal } from './ui.js';
import { DISH_EMOJI, catGradient } from './shared.js';

let _dishesByCat = {};

export async function initChefPage() {
  const listEl = document.getElementById('chef-list');
  const fab = document.getElementById('chef-fab');

  await loadDishes();
  await loadOrders({ status: 'pending' });
  renderDishList();

  subscribeOrders(() => {
    loadOrders({ status: 'pending' }).then(renderPendingBadge);
  });

  fab.addEventListener('click', () => showDishForm());
}

function renderDishList() {
  const listEl = document.getElementById('chef-list');
  _dishesByCat = {};
  store.dishes.forEach(d => {
    if (!_dishesByCat[d.category]) _dishesByCat[d.category] = [];
    _dishesByCat[d.category].push(d);
  });

  if (!store.dishes.length) {
    listEl.innerHTML = `<div class="empty-state">
      <div class="empty-icon">👨‍🍳</div>
      <div style="font-weight:600;">菜单还是空的</div>
      <div style="font-size:12px;margin-top:4px;">点右下角 + 添加第一道菜</div>
    </div>`;
    return;
  }

  listEl.innerHTML = Object.entries(_dishesByCat).map(([cat, dishes]) => `
    <div class="chef-cat-section">
      <h3 class="chef-cat-title">${cat.split(' ')[0]} <span class="cat-count">${dishes.length} 道</span></h3>
      ${dishes.map(d => renderChefDishItem(d, cat)).join('')}
    </div>
  `).join('');

  bindChefActions();
  renderPendingBadge();
}

function renderChefDishItem(d, cat) {
  const emoji = DISH_EMOJI[d.name] || (cat.startsWith('荤') ? '🥩' : cat.startsWith('素') ? '🥬' : cat.startsWith('汤') ? '🍲' : cat.startsWith('凉') ? '🥗' : cat.startsWith('主') ? '🍚' : '🍽️');
  const gradient = catGradient(cat);
  const hasImg = d.image_url && d.image_url.length > 10;
  const thumbStyle = hasImg
    ? `background-image:url(${d.image_url});background-size:cover;background-position:center;`
    : `background:${gradient};`;

  const steps = d.steps ? d.steps.split('\n').filter(s => s.trim()) : [];
  const ingr = d.ingredients ? d.ingredients.split(',').map(s => s.trim()).filter(Boolean) : [];

  return `
    <div class="chef-dish-item" data-id="${d.id}">
      <div class="cdi-thumb" style="${thumbStyle}">${hasImg ? '' : emoji}</div>
      <div class="cdi-info">
        <div class="cdi-name">${d.name}</div>
        <div class="cdi-meta-row">
          <span class="cdi-meta-tag">⏱ ${d.cooking_time || 15}min</span>
          <span class="cdi-meta-tag">📝 ${steps.length} 步</span>
          <span class="cdi-meta-tag">🛒 ${ingr.length} 种食材</span>
        </div>
      </div>
      <div class="cdi-btns">
        <button class="cdi-btn edit" data-id="${d.id}" title="编辑">✏️</button>
        <button class="cdi-btn del" data-id="${d.id}" title="下架">🗑️</button>
      </div>
    </div>`;
}

function bindChefActions() {
  const listEl = document.getElementById('chef-list');

  // 点击菜品查看详情
  listEl.querySelectorAll('.chef-dish-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.cdi-btn')) return;
      const id = item.dataset.id;
      const dish = store.dishes.find(d => d.id === id);
      if (dish) showDishDetail(dish);
    });
  });

  listEl.querySelectorAll('.cdi-btn.edit').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const id = e.currentTarget.dataset.id;
      const dish = store.dishes.find(d => d.id === id);
      if (dish) showDishForm(dish);
    });
  });

  listEl.querySelectorAll('.cdi-btn.del').forEach(b => {
    b.addEventListener('click', async e => {
      e.stopPropagation();
      const id = e.currentTarget.dataset.id;
      const dish = store.dishes.find(d => d.id === id);
      const action = await modal('下架菜品', `<p>确定下架「<b>${dish?.name}</b>」？\n下架后对方将看不到这道菜。</p>`, [
        { text: '取消', value: 'cancel' },
        { text: '下架', value: 'confirm', cls: 'btn-danger' }
      ]);
      if (action === 'confirm') {
        const sb = getSupabase();
        const { error } = await sb.from('dishes').update({ is_active: false }).eq('id', id);
        if (error) { toast(error.message, 'error'); }
        else { toast('已下架', 'success'); await loadDishes(); renderDishList(); }
      }
    });
  });
}

function renderPendingBadge() {
  const badge = document.getElementById('chef-pending-count');
  if (!badge) return;
  const count = store.orders.filter(o => o.status === 'pending').length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// 菜品详情浮窗
function showDishDetail(dish) {
  const steps = dish.steps ? dish.steps.split('\n').filter(s => s.trim()) : [];
  const ingr = dish.ingredients ? dish.ingredients.split(',').map(s => s.trim()).filter(Boolean) : [];
  const emoji = DISH_EMOJI[dish.name] || '🍽️';

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
    </div>
    ${ingr.length ? `
    <div class="dish-detail-section">
      <h4>🛒 食材</h4>
      <div class="ingredient-chips">${ingr.map(i => `<span class="ingredient-chip">${i}</span>`).join('')}</div>
    </div>` : ''}
    ${steps.length ? `
    <div class="dish-detail-section">
      <h4>📝 做菜步骤</h4>
      <ol class="dish-detail-steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
    </div>` : ''}
  `;
  modal(dish.name, html, [{ text: '关闭', value: 'close', cls: 'btn-primary' }]);
}

// 添加/编辑表单
async function showDishForm(dish = null) {
  const isEdit = !!dish;
  const existingImage = dish?.image_url || '';

  const fields = [
    { label: '菜名 *', id: 'df-name', type: 'text', value: dish?.name || '', required: true, placeholder: '如：红烧肉' },
    { label: '分类', id: 'df-cat', type: 'select', value: dish?.category || CONFIG.CATEGORIES[0], options: CONFIG.CATEGORIES },
    { label: '食材（逗号分隔）', id: 'df-ingredients', type: 'text', value: dish?.ingredients || '', placeholder: '五花肉, 冰糖, 生抽, 料酒' },
    { label: '烹饪时间 (分钟)', id: 'df-time', type: 'select', value: String(dish?.cooking_time || 15), options: CONFIG.COOKING_TIMES.map(String) },
    { label: '做菜步骤（每行一步）', id: 'df-steps', type: 'textarea', value: dish?.steps || '', placeholder: '1. 五花肉焯水\n2. 炒糖色\n3. 加调料炖煮\n4. 大火收汁' },
    { label: '图片', id: 'df-image', type: 'file', accept: 'image/*' },
  ];

  const formHtml = fields.map(f => {
    if (f.type === 'select') {
      return `<div class="form-g">
        <label>${f.label}</label>
        <select id="${f.id}">${f.options.map(o => `<option value="${o}" ${o === f.value ? 'selected' : ''}>${o}</option>`).join('')}</select>
      </div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="form-g">
        <label>${f.label}</label>
        <textarea id="${f.id}" placeholder="${f.placeholder}" rows="6">${f.value || ''}</textarea>
      </div>`;
    }
    if (f.type === 'file') {
      return `<div class="form-g">
        <label>${f.label} <span class="form-note">可选，最大${CONFIG.MAX_IMAGE_SIZE_MB}MB</span></label>
        <input type="file" id="${f.id}" ${f.accept ? `accept="${f.accept}"` : ''}/>
        ${existingImage ? `<div class="form-img-preview"><img src="${existingImage}"/></div>` : ''}
      </div>`;
    }
    return `<div class="form-g">
      <label>${f.label}</label>
      <input type="${f.type}" id="${f.id}" value="${f.value || ''}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}/>
    </div>`;
  }).join('');

  const actions = [
    { text: '取消', value: 'cancel' },
    { text: isEdit ? '保存修改' : '添加菜品', value: 'confirm', cls: 'btn-primary' }
  ];

  const result = await modal(isEdit ? '编辑菜品' : '➕ 添加新菜品', formHtml, actions);
  if (result !== 'confirm') return;

  const name = document.getElementById('df-name')?.value.trim();
  const category = document.getElementById('df-cat')?.value;
  const ingredients = document.getElementById('df-ingredients')?.value.trim();
  const cooking_time = parseInt(document.getElementById('df-time')?.value) || 15;
  const steps = document.getElementById('df-steps')?.value.trim() || '';

  if (!name) { toast('请输入菜名', 'error'); return; }

  let image_url = existingImage;
  const fileInput = document.getElementById('df-image');
  if (fileInput?.files?.[0]) {
    const file = fileInput.files[0];
    if (file.size > CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      toast(`图片不能超过${CONFIG.MAX_IMAGE_SIZE_MB}MB`, 'error');
      return;
    }
    try {
      image_url = await uploadImage(file);
    } catch (e) {
      toast('图片上传失败: ' + e.message, 'error');
      return;
    }
  }

  const sb = getSupabase();
  const payload = { name, category, ingredients, cooking_time, steps, image_url, is_active: true };

  if (isEdit) {
    const { error } = await sb.from('dishes').update(payload).eq('id', dish.id);
    if (error) { toast('保存失败: ' + error.message, 'error'); return; }
    toast('已更新 👨‍🍳', 'success');
  } else {
    const { error } = await sb.from('dishes').insert(payload);
    if (error) { toast('添加失败: ' + error.message, 'error'); return; }
    toast('新菜上架！', 'success');
  }

  await loadDishes();
  renderDishList();
}

async function uploadImage(file) {
  const sb = getSupabase();
  const ext = file.name.split('.').pop();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await sb.storage.from('dish-images').upload(filename, file, {
    cacheControl: '3600', upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from('dish-images').getPublicUrl(filename);
  return data.publicUrl;
}
