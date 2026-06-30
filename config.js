// ============================================================
// ChefOrder 配置文件 v3 — 美团风格分类
// ============================================================

export const CONFIG = {
  // 菜品分类
  CATEGORIES: ['猪肉', '牛肉', '羊肉', '鸡肉', '素菜', '海鲜', '火锅', '汤品', '凉菜', '主食', '小吃', '饮品'],

  // 分类图标
  CATEGORY_ICONS: {
    '猪肉': '🐷', '牛肉': '🐮', '羊肉': '🐑', '鸡肉': '🐔',
    '素菜': '🥬', '海鲜': '🦐', '火锅': '🔥',
    '汤品': '🥣', '凉菜': '🥒', '主食': '🍚', '小吃': '🧆', '饮品': '🍹'
  },

  // 火锅特殊分类（标识用）
  HOTPOT_CATEGORY: '火锅',

  // 三餐
  MEAL_TYPES: ['breakfast', 'lunch', 'dinner'],
  MEAL_LABELS: { breakfast: '🌅 早餐', lunch: '☀️ 午餐', dinner: '🌙 晚餐' },

  // 订单状态
  ORDER_STATUSES: ['pending', 'cooking', 'done', 'cancelled'],
  STATUS_LABELS: { pending: '待做', cooking: '做菜中', done: '已完成', cancelled: '已取消' },
  STATUS_COLORS: { pending: '#f59e0b', cooking: '#ef4444', done: '#22c55e', cancelled: '#9ca3af' },

  COOKING_TIMES: [1, 3, 5, 8, 10, 15, 20, 30, 45, 60],
  DISHES_PER_PAGE: 20,

  APP_NAME: 'ChefOrder',
  APP_SHORT: '点菜',
  APP_DESC: '专属厨房点单系统',
  APP_THEME: '#ff6b35',

  MAX_IMAGE_SIZE_MB: 3,

  SUPABASE_URL: 'https://yglivzrefnffbpntcbqp.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbGl2enJlZm5mZmJwbnRjYnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MTc3MjMsImV4cCI6MjA5ODM5MzcyM30.gfJVLf72Zc8jov7_NDplhmYNMCM5MbEtr_hFgtEawKU',
  INVITE_CODE: 'chef2024',
};
