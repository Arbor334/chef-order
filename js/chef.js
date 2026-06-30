// ============================================================
// 厨师端 v6
// ============================================================
import { CONFIG } from '../config.js';
import { getSupabase } from './supabase.js';
import { store, loadDishes, loadOrders, subscribeOrders, loadBanner } from './store.js';
import { toast, modal } from './ui.js';
import { DISH_EMOJI, catGradient } from './shared.js';

let activeCat = CONFIG.CATEGORIES[0];

export async function initChefPage() {
  await loadDishes();
  await loadOrders({ status: 'pending' });
  await renderBanner();
  renderSidebar();
  renderDishList(activeCat);

  // ⚡ onclick 天然替换，永不重复叠加
  document.getElementById('chef-sidebar').onclick = e => {
    const item = e.target.closest('.sidebar-cat');
    if (!item) return;
    activeCat = item.dataset.cat;
    renderSidebar();
    renderDishList(activeCat);
  };

  document.getElementById('chef-main').onclick = e => {
    const editBtn = e.target.closest('.edit-btn');
    const delBtn = e.target.closest('.del-btn');
    const card = e.target.closest('.chef-card');
    if (!card) return;
    const dish = store.dishes.find(d => d.id === card.dataset.id);
    if (!dish) return;
    if (editBtn) { showDishForm(dish); return; }
    if (delBtn) { deleteDish(dish); return; }
  };

  document.getElementById('chef-fab').onclick = () => showDishForm();
  document.getElementById('chef-banner-edit').onclick = () => showBannerForm();
  document.getElementById('cust-banner').onclick = () => showBannerForm();
  document.getElementById('cust-banner').style.cursor = 'pointer';

  subscribeOrders(() => { loadOrders({ status: 'pending' }).then(renderPendingBadge); });
  renderPendingBadge();
}

// ===== Banner =====
async function renderBanner() {
  try {
    const b = await loadBanner();
    const m = document.getElementById('cust-banner-msg');
    const g = document.getElementById('cust-banner-bg');
    if (!m || !g) return;
    const hasMsg = b.message && b.message.trim();
    const hasImg = b.image_url && b.image_url.length > 10;
    m.textContent = hasMsg ? b.message : '今天想吃点什么？';
    if (hasImg) {
      g.style.backgroundImage = `url(${b.image_url})`;
      g.classList.add('has-bg');
    } else {
      g.style.backgroundImage = '';
      g.classList.remove('has-bg');
    }
    document.getElementById('cust-banner').style.display = '';
  } catch (_) {}
}

async function showBannerForm() {
  let banner = { message: '', image_url: '' };
  try { banner = await loadBanner(); } catch (_) { }
  const html = `<div class="form-g"><label>今天想对她说什么</label><textarea id="bn-msg" rows="3" placeholder="比如：今天做了红烧肉~">${banner.message||''}</textarea></div>
    <div class="form-g"><label>背景图</label><input type="file" id="bn-img" accept="image/*"/>${banner.image_url?`<div class="form-img-preview"><img src="${banner.image_url}"/></div>`:''}</div>`;
  const result = await modal('📢 每日示爱', html, [{ text: '取消', value: 'no' }, { text: '保存并推送 💌', value: 'ok', cls: 'btn-primary' }]);
  // 必须在 remove 之前读取表单
  const msg = result.overlay.querySelector('#bn-msg')?.value?.trim() || '';
  let img = banner.image_url || '';
  const f = result.overlay.querySelector('#bn-img')?.files?.[0];
  result.overlay.remove();
  if (result.value !== 'ok') return;
  console.log('[banner] saving:', msg, f?.name, img);
  if (f) { try { img = await uploadImage(f); } catch (e) { toast('上传失败','error'); return; } }
  const sb = getSupabase();
  // 先删后插，避免 upsert 冲突问题
  await sb.from('banner').delete().neq('id', 0);
  const { error } = await sb.from('banner').insert({ id: 1, message: msg, image_url: img });
  if (error) { console.error('[banner]', error); toast('保存失败: ' + error.message, 'error'); return; }
  await renderBanner();
  toast('已推送 💌', 'success');
}

