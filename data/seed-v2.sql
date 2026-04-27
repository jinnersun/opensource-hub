-- ============================================
-- OpenSource-Hub 种子数据 V2
-- 覆盖 9 个分类，每分类 3-6 个精选项目
-- 导入方式: wrangler d1 execute opensource-hub-db --file data/seed-v2.sql --remote
-- ============================================

-- 先清空旧数据（保留 categories 和 system_config）
DELETE FROM app_ai_content;
DELETE FROM app_security;
DELETE FROM app_versions;
DELETE FROM apps;

-- ============================================
-- 分类: system (系统调优)
-- ============================================

INSERT INTO apps (id, name, slug, description, full_description, category, tags, github_url, github_owner, github_repo, license, homepage_url, is_featured, status, stars_count, last_updated) VALUES
('app_sys_01', 'Everything', 'everything', '最快的 Windows 文件搜索工具，秒级定位任何文件', 'Everything 是一款免费的 Windows 文件搜索引擎，通过直接读取 NTFS 磁盘的 MFT（主文件表）实现毫秒级搜索，远超 Windows 自带搜索。支持正则、高级筛选、HTTP 服务器远程搜索。', 'system', '["文件搜索", "效率工具", "NTFS"]', 'https://github.com/voidtools/Everything', 'voidtools', 'Everything', 'MIT', 'https://www.voidtools.com', 1, 'active', 8500, '2026-03-20'),

('app_sys_02', 'PowerToys', 'powertoys', '微软官方出品的 Windows 增强工具箱', 'Microsoft PowerToys 是微软官方推出的免费系统增强工具集，包含窗口管理器 (FancyZones)、颜色拾取器、批量重命名、快捷键指南等 20+ 实用小工具，让 Windows 更好用。', 'system', '["窗口管理", "颜色拾取", "批量重命名", "快捷键"]', 'https://github.com/microsoft/PowerToys', 'microsoft', 'PowerToys', 'MIT', 'https://github.com/microsoft/PowerToys', 1, 'active', 112000, '2026-04-15'),

('app_sys_03', 'Dism++', 'dismpp', 'Windows 系统精简与优化利器', 'Dism++ 是一款免费的 Windows 系统管理工具，集系统精简、备份还原、驱动管理于一体。支持移除 Windows 内置应用、清理 WinSxS 组件、系统热备份。', 'system', '["系统精简", "备份还原", "驱动管理"]', 'https://github.com/CodingOctocat/Dism-Multi-Toolbox', 'CodingOctocat', 'Dism-Multi-Toolbox', 'MIT', NULL, 0, 'active', 5200, '2026-02-10'),

('app_sys_04', 'TrafficMonitor', 'trafficmonitor', '任务栏网速监控与硬件信息显示', 'TrafficMonitor 是一款轻量级的 Windows 网速监控工具，可以在任务栏或桌面悬浮窗实时显示当前网速、CPU 和内存占用率。还支持更换皮肤和显示硬件温度。', 'system', '["网速监控", "硬件监控", "任务栏"]', 'https://github.com/zhongyang219/TrafficMonitor', 'zhongyang219', 'TrafficMonitor', 'GPL-3.0', 'https://github.com/zhongyang219/TrafficMonitor', 0, 'active', 14000, '2026-03-01');

INSERT INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, is_stable) VALUES
('ver_sys_01', 'app_sys_01', '1.4.1', 'windows', 'x64', 'exe', 'Everything-1.4.1.1024.x64-Setup.exe', 1800000, 'https://www.voidtools.com/Everything-1.4.1.1024.x64-Setup.exe', 1),
('ver_sys_02', 'app_sys_02', '0.84.0', 'windows', 'x64', 'exe', 'PowerToysSetup-0.84.0-x64.exe', 85000000, 'https://github.com/microsoft/PowerToys/releases/download/v0.84.0/PowerToysSetup-0.84.0-x64.exe', 1),
('ver_sys_03', 'app_sys_04', '1.84', 'windows', 'x64', 'zip', 'TrafficMonitor_V1.84_x64.zip', 5200000, 'https://github.com/zhongyang219/TrafficMonitor/releases/download/V1.84/TrafficMonitor_V1.84_x64.zip', 1);

INSERT INTO app_ai_content (id, app_id, summary, what_it_does, what_it_cant_do, use_cases, quick_start_guide, is_portable, requirements, requirement_links, uninstall_guide, has_registry_residual, confidence_score) VALUES
('ai_sys_01', 'app_sys_01', '秒搜全盘文件，比 Windows 搜索快 100 倍', '能帮你做什么:\n- 输入文件名瞬间搜索全盘\n- 支持正则表达式和高级筛选\n- 支持局域网远程搜索\n- 极低资源占用', '不能做什么:\n- 不能搜索文件内容（需配合 Everything 的 content 索引插件）\n- 仅支持 NTFS 分区', '["快速找文件", "文件整理", "重复文件查找"]', '一分钟上手:\n1. 下载安装后打开\n2. 在搜索框输入文件名关键词\n3. 瞬间看到结果！', 0, '{"runtime": "无需运行库"}', NULL, '控制面板卸载即可，无残留', 0, 0.95),
('ai_sys_02', 'app_sys_02', '微软官方出的 20+ 个 Windows 效率小工具合集', '能帮你做什么:\n- FancyZones 窗口分屏管理\n- 颜色拾取器一键取色\n- PowerRename 批量重命名\n- 快捷键指南随时查\n- 始终置顶窗口\n- 文件预览增强', '不能做什么:\n- 仅支持 Windows 10/11\n- 部分功能需要管理员权限', '["窗口管理", "批量重命名", "颜色拾取"]', '一分钟上手:\n1. 安装后从开始菜单打开 PowerToys\n2. 在左侧选择想启用的工具\n3. 每个工具都有详细设置和快捷键说明', 0, '{"runtime": "需要 Windows 10 1903 或更高版本", "os": "仅 Windows 10/11"}', NULL, '控制面板卸载即可', 0, 0.97),
('ai_sys_04', 'app_sys_04', '在任务栏实时看网速和 CPU 内存占用', '能帮你做什么:\n- 任务栏显示实时网速\n- 桌面悬浮窗显示 CPU/内存/温度\n- 支持自定义皮肤\n- 支持流量统计', '不能做什么:\n- 仅支持 Windows\n- 不能控制网速', '["网速监控", "系统状态", "硬件温度"]', '一分钟上手:\n1. 下载解压后运行 TrafficMonitor.exe\n2. 任务栏即可看到网速\n3. 右键托盘图标可切换显示项', 1, '{"runtime": "无需运行库"}', NULL, '删除文件夹即可，绿色版不留痕迹', 0, 0.93);

