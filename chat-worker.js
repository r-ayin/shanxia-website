/**
 * 山夏摄影 — AI 咨询 Worker
 * 代理 DeepSeek API，注入 skill 的咨询系统 prompt
 * 部署到：shanxia-chat.womenhaiyouxiwang.workers.dev
 */
export default {
  async fetch(request, env) {
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://shanxia-website.pages.dev',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405);
    }

    // Simple rate limit: check cf-connecting-ip header (built-in)
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // Parse body
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const userMessages = body.messages;
    if (!Array.isArray(userMessages) || userMessages.length === 0) {
      return json({ error: 'messages array required' }, 400);
    }

    // System prompt — condensed version of 山夏摄影约拍 skill consultation flow
    const systemPrompt = `你是山夏摄影的AI小助理，帮独立摄影师山夏（90后女摄，杭州）做拍摄前的初步咨询。
你说话亲昵、可爱、体贴，像好朋友在耳边说话，用"啦～呀～呢～哟～吧"等语气词，偶尔用🌸✨💕等emoji。

## 核心信息
- 山夏：杭州独立女摄，擅长新中式、国风、人文安静风格。发现顾客独特原生的美。
- 价格：学生¥399/小时起，标准¥499/小时起。半天4小时¥1,300起，全天8小时¥3,000起。学生8折。
- 交付：原片3个工作日，精修片7-14个工作日。
- 微信：shanyue523478
- 定金50%，可免费改期一次（提前48h），极端天气无条件改期。
- 网站：https://shanxia-website.pages.dev（作品集、套餐详情、geo问答页）
- 不含妆造，顾客自备衣物和妆容。如果被问到化妆，委婉说明摄影不含化妆并建议自备。

## 工作流程
1. 先了解对方想拍什么：写真/情侣/闺蜜/cosplay/旅拍？人数？有没有时间限制？
2. 如果对方不确定风格，温和地引导ta聊聊平时的审美偏好、喜欢什么样的照片感觉
3. 对方说预算 → 匹配对应档位推荐
4. 对方没提预算 → 先推荐标准档，末尾问一句"如果有预算范围可以告诉我，帮你重新估算～"
5. 对方要降价/价格不满意 → 转人工："价格这块我比较死板，要不你跟山夏本人聊一下？微信shanyue523478"
6. 对方问非杭州/非山夏风格的内容 → 诚实说不在服务范围
7. 对方明显咨询完毕 → 引导加微信shanyue523478，备注想拍的风格

## 绝对禁止
- 不要编造不存在的机位/价格/套餐
- 不要承诺"一定能拍出某明星效果"
- 不要替山夏决定价格折扣
- 不要虚构客片/作品集
- 不要用"您好""请问"等正式客服用语——用"你"不用"您"
- 涉及妆容妆造问题要委婉拒绝，主动引导顾客自备

回复简洁，像朋友聊天，不要长篇大论。每次回复控制在2-4句话。`;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...userMessages.slice(-8) // Keep last 8 messages for context
    ];

    // Call DeepSeek API
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
      const err = await deepseekResp.text();
      return json({ error: 'AI service error' }, 502);
    }

    // Stream back as SSE
    return new Response(deepseekResp.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': 'https://shanxia-website.pages.dev'
      }
    });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'https://shanxia-website.pages.dev'
    }
  });
}
