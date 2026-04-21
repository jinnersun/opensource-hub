// ==========================================
// 分类数据结构 (Category)
// TODO: 后续从 Supabase 获取
// import { createClient } from '@supabase/supabase-js'
// const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
// const { data: categories } = await supabase.from('categories').select('*')
// ==========================================

export interface Category {
  id: string
  label: string
  description: string
  emoji: string
  keywords: string[]
  color: string // Tailwind 颜色类
  projectCount?: number // 可选，后续从数据库聚合
}

export const categories: Category[] = [
  {
    id: "ai",
    label: "AI 生产力",
    description: "智能助手、自动化工具，让 AI 帮你完成繁琐工作",
    emoji: "sparkles",
    keywords: ["AI", "人工智能", "自动化", "智能"],
    color: "from-violet-500 to-purple-600",
  },
  {
    id: "video",
    label: "影音下载",
    description: "下载视频、音乐，保存你喜欢的内容到本地",
    emoji: "play",
    keywords: ["视频", "音乐", "下载", "YouTube"],
    color: "from-red-500 to-orange-500",
  },
  {
    id: "privacy",
    label: "隐私保护",
    description: "屏蔽广告、阻止追踪，守护你的数字隐私",
    emoji: "shield",
    keywords: ["隐私", "安全", "广告", "追踪"],
    color: "from-emerald-500 to-teal-600",
  },
  {
    id: "design",
    label: "设计工具",
    description: "图片编辑、UI 设计、矢量绘图，释放你的创意",
    emoji: "palette",
    keywords: ["设计", "图片", "绘图", "UI"],
    color: "from-pink-500 to-rose-500",
  },
  {
    id: "office",
    label: "办公提效",
    description: "文档处理、格式转换、效率工具，让工作更轻松",
    emoji: "file-text",
    keywords: ["办公", "文档", "PDF", "Word"],
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "system",
    label: "系统调优",
    description: "启动器、清理工具、系统增强，让电脑更好用",
    emoji: "settings",
    keywords: ["系统", "优化", "启动器", "清理"],
    color: "from-slate-500 to-zinc-600",
  },
]

// 分类辅助函数
export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id)
}

export function getCategoryProjects(categoryId: string): Project[] {
  return projects.filter((p) => p.category === categoryId)
}

export function getAllCategories(): Category[] {
  // 计算每个分类的项目数量
  return categories.map((cat) => ({
    ...cat,
    projectCount: projects.filter((p) => p.category === cat.id).length,
  }))
}

// ==========================================
// 项目数据结构 (Project)
// ==========================================

export interface Project {
  id: string
  name: string
  humanTitle: string
  description: string
  longDescription: string
  stars: number
  category: string
  categoryLabel: string
  verified: boolean
  features: string[]
  gettingStarted: string[]
  uninstallNote: string
  dependsOn?: string
  platforms: {
    windows?: { url: string; version: string; size: string }
    mac?: { url: string; version: string; size: string }
    linux?: { url: string; version: string; size: string }
  }
  checksum: string
  sourceUrl: string
  lastUpdated: string
  securityScan: "passed" | "pending" | "failed"
  // Meta Info
  license?: string
  docsUrl?: string
  homepage?: string
  // Trending & Analytics
  starGrowth24h?: number // percentage increase in 24h
  starGrowthWeek?: number // percentage increase in week
  sparklineData?: number[] // 7-day star count trend
  trendingScore?: number // 0-100 Cloudflare KV score
  allTimeRank?: number // Hall of Fame ranking
  controversy?: boolean // flag for controversy/major bugs
  hasIssues?: boolean // flag for reported critical issues
}