INSERT INTO app_security (id, app_id, sha256, virustotal_url, virustotal_score, audit_status) VALUES
('sec_sys_01', 'app_sys_01', 'a1b2c3d4e5f6...', 'https://www.virustotal.com/gui/file/a1b2c3', 0, 'passed'),
('sec_sys_02', 'app_sys_02', 'f6e5d4c3b2a1...', 'https://www.virustotal.com/gui/file/f6e5d4', 0, 'passed'),
('sec_sys_04', 'app_sys_04', '1a2b3c4d5e6f...', NULL, NULL, 'passed');

-- ============================================
-- 分类: ai (AI 生产力)
-- ============================================

INSERT INTO apps (id, name, slug, description, full_description, category, tags, github_url, github_owner, github_repo, license, homepage_url, is_featured, status, stars_count, last_updated) VALUES
('app_ai_01', 'Ollama', 'ollama', '一行命令在本地运行大语言模型', 'Ollama 让你在本地电脑上一键运行各种开源大语言模型（如 Llama 3、Qwen、Mistral），无需云端 API，数据不出本机，隐私安全。支持 GPU 加速和模型量化。', 'ai', '["大模型", "本地AI", "LLM"]', 'https://github.com/ollama/ollama', 'ollama', 'ollama', 'MIT', 'https://ollama.com', 1, 'active', 130000, '2026-04-18'),

('app_ai_02', 'Chatbox', 'chatbox', '多模型 AI 对话客户端，支持 GPT/Claude/Ollama', 'Chatbox 是一款开源的 AI 对话桌面客户端，支持 OpenAI GPT、Claude、Ollama 本地模型等多种 AI 后端。界面简洁美观，支持多轮对话、Markdown 渲染、代码高亮。', 'ai', '["AI对话", "GPT", "Claude", "多模型"]', 'https://github.com/Bin-Huang/chatbox', 'Bin-Huang', 'chatbox', 'GPL-3.0', 'https://chatboxai.app', 0, 'active', 23000, '2026-04-10'),

('app_ai_03', 'Jan', 'jan', '开源的本地 AI 助手，媲美 ChatGPT 体验', 'Jan 是一款完全在本地运行的 AI 助手桌面应用，提供类似 ChatGPT 的对话体验，但所有数据都留在你的电脑上。支持连接远程 API 或使用本地模型。', 'ai', '["本地AI", "隐私", "AI助手"]', 'https://github.com/janhq/jan', 'janhq', 'jan', 'AGPL-3.0', 'https://jan.ai', 0, 'active', 27000, '2026-04-05');

INSERT INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, is_stable) VALUES
('ver_ai_01', 'app_ai_01', '0.6.1', 'windows', 'x64', 'exe', 'OllamaSetup.exe', 180000000, 'https://github.com/ollama/ollama/releases/download/v0.6.1/OllamaSetup.exe', 1),
('ver_ai_01m', 'app_ai_01', '0.6.1', 'macos', 'arm64', 'zip', 'ollama-darwin.zip', 170000000, 'https://github.com/ollama/ollama/releases/download/v0.6.1/ollama-darwin.zip', 1),
('ver_ai_02', 'app_ai_02', '1.3.0', 'windows', 'x64', 'exe', 'Chatbox-1.3.0-Setup.exe', 85000000, 'https://github.com/Bin-Huang/chatbox/releases/download/v1.3.0/Chatbox-1.3.0-Setup.exe', 1),
('ver_ai_03', 'app_ai_03', '0.5.5', 'windows', 'x64', 'exe', 'jan-win-x64-0.5.5.exe', 200000000, 'https://github.com/janhq/jan/releases/download/v0.5.5/jan-win-x64-0.5.5.exe', 1);

INSERT INTO app_ai_content (id, app_id, summary, what_it_does, what_it_cant_do, use_cases, quick_start_guide, is_portable, requirements, uninstall_guide, has_registry_residual, confidence_score) VALUES
('ai_ai_01', 'app_ai_01', '在本地电脑跑 AI 大模型，数据不出门', '能帮你做什么:\n- 一行命令下载和运行大语言模型\n- 支持 Llama 3、Qwen、Mistral 等主流模型\n- 本地推理，无需联网\n- GPU 加速支持', '不能做什么:\n- 需要较好的硬件（建议 16GB 内存以上）\n- 首次下载模型需要联网\n- 没有图形界面，需要命令行操作', '["本地AI", "隐私对话", "离线推理"]', '一分钟上手:\n1. 安装 Ollama\n2. 命令行运行 ollama run llama3\n3. 等待模型下载完成\n4. 开始对话！', 0, '{"runtime": "建议 16GB 内存，有 NVIDIA/AMD GPU 更佳"}', '控制面板卸载即可', 0, 0.92),
('ai_ai_02', 'app_ai_02', '一个客户端搞定所有 AI 对话，GPT/Claude/本地模型都行', '能帮你做什么:\n- 同时管理多个 AI 账号\n- 支持 GPT-4、Claude、Ollama 等多种后端\n- 对话历史本地保存\n- Markdown 渲染和代码高亮', '不能做什么:\n- 不提供 API Key，需要自己准备\n- 不支持图片生成', '["AI对话", "多模型管理", "日常问答"]', '一分钟上手:\n1. 安装后打开 Chatbox\n2. 在设置中填入你的 API Key 或选择 Ollama\n3. 开始对话！', 0, '{"runtime": "无需运行库"}', '控制面板卸载即可', 0, 0.94),
('ai_ai_03', 'app_ai_03', '本地运行的开源 ChatGPT 替代品，隐私至上', '能帮你做什么:\n- 本地运行 AI 对话\n- 类 ChatGPT 的友好界面\n- 支持连接远程 API\n- 模型一键下载和管理', '不能做什么:\n- 本地模型需要较好的硬件\n- 首次使用需下载模型\n- 部分高级功能仍在开发中', '["隐私AI", "离线对话", "模型管理"]', '一分钟上手:\n1. 安装后打开 Jan\n2. 从模型市场下载一个模型\n3. 开始对话！', 0, '{"runtime": "建议 16GB 内存"}', '控制面板卸载即可', 0, 0.91);

