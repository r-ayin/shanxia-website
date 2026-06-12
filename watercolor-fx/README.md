# WatercolorFX — 流体水彩光标特效

复刻 davidwhyte.com/experience 同款交互手感的独立模块：

- **流体光标拖尾**：鼠标移动时注入彩色"墨水"，按真实流体方程（Navier-Stokes）扩散、卷曲、消散
- **水彩晕开显示图片**：墨水密度场被用作图片的显示遮罩 + 边缘噪声 + 扭曲贴图，划过的地方画作像水彩在纸上晕开一样浮现，停止后慢慢淡回纸面
- **点击 splat 爆开**：点击触发中心墨晕 + 径向多点喷溅
- **自定义光标**：小圆点 + 延迟跟随的圆环，悬停可点击元素时放大，按下时收缩

零依赖，单文件（约 1000 行），纯 WebGL（自动降级 WebGL1 / 8-bit 纹理）。
技术原理为公开的经典 GPU 流体算法（GPU Gems ch.38），代码为原创实现，可自由用于你的项目。

## 快速开始

直接双击 `index.html` 即可看效果（内置程序化生成的演示画作，可拖入自己的图片替换）。

## 集成到你的项目

### 纯 HTML

```html
<canvas id="fx" style="position:fixed;inset:0;width:100%;height:100%"></canvas>
<script src="watercolor-fluid.js"></script>
<script>
  const fx = WatercolorFX.init({
    canvas: document.getElementById('fx'),
    image: 'your-watercolor-painting.jpg',   // 想被"晕开显示"的图
  });
</script>
```

### 只要光标拖尾，不要图片显示（叠加在现有页面上）

```html
<canvas id="fx" style="position:fixed;inset:0;width:100%;height:100%;
        pointer-events:none;z-index:9999"></canvas>
<script>
  WatercolorFX.init({
    canvas: document.getElementById('fx'),
    TRANSPARENT: true,        // 透明叠加模式：只有墨水拖尾，无纸面/图片
  });
</script>
```

### React

```jsx
import { useEffect, useRef } from 'react';
// 把 watercolor-fluid.js 放进 public/ 用 <script> 引，或直接 import 它（有 module.exports）
import WatercolorFX from './watercolor-fluid.js';

export default function WatercolorHero({ image }) {
  const ref = useRef(null);
  useEffect(() => {
    const fx = WatercolorFX.init({ canvas: ref.current, image });
    return () => fx.destroy();
  }, [image]);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}
```

### Vue 3

```vue
<template><canvas ref="el" class="fx" /></template>
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import WatercolorFX from './watercolor-fluid.js';
const el = ref(null);
let fx;
onMounted(() => { fx = WatercolorFX.init({ canvas: el.value, image: '/painting.jpg' }); });
onBeforeUnmount(() => fx && fx.destroy());
</script>
<style scoped>.fx{position:absolute;inset:0;width:100%;height:100%}</style>
```

## API

| 方法 | 说明 |
|---|---|
| `WatercolorFX.init(options)` | 初始化，返回实例 |
| `fx.setImage(srcOrElement)` | 替换被显示的图片（URL / Image / Canvas） |
| `fx.burst(clientX, clientY)` | 在屏幕坐标处手动触发点击爆开 |
| `fx.splatAt(clientX, clientY, dx, dy)` | 手动注入一笔墨水 |
| `fx.clear()` | 清空所有墨水（画面淡回纸面） |
| `fx.pause()` / `fx.resume()` | 暂停 / 恢复 |
| `fx.destroy()` | 销毁，移除所有监听和 GL 资源 |

## 主要配置项

| 配置 | 默认 | 说明 |
|---|---|---|
| `image` | — | 被水彩晕开显示的图片 |
| `TRANSPARENT` | `false` | `true` = 仅墨水拖尾的透明叠加模式 |
| `SPLAT_RADIUS` | `0.21` | 光标笔刷大小 |
| `SPLAT_FORCE` | `5600` | 移动注入的速度力度 |
| `DENSITY_DISSIPATION` | `0.55` | 墨水消散速度（越小画面保留越久） |
| `VELOCITY_DISSIPATION` | `1.7` | 流动停止速度 |
| `CURL` | `6` | 涡旋强度（卷曲感） |
| `CLICK_SPLATS` / `CLICK_FORCE` / `CLICK_RADIUS` | `16 / 900 / 3.2` | 点击爆开的瓣数 / 力度 / 中心墨晕大小 |
| `PALETTE` | 5 色水彩色板 | 墨水颜色，随时间缓慢轮换 |
| `PAPER` | `#f4efe4` | 纸面颜色 |
| `REVEAL_LOW` / `REVEAL_HIGH` | `0.05 / 0.6` | 墨水浓度到图片显示的映射区间 |
| `EDGE_DARKEN` | `0.22` | 水彩边缘积色深度 |
| `IMAGE_DISTORT` | `1.6` | 晕开时图片的扭曲量 |
| `GRAIN` | `0.5` | 纸纹颗粒感 |
| `CUSTOM_CURSOR` | `true` | 自定义光标（触屏设备自动禁用） |
| `CURSOR_HOVER_SELECTOR` | `a, button, [data-cursor]` | 悬停时光标环放大的元素 |
| `SIM_RESOLUTION` / `DYE_RESOLUTION` | `144 / 1024` | 性能调节：低端机可降到 96 / 512 |

## 为什么之前复刻不出来

只做流体烟雾（网上常见的 fluid simulation demo）只完成了一半。原站的关键在 **显示合成 pass**：
墨水密度场不直接显示，而是同时被用作 ① 图片的 reveal 遮罩（带 fbm 噪声的毛边）
② 边缘积色带（水彩干燥后边缘更深的特征）③ 图片 UV 的扭曲源（颜料在纸上渗开的感觉）。
这些都在 `watercolor-fluid.js` 的 `DISPLAY_FRAG` shader 里，每个效果都有独立配置项可调。

## 性能说明

- 模拟在低分辨率网格（144）运行，染料 1024，主流独显/核显 60fps 无压力
- 移动端建议 `SIM_RESOLUTION: 96, DYE_RESOLUTION: 512, PRESSURE_ITERATIONS: 12`
- 页面切到后台自动暂停

## 更新：MODE 三种模式

| MODE | 效果 | 适用 |
|---|---|---|
| `'paint'`（默认） | 纸面 + 墨水晕开显示图片 | 独立体验页（davidwhyte 原版效果） |
| `'ink'` | 透明画布，仅彩色墨水拖尾 | 叠加在任意现有页面上 |
| `'reveal'` | 透明画布，光标划过处"显影"出清晰图片 | 叠加在有蒙版/模糊底图的页面上（山夏前三屏用的就是这个） |

注意：`reveal`/`paint` 模式的图片如果跨域，服务器必须返回 CORS 头（unsplash 可以，
不支持 CORS 的图床会自动降级为 `ink` 模式并在 console 提示）。本地图片用相对路径即可。
