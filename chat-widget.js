/**
 * 山夏摄影 — AI 咨询聊天组件
 * 零依赖 · 香草 JS · 匹配网站美学
 * 加载方式：<script defer src="./chat-widget.js"></script>
 */
(function () {
  if (window.__shanxiaChatLoaded) return;
  window.__shanxiaChatLoaded = true;

  // ===== 配置 =====
  const WORKER_URL = 'https://shanxia-chat.womenhaiyouxiwang.workers.dev';
  const BRAND = '山夏';
  const PLACEHOLDER = '想拍什么风格？我帮你参谋～';
  const GREETING = `你好呀～我是山夏的AI小助理 🌸

可以先告诉我你想拍什么类型的照片：个人写真、情侣/闺蜜、还是其他？

如果你不确定风格也没关系，我可以跟你聊聊，帮你找到最适合的方向～`;

  // ===== DOM =====
  const style = document.createElement('style');
  style.textContent = `
    .sx-chat-trigger {
      position: fixed; bottom: 28px; right: 24px; z-index: 9998;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--accent); color: #fbf6ea;
      border: none; cursor: pointer;
      font-size: 22px; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 14px 40px -10px rgba(139, 58, 31, 0.55);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      font-family: var(--serif-display);
    }
    .sx-chat-trigger:hover { transform: translateY(-3px); box-shadow: 0 20px 50px -12px rgba(139, 58, 31, 0.7); }
    .sx-chat-trigger .dot {
      position: absolute; top: 2px; right: 2px;
      width: 10px; height: 10px; border-radius: 50%;
      background: #4ade80; border: 2px solid var(--accent);
      animation: pulse-dot 2s ease-in-out infinite;
    }
    @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .sx-chat-panel {
      position: fixed; bottom: 96px; right: 24px; z-index: 9997;
      width: 380px; max-width: calc(100vw - 40px); height: 560px; max-height: calc(100vh - 140px);
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
    .sx-msg.typing { align-self: flex-start; color: var(--ink-faded); font-style: italic; font-size: 12px; }
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
      .sx-chat-panel { width: calc(100vw - 32px); right: 16px; bottom: 80px; height: 480px; }
      .sx-chat-trigger { right: 16px; bottom: 20px; }
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'sx-chat-root';
  document.body.appendChild(root);

  let open = false;
  let messages = [];
  let streaming = false;

  function render() {
    const cm = messages.map((m, i) => {
      if (m.role === 'agent') return `<div class="sx-msg agent" id="sx-msg-${i}">${escapeHtml(m.content)}</div>`;
      if (m.role === 'user') return `<div class="sx-msg user">${escapeHtml(m.content)}</div>`;
      return '';
    }).join('');

    root.innerHTML = `
      <button class="sx-chat-trigger" id="sx-trigger" aria-label="与山夏聊天">
        ${open ? '✕' : '?'}<span class="dot"></span>
      </button>
      <div class="sx-chat-panel ${open ? '' : 'hidden'}" id="sx-panel">
        <div class="sx-chat-header">
          <span>山夏<em>.小助理</em></span>
          <button id="sx-close" aria-label="关闭">✕</button>
        </div>
        <div class="sx-chat-body" id="sx-body">${cm}</div>
        <div class="sx-chat-input">
          <input id="sx-input" type="text" placeholder="${PLACEHOLDER}" maxlength="500" />
          <button id="sx-send" ${streaming ? 'disabled' : ''}>发送</button>
        </div>
      </div>
    `;

    document.getElementById('sx-trigger').addEventListener('click', toggle);
    document.getElementById('sx-close').addEventListener('click', () => { open = false; render(); });
    const input = document.getElementById('sx-input');
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    document.getElementById('sx-send').addEventListener('click', send);
    if (open) setTimeout(() => input.focus(), 100);
    scrollBody();
  }

  function toggle() { open = !open; render(); }

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
    if (streaming) return;
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
      .filter(m => m.role !== 'typing')
      .map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content }));

    try {
      const resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });

      if (!resp.ok) {
        const err = await resp.text();
        messages[agentIdx].content = '抱歉，我暂时连不上～ 要不直接加山夏微信 shanyue523478 聊？';
        throw new Error(err);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // SSE format: data: {...}
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
      if (!messages[agentIdx].content) {
        messages[agentIdx].content = '抱歉，我暂时连不上～ 要不直接加山夏微信 shanyue523478 聊？';
      }
    } finally {
      streaming = false;
      const inp = document.getElementById('sx-input');
      const btn = document.getElementById('sx-send');
      if (inp) { inp.disabled = false; inp.focus(); }
      if (btn) btn.disabled = false;
      render();
    }
  }

  // Init
  render();
})();