-- ============================================
-- 分类: video (影音处理)
-- ============================================

INSERT INTO apps (id, name, slug, description, full_description, category, tags, github_url, github_owner, github_repo, license, homepage_url, is_featured, status, stars_count, last_updated) VALUES
('app_vid_01', 'OBS Studio', 'obs-studio', '免费开源的视频录制和直播软件', 'OBS Studio 是一款免费开源的视频录制和实时流媒体软件。它提供了强大的场景切换、滤镜、音频混合等功能，广泛应用于游戏直播、在线教学和视频会议。', 'video', '["直播", "录屏", "视频制作", "在线教育"]', 'https://github.com/obsproject/obs-studio', 'obsproject', 'obs-studio', 'GPL-2.0', 'https://obsproject.com', 1, 'active', 65000, '2026-04-15'),

('app_vid_02', 'yt-dlp', 'yt-dlp', '最强视频下载命令行工具，支持 1000+ 网站', 'yt-dlp 是一款强大的视频下载命令行工具，支持 YouTube、B站等 1000+ 视频网站。支持选择分辨率、格式转换、字幕下载、播放列表批量下载。', 'video', '["视频下载", "YouTube", "B站"]', 'https://github.com/yt-dlp/yt-dlp', 'yt-dlp', 'yt-dlp', 'Unlicense', 'https://github.com/yt-dlp/yt-dlp', 1, 'active', 108000, '2026-04-18'),

('app_vid_03', 'HandBrake', 'handbrake', '开源视频转码神器，支持几乎所有格式', 'HandBrake 是一款开源的视频转码工具，支持将几乎所有格式的视频转换为 MP4、MKV 等常见格式。内置预设，可一键转码为适配 iPhone、Android 等设备的格式。', 'video', '["视频转码", "格式转换", "压缩"]', 'https://github.com/HandBrake/HandBrake', 'HandBrake', 'HandBrake', 'GPL-2.0', 'https://handbrake.fr', 0, 'active', 19000, '2026-03-25'),

('app_vid_04', 'Shotcut', 'shotcut', '免费开源的视频剪辑软件，不输 Premiere', 'Shotcut 是一款免费开源的跨平台视频编辑器，支持 4K 编辑、多种音视频格式、丰富滤镜和转场效果。无需导入转换即可直接编辑。', 'video', '["视频剪辑", "4K", "滤镜"]', 'https://github.com/mltframework/shotcut', 'mltframework', 'shotcut', 'GPL-3.0', 'https://shotcut.org', 0, 'active', 11000, '2026-02-28');

INSERT INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, is_stable) VALUES
('ver_vid_01', 'app_vid_01', '30.1.2', 'windows', 'x64', 'exe', 'OBS-Studio-30.1.2-Full-Installer-x64.exe', 134217728, 'https://github.com/obsproject/obs-studio/releases/download/30.1.2/OBS-Studio-30.1.2-Full-Installer-x64.exe', 1),
('ver_vid_01m', 'app_vid_01', '30.1.2', 'macos', 'universal', 'dmg', 'OBS-Studio-30.1.2-macOS.dmg', 142606336, 'https://github.com/obsproject/obs-studio/releases/download/30.1.2/OBS-Studio-30.1.2-macOS.dmg', 1),
('ver_vid_02', 'app_vid_02', '2024.12.23', 'windows', 'x64', 'exe', 'yt-dlp.exe', 18000000, 'https://github.com/yt-dlp/yt-dlp/releases/download/2024.12.23/yt-dlp.exe', 1),
('ver_vid_03', 'app_vid_03', '1.8.2', 'windows', 'x64', 'exe', 'HandBrake-1.8.2-x86_64-Win_GUI.exe', 22000000, 'https://github.com/HandBrake/HandBrake/releases/download/1.8.2/HandBrake-1.8.2-x86_64-Win_GUI.exe', 1),
('ver_vid_04', 'app_vid_04', '24.11.17', 'windows', 'x64', 'exe', 'shotcut-win2401117.exe', 95000000, 'https://github.com/mltframework/shotcut/releases/download/v24.11.17/shotcut-win2401117.exe', 1);

INSERT INTO app_ai_content (id, app_id, summary, what_it_does, what_it_cant_do, use_cases, quick_start_guide, is_portable, requirements, uninstall_guide, has_registry_residual, confidence_score) VALUES
('ai_vid_01', 'app_vid_01', '免费的直播和录屏神器，主播和UP主都在用', '能帮你做什么:\n- 录制电脑屏幕和游戏画面\n- 直播到 Twitch、YouTube、B站等平台\n- 多场景切换 (游戏画面、摄像头、PPT)\n- 实时滤镜和美颜\n- 音频混合和降噪', '不能做什么:\n- 不能直接剪辑视频（需要配合剪映、PR等）\n- 不会自动优化直播画质（需要自己调参数）\n- 不支持移动端推流', '["游戏直播", "在线教学", "会议录屏", "视频教程制作"]', '一分钟上手:\n1. 下载安装后打开\n2. 点击"来源"下面的"+"添加画面捕获\n3. 选择"显示器捕获"或"游戏捕获"\n4. 点击"开始录制"或"开始直播"', 0, '{"runtime": "无需额外运行库", "os_version": "Windows 10 或更高版本"}', '控制面板卸载即可', 0, 0.95),
('ai_vid_02', 'app_vid_02', '一行命令下载全网视频，支持 1000+ 网站', '能帮你做什么:\n- 下载 YouTube、B站等 1000+ 网站视频\n- 选择分辨率和格式\n- 批量下载播放列表\n- 自动下载字幕', '不能做什么:\n- 没有图形界面（需要命令行操作）\n- 部分付费内容无法下载\n- 需要手动更新', '["视频下载", "离线观看", "教程存档"]', '一分钟上手:\n1. 下载 yt-dlp.exe\n2. 打开命令行\n3. 运行 yt-dlp [视频URL]\n4. 视频自动下载到当前目录！', 1, '{"runtime": "无需运行库"}', '删除 exe 文件即可', 0, 0.96),
('ai_vid_03', 'app_vid_03', '几乎万能的视频格式转换器，一键搞定', '能帮你做什么:\n- 转换几乎所有视频格式\n- 一键转为 iPhone/Android 适配格式\n- 视频压缩减小文件大小\n- 提取视频中的音频', '不能做什么:\n- 不能编辑视频（需配合剪辑软件）\n- 不能处理受 DRM 保护的文件', '["格式转换", "视频压缩", "设备适配"]', '一分钟上手:\n1. 安装后打开 HandBrake\n2. 拖入视频文件\n3. 选择预设（如 Fast 1080p30）\n4. 点击"开始编码"', 0, '{"runtime": "无需运行库"}', '控制面板卸载即可', 0, 0.94);

