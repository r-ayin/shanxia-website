/* 构建脚本：app.jsx → app.js（离线 JSX 编译 + 压缩，浏览器零 Babel） */
import { transform } from './node_modules/esbuild/lib/main.js';
import { readFile, writeFile } from 'node:fs/promises';

const src = await readFile(new URL('./app.jsx', import.meta.url), 'utf8');
const out = await transform(src, {
  loader: 'jsx',
  jsx: 'transform',            // 经典运行时：React.createElement（页面用 UMD 全局 React）
  target: 'es2018',
  minify: true,
  charset: 'utf8'
});
await writeFile(new URL('./app.js', import.meta.url), out.code);
console.log('app.js built:', (out.code.length / 1024).toFixed(1) + ' KB');
