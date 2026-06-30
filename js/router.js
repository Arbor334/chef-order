// ============================================================
// 简易 Hash 路由
// ============================================================
import { getUser, getProfile } from './supabase.js';
import { loadDishes, loadOrders, loadFavorites, subscribeOrders, subscribeDishes } from './store.js';

const routes = {};

export function route(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  location.hash = path;
}

async function handleRoute() {
  const hash = location.hash.slice(1) || 'login';
  const [path, ...params] = hash.split('/');

  const app = document.getElementById('app');
  const user = getUser();
  const profile = getProfile();

  // 未登录强制跳转
  if (path !== 'login' && !user) {
    location.hash = '#login';
    return;
  }

  // 已登录访问 login 跳转到首页
  if (path === 'login' && user) {
    location.hash = profile?.role === 'chef' ? '#chef' : '#customer';
    return;
  }

  // 隐藏所有页面
  app.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

  let page;
  if (routes[path]) {
    page = await routes[path](...params);
  } else {
    page = document.getElementById(`page-${path}`);
  }

  if (page) {
    page.classList.remove('hidden');
  }
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  // 初始加载
  if (!location.hash) location.hash = '#login';
  handleRoute();
}