INSERT INTO app_security (id, app_id, sha256, virustotal_url, virustotal_score, audit_status) VALUES
('sec_vid_01', 'app_vid_01', 'abc123def456...', 'https://www.virustotal.com/gui/file/abc123', 0, 'passed'),
('sec_vid_02', 'app_vid_02', 'def789ghi012...', NULL, NULL, 'passed'),
('sec_vid_03', 'app_vid_03', 'ghi345jkl678...', NULL, 0, 'passed');

-- ============================================
-- 分类: privacy (隐私保护)
-- ============================================

INSERT INTO apps (id, name, slug, description, full_description, category, tags, github_url, github_owner, github_repo, license, homepage_url, is_featured, status, stars_count, last_updated) VALUES
('app_pri_01', 'uBlock Origin', 'ublock-origin', '最高效的广告和追踪拦截器', 'uBlock Origin 是一款高效的开源广告拦截扩展，占用极低内存，拦截规则丰富。不仅能拦截广告，还能阻止第三方追踪器、恶意软件网站。', 'privacy', '["广告拦截", "隐私保护", "浏览器扩展"]', 'https://github.com/gorhill/uBlock', 'gorhill', 'uBlock', 'GPL-3.0', 'https://ublockorigin.com', 1, 'active', 49000, '2026-04-01'),

('app_pri_02', 'Bitwarden', 'bitwarden', '免费开源的密码管理器', 'Bitwarden 是一款开源的密码管理器，支持全平台同步、浏览器自动填充、两步验证。所有密码加密存储，零知识架构确保只有你自己能访问。', 'privacy', '["密码管理", "安全", "自动填充"]', 'https://github.com/bitwarden/clients', 'bitwarden', 'clients', 'GPL-3.0', 'https://bitwarden.com', 1, 'active', 8800, '2026-04-12'),

('app_pri_03', 'VeraCrypt', 'veracrypt', '开源磁盘加密工具，保护你的私密文件', 'VeraCrypt 是一款免费开源的磁盘加密软件，可以创建加密虚拟磁盘或加密整个分区。支持隐藏卷、密钥文件等高级功能，安全性极高。', 'privacy', '["磁盘加密", "文件保护", "隐私"]', 'https://github.com/veracrypt/VeraCrypt', 'veracrypt', 'VeraCrypt', 'Apache-2.0', 'https://www.veracrypt.fr', 0, 'active', 7000, '2026-03-15');

INSERT INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, is_stable) VALUES
('ver_pri_02', 'app_pri_02', '2024.3.0', 'windows', 'x64', 'exe', 'Bitwarden-Installer-2024.3.0.exe', 140000000, 'https://github.com/bitwarden/clients/releases/download/v2024.3.0/Bitwarden-Installer-2024.3.0.exe', 1),
('ver_pri_02m', 'app_pri_02', '2024.3.0', 'macos', 'universal', 'dmg', 'Bitwarden-2024.3.0-universal.dmg', 150000000, 'https://github.com/bitwarden/clients/releases/download/v2024.3.0/Bitwarden-2024.3.0-universal.dmg', 1),
('ver_pri_03', 'app_pri_03', '1.26.7', 'windows', 'x64', 'exe', 'VeraCrypt%20Setup%201.26.7.exe', 35000000, 'https://github.com/veracrypt/VeraCrypt/releases/download/VeraCrypt_1.26.7/VeraCrypt%20Setup%201.26.7.exe', 1);

INSERT INTO app_ai_content (id, app_id, summary, what_it_does, what_it_cant_do, use_cases, quick_start_guide, is_portable, requirements, uninstall_guide, has_registry_residual, confidence_score) VALUES
('ai_pri_02', 'app_pri_02', '免费的密码保险箱，全平台同步，告别记密码', '能帮你做什么:\n- 安全存储所有密码\n- 浏览器自动填充\n- 全平台同步（手机/电脑/平板）\n- 两步验证保护', '不能做什么:\n- 免费版不支持 TOTP 验证码\n- 不支持密码继承', '["密码管理", "自动填充", "全平台同步"]', '一分钟上手:\n1. 安装后创建账号\n2. 设置主密码（务必记住！）\n3. 安装浏览器扩展\n4. 登录网站时自动保存和填充密码', 0, '{"runtime": "无需运行库"}', '控制面板卸载即可', 0, 0.96),
('ai_pri_03', 'app_pri_03', '给文件加把锁，别人看不到你的秘密', '能帮你做什么:\n- 创建加密虚拟磁盘\n- 加密整个U盘或分区\n- 隐藏卷（双重保护）\n- 支持多种加密算法', '不能做什么:\n- 加密后忘记密码无法恢复\n- 不能加密单个文件（需创建虚拟磁盘）\n- 操作相对复杂', '["文件加密", "隐私保护", "U盘加密"]', '一分钟上手:\n1. 安装后打开 VeraCrypt\n2. 点击"创建卷"→ 选择"创建加密文件卷"\n3. 选择位置和大小\n4. 设置密码 → 格式化 → 完成！', 0, '{"runtime": "无需运行库"}', '控制面板卸载即可，加密文件需手动删除', 0, 0.93);

