# Luchida - ルール駆動型FX半自動取引システム

FXで大勝ちしたいという煩悩によって突如構想を捻り始めたプロジェクト。良い子は見ないでね。

## コンセプト

**「人間の感情を排除し、設定したルール以外の操作を完全にブロックする」**

自分で決めたトレーディングルールを機械的に守らせることで、感情的な判断による損失を防ぐ半自動取引システムです。

### 主な特徴

- **DB駆動ルール管理**: Web UIでルールを管理、リアルタイム反映
- **ルールスナップショット**: 本気で運用するルールを記録し、成績を測定・比較
- **完全ブロック**: ルール違反の操作は絶対に実行させない
- **視覚的比較**: 複数のルールセットの成績をチャートで比較
- **学習重視**: モダンなアーキテクチャ（DDD + レイヤードアーキテクチャ）で実装

---

## 技術スタック

### 開発方針

このプロジェクトは**AIペアプログラミング（Claude等）を前提**としています。そのため、以下の基準で技術を選定しています：

1. **情報量が最大**: Stack Overflow、GitHub、公式ドキュメントが充実
2. **枯れた技術**: 実績があり、安定している
3. **AI生成コードの品質**: AIがコードを生成しやすく、バグが少ない

### 採用技術

| カテゴリ | 技術 | 理由 |
|---------|------|------|
| **Backend** | Node.js + Express + TypeScript | 最も情報が多く、FX bot事例が豊富 |
| **Frontend** | React + TypeScript + Tailwind CSS | 情報量No.1、Tailwind固定で自前CSS禁止 |
| **UI Components** | shadcn/ui | Tailwind対応、最近人気、カスタマイズ性高い |
| **Charts** | Recharts | React用で情報量最多、ルール比較の可視化に最適 |
| **Database** | MySQL 8.x | 情報が豊富、JSON型対応 |
| **ORM** | Prisma | TypeScript親和性が高い、マイグレーション管理が楽 |
| **FX API** | OANDA v20 REST API | ドキュメント充実、Practice環境あり |

---

## アーキテクチャ

**レイヤードアーキテクチャ + DDD (Domain-Driven Design)**

```
Presentation Layer    → Controllers, REST API, WebSocket
Application Layer     → Use Cases, ビジネスフロー
Domain Layer          → Entities, Value Objects, ルールエンジン
Infrastructure Layer  → DB, OANDA API, 環境変数管理
```

詳細は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照してください。

---

## ルール管理システム

### 2つのモード

**ドラフトモード（日常的な調整）**
- Web UIでルールを自由に変更
- リアルタイムで反映（再起動不要）
- 微調整のための試行錯誤

**スナップショットモード（恒久記録）**
- 「このルールで本気で運用する」と決めたルールを記録
- 一意のバージョンで管理
- このルールでの全取引を紐づけて記録
- 後で複数のルールセットを視覚的に比較

### ルール比較・可視化

- バーチャート: 勝率、平均利益、最大ドローダウンなど
- 時系列グラフ: 累積損益の推移
- レーダーチャート: 総合評価の比較
- 詳細テーブル: 全指標の数値比較

詳細は [docs/RULE_MANAGEMENT.md](./docs/RULE_MANAGEMENT.md) を参照してください。

---

## ドキュメント

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 詳細なアーキテクチャ設計
- [docs/RULE_MANAGEMENT.md](./docs/RULE_MANAGEMENT.md) - ルール管理システム詳細設計
- [docs/RULES.md](./docs/RULES.md) - ルールエンジン詳細仕様
- [docs/DATABASE.md](./docs/DATABASE.md) - データベース設計
- [docs/DIRECTORY_STRUCTURE.md](./docs/DIRECTORY_STRUCTURE.md) - ディレクトリ構造設計

---

## セットアップ・開発手順

**※ 現在設計段階です。実装はこれからです。**

---

## 開発フェーズ

### Phase 1: MVP（最小機能）
- [ ] 環境構築・基盤整備
- [ ] ドメインモデル実装
- [ ] ルールエンジン実装
- [ ] OANDA API連携
- [ ] 基本UI実装

### Phase 2: 機能拡張
- [ ] 詳細分析機能
- [ ] パフォーマンスレポート

### Phase 3: 高度化
- [ ] バックテスト機能
- [ ] ルール最適化機能

---

## ライセンス

MIT License
