/**
 * 山夏摄影 — AI 咨询 Worker v3
 *
 * 安全模型：
 *   X-Chat-Token 鉴权 + Origin 白名单 + IP 频率限制
 * 并发模型：
 *   最多 3 个活跃会话。满员 → 返回 503「AI 离线」。
 *   会话 2 分钟无活动自动释放，关闭后下一人顶上。
 *
 * API 密钥：DEEPSEEK_API_KEY + CHAT_TOKEN 仅存 Cloudflare Secret
 */

// === 并发会话管理 ===
const MAX_SESSIONS = 3;
const SESSION_TIMEOUT_MS = 120_000; // 2 分钟无活动释放
const sessions = new Map(); // sessionId → { ip, lastActive }

function cleanSessions(now) {
  for (const [id, s] of sessions) {
    if (now - s.lastActive > SESSION_TIMEOUT_MS) sessions.delete(id);
  }
}

function activeCount() {
  const now = Date.now();
  cleanSessions(now);
  return sessions.size;
}

// === IP 频率限制 ===
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6;
const ipBuckets = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  let bucket = ipBuckets.get(ip);
  if (!bucket || now - bucket.resetAt > RATE_WINDOW_MS) {
    bucket = { tokens: RATE_MAX - 1, resetAt: now + RATE_WINDOW_MS };
    ipBuckets.set(ip, bucket);
    if (ipBuckets.size > 1000) {
      for (const [k, v] of ipBuckets) {
        if (now - v.resetAt > RATE_WINDOW_MS * 2) ipBuckets.delete(k);
      }
    }
    return true;
  }
  if (bucket.tokens <= 0) return false;
  bucket.tokens--;
  return true;
}

// === Origin ===
const ALLOWED_ORIGINS = new Set(['https://shanxia-website.pages.dev']);
const isLocalhost = o => o.startsWith('http://localhost:') || o.startsWith('http://127.0.0.1:');
const isAllowedOrigin = o => ALLOWED_ORIGINS.has(o) || isLocalhost(o);

// === 系统提示词 ===
const SYSTEM_PROMPT = `# 身份
你是山夏的AI小助理。山夏是杭州独立女摄影师（90后），擅长新中式、国风、人文安静风格。
你的任务不是推销——而是像朋友一样聊天，帮她了解客户，也让客户了解自己。

# 人格
- 说话亲昵、可爱、体贴，像好朋友在耳边出主意
- 用"啦～呀～呢～哟～吧～"等语气词，偶尔用🌸✨💕
- 用"你"不用"您"
- 每条回复 2-4 句，不写小作文
- 称呼客户时用"你呀""小可爱""姐妹"等亲昵词（不要过度）

# 核心信息（只在实际需要时才说，不要上来就报价格）
- 价格：学生¥399/小时起 · 标准¥499/小时起 · 半天¥1,300起 · 全天¥3,000起 · 学生8折
- 预约定金50%，可免费改期一次（提前48h），极端天气无条件改期
- 交付：原片3个工作日 · 精修片7-14个工作日
- 微信：shanyue523478
- 网站：shanxia-website.pages.dev
- 不含妆造——委婉说明摄影不含化妆，建议自备衣物妆容

# 对话流程（自然引导，不机械执行）

## 阶段 0：开场欢迎
客户说第一句话（如"想拍写真"）后，先简短欢迎，然后给两个选项引导进入：
"好呀～在给你出方案之前，我可以先跟你聊几分钟，帮你搞清楚自己最适合什么风格、什么感觉～
你要不要试试看？不想做也没关系，我们直接聊方案也行～"
→ "好/做吧" → 阶段1
→ "不用/直接推荐" → 跳到阶段5快速出方案
→ "先聊聊看" → 只走阶段3然后出方案

## 阶段 1：破冰
自然问1-2个轻松问题。穿插Q1摄影经验、Q7自信穿搭。

## 阶段 2：审美感知
过渡到画面感知，穿插Q4 MBTI。

## 阶段 3：风格对焦（核心）
引导发参考图 → 反射式倾听复述 → 一定问反向问题。穿插Q2时间、Q3后期、Q6场地。

## 阶段 4：自我认知
如果氛围好往下走；拘谨就跳过感受。穿插Q5用途。

## 阶段 5：收尾出方案
串起理解确认 → 推荐套餐 → 问联系方式 + 预算 → 引导加微信shanyue523478。

## 阶段 6：转人工
降价/非杭州/咨询完毕 → 引导加微信shanyue523478。

# 对话节奏
🐣新手→多引导少选择 | 🎯明确→快速对焦 | 💬爱聊→全走 | 🤫沉默→选择题代替开放题

# 反射式倾听（重要！）
客户关键词 → 重复+延伸。例："喜欢干净的风格" → "干净的风格～偏温柔干净还是冷淡干净？"

# 绝对禁止
不编造机位/价格/套餐 · 不承诺"明星效果" · 不代定折扣 · 不虚构客片
不用"您好""请问" · 妆容委婉拒绝 · 一次不问超2个问题 · 不主动报全价格档位`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsOrigin = isAllowedOrigin(origin) ? origin : 'https://shanxia-website.pages.dev';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Chat-Token, X-Session-Id',
        'Access-Control-Max-Age': '86400'
      }});
    }

    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, corsOrigin);

    // Token 鉴权
    const token = request.headers.get('X-Chat-Token') || '';
    if (!env.CHAT_TOKEN || token !== env.CHAT_TOKEN) {
      return json({ error: 'Unauthorized' }, 401, corsOrigin);
    }

    // IP 频率限制（仅对正常请求计数，busy 的不计入）
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // Parse body
    let body;
    try { body = await request.json(); } catch {
      return json({ error: 'Invalid JSON' }, 400, corsOrigin);
    }

    // === 断开信号：立即释放槽位 ===
    if (body.action === 'disconnect' && body.sessionId) {
      sessions.delete(body.sessionId);
      return json({ ok: true, active: sessions.size }, 200, corsOrigin);
    }

    // === 并发控制 ===
    const sessionId = request.headers.get('X-Session-Id') || '';
    const now = Date.now();
    cleanSessions(now);

    const isExistingSession = sessionId && sessions.has(sessionId);
    const count = sessions.size;

    if (!isExistingSession && count >= MAX_SESSIONS) {
      return json({
        error: 'busy',
        message: 'AI 小助理正在跟别人聊天～稍等一下就好，或者直接加山夏微信 shanyue523478',
        active: count,
        max: MAX_SESSIONS
      }, 503, corsOrigin);
    }

    // 注册/续期会话
    if (sessionId) {
      sessions.set(sessionId, { ip, lastActive: now });
    }

    // IP 频率限制
    if (!checkRateLimit(ip)) {
      return json({ error: '慢慢来～休息一下再问我哦' }, 429, corsOrigin);
    }

    const userMessages = body.messages;
    if (!Array.isArray(userMessages) || userMessages.length === 0) {
      return json({ error: 'messages array required' }, 400, corsOrigin);
    }

    if (!env.DEEPSEEK_API_KEY) {
      return json({ error: 'Service not configured' }, 503, corsOrigin);
    }

    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...userMessages.slice(-10)
    ];

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
        temperature: 0.75,
        max_tokens: 500
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
        'Access-Control-Allow-Origin': corsOrigin
      }
    });
  }
};

function json(data, status = 200, origin = 'https://shanxia-website.pages.dev') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin
    }
  });
}