-- ============================================
-- 分类: clean-install (纯净装机)
-- ============================================

INSERT INTO apps (id, name, slug, description, full_description, category, tags, github_url, github_owner, github_repo, license, homepage_url, is_featured, status, stars_count, last_updated) VALUES
('app_cln_01', 'Rufus', 'rufus', '制作 USB 启动盘的终极工具', 'Rufus 是一款免费的 USB 启动盘制作工具，支持 Windows/Linux 安装盘、PE 急救盘制作。速度极快，比微软官方工具快 2-3 倍。', 'clean-install', '["U盘启动", "系统安装", "PE制作"]', 'https://github.com/pbatard/rufus', 'pbatard', 'rufus', 'GPL-3.0', 'https://rufus.ie', 1, 'active', 31000, '2026-04-12'),

('app_cln_02', 'Ventoy', 'ventoy', '一个U盘装多个系统，无需反复格式化', 'Ventoy 是一款革命性的启动盘制作工具。只需将 ISO 文件复制到U盘，就能自动识别并启动安装，支持同时放入多个系统镜像。', 'clean-install', '["多系统", "U盘启动", "ISO"]', 'https://github.com/ventoy/Ventoy', 'ventoy', 'Ventoy', 'GPL-3.0', 'https://www.ventoy.net', 1, 'active', 64000, '2026-03-20'),

('app_cln_03', 'Media Creation Tool', 'media-creation-tool', '微软官方 Windows 安装介质制作工具', 'Media Creation Tool 是微软官方提供的 Windows 10/11 安装U盘制作工具，自动下载系统镜像并创建安装介质。', 'clean-install', '["Windows安装", "官方工具", "U盘制作"]', 'https://github.com/pbatard/rufus', 'microsoft', 'media-creation-tool', 'MIT', 'https://www.microsoft.com/software-download', 0, 'active', 5000, '2026-04-01');

INSERT INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, is_stable) VALUES
('ver_cln_01', 'app_cln_01', '4.5', 'windows', 'x64', 'exe', 'rufus-4.5.exe', 1500000, 'https://github.com/pbatard/rufus/releases/download/v4.5/rufus-4.5.exe', 1),
('ver_cln_02', 'app_cln_02', '1.0.99', 'windows', 'x64', 'zip', 'ventoy-1.0.99-windows.zip', 20000000, 'https://github.com/ventoy/Ventoy/releases/download/v1.0.99/ventoy-1.0.99-windows.zip', 1);

INSERT INTO app_ai_content (id, app_id, summary, what_it_does, what_it_cant_do, use_cases, quick_start_guide, is_portable, requirements, uninstall_guide, has_registry_residual, confidence_score) VALUES
('ai_cln_01', 'app_cln_01', '3秒制作系统安装U盘，比官方工具快10倍', '能帮你做什么:\n- 制作 Windows/Linux 安装U盘\n- 创建 PE 急救盘\n- 烧录 ISO 镜像到U盘\n- 自动格式化U盘', '不能做什么:\n- 会清空U盘数据\n- 不支持多系统共存（需用 Ventoy）', '["系统安装", "U盘启动", "PE急救盘"]', '一分钟上手:\n1. 插入U盘（注意：会清空U盘！）\n2. 打开 Rufus\n3. 选择下载好的 ISO 文件\n4. 点击"开始"', 1, '{"runtime": "无需运行库"}', '删除 exe 即可，绿色版', 0, 0.98),
('ai_cln_02', 'app_cln_02', '一个U盘装所有系统，往里拖 ISO 就行', '能帮你做什么:\n- 一个U盘放多个系统镜像\n- 直接复制 ISO 文件即可\n- 支持 Windows/Linux/PE\n- U盘还能正常存文件', '不能做什么:\n- 首次安装 Ventoy 需要格式化U盘\n- 极少数主板不兼容', '["多系统安装", "运维工具", "装机必备"]', '一分钟上手:\n1. 下载解压后运行 Ventoy2Disk.exe\n2. 选择U盘，点击"安装"\n3. 安装完成后，把 ISO 文件直接拖进U盘\n4. 从U盘启动即可选择系统', 0, '{"runtime": "无需运行库"}', '运行 Ventoy2Disk 选择卸载即可', 0, 0.96);

-- ============================================
-- 分类: dev-tools (开发工具)
-- ============================================

INSERT INTO apps (id, name, slug, description, full_description, category, tags, github_url, github_owner, github_repo, license, homepage_url, is_featured, status, stars_count, last_updated) VALUES
('app_dev_01', 'VS Code', 'vscode', '最受欢迎的免费代码编辑器', 'Visual Studio Code 是微软开源的轻量级代码编辑器，内置 Git 支持、智能代码补全、调试工具。通过扩展市场可支持几乎所有编程语言和开发框架。', 'dev-tools', '["代码编辑器", "IDE", "调试"]', 'https://github.com/microsoft/vscode', 'microsoft', 'vscode', 'MIT', 'https://code.visualstudio.com', 1, 'active', 170000, '2026-04-18'),

('app_dev_02', 'Git', 'git', '版本控制之王，程序员必备', 'Git 是最广泛使用的分布式版本控制系统，由 Linus Torvalds 创建。无论是个人项目还是团队协作，Git 都是代码管理的首选工具。', 'dev-tools', '["版本控制", "Git", "代码管理"]', 'https://github.com/git/git', 'git', 'git', 'GPL-2.0', 'https://git-scm.com', 1, 'active', 53000, '2026-04-05'),

('app_dev_03', 'Windows Terminal', 'windows-terminal', '微软出品的现代终端模拟器', 'Windows Terminal 是微软官方推出的现代化终端应用，支持多标签、GPU 加速渲染、自定义主题。可同时运行 PowerShell、CMD、WSL 等多种终端。', 'dev-tools', '["终端", "命令行", "WSL"]', 'https://github.com/microsoft/terminal', 'microsoft', 'terminal', 'MIT', 'https://github.com/microsoft/terminal', 0, 'active', 97000, '2026-04-10'),

