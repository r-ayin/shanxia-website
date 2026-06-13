/* 山夏.Skill — 预编译源码（esbuild 构建为 app.js，浏览器不再加载 Babel） */
const { useState, useEffect, useRef } = React;

/* === DATA === */
const VERSE_ONE = {
  tag: '章 · 壹',
  title: '美是未竟的',
  lines: [
    '每一件真正美的事物，都留有缺口。',
    '断臂的维纳斯比完整时更令人心悸。',
    '俳句在十七个音节后戛然而止，余韵却漫入整个房间。',
    '落日不会慢慢熄灭，它猛地沉下去：没有看够，才美。',
    '未竟，不是残缺，而是向观看者敞开的邀请。',
    '美拒绝被穷尽，所以它永远有一扇门没有关上。'
  ]
};
const VERSE_TWO = {
  tag: '章 · 贰',
  title: '美永不止息',
  lines: [
    '花谢，美不会因此消失，它还存在。',
    '存在在看花的人的眼睛里，',
    '存在在「那年春天」这几个字里，',
    '存在在下一朵花尚未开放的等待里。',
    '美是流动的守恒：它从一个形式里离开，必在另一处重新燃起。',
    '悲剧是美的，废墟是美的，沉默也是美的。',
    '美甚至在潜伏，让人暂时看不到，',
    '等待一个角度、',
    '一段时间、',
    '一双眼睛。'
  ]
};

/* 默认占位摄影图(可在页面中点击 Replace 替换为自己的作品)
 * 首屏与第二章共用 verseOne，不再单独维护 hero 图 */
const PHOTO_DEFAULTS = {
  verseOne: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2400&q=80',
  verseTwo: 'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?auto=format&fit=crop&w=2400&q=80'
};

/* ========== 摄影业务数据 ========== */
const CATEGORIES = [
  { key: 'all', label: '全部', count: 12 },
  { key: 'portrait', label: '人像 · 写真', count: 4 },
  { key: 'wedding', label: '婚纱 · 情侣', count: 3 },
  { key: 'family', label: '家庭 · 亲子', count: 3 },
  { key: 'doc', label: '纪实 · 街拍', count: 2 }
];

