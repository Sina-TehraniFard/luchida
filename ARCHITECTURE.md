# アーキテクチャ設計書

## プロジェクト概要

**目的**: FX取引において設定したルール以外の操作を完全にブロックする半自動取引システム

**コンセプト**: DB駆動のルールエンジンにより、人間の感情的な判断を排除し、機械的にルールを遵守させる

---

## 技術スタック選定

### バックエンド
- **Runtime**: Node.js 20.x LTS
- **Framework**: Express 4.x
- **Language**: TypeScript 5.x
- **ORM**: Prisma 5.x
- **Validation**: Zod

**選定理由**:
- 最も情報量が多く、枯れた技術スタック
- AIペアプログラミング前提で、コード生成の品質が高い
- FX取引bot実装事例が豊富
- 非同期処理に強く、リアルタイム価格取得に適している

### フロントエンド
- **Library**: React 18.x
- **Language**: TypeScript 5.x
- **Build Tool**: Vite
- **State Management**: Zustand（軽量でシンプル）
- **CSS**: Tailwind CSS（固定、自前CSS禁止）
- **UI Components**: shadcn/ui（Tailwind対応、最近人気）
- **Charts**: Recharts（ルール比較の視覚化用）

**選定理由**:
- React は情報量No.1のフロントエンドライブラリ
- Tailwind CSSでスタイル管理を統一、AI生成との相性も良い
- shadcn/ui は情報量急増中、カスタマイズ性高い
- Recharts はReact用で最も情報が多く、ルール比較の可視化に最適

### データベース
- **RDBMS**: MySQL 8.x
- **Migration**: Prisma Migrate

**選定理由**:
- 情報量が非常に多い
- JSON型サポートで柔軟なデータ設計が可能
- トランザクション処理が堅牢

### 外部API
- **FX API**: OANDA v20 REST API

---

## システムアーキテクチャ全体像

```mermaid
graph TB
    subgraph "Frontend (React + TypeScript + Tailwind)"
        UI[Web UI]
        Dashboard[ダッシュボード]
        OrderForm[注文フォーム]
        RuleManagement[ルール管理画面]
        RuleComparison[ルール比較・分析]
    end

    subgraph "Backend (Node.js + Express + TypeScript)"
        API[REST API Server]
        WS[WebSocket Server]
        RuleEngine[ルールエンジン<br/>DB駆動・リアルタイム反映]

        subgraph "Application Layer"
            UseCases[Use Cases]
        end

        subgraph "Domain Layer"
            Entities[エンティティ]
            DomainServices[ドメインサービス]
            Rules[ルール定義]
        end

        subgraph "Infrastructure Layer"
            Repositories[リポジトリ実装]
            OandaClient[OANDA API Client]
            Config[設定管理]
        end
    end

    subgraph "External Systems"
        OANDA[OANDA API]
    end

    subgraph "Data Store"
        MySQL[(MySQL<br/>ルール設定・履歴・取引データ)]
    end

    UI --> API
    UI --> WS
    API --> UseCases
    UseCases --> RuleEngine
    UseCases --> DomainServices
    RuleEngine --> Rules
    RuleEngine --> Repositories
    DomainServices --> Entities
    UseCases --> Repositories
    Repositories --> MySQL
    OandaClient --> OANDA
```

---

## レイヤードアーキテクチャ + DDD

```mermaid
graph TD
    subgraph PresentationLayer["Presentation Layer"]
        Controllers["Controllers<br/>HTTP Request/Response"]
        DTOs["DTOs<br/>Data Transfer Objects"]
        Middleware["Middleware<br/>バリデーション"]
    end

    subgraph ApplicationLayer["Application Layer"]
        UseCases["Use Cases<br/>ビジネスフロー"]
        AppServices["Application Services<br/>トランザクション管理"]
    end

    subgraph DomainLayer["Domain Layer - 核心的ビジネスロジック"]
        Entities["Entities<br/>Account, Order, Position"]
        ValueObjects["Value Objects<br/>Money, Price, Quantity"]
        DomainServices["Domain Services<br/>RuleEngine, PositionManager"]
        RepoInterfaces["Repository Interfaces<br/>抽象化"]
        DomainEvents["Domain Events<br/>OrderPlaced, PositionClosed"]
    end

    subgraph InfrastructureLayer["Infrastructure Layer"]
        RepoImpl["Repository 実装<br/>Prisma + MySQL"]
        ExternalAPI["External API Client<br/>OANDA"]
        Config["Config Management<br/>DB設定読み込み"]
    end

    OANDA["OANDA API"]
    Database[("MySQL Database")]

    Controllers --> UseCases
    UseCases --> DomainServices
    UseCases --> Entities
    DomainServices --> Entities
    DomainServices --> ValueObjects
    UseCases --> RepoInterfaces
    RepoInterfaces -.実装.-> RepoImpl
    ExternalAPI --> OANDA
    RepoImpl --> Database
    Config --> Database

```