('app_dev_04', 'Lazygit', 'lazygit', '简单好用的 Git 终端 UI', 'Lazygit 是一款终端中的 Git 图形界面工具，让你在命令行中也能方便地查看分支、提交、暂存、合并等操作，比纯命令行更直观。', 'dev-tools', '["Git", "终端UI", "效率工具"]', 'https://github.com/jesseduffield/lazygit', 'jesseduffield', 'lazygit', 'MIT', 'https://github.com/jesseduffield/lazygit', 0, 'active', 55000, '2026-03-28');

INSERT INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, is_stable) VALUES
('ver_dev_01', 'app_dev_01', '1.89.0', 'windows', 'x64', 'exe', 'VSCodeSetup-x64-1.89.0.exe', 95000000, 'https://github.com/microsoft/vscode/releases/download/1.89.0/VSCodeSetup-x64-1.89.0.exe', 1),
('ver_dev_01m', 'app_dev_01', '1.89.0', 'macos', 'universal', 'zip', 'VSCode-darwin-universal.zip', 110000000, 'https://github.com/microsoft/vscode/releases/download/1.89.0/VSCode-darwin-universal.zip', 1),
('ver_dev_03', 'app_dev_03', '1.20.0', 'windows', 'x64', 'msixbundle', 'Microsoft.WindowsTerminal_1.20.0.msixbundle', 20000000, 'https://github.com/microsoft/terminal/releases/download/v1.20.0/Microsoft.WindowsTerminal_1.20.0_8wekyb3d8bbwe.msixbundle', 1);

INSERT INTO app_ai_content (id, app_id, summary, what_it_does, what_it_cant_do, use_cases, quick_start_guide, is_portable, requirements, uninstall_guide, has_registry_residual, confidence_score) VALUES
('ai_dev_01', 'app_dev_01', '程序员最爱的代码编辑器，插件丰富到爆炸', '能帮你做什么:\n- 智能代码补全和语法高亮\n- 内置 Git 和调试器\n- 海量扩展插件\n- 远程开发（SSH/容器/WSL）', '不能做什么:\n- 不是完整 IDE（需配合扩展）\n- 大项目内存占用较高\n- 不适合 Java 企业级开发（用 IntelliJ 更好）', '["前端开发", "后端开发", "脚本编写"]', '一分钟上手:\n1. 安装后打开\n2. 安装中文语言包和常用扩展\n3. 打开文件夹开始编码\n4. Ctrl+` 打开终端', 0, '{"runtime": "无需运行库"}', '控制面板卸载即可', 0, 0.97),
('ai_dev_03', 'app_dev_03', '微软出的好看又好用的终端，替代系统自带CMD', '能帮你做什么:\n- 多标签终端\n- GPU 加速渲染\n- 自定义主题和字体\n- 同时运行 PowerShell/CMD/WSL', '不能做什么:\n- 仅 Windows 10/11 可用\n- 不是 Shell 本身（是终端模拟器）', '["终端管理", "开发运维", "WSL"]', '一分钟上手:\n1. 从微软商店或 GitHub 安装\n2. 打开后默认启动 PowerShell\n3. 点击 + 号新建标签页\n4. 点击下拉箭头切换终端类型', 0, '{"runtime": "需要 Windows 10 1903 或更高版本"}', '应用设置中卸载即可', 0, 0.95);

-- ============================================
-- 分类: file-management (文件管理)
-- ============================================

INSERT INTO apps (id, name, slug, description, full_description, category, tags, github_url, github_owner, github_repo, license, homepage_url, is_featured, status, stars_count, last_updated) VALUES
('app_fm_01', 'Syncthing', 'syncthing', '开源的跨平台文件同步工具', 'Syncthing 是一款开源的跨平台文件同步工具，可以在多台设备之间自动同步文件，无需上传到云端，数据直接在设备间加密传输。', 'file-management', '["文件同步", "跨平台", "P2P"]', 'https://github.com/syncthing/syncthing', 'syncthing', 'syncthing', 'MPL-2.0', 'https://syncthing.net', 1, 'active', 66000, '2026-04-14'),

('app_fm_02', '7-Zip', '7zip', '免费开源的压缩解压工具', '7-Zip 是一款免费开源的压缩解压软件，支持 7z、ZIP、RAR 等几乎所有压缩格式。独创的 7z 格式压缩率比 ZIP 高 30-50%。', 'file-management', '["压缩", "解压", "7z"]', 'https://github.com/ip7z/7zip', 'ip7z', '7zip', 'LGPL-2.1', 'https://www.7-zip.org', 1, 'active', 2500, '2026-03-10'),

('app_fm_03', 'Files', 'files', '现代风格的 Windows 文件管理器', 'Files 是一款现代化设计的 Windows 文件管理器，支持标签页、双面板、预览窗格等功能，界面比 Windows 自带资源管理器美观得多。', 'file-management', '["文件管理器", "标签页", "双面板"]', 'https://github.com/files-community/Files', 'files-community', 'Files', 'MIT', 'https://files.community', 0, 'active', 34000, '2026-04-08');

INSERT INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, is_stable) VALUES
('ver_fm_01', 'app_fm_01', '1.27.2', 'windows', 'x64', 'exe', 'syncthing-windows-amd64-v1.27.2.zip', 12000000, 'https://github.com/syncthing/syncthing/releases/download/v1.27.2/syncthing-windows-amd64-v1.27.2.zip', 1),
('ver_fm_01m', 'app_fm_01', '1.27.2', 'macos', 'universal', 'dmg', 'syncthing-macos-universal-v1.27.2.dmg', 15000000, 'https://github.com/syncthing/syncthing/releases/download/v1.27.2/syncthing-macos-universal-v1.27.2.dmg', 1),
('ver_fm_02', 'app_fm_02', '24.08', 'windows', 'x64', 'exe', '7z2408-x64.exe', 1500000, 'https://www.7-zip.org/a/7z2408-x64.exe', 1),
('ver_fm_03', 'app_fm_03', '3.5.0', 'windows', 'x64', 'msixbundle', 'Files.Package_3.5.0.msixbundle', 35000000, 'https://github.com/files-community/Files/releases/download/v3.5.0/Files.Package_3.5.0.msixbundle', 1);

