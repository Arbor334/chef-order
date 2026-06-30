// ============================================================
// 厨师端 v5 — 美团风格：顶栏+侧栏+卡片+底部导航
// ============================================================
import { CONFIG } from '../config.js';
import { getSupabase, getUser } from './supabase.js';
import { store, loadDishes, loadOrders, subscribeOrders, loadBanner, subscribeBanner } from './store.js';
import { toast, modal } from './ui.js';
import { DISH_EMOJI, catGradient } from './shared.js';

let activeCat = CONFIG.CATEGORIES[0];

export async function initChefPage() {
  await loadDishes();
  await loadOrders({ status: 'pending' });
  initBannerEditor();
  renderSidebar();
  renderDishList(activeCat);

  // 侧栏点击
  document.getElementById('chef-sidebar').addEventListener('click', e => {
    const item = e.target.closest('.sidebar-cat');
    if (!item) return;
    activeCat = item.dataset.cat;
    renderSidebar();
    renderDishList(activeCat);
  });

  // FAB
  document.getElementById('chef-fab').addEventListener('click', () => showDishForm());

  // 实时订单
  subscribeOrders(() => loadOrders({ status: 'pending' }).then(renderPendingBadge));

  // 主区域事件
  document.getElementById('chef-main').addEventListener('click', e => {
    const editBtn = e.target.closest('.edit-btn');
    const delBtn = e.target.closest('.del-btn');
    const card = e.target.closest('.chef-card');
    if (!card) return;
    const id = card.dataset.id;
    const dish = store.dishes.find(d => d.id === id);
    if (!dish) return;
    if (editBtn) { showDishForm(dish); return; }
    if (delBtn) { deleteDish(dish); return; }
  });
}

// ===== Sidebar =====
function renderSidebar() {
  const el = document.getElementById('chef-sidebar');
  el.innerHTML = CONFIG.CATEGORIES.map(c => {
    const icon = CONFIG.CATEGORY_ICONS[c] || '🍽️';
    const count = store.dishes.filter(d => d.category === c).length;
    return `<div class="sidebar-cat ${c===activeCat?'active':''}" data-cat="${c}">
      <span class="sidebar-cat-icon">${icon}</span>
      <span class="sidebar-cat-name">${c}</span>
      ${count>0?`<span class="sidebar-cat-count">${count}</span>`:''}
    </div>`;
  }).join('');
}

