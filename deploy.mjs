/* deploy.mjs — 构建 + 部署到 Cloudflare Pages */
import { execSync } from 'node:child_process';

console.log('=== 构建 app.js ===');
execSync('node build.mjs', { stdio: 'inherit' });

console.log('\n=== 部署到 Cloudflare Pages ===');
execSync('npx wrangler pages deploy . --project-name shanxia-website --commit-dirty=true', { stdio: 'inherit' });

console.log('\n✅ 部署完成');