INSERT INTO app_ai_content (id, app_id, summary, what_it_does, what_it_cant_do, use_cases, quick_start_guide, is_portable, requirements, uninstall_guide, has_registry_residual, confidence_score) VALUES
('ai_fm_01', 'app_fm_01', '多台电脑自动同步文件，不走云端，隐私安全', '能帮你做什么:\n- 多台设备自动同步文件夹\n- P2P 直连，数据不经过第三方\n- 端到端加密\n- 版本历史回溯', '不能做什么:\n- 不支持选择性同步（需同步整个文件夹）\n- 首次配置需要两台设备都在线', '["文件同步", "多设备协作", "备份"]', '一分钟上手:\n1. 在两台电脑上都安装 Syncthing\n2. 在一台添加另一台的设备 ID\n3. 选择要同步的文件夹\n4. 授权连接，自动开始同步', 0, '{"runtime": "无需运行库"}', '控制面板卸载即可', 0, 0.94),
('ai_fm_02', 'app_fm_02', '最良心的压缩软件，免费无广告，压缩率比 WinRAR 高', '能帮你做什么:\n- 解压几乎所有压缩格式\n- 7z 格式压缩率领先\n- 右键菜单集成\n- AES-256 加密压缩', '不能做什么:\n- 界面比较简陋\n- 不能创建 RAR 格式（仅解压 RAR）', '["文件压缩", "解压缩", "加密"]', '一分钟上手:\n1. 安装后右键文件/文件夹\n2. 选择 7-Zip → 添加到压缩包\n3. 选择格式和压缩级别\n4. 点击确定', 0, '{"runtime": "无需运行库"}', '控制面板卸载即可', 0, 0.96),
('ai_fm_03', 'app_fm_03', '比 Windows 资源管理器好看 100 倍的文件管理器', '能帮你做什么:\n- 标签页浏览\n- 双面板对比\n- 预览窗格\n- 右键菜单增强', '不能做什么:\n- 部分功能不如系统自带完善\n- 仅支持 Windows 10/11', '["文件浏览", "标签管理", "效率提升"]', '一分钟上手:\n1. 安装后从开始菜单打开\n2. 用 Ctrl+T 新建标签页\n3. 设置中可开启双面板模式', 0, '{"runtime": "需要 Windows 10 1809 或更高版本"}', '应用设置中卸载即可', 0, 0.92);

-- ============================================
-- 分类: design (设计工具)
-- ============================================

INSERT INTO apps (id, name, slug, description, full_description, category, tags, github_url, github_owner, github_repo, license, homepage_url, is_featured, status, stars_count, last_updated) VALUES
('app_des_01', 'GIMP', 'gimp', '免费开源的 Photoshop 替代品', 'GIMP 是一款免费开源的图片编辑软件，功能媲美 Photoshop。支持图层、通道、滤镜、脚本自动化等专业级图片处理功能。', 'design', '["图片编辑", "PS替代", "图层"]', 'https://github.com/GNOME/gimp', 'GNOME', 'gimp', 'GPL-3.0', 'https://www.gimp.org', 1, 'active', 4700, '2026-02-15'),

('app_des_02', 'Inkscape', 'inkscape', '免费开源的矢量图形编辑器', 'Inkscape 是一款免费开源的矢量图形编辑软件，类似于 Adobe Illustrator。支持 SVG 格式，适合制作 Logo、图标、插画等矢量图形。', 'design', '["矢量图", "SVG", "Logo设计"]', 'https://github.com/inkscape/inkscape', 'inkscape', 'inkscape', 'GPL-2.0', 'https://inkscape.org', 0, 'active', 2500, '2026-03-01'),

('app_des_03', 'Draw.io', 'drawio', '免费开源的流程图和图表绘制工具', 'Draw.io 是一款免费开源的在线和桌面图表工具，支持流程图、架构图、UML、思维导图等多种图表。可导出 PNG/SVG/PDF。', 'design', '["流程图", "架构图", "UML"]', 'https://github.com/jgraph/drawio-desktop', 'jgraph', 'drawio-desktop', 'Apache-2.0', 'https://www.drawio.com', 1, 'active', 52000, '2026-04-02');

INSERT INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, is_stable) VALUES
('ver_des_01', 'app_des_01', '2.10.38', 'windows', 'x64', 'exe', 'gimp-2.10.38-setup.exe', 250000000, 'https://github.com/GNOME/gimp/releases/download/v2.10.38/gimp-2.10.38-setup.exe', 1),
('ver_des_02', 'app_des_02', '1.3.2', 'windows', 'x64', 'exe', 'inkscape-1.3.2-x64.exe', 120000000, 'https://inkscape.org/release/inkscape-1.3.2/windows/inkscape-1.3.2-x64.exe', 1),
('ver_des_03', 'app_des_03', '24.0.4', 'windows', 'x64', 'exe', 'draw.io-24.0.4-windows.exe', 130000000, 'https://github.com/jgraph/drawio-desktop/releases/download/v24.0.4/draw.io-24.0.4-windows.exe', 1),
('ver_des_03m', 'app_des_03', '24.0.4', 'macos', 'arm64', 'dmg', 'draw.io-24.0.4-mac.dmg', 120000000, 'https://github.com/jgraph/drawio-desktop/releases/download/v24.0.4/draw.io-24.0.4-mac.dmg', 1);

