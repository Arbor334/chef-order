-- ============================================================
-- ChefOrder — Supabase 建表语句
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

-- 1. 菜品表
CREATE TABLE public.dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  image_url text,
  ingredients text,
  cooking_time integer DEFAULT 15,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

-- 2. 订单表
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid REFERENCES public.dishes ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users DEFAULT auth.uid(),
  status text DEFAULT 'pending',
  note text,
  created_at timestamptz DEFAULT now()
);

-- 3. 收藏表
CREATE TABLE public.favorites (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  dish_id uuid REFERENCES public.dishes ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, dish_id)
);

-- 4. 启用 RLS (行级安全)
ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- 5. 策略: 菜品 (任何人可看，只有厨师可改)
CREATE POLICY "Dishes viewable by all" ON public.dishes FOR SELECT USING (true);
CREATE POLICY "Dishes insertable by chef" ON public.dishes FOR INSERT WITH CHECK (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'chef'
);
CREATE POLICY "Dishes updatable by chef" ON public.dishes FOR UPDATE USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'chef'
);

-- 6. 策略: 订单 (厨师看全部，用户看自己的)
CREATE POLICY "Orders viewable by owner or chef" ON public.orders FOR SELECT USING (
  customer_id = auth.uid() OR
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'chef'
);
CREATE POLICY "Orders insertable by all" ON public.orders FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Orders updatable by chef" ON public.orders FOR UPDATE USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'chef'
);

-- 7. 策略: 收藏 (看自己的)
CREATE POLICY "Favorites viewable by owner" ON public.favorites FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Favorites insertable by owner" ON public.favorites FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Favorites deletable by owner" ON public.favorites FOR DELETE USING (user_id = auth.uid());

-- 8. 启用实时订阅 (REPLICA IDENTITY FULL 确保 UPDATE/DELETE 事件包含完整行)
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.dishes REPLICA IDENTITY FULL;

-- 9. 开启 Publication 实时推送
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.orders, public.dishes;
COMMIT;

-- 10. 创建 Storage bucket (在 Supabase UI → Storage 中手动创建名为 dish-images 的 bucket)
-- 设为 Public bucket

-- 11. Storage 策略 (在 Supabase UI → Storage → Policies 中设置)
-- dish-images bucket: INSERT 允许 authenticated, SELECT 允许所有
/*
CREATE POLICY "Dish images insertable by authenticated"
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'dish-images' AND auth.role() = 'authenticated'
);
CREATE POLICY "Dish images viewable by all"
ON storage.objects FOR SELECT USING (bucket_id = 'dish-images');
*/