const WORKS = [
  { id: 'w1', cat: 'portrait', title: '湿头发和八月', place: '杭州 · 龙井', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80', h: 520 },
  { id: 'w2', cat: 'wedding', title: '他说完了，海没说完', place: '青岛 · 鲁迅公园', url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80', h: 380 },
  { id: 'w3', cat: 'family', title: '阳台上睡过去的光', place: '上海 · 武康路', url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=80', h: 460 },
  { id: 'w4', cat: 'portrait', title: '逆光里她没躲', place: '成都 · 玉林', url: 'https://images.unsplash.com/photo-1502768040783-423da5fd5fa0?auto=format&fit=crop&w=1200&q=80', h: 320 },
  { id: 'w5', cat: 'doc', title: '菜市场与慢快门', place: '香港 · 中环', url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80', h: 540 },
  { id: 'w6', cat: 'wedding', title: '三场雨之间的窗台', place: '苏州 · 平江路', url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1200&q=80', h: 420 },
  { id: 'w7', cat: 'family', title: '她抱着熊不肯松手', place: '北京 · 鼓楼', url: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?auto=format&fit=crop&w=1200&q=80', h: 360 },
  { id: 'w8', cat: 'portrait', title: '第一面，最后一张', place: '大理 · 喜洲', url: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=1200&q=80', h: 500 },
  { id: 'w9', cat: 'doc', title: '湿鞋子，不想走', place: '东京 · 谷中', url: 'https://images.unsplash.com/photo-1493804714600-6edb1cd93080?auto=format&fit=crop&w=1200&q=80', h: 340 },
  { id: 'w10', cat: 'family', title: '刚学会握拳的手', place: '杭州 · 良渚', url: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1200&q=80', h: 480 },
  { id: 'w11', cat: 'portrait', title: '风比她先动了', place: '青岛 · 八大关', url: 'https://images.unsplash.com/photo-1496440737103-cd596325d314?auto=format&fit=crop&w=1200&q=80', h: 400 },
  { id: 'w12', cat: 'wedding', title: '领证前一天的脸', place: '丽江 · 束河', url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80', h: 560 }
];

const BEFORE_AFTER = [
  {
    title: '逆光 · 暖夕',
    note: '没有滤镜。靠等：等到太阳压到她的耳尖。',
    before: 'https://images.unsplash.com/photo-1502323777036-f29e3972d82f?auto=format&fit=crop&w=1400&q=80',
    after: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1400&q=80'
  },
  {
    title: '阴天 · 柔光',
    note: '阴天不是缺点，是天然的柔光箱。',
    before: 'https://images.unsplash.com/photo-1521146764736-56c929d59c83?auto=format&fit=crop&w=1400&q=80',
    after: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=1400&q=80'
  },
  {
    title: '室内 · 窗光',
    note: '一扇北向的窗，可以拍上一整天。',
    before: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=1400&q=80',
    after: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1400&q=80'
  }
];

const PACKAGES = [
  {
    id: 'hourly',
    name: '按小时 · 随心起拍',
    price: '¥ 399 — 499',
    unit: '/ 小时起',
    duration: '1 小时起 · 灵活预约',
    cover: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
    timeline: [
      ['学生', '¥ 399 / 小时（需验证学生身份）'],
      ['标准', '¥ 499 / 小时'],
      ['2小时', '可拍 1-2 个场景，30-40 张精修'],
      ['加时', '按小时叠加，无上限']
    ],
    delivery: '精修片 7-14 个工作日 · 原片 3 个工作日',
    bestFor: '个人写真 · 情侣 · 闺蜜 · 试拍体验',
    note: '学生价享 8 折优惠'
  },
  {
    id: 'half',
    name: '一个下午的故事',
    price: '¥ 1,300',
    unit: '起',
    duration: '约 4 小时',
    cover: 'https://images.unsplash.com/photo-1509223197845-458d87318791?auto=format&fit=crop&w=1200&q=80',
    timeline: [
      ['14:00', '见面聊天，让镜头先认识你'],
      ['14:30', '出发拍摄，阳光正好'],
      ['16:00', '换第二套造型'],
      ['17:30', '抓住黄金时刻最后一组']
    ],
    delivery: '7-14 个工作日内交付精修片 · 原片 3 个工作日',
    bestFor: '个人写真 · 闺蜜 · 情侣日常'
  },
  {
    id: 'full',
    name: '一整天的电影',
    price: '¥ 3,000',
    unit: '起',
    duration: '约 8 小时',
    cover: 'https://images.unsplash.com/photo-1525258946800-98cfd641d0de?auto=format&fit=crop&w=1200&q=80',
    timeline: [
      ['10:00', '化妆 + 服装确认'],
      ['11:30', '上午外景，光线柔和'],
      ['14:00', '室内换装，慢拍特写'],
      ['17:00', '黄昏外景'],
      ['19:00', '夜色街灯下的最后一组']
    ],
    delivery: '7-14 个工作日内交付精修片 + 短片',
    bestFor: '婚纱 · 求婚纪念 · 重要节日',
    recommended: true
  }
];

const TESTIMONIALS = [
  {
    name: '林小满',
    tag: '婚纱 · 苏州',
    body: '看到成片那天哭了。她拍的不是"漂亮的我"，是"那一天的我们"。',
    avatar: 'https://i.pravatar.cc/120?img=47'
  },
  {
    name: '徐先生',
    tag: '家庭 · 上海',
    body: '我儿子三岁，从不肯让陌生人拍。山夏老师蹲了二十分钟，他自己跑过去抱她。',
    avatar: 'https://i.pravatar.cc/120?img=12'
  },
  {
    name: 'Yuki',
    tag: '写真 · 大理',
    body: '她让我在镜头前第一次觉得自己"是好看的"。不是滤镜里的好看，是被认真看见的那种。',
    avatar: 'https://i.pravatar.cc/120?img=32'
  },
  {
    name: '周与晨',
    tag: '求婚 · 杭州',
    body: '隐拍我求婚的过程。她比我还紧张。最后一张照片是她按下快门那一秒，我女朋友点头。',
    avatar: 'https://i.pravatar.cc/120?img=15'
  }
];

const NAV_LINKS = [
  ['#works', '作品'],
  ['#proof', '原片对比'],
  ['#about', '关于山夏'],
  ['#pricing', '价格'],
  ['#voices', '客户'],
  ['#book', '预约']
];

/* PERKS（订阅档案 · 同行者权益） */
const PERKS = [
  {
    no: 'I',
    kicker: '档案 · ARCHIVE',
    title: '完整作品档案',
    body: '按章节浏览全部影像、文字与札记，新的拍摄与随笔会持续汇入这座档案。',
    meta: ['影像', '文字', '持续更新']
  },
  {
    no: 'II',
    kicker: '现场 · SESSION',
    title: '线上分享与放映',
    body: '不定期的线上放映与创作分享：一组照片背后的等待、光线，与那个决定性的瞬间。',
    meta: ['放映', '问答', '回放']
  },
  {
    no: 'III',
    kicker: '同行 · COMPANION',
    title: '优先预约与礼遇',
    body: '订阅者享有拍摄档期的优先预约权，并在每年的限定企划中获得专属礼遇。',
    meta: ['优先档期', '限定企划', '专属礼遇']
  }
];

/* === 底图替换（点击 Replace 真正可用，压缩后存入 localStorage） === */
const PHOTO_KEY = '__photos__shanxia_skill__';
function loadPhotos() {
  try { return { ...PHOTO_DEFAULTS, ...JSON.parse(localStorage.getItem(PHOTO_KEY) || '{}') }; }
  catch { return { ...PHOTO_DEFAULTS }; }
}
function persistPhoto(slot, dataUrl) {
  try {
    const cur = JSON.parse(localStorage.getItem(PHOTO_KEY) || '{}');
    cur[slot] = dataUrl;
    localStorage.setItem(PHOTO_KEY, JSON.stringify(cur));
  } catch (e) { console.warn('图片较大，替换仅本次会话生效', e); }
}
function fileToDataUrl(file, maxW = 1920) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
function ReplaceHint({ onPick }) {
  const inputRef = useRef(null);
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={async e => {
          const f = e.target.files && e.target.files[0];
          if (f && onPick) onPick(await fileToDataUrl(f));
          e.target.value = '';
        }} />
      <button type="button" className="replace-hint" data-no-splat onClick={() => inputRef.current.click()}>
        点击替换底图 / Replace Image
      </button>
    </>
  );
}

/* === 订阅（真实校验 + 本地登记） === */
function SubscribeInline({ cta = '进入档案', compact = false }) {
  const [email, setEmail] = useState('');
  const [bad, setBad] = useState(false);
  const [ok, setOk] = useState(false);
  function submit() {
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setBad(true); return; }
    try {
      const list = JSON.parse(localStorage.getItem('__subscribers__shanxia__') || '[]');
      if (!list.includes(v)) list.push(v);
      localStorage.setItem('__subscribers__shanxia__', JSON.stringify(list));
    } catch {}
    setOk(true);
  }
  if (ok) return <span className="subscribe-ok">已登记 ✓ 信会寄往 {email.trim()}</span>;
  return (
    <div className="flex items-center gap-3" style={{ width: compact ? '100%' : 'auto' }}>
      <input
        placeholder="name@yours.cn"
        className={`sans ${bad ? 'input-invalid' : ''}`}
        value={email}
        onChange={e => { setEmail(e.target.value); setBad(false); }}
        onKeyDown={e => e.key === 'Enter' && submit()}
        style={{
          background: 'transparent', border: 'none',
          borderBottom: bad ? '1px solid var(--accent)' : '1px solid var(--ink-primary)',
          padding: compact ? '8px 2px' : '10px 4px',
          fontSize: compact ? 13 : 14, color: 'var(--ink-primary)',
          width: compact ? '100%' : 220, outline: 'none'
        }}
      />
      <button
        className="sans" data-no-splat onClick={submit}
        style={{
          background: 'var(--ink-primary)', color: 'var(--bg-base)', border: 'none',
          padding: compact ? '9px 14px' : '12px 22px', fontSize: 11,
          letterSpacing: '0.24em', textTransform: 'uppercase', cursor: 'pointer',
          transition: 'background 0.3s ease', whiteSpace: 'nowrap'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--ink-primary)'}
      >
        {cta}
      </button>
    </div>
  );
}

/* === HELPERS === */
function useReveal(initial = false) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(initial);
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }
    const ob = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { setVisible(true); ob.disconnect(); } });
    }, { threshold: 0.08 });
    ob.observe(ref.current);
    return () => ob.disconnect();
  }, []);
  return [ref, visible];
}