INSERT INTO app_ai_content (id, app_id, summary, what_it_does, what_it_cant_do, use_cases, quick_start_guide, is_portable, requirements, uninstall_guide, has_registry_residual, confidence_score) VALUES
('ai_des_01', 'app_des_01', '免费的 Photoshop 替代品，专业修图不用花钱', '能帮你做什么:\n- 专业级图片编辑和修图\n- 图层和通道操作\n- 滤镜和特效\n- 批量处理图片', '不能做什么:\n- 不支持 CMYK 色彩模式（打印设计需注意）\n- 界面操作习惯和 PS 不同\n- 部分高级 PS 插件不兼容', '["图片编辑", "照片修图", "GIF制作"]', '一分钟上手:\n1. 安装后打开\n2. 拖入图片或新建画布\n3. 左侧工具栏选择工具\n4. 开始创作！', 0, '{"runtime": "无需运行库"}', '控制面板卸载即可', 0, 0.93),
('ai_des_03', 'app_des_03', '画流程图、架构图、思维导图，免费又好用', '能帮你做什么:\n- 绘制流程图和架构图\n- UML 图和思维导图\n- 网络拓扑图\n- 导出 PNG/SVG/PDF', '不能做什么:\n- 不适合复杂插画\n- 不支持实时协作（需配合 draw.io 网页版）', '["流程图", "架构设计", "文档配图"]', '一分钟上手:\n1. 安装后打开\n2. 从左侧形状库拖拽元素\n3. 用箭头连接\n4. 导出为图片或 PDF', 0, '{"runtime": "无需运行库"}', '控制面板卸载即可', 0, 0.95);

-- ============================================
-- 分类: office (办公提效)
-- ============================================

INSERT INTO apps (id, name, slug, description, full_description, category, tags, github_url, github_owner, github_repo, license, homepage_url, is_featured, status, stars_count, last_updated) VALUES
('app_ofc_01', 'Obsidian', 'obsidian', '本地优先的知识管理和笔记工具', 'Obsidian 是一款本地优先的笔记和知识管理工具，基于 Markdown 文件，所有数据存储在本地。支持双向链接、图谱视图、丰富插件生态。', 'office', '["笔记", "知识管理", "Markdown"]', 'https://github.com/obsidianmd/obsidian-release', 'obsidianmd', 'obsidian-release', 'Proprietary', 'https://obsidian.md', 1, 'active', 9500, '2026-04-16'),

('app_ofc_02', 'SumatraPDF', 'sumatrapdf', '极轻量 PDF 阅读器，秒开大文件', 'SumatraPDF 是一款极轻量的 PDF 阅读器，打开速度远超 Adobe Reader。还支持 ePub、MOBI、CBZ 等电子书格式。单文件绿色版，无需安装。', 'office', '["PDF阅读", "电子书", "轻量"]', 'https://github.com/sumatrapdfreader/sumatrapdf', 'sumatrapdfreader', 'sumatrapdf', 'GPL-3.0', 'https://www.sumatrapdfreader.org', 0, 'active', 13000, '2026-03-20'),

('app_ofc_03', 'Mark Text', 'marktext', '优雅的 Markdown 编辑器', 'Mark Text 是一款开源的 Markdown 编辑器，所见即所得的编辑体验，支持斗图模式、数学公式、流程图等扩展语法。界面简洁优雅。', 'office', '["Markdown", "编辑器", "写作"]', 'https://github.com/marktext/marktext', 'marktext', 'marktext', 'MIT', 'https://marktext.app', 0, 'active', 47000, '2026-01-15');

INSERT INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, is_stable) VALUES
('ver_ofc_01', 'app_ofc_01', '1.5.8', 'windows', 'x64', 'exe', 'Obsidian.1.5.8.exe', 110000000, 'https://github.com/obsidianmd/obsidian-release/releases/download/v1.5.8/Obsidian.1.5.8.exe', 1),
('ver_ofc_01m', 'app_ofc_01', '1.5.8', 'macos', 'universal', 'dmg', 'obsidian-1.5.8-universal.dmg', 120000000, 'https://github.com/obsidianmd/obsidian-release/releases/download/v1.5.8/obsidian-1.5.8-universal.dmg', 1),
('ver_ofc_02', 'app_ofc_02', '3.5.2', 'windows', 'x64', 'exe', 'SumatraPDF-3.5.2-64-install.exe', 5500000, 'https://www.sumatrapdfreader.org/dl/SumatraPDF-3.5.2-64-install.exe', 1),
('ver_ofc_03', 'app_ofc_03', '0.17.1', 'windows', 'x64', 'exe', 'marktext-setup-0.17.1.exe', 80000000, 'https://github.com/marktext/marktext/releases/download/v0.17.1/marktext-setup-0.17.1.exe', 1);

INSERT INTO app_ai_content (id, app_id, summary, what_it_does, what_it_cant_do, use_cases, quick_start_guide, is_portable, requirements, uninstall_guide, has_registry_residual, confidence_score) VALUES
('ai_ofc_01', 'app_ofc_01', '本地优先的笔记神器，用双向链接构建知识网络', '能帮你做什么:\n- Markdown 笔记和双向链接\n- 知识图谱可视化\n- 丰富的插件生态\n- 本地文件，完全掌控数据', '不能做什么:\n- 核心免费但同步功能需付费\n- 不支持富文本编辑\n- 学习曲线较陡', '["知识管理", "笔记", "写作"]', '一分钟上手:\n1. 安装后创建一个库（文件夹）\n2. 新建笔记，用 [[双括号]] 链接其他笔记\n3. 打开图谱视图查看笔记关系', 0, '{"runtime": "无需运行库"}', '控制面板卸载即可，笔记文件保留在原文件夹', 0, 0.95),
('ai_ofc_02', 'app_ofc_02', '秒开 PDF 的轻量阅读器，大文件也不卡', '能帮你做什么:\n- 极速打开 PDF 文件\n- 还支持 ePub、MOBI 等电子书\n- 绿色版无需安装\n- 极低内存占用', '不能做什么:\n- 不支持 PDF 编辑和注释\n- 不支持表单填写\n- 界面比较朴素', '["PDF阅读", "电子书阅读", "文档查看"]', '一分钟上手:\n1. 下载后直接运行（绿色版无需安装）\n2. 拖入 PDF 文件即可阅读\n3. 快捷键操作：+/- 缩放，Ctrl+F 搜索', 1, '{"runtime": "无需运行库"}', '删除 exe 文件即可，绿色版不留痕迹', 0, 0.97);
