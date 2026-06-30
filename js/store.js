// ============================================================
// 全局响应式状态管理 (Pub/Sub, 零依赖)
// ============================================================

const listeners = new Map();

export const store = {
  dishes: [],           // 所有菜品
  orders: [],           // 当前订单
  favorites: new Set(), // 收藏菜品 ID 集合
  view: 'chef',         // 当前视图
};

// 订阅状态变化
export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

// 触发事件
export function emit(event, data) {
  const fns = listeners.get(event);
  if (fns) fns.forEach(fn => fn(data));
}

// 批量更新 store
export function update(partial) {
  Object.assign(store, partial);
  emit('change', partial);
}

// --- 数据操作 ---

import { getSupabase } from './supabase.js';

// 加载菜品列表
export async function loadDishes() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('dishes')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('created_at', { ascending: false });
  if (error) throw error;
  store.dishes = data || [];
  emit('dishes-loaded', store.dishes);
  return store.dishes;
}

// 加载订单
export async function loadOrders(filter = {}) {
  const sb = getSupabase();
  let q = sb.from('orders').select('*, dishes(*)').order('created_at', { ascending: false });
  if (filter.status) q = q.eq('status', filter.status);
  if (filter.customer) q = q.eq('customer_id', filter.customer);
  const { data, error } = await q;
  if (error) throw error;
  store.orders = data || [];
  emit('orders-loaded', store.orders);
  return store.orders;
}

// 加载收藏
export async function loadFavorites(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('favorites')
    .select('dish_id')
    .eq('user_id', userId);
  if (error) throw error;
  store.favorites = new Set(data?.map(f => f.dish_id) || []);
  emit('favorites-loaded', store.favorites);
  return store.favorites;
}

// 实时订阅：订单变更
let _orderSub = null;
export function subscribeOrders(callback) {
  const sb = getSupabase();
  if (_orderSub) _orderSub.unsubscribe();
  _orderSub = sb.channel('orders-realtime')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      payload => {
        // 重新加载订单以保证数据一致
        loadOrders().then(() => callback?.(payload));
      }
    )
    .subscribe();
}

// 实时订阅：菜品变更
let _dishSub = null;
export function subscribeDishes(callback) {
  const sb = getSupabase();
  if (_dishSub) _dishSub.unsubscribe();
  _dishSub = sb.channel('dishes-realtime')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'dishes' },
      () => {
        loadDishes().then(() => callback?.());
      }
    )
    .subscribe();
}

export function unsubscribeAll() {
  _orderSub?.unsubscribe();
  _dishSub?.unsubscribe();
}
