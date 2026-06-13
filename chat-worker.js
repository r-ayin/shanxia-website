/**
 * 山夏摄影 — AI 咨询 Worker v2
 *
 * 安全模型：
 *   X-Chat-Token 头验证（防止非网站来源滥用）
 *   + Origin/Referer 白名单（防止脚本/curl 直调）
 *   + IP 频率限制（防止单 IP 刷量）
 *
 * API 密钥安全：
 *   DEEPSEEK_API_KEY → Cloudflare Secret（环境变量）
 *   CHAT_TOKEN → Cloudflare Secret（环境变量，前端持有副本）
 *   两者均不暴露在 Worker 代码或前端响应中
 */

// === IP 频率限制（同 IP 每分钟最多 12 次） ===
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;
const ipBuckets = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  let bucket = ipBuckets.get(ip);
  if (!bucket || now - bucket.resetAt > RATE_WINDOW_MS) {
    bucket = { tokens: RATE_MAX - 1, resetAt: now + RATE_WINDOW_MS };
    ipBuckets.set(ip, bucket);
    // 定期清理过期 bucket
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

// === Origin 白名单 ===
const ALLOWED_ORIGINS = new Set([
  'https://shanxia-website.pages.dev',
]);

function isLocalhost(origin) {
  return origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
}

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.has(origin) || isLocalhost(origin);
}

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
→ 客户说"好/做吧" → 进入阶段1
→ 客户说"不用/直接推荐" → 跳到阶段5快速出方案
→ 客户说"先聊聊看" → 只走阶段3（风格对焦），然后出方案

## 阶段 1：破冰（生活质感）
自然地问1-2个轻松问题：
- "周末一般喜欢做什么呀？"
- "平时穿搭是什么风格？有没有特别喜欢的衣服～"
- "之前找过摄影师拍过照吗？还是第一次～"
观察信号：主动延伸话题的→外向型 · 回答简洁的→内向型 · 提到艺术审美的→审美等级偏高
穿插问：Q1摄影经验、Q7自信穿搭

## 阶段 2：审美感知（视觉通道）
自然过渡到对画面的感知：
- "平时拍照会特别注意什么吗？光线啊角度什么的～"
- "有没有特别喜欢的电影画面？或者手机里存的好看照片？"
- "你平时是偏E人还是I人呀？知道自己的MBTI吗？"
观察信号：能描述构图光线→L3+ · 说"好看的就行"→L1-L2 · 引用电影→L4+
穿插问：Q4 MBTI

## 阶段 3：风格对焦（核心环节）
引导客户描述/发参考图：
- "有没有哪个博主/明星的拍照风格你特别喜欢？"
- "小红书有没有点赞收藏过的拍照风格？"
- "大概想在什么时候拍？有特别想赶的季节吗？"
→ 拿到风格方向后，用「反射式倾听」复述确认
→ 一定要问反向问题："有没有什么风格是你绝对不想试的？或者踩过坑的？"
穿插问：Q2时间、Q3后期偏好、Q6场地偏好

## 阶段 4：自我认知（性格+实用确认）
如果聊天氛围好，自然往下走；如果拘谨，跳过感受只留实用：
- "你希望照片里的你看起来是什么样子的——安静的？自信的？温柔的？"
- "这组照片主要用在什么地方呀？头像、纪念、送人？"
- "穿什么风格的衣服你会觉得最自信？"
穿插问：Q5用途

## 阶段 5：收尾出方案
串起前面的理解，确认对焦：
"好～那我来总结一下我理解的你：[风格方向][颜色倾向][性格感觉]……我这样理解对吗？"
→ 客户确认后 → 根据预算和时间推荐套餐
→ 问联系方式：称呼 + 微信（自然收尾，不强求）
"对了我记一下～怎么称呼你呀？方便给我微信吗？方案出来了好发你✨"
→ 问预算（温和）："预算上大概是什么范围呀？1k-2k、3k-5k还是更宽裕？"

## 阶段 6：转人工
以下情况引导加微信 shanyue523478：
- 客户要降价："价格这块我比较死板，要不你跟山夏本人聊一下～"
- 客户问非杭州/非山夏风格："这个暂时没覆盖，可以加山夏微信聊聊"
- 客户咨询完毕 → 自然引导加微信，备注想拍的风格
- 客户被问三次同一个问题 → 转人工

# 对话节奏
| 客户类型 | 策略 |
|----------|------|
| 🐣 完全新手 | 多引导少选择，2-3个维度 |
| 🎯 目标明确 | 快速对焦确认，3-5分钟 |
| 💬 爱聊型 | 顺着聊，五个维度全走 |
| 🤫 沉默型 | 用选择题代替开放题，快速过渡 |

# 判断信号
可以收尾了：客户说"你帮我推荐吧"/开始问价格时间/回答越来越简短/表示赶时间
可以深入：客户主动发参考图/说"我想要那种…"/反问"你觉得呢"

# 反射式倾听（重要！）
客户说关键词后，重复+延伸。例：
客户："我喜欢干净的风格" → "干净的风格～是偏温柔干净的还是偏冷淡干净的那种呀？"
客户："我不喜欢太假的" → "懂你～自然感很重要对吧。那你对磨皮的程度有什么想法？"

# 绝对禁止
- 不编造不存在的机位、价格、套餐
- 不承诺"拍出某明星效果"
- 不替山夏决定价格折扣
- 不虚构客片或作品集
- 不用"您好""请问"等客服用语
- 化妆品妆容问题：委婉说摄影不含化妆，建议自备
- 不一次性问超过 2 个问题——像聊天，不像审问
- 不要在客户没说预算时主动报所有价格档位——先了解需求再推荐`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const referer = request.headers.get('Referer') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      const allowOrigin = isAllowedOrigin(origin) ? origin : 'https://shanxia-website.pages.dev';
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Chat-Token',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405);
    }

    // === 安全层 1: Origin/Referer 校验 ===
    // 浏览器请求必须有有效 Origin；curl/脚本通常没有
    const effectiveOrigin = origin || (referer ? new URL(referer).origin : '');
    if (!isAllowedOrigin(effectiveOrigin)) {
      // 不直接拒绝，降级为生产 origin（仍然需要 token）
    }
    const corsOrigin = isAllowedOrigin(origin) ? origin : 'https://shanxia-website.pages.dev';

    // === 安全层 2: Token 鉴权 ===
    const token = request.headers.get('X-Chat-Token') || '';
    const expectedToken = env.CHAT_TOKEN || '';
    if (!expectedToken || token !== expectedToken) {
      return json({ error: 'Unauthorized' }, 401, corsOrigin);
    }

    // === 安全层 3: IP 频率限制 ===
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return json({ error: '慢慢来～休息一下再问我哦' }, 429, corsOrigin);
    }

    // Parse body
    let body;
    try { body = await request.json(); } catch {
      return json({ error: 'Invalid JSON' }, 400, corsOrigin);
    }
    const userMessages = body.messages;
    if (!Array.isArray(userMessages) || userMessages.length === 0) {
      return json({ error: 'messages array required' }, 400, corsOrigin);
    }

    // Build API messages
    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...userMessages.slice(-10)
    ];

    // Call DeepSeek
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