### 各レイヤーの責務

| レイヤー | 責務 | 外部依存 |
|---------|------|---------|
| **Presentation** | HTTP通信、リクエスト/レスポンス変換 | Express, DTOs |
| **Application** | ユースケース実装、複数ドメインサービスの組み合わせ | Domain Layer |
| **Domain** | **純粋なビジネスロジック**、ルール定義 | **なし** |
| **Infrastructure** | DB接続、外部API通信、環境変数読み込み | Prisma, OANDA SDK |

---

## DB駆動ルールエンジン

### 設計思想

```mermaid
graph LR
    DB[("MySQL<br/>rule_config")] --> Config["Config Loader"]
    Config --> RuleEngine["Rule Engine<br/>リアルタイム反映"]

    subgraph "ルールカテゴリ"
        RiskRules["リスク管理ルール"]
        TimingRules["タイミングルール"]
        EntryRules["エントリー条件ルール"]
    end

    RuleEngine --> RiskRules
    RuleEngine --> TimingRules
    RuleEngine --> EntryRules

    Order["注文リクエスト"] --> RuleEngine
    RuleEngine -->|全てパス| Approve["承認"]
    RuleEngine -->|1つでも違反| Reject["拒否"]

    UI["Web UI<br/>ルール管理画面"] --> API["PUT /api/rules/config"]
    API --> DB
    API --> RuleEngine

    style Reject fill:#ffcccc
    style Approve fill:#ccffcc
```

### ルール管理の2つのモード

**ドラフトモード（日常的な調整）**
- Web UIでルールを自由に変更
- リアルタイムで反映（システム再起動不要）
- 変更履歴は記録されるが、成績とは紐づけない

**スナップショットモード（恒久記録）**
- 本気で運用するルールセットを「コミット」
- 一意のバージョンで管理
- このルールでの全取引を記録
- 後で複数ルールセットの成績を視覚的に比較

### ルールカテゴリ

#### 1. リスク管理ルール
ポジションサイズ制限、損切り・利確設定、日次損失制限、レバレッジ制限

#### 2. 取引タイミングルール
取引可能時間帯、取引可能曜日、経済指標前後の取引制限

#### 3. エントリー条件ルール
テクニカル指標の閾値（RSI, MA, BBなど）、トレンド判定条件

#### 4. 通貨ペア・スプレッド制限
取引可能通貨ペア、最大許容スプレッド

**詳細**: [docs/RULE_MANAGEMENT.md](./docs/RULE_MANAGEMENT.md) を参照

---

## ドメインモデル設計

### エンティティ関係図

```mermaid
erDiagram
    ACCOUNT ||--o{ POSITION : has
    ACCOUNT ||--o{ ORDER : places
    ORDER ||--o| POSITION : creates
    POSITION ||--|| CLOSED_POSITION : becomes
    ACCOUNT ||--o{ TRADE_HISTORY : has
    ACCOUNT ||--o{ RULE_VIOLATION : records

    ACCOUNT {
        AccountId id
        Money balance
        Money equity
        Money marginUsed
    }

    ORDER {
        OrderId id
        CurrencyPair currencyPair
        OrderSide side
        Quantity quantity
        Price price
        OrderStatus status
    }

    POSITION {
        PositionId id
        CurrencyPair currencyPair
        PositionSide side
        Quantity quantity
        Price openPrice
        Money unrealizedPnL
    }

    RULE_VIOLATION {
        string ruleName
        string reason
        timestamp occurredAt
    }
```

### ドメインサービス関係図

