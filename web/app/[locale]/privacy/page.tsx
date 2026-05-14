import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Link } from '@/i18n/routing'
import { Shield, Server, Brain, Cookie, Trash2, Mail, Github } from "lucide-react"

export const metadata = {
  title: "隐私政策 - OpenSource-Hub",
  description: "了解 OpenSource-Hub 如何收集、使用和保护您的个人信息，以及我们的数据存储、AI 使用和 Cookie 政策。",
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="border-b bg-secondary/20 px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-full bg-muted p-4">
              <Shield className="size-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">隐私政策</h1>
            <p className="mt-4 text-lg text-muted-foreground">我们尊重并保护每一位用户的隐私</p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16">
          <div className="space-y-12">

            {/* 1. 概述 */}
            <div>
              <h2 className="mb-4 text-xl font-bold">概述</h2>
              <p className="text-muted-foreground leading-relaxed">
                OpenSource-Hub（以下简称 &quot;本站&quot;）非常重视用户的隐私保护。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。使用本站即表示您同意本政策的条款。
              </p>
            </div>

            {/* 2. 数据存储与全球传输 */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Server className="size-5 text-blue-500" />
                <h2 className="text-xl font-bold">数据存储与全球传输</h2>
              </div>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  本站运行在 <strong className="text-foreground">Cloudflare 全球边缘网络</strong> 之上，核心数据存储在 Cloudflare D1（全球分布式 SQLite 数据库）和 Cloudflare KV（键值存储）中。
                </p>
                <p>
                  当您访问本站时，您的请求将由离您最近的 Cloudflare 边缘节点处理。这意味着您的数据可能在您所在国家/地区之外的服务器上被临时处理。Cloudflare 作为我们的基础设施提供商，已通过 ISO 27001、SOC 2 等国际安全认证。
                </p>
                <p>
                  我们仅在以下情况存储个人信息：您主动提交软件推荐或功能需求时提供的邮箱地址。这些数据存储在 D1 数据库中，未加密的传输通过 HTTPS 保护。
                </p>
              </div>
            </div>

            {/* 3. AI 与自动化处理 */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Brain className="size-5 text-violet-500" />
                <h2 className="text-xl font-bold">AI 技术与自动化处理</h2>
              </div>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  本站使用人工智能技术（包括 <strong className="text-foreground">DeepSeek</strong> 大语言模型和 Cloudflare Workers AI 翻译模型）来自动化处理以下内容：
                </p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong className="text-foreground">开源软件元数据：</strong>
                    对 GitHub 公开仓库的 README 和技术文档进行自动化摘要、分类和翻译，生成面向普通用户的结构化说明。
                  </li>
                  <li>
                    <strong className="text-foreground">搜索意图理解：</strong>
                    使用向量嵌入技术（Cloudflare Vectorize）将您的搜索词转换为语义向量，以提供更精准的搜索匹配。
                  </li>
                </ul>
                <p>
                  <strong className="text-foreground">重要声明：</strong>
                  所有 AI 处理仅针对公开的开源软件元数据（项目名称、README、Star 数量等），<strong>不涉及您的个人身份信息</strong>。您的搜索词仅用于当前搜索会话，不会被用于 AI 模型训练。
                </p>
              </div>
            </div>

            {/* 4. 我们收集的信息 */}
            <div>
              <h2 className="mb-4 text-xl font-bold">我们收集的信息</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <ul className="ml-6 list-disc space-y-3">
                  <li>
                    <strong className="text-foreground">浏览数据：</strong>
                    包括匿名化的访问日志（IP 地址哈希、User-Agent、访问时间），用于安全防护和流量分析。
                  </li>
                  <li>
                    <strong className="text-foreground">搜索记录：</strong>
                    您在本站使用的搜索关键词，仅以匿名聚合形式存储（不关联个人身份），用于优化搜索算法和推荐策略。
                  </li>
                  <li>
                    <strong className="text-foreground">下载行为：</strong>
                    匿名化的点击和下载数据，用于了解软件热度趋势。
                  </li>
                  <li>
                    <strong className="text-foreground">用户提交：</strong>
                    当您主动提交软件推荐或功能需求时，我们会收集您提供的邮箱地址和描述内容，仅用于回复您的请求。
                  </li>
                </ul>
              </div>
            </div>

            {/* 5. Cookie 与追踪技术 */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Cookie className="size-5 text-amber-500" />
                <h2 className="text-xl font-bold">Cookie 与追踪技术</h2>
              </div>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  本站使用 Cookie 和浏览器本地存储（LocalStorage）来提供基本功能。我们将其分为两类：
                </p>
                <div className="ml-6 space-y-3">
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold text-foreground mb-1">必要性 Cookie</h3>
                    <ul className="list-disc ml-4 space-y-1 text-sm">
                      <li>深色/浅色主题偏好（存储在 LocalStorage 中）</li>
                      <li>语言选择偏好（通过 URL 路径和 LocalStorage）</li>
                      <li>这些 Cookie 是网站正常运行所必需的，无法禁用</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold text-foreground mb-1">分析类 Cookie</h3>
                    <ul className="list-disc ml-4 space-y-1 text-sm">
                      <li>本站使用 <strong>Cloudflare Web Analytics</strong>（隐私优先的分析工具）来了解页面访问量和流量来源</li>
                      <li>这些数据不含个人身份信息，不设追踪 Cookie，不使用指纹识别</li>
                      <li>我们可能在未来接入 Google Search Console 以监控搜索引擎收录状态</li>
                    </ul>
                  </div>
                </div>
                <p>您可以通过浏览器设置拒绝非必要性 Cookie，但这不会影响本站核心功能的正常使用。</p>
              </div>
            </div>

            {/* 6. 信息使用与共享 */}
            <div>
              <h2 className="mb-4 text-xl font-bold">信息使用与共享</h2>
              <p className="mb-3 text-muted-foreground leading-relaxed">
                我们使用收集的信息用于：提供服务与改进、分析匿名趋势、响应您的反馈、安全防护。
              </p>
              <p className="text-muted-foreground leading-relaxed">
                我们<strong>不会</strong>将您的个人信息出售、交易或转让给第三方。仅在以下情况共享：获得您的明确同意、法律法规要求、保护本站合法权益。
              </p>
            </div>

            {/* 7. 开源元数据说明 */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Github className="size-5 text-slate-600" />
                <h2 className="text-xl font-bold">开源元数据来源</h2>
              </div>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  本站展示的所有开源软件信息（包括项目名称、描述、Star 数量、开源协议类型、作者信息等）均来源于 <strong>GitHub 公开 API</strong>。我们尊重所有原作者的知识产权和开源协议。
                </p>
                <p>
                  我们的自动化管道（ETL）会定期从 GitHub 获取公开仓库的元数据，并通过 AI 生成通俗化的中文说明。如果您是某个项目的原作者，认为我们的展示侵犯了您的权益，请通过下方联系方式告知，我们将在 7 个工作日内处理。
                </p>
              </div>
            </div>

            {/* 8. 数据保留与删除 */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Trash2 className="size-5 text-red-500" />
                <h2 className="text-xl font-bold">数据保留与删除</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                我们会保留您的个人信息直到实现收集目的所必需的期限。您可以随时要求删除您的个人数据，我们将在合理时间内处理。
              </p>
            </div>

            {/* 9. 联系我们 */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Mail className="size-5 text-emerald-500" />
                <h2 className="text-xl font-bold">联系我们</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                如果您对本隐私政策有任何疑问，或希望行使您的数据权利（查看、修改、删除），请通过
                <Link href="/contact" className="mx-1 text-foreground underline">联系我们页面</Link>
                与我们取得联系。
              </p>
            </div>

            {/* 10. 政策更新 */}
            <div className="rounded-xl border bg-secondary/20 p-6">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">政策更新：</strong>
                我们可能会不时更新本隐私政策。重大变更将通过网站公告通知。
                最后更新日期：2026 年 5 月 14 日。
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
