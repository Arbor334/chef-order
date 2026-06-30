// ============================================================
// ChefOrder 配置文件 — 所有可变项集中在这里
// 修改菜单分类、状态名、烹饪时间等无需改逻辑代码
// ============================================================

export const CONFIG = {
  // 菜品分类
  CATEGORIES: ['荤菜', '素菜', '汤品', '凉菜', '主食', '小吃', '饮品'],

  // 订单状态
  ORDER_STATUSES: ['pending', 'cooking', 'done', 'cancelled'],
  STATUS_LABELS: {
    pending: '待做',
    cooking: '做菜中',
    done: '已完成',
    cancelled: '已取消'
  },
  STATUS_COLORS: {
    pending: '#f59e0b',
    cooking: '#ef4444',
    done: '#22c55e',
    cancelled: '#9ca3af'
  },

  // 烹饪时间选项（分钟）
  COOKING_TIMES: [5, 10, 15, 20, 30, 45, 60],

  // 菜品每页数量
  DISHES_PER_PAGE: 20,

  // App 名称
  APP_NAME: 'ChefOrder',
  APP_SHORT: '点菜',
  APP_DESC: '专属厨房点单系统',
  APP_THEME: '#ff6b35',  // 主题色（橙色系,有食欲）

  // 图片上传限制
  MAX_IMAGE_SIZE_MB: 2,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],

  // ============================================================
  // Supabase 配置 — 部署前填入你自己的项目信息
  // 在 https://supabase.com 创建免费项目后获取
  // ============================================================
  SUPABASE_URL: 'https://yglivzrefnffbpntcbqp.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbGl2enJlZm5mZmJwbnRjYnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MTc3MjMsImV4cCI6MjA5ODM5MzcyM30.gfJVLf72Zc8jov7_NDplhmYNMCM5MbEtr_hFgtEawKU',

  // 邀请码（注册时验证，防止外人进入）
  INVITE_CODE: 'chef2024',
};
