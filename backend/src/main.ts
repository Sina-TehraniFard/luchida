import dotenv from 'dotenv';

// 環境変数を最初に読み込む
dotenv.config();

console.log('🚀 Luchida Backend - Starting...');
console.log(`📝 Environment: ${process.env.NODE_ENV}`);
console.log(`🔌 Port: ${process.env.PORT}`);
console.log('✅ Environment loaded successfully');

// TODO: Expressサーバーの初期化はここに追加予定
