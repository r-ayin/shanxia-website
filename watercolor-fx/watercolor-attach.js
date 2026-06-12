/*!
 * WatercolorAttach 1.0 — 一行代码把流体水彩层挂到任意页面
 * 依赖：watercolor-fluid.js（先于本文件加载）
 *
 *   WatercolorAttach.veil('.hero', { image: 'photo.jpg' })   // 容器内"显影"层
 *   WatercolorAttach.overlay({ PALETTE: ['#8b3a1f'] })        // 全页墨流叠加
 */
(function (global) {
  'use strict';

  function makeCanvas(positioning, zIndex) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:' + positioning +
      ';inset:0;width:100%;height:100%;pointer-events:none;display:block;z-index:' + zIndex + ';';
    return canvas;
  }

  /**
   * 在一个或多个容器内挂"水彩显影层"（MODE: 'reveal'）。
   * @param {string|Element} target  CSS 选择器或元素
   * @param {object} options        WatercolorFX 配置 + { zIndex, autoPause }
   * @returns {Array} 实例数组，每个实例附加 .detach() / .host / .canvasEl
   */
  function veil(target, options) {
    options = options || {};
    var hosts = typeof target === 'string'
      ? Array.prototype.slice.call(document.querySelectorAll(target))
      : [target];

    return hosts.map(function (host) {
      if (getComputedStyle(host).position === 'static') {
        host.style.position = 'relative';
      }
      var canvas = makeCanvas('absolute', options.zIndex != null ? options.zIndex : 0);
      host.appendChild(canvas);

      var cfg = Object.assign({ canvas: canvas, MODE: 'reveal' }, options);
      delete cfg.zIndex; delete cfg.autoPause;
      var fx = global.WatercolorFX.init(cfg);

      var ob = null;
      if (fx.supported && options.autoPause !== false && 'IntersectionObserver' in global) {
        ob = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { e.isIntersecting ? fx.resume() : fx.pause(); });
        }, { threshold: 0.02 });
        ob.observe(host);
      }

      fx.host = host;
      fx.canvasEl = canvas;
      fx.detach = function () {
        if (ob) { ob.disconnect(); }
        fx.destroy();
        canvas.remove();
      };
      return fx;
    });
  }

  /**
   * 全页固定叠加一层墨水拖尾（MODE: 'ink'），不挡任何点击。
   * @returns 实例，附加 .detach()
   */
  function overlay(options) {
    options = options || {};
    var canvas = makeCanvas('fixed', options.zIndex != null ? options.zIndex : 9999);
    document.body.appendChild(canvas);

    var cfg = Object.assign({ canvas: canvas, MODE: 'ink' }, options);
    delete cfg.zIndex;
    var fx = global.WatercolorFX.init(cfg);
    fx.canvasEl = canvas;
    fx.detach = function () { fx.destroy(); canvas.remove(); };
    return fx;
  }

  global.WatercolorAttach = { veil: veil, overlay: overlay };
})(typeof window !== 'undefined' ? window : this);
