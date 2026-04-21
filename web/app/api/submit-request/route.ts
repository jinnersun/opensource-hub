import { NextResponse } from "next/server"

// 内存存储（mock），后续替换为 D1 数据库
const requests: Array<{
  id: number
  email: string
  description: string
  scenario?: string
  createdAt: string
}> = []

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, description, scenario } = body

    if (!email || !description) {
      return NextResponse.json(
        { error: "邮箱和需求描述为必填项" },
        { status: 400 }
      )
    }

    // 简单的邮箱格式验证
    if (!email.includes("@")) {
      return NextResponse.json(
        { error: "请输入有效的邮箱地址" },
        { status: 400 }
      )
    }

    // 存储请求（mock 存储）
    const newRequest = {
      id: requests.length + 1,
      email,
      description,
      scenario: scenario || null,
      createdAt: new Date().toISOString(),
    }
    requests.push(newRequest)

    // TODO: 后续接入 D1 数据库
    // await db.insert(userRequests).values(newRequest)

    console.log("New request submitted:", newRequest)

    return NextResponse.json(
      { success: true, id: newRequest.id },
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
  // TODO: 添加认证后才能查看，仅用于测试
  return NextResponse.json({ requests })
}
