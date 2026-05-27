export interface Guide {
  slug: string
  tags: string[]
  maxApps?: number
  title: Record<string, string>
  description: Record<string, string>
  intro: Record<string, string>
}

export const guides: Guide[] = [
  {
    slug: 'best-free-screen-recorder',
    tags: ['screen-recording', 'screencast'],
    title: {
      zh: '免费录屏软件推荐',
      en: 'Best Free Screen Recorders',
      ja: '無料スクリーンレコーダーおすすめ',
      ko: '무료 화면 녹화 프로그램 추천',
    },
    description: {
      zh: '精选开源免费录屏软件，支持 Windows/macOS/Linux，无水印无时长限制',
      en: 'Hand-picked free and open source screen recorders. No watermarks, no time limits.',
      ja: '厳選された無料・オープンソースのスクリーンレコーダー',
      ko: '엄선된 무료 오픈소스 화면 녹화 프로그램',
    },
    intro: {
      zh: '市面上很多录屏软件要么收费贵，要么有水印。这里推荐几款完全免费开源的录屏工具，功能强大且没有任何限制。',
      en: 'Many screen recorders are expensive or have watermarks. Here are fully free and open source alternatives.',
      ja: '多くのスクリーンレコーダーは高額か透かしが入ります。ここでは完全無料・オープンソースのツールを紹介します。',
      ko: '많은 화면 녹화 프로그램은 비싸거나 워터마크가 있습니다. 여기서는 완전 무료 오픈소스 도구를 추천합니다.',
    },
  },
  {
    slug: 'free-video-downloader',
    tags: ['video-download', 'youtube-download'],
    title: {
      zh: '免费视频下载工具推荐',
      en: 'Best Free Video Downloaders',
      ja: '無料動画ダウンロードツールおすすめ',
      ko: '무료 동영상 다운로드 도구 추천',
    },
    description: {
      zh: '支持 YouTube、B站、Twitter 等多平台的免费开源视频下载工具',
      en: 'Free open source video downloaders supporting YouTube, Bilibili, Twitter and more.',
      ja: 'YouTube、Bilibili、Twitterなどに対応する無料動画ダウンロードツール',
      ko: 'YouTube, Bilibili, Twitter 등을 지원하는 무료 동영상 다운로드 도구',
    },
    intro: {
      zh: '想下载视频但不想付费？这些开源工具能帮你从几乎所有视频网站下载内容，完全免费。',
      en: 'Want to download videos without paying? These open source tools can download from almost any video site.',
      ja: '動画をダウンロードしたいけどお金を払いたくない？これらのツールが役立ちます。',
      ko: '동영상을 다운로드하고 싶지만 비용을 지불하고 싶지 않다면? 이 도구들이 도움이 됩니다.',
    },
  },
  {
    slug: 'adobe-alternatives',
    tags: ['adobe-alternative', 'photo-editing', 'video-editing', 'vector-editing', 'pdf-editor'],
    title: {
      zh: '免费替代 Adobe 的开源软件',
      en: 'Free Open Source Alternatives to Adobe',
      ja: 'Adobe の代わりになる無料オープンソースソフト',
      ko: 'Adobe를 대체할 무료 오픈소스 소프트웨어',
    },
    description: {
      zh: '不用付费订阅，这些开源软件可以替代 Photoshop、Premiere、Illustrator、Acrobat',
      en: 'No subscription needed. These replace Photoshop, Premiere, Illustrator, Acrobat.',
      ja: 'サブスクリプション不要。Photoshop、Premiere、Illustrator、Acrobatの代わりに。',
      ko: '구독료 불필요. Photoshop, Premiere, Illustrator, Acrobat의 대안.',
    },
    intro: {
      zh: 'Adobe 全家桶每年几千块的订阅费对个人用户来说太贵了。这些开源软件功能完全不输，而且完全免费。',
      en: 'Adobe Creative Cloud costs hundreds per year. These alternatives are just as powerful and free.',
      ja: 'Adobe Creative Cloud は年間数万円。これらの代替品は同等の機能を持ち、完全無料です。',
      ko: 'Adobe Creative Cloud는 매년 수십만원입니다. 이 대안들은 동등한 기능을 제공하며 무료입니다.',
    },
  },
  // TODO: 扩展至 20-30 个推荐场景
]
