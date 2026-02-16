/**
 * clean → build → start を逐次実行するスクリプト
 * PowerShell 5でも確実に動作する（shell依存なし）
 */

const { execSync } = require('child_process');
const path = require('path');

const cleanScript = path.join(__dirname, 'clean-next.js');
const buildCommand = 'npm run build';
const startCommand = 'npm start';

try {
  console.log('Cleaning .next directory...');
  require(cleanScript);
  
  console.log('Building...');
  execSync(buildCommand, { stdio: 'inherit' });
  
  console.log('Starting production server...');
  execSync(startCommand, { stdio: 'inherit' });
} catch (error) {
  if (error.status !== undefined) {
    // execSync の exit code
    process.exit(error.status);
  } else {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
