/**
 * 山夏摄影 — AI 咨询 Worker v4 (D1)
 * 安全：Token+Origin+IP限速 · 并发：3会话 · 存储：D1数据库
 */
const MAX_SESSIONS = 3;
const SESSION_TIMEOUT_MS = 120_000;
const sessions = new Map();
function cleanSessions(now) { for (const [id, s] of sessions) { if (now - s.lastActive > SESSION_TIMEOUT_MS) sessions.delete(id); } }

const RATE_WINDOW_MS = 60_000, RATE_MAX = 6;
const ipBuckets = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  let b = ipBuckets.get(ip);
  if (!b || now - b.resetAt > RATE_WINDOW_MS) {
    b = { tokens: RATE_MAX - 1, resetAt: now + RATE_WINDOW_MS };
    ipBuckets.set(ip, b);
    if (ipBuckets.size > 500) { for (const [k, v] of ipBuckets) { if (now - v.resetAt > RATE_WINDOW_MS * 2) ipBuckets.delete(k); } }
    return true;
  }
  if (b.tokens <= 0) return false;
  b.tokens--;
  return true;
}

const ALLOWED_ORIGINS = new Set(['https://shanxia-website.pages.dev']);
const isLocalhost = o => o.startsWith('http://localhost:') || o.startsWith('http://127.0.0.1:');
const isAllowedOrigin = o => ALLOWED_ORIGINS.has(o) || isLocalhost(o);

const SYSTEM_PROMPT = `# 身份
你是山夏的AI小助理。山夏是杭州独立女摄影师（90后），擅长新中式、国风、人文安静风格。
你的任务不是推销——而是像朋友一样聊天，帮她了解客户，也让客户了解自己。

# 人格
- 说话亲昵、可爱、体贴，像好朋友在耳边出主意
- 用"啦～呀～呢～哟～吧～"等语气词，偶尔用🌸✨💕
- 用"你"不用"您"
- 每条回复 2-4 句，不写小作文

# 核心信息（实际需要时才说）
- 价格：学生¥399/h起 · 标准¥499/h起 · 半天¥1,300起 · 全天¥3,000起 · 学生8折
- 预约定金50%，免费改期一次（提前48h），极端天气无条件改期
- 交付：原片3工作日 · 精修7-14工作日
- 微信：shanyue523478 · 网站：shanxia-website.pages.dev
- 不含妆造——委婉说明摄影不含化妆，建议自备

# 对话流程
阶段0开场→阶段1破冰→阶段2审美→阶段3风格对焦(核心)→阶段4自我认知→阶段5收尾→阶段6转人工
核心：反射式倾听(关键词重复+延伸) · 一定问反向问题(不想要什么)

# 绝对禁止
不编造 · 不承诺 · 不代定折扣 · 不用"您好""请问" · 一次不问超2个问题`;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const corsOrigin = isAllowedOrigin(origin) ? origin : 'https://shanxia-website.pages.dev';
    const db = env.DB;

    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Chat-Token, X-Session-Id, X-Admin-Token',
        'Access-Control-Max-Age': '86400'
      }});
    }

    // === GET: 查询对话记录 ===
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const token = request.headers.get('X-Admin-Token') || url.searchParams.get('token') || '';
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: 'Unauthorized' }, 401, corsOrigin);
      if (!db) return json({ error: 'DB not available' }, 503, corsOrigin);

      const sid = url.searchParams.get('session') || '';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

      try {
        if (sid) {
          const msgs = await db.prepare(`SELECT role, content, created_at FROM messages WHERE session_id=?1 ORDER BY created_at ASC LIMIT ?2`).bind(sid, limit).all();
          const s = await db.prepare(`SELECT * FROM sessions WHERE id=?1`).bind(sid).first();
          return json({ session: s, messages: msgs.results }, 200, corsOrigin);
        }
        const list = await db.prepare(`SELECT id, ip, created_at, last_active_at, message_count FROM sessions ORDER BY last_active_at DESC LIMIT ?1`).bind(limit).all();
        return json({ sessions: list.results }, 200, corsOrigin);
      } catch (e) { return json({ error: e.message }, 500, corsOrigin); }
    }

    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, corsOrigin);

    // Token 鉴权
    const ctoken = request.headers.get('X-Chat-Token') || '';
    if (!env.CHAT_TOKEN || ctoken !== env.CHAT_TOKEN) return json({ error: 'Unauthorized' }, 401, corsOrigin);

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // Parse
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, corsOrigin); }

    // Disconnect
    if (body.action === 'disconnect' && body.sessionId) {
      sessions.delete(body.sessionId);
      return json({ ok: true, active: sessions.size }, 200, corsOrigin);
    }

    // Concurrency
    const sessionId = request.headers.get('X-Session-Id') || '';
    const now = Date.now();
    cleanSessions(now);
    if (!(sessionId && sessions.has(sessionId)) && sessions.size >= MAX_SESSIONS) {
      return json({ error: 'busy', message: 'AI 小助理正在跟别人聊天～稍等一下就好，或者直接加山夏微信 shanyue523478', active: sessions.size, max: MAX_SESSIONS }, 503, corsOrigin);
    }
    if (sessionId) sessions.set(sessionId, { ip, lastActive: now });

    // Rate limit
    if (!checkRateLimit(ip)) return json({ error: '慢慢来～休息一下再问我哦' }, 429, corsOrigin);

    const msgs = body.messages;
    if (!Array.isArray(msgs) || msgs.length === 0) return json({ error: 'messages required' }, 400, corsOrigin);
    if (!env.DEEPSEEK_API_KEY) return json({ error: 'Service not configured' }, 503, corsOrigin);

    // 写用户消息到 D1（await 确保写入完成）
    const lastUser = [...msgs].reverse().find(m => m.role === 'user');
    if (lastUser && db && sessionId) {
      const ts = Date.now();
      try {
        await db.prepare(`INSERT INTO sessions (id, ip, created_at, last_active_at, message_count) VALUES (?1,?2,?3,?3,0) ON CONFLICT(id) DO UPDATE SET last_active_at=?3`).bind(sessionId, ip, ts).run();
        await db.prepare(`INSERT INTO messages (session_id, role, content, created_at) VALUES (?1,'user',?2,?3)`).bind(sessionId, lastUser.content, ts).run();
      } catch (e) { console.error('D1 user write:', e); }
    }

    const apiMsgs = [{ role: 'system', content: SYSTEM_PROMPT }, ...msgs.slice(-10)];

    const dsResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: apiMsgs, stream: true, temperature: 0.75, max_tokens: 500 })
    });
    if (!dsResp.ok) return json({ error: 'AI error' }, 502, corsOrigin);

    // Stream + 攒回复写 D1
    const reader = dsResp.body.getReader();
    const dec = new TextDecoder();
    let reply = '';

    const stream = new ReadableStream({
      async start(ctrl) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            ctrl.enqueue(value);
            for (const line of dec.decode(value, { stream: true }).split('\n')) {
              if (line.startsWith('data: ') && line.slice(6) !== '[DONE]') {
                try { reply += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || ''; } catch {}
              }
            }
          }
          ctrl.close();
          if (reply && db && sessionId) {
            db.prepare(`INSERT INTO messages (session_id, role, content, created_at) VALUES (?1,'assistant',?2,?3)`).bind(sessionId, reply, Date.now()).run().catch(() => {});
            db.prepare(`UPDATE sessions SET message_count=message_count+1 WHERE id=?1`).bind(sessionId).run().catch(() => {});
          }
        } catch (e) { ctrl.error(e); }
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }
};

function json(data, status = 200, origin = 'https://shanxia-website.pages.dev') {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin } });
}
