// ============================================================
// Supabase 客户端 + Auth
// ============================================================
import { CONFIG } from '../config.js';

let _sb = null;
export function getSupabase() {
  if (!_sb) {
    const { createClient } = window.supabase;
    _sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return _sb;
}

// 当前用户
let _user = null;
let _profile = null;

export function getUser() { return _user; }
export function getProfile() { return _profile; }

// 注册（需要邀请码）
export async function signUp(email, password, role, inviteCode) {
  if (inviteCode !== CONFIG.INVITE_CODE) {
    throw new Error('邀请码不正确');
  }
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { role } }
  });
  if (error) throw error;
  // 需要邮箱确认的话在这里处理
  return data;
}

// 登录
export async function signIn(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  _user = data.user;
  _profile = { role: data.user.user_metadata?.role || 'customer' };
  return _profile;
}

// 登出
export async function signOut() {
  const sb = getSupabase();
  await sb.auth.signOut();
  _user = null;
  _profile = null;
  location.hash = '#login';
}

// 监听认证状态变化
export function onAuthChange(cb) {
  getSupabase().auth.onAuthStateChange((event, session) => {
    _user = session?.user || null;
    _profile = _user ? { role: _user.user_metadata?.role || 'customer' } : null;
    cb(_user, _profile);
  });
}

// 初始化：检查是否已登录
export async function initAuth() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    _user = session.user;
    _profile = { role: session.user.user_metadata?.role || 'customer' };
  }
  return _profile;
}
