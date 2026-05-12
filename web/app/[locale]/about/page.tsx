import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Package2, Shield, Heart, Users } from "lucide-react"

export const metadata = {
  title: "关于我们 - OpenSource-Hub",
  description: "了解 OpenSource-Hub 的使命、愿景和团队。我们致力于消除开源软件的消费门槛。",
}

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-secondary/20 px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-full bg-muted p-4">
              <Package2 className="size-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              关于 OpenSource-Hub
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              让每一个人都能轻松发现和使用优质开源软件
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="mx-auto max-w-4xl px-4 py-16">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
                <Heart className="size-5 text-violet-500" />
              </div>
              <h2 className="text-xl font-bold">我们的使命</h2>
              <p className="text-muted-foreground leading-relaxed">
                消除开源软件的消费门槛。我们相信，优秀的开源工具不应该被晦涩的技术文档和复杂的安装流程所阻挡。
                通过 AI 自动化提纯技术，我们将 GitHub 上最优质的开源项目转化为普通用户也能轻松理解和使用的消费级应用。
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Shield className="size-5 text-blue-500" />
              </div>
              <h2 className="text-xl font-bold">透明可信</h2>
              <p className="text-muted-foreground leading-relaxed">
                每款软件的安装包都直接来自 GitHub 官方 Release 页面，我们展示项目原始的 SHA-256 校验码和源码链接，
                供你下载后自行核对文件完整性。所有内容由 AI 辅助生成，我们绝不分发含有恶意代码或捆绑广告的软件。
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y bg-secondary/10 px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center text-2xl font-bold">数据来源</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-6">
                <div className="mb-3 text-2xl font-bold text-muted-foreground">01</div>
                <h3 className="mb-2 font-semibold">GitHub 采集</h3>
                <p className="text-sm text-muted-foreground">
                  每日自动抓取 GitHub Trending 和 Awesome 列表中的优质项目
                </p>
              </div>
              <div className="rounded-xl border bg-card p-6">
                <div className="mb-3 text-2xl font-bold text-muted-foreground">02</div>
                <h3 className="mb-2 font-semibold">AI 提纯</h3>
                <p className="text-sm text-muted-foreground">
                  利用大模型将技术文档转化为通俗易懂的中文说明
                </p>
              </div>
              <div className="rounded-xl border bg-card p-6">
                <div className="mb-3 text-2xl font-bold text-muted-foreground">03</div>
                <h3 className="mb-2 font-semibold">社区共建</h3>
                <p className="text-sm text-muted-foreground">
                  用户可提交软件推荐和纠错反馈，共同维护平台内容质量
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="mb-6 text-2xl font-bold">免责声明</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              OpenSource-Hub 是一个开源软件信息聚合与分发平台。本站不拥有任何软件的版权，
              所有软件均为其各自作者或组织的知识产权。
            </p>
            <p>
              我们仅搬运采用 MIT、Apache 2.0、GPL 等开放协议的项目，并严格遵守其署名要求。
              如果您是某款软件的版权持有者，认为我们的展示侵犯了您的权益，请联系我们处理。
            </p>
            <p>
              本站不对因使用软件造成的数据丢失、系统损坏或其他损失负责。请在下载和使用前仔细阅读软件的开源协议和使用说明。
            </p>
          </div>
        </section>

        {/* Team / Community */}
        <section className="border-t bg-secondary/10 px-4 py-16">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-full bg-muted p-3">
              <Users className="size-6" />
            </div>
            <h2 className="text-2xl font-bold">加入社区</h2>
            <p className="mt-3 text-muted-foreground">
              OpenSource-Hub 是一个社区驱动的项目。欢迎提交软件推荐、纠正 AI 翻译错误、或参与代码贡献。
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                GitHub 仓库
              </a>
              <a
                href="/contact"
                className="rounded-full border px-6 py-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                联系我们
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