// ===== Sidebar =====
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
  el.innerHTML = `<div class="dish-list">${dishes.map(d => {
    const emoji = DISH_EMOJI[d.name]||CONFIG.CATEGORY_ICONS[d.category]||'🍽️';
    const hasImg = d.image_url&&d.image_url.length>10;
    const steps = d.steps?d.steps.split('\n').filter(s=>s.trim()):[];
    const ingr = d.ingredients?d.ingredients.split(',').map(s=>s.trim()).filter(Boolean):[];
    return `<div class="chef-card" data-id="${d.id}">
      <div class="chef-card-img" style="background:${catGradient(d.category)};">${hasImg?`<img src="${d.image_url}" alt="${d.name}"/>`:emoji}</div>
      <div class="chef-card-body">
        <div class="chef-card-title">${d.name}</div>
        ${ingr.length?`<div class="chef-card-desc">${ingr.slice(0,4).join(' · ')}</div>`:''}
        <div class="chef-card-meta"><span class="chef-card-tag accent">⏱${d.cooking_time||15}min</span><span class="chef-card-tag">📝${steps.length}步</span><span class="chef-card-tag">🛒${ingr.length}种</span></div>
        <div class="chef-card-bottom"><span class="chef-card-price">${d.price?'¥'+d.price:''}</span></div>
      </div>
      <div class="chef-card-actions"><button class="edit-btn">✏️</button><button class="del-btn">🗑️</button></div>
    </div>`;
  }).join('')}</div>`;
}

// ===== Form =====
async function showDishForm(dish=null) {
  const isEdit = !!dish;
  const html = `<div class="form-g"><label>菜名 *</label><input id="df-name" value="${dish?.name||''}" required/></div>
    <div class="form-g"><label>分类</label><select id="df-cat">${CONFIG.CATEGORIES.map(c=>`<option value="${c}" ${c===(dish?.category||CONFIG.CATEGORIES[0])?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="form-g"><label>食材(逗号分隔)</label><input id="df-ingr" value="${dish?.ingredients||''}" placeholder="猪肉, 青椒"/></div>
    <div class="form-g"><label>时间(分钟)</label><select id="df-time">${CONFIG.COOKING_TIMES.map(t=>`<option value="${t}" ${t===(dish?.cooking_time||15)?'selected':''}>${t}min</option>`).join('')}</select></div>
    <div class="form-g"><label>价格 ¥</label><input id="df-price" type="number" value="${dish?.price||0}"/></div>
    <div class="form-g"><label>步骤(每行一步)</label><textarea id="df-steps" rows="6" placeholder="1. 焯水&#10;2. 炒香&#10;3. 炖煮">${dish?.steps||''}</textarea></div>
    <div class="form-g"><label>图片</label><input type="file" id="df-img" accept="image/*"/>${dish?.image_url?`<div class="form-img-preview"><img src="${dish.image_url}"/></div>`:''}</div>`;
  const result = await modal(isEdit?'编辑菜品':'➕ 添加菜品', html, [{text:'取消',value:'no'},{text:isEdit?'保存':'添加',value:'ok',cls:'btn-primary'}]);
  if (result.value !== 'ok') { result.overlay.remove(); return; }
  const name = result.overlay.querySelector('#df-name')?.value?.trim();
  if (!name) { toast('请输入菜名','error'); result.overlay.remove(); return; }
  const payload = {
    name, category:result.overlay.querySelector('#df-cat')?.value,
    ingredients:result.overlay.querySelector('#df-ingr')?.value?.trim()||'',
    cooking_time:parseInt(result.overlay.querySelector('#df-time')?.value)||15,
    price:parseInt(result.overlay.querySelector('#df-price')?.value)||0,
    steps:result.overlay.querySelector('#df-steps')?.value?.trim()||'',
    is_active:true
  };
  let img = dish?.image_url||'';
  const f = result.overlay.querySelector('#df-img')?.files?.[0];
  result.overlay.remove();
  if (f) { try { img = await uploadImage(f); } catch (e) { toast('上传失败','error'); return; } }
  if (isEdit) { await sb.from('dishes').update(payload).eq('id',dish.id); toast('已更新','success'); }
  else { await sb.from('dishes').insert(payload); toast('新菜上架！','success'); }
  await loadDishes(); renderSidebar(); renderDishList(activeCat);
}

async function deleteDish(dish) {
  const result = await modal('删除',`确定删除「${dish.name}」？`,[{text:'取消',value:'no'},{text:'删除',value:'ok',cls:'btn-danger'}]);
  result.overlay.remove();
  if (result.value !== 'ok') return;
  await getSupabase().from('dishes').update({is_active:false}).eq('id',dish.id);
  toast('已删除'); await loadDishes(); renderSidebar(); renderDishList(activeCat);
}

function renderPendingBadge() {
  const b = document.getElementById('chef-pending-count');
  if(!b)return; const c = store.orders.filter(o=>o.status==='pending').length;
  b.textContent=c; b.style.display=c>0?'flex':'none';
}

async function uploadImage(file) {
  const sb = getSupabase(); const ext = file.name.split('.').pop();
  const fn = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await sb.storage.from('dish-images').upload(fn,file,{cacheControl:'3600',upsert:false});
  return sb.storage.from('dish-images').getPublicUrl(fn).data.publicUrl;
}