```mermaid
graph TB
    subgraph "Domain Services"
        RuleEngine[Rule Engine<br/>ルール検証の中枢]
        OrderValidator[Order Validator<br/>注文妥当性検証]
        PositionManager[Position Manager<br/>ポジション管理]
        RiskCalculator[Risk Calculator<br/>リスク計算]
        TechnicalAnalyzer[Technical Analyzer<br/>テクニカル分析]
    end

    subgraph "Entities"
        Account[Account]
        Order[Order]
        Position[Position]
    end

    subgraph "Value Objects"
        Money[Money]
        Price[Price]
        Quantity[Quantity]
        CurrencyPair[Currency Pair]
    end

    Order --> OrderValidator
    OrderValidator --> RuleEngine
    RuleEngine --> RiskCalculator
    RuleEngine --> TechnicalAnalyzer

    RiskCalculator --> Account
    RiskCalculator --> Position

    PositionManager --> Position

    Account --> Money
    Order --> Price
    Order --> Quantity
    Order --> CurrencyPair
    Position --> Price
    Position --> Money
```

---

## データフロー

### 注文実行フロー

```mermaid
sequenceDiagram
    actor User
    participant UI as Web UI
    participant API as REST API
    participant UseCase as Place Order Use Case
    participant RuleEngine as Rule Engine
    participant Domain as Domain Services
    participant Repo as Repository
    participant OANDA as OANDA API
    participant DB as MySQL

    User->>UI: 注文を入力
    UI->>API: POST /api/orders
    API->>UseCase: execute(orderDTO)

    UseCase->>Domain: Order.create()
    UseCase->>RuleEngine: validateOrder(order)

    RuleEngine->>RuleEngine: checkPositionSize()
    RuleEngine->>RuleEngine: checkDailyLoss()
    RuleEngine->>RuleEngine: checkTradingHours()
    RuleEngine->>RuleEngine: checkTechnicalIndicators()

    alt ルール違反
        RuleEngine-->>UseCase: ValidationError
        UseCase-->>API: OrderRejected
        API-->>UI: 400 Bad Request
        UI-->>User: エラー表示
        UseCase->>DB: ルール違反ログ保存
    else ルール適合
        RuleEngine-->>UseCase: ValidationSuccess
        UseCase->>OANDA: placeOrder()
        OANDA-->>UseCase: OrderFilled
        UseCase->>Repo: saveOrder()
        Repo->>DB: INSERT order
        UseCase->>Repo: createPosition()
        Repo->>DB: INSERT position
        UseCase-->>API: OrderPlaced
        API-->>UI: 200 OK
        UI-->>User: 注文成功
    end
```

### リアルタイム価格更新フロー

```mermaid
sequenceDiagram
    participant OANDA as OANDA Streaming API
    participant WS as WebSocket Server
    participant PositionMgr as Position Manager
    participant RuleEngine as Rule Engine
    participant DB as MySQL
    participant Client as Web UI

    loop 価格ストリーミング
        OANDA->>WS: Price Update
        WS->>PositionMgr: updatePrices(newPrices)

        PositionMgr->>PositionMgr: recalculatePnL()
        PositionMgr->>RuleEngine: checkStopLoss()
        PositionMgr->>RuleEngine: checkTakeProfit()

        alt 損切り/利確条件達成
            RuleEngine->>PositionMgr: shouldClose(position)
            PositionMgr->>OANDA: closePosition()
            OANDA-->>PositionMgr: PositionClosed
            PositionMgr->>DB: saveClosedPosition()
        end

        WS->>Client: pushUpdate(positions)
    end
```

---

## データベース設計概要

### テーブル構成

