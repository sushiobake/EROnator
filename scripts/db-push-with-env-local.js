/**
 * .env と .env.local を読み込んでから prisma db push を実行する。
 * アプリ（npm run dev）と同じ DATABASE_URL でスキーマを同期し、
 * SessionWeightsSnapshot 等の不足テーブルを追加する。
 */
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });
require('dotenv').config({ path: path.join(root, '.env.local'), override: true });

console.log('DATABASE_URL (from .env + .env.local):', process.env.DATABASE_URL ? 'set' : 'not set');
execSync('npx prisma db push', { stdio: 'inherit', cwd: root, env: process.env });
