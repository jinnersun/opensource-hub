import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Shield, Eye, Cookie, Trash2, Mail } from "lucide-react"

export const metadata = {
  title: "隐私政策 - OpenSource-Hub",
  description: "了解 OpenSource-Hub 如何收集、使用和保护您的个人信息。",
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-secondary/20 px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-full bg-muted p-4">
              <Shield className="size-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              隐私政策
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              我们尊重并保护每一位用户的隐私
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <div className="space-y-12">
            {/* Overview */}
            <div>
              <h2 className="mb-4 text-xl font-bold">概述</h2>
              <p className="text-muted-foreground leading-relaxed">
                OpenSource-Hub（以下简称"本站"）非常重视用户的隐私保护。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。
                使用本站即表示您同意本政策的条款。如果您不同意，请停止使用本站服务。
              </p>
            </div>

            {/* Data Collection */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Eye className="size-5 text-blue-500" />
                <h2 className="text-xl font-bold">我们收集的信息</h2>
              </div>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>我们可能收集以下类型的信息：</p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong className="text-foreground">浏览数据：</strong>
                    包括 IP 地址、浏览器类型、访问时间、页面浏览记录等，用于改善网站性能和用户体验。
                  </li>
                  <li>
                    <strong className="text-foreground">搜索记录：</strong>
                    您在站内进行的搜索关键词，用于优化搜索结果和相关推荐。
                  </li>
                  <li>
                    <strong className="text-foreground">下载统计：</strong>
                    匿名化的下载行为数据，用于了解软件热度并优化推荐算法。
                  </li>
                  <li>
                    <strong className="text-foreground">用户提交信息：</strong>
                    当您提交需求反馈时，我们会收集您提供的邮箱和需求描述，以便后续跟进。
                  </li>
                </ul>
              </div>
            </div>

            {/* Cookie */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Cookie className="size-5 text-amber-500" />
                <h2 className="text-xl font-bold">Cookie 使用</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                本站使用 Cookie 和类似技术来提供基本功能、记住您的偏好设置（如深色模式）、
                以及分析网站流量。您可以通过浏览器设置拒绝 Cookie，但这可能影响部分功能的正常使用。
              </p>
            </div>

            {/* Data Usage */}
            <div>
              <h2 className="mb-4 text-xl font-bold">信息使用方式</h2>
              <p className="mb-3 text-muted-foreground leading-relaxed">
                我们使用收集的信息用于以下目的：
              </p>
              <ul className="ml-6 list-disc space-y-2 text-muted-foreground">
                <li>提供、维护和改进网站服务</li>
                <li>分析用户行为以优化内容和推荐</li>
                <li>响应您的反馈和需求</li>
                <li>检测和防止安全威胁和欺诈行为</li>
                <li>生成匿名化的统计数据</li>
              </ul>
            </div>

            {/* Data Sharing */}
            <div>
              <h2 className="mb-4 text-xl font-bold">信息共享</h2>
              <p className="text-muted-foreground leading-relaxed">
                我们不会将您的个人信息出售给第三方。仅在以下情况下可能共享信息：
              </p>
              <ul className="ml-6 mt-3 list-disc space-y-2 text-muted-foreground">
                <li>获得您的明确同意</li>
                <li>法律法规要求或政府机关的合法请求</li>
                <li>保护本站、用户或公众的合法权益</li>
              </ul>
            </div>

            {/* Data Retention */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Trash2 className="size-5 text-red-500" />
                <h2 className="text-xl font-bold">数据保留与删除</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                我们会保留您的个人信息直到实现收集目的所必需的期限，或根据法律法规的要求。
                您可以随时联系我们要求删除您的个人数据，我们将在合理时间内处理您的请求。
              </p>
            </div>

            {/* Contact */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Mail className="size-5 text-emerald-500" />
                <h2 className="text-xl font-bold">联系我们</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                如果您对本隐私政策有任何疑问，或希望行使您的数据权利（查看、修改、删除），
                请通过
                <a href="/contact" className="mx-1 text-foreground underline">
                  联系我们页面
                </a>
                与我们取得联系。
              </p>
            </div>

            {/* Update */}
            <div className="rounded-xl border bg-secondary/20 p-6">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">政策更新：</strong>
                我们可能会不时更新本隐私政策。更新后的政策将在本页面发布，重大变更我们会通过网站公告通知。
                最后更新日期：2026年4月20日。
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