// ===== Dish List =====
function renderDishList(cat) {
  const el = document.getElementById('chef-main');
  const dishes = store.dishes.filter(d => d.category === cat);
  if (!dishes.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div>这里还没有菜品<br><span style="font-size:12px;">点 + 添加</span></div></div>`;
    return;
  }
  el.innerHTML = `<div class="dish-list">${dishes.map(d => renderChefCard(d)).join('')}</div>`;
}

function renderChefCard(d) {
  const emoji = DISH_EMOJI[d.name] || CONFIG.CATEGORY_ICONS[d.category] || '🍽️';
  const hasImg = d.image_url && d.image_url.length > 10;
  const gradient = catGradient(d.category);
  const steps = d.steps ? d.steps.split('\n').filter(s=>s.trim()) : [];
  const ingr = d.ingredients ? d.ingredients.split(',').map(s=>s.trim()).filter(Boolean) : [];

  return `<div class="chef-card" data-id="${d.id}">
    <div class="chef-card-img" style="background:${gradient};">
      ${hasImg ? `<img src="${d.image_url}" alt="${d.name}"/>` : emoji}
    </div>
    <div class="chef-card-body">
      <div class="chef-card-title">${d.name}</div>
      ${ingr.length ? `<div class="chef-card-desc">${ingr.slice(0,4).join(' · ')}</div>` : ''}
      <div class="chef-card-meta">
        <span class="chef-card-tag accent">⏱ ${d.cooking_time||15}min</span>
        <span class="chef-card-tag">📝 ${steps.length}步</span>
        <span class="chef-card-tag">🛒 ${ingr.length}种</span>
      </div>
      <div class="chef-card-bottom">
        <span class="chef-card-price">${d.price ? '¥'+d.price : ''}</span>
      </div>
    </div>
    <div class="chef-card-actions">
      <button class="edit-btn">✏️</button>
      <button class="del-btn">🗑️</button>
    </div>
  </div>`;
}

// ===== Banner =====
async function initBannerEditor() {
  try { const b = await loadBanner(); if(b){document.getElementById('chef-banner-edit').textContent=b.message?'📢✓':'📢';} }catch(_){}
  document.getElementById('chef-banner-edit').addEventListener('click', () => showBannerForm());
}

async function showBannerForm() {
  let banner = { message:'', image_url:'' };
  try { banner = await loadBanner(); } catch(_) {}
  const html = `<div class="form-g"><label>今日留言</label><textarea id="bn-msg" rows="3">${banner.message||''}</textarea></div>
    <div class="form-g"><label>背景图</label><input type="file" id="bn-img" accept="image/*"/>${banner.image_url?`<div class="form-img-preview"><img src="${banner.image_url}"/></div>`:''}</div>`;
  const r = await modal('📢 今日想说', html, [{text:'取消',value:'cancel'},{text:'保存',value:'ok',cls:'btn-primary'}]);
  if (r !== 'ok') return;
  const msg = document.getElementById('bn-msg')?.value.trim()||'';
  let img = banner.image_url||'';
  const f = document.getElementById('bn-img')?.files?.[0];
  if(f){try{img=await uploadImage(f);}catch(e){toast('上传失败','error');return;}}
  const sb = getSupabase();
  await sb.from('banner').upsert({id:1,message:msg,image_url:img},{onConflict:'id'});
  document.getElementById('chef-banner-edit').textContent = msg ? '📢✓' : '📢';
  toast('已更新','success');
}

// ===== Dish Form =====
async function showDishForm(dish=null) {
  const isEdit = !!dish;
  const html = `<div class="form-g"><label>菜名 *</label><input id="df-name" value="${dish?.name||''}" required/></div>
    <div class="form-g"><label>分类</label><select id="df-cat">${CONFIG.CATEGORIES.map(c=>`<option value="${c}" ${c===(dish?.category||CONFIG.CATEGORIES[0])?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="form-g"><label>食材</label><input id="df-ingr" value="${dish?.ingredients||''}" placeholder="猪肉, 青椒, 蒜"/></div>
    <div class="form-g"><label>时间(分钟)</label><select id="df-time">${CONFIG.COOKING_TIMES.map(t=>`<option value="${t}" ${t===(dish?.cooking_time||15)?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="form-g"><label>价格 ¥</label><input id="df-price" type="number" value="${dish?.price||0}" placeholder="0"/></div>
    <div class="form-g"><label>步骤 (每行一步)</label><textarea id="df-steps" rows="6" placeholder="1. 焯水&#10;2. 炒糖色&#10;3. 炖煮">${dish?.steps||''}</textarea></div>
    <div class="form-g"><label>图片</label><input type="file" id="df-img" accept="image/*"/>${dish?.image_url?`<div class="form-img-preview"><img src="${dish.image_url}"/></div>`:''}</div>`;
  const r = await modal(isEdit?'编辑菜品':'➕ 添加菜品', html, [{text:'取消',value:'cancel'},{text:isEdit?'保存':'添加',value:'ok',cls:'btn-primary'}]);
  if (r !== 'ok') return;
  const name = document.getElementById('df-name')?.value.trim();
  if (!name) { toast('请输入菜名','error'); return; }
  const payload = {
    name, category: document.getElementById('df-cat')?.value,
    ingredients: document.getElementById('df-ingr')?.value.trim()||'',
    cooking_time: parseInt(document.getElementById('df-time')?.value)||15,
    price: parseInt(document.getElementById('df-price')?.value)||0,
    steps: document.getElementById('df-steps')?.value.trim()||'',
    is_active: true
  };
  let img = dish?.image_url||'';
  const f = document.getElementById('df-img')?.files?.[0];
  if(f){try{img=await uploadImage(f);}catch(e){toast('上传失败','error');return;}}
  payload.image_url = img;
  const sb = getSupabase();
  if(isEdit){await sb.from('dishes').update(payload).eq('id',dish.id);toast('已更新','success');}
  else {await sb.from('dishes').insert(payload);toast('新菜上架！','success');}
  await loadDishes(); renderSidebar(); renderDishList(activeCat);
}

async function deleteDish(dish) {
  const r = await modal('删除',`确定删除「${dish.name}」？`, [{text:'取消',value:'cancel'},{text:'删除',value:'ok',cls:'btn-danger'}]);
  if(r!=='ok')return;
  await getSupabase().from('dishes').update({is_active:false}).eq('id',dish.id);
  toast('已删除','success'); await loadDishes(); renderSidebar(); renderDishList(activeCat);
}

function renderPendingBadge() {
  const badge = document.getElementById('chef-pending-count');
  if(!badge)return; const cnt = store.orders.filter(o=>o.status==='pending').length;
  badge.textContent = cnt; badge.style.display = cnt>0?'flex':'none';
}

async function uploadImage(file) {
  const sb = getSupabase(); const ext = file.name.split('.').pop();
  const fn = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await sb.storage.from('dish-images').upload(fn,file,{cacheControl:'3600',upsert:false});
  return sb.storage.from('dish-images').getPublicUrl(fn).data.publicUrl;
}