```mermaid
erDiagram
    accounts ||--o{ orders : places
    accounts ||--o{ positions : holds
    accounts ||--o{ rule_violations : records
    accounts ||--o{ trade_history : has
    accounts ||--o{ daily_performance : tracks
    positions ||--o| trade_history : closes_to

    rule_config ||--o{ rule_snapshots : creates
    rule_snapshots ||--o{ trade_history : measures
    rule_snapshots ||--|| rule_performance : has

    accounts {
        varchar id PK
        varchar oanda_account_id UK
        decimal balance
        varchar currency
        timestamp created_at
        timestamp updated_at
    }

    orders {
        varchar id PK
        varchar account_id FK
        varchar currency_pair
        enum side
        decimal quantity
        decimal price
        enum status
        timestamp created_at
    }

    positions {
        varchar id PK
        varchar account_id FK
        varchar currency_pair
        enum side
        decimal open_price
        decimal current_price
        decimal unrealized_pnl
        enum status
        timestamp opened_at
    }

    rule_config {
        bigint id PK
        json config_data
        timestamp updated_at
    }

    rule_snapshots {
        varchar id PK
        varchar name
        text description
        json config_snapshot
        boolean is_active
        timestamp created_at
    }

    rule_performance {
        bigint id PK
        varchar rule_snapshot_id FK
        int total_trades
        decimal win_rate
        decimal total_pnl
        decimal max_drawdown
        timestamp calculated_at
    }

    rule_violations {
        bigint id PK
        varchar account_id FK
        varchar rule_name
        text reason
        json context
        timestamp created_at
    }

    trade_history {
        varchar id PK
        varchar account_id FK
        varchar position_id FK
        varchar rule_snapshot_id FK
        decimal realized_pnl
        timestamp opened_at
        timestamp closed_at
    }

    daily_performance {
        bigint id PK
        varchar account_id FK
        date date UK
        decimal realized_pnl
        int total_trades
        decimal win_rate
    }

    rule_change_history {
        bigint id PK
        json before_config
        json after_config
        json diff
        timestamp changed_at
    }
```

---

## API設計概要

### REST API エンドポイント構成

```mermaid
graph TB
    subgraph "アカウント"
        Account["/api/account"]
    end

    subgraph "取引"
        Orders["/api/orders/*"]
        Positions["/api/positions/*"]
    end

    subgraph "ルール管理"
        RulesConfig["/api/rules/config"]
        RulesSnapshots["/api/rules/snapshots"]
        RulesCompare["/api/rules/compare"]
        RulesValidate["/api/rules/validate"]
        RulesViolations["/api/rules/violations"]
    end

    subgraph "市場データ"
        MarketPrices["/api/market/prices"]
        MarketCandles["/api/market/candles"]
        MarketIndicators["/api/market/indicators"]
    end

    subgraph "分析"
        Analytics["/api/analytics/*"]
    end

    Client["Web Client"] --> Account
    Client --> Orders
    Client --> Positions
    Client --> RulesConfig
    Client --> RulesSnapshots
    Client --> RulesCompare
    Client --> RulesValidate
    Client --> RulesViolations
    Client --> MarketPrices
    Client --> Analytics
```

### WebSocket 接続

```mermaid
graph LR
    Client["Web Client"]

    subgraph "WebSocket Endpoints"
        WSPrices["/ws/prices/:pair"]
        WSPositions["/ws/positions"]
        WSAccount["/ws/account"]
    end

    Client -.リアルタイム価格.-> WSPrices
    Client -.ポジション更新.-> WSPositions
    Client -.口座状況更新.-> WSAccount
```

---

## セキュリティ・運用設計

### 前提条件

- **使用者**: 個人（1名）のみ
- **稼働環境**: ローカル環境
- **認証**: 不要（自分しかアクセスしない）

---

### セキュリティ対策

#### 1. OANDA APIキーの管理

**最重要**: APIキーは絶対に公開しない

```mermaid
graph TB
    EnvFile[".env ファイル"] -->|読み込み| App["Application"]
    GitIgnore[".gitignore"] -->|除外| EnvFile

    App --> OANDA["OANDA API"]

    Note1["⚠️ .env をgitに含めない"]
    Note2["⚠️ Practice APIで十分テスト"]
    Note3["⚠️ APIキーは定期的に再発行"]

    style EnvFile fill:#ffe6e6
    style GitIgnore fill:#ccffcc
```

**環境変数の設定例**:
```bash
# .env (gitignoreで除外)
OANDA_API_KEY=your_practice_api_key_here
OANDA_ACCOUNT_ID=your_account_id_here
OANDA_API_URL=https://api-fxpractice.oanda.com

# 本番環境では以下に変更
# OANDA_API_URL=https://api-fxtrade.oanda.com
```

---

#### 2. ローカル環境のセキュリティ

**ローカル稼働時**:
- ユーザー認証不要（自分しかアクセスしない）
- `localhost` のみでリッスン
- ファイアウォール設定不要

**処理フロー**:
```mermaid
graph LR
    Browser["ブラウザ<br/>localhost:3000"] --> Backend["Backend<br/>localhost:3000"]
    Backend --> MySQL["MySQL<br/>localhost:3306"]
    Backend --> OANDA["OANDA API"]

    style Browser fill:#e1f5ff
    style Backend fill:#e1f5ff
    style MySQL fill:#e1f5ff
```

