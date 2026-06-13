/**
 * 山夏摄影 — AI 咨询 Worker
 * 代理 DeepSeek API，注入 skill 的咨询系统 prompt
 * 安全：DEEPSEEK_API_KEY 仅在 Cloudflare Secret 中，永不暴露到前端
 * 鉴权：X-Chat-Token 头验证，防止非网站来源滥用
 */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Allowed origins
    const allowedOrigins = [
      'https://shanxia-website.pages.dev',
    ];
    const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    const corsOrigin = isLocalhost ? origin : (allowedOrigins.includes(origin) ? origin : 'https://shanxia-website.pages.dev');

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(corsOrigin, 'POST, OPTIONS', 'Content-Type, X-Chat-Token')
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405, corsOrigin);
    }

    // Token 鉴权 — CHAT_TOKEN 存储在 Worker 环境变量中
    const token = request.headers.get('X-Chat-Token') || '';
    const expectedToken = env.CHAT_TOKEN || '';
    if (!expectedToken || token !== expectedToken) {
      return json({ error: 'Unauthorized' }, 401, corsOrigin);
    }

    // Parse body
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, corsOrigin); }
    const userMessages = body.messages;
    if (!Array.isArray(userMessages) || userMessages.length === 0) {
      return json({ error: 'messages array required' }, 400, corsOrigin);
    }

    // System prompt
    const systemPrompt = `你是山夏摄影的AI小助理，帮独立摄影师山夏（90后女摄，杭州）做拍摄前的初步咨询。
你说话亲昵、可爱、体贴，像好朋友在耳边说话，用"啦～呀～呢～哟～吧"等语气词，偶尔用🌸✨💕等emoji。

## 核心信息
- 山夏：杭州独立女摄，擅长新中式、国风、人文安静风格。发现顾客独特原生的美。
- 价格：学生¥399/小时起，标准¥499/小时起。半天4小时¥1,300起，全天8小时¥3,000起。学生8折。
- 交付：原片3个工作日，精修片7-14个工作日。
- 微信：shanyue523478
- 定金50%，可免费改期一次（提前48h），极端天气无条件改期。
- 网站：https://shanxia-website.pages.dev（作品集、套餐详情、geo问答页）
- 不含妆造，顾客自备衣物和妆容。被问到化妆，委婉说明摄影不含化妆并建议自备。

## 工作流程
1. 了解对方想拍什么：写真/情侣/闺蜜/cosplay/旅拍？人数？时间限制？
2. 对方不确定风格 → 引导聊审美偏好、喜欢什么感觉的照片
3. 对方说预算 → 匹配档位推荐
4. 对方没提预算 → 先推荐标准档，末尾问"如果有预算范围可以告诉我，帮你重新估算～"
5. 对方要降价 → 转人工："价格这块我比较死板，要不你跟山夏本人聊一下？微信shanyue523478"
6. 对方问非杭州/非山夏风格 → 诚实说不在服务范围
7. 咨询完毕 → 引导加微信shanyue523478，备注想拍的风格

## 绝对禁止
- 不编造机位/价格/套餐
- 不承诺"拍出某明星效果"
- 不替山夏决定价格折扣
- 不虚构客片/作品集
- 不用"您好""请问"等客服用语——用"你"不用"您"
- 妆容妆造委婉拒绝，引导自备

回复简洁，像朋友聊天，每次2-4句话。`;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...userMessages.slice(-8)
    ];

    // Call DeepSeek API — key from env (never exposed)
    if (!env.DEEPSEEK_API_KEY) {
      return json({ error: 'Service not configured' }, 503, corsOrigin);
    }

    const deepseekResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: apiMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 600
      })
    });

    if (!deepseekResp.ok) {
      return json({ error: 'AI service error' }, 502, corsOrigin);
    }

    return new Response(deepseekResp.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders(corsOrigin)
      }
    });
  }
};

function corsHeaders(origin, methods, allowHeaders) {
  return {
    'Access-Control-Allow-Origin': origin,
    ...(methods ? { 'Access-Control-Allow-Methods': methods } : {}),
    ...(allowHeaders ? { 'Access-Control-Allow-Headers': allowHeaders, 'Access-Control-Max-Age': '86400' } : {})
  };
}

function json(data, status = 200, origin = 'https://shanxia-website.pages.dev') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin
    }
  });
}
