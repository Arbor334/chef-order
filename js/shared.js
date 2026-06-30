// ============================================================
// 共享数据 — 菜品表情映射 & 分类渐变色
// ============================================================

export const DISH_EMOJI = {
  '红烧肉':'🍖','麻婆豆腐':'🌶️','糖醋排骨':'🦴','可乐鸡翅':'🍗','酸菜鱼':'🐟',
  '清炒时蔬':'🥬','番茄炒蛋':'🍅','蒜蓉西兰花':'🥦',
  '酸辣汤':'🥣',
  '凉拌黄瓜':'🥒','皮蛋豆腐':'🫘',
  '蛋炒饭':'🍚',
};

export function catGradient(cat) {
  const map = {
    '荤菜': 'linear-gradient(135deg, #fce4e4 0%, #f8d0d0 100%)',
    '素菜': 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
    '汤品': 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
    '凉菜': 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
    '主食': 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)',
    '小吃': 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
    '饮品': 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
  };
  const k = Object.keys(map).find(k => cat.startsWith(k));
  return map[k] || map['荤菜'];
}
