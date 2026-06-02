/**
 * HTTP 响应工具函数
 */

// CORS 响应头
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

// 创建 JSON 响应
export function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...extraHeaders,
    },
  })
}

// 创建错误响应
export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status)
}

// 处理 OPTIONS 请求（CORS 预检）
export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}
