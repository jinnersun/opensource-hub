-- ============================================
-- 迁移 003: categories 表增加 color 和 lucide_icon 字段
-- ============================================

ALTER TABLE categories ADD COLUMN color TEXT;
ALTER TABLE categories ADD COLUMN lucide_icon TEXT;

-- 更新现有分类的颜色和图标
UPDATE categories SET
  color = 'from-blue-500 to-cyan-500',
  lucide_icon = 'Wrench'
WHERE slug = 'system';

UPDATE categories SET
  color = 'from-violet-500 to-purple-500',
  lucide_icon = 'Brain'
WHERE slug = 'ai';

UPDATE categories SET
  color = 'from-rose-500 to-pink-500',
  lucide_icon = 'Video'
WHERE slug = 'video';

UPDATE categories SET
  color = 'from-sky-500 to-blue-500',
  lucide_icon = 'HardDrive'
WHERE slug = 'clean-install';

UPDATE categories SET
  color = 'from-orange-500 to-amber-500',
  lucide_icon = 'Code'
WHERE slug = 'dev-tools';

UPDATE categories SET
  color = 'from-emerald-500 to-teal-500',
  lucide_icon = 'ShieldCheck'
WHERE slug = 'privacy';

UPDATE categories SET
  color = 'from-indigo-500 to-violet-500',
  lucide_icon = 'FolderOpen'
WHERE slug = 'file-management';

UPDATE categories SET
  color = 'from-pink-500 to-rose-500',
  lucide_icon = 'Palette'
WHERE slug = 'design';

UPDATE categories SET
  color = 'from-amber-500 to-yellow-500',
  lucide_icon = 'FileText'
WHERE slug = 'office';
