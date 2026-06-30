// ============================================================
// 厨师端 — 菜单管理
// ============================================================
import { CONFIG } from '../config.js';
import { getSupabase, getUser } from './supabase.js';
import { store, loadDishes, loadOrders, subscribeOrders, emit } from './store.js';
import { toast, modal } from './ui.js';

let _dishesByCat = {};

export async function initChefPage() {
  const listEl = document.getElementById('chef-list');
  const fab = document.getElementById('chef-fab');

  // 加载数据
  await loadDishes();
  await loadOrders({ status: 'pending' });
  renderDishList();

  // 订阅实时更新
  subscribeOrders(() => {
    loadOrders({ status: 'pending' }).then(renderPendingBadge);
  });

  // FAB 添加菜品
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
      <div>还没有菜品，点右下角 + 添加第一道菜</div>
    </div>`;
    return;
  }

  listEl.innerHTML = Object.entries(_dishesByCat).map(([cat, dishes]) => `
    <div class="chef-cat-section">
      <h3 class="chef-cat-title">${cat} <span class="cat-count">${dishes.length}</span></h3>
      <div class="chef-dish-grid">
        ${dishes.map(d => `
          <div class="chef-dish-item" data-id="${d.id}">
            ${d.image_url ? `<div class="cdi-thumb" style="background-image:url(${d.image_url})"></div>` : `<div class="cdi-thumb cdi-thumb-empty">🍽️</div>`}
            <div class="cdi-info">
              <div class="cdi-name">${d.name}</div>
              <div class="cdi-meta">${d.ingredients || ''} · ⏱${d.cooking_time || 15}min</div>
            </div>
            <div class="cdi-btns">
              <button class="cdi-btn edit" data-id="${d.id}" title="编辑">✏️</button>
              <button class="cdi-btn del" data-id="${d.id}" title="下架">👁️‍🗨️</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // 绑定编辑/删除事件
  listEl.querySelectorAll('.cdi-btn.edit').forEach(b => {
    b.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      const dish = store.dishes.find(d => d.id === id);
      if (dish) showDishForm(dish);
    });
  });
  listEl.querySelectorAll('.cdi-btn.del').forEach(b => {
    b.addEventListener('click', async e => {
      const id = e.currentTarget.dataset.id;
      const dish = store.dishes.find(d => d.id === id);
      const action = await modal('下架菜品', `确定下架「${dish?.name}」？`, [
        { text: '取消', value: 'cancel' },
        { text: '下架', value: 'confirm', cls: 'btn-danger' }
      ]);
      if (action === 'confirm') {
        const sb = getSupabase();
        const { error } = await sb.from('dishes').update({ is_active: false }).eq('id', id);
        if (error) { toast('下架失败: ' + error.message, 'error'); }
        else { toast('已下架'); await loadDishes(); renderDishList(); }
      }
    });
  });

  renderPendingBadge();
}

function renderPendingBadge() {
  const badge = document.getElementById('chef-pending-count');
  if (!badge) return;
  const count = store.orders.filter(o => o.status === 'pending').length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// 菜品添加/编辑表单
async function showDishForm(dish = null) {
  const isEdit = !!dish;
  const existingImage = dish?.image_url || '';

  const fields = [
    { label: '菜名', id: 'df-name', type: 'text', value: dish?.name || '', required: true },
    { label: '分类', id: 'df-cat', type: 'select', value: dish?.category || CONFIG.CATEGORIES[0], options: CONFIG.CATEGORIES },
    { label: '食材', id: 'df-ingredients', type: 'text', value: dish?.ingredients || '', placeholder: '猪肉, 青椒, 蒜' },
    { label: '烹饪时间(分钟)', id: 'df-time', type: 'select', value: String(dish?.cooking_time || 15), options: CONFIG.COOKING_TIMES.map(String) },
    { label: '图片', id: 'df-image', type: 'file', accept: 'image/*', note: '可选,最多2MB' },
  ];

  const formHtml = fields.map(f => {
    if (f.type === 'select') {
      return `<div class="form-g">
        <label>${f.label}</label>
        <select id="${f.id}">${f.options.map(o => `<option value="${o}" ${o === f.value ? 'selected' : ''}>${o}</option>`).join('')}</select>
      </div>`;
    }
    if (f.type === 'file') {
      return `<div class="form-g">
        <label>${f.label} <span class="form-note">${f.note || ''}</span></label>
        <input type="file" id="${f.id}" ${f.accept ? `accept="${f.accept}"` : ''}/>
        ${existingImage ? `<div class="form-img-preview"><img src="${existingImage}" width="80"/></div>` : ''}
      </div>`;
    }
    return `<div class="form-g">
      <label>${f.label}</label>
      <input type="${f.type}" id="${f.id}" value="${f.value || ''}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}/>
    </div>`;
  }).join('');

  const actionText = isEdit ? '保存' : '添加';
  const actions = [
    { text: '取消', value: 'cancel' },
    { text: actionText, value: 'confirm', cls: 'btn-primary' }
  ];

  const result = await modal(isEdit ? '编辑菜品' : '添加菜品', formHtml, actions);
  if (result !== 'confirm') return;

  // 收集表单数据
  const name = document.getElementById('df-name')?.value.trim();
  const category = document.getElementById('df-cat')?.value;
  const ingredients = document.getElementById('df-ingredients')?.value.trim();
  const cooking_time = parseInt(document.getElementById('df-time')?.value) || 15;

  if (!name) { toast('请输入菜名', 'error'); return; }

  // 图片上传
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
  const user = getUser();
  const payload = { name, category, ingredients, cooking_time, image_url, is_active: true };

  if (isEdit) {
    const { error } = await sb.from('dishes').update(payload).eq('id', dish.id);
    if (error) { toast('保存失败: ' + error.message, 'error'); return; }
    toast('已更新');
  } else {
    const { error } = await sb.from('dishes').insert({ ...payload, created_by: user.id });
    if (error) { toast('添加失败: ' + error.message, 'error'); return; }
    toast('已添加');
  }

  await loadDishes();
  renderDishList();
}

// 上传图片到 Supabase Storage
async function uploadImage(file) {
  const sb = getSupabase();
  const ext = file.name.split('.').pop();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await sb.storage.from('dish-images').upload(filename, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from('dish-images').getPublicUrl(filename);
  return data.publicUrl;
}
