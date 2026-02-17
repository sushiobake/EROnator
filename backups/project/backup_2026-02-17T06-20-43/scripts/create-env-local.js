const fs = require('fs');
const path = require('path');

const envContent = `# データベース接続（ローカル開発用）
DATABASE_URL=file:./prisma/dev.db

# アフィリエイトID
AFFILIATE_ID=

# 管理画面アクセス制御（3重ロック）
ERONATOR_ADMIN=1
ERONATOR_ADMIN_TOKEN=your-secret-token-here

# デバッグ設定（オプション）
# ERONATOR_DEBUG=1
# ERONATOR_DEBUG_TOKEN=devtoken
# NEXT_PUBLIC_DEBUG_TOKEN=devtoken

# AI統合設定（オプション）
# ERONATOR_AI_PROVIDER=huggingface
# HUGGINGFACE_API_TOKEN=your-huggingface-token
# HUGGINGFACE_MODEL_NAME=elyza/ELYZA-japanese-Llama-2-7b-instruct
# または別のモデルを試す場合:
# HUGGINGFACE_MODEL_NAME=meta-llama/Llama-2-7b-chat-hf
# カスタムエンドポイントを指定する場合（上記のフォールバックを無効化）:
# HUGGINGFACE_API_URL=https://router.huggingface.co/models/your-model-name
`;

const envPath = path.join(process.cwd(), '.env.local');

// UTF-8（BOMなし）で保存
fs.writeFileSync(envPath, envContent, 'utf8');

console.log('✓ .env.local を作成しました（UTF-8 BOMなし）');
console.log('ファイルの場所:', envPath);
