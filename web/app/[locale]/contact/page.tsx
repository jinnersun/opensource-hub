import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Mail, MessageSquare, Github, Globe, ArrowRight } from "lucide-react"

export const metadata = {
  title: "联系我们 - OpenSource-Hub",
  description: "与 OpenSource-Hub 团队取得联系，提交反馈、合作洽谈或技术咨询。",
}

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-secondary/20 px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-full bg-muted p-4">
              <Mail className="size-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              联系我们
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              有问题、建议或合作意向？我们很乐意听到你的声音
            </p>
          </div>
        </section>

        {/* Contact Methods */}
        <section className="mx-auto max-w-4xl px-4 py-16">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Feedback */}
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                <MessageSquare className="size-5 text-blue-500" />
              </div>
              <h3 className="mb-2 font-semibold">问题反馈</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                发现软件信息有误、链接失效或安全问题？请告诉我们，我们会尽快处理。
              </p>
              <a
                href="mailto:feedback@opensource-hub.com"
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary"
              >
                feedback@opensource-hub.com
                <ArrowRight className="size-3" />
              </a>
            </div>

            {/* Submission */}
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
                <Globe className="size-5 text-violet-500" />
              </div>
              <h3 className="mb-2 font-semibold">提交软件</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                想推荐一款优质开源软件？发送项目链接和简介，审核通过后我们会收录。
              </p>
              <a
                href="mailto:submit@opensource-hub.com"
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary"
              >
                submit@opensource-hub.com
                <ArrowRight className="size-3" />
              </a>
            </div>

            {/* Cooperation */}
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Mail className="size-5 text-emerald-500" />
              </div>
              <h3 className="mb-2 font-semibold">商务合作</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                广告投放、品牌合作、开源项目推广等商业合作事宜。
              </p>
              <a
                href="mailto:biz@opensource-hub.com"
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary"
              >
                biz@opensource-hub.com
                <ArrowRight className="size-3" />
              </a>
            </div>

            {/* GitHub */}
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-slate-500/10">
                <Github className="size-5 text-slate-600" />
              </div>
              <h3 className="mb-2 font-semibold">开源社区</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                我们的代码完全开源，欢迎提交 Issue、PR 或参与讨论。
              </p>
              <a
                href="https://github.com/jinnersun/opensource-hub"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary"
              >
                GitHub 组织主页
                <ArrowRight className="size-3" />
              </a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t bg-secondary/10 px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold">常见问题</h2>
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-6">
                <h3 className="mb-2 font-semibold">如何提交软件？</h3>
                <p className="text-sm text-muted-foreground">
                  您可以通过上方的"提交软件"邮箱发送推荐，或直接在我们的 GitHub 仓库提交 Issue。
                  请提供软件名称、GitHub 仓库链接和简短的功能描述。
                </p>
              </div>
              <div className="rounded-xl border bg-card p-6">
                <h3 className="mb-2 font-semibold">发现软件信息有误怎么办？</h3>
                <p className="text-sm text-muted-foreground">
                  每款软件详情页底部都有"提交反馈"链接，点击即可报告问题。您也可以发送邮件到反馈邮箱。
                </p>
              </div>
              <div className="rounded-xl border bg-card p-6">
                <h3 className="mb-2 font-semibold">下载的软件安全吗？</h3>
                <p className="text-sm text-muted-foreground">
                  我们所有上架的软件都经过自动安全扫描，并展示 SHA256 校验码供您核对。
                  同时提供官方 GitHub 源码链接，确保透明可信。
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