export const projects: Project[] = [
  {
    id: "videoget",
    name: "VideoGet",
    humanTitle: "VideoGet — 一键保存任意网站视频（超简单）",
    description: "从任意视频网站保存喜欢的内容，自动选择最高画质，完全免费无广告。",
    longDescription:
      "VideoGet 是一款强大的视频下载工具，能够帮助你从各大视频网站下载喜欢的内容。无论是学习教程还是娱乐视频，都能轻松保存到本地。支持批量下载、自动识别最高画质、内置格式转换，让视频下载变得前所未有的简单。",
    stars: 24500,
    category: "video",
    categoryLabel: "影音下载",
    verified: true,
    features: [
      "支持上千个视频网站",
      "自动选择最高画质",
      "批量下载播放列表",
      "内置格式转换器",
      "无广告纯净体验",
    ],
    gettingStarted: [
      "打开 VideoGet，粘贴视频链接",
      "选择你想要的画质和格式",
      "点击「开始下载」，文件自动保存到桌面",
    ],
    uninstallNote: "卸载干净，不留任何系统痕迹",
    dependsOn: undefined,
    platforms: {
      windows: { url: "#", version: "4.2.1", size: "45.2 MB" },
      mac: { url: "#", version: "4.2.1", size: "52.8 MB" },
      linux: { url: "#", version: "4.2.0", size: "48.1 MB" },
    },
    checksum: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    sourceUrl: "https://github.com/example/videoget",
    lastUpdated: "2026-04-15",
    securityScan: "passed",
    starGrowth24h: 24,
    starGrowthWeek: 8,
    sparklineData: [24200, 24300, 24350, 24400, 24450, 24500, 24500],
    trendingScore: 82,
  },
  {
    id: "smartnote",
    name: "SmartNote",
    humanTitle: "SmartNote — 会自动整理的 AI 笔记本（零学习成本）",
    description: "自动归纳你的笔记要点，帮你建立知识网络，找旧笔记再也不用翻半天。",
    longDescription:
      "SmartNote 运用先进的人工智能技术，帮助你更高效地记录和整理笔记。它能自动识别关键信息、生成摘要、建立知识关联，让你的笔记不再是孤立的文字，而是相互连接的知识网络。",
    stars: 18200,
    category: "ai",
    categoryLabel: "AI 生产力",
    verified: true,
    features: [
      "AI 自动生成摘要",
      "智能标签分类",
      "知识图谱可视化",
      "多端实时同步",
      "支持 Markdown",
    ],
    gettingStarted: [
      "打开 SmartNote，新建一篇笔记",
      "随意记录你的想法或粘贴文章",
      "点击「智能整理」，AI 自动生成摘要和标签",
    ],
    uninstallNote: "卸载干净，笔记数据可提前导出备份",
    dependsOn: undefined,
    platforms: {
      windows: { url: "#", version: "2.8.0", size: "78.5 MB" },
      mac: { url: "#", version: "2.8.0", size: "85.2 MB" },
    },
    checksum: "sha256:a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
    sourceUrl: "https://github.com/example/smartnote",
    lastUpdated: "2026-04-18",
    securityScan: "passed",
    starGrowth24h: 68,
    starGrowthWeek: 45,
    sparklineData: [17000, 17500, 18000, 18100, 18150, 18200, 18200],
    trendingScore: 95,
    allTimeRank: 1,
  },
  {
    id: "privacyguard",
    name: "PrivacyGuard",
    humanTitle: "PrivacyGuard — 让广告和追踪器从此消失（一键开启）",
    description: "屏蔽广告、阻止网站追踪你的行为，上网更快更安全，不删任何个人文件。",
    longDescription:
      "PrivacyGuard 是你的数字隐私守护者。它能有效阻止网站追踪、屏蔽恼人广告、加密网络连接，让你在网络世界中自由浏览而不必担心隐私泄露。简单易用，一键开启全面保护。",
    stars: 31800,
    category: "privacy",
    categoryLabel: "隐私保护",
    verified: true,
    features: [
      "阻止网站追踪器",
      "智能广告过滤",
      "DNS 加密保护",
      "隐私报告面板",
      "极低资源占用",
    ],
    gettingStarted: [
      "安装 PrivacyGuard 并打开主界面",
      "点击中央的大按钮，开启保护",
      "正常浏览网页，广告和追踪已自动屏蔽",
    ],
    uninstallNote: "卸载干净，不留注册表记录",
    dependsOn: undefined,
    platforms: {
      windows: { url: "#", version: "5.1.2", size: "32.1 MB" },
      mac: { url: "#", version: "5.1.2", size: "35.8 MB" },
      linux: { url: "#", version: "5.1.2", size: "28.9 MB" },
    },
    checksum: "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    sourceUrl: "https://github.com/example/privacyguard",
    lastUpdated: "2026-04-20",
    securityScan: "passed",
    starGrowth24h: 12,
    starGrowthWeek: 5,
    sparklineData: [31500, 31600, 31700, 31750, 31800, 31800, 31800],
    trendingScore: 78,
  },
  {
    id: "designflow",
    name: "DesignFlow",
    humanTitle: "DesignFlow — 免费的专业设计工具（替代付费软件）",
    description: "画图标、做海报、设计界面，专业功能全免费，支持导出高清 PNG 和 SVG。",
    longDescription:
      "DesignFlow 是一款现代化的设计工具，为设计师提供流畅的创作体验。无论是 UI 设计、插画创作还是品牌设计，都能在这里找到合适的工具。强大的矢量编辑能力配合智能布局系统，让设计工作事半功倍。",
    stars: 42100,
    category: "design",
    categoryLabel: "设计工具",
    verified: true,
    features: [
      "矢量图形编辑",
      "智能布局系统",
      "丰富组件库",
      "团队协作功能",
      "导出多种格式",
    ],
    gettingStarted: [
      "打开 DesignFlow，新建画布",
      "从左侧工具栏选择形状或文字工具",
      "完成后点击「导出」选择格式保存",
    ],
    uninstallNote: "卸载干净，设计文件保存在你的文档文件夹",
    dependsOn: undefined,
    platforms: {
      windows: { url: "#", version: "3.5.0", size: "156.2 MB" },
      mac: { url: "#", version: "3.5.0", size: "168.7 MB" },
    },
    checksum: "sha256:7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730",
    sourceUrl: "https://github.com/example/designflow",
    lastUpdated: "2026-04-12",
    securityScan: "passed",
    starGrowth24h: 18,
    starGrowthWeek: 9,
    sparklineData: [41500, 41700, 41900, 42000, 42050, 42100, 42100],
    trendingScore: 75,
  },
  {
    id: "docmaster",
    name: "DocMaster",
    humanTitle: "DocMaster — PDF 和 Word 互转，扫描件也能编辑（极速）",
    description: "PDF 转 Word、图片转文字、批量合并文档，所有格式一站搞定，不上传云端更安全。",
    longDescription:
      "DocMaster 让文档处理变得简单高效。支持 PDF、Word、Excel 等多种格式互转，内置 OCR 识别功能可以将扫描文档转为可编辑文本。批量处理、加密保护、压缩合并，所有文档需求一站解决。",
    stars: 15600,
    category: "office",
    categoryLabel: "办公提效",
    verified: true,
    features: [
      "多格式互相转换",
      "OCR 文字识别",
      "批量处理文档",
      "PDF 加密保护",
      "文档压缩合并",
    ],
    gettingStarted: [
      "打开 DocMaster，拖入你的文件",
      "选择目标格式（如 PDF 转 Word）",
      "点击「开始转换」，几秒内完成",
    ],
    uninstallNote: "卸载干净，所有转换文件保存在本地",
    dependsOn: ".NET Runtime（安装包内已包含，无需额外下载）",
    platforms: {
      windows: { url: "#", version: "6.0.3", size: "89.4 MB" },
      mac: { url: "#", version: "6.0.3", size: "95.1 MB" },
      linux: { url: "#", version: "6.0.2", size: "82.6 MB" },
    },
    checksum: "sha256:ec4f2dbb3b140095550c9afbbb69b5d6fd9e814b9da82fad0b34e9fcbe56f1cb",
    sourceUrl: "https://github.com/example/docmaster",
    lastUpdated: "2026-04-10",
    securityScan: "passed",
    starGrowth24h: 3,
    starGrowthWeek: 2,
    sparklineData: [15500, 15520, 15540, 15560, 15580, 15600, 15600],
    trendingScore: 45,
    hasIssues: true,
  },
  {
    id: "quicklaunch",
    name: "QuickLaunch",
    humanTitle: "QuickLaunch — 按下快捷键秒开任意应用（超级效率）",
    description: "按下快捷键，打字几个字母，立刻打开任意应用或文件，告别满屏找图标。",
    longDescription:
      "QuickLaunch 是一款极简高效的应用启动器。按下快捷键，输入几个字母，即可快速打开应用、搜索文件、执行命令。强大的插件系统让它能做的远不止启动应用——翻译、计算、查词典，一切尽在指尖。",
    stars: 28900,
    category: "system",
    categoryLabel: "系统调优",
    verified: true,
    features: [
      "毫秒级应用启动",
      "全局文件搜索",
      "剪贴板历史",
      "自定义工作流",
      "丰富插件生态",
    ],
    gettingStarted: [
      "安装后自动运行，显示在任务栏托盘",
      "按下 Alt + Space 呼出搜索框",
      "输入应用名称按回车，即可秒开",
    ],
    uninstallNote: "卸载干净，不留注册表和后台进程",
    dependsOn: undefined,
    platforms: {
      windows: { url: "#", version: "7.2.1", size: "24.8 MB" },
      mac: { url: "#", version: "7.2.1", size: "28.3 MB" },
    },
    checksum: "sha256:6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
    sourceUrl: "https://github.com/example/quicklaunch",
    lastUpdated: "2026-04-19",
    securityScan: "passed",
    starGrowth24h: 32,
    starGrowthWeek: 15,
    sparklineData: [28200, 28400, 28600, 28700, 28800, 28900, 28900],
    trendingScore: 88,
  },
]

export const securityReport = {
  scannedPercent: 95,
  isolatedCount: 2,
  recentChecks: [
    { name: "VideoGet", checksum: "e3b0c4...b855", time: "10 分钟前" },
    { name: "PrivacyGuard", checksum: "b94d27...de9", time: "23 分钟前" },
    { name: "QuickLaunch", checksum: "6b86b2...b4b", time: "41 分钟前" },
  ],
}

export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id)
}

// ==========================================
// 热门数据函数
// TODO: 后续从 Cloudflare KV 获取 trending_score
// const trendingScores = await KV.get('trending_scores', 'json')
// ==========================================

export function getTrendingByPeriod(period: "day" | "week" | "alltime"): Project[] {
  const sorted = [...projects].sort((a, b) => {
    if (period === "day") {
      return (b.starGrowth24h || 0) - (a.starGrowth24h || 0)
    }
    if (period === "week") {
      return (b.starGrowthWeek || 0) - (a.starGrowthWeek || 0)
    }
    // alltime - Hall of Fame by total stars
    return b.stars - a.stars
  })
  return sorted
}
