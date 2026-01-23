/**
 * 本番環境へのデプロイスクリプト
 * ローカルで開発・テストした後、このスクリプトを実行すると本番環境に反映されます
 * 
 * 使い方:
 *   npm run deploy:prod
 * 
 * 注意:
 *   - このスクリプトは develop ブランチの変更を main ブランチにマージします
 *   - 本番環境（https://eronator.vercel.app）に変更が反映されます
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🚀 本番環境へのデプロイを開始します...\n');

  // 現在のブランチを確認
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  console.log(`現在のブランチ: ${currentBranch}\n`);

  // developブランチにいることを確認
  if (currentBranch !== 'develop') {
    console.log('⚠️  警告: developブランチにいません。');
    const answer = await question('developブランチに切り替えますか？ (y/n): ');
    if (answer.toLowerCase() === 'y') {
      console.log('developブランチに切り替え中...');
      execSync('git checkout develop', { stdio: 'inherit' });
    } else {
      console.log('❌ デプロイをキャンセルしました。');
      rl.close();
      process.exit(1);
    }
  }

  // 未コミットの変更があるか確認
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (status.trim()) {
      console.log('⚠️  未コミットの変更があります:');
      console.log(status);
      const answer = await question('\n変更をコミットしますか？ (y/n): ');
      if (answer.toLowerCase() === 'y') {
        const message = await question('コミットメッセージを入力してください: ');
        execSync(`git add .`, { stdio: 'inherit' });
        execSync(`git commit -m "${message}"`, { stdio: 'inherit' });
        execSync('git push origin develop', { stdio: 'inherit' });
      } else {
        console.log('❌ デプロイをキャンセルしました。');
        rl.close();
        process.exit(1);
      }
    }
  } catch (error) {
    // エラーは無視（git statusが失敗することは通常ない）
  }

  // developブランチの最新を取得
  console.log('\n📥 developブランチの最新を取得中...');
  execSync('git pull origin develop', { stdio: 'inherit' });

  // 最終確認
  console.log('\n⚠️  最終確認:');
  console.log('この操作により、本番環境（https://eronator.vercel.app）に変更が反映されます。');
  const confirm = await question('本当に本番環境にデプロイしますか？ (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ デプロイをキャンセルしました。');
    rl.close();
    process.exit(0);
  }

  // mainブランチに切り替え
  console.log('\n📦 mainブランチに切り替え中...');
  execSync('git checkout main', { stdio: 'inherit' });

  // mainブランチの最新を取得
  console.log('📥 mainブランチの最新を取得中...');
  execSync('git pull origin main', { stdio: 'inherit' });

  // developブランチをマージ
  console.log('🔄 developブランチをマージ中...');
  execSync('git merge develop', { stdio: 'inherit' });

  // mainブランチにプッシュ
  console.log('🚀 本番環境にデプロイ中...');
  execSync('git push origin main', { stdio: 'inherit' });

  // developブランチに戻る
  console.log('↩️  developブランチに戻ります...');
  execSync('git checkout develop', { stdio: 'inherit' });

  console.log('\n✅ デプロイが完了しました！');
  console.log('本番環境: https://eronator.vercel.app');
  console.log('Vercelでデプロイの進行状況を確認できます。\n');

  rl.close();
}

main().catch(error => {
  console.error('❌ エラーが発生しました:', error);
  rl.close();
  process.exit(1);
});
