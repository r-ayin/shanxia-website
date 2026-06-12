/*!
 * SmoothFlow 1.1 — 页面贯通三件套：惯性平滑滚动 + 锚点缓动 + 背景视差
 * 零依赖，引入即生效。可在引入前用 window.SMOOTH_FLOW_CONFIG 覆盖默认值：
 *
 *   <script>window.SMOOTH_FLOW_CONFIG = { ease: 0.12, parallaxRange: 40 };</script>
 *   <script src="smooth-flow.js"></script>
 *
 * 配置项：
 *   ease            滚动阻尼（0.05 柔 — 0.2 紧），默认 0.09
 *   anchorOffset    锚点定位时为固定导航预留的高度，默认 64
 *   parallaxSection 视差容器选择器，默认 '.photo-stage'
 *   parallaxTarget  容器内被位移的背景，默认 '.photo-bg'（接收 --py CSS 变量）
 *   parallaxRange   视差最大位移（px），默认 64
 * 暴露：
 *   window.SmoothFlow.to(y)              平滑滚到任意位置
 *   window.SmoothFlow.toElement(el, off) 跟踪元素滚动（目标高度变化也能准确落点）
 *   window.__scrollTo                    to(y) 的同义兼容
 * 自动尊重 prefers-reduced-motion。
 *
 * 1.1 性能改动：
 *   - 视差由"永久 rAF 循环 + 每帧 querySelectorAll"改为滚动事件驱动，
 *     节点缓存复用，页面静止时完全停帧（零开销）。
 *   - 位于 .story-stack（层叠章节栈）内的视差屏由栈自行驱动，这里跳过。
 */
(function (global) {
  'use strict';
  var cfg = Object.assign({
    ease: 0.09,
    anchorOffset: 64,
    parallaxSection: '.photo-stage',
    parallaxTarget: '.photo-bg',
    parallaxRange: 64
  }, global.SMOOTH_FLOW_CONFIG || {});

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var maxY = function () { return document.documentElement.scrollHeight - innerHeight; };
  var target = scrollY, current = scrollY, raf = null;
  var trackEl = null, trackOffset = 0;

  function loop() {
    raf = requestAnimationFrame(function () {
      if (trackEl) {
        // 跟踪元素：content-visibility 区块在途中展开导致高度变化时仍能准确落点
        target = Math.max(0, Math.min(maxY(), trackEl.getBoundingClientRect().top + scrollY - trackOffset));
      }
      current += (target - current) * cfg.ease;
      if (Math.abs(target - current) < 0.6) {
        current = target; trackEl = null;
        scrollTo(0, current); raf = null; return;
      }
      scrollTo(0, current);
      loop();
    });
  }
  function go(y) {
    trackEl = null;
    target = Math.max(0, Math.min(maxY(), y));
    if (!raf) { current = scrollY; loop(); }
  }
  function goElement(el, offset) {
    if (!el) { return; }
    trackEl = el;
    trackOffset = offset == null ? cfg.anchorOffset : offset;
    target = Math.max(0, Math.min(maxY(), el.getBoundingClientRect().top + scrollY - trackOffset));
    if (!raf) { current = scrollY; loop(); }
  }
  global.SmoothFlow = { to: go, toElement: goElement, config: cfg };
  global.__scrollTo = go;

  if (!reduced) {
    addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.defaultPrevented) return;
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      e.preventDefault();
      go((raf ? target : scrollY) + dy);
    }, { passive: false });
    addEventListener('scroll', function () { if (!raf) target = current = scrollY; }, { passive: true });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    if (reduced) {
      scrollTo(0, el.getBoundingClientRect().top + scrollY - cfg.anchorOffset);
    } else {
      goElement(el, cfg.anchorOffset);
    }
  });

  /* ----- 视差：滚动驱动，静止即停帧 ----- */
  var pxNodes = null;
  var pxRaf = null;

  function collect() {
    pxNodes = [];
    var secs = document.querySelectorAll(cfg.parallaxSection);
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      if (s.closest && s.closest('.story-stack')) continue; // 层叠章节栈自行驱动
      var bg = s.querySelector(cfg.parallaxTarget);
      if (bg) pxNodes.push([s, bg]);
    }
  }

  function parallaxFrame() {
    pxRaf = null;
    if (!pxNodes) collect();
    for (var i = 0; i < pxNodes.length; i++) {
      var r = pxNodes[i][0].getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      var p = (r.top + r.height / 2 - innerHeight / 2) / (innerHeight + r.height);
      pxNodes[i][1].style.setProperty('--py', (p * -cfg.parallaxRange).toFixed(1) + 'px');
    }
  }

  function schedulePx() { if (!pxRaf) pxRaf = requestAnimationFrame(parallaxFrame); }

  if (!reduced) {
    addEventListener('scroll', schedulePx, { passive: true });
    addEventListener('resize', function () { pxNodes = null; schedulePx(); });
    // React 挂载与图片就位后重新收集一次
    addEventListener('load', function () { pxNodes = null; schedulePx(); });
    schedulePx();
  }
})(typeof window !== 'undefined' ? window : this);
