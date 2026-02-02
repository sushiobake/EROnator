/**
 * dev サーバーを単一プロセスに固定するガード付き起動スクリプト
 * ロックファイルで二重起動を検知し、即終了＆メッセージ表示
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const lockFile = path.join(process.cwd(), '.dev-lock');
const devCommand = 'next';
const devArgs = ['dev', '-p', '3000'];

// ロックファイルの存在確認
if (fs.existsSync(lockFile)) {
  try {
    // ロックファイルに保存されているPIDを読み取り
    const lockPid = parseInt(fs.readFileSync(lockFile, 'utf-8').trim(), 10);
    
    // PIDが有効な数値かチェック
    if (!isNaN(lockPid) && lockPid > 0) {
      try {
        // プロセスが存在するかチェック（Windows対応）
        // process.kill(pid, 0) はプロセスが存在しない場合にエラーを投げる
        process.kill(lockPid, 0);
        // プロセスが存在する場合、エラーを表示
        console.error('');
        console.error('Error: Development server is already running.');
        console.error('');
        console.error('Lock file found:', lockFile);
        console.error('Process ID:', lockPid);
        console.error('');
        console.error('Please:');
        console.error('  1. Check if another dev server is running in another terminal');
        console.error('  2. If not, delete the lock file manually:');
        console.error('     Remove-Item .dev-lock  (PowerShell)');
        console.error('     del .dev-lock  (cmd)');
        console.error('  3. Then run "npm run dev" again');
        console.error('');
        process.exit(1);
      } catch (killError) {
        // プロセスが存在しない場合（ESRCHエラーまたはEPERMエラー）、ロックファイルを削除して続行
        if (killError.code === 'ESRCH' || killError.code === 'EPERM') {
          console.log('Lock file found but process is not running. Removing lock file...');
          fs.unlinkSync(lockFile);
        } else {
          // その他のエラーの場合、エラーを表示
          console.error('Error checking process:', killError.message);
          console.error('Lock file found:', lockFile);
          console.error('Please delete it manually and try again.');
          process.exit(1);
        }
      }
    } else {
      // PIDが無効な場合、ロックファイルを削除して続行
      console.log('Lock file found but contains invalid PID. Removing lock file...');
      fs.unlinkSync(lockFile);
    }
  } catch (readError) {
    // ロックファイルの読み取りに失敗した場合、削除して続行
    console.log('Lock file found but could not be read. Removing lock file...');
    try {
      fs.unlinkSync(lockFile);
    } catch (unlinkError) {
      // 削除に失敗した場合、エラーを表示
      console.error('Error: Could not remove lock file:', lockFile);
      console.error('Please delete it manually and try again.');
      process.exit(1);
    }
  }
}

// ロックファイル作成
try {
  fs.writeFileSync(lockFile, process.pid.toString(), 'utf-8');
} catch (error) {
  console.error('Error creating lock file:', error.message);
  process.exit(1);
}

// 終了時のロックファイル削除処理
function cleanup() {
  try {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  } catch (error) {
    // ロックファイル削除エラーは無視（既に削除されている可能性）
  }
}

// SIGINT (Ctrl+C) 処理
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

// SIGTERM 処理
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

// プロセス終了時の処理
process.on('exit', (code) => {
  cleanup();
});

// 未処理のエラー処理
process.on('uncaughtException', (error) => {
  cleanup();
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// .nextディレクトリをクリーンアップ（オプション、環境変数で制御）
// 環境変数 CLEAN_NEXT=true または CLEAN_NEXT=1 で有効化
const shouldCleanNext = process.env.CLEAN_NEXT === 'true' || process.env.CLEAN_NEXT === '1';
if (shouldCleanNext) {
  console.log('Cleaning .next directory...');
  try {
    const cleanScript = path.join(__dirname, 'clean-next.js');
    require(cleanScript);
  } catch (cleanError) {
    // EBUSYエラーなどは開発サーバーが起動中の場合なので、警告のみ
    if (cleanError.code === 'EBUSY' || cleanError.code === 'ENOTEMPTY' || cleanError.code === 'EPERM') {
      console.warn('Warning: Could not clean .next directory (server may be running). Continuing...');
    } else {
      console.warn('Warning: Failed to clean .next directory:', cleanError.message);
      console.warn('Continuing anyway...');
    }
  }
}

// Prisma Clientを事前に生成（ファイルロックエラー対策）
console.log('Generating Prisma Client...');
const prismaGenerate = spawn('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
  env: process.env,
});

prismaGenerate.on('exit', (code) => {
  if (code !== 0) {
    console.warn('Warning: Prisma Client generation failed. Continuing anyway...');
  }
  // Prisma Client生成後、devサーバーを起動
  startDevServer();
});

prismaGenerate.on('error', (error) => {
  console.warn('Warning: Could not run prisma generate:', error.message);
  console.warn('Continuing with dev server startup...');
  startDevServer();
});

function startDevServer() {
  // dev サーバー起動
  const devProcess = spawn(devCommand, devArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
    env: process.env,
  });

  devProcess.on('exit', (code) => {
    cleanup();
    process.exit(code || 0);
  });

  devProcess.on('error', (error) => {
    cleanup();
    console.error('Error starting dev server:', error.message);
    process.exit(1);
  });
}
