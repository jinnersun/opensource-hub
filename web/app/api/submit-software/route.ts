import { NextResponse } from "next/server"

// 内存存储（mock），后续替换为 D1 数据库
const softwareSubmissions: Array<{
  id: number
  name: string
  repoUrl: string
  description: string
  email?: string
  createdAt: string
}> = []

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, repoUrl, description, email } = body

    if (!name || !repoUrl || !description) {
      return NextResponse.json(
        { error: "软件名称、仓库链接和功能描述为必填项" },
        { status: 400 }
      )
    }

    if (!repoUrl.includes("github.com")) {
      return NextResponse.json(
        { error: "请提供有效的 GitHub 仓库链接" },
        { status: 400 }
      )
    }

    const newSubmission = {
      id: softwareSubmissions.length + 1,
      name,
      repoUrl,
      description,
      email: email || null,
      createdAt: new Date().toISOString(),
    }
    softwareSubmissions.push(newSubmission)

    console.log("New software submitted:", newSubmission)

    return NextResponse.json(
      { success: true, id: newSubmission.id },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { error: "提交失败" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ submissions: softwareSubmissions })
}