---

### 運用上の重要な注意点

#### 1. Practice APIで徹底的にテスト

```mermaid
graph LR
    Dev["開発"] --> Test["Practice APIでテスト"]
    Test --> Review["ルール検証"]
    Review --> Decision{十分にテストした?}

    Decision -->|No| Test
    Decision -->|Yes| Live["Live APIに移行"]

    style Test fill:#ccffcc
    style Live fill:#ffe6e6
```

**最低限のテスト期間**:
- ルール調整: 1週間以上
- 本格運用前: 1ヶ月以上推奨

---

#### 2. データバックアップ

**バックアップ戦略**:
```bash
# 日次自動バックアップ（cron）
0 3 * * * mysqldump -u user -p luchida > /backup/luchida_$(date +\%Y\%m\%d).sql
```

**保持期間**:
- 日次バックアップ: 30日間
- 月次バックアップ: 1年間

---

#### 3. ログ管理

**ログレベル**:
- **Development**: `debug` - 全ての詳細ログ
- **Production**: `info` - 重要なイベントのみ

**記録すべきイベント**:
- 全ての注文実行（成功・失敗）
- ルール違反
- OANDA API エラー
- システムエラー

**ログローテーション**:
```bash
# ログファイルが10MBを超えたらローテーション
# 最大10ファイルまで保持
```

---

#### 4. モニタリング

**監視項目**:
```mermaid
graph TD
    Monitor["監視"] --> Health["ヘルスチェック<br/>/health"]
    Monitor --> Balance["口座残高<br/>急激な変動"]
    Monitor --> Rules["ルール違反<br/>頻発していないか"]
    Monitor --> API["OANDA API<br/>接続エラー"]

    Health -->|異常| Alert["アラート通知"]
    Balance -->|異常| Alert
    Rules -->|異常| Alert
    API -->|異常| Alert

    style Alert fill:#ffcccc
```

**アラート通知方法**（将来的に実装）:
- Slackへの通知
- メール通知
- Discordへの通知

---

### セキュリティチェックリスト

- [ ] `.env` ファイルを `.gitignore` に追加
- [ ] OANDA APIキーは Practice API で開始
- [ ] データベースのバックアップ設定
- [ ] Practice APIで最低1週間テスト
- [ ] 定期バックアップの自動化（cronで設定）
- [ ] ログローテーション設定

---

## 開発フェーズ

### Phase 1: MVP（最小機能）
- 環境構築・基盤整備
- ドメインモデル実装
- ルールエンジン実装（DB駆動）
- OANDA API連携
- 基本UI実装（ルール管理、注文、ポジション管理）

### Phase 2: 機能拡張
- ルールスナップショット機能
- ルール比較・可視化（Recharts）
- 詳細分析機能
- パフォーマンスレポート

### Phase 3: 高度化（将来）
- バックテスト機能
- ルール最適化機能
- 機械学習によるルール提案

---

## ディレクトリ構造（概要）

```
luchida/
├── backend/
│   ├── src/
│   │   ├── presentation/        # Controllers, DTOs, Middleware
│   │   ├── application/         # Use Cases, Application Services
│   │   ├── domain/              # Entities, Value Objects, Domain Services
│   │   ├── infrastructure/      # Repositories, External API, Config
│   │   └── shared/              # 共通ユーティリティ
│   ├── prisma/                  # DB Schema, Migrations
│   ├── tests/                   # テストコード
│   └── .env                     # 環境変数（gitignore）
├── frontend/
│   ├── src/
│   │   ├── components/          # Reactコンポーネント
│   │   ├── pages/               # ページコンポーネント
│   │   ├── services/            # API通信
│   │   ├── stores/              # 状態管理
│   │   └── utils/               # ユーティリティ
│   └── public/
├── docs/
│   ├── ARCHITECTURE.md          # 本ドキュメント
│   ├── API.md                   # API仕様書
│   └── RULES.md                 # ルール詳細仕様
├── .env.example                 # 環境変数テンプレート
└── README.md
```

---

## 参考資料・学習リソース

- [OANDA v20 API Documentation](https://developer.oanda.com/rest-live-v20/introduction/)
- [Domain-Driven Design](https://www.domainlanguage.com/ddd/)
- [Layered Architecture Pattern](https://martinfowler.com/bliki/PresentationDomainDataLayering.html)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
