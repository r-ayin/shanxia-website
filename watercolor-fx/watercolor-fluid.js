/*!
 * WatercolorFX 1.0
 * Fluid watercolor cursor effects: paint-bloom image reveal, fluid cursor
 * trail, click splats, custom cursor.
 *
 * Original implementation of the classic GPU fluid technique
 * (Jos Stam "Stable Fluids" / GPU Gems ch.38). No third-party code.
 * Free to use in your own projects.
 *
 * Usage:
 *   const fx = WatercolorFX.init({ canvas: el, image: 'painting.jpg' });
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Config                                                              */
  /* ------------------------------------------------------------------ */

  const DEFAULTS = {
    // simulation
    SIM_RESOLUTION: 144,        // velocity field resolution
    DYE_RESOLUTION: 1024,       // pigment field resolution
    DENSITY_DISSIPATION: 0.55,  // how fast paint fades (per second)
    VELOCITY_DISSIPATION: 1.7,  // how fast motion settles
    PRESSURE: 0.8,
    PRESSURE_ITERATIONS: 20,
    CURL: 6,                    // vorticity -> swirly pigment
    SPLAT_RADIUS: 0.21,         // cursor brush size (fraction-ish)
    SPLAT_FORCE: 5600,

    // click burst
    CLICK_SPLATS: 16,
    CLICK_FORCE: 900,
    CLICK_RADIUS: 3.2,

    // look
    PALETTE: ['#2e5d8a', '#4d8a8a', '#7a6aa0', '#b0764f', '#9a4f63'],
    PALETTE_SPEED: 0.08,        // pigment hue drift speed
    PAPER: '#f4efe4',
    INK_STRENGTH: 0.55,         // pigment tint visibility over the image
    EDGE_DARKEN: 0.22,          // watercolor edge accumulation
    GRAIN: 0.5,                 // paper granulation 0..1
    IMAGE_DISTORT: 1.6,         // paint-bleed distortion of the image
    REVEAL_LOW: 0.05,           // dye amount where reveal starts
    REVEAL_HIGH: 0.6,           // dye amount where image is fully shown

    // modes
    MODE: 'paint',              // 'paint' = paper+image | 'ink' = transparent ink trail | 'reveal' = transparent canvas, image develops where paint flows
    TRANSPARENT: false,         // legacy alias for MODE:'ink'
    AMBIENT: false,             // occasional idle splats
    CUSTOM_CURSOR: true,
    CURSOR_HOVER_SELECTOR: 'a, button, [data-cursor]',
    MAX_DPR: 2,
  };

  /* ------------------------------------------------------------------ */
  /* Shaders                                                             */
  /* ------------------------------------------------------------------ */

  const BASE_VERT = `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;
    void main () {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const COPY_FRAG = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    void main () { gl_FragColor = texture2D(uTexture, vUv); }
  `;

  const CLEAR_FRAG = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;
    void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
  `;

  const SPLAT_FRAG = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;
    void main () {
      vec2 p = vUv - point.xy;
      p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + splat, 1.0);
    }
  `;

  const ADVECTION_FRAG = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform float dt;
    uniform float dissipation;

    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
      vec2 st = uv / tsize - 0.5;
      vec2 iuv = floor(st);
      vec2 fuv = fract(st);
      vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
      vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
      vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
      vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
      return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }

    void main () {
    #ifdef MANUAL_FILTERING
      vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
      vec4 result = bilerp(uSource, coord, dyeTexelSize);
    #else
      vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
      vec4 result = texture2D(uSource, coord);
    #endif
      float decay = 1.0 + dissipation * dt;
      gl_FragColor = result / decay;
    }
  `;

  const DIVERGENCE_FRAG = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uVelocity, vL).x;
      float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y;
      float B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) { L = -C.x; }
      if (vR.x > 1.0) { R = -C.x; }
      if (vT.y > 1.0) { T = -C.y; }
      if (vB.y < 0.0) { B = -C.y; }
      float div = 0.5 * (R - L + T - B);
      gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
  `;

  const CURL_FRAG = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uVelocity, vL).y;
      float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x;
      float B = texture2D(uVelocity, vB).x;
      float vorticity = R - L - T + B;
      gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
  `;

  const VORTICITY_FRAG = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;
    void main () {
      float L = texture2D(uCurl, vL).x;
      float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x;
      float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C;
      force.y *= -1.0;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity += force * dt;
      velocity = min(max(velocity, -1000.0), 1000.0);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `;

  const PRESSURE_FRAG = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      float divergence = texture2D(uDivergence, vUv).x;
      float pressure = (L + R + B + T - divergence) * 0.25;
      gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
  `;

  const GRADIENT_SUBTRACT_FRAG = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity.xy -= vec2(R - L, T - B);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `;

  // The watercolor composition pass: paper + pigment + image reveal.
  const DISPLAY_FRAG = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uDye;
    uniform sampler2D uImage;
    uniform vec2 dyeTexelSize;
    uniform vec2 uImageScale;
    uniform vec3 uPaper;
    uniform float uHasImage;
    uniform float uMode;
    uniform float uInkStrength;
    uniform float uEdgeDarken;
    uniform float uGrain;
    uniform float uDistort;
    uniform float uRevealLow;
    uniform float uRevealHigh;
    uniform float uTime;

    float hash (vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float vnoise (vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y);
    }
    float fbm (vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p = p * 2.07 + vec2(13.7, 7.1);
        a *= 0.5;
      }
      return v;
    }

    void main () {
      vec3 ink = texture2D(uDye, vUv).rgb;
      float amt = max(ink.r, max(ink.g, ink.b));

      // ragged pigment edge: modulate amount with paper-grain fbm
      float grain = fbm(vUv * vec2(22.0, 14.0));
      float amtN = amt * (0.72 + 0.56 * grain);

      // pigment gradient -> paint-bleed distortion of the image
      float aL = texture2D(uDye, vUv - vec2(dyeTexelSize.x, 0.0)).g;
      float aR = texture2D(uDye, vUv + vec2(dyeTexelSize.x, 0.0)).g;
      float aB = texture2D(uDye, vUv - vec2(0.0, dyeTexelSize.y)).g;
      float aT = texture2D(uDye, vUv + vec2(0.0, dyeTexelSize.y)).g;
      vec2 grad = vec2(aR - aL, aT - aB);

      float reveal = smoothstep(uRevealLow, uRevealHigh, amtN);
      // edge band where pigment is thin -> watercolor edge darkening
      float edge = smoothstep(uRevealLow * 0.4, uRevealLow * 2.0, amtN)
                 * (1.0 - smoothstep(uRevealLow * 2.0, uRevealHigh * 0.8, amtN));

      vec3 inkTone = ink / max(amt, 0.0001);

      if (uMode > 1.5) {
        // reveal-overlay mode: transparent canvas, the image develops
        // through where the paint flows (premultiplied alpha)
        vec2 iuv = (vUv - 0.5) * uImageScale + 0.5 + grad * uDistort * 0.01;
        iuv = clamp(iuv, 0.0, 1.0);
        vec3 img = texture2D(uImage, vec2(iuv.x, 1.0 - iuv.y)).rgb;
        float wash = (1.0 - reveal) * clamp(amtN * 2.2, 0.0, 1.0) * uInkStrength;
        vec3 col = mix(img, img * (inkTone * 0.7 + 0.3), wash);
        col *= 1.0 - edge * uEdgeDarken;
        float aOut = max(reveal, wash * 0.5);
        if (uHasImage < 0.5) {
          col = inkTone * (0.85 + 0.3 * grain);
          aOut = clamp(amtN * 1.2, 0.0, 1.0) * 0.85;
        }
        gl_FragColor = vec4(col * aOut, aOut);
        return;
      }

      if (uMode > 0.5) {
        // ink overlay mode: pigment trail only, premultiplied alpha
        float a = clamp(amtN * 1.4, 0.0, 1.0);
        a *= a;
        vec3 col = inkTone * (0.85 + 0.3 * grain);
        col *= 1.0 - edge * uEdgeDarken;
        gl_FragColor = vec4(col * a, a);
        return;
      }

      // textured paper
      vec3 paper = uPaper * (0.965 + 0.07 * uGrain * fbm(vUv * 70.0));

      // image lookup (cover fit + bleed distortion)
      vec2 iuv = (vUv - 0.5) * uImageScale + 0.5;
      iuv += grad * uDistort * 0.01;
      iuv = clamp(iuv, 0.0, 1.0);
      vec3 img = texture2D(uImage, vec2(iuv.x, 1.0 - iuv.y)).rgb;

      vec3 target = (uHasImage > 0.5) ? img : inkTone * 0.85 + 0.05;

      // base: paper -> image as pigment saturates
      vec3 col = mix(paper, target, reveal);

      // thin washes tint the paper with pigment colour
      float wash = (1.0 - reveal) * clamp(amtN * 2.2, 0.0, 1.0) * uInkStrength;
      col = mix(col, col * (inkTone * 0.62 + 0.38), wash);

      // watercolor edge accumulation (darker rim where the bloom ends)
      col *= 1.0 - edge * uEdgeDarken;

      // subtle granulation inside the revealed area
      col *= 1.0 - (0.05 * uGrain) * reveal * (grain - 0.5);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* ------------------------------------------------------------------ */
  /* Small utils                                                         */
  /* ------------------------------------------------------------------ */

  function hexToRgb (hex) {
    const h = hex.replace('#', '');
    const v = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
  }

  function clamp01 (v) { return Math.min(1, Math.max(0, v)); }

  /* ------------------------------------------------------------------ */
  /* GL plumbing                                                         */
  /* ------------------------------------------------------------------ */

  function getWebGLContext (canvas) {
    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    let gl = canvas.getContext('webgl2', params);
    const isWebGL2 = !!gl;
    if (!isWebGL2) {
      gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    }
    if (!gl) { return null; }

    let halfFloat = null;
    let supportLinearFiltering = false;
    if (isWebGL2) {
      gl.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = !!gl.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = gl.getExtension('OES_texture_half_float');
      supportLinearFiltering = !!gl.getExtension('OES_texture_half_float_linear');
    }
    gl.clearColor(0, 0, 0, 0);

    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : (halfFloat && halfFloat.HALF_FLOAT_OES);
    let formatRGBA, formatRG, formatR;

    if (isWebGL2) {
      formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
      formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    } else {
      formatRGBA = halfFloatTexType ? getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType) : null;
      formatRG = formatRGBA;
      formatR = formatRGBA;
    }

    let texType = halfFloatTexType;
    if (!formatRGBA) {
      // last-resort fallback: 8-bit textures (lower quality, still works)
      texType = gl.UNSIGNED_BYTE;
      formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, texType);
      formatRG = formatRGBA;
      formatR = formatRGBA;
      supportLinearFiltering = true;
    }

    return {
      gl, isWebGL2,
      ext: { formatRGBA, formatRG, formatR, halfFloatTexType: texType, supportLinearFiltering },
    };

    function getSupportedFormat (gl2, internalFormat, format, type) {
      if (!supportRenderTextureFormat(gl2, internalFormat, format, type)) {
        if (isWebGL2) {
          if (internalFormat === gl2.R16F) { return getSupportedFormat(gl2, gl2.RG16F, gl2.RG, type); }
          if (internalFormat === gl2.RG16F) { return getSupportedFormat(gl2, gl2.RGBA16F, gl2.RGBA, type); }
        }
        return null;
      }
      return { internalFormat, format };
    }

    function supportRenderTextureFormat (gl2, internalFormat, format, type) {
      const texture = gl2.createTexture();
      gl2.bindTexture(gl2.TEXTURE_2D, texture);
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MIN_FILTER, gl2.NEAREST);
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MAG_FILTER, gl2.NEAREST);
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_S, gl2.CLAMP_TO_EDGE);
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_T, gl2.CLAMP_TO_EDGE);
      try {
        gl2.texImage2D(gl2.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      } catch (e) {
        return false;
      }
      const fbo = gl2.createFramebuffer();
      gl2.bindFramebuffer(gl2.FRAMEBUFFER, fbo);
      gl2.framebufferTexture2D(gl2.FRAMEBUFFER, gl2.COLOR_ATTACHMENT0, gl2.TEXTURE_2D, texture, 0);
      const ok = gl2.checkFramebufferStatus(gl2.FRAMEBUFFER) === gl2.FRAMEBUFFER_COMPLETE;
      gl2.deleteFramebuffer(fbo);
      gl2.deleteTexture(texture);
      return ok;
    }
  }

  function compileShader (gl, type, source, keywords) {
    let src = source;
    if (keywords && keywords.length) {
      src = keywords.map(k => '#define ' + k + '\n').join('') + source;
    }
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('WatercolorFX shader error:', gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function createProgram (gl, vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('WatercolorFX link error:', gl.getProgramInfoLog(program));
    }
    return program;
  }

  function getUniforms (gl, program) {
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return uniforms;
  }

  function Program (gl, vertexShader, fragmentSource, keywords) {
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, keywords);
    this.program = createProgram(gl, vertexShader, fs);
    this.uniforms = getUniforms(gl, this.program);
    this.gl = gl;
  }
  Program.prototype.bind = function () { this.gl.useProgram(this.program); };

  /* ------------------------------------------------------------------ */
  /* Engine                                                              */
  /* ------------------------------------------------------------------ */

  function init (options) {
    const config = Object.assign({}, DEFAULTS, options || {});
    let canvas = config.canvas;
    if (typeof canvas === 'string') { canvas = document.querySelector(canvas); }
    if (!canvas) { throw new Error('WatercolorFX: options.canvas is required'); }
    if (canvas.tagName !== 'CANVAS') {
      const host = canvas;
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      host.appendChild(canvas);
    }

    const ctx = getWebGLContext(canvas);
    if (!ctx) {
      console.warn('WatercolorFX: WebGL not available');
      return { destroy: function () {}, supported: false };
    }
    const gl = ctx.gl;
    const ext = ctx.ext;

    /* ----- geometry / blit ----- */
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const elemBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elemBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    function blit (target) {
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    /* ----- FBOs ----- */
    function createFBO (w, h, internalFormat, format, type, filter) {
      gl.activeTexture(gl.TEXTURE0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);

      return {
        texture, fbo,
        width: w, height: h,
        texelSizeX: 1 / w, texelSizeY: 1 / h,
        attach (id) {
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          return id;
        },
      };
    }

    function createDoubleFBO (w, h, internalFormat, format, type, filter) {
      let fbo1 = createFBO(w, h, internalFormat, format, type, filter);
      let fbo2 = createFBO(w, h, internalFormat, format, type, filter);
      return {
        width: w, height: h,
        texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
        get read () { return fbo1; },
        set read (v) { fbo1 = v; },
        get write () { return fbo2; },
        set write (v) { fbo2 = v; },
        swap () { const t = fbo1; fbo1 = fbo2; fbo2 = t; },
      };
    }

    /* ----- programs ----- */
    const baseVertex = compileShader(gl, gl.VERTEX_SHADER, BASE_VERT);
    const filterKeywords = ext.supportLinearFiltering ? null : ['MANUAL_FILTERING'];

    const copyProgram = new Program(gl, baseVertex, COPY_FRAG);
    const clearProgram = new Program(gl, baseVertex, CLEAR_FRAG);
    const splatProgram = new Program(gl, baseVertex, SPLAT_FRAG);
    const advectionProgram = new Program(gl, baseVertex, ADVECTION_FRAG, filterKeywords);
    const divergenceProgram = new Program(gl, baseVertex, DIVERGENCE_FRAG);
    const curlProgram = new Program(gl, baseVertex, CURL_FRAG);
    const vorticityProgram = new Program(gl, baseVertex, VORTICITY_FRAG);
    const pressureProgram = new Program(gl, baseVertex, PRESSURE_FRAG);
    const gradSubtractProgram = new Program(gl, baseVertex, GRADIENT_SUBTRACT_FRAG);
    const displayProgram = new Program(gl, baseVertex, DISPLAY_FRAG);

    /* ----- sim targets ----- */
    let dye, velocity, divergence, curl, pressure;

    function getResolution (resolution) {
      let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspect < 1) { aspect = 1 / aspect; }
      const min = Math.round(resolution);
      const max = Math.round(resolution * aspect);
      if (gl.drawingBufferWidth > gl.drawingBufferHeight) {
        return { width: max, height: min };
      }
      return { width: min, height: max };
    }

    function initFramebuffers () {
      const simRes = getResolution(config.SIM_RESOLUTION);
      const dyeRes = getResolution(config.DYE_RESOLUTION);
      const texType = ext.halfFloatTexType;
      const rgba = ext.formatRGBA;
      const rg = ext.formatRG;
      const r = ext.formatR;
      const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      gl.disable(gl.BLEND);

      if (!dye) {
        dye = createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
      } else {
        dye = resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
      }
      if (!velocity) {
        velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
      } else {
        velocity = resizeDoubleFBO(velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
      }
      divergence = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      curl = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      pressure = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    }

    function resizeFBO (target, w, h, internalFormat, format, type, filter) {
      const newFBO = createFBO(w, h, internalFormat, format, type, filter);
      copyProgram.bind();
      gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
      blit(newFBO);
      return newFBO;
    }

    function resizeDoubleFBO (target, w, h, internalFormat, format, type, filter) {
      if (target.width === w && target.height === h) { return target; }
      target.read = resizeFBO(target.read, w, h, internalFormat, format, type, filter);
      target.write = createFBO(w, h, internalFormat, format, type, filter);
      target.width = w; target.height = h;
      target.texelSizeX = 1 / w; target.texelSizeY = 1 / h;
      return target;
    }

    /* ----- image texture ----- */
    let imageTexture = null;
    let imageAspect = 1;
    let hasImage = false;

    function setImageFromSource (source) {
      if (!imageTexture) { imageTexture = gl.createTexture(); }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        imageAspect = (source.naturalWidth || source.width) / (source.naturalHeight || source.height);
        hasImage = true;
      } catch (err) {
        // CORS-tainted source: keep running without the image
        console.warn('WatercolorFX: image not usable as texture (CORS?)', err);
        hasImage = false;
      }
    }

    let imageReq = 0;
    function setImage (src) {
      if (!src) { return; }
      const req = ++imageReq;
      if (typeof src === 'string') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        // 序号校验：快速连续换图时只让最后一次生效
        img.onload = function () { if (req === imageReq) { setImageFromSource(img); } };
        img.onerror = function () {
          console.warn('WatercolorFX: failed to load image', src);
          // 加载失败（如 CORS 被拒）时回到无图状态，
          // 否则会把上一张旧图继续显影出来
          if (req === imageReq) { hasImage = false; }
        };
        img.src = src;
      } else {
        setImageFromSource(src);
      }
    }

    // 1x1 placeholder so the sampler is always valid
    (function makePlaceholder () {
      imageTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 200, 200, 255]));
    })();
    if (config.image) { setImage(config.image); }

    /* ----- palette ----- */
    const palette = (config.PALETTE || DEFAULTS.PALETTE).map(hexToRgb);
    let paletteT = Math.random() * palette.length;

    function paletteColor (offset, strength) {
      const t = (paletteT + (offset || 0)) % palette.length;
      const i = Math.floor(t);
      const f = t - i;
      const a = palette[i];
      const b = palette[(i + 1) % palette.length];
      const s = strength == null ? 1 : strength;
      return {
        r: (a.r + (b.r - a.r) * f) * s,
        g: (a.g + (b.g - a.g) * f) * s,
        b: (a.b + (b.b - a.b) * f) * s,
      };
    }

    /* ----- pointer state ----- */
    const pointers = new Map(); // pointerId -> state
    const splatQueue = [];

    function pointerState (id) {
      let p = pointers.get(id);
      if (!p) {
        p = { x: 0, y: 0, prevX: 0, prevY: 0, down: false, moved: false, started: false };
        pointers.set(id, p);
      }
      return p;
    }

    function toTexCoords (e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clamp01((e.clientX - rect.left) / rect.width),
        y: clamp01(1 - (e.clientY - rect.top) / rect.height),
      };
    }

    function correctRadius (radius) {
      const aspect = canvas.width / canvas.height;
      return aspect > 1 ? radius * aspect : radius;
    }

    function splat (x, y, dx, dy, color, radiusScale) {
      gl.disable(gl.BLEND);
      splatProgram.bind();
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
      gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(splatProgram.uniforms.point, x, y);
      gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0);
      gl.uniform1f(splatProgram.uniforms.radius,
        correctRadius((config.SPLAT_RADIUS / 100) * (radiusScale || 1)));
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
      gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
      blit(dye.write);
      dye.swap();
    }

    function clickBurst (x, y) {
      // central pigment bloom
      const c = paletteColor(0, 0.85);
      splatQueue.push({ x, y, dx: 0, dy: 0, color: c, radius: config.CLICK_RADIUS });
      // radial ink petals
      const n = config.CLICK_SPLATS;
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 + Math.random() * 0.6;
        const force = config.CLICK_FORCE * (0.55 + Math.random() * 0.9);
        const col = paletteColor(Math.random() * 1.5, 0.35 + Math.random() * 0.35);
        splatQueue.push({
          x, y,
          dx: Math.cos(angle) * force,
          dy: Math.sin(angle) * force,
          color: col,
          radius: 0.55 + Math.random() * 0.8,
        });
      }
    }

    /* ----- events ----- */
    function onPointerMove (e) {
      if (!running) { return; }
      const p = pointerState(e.pointerId != null ? e.pointerId : 0);
      const rect = canvas.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top || e.clientY > rect.bottom) {
        p.started = false;   // re-anchor on re-entry, no streaks
        return;
      }
      const t = toTexCoords(e);
      if (!p.started) {
        p.started = true;
        p.x = p.prevX = t.x;
        p.y = p.prevY = t.y;
        return;
      }
      p.prevX = p.x; p.prevY = p.y;
      p.x = t.x; p.y = t.y;
      const aspect = canvas.width / canvas.height;
      let dx = (p.x - p.prevX) * config.SPLAT_FORCE;
      let dy = (p.y - p.prevY) * config.SPLAT_FORCE;
      if (aspect >= 1) { dy /= aspect; } else { dx *= aspect; }
      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        const speed = Math.min(1, Math.hypot(p.x - p.prevX, p.y - p.prevY) * 28);
        const col = paletteColor(0, 0.22 + speed * 0.5);
        splatQueue.push({ x: p.x, y: p.y, dx, dy, color: col, radius: 0.8 + speed * 0.6 });
      }
    }

    function onPointerDown (e) {
      if (cursor) { cursor.press(true); }
      if (!running) { return; }
      const ignore = config.IGNORE_CLICK_SELECTOR || 'a, button, input, textarea, select, [data-no-splat]';
      if (e.target && e.target.closest && e.target.closest(ignore)) { return; }
      const t = toTexCoords(e);
      const rect = canvas.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top || e.clientY > rect.bottom) { return; }
      clickBurst(t.x, t.y);
    }

    function onPointerUp () { if (cursor) { cursor.press(false); } }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });

    function onTouchMove (e) {
      for (let i = 0; i < e.targetTouches.length; i++) {
        const t = e.targetTouches[i];
        onPointerMove({ pointerId: t.identifier, clientX: t.clientX, clientY: t.clientY });
      }
    }
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    /* ----- custom cursor ----- */
    let cursor = null;
    if (config.CUSTOM_CURSOR && window.matchMedia('(pointer: fine)').matches) {
      cursor = createCursor(config);
    }

    /* ----- resize ----- */
    function resizeCanvas () {
      const dpr = Math.min(window.devicePixelRatio || 1, config.MAX_DPR);
      const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        return true;
      }
      return false;
    }

    /* ----- simulation step ----- */
    function step (dt) {
      gl.disable(gl.BLEND);

      curlProgram.bind();
      gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(curl);

      vorticityProgram.bind();
      gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
      gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
      gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity.write);
      velocity.swap();

      divergenceProgram.bind();
      gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(divergence);

      clearProgram.bind();
      gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
      gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
      blit(pressure.write);
      pressure.swap();

      pressureProgram.bind();
      gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
        blit(pressure.write);
        pressure.swap();
      }

      gradSubtractProgram.bind();
      gl.uniform2f(gradSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(gradSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
      gl.uniform1i(gradSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();

      advectionProgram.bind();
      gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      if (!ext.supportLinearFiltering) {
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
      }
      const velId = velocity.read.attach(0);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velId);
      gl.uniform1i(advectionProgram.uniforms.uSource, velId);
      gl.uniform1f(advectionProgram.uniforms.dt, dt);
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
      blit(velocity.write);
      velocity.swap();

      if (!ext.supportLinearFiltering) {
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
      }
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
      blit(dye.write);
      dye.swap();
    }

    /* ----- render ----- */
    const paperRgb = hexToRgb(config.PAPER);

    function render () {
      gl.disable(gl.BLEND);
      displayProgram.bind();
      gl.uniform1i(displayProgram.uniforms.uDye, dye.read.attach(0));
      gl.uniform1i(displayProgram.uniforms.uImage, (function () {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        return 1;
      })());
      gl.uniform2f(displayProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);

      // cover-fit scale
      const canvasAspect = canvas.width / canvas.height;
      let sx = 1, sy = 1;
      if (canvasAspect > imageAspect) { sy = imageAspect / canvasAspect; }
      else { sx = canvasAspect / imageAspect; }
      gl.uniform2f(displayProgram.uniforms.uImageScale, sx, sy);

      gl.uniform3f(displayProgram.uniforms.uPaper, paperRgb.r, paperRgb.g, paperRgb.b);
      gl.uniform1f(displayProgram.uniforms.uHasImage, hasImage ? 1 : 0);
      const modeVal = config.MODE === 'reveal' ? 2
        : (config.MODE === 'ink' || config.TRANSPARENT) ? 1 : 0;
      gl.uniform1f(displayProgram.uniforms.uMode, modeVal);
      gl.uniform1f(displayProgram.uniforms.uInkStrength, config.INK_STRENGTH);
      gl.uniform1f(displayProgram.uniforms.uEdgeDarken, config.EDGE_DARKEN);
      gl.uniform1f(displayProgram.uniforms.uGrain, config.GRAIN);
      gl.uniform1f(displayProgram.uniforms.uDistort, config.IMAGE_DISTORT);
      gl.uniform1f(displayProgram.uniforms.uRevealLow, config.REVEAL_LOW);
      gl.uniform1f(displayProgram.uniforms.uRevealHigh, config.REVEAL_HIGH);
      gl.uniform1f(displayProgram.uniforms.uTime, now * 0.001);
      blit(null);
    }

    /* ----- main loop ----- */
    let lastTime = performance.now();
    let now = lastTime;
    let running = true;
    let destroyed = false;
    let ambientTimer = 2 + Math.random() * 4;

    function frame () {
      if (destroyed) { return; }
      requestAnimationFrame(frame);

      now = performance.now();
      let dt = (now - lastTime) / 1000;
      dt = Math.min(dt, 1 / 30);
      lastTime = now;

      // 光标跟随独立于模拟：暂停（滚出视口）时光标仍然流畅
      if (cursor) { cursor.update(dt); }
      if (!running) { return; }

      if (resizeCanvas()) { initFramebuffers(); }

      paletteT = (paletteT + dt * config.PALETTE_SPEED * palette.length) % palette.length;

      if (config.AMBIENT) {
        ambientTimer -= dt;
        if (ambientTimer <= 0) {
          ambientTimer = 3 + Math.random() * 5;
          const col = paletteColor(Math.random() * 2, 0.12);
          splatQueue.push({
            x: 0.15 + Math.random() * 0.7,
            y: 0.15 + Math.random() * 0.7,
            dx: (Math.random() - 0.5) * 220,
            dy: (Math.random() - 0.5) * 220,
            color: col, radius: 1.4,
          });
        }
      }

      while (splatQueue.length) {
        const s = splatQueue.shift();
        splat(s.x, s.y, s.dx, s.dy, s.color, s.radius);
      }

      step(dt);
      render();
    }

    initFramebuffers();
    resizeCanvas();
    initFramebuffers();
    requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', onVisibility);
    function onVisibility () {
      running = !document.hidden;
      lastTime = performance.now();
    }

    /* ----- public api ----- */
    return {
      supported: true,
      canvas,
      config,
      setImage,
      burst (clientX, clientY) {
        const t = toTexCoords({ clientX, clientY });
        clickBurst(t.x, t.y);
      },
      splatAt (clientX, clientY, dx, dy) {
        const t = toTexCoords({ clientX, clientY });
        splatQueue.push({
          x: t.x, y: t.y,
          dx: dx || 0, dy: dy || 0,
          color: paletteColor(0, 0.5), radius: 1,
        });
      },
      clear () {
        clearProgram.bind();
        gl.uniform1i(clearProgram.uniforms.uTexture, dye.read.attach(0));
        gl.uniform1f(clearProgram.uniforms.value, 0);
        blit(dye.write);
        dye.swap();
      },
      pause () { running = false; },
      resume () { running = true; lastTime = performance.now(); },
      destroy () {
        destroyed = true;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('visibilitychange', onVisibility);
        if (cursor) { cursor.destroy(); }
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) { lose.loseContext(); }
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Custom cursor (dot + lagging ring)                                  */
  /* ------------------------------------------------------------------ */

  function createCursor (config) {
    const style = document.createElement('style');
    style.textContent = [
      '.wfx-cursor-dot,.wfx-cursor-ring{position:fixed;top:0;left:0;pointer-events:none;',
      'z-index:99999;border-radius:50%;will-change:transform;}',
      '.wfx-cursor-dot{width:6px;height:6px;background:rgba(40,40,45,.9);',
      'margin:-3px 0 0 -3px;transition:opacity .25s;}',
      '.wfx-cursor-ring{width:36px;height:36px;border:1.5px solid rgba(40,40,45,.45);',
      'margin:-18px 0 0 -18px;transition:opacity .25s;}',
      'html.wfx-hide-cursor,html.wfx-hide-cursor *{cursor:none!important;}',
    ].join('');
    document.head.appendChild(style);

    const dot = document.createElement('div');
    dot.className = 'wfx-cursor-dot';
    const ring = document.createElement('div');
    ring.className = 'wfx-cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.documentElement.classList.add('wfx-hide-cursor');

    let x = -100, y = -100;
    let rx = -100, ry = -100;
    let scale = 1, targetScale = 1;
    let pressed = false, hovering = false, visible = false;

    function applyTargets () {
      targetScale = pressed ? 0.7 : (hovering ? 1.7 : 1);
    }

    function onMove (e) {
      x = e.clientX; y = e.clientY;
      if (!visible) {
        visible = true;
        rx = x; ry = y;
        dot.style.opacity = '1';
        ring.style.opacity = '1';
      }
      const t = e.target;
      hovering = !!(t && t.closest && t.closest(config.CURSOR_HOVER_SELECTOR));
      applyTargets();
    }
    function onLeave () {
      visible = false;
      dot.style.opacity = '0';
      ring.style.opacity = '0';
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    dot.style.opacity = '0';
    ring.style.opacity = '0';

    return {
      press (v) { pressed = v; applyTargets(); },
      update (dt) {
        const k = 1 - Math.pow(0.0015, dt);   // smooth follow
        rx += (x - rx) * k;
        ry += (y - ry) * k;
        scale += (targetScale - scale) * (1 - Math.pow(0.001, dt));
        dot.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) scale(' + scale.toFixed(3) + ')';
      },
      destroy () {
        window.removeEventListener('pointermove', onMove);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        dot.remove(); ring.remove(); style.remove();
        document.documentElement.classList.remove('wfx-hide-cursor');
      },
    };
  }

  /* ------------------------------------------------------------------ */

  const WatercolorFX = { init, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = WatercolorFX; }
  global.WatercolorFX = WatercolorFX;

})(typeof window !== 'undefined' ? window : this);
