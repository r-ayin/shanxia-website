/**
 * 山夏摄影 — AI 咨询聊天组件 v3
 * 并发控制：最多 3 人同时聊，满员显示「AI 离线」
 */
(function () {
  if (window.__shanxiaChatLoaded) return;
  window.__shanxiaChatLoaded = true;

  // ===== 配置 =====
  const WORKER_URL = 'https://shanxia-chat.womenhaiyouxiwang.workers.dev';
  const CHAT_TOKEN='b6227973c87099bb34cdb9848ff1300cd78b2ed327bab0b7';
  const PLACEHOLDER = '想拍什么风格？我帮你参谋～';
  const GREETING = `你好呀～我是山夏的AI小助理 🌸

在给你推荐方案之前，我可以先跟你聊几分钟——帮你搞清楚自己最适合什么风格、什么感觉。

你要不要试试看？不想做也没关系，我们直接聊方案也行～`;

  // 会话 ID（每次打开聊天生成新的）
  let sessionId = '';

  // ===== DOM =====
  const style = document.createElement('style');
  style.textContent = `
    .sx-chat-trigger {
      position: fixed; bottom: 28px; right: 24px; z-index: 9998;
      padding: 12px 20px;
      background: var(--accent); color: #fbf6ea;
      border: none; cursor: pointer;
      font-family: var(--serif-body); font-size: 14px;
      letter-spacing: 0.12em;
      box-shadow: 0 14px 40px -10px rgba(139, 58, 31, 0.55);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      border-radius: 4px; display: flex; align-items: center; gap: 8px;
    }
    .sx-chat-trigger:hover { transform: translateY(-3px); box-shadow: 0 20px 50px -12px rgba(139, 58, 31, 0.7); }
    .sx-chat-trigger .sx-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #4ade80; flex-shrink: 0;
      animation: sx-pulse 2s ease-in-out infinite;
    }
    .sx-chat-trigger .sx-dot.offline { background: #94a3b8; animation: none; }
    @keyframes sx-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .sx-chat-panel {
      position: fixed; bottom: 84px; right: 24px; z-index: 9997;
      width: 380px; max-width: calc(100vw - 40px); height: 520px; max-height: calc(100vh - 140px);
      background: var(--bg-base); border: 1px solid var(--ink-line);
      border-radius: 8px; display: flex; flex-direction: column;
      box-shadow: 0 24px 60px -16px rgba(26, 22, 18, 0.3);
      font-family: var(--serif-body); font-size: 14px;
      overflow: hidden; transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .sx-chat-panel.hidden { opacity: 0; transform: translateY(12px); pointer-events: none; }
    .sx-chat-header {
      padding: 16px 18px; border-bottom: 1px solid var(--ink-line);
      display: flex; align-items: center; justify-content: space-between;
      font-family: var(--serif-display); font-size: 15px;
      flex-shrink: 0; background: var(--bg-base);
    }
    .sx-chat-header em { color: var(--accent); font-style: italic; }
    .sx-chat-header button {
      background: none; border: none; cursor: pointer;
      color: var(--ink-faded); font-size: 18px; line-height: 1;
      padding: 2px 6px;
    }
    .sx-chat-body {
      flex: 1; overflow-y: auto; padding: 16px 18px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .sx-chat-body::-webkit-scrollbar { width: 4px; }
    .sx-chat-body::-webkit-scrollbar-thumb { background: var(--ink-line); border-radius: 2px; }
    .sx-msg {
      max-width: 85%; padding: 10px 14px; border-radius: 6px;
      line-height: 1.7; font-size: 13.5px;
    }
    .sx-msg.agent { align-self: flex-start; background: var(--bg-deep); color: var(--ink-primary); border: 1px solid var(--ink-line); }
    .sx-msg.user { align-self: flex-end; background: var(--accent); color: #fbf6ea; }
    .sx-msg.offline {
      align-self: center; text-align: center; padding: 24px 20px;
      color: var(--ink-faded); font-style: italic; font-size: 13px;
    }
    .sx-msg.offline .emoji { font-size: 28px; display: block; margin-bottom: 10px; font-style: normal; }
    .sx-chat-input {
      padding: 12px 18px; border-top: 1px solid var(--ink-line);
      display: flex; gap: 10px; flex-shrink: 0; background: var(--bg-base);
    }
    .sx-chat-input input {
      flex: 1; background: transparent; border: none;
      border-bottom: 1px solid var(--ink-line); padding: 8px 4px;
      font-family: var(--serif-body); font-size: 13.5px;
      color: var(--ink-primary); outline: none;
      transition: border-color 0.3s;
    }
    .sx-chat-input input:focus { border-bottom-color: var(--accent); }
    .sx-chat-input button {
      background: var(--ink-primary); color: var(--bg-base);
      border: none; padding: 8px 14px; border-radius: 4px;
      font-family: var(--sans); font-size: 11px;
      letter-spacing: 0.16em; text-transform: uppercase;
      cursor: pointer; transition: background 0.3s; white-space: nowrap;
    }
    .sx-chat-input button:hover { background: var(--accent); }
    .sx-chat-input button:disabled { opacity: 0.4; cursor: default; }
    @media (max-width: 480px) {
      .sx-chat-panel { width: calc(100vw - 32px); right: 16px; bottom: 80px; height: 440px; }
      .sx-chat-trigger { right: 16px; bottom: 20px; padding: 10px 16px; font-size: 13px; }
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'sx-chat-root';
  document.body.appendChild(root);

  let open = false;
  let messages = [];
  let streaming = false;
  let isOffline = false;

  function render() {
    const offlineDot = isOffline ? 'offline' : '';
    const cm = messages.map((m, i) => {
      if (m.role === 'offline') return `<div class="sx-msg offline" id="sx-msg-${i}"><span class="emoji">💤</span>${escapeHtml(m.content)}</div>`;
      if (m.role === 'agent') return `<div class="sx-msg agent" id="sx-msg-${i}">${escapeHtml(m.content)}</div>`;
      if (m.role === 'user') return `<div class="sx-msg user">${escapeHtml(m.content)}</div>`;
      return '';
    }).join('');

    root.innerHTML = `
      <button class="sx-chat-trigger" id="sx-trigger" aria-label="与山夏聊天">
        <span class="sx-dot ${offlineDot}"></span>${open ? '关闭' : 'AI咨询定制'}
      </button>
      <div class="sx-chat-panel ${open ? '' : 'hidden'}" id="sx-panel">
        <div class="sx-chat-header">
          <span>山夏<em>.小助理</em></span>
          <button id="sx-close" aria-label="关闭">✕</button>
        </div>
        <div class="sx-chat-body" id="sx-body">${cm}</div>
        <div class="sx-chat-input">
          <input id="sx-input" type="text" placeholder="${isOffline ? 'AI 小助理离线中…' : PLACEHOLDER}" maxlength="500" ${isOffline ? 'disabled' : ''} />
          <button id="sx-send" ${streaming || isOffline ? 'disabled' : ''}>发送</button>
        </div>
      </div>
    `;

    document.getElementById('sx-trigger').addEventListener('click', toggle);
    document.getElementById('sx-close').addEventListener('click', closePanel);
    const input = document.getElementById('sx-input');
    if (!isOffline) {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
      document.getElementById('sx-send').addEventListener('click', send);
    }
    if (open && !isOffline) setTimeout(() => input.focus(), 100);
    scrollBody();
  }

  function toggle() {
    if (open) disconnect();  // 关闭前释放槽位
    open = !open;
    if (open) {
      sessionId = 'sx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }
    render();
  }

  function closePanel() {
    disconnect();
    open = false;
    sessionId = '';
    isOffline = false;
    render();
  }

  // 通知 Worker 释放槽位
  function disconnect() {
    if (!sessionId) return;
    const sid = sessionId;
    sessionId = '';
    navigator.sendBeacon(WORKER_URL, JSON.stringify({
      action: 'disconnect',
      sessionId: sid
    }));
  }

  // 关闭标签页也释放
  window.addEventListener('beforeunload', () => {
    if (sessionId) {
      navigator.sendBeacon(WORKER_URL, JSON.stringify({
        action: 'disconnect',
        sessionId: sessionId
      }));
    }
  });

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML.replace(/\n/g, '<br>');
  }

  function addMsg(role, content) {
    messages.push({ role, content });
    if (messages.length > 50) messages = messages.slice(-50);
    render();
    const idx = messages.length - 1;
    const el = document.getElementById('sx-msg-' + idx);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  function scrollBody() {
    const body = document.getElementById('sx-body');
    if (body) body.scrollTop = body.scrollHeight;
  }

  async function send() {
    if (streaming || isOffline) return;
    const input = document.getElementById('sx-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.disabled = true;
    document.getElementById('sx-send').disabled = true;

    addMsg('user', text);
    const agentIdx = messages.length;
    messages.push({ role: 'agent', content: '' });
    render();
    streaming = true;

    const apiMessages = messages
      .filter(m => m.role !== 'typing' && m.role !== 'offline')
      .map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content }));

    try {
      const resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chat-Token': CHAT_TOKEN,
          'X-Session-Id': sessionId
        },
        body: JSON.stringify({ messages: apiMessages })
      });

      // 并发满 → 显示离线
      if (resp.status === 503) {
        let msg = 'AI 小助理正在跟别人聊天，暂时离线～\n稍等一下就好，或者直接加山夏微信：shanyue523478';
        try {
          const body = await resp.json();
          if (body.message) msg = body.message;
        } catch {}
        // 移除空的 agent 消息
        messages.splice(agentIdx, 1);
        messages.push({ role: 'offline', content: msg });
        isOffline = true;
        render();
        return;
      }

      if (!resp.ok) {
        messages[agentIdx].content = '抱歉，我暂时连不上～ 要不直接加山夏微信 shanyue523478 聊？';
        render();
        return;
      }

      isOffline = false;
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content || '';
              full += delta;
              messages[agentIdx].content = full;
              render();
              scrollBody();
            } catch {}
          }
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      if (!messages[agentIdx] || !messages[agentIdx].content) {
        messages[agentIdx] = { role: 'agent', content: '抱歉，我暂时连不上～ 要不直接加山夏微信 shanyue523478 聊？' };
      }
    } finally {
      streaming = false;
      const inp = document.getElementById('sx-input');
      const btn = document.getElementById('sx-send');
      if (inp && !isOffline) { inp.disabled = false; inp.focus(); }
      if (btn) btn.disabled = false;
      render();
    }
  }

  render();
})();
