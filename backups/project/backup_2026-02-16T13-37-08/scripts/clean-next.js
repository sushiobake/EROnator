/**
 * .next ディレクトリを削除するスクリプト
 * devサーバーが起動中で削除に失敗した場合は明確なエラーメッセージを表示
 */

const fs = require('fs');
const path = require('path');

const nextDir = path.join(process.cwd(), '.next');

function cleanNext() {
  if (!fs.existsSync(nextDir)) {
    console.log('.next directory does not exist');
    return true;
  }

  try {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log('Cleaned .next directory');
    return true;
  } catch (error) {
    if (error.code === 'EBUSY' || error.code === 'ENOTEMPTY' || error.code === 'EPERM') {
      console.error('');
      console.error('Error: Failed to delete .next directory');
      console.error('The development server may be running.');
      console.error('');
      console.error('Please:');
      console.error('  1. Stop the development server (Ctrl+C)');
      console.error('  2. Run "npm run clean" again');
      console.error('');
      process.exit(1);
    } else {
      console.error('Error cleaning .next directory:', error.message);
      process.exit(1);
    }
  }
}

cleanNext();