/* === TWEAKS PANEL === */
function TweaksPanel({ tweaks, onChange }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    function onMsg(e) {
      if (e.data === '__deactivate_edit_mode') setHidden(true);
      if (e.data === '__activate_edit_mode') setHidden(false);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  if (hidden) return null;

  const opts = {
    mode: [['day', '日'], ['night', '夜']],
    typeface: [['garamond', 'Garamond'], ['songti', '宋体']],
    veil: [['clear', '清'], ['soft', '柔'], ['deep', '浓']]
  };
  const labels = { mode: '观看时段', typeface: '字面', veil: '蒙版' };

  return (
    <div className="tweaks-popup">
      <h4>Tweaks</h4>
      {Object.keys(opts).map(key => (
        <div className="tweak-row" key={key}>
          <label>{labels[key]}</label>
          <div className="tweak-options">
            {opts[key].map(([val, label]) => (
              <button
                key={val}
                className={tweaks[key] === val ? 'active' : ''}
                onClick={() => onChange({ ...tweaks, [key]: val })}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
 * 前三屏 · 层叠章节（StoryStack）
 * 不再逐屏滚动翻页：三章固定层叠在同一视口，
 * 由滚动进度驱动文字与底图各自节奏的交叉淡入淡出。
 * 整个栈只运行一个水彩流体实例，章节切换时换显影底图。
 * ============================================================ */
const STORY = [
  // 首屏与第二章共用同一底图槽位（verseOne）：替换任一处，两屏同步
  { key: 'verseOne', frame: '001', credit: 'Untitled Series' },
  { key: 'verseOne', frame: '002', credit: 'On the Unfinished', verse: VERSE_ONE, variant: 'left' },
  { key: 'verseTwo', frame: '003', credit: 'On the Ever-Continuing', verse: VERSE_TWO, variant: 'right' }
];
const HOLD = 0.42;            // 每段进度里"停留"的比例，其余用于淡入淡出
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

function HeroContent({ active }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: 'clamp(28px, 4vw, 56px)' }}>
      <header className="flex items-center justify-between" style={{ borderBottom: '1px solid rgba(245,239,226,0.18)', paddingBottom: 20 }}>
        <div className="chapter-tag" style={{ color: 'rgba(245,239,226,0.7)' }}>SHANXIA · 私人摄影档案</div>
        <div className="chapter-tag" style={{ color: 'rgba(245,239,226,0.45)' }}>MMXXVI · 卷 I</div>
      </header>

      <div
        className={`fade-in ${active ? 'visible' : ''}`}
        style={{ marginTop: 'clamp(60px, 14vh, 160px)', textAlign: 'center' }}
      >
        <div className="chapter-tag mb-6" style={{ color: 'rgba(245,239,226,0.65)' }}>
          <span className="title-mark" style={{ background: 'rgba(245,239,226,0.55)' }} />
          PHOTOGRAPHY · EXHIBITION · APPOINTMENT
          <span className="title-mark" style={{ background: 'rgba(245,239,226,0.55)' }} />
        </div>
        <h1 className="serif-display" style={{
          fontSize: 'clamp(56px, 11vw, 168px)',
          lineHeight: 0.95,
          letterSpacing: '-0.02em',
          fontWeight: 400,
          margin: 0,
          color: '#fbf6ea',
          textShadow: '0 2px 24px rgba(0,0,0,0.35)'
        }}>
          山夏<span style={{ color: 'var(--accent)', fontStyle: 'italic', fontWeight: 300 }}>.Skill</span>
        </h1>
        <p className="serif-display mt-6" style={{
          fontSize: 'clamp(15px, 1.2vw, 19px)',
          fontStyle: 'italic',
          color: 'rgba(245,239,226,0.82)',
          letterSpacing: '0.08em'
        }}>
          ——  你值得被这样看见：被一束光、一段时间、一双等待你的眼睛  ——
        </p>
      </div>
    </div>
  );
}

function VerseContent({ verse, variant, active }) {
  const isLeft = variant === 'left';
  return (
    <div className="story-verse" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: 'clamp(40px, 6vh, 100px) clamp(28px, 4vw, 56px)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 'clamp(20px, 3vw, 48px)' }}>
        <aside style={{ gridColumn: isLeft ? '1 / span 3' : '10 / span 3', alignSelf: 'start', order: isLeft ? 0 : 2 }}>
          <div className={`fade-in ${active ? 'visible' : ''}`}>
            <div className="chapter-tag mb-5" style={{ color: 'var(--accent)' }}>{verse.tag}</div>
            <div style={{ width: 56, height: 1, background: 'rgba(245,239,226,0.55)', marginBottom: 20 }} />
            <h2 className="serif-display" style={{
              fontSize: 'clamp(34px, 4.6vw, 64px)',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              margin: 0,
              color: '#fbf6ea',
              textShadow: '0 2px 18px rgba(0,0,0,0.4)'
            }}>
              「{verse.title}」
            </h2>
            <p className="sans mt-6" style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(245,239,226,0.55)' }}>
              {isLeft ? 'On the Unfinished' : 'On the Ever-Continuing'}
            </p>
          </div>
        </aside>

        <div style={{ gridColumn: isLeft ? '5 / span 8' : '1 / span 8', order: 1 }}>
          <div className="serif-display story-quote-mark mb-8" style={{ fontSize: 'clamp(64px, 7vw, 110px)', lineHeight: 0.85, color: 'var(--accent)', opacity: 0.95, fontStyle: 'italic' }}>
            {isLeft ? '“' : '”'}
          </div>
          <div className="space-y-3 md:space-y-4">
            {verse.lines.map((line, i) => (
              <p
                key={i}
                className={`verse-line ${active ? 'visible' : ''}`}
                style={{
                  transitionDelay: active ? `${120 + i * 160}ms` : '0ms',
                  fontSize: 'clamp(15px, 1.45vw, 21px)',
                  lineHeight: 1.9,
                  letterSpacing: '0.04em',
                  color: 'rgba(251,246,234,0.92)',
                  fontWeight: 300,
                  textShadow: '0 1px 14px rgba(0,0,0,0.45)',
                  margin: 0
                }}
              >
                {line}
              </p>
            ))}
          </div>
          <div style={{ height: 1, background: 'rgba(245,239,226,0.25)' }} className="mt-12" />
          <div className="flex items-center justify-between mt-5">
            <span className="chapter-tag" style={{ color: 'rgba(245,239,226,0.7)' }}>— 山夏 · 札记</span>
            <span className="chapter-tag" style={{ color: 'rgba(245,239,226,0.45)' }}>{isLeft ? 'I / II' : 'II / II'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryStack({ photos, onReplace }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const bgRefs = useRef([]);
  const bgImgRefs = useRef([]);
  const ctRefs = useRef([]);
  const fxRef = useRef(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  /* 单一水彩流体实例：整栈共享，离开视口即暂停 */
  useEffect(() => {
    if (!window.WatercolorFX || !canvasRef.current) return;
    lastSrcRef.current = photosRef.current[STORY[activeRef.current].key];
    const fx = WatercolorFX.init({
      canvas: canvasRef.current,
      image: lastSrcRef.current,
      MODE: 'reveal',
      PALETTE: ['#8b3a1f', '#b0764f', '#d4a574', '#5a4f3f'],
      DENSITY_DISSIPATION: 0.6,
      VELOCITY_DISSIPATION: 1.7,
      CURL: 5,
      SPLAT_RADIUS: 0.22,
      SPLAT_FORCE: 5400,
      CLICK_SPLATS: 14,
      INK_STRENGTH: 0.45,
      EDGE_DARKEN: 0.28,
      REVEAL_LOW: 0.05,
      REVEAL_HIGH: 0.55,
      CUSTOM_CURSOR: true,
      CURSOR_HOVER_SELECTOR: 'a, button, [data-cursor], .replace-hint, .float-cta'
    });
    fxRef.current = fx;
    let ob;
    if (fx.supported && wrapRef.current) {
      ob = new IntersectionObserver(
        es => es.forEach(e => (e.isIntersecting ? fx.resume() : fx.pause())),
        { threshold: 0 }
      );
      ob.observe(wrapRef.current);
    }
    return () => { if (ob) ob.disconnect(); fx.destroy(); fxRef.current = null; };
  }, []);

  /* 章节或底图变更 → 流体显影换图（墨迹保留，影像在旧笔触中过渡） */
  const lastSrcRef = useRef(null);
  useEffect(() => {
    const fx = fxRef.current;
    const src = photos[STORY[active].key];
    if (fx && fx.supported && src !== lastSrcRef.current) {
      lastSrcRef.current = src;
      fx.setImage(src);
    }
  }, [active, photos]);

  /* 滚动驱动的交叉淡入淡出（rAF 节流，直接写样式，不触发 React 渲染） */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const N = STORY.length;
    let raf = null;

    function apply() {
      raf = null;
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight;
      const span = Math.max(1, rect.height - vh);
      const p = Math.min(1, Math.max(0, -rect.top / span)) * (N - 1);
      const s = Math.min(N - 2, Math.floor(p));
      const t = p - s;
      const f = t <= HOLD ? 0 : smooth((t - HOLD) / (1 - HOLD));

      for (let i = 0; i < N; i++) {
        const bg = bgRefs.current[i];
        const ct = ctRefs.current[i];
        if (!bg || !ct) continue;

        /* 底图：下层保持，上层淡入覆盖（无黑场） */
        let bgOp, vis;
        if (i < s) { bgOp = 0; vis = 'hidden'; }
        else if (i === s) { bgOp = 1; vis = (f >= 1 ? 'hidden' : 'visible'); }
        else if (i === s + 1) { bgOp = f; vis = (f <= 0 ? 'hidden' : 'visible'); }
        else { bgOp = 0; vis = 'hidden'; }
        bg.style.opacity = bgOp.toFixed(3);
        bg.style.visibility = vis;

        /* 文字：旧章先行隐去，新章稍候浮现，配合轻微位移 */
        let ctOp = 0, ty = 0;
        if (i === s) {
          const out = smooth(Math.min(1, f / 0.55));
          ctOp = 1 - out;
          ty = -34 * out;
        } else if (i === s + 1) {
          const fin = f <= 0.45 ? 0 : smooth((f - 0.45) / 0.55);
          ctOp = fin;
          ty = 26 * (1 - fin);
        }
        ct.style.opacity = ctOp.toFixed(3);
        ct.style.visibility = ctOp <= 0.001 ? 'hidden' : 'visible';
        ct.style.transform = ty ? `translate3d(0, ${ty.toFixed(1)}px, 0)` : 'translate3d(0,0,0)';
        ct.style.pointerEvents = ctOp > 0.6 ? 'auto' : 'none';

        /* 底图缓慢漂移（接替原视差，仅作用于可见层） */
        const img = bgImgRefs.current[i];
        if (img && vis === 'visible') {
          img.style.setProperty('--py', ((p - i) * 38).toFixed(1) + 'px');
        }
      }

      const nextActive = f > 0.5 ? s + 1 : s;
      if (nextActive !== activeRef.current) {
        activeRef.current = nextActive;
        setActive(nextActive);
      }
    }

    function onScroll() { if (!raf) raf = requestAnimationFrame(apply); }
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="story" ref={wrapRef} className="story-stack">
      <div className="story-viewport photo-stage">
        <div className="story-plane" style={{ zIndex: 0 }}>
          {STORY.map((ch, i) => (
            <div key={ch.frame} className="story-bg-layer" ref={el => { bgRefs.current[i] = el; }}>
              <div
                className="photo-bg"
                ref={el => { bgImgRefs.current[i] = el; }}
                style={{ backgroundImage: `url('${photos[ch.key]}')` }}
              />
              <div className="photo-veil" />
            </div>
          ))}
        </div>

        <canvas ref={canvasRef} className="story-canvas" />

        <div className="story-plane" style={{ zIndex: 2 }}>
          {STORY.map((ch, i) => (
            <div key={ch.frame} className="story-content-layer" ref={el => { ctRefs.current[i] = el; }}>
              {i === 0
                ? <HeroContent active={active === 0} />
                : <VerseContent verse={ch.verse} variant={ch.variant} active={active === i} />}
              <span className="photo-tag">FRAME · {ch.frame}  ·  REPLACEABLE</span>
              <span className="photo-credit">© 山夏 · {ch.credit}</span>
              <ReplaceHint onPick={d => onReplace(ch.key, d)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* === NAV === */
function NavBar({ onBook }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    let stack = null;
    let raf = null;
    function check() {
      raf = null;
      if (!stack) stack = document.getElementById('story');
      // 层叠章节栈被推走、浅色内容贴近导航时才转为实底
      const limit = stack ? stack.offsetHeight - 120 : 80;
      setSolid(window.scrollY > Math.max(80, limit));
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(check); }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <nav className={`topnav ${solid ? 'solid' : ''}`}>
      <a href="#top" className="brand">山夏<em>.Skill</em></a>
      <div className="topnav-links">
        {NAV_LINKS.map(([href, label]) => (
          <a key={href} href={href}>{label}</a>
        ))}
      </div>
      <button className="nav-cta" onClick={onBook}>预约拍摄</button>
    </nav>
  );
}

/* === WORKS · 瀑布流 === */
function WorksSection() {
  const [ref, visible] = useReveal();
  const [cat, setCat] = useState('all');
  const list = cat === 'all' ? WORKS : WORKS.filter(w => w.cat === cat);
  return (
    <section id="works" ref={ref} className="biz-section">
      <div className="biz-inner">
        <div className={`biz-reveal ${visible ? 'visible' : ''}`}>
          <div className="biz-eyebrow">—  作品 · PORTFOLIO  —</div>
          <h2 className="biz-title">我留住<em>地上的星星</em></h2>
        </div>
        <div className="filter-bar">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              className={cat === c.key ? 'active' : ''}
              onClick={() => setCat(c.key)}
            >
              {c.label}<span className="count">{c.count}</span>
            </button>
          ))}
        </div>
        <div className="masonry">
          {list.map(w => (
            <figure key={w.id} className="work-card">
              <img src={w.url} alt={w.title} loading="lazy" decoding="async" style={{ height: w.h, objectFit: 'cover' }} />
              <figcaption className="meta">
                <h4>{w.title}</h4>
                <span>{w.place}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* === BEFORE / AFTER === */
function BeforeAfter({ item }) {
  const [pos, setPos] = useState(50);
  const frameRef = useRef(null);
  function move(clientX) {
    const rect = frameRef.current.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(2, Math.min(98, next)));
  }
  return (
    <div className="ba-card">
      <div
        className="ba-frame"
        ref={frameRef}
        onMouseMove={e => e.buttons === 1 && move(e.clientX)}
        onMouseDown={e => move(e.clientX)}
        onTouchMove={e => move(e.touches[0].clientX)}
      >
        <img src={item.before} alt="原片" loading="lazy" decoding="async" />
        <div className="ba-after-wrap" style={{ width: `${pos}%` }}>
          <img src={item.after} alt="成片" loading="lazy" decoding="async" style={{ width: `${100 * 100 / pos}%`, maxWidth: 'none' }} />
        </div>
        <span className="ba-tag-before">原片 · RAW</span>
        <span className="ba-tag-after">成片 · FINAL</span>
        <div className="ba-handle" style={{ left: `${pos}%` }} />
      </div>
      <div className="ba-foot">
        <h4>{item.title}</h4>
        <p>{item.note}</p>
      </div>
    </div>
  );
}
function ProofSection() {
  const [ref, visible] = useReveal();
  return (
    <section id="proof" ref={ref} className="biz-section deep">
      <div className="biz-inner">
        <div className={`biz-reveal ${visible ? 'visible' : ''}`}>
          <div className="biz-eyebrow">—  原片对比 · RAW × FINAL  —</div>
          <h2 className="biz-title">想要更真实的被看到</h2>
        </div>
        <div className="ba-stack" style={{ marginTop: 72 }}>
          {BEFORE_AFTER.map((item, i) => (
            <BeforeAfter key={i} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* === ABOUT === */
function AboutSection() {
  const [ref, visible] = useReveal();
  return (
    <section id="about" ref={ref} className="biz-section">
      <div className="biz-inner">
        <div className="about-grid">
          <div className={`biz-reveal ${visible ? 'visible' : ''}`}>
            <div className="about-portrait">
              <img src="https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=900&q=80" alt="山夏" loading="lazy" decoding="async" />
              <span className="badge">摄影师 · 山夏</span>
            </div>
          </div>
          <div className={`biz-reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '120ms' }}>
            <div className="biz-eyebrow">—  关于山夏 · ABOUT  —</div>
            <h2 className="biz-title">我拍你，<em>也拍下时间的痕迹。</em></h2>
            <p className="biz-lede" style={{ marginBottom: 18 }}>
              独立摄影师 · 现居杭州。八年前从美院油画系转身，把笔换成了镜头。
            </p>
            <p className="biz-lede" style={{ marginBottom: 18 }}>
              我相信「美是未竟的」——所以我从不要求你笑得标准；
              我相信「美永不止息」——所以哪怕落日已经沉下去，
              我也愿意再陪你站十分钟，等它在你眼里再亮一次。
            </p>
            <p className="biz-lede">
              服务过 320 位客户。最长的一次合作，是跟一对夫妇拍了七年——
              从求婚那天，到他们女儿三岁的春天。
            </p>
            <div className="about-stats">
              <div><div className="num">320+</div><div className="lbl">独立客户</div></div>
              <div><div className="num">8 年</div><div className="lbl">影像旅程</div></div>
              <div><div className="num">14 城</div><div className="lbl">外拍足迹</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* === PRICING === */
function PricingSection({ onBook }) {
  const [ref, visible] = useReveal();
  return (
    <section id="pricing" ref={ref} className="biz-section deep">
      <div className="biz-inner">
        <div className={`biz-reveal ${visible ? 'visible' : ''}`}>
          <div className="biz-eyebrow">—  价格 · PACKAGES  —</div>
          <h2 className="biz-title">三种节奏，<em>三种被记得的方式</em></h2>
          <p className="biz-lede">
            不是套餐，是三段不同长度的「我们一起度过的时间」。
            价格透明，无隐形消费；旅拍另议。
          </p>
        </div>
        <div className="pkg-grid">
          {PACKAGES.map(pkg => (
            <article key={pkg.id} className={`pkg-card biz-reveal ${visible ? 'visible' : ''} ${pkg.recommended ? 'recommended' : ''}`}>
              <div className="pkg-cover"><img src={pkg.cover} alt={pkg.name} loading="lazy" decoding="async" /></div>
              <div className="pkg-body">
                <h3>{pkg.name}</h3>
                <div className="pkg-best">适合 · {pkg.bestFor}</div>
                <div className="pkg-price">
                  <span className="p">{pkg.price}</span>
                  <span className="u">{pkg.unit}</span>
                  <span className="d">{pkg.duration}</span>
                </div>
                <ul className="pkg-timeline">
                  {pkg.timeline.map(([t, d], i) => (
                    <li key={i}><span className="t">{t}</span><span>{d}</span></li>
                  ))}
                </ul>
                <p className="pkg-delivery">· {pkg.delivery}</p>
                <button className="pkg-cta" onClick={onBook}>预约这一份时间 →</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* === VOICES === */
function VoicesSection() {
  const [ref, visible] = useReveal();
  return (
    <section id="voices" ref={ref} className="biz-section">
      <div className="biz-inner">
        <div className={`biz-reveal ${visible ? 'visible' : ''}`}>
          <div className="biz-eyebrow">—  客户的话 · VOICES  —</div>
          <h2 className="biz-title">他们说的，<em>比我自己写得更好</em></h2>
          <p className="biz-lede">
            以下文字均经客户本人授权。我从不要求好评，但他们愿意。
          </p>
        </div>
        <div className="voice-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className={`voice-card biz-reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="quote">“</div>
              <p className="body">{t.body}</p>
              <div className="who">
                <img src={t.avatar} alt={t.name} loading="lazy" decoding="async" />
                <div>
                  <div className="name">{t.name}</div>
                  <div className="tag">{t.tag}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* === BOOK === */
function BookSection() {
  const [ref, visible] = useReveal();
  const [scene, setScene] = useState('portrait');
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', contact: '', date: '', story: '' });
  const [errors, setErrors] = useState({});
  const [copied, setCopied] = useState(false);
  const scenes = [
    ['portrait', '个人写真'],
    ['couple', '情侣 · 婚纱'],
    ['family', '家庭 · 亲子'],
    ['travel', '旅拍'],
    ['other', '其它']
  ];
  const sceneLabel = k => (scenes.find(s => s[0] === k) || ['', ''])[1];
  function bind(k) {
    return {
      value: form[k],
      onChange: e => {
        setForm({ ...form, [k]: e.target.value });
        if (errors[k]) setErrors({ ...errors, [k]: null });
      }
    };
  }
  function summary() {
    return [
      '【山夏 · 预约申请】',
      '称呼：' + form.name.trim(),
      '联系：' + form.contact.trim(),
      '意向日期：' + (form.date || '待定'),
      '场景：' + sceneLabel(scene),
      '想拍的故事：' + (form.story.trim() || '—')
    ].join('\n');
  }
  const mailto = 'mailto:hello@shanxia.studio'
    + '?subject=' + encodeURIComponent('预约拍摄 · ' + form.name.trim())
    + '&body=' + encodeURIComponent(summary());
  function onSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = '请告诉我怎么称呼你';
    if (!form.contact.trim()) errs.contact = '留一个能找到你的方式';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const log = JSON.parse(localStorage.getItem('__bookings__shanxia__') || '[]');
      log.push({ ...form, scene, at: new Date().toISOString() });
      localStorage.setItem('__bookings__shanxia__', JSON.stringify(log));
    } catch {}
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(summary()).then(() => setCopied(true)).catch(() => {});
    }
    setSubmitted(true);
  }
  return (
    <section id="book" ref={ref} className="biz-section deep">
      <div className="biz-inner">
        <div className={`biz-reveal ${visible ? 'visible' : ''}`}>
          <div className="biz-eyebrow">—  预约 · BOOK  —</div>
          <h2 className="biz-title">告诉我，<em>你想被怎样看见</em></h2>
          <p className="biz-lede">
            72 小时内人工回复。提交后我会先发一份「拍摄前问卷」给你，
            我们先聊清楚，再决定要不要按下快门。
          </p>
        </div>
        <div className="book-grid">
          <form className={`book-form biz-reveal ${visible ? 'visible' : ''}`} onSubmit={onSubmit}>
            {submitted ? (
              <div style={{ padding: '40px 8px', textAlign: 'center' }}>
                <div className="serif-display" style={{ fontSize: 38, fontStyle: 'italic', color: 'var(--accent)' }}>已收到 ✓</div>
                <p style={{ marginTop: 18, color: 'var(--ink-secondary)', lineHeight: 1.9 }}>
                  你的申请已整理好{copied ? '，并复制到了剪贴板' : ''}。<br/>
                  可以直接用邮件寄出，或粘贴到微信发给山夏。
                </p>
                <pre className="sans" style={{
                  textAlign: 'left', whiteSpace: 'pre-wrap', margin: '24px auto 0', maxWidth: 420,
                  padding: '18px 22px', border: '1px dashed var(--ink-line)',
                  background: 'var(--bg-base)', fontSize: 13, lineHeight: 1.9, color: 'var(--ink-secondary)'
                }}>{summary()}</pre>
                <div className="flex items-center justify-center gap-4" style={{ marginTop: 28, flexWrap: 'wrap' }}>
                  <a className="book-submit" href={mailto} style={{ textDecoration: 'none', display: 'inline-block', width: 'auto', padding: '14px 28px' }}>用邮件寄出 →</a>
                  <button type="button" className="pkg-cta" style={{ maxWidth: 180 }} onClick={() => setSubmitted(false)}>返回修改</button>
                </div>
              </div>
            ) : (
              <>
                <div className="form-row">
                  <label>怎么称呼你</label>
                  <input type="text" placeholder="你的姓名或昵称" {...bind('name')} className={errors.name ? 'input-invalid' : ''} />
                  <div className="form-error">{errors.name || ''}</div>
                </div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                  <div>
                    <label>微信 / 电话</label>
                    <input type="text" placeholder="方便我联系你" {...bind('contact')} className={errors.contact ? 'input-invalid' : ''} />
                    <div className="form-error">{errors.contact || ''}</div>
                  </div>
                  <div>
                    <label>意向日期</label>
                    <input type="date" {...bind('date')} />
                  </div>
                </div>
                <div className="form-row">
                  <label>拍摄场景</label>
                  <div className="form-chips">
                    {scenes.map(([k, l]) => (
                      <button type="button" key={k} className={scene === k ? 'on' : ''} onClick={() => setScene(k)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <label>想拍一个怎样的故事</label>
                  <textarea rows="4" placeholder="任意一句话都可以，譬如：'想拍一组只属于我自己的，三十岁的样子。'" {...bind('story')}></textarea>
                </div>
                <button type="submit" className="book-submit">寄出这封信  →</button>
              </>
            )}
          </form>
          <aside className={`book-aside biz-reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '120ms' }}>
            <h4>你会收到的三件套</h4>
            <ul>
              <li><span className="ic">壹</span><span>一份「拍摄前问卷」——帮我先认识你</span></li>
              <li><span className="ic">贰</span><span>一份拍摄日程表，含光线说明与备选场地</span></li>
              <li><span className="ic">叁</span><span>一封明信片或拍立得（可选用自己照片打印）</span></li>
            </ul>
            <div className="book-meta" style={{ marginBottom: 10 }}>常驻 · 杭州</div>
            <div className="book-meta" style={{ marginBottom: 10 }}>足迹 · 上海 · 苏州 · 大理 · 青岛 · 京都</div>
            <div className="book-meta">回复 · 72H · 人工</div>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* === BIZ FOOTER === */
function BizFooter() {
  return (
    <footer className="biz-footer">
      <div className="grid">
        <div>
          <div className="serif-display" style={{ fontSize: 28, letterSpacing: '-0.01em' }}>山夏<span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>.Skill</span></div>
          <p className="mt-3" style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.85, maxWidth: 280 }}>
            独立摄影师 · 现居杭州。<br/>
            让光、时间和你，在一帧里相遇。
          </p>
        </div>
        <div>
          <div className="chapter-tag mb-4">导览</div>
          <ul className="space-y-2 sans" style={{ fontSize: 13, color: 'var(--ink-secondary)', listStyle: 'none', padding: 0, margin: 0 }}>
            <li><a href="#works" style={{ color: 'inherit', textDecoration: 'none' }}>作品 · Portfolio</a></li>
            <li><a href="#proof" style={{ color: 'inherit', textDecoration: 'none' }}>原片对比</a></li>
            <li><a href="#pricing" style={{ color: 'inherit', textDecoration: 'none' }}>价格 · Packages</a></li>
            <li><a href="#book" style={{ color: 'inherit', textDecoration: 'none' }}>预约拍摄</a></li>
          </ul>
        </div>
        <div>
          <div className="chapter-tag mb-4">联系</div>
          <ul className="space-y-2 sans" style={{ fontSize: 13, color: 'var(--ink-secondary)', listStyle: 'none', padding: 0, margin: 0 }}>
            <li>hello@shanxia.studio</li>
            <li>微信 · shanxia_skill</li>
            <li>小红书 / 即刻 · @山夏</li>
          </ul>
        </div>
        <div>
          <div className="chapter-tag mb-4">手记 · Newsletter</div>
          <p className="sans" style={{ fontSize: 12, color: 'var(--ink-faded)', lineHeight: 1.8, marginBottom: 10 }}>
            每月一封信，写一张照片背后的故事。
          </p>
          <SubscribeInline cta="订阅" compact />
        </div>
      </div>
      <div className="colophon">
        <span>© MMXXVI · 山夏 · ALL RIGHTS RESERVED</span>
        <span>未竟之美 · 永不止息</span>
      </div>
    </footer>
  );
}

/* === PERKS === */
function PerksSection() {
  const [ref, visible] = useReveal();
  return (
    <section
      id="subscribe"
      ref={ref}
      style={{
        padding: 'clamp(60px, 10vw, 140px) clamp(28px, 4vw, 56px)',
        background: 'var(--bg-deep)',
        borderTop: '1px solid var(--ink-line)'
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <header className={`fade-in ${visible ? 'visible' : ''}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 32, alignItems: 'end', marginBottom: 'clamp(40px, 6vw, 80px)' }}>
          <div style={{ gridColumn: 'span 12' }} className="md:col-span-7">
            <div className="biz-eyebrow">—  订阅 · SUBSCRIBE  —</div>
            <h2 className="serif-display" style={{
              fontSize: 'clamp(36px, 5.4vw, 76px)',
              lineHeight: 1.05,
              letterSpacing: '-0.015em',
              margin: 0,
              fontWeight: 400
            }}>
              成为你自己作品宇宙的<br/><span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>同行者</span>
            </h2>
          </div>
          <p style={{ gridColumn: 'span 12', fontSize: 15, color: 'var(--ink-secondary)', lineHeight: 1.85, maxWidth: 460 }} className="md:col-span-5">
            这是一个可重新填充的沉浸式档案页：你可以放入自己的文字、图像、声音、视频、地图和会员内容。它是房子，也是钥匙。
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', borderTop: '1px solid var(--ink-line)', borderLeft: '1px solid var(--ink-line)' }}>
          {PERKS.map((perk, i) => (
            <article
              key={perk.no}
              className={`perk-card fade-in ${visible ? 'visible' : ''}`}
              style={{
                padding: 'clamp(28px, 3vw, 44px)',
                borderRight: '1px solid var(--ink-line)',
                borderBottom: '1px solid var(--ink-line)',
                transitionDelay: `${i * 140}ms`,
                minHeight: 380,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div className="flex items-baseline justify-between mb-8">
                  <span className="perk-numeral serif-display" style={{ fontSize: 56, lineHeight: 1, fontStyle: 'italic', color: 'var(--ink-faded)' }}>{perk.no}</span>
                  <span className="chapter-tag">— {perk.kicker}</span>
                </div>
                <h3 className="serif-display" style={{ fontSize: 'clamp(24px, 2.2vw, 32px)', lineHeight: 1.2, margin: '0 0 16px', fontWeight: 400 }}>
                  {perk.title}
                </h3>
                <p style={{ fontSize: 14.5, color: 'var(--ink-secondary)', lineHeight: 1.85, margin: 0 }}>
                  {perk.body}
                </p>
              </div>
              <div className="mt-8 pt-5" style={{ borderTop: '1px dashed var(--ink-line)' }}>
                <div className="flex flex-wrap gap-x-3 gap-y-2 chapter-tag" style={{ color: 'var(--ink-faded)' }}>
                  {perk.meta.map(m => <span key={m}>· {m}</span>)}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 flex flex-col md:flex-row items-center justify-between gap-6" style={{ padding: 'clamp(24px, 3vw, 36px)', border: '1px solid var(--ink-primary)', background: 'var(--bg-base)' }}>
          <div>
            <div className="chapter-tag mb-2" style={{ color: 'var(--accent)' }}>同行 · ACCESS</div>
            <p className="serif-display" style={{ fontSize: 'clamp(20px, 2vw, 28px)', margin: 0, fontStyle: 'italic' }}>
              推开门，把你的美放进来。
            </p>
          </div>
          <SubscribeInline cta="进入档案" />
        </div>
      </div>
    </section>
  );
}

function App() {
  const [tweaks, setTweaks] = useState(loadTweaks());
  const [photos, setPhotos] = useState(loadPhotos());
  function replacePhoto(slot, dataUrl) {
    setPhotos(p => ({ ...p, [slot]: dataUrl }));
    persistPhoto(slot, dataUrl);
  }
  useEffect(() => {
    saveTweaks(tweaks);
    document.body.dataset.mode = tweaks.mode;
    document.body.dataset.veil = tweaks.veil;
    document.documentElement.style.setProperty(
      '--serif-body',
      tweaks.typeface === 'songti'
        ? "'Noto Serif SC', serif"
        : "'Cormorant Garamond', 'Noto Serif SC', serif"
    );
    document.documentElement.style.setProperty(
      '--serif-display',
      tweaks.typeface === 'songti'
        ? "'Noto Serif SC', serif"
        : "'Cormorant Garamond', 'Noto Serif SC', serif"
    );
  }, [tweaks]);

  function scrollToBook() {
    const el = document.getElementById('book');
    if (!el) return;
    if (window.SmoothFlow && window.SmoothFlow.toElement) {
      window.SmoothFlow.toElement(el, 64);   // 跟踪元素，content-visibility 展开后仍准确落点
    } else {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <div className="relative" id="top">
      {/* <TweaksPanel tweaks={tweaks} onChange={setTweaks} /> */}
      <NavBar onBook={scrollToBook} />

      {/* ===== 诗意三连屏 · 层叠交叉淡入淡出 ===== */}
      <StoryStack photos={photos} onReplace={replacePhoto} />

      {/* ===== 摄影业务模块 ===== */}
      <WorksSection />
      <ProofSection />
      <AboutSection />
      <PricingSection onBook={scrollToBook} />
      <VoicesSection />
      <BookSection />

      {/* ===== 订阅档案(同行者) ===== */}
      <PerksSection />

      <BizFooter />
      <button className="float-cta" onClick={scrollToBook}>预约一次拍摄 →</button>
      <div className="scroll-cue">SCROLL — 沿章而下</div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
