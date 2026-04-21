-- ============================================
-- OpenSource-Hub 示例数据
-- 用于开发和测试
-- ============================================

-- 插入示例应用 (OBS Studio)
INSERT OR IGNORE INTO apps (id, name, slug, description, full_description, category, tags, github_url, github_owner, github_repo, license, homepage_url, is_featured, status, stars_count, last_updated) VALUES
    ('app_001', 'OBS Studio', 'obs-studio', '免费开源的视频录制和直播软件', 'OBS Studio 是一款免费开源的视频录制和实时流媒体软件。它提供了强大的场景切换、滤镜、音频混合等功能，广泛应用于游戏直播、在线教学和视频会议。', 'video', '["直播", "录屏", "视频制作", "在线教育"]', 'https://github.com/obsproject/obs-studio', 'obsproject', 'obs-studio', 'GPL-2.0', 'https://obsproject.com', 1, 'active', 65000, '2026-04-15 10:00:00');

-- 插入 OBS 版本信息
INSERT OR IGNORE INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, sha256, release_date, is_stable) VALUES
    ('ver_001', 'app_001', '30.1.2', 'windows', 'x64', 'exe', 'OBS-Studio-30.1.2-Full-Installer-x64.exe', 134217728, 'https://github.com/obsproject/obs-studio/releases/download/30.1.2/OBS-Studio-30.1.2-Full-Installer-x64.exe', 'abc123def456...', '2026-04-10 08:00:00', 1),
    ('ver_002', 'app_001', '30.1.2', 'windows', 'x64', 'zip', 'OBS-Studio-30.1.2-Portable-x64.zip', 125829120, 'https://github.com/obsproject/obs-studio/releases/download/30.1.2/OBS-Studio-30.1.2-Portable-x64.zip', 'def789ghi012...', '2026-04-10 08:00:00', 1),
    ('ver_003', 'app_001', '30.1.2', 'macos', 'universal', 'dmg', 'OBS-Studio-30.1.2-macOS.dmg', 142606336, 'https://github.com/obsproject/obs-studio/releases/download/30.1.2/OBS-Studio-30.1.2-macOS.dmg', 'ghi345jkl678...', '2026-04-10 08:00:00', 1);

-- 插入 OBS AI 内容
INSERT OR IGNORE INTO app_ai_content (id, app_id, summary, what_it_does, what_it_cant_do, use_cases, quick_start_guide, is_portable, requirements, has_registry_residual, confidence_score, needs_human_review) VALUES
    ('ai_001', 'app_001', 
     '一句话: 免费的直播和录屏神器，主播和UP主都在用',
     
     '能帮你做什么:
- 录制电脑屏幕和游戏画面
- 直播到 Twitch、YouTube、B站等平台
- 多场景切换 (游戏画面、摄像头、PPT)
- 实时滤镜和美颜
- 音频混合和降噪',
     
     '不能做什么:
- 不能直接剪辑视频 (需要配合剪映、PR等)
- 不会自动优化直播画质 (需要自己调参数)
- 不支持移动端推流',
     
     '["游戏直播", "在线教学", "会议录屏", "视频教程制作"]',
     
     '一分钟上手:
1. 下载安装后打开
2. 点击"来源"下面的"+"添加画面捕获
3. 选择"显示器捕获"或"游戏捕获"
4. 点击"开始录制"或"开始直播"
5. 完成！文件默认保存在"视频"文件夹',
     
     0,  -- 非绿色版 (需要安装)
     '{"runtime": "无需额外运行库", "os_version": "Windows 10 或更高版本"}',
     0,  -- 卸载干净，无残留
     0.95,
     0); -- 无需人工审核

-- 插入 OBS 安全信息
INSERT OR IGNORE INTO app_security (id, app_id, version_id, sha256, virustotal_url, virustotal_score, audit_status, scanned_at) VALUES
    ('sec_001', 'app_001', 'ver_001', 'abc123def456...', 'https://www.virustotal.com/gui/file/xxx', 0, 'passed', '2026-04-10 10:00:00');

-- 插入示例应用 2 (Rufus)
INSERT OR IGNORE INTO apps (id, name, slug, description, category, tags, github_url, github_owner, github_repo, license, is_featured, status, stars_count, last_updated) VALUES
    ('app_002', 'Rufus', 'rufus', '制作 USB 启动盘的终极工具', 'clean-install', '["U盘启动", "系统安装", "PE制作"]', 'https://github.com/pbatard/rufus', 'pbatard', 'rufus', 'GPL-3.0', 1, 'active', 28000, '2026-04-12 14:00:00');

INSERT OR IGNORE INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, is_stable) VALUES
    ('ver_004', 'app_002', '4.5', 'windows', 'x64', 'exe', 'rufus-4.5.exe', 1258291, 'https://github.com/pbatard/rufus/releases/download/v4.5/rufus-4.5.exe', 1);

INSERT OR IGNORE INTO app_ai_content (id, app_id, summary, what_it_does, quick_start_guide, is_portable, requirements, has_registry_residual, confidence_score) VALUES
    ('ai_002', 'app_002',
     '一句话: 3秒制作系统安装U盘，比官方工具快10倍',
     
     '能帮你做什么:
- 制作 Windows/Linux 安装U盘
- 创建 PE 急救盘
- 烧录 ISO 镜像到U盘
- 自动格式化U盘',
     
     '一分钟上手:
1. 插入U盘 (注意: 会清空U盘!)
2. 打开 Rufus
3. 选择下载好的 ISO 文件
4. 点击"开始"
5. 等待完成，搞定！',
     
     1,  -- 绿色版 (单文件)
     '{"runtime": "无需运行库"}',
     0,
     0.98);

-- 插入示例下载统计
INSERT OR IGNORE INTO download_stats (id, app_id, stat_date, download_count, unique_visitors) VALUES
    ('stat_001', 'app_001', '2026-04-19', 1250, 980),
    ('stat_002', 'app_001', '2026-04-18', 1180, 920),
    ('stat_003', 'app_002', '2026-04-19', 890, 750);

-- 插入示例搜索分析
INSERT OR IGNORE INTO search_analytics (id, search_query, result_count, has_results, search_count, last_searched) VALUES
    ('search_001', '录屏软件', 5, 1, 320, '2026-04-20 09:30:00'),
    ('search_002', '视频剪辑', 3, 1, 280, '2026-04-20 10:15:00'),
    ('search_003', 'PDF编辑器', 0, 0, 150, '2026-04-20 08:45:00'),
    ('search_004', '直播推流', 4, 1, 95, '2026-04-19 22:10:00');
