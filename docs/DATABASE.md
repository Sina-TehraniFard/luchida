# データベース設計書

## 概要

このドキュメントでは、データベーススキーマとドメインモデルの詳細を定義します。

---

## ER図（Entity Relationship Diagram）

```mermaid
erDiagram
    accounts ||--o{ orders : places
    accounts ||--o{ positions : holds
    accounts ||--o{ rule_violations : records
    accounts ||--o{ trade_history : generates
    accounts ||--o{ daily_performance : tracks

    positions ||--o| trade_history : closes_to
    orders ||--o| positions : creates

    accounts {
        varchar(36) id PK
        varchar(255) oanda_account_id UK
        varchar(255) name
        decimal(15,2) balance
        varchar(3) currency
        timestamp created_at
        timestamp updated_at
    }

    orders {
        varchar(36) id PK
        varchar(36) account_id FK
        varchar(10) currency_pair
        enum side "BUY, SELL"
        enum type "MARKET, LIMIT, STOP"
        decimal(15,4) quantity
        decimal(15,5) price
        decimal(15,5) stop_loss
        decimal(15,5) take_profit
        enum status "PENDING, FILLED, CANCELLED, REJECTED"
        decimal(15,5) filled_price
        timestamp filled_at
        timestamp created_at
    }

    positions {
        varchar(36) id PK
        varchar(36) account_id FK
        varchar(10) currency_pair
        enum side "LONG, SHORT"
        decimal(15,4) quantity
        decimal(15,5) open_price
        decimal(15,5) current_price
        decimal(15,5) stop_loss
        decimal(15,5) take_profit
        decimal(15,2) unrealized_pnl
        timestamp opened_at
        timestamp closed_at
        enum status "OPEN, CLOSED"
    }

    rule_violations {
        bigint id PK
        varchar(36) account_id FK
        varchar(255) rule_name
        text violation_reason
        json attempted_order
        json context
        timestamp created_at
    }

    trade_history {
        varchar(36) id PK
        varchar(36) account_id FK
        varchar(36) position_id FK
        varchar(10) currency_pair
        enum side "LONG, SHORT"
        decimal(15,4) quantity
        decimal(15,5) open_price
        decimal(15,5) close_price
        decimal(15,2) realized_pnl
        timestamp opened_at
        timestamp closed_at
        int duration_seconds
    }

    daily_performance {
        bigint id PK
        varchar(36) account_id FK
        date date UK
        decimal(15,2) starting_balance
        decimal(15,2) ending_balance
        decimal(15,2) realized_pnl
        decimal(15,2) unrealized_pnl
        int total_trades
        int winning_trades
        int losing_trades
    }

    rule_config_history {
        bigint id PK
        json config_snapshot
        varchar(255) changed_by
        text change_reason
        timestamp applied_at
    }
```

---

## テーブル定義

### accounts（口座）

**目的**: OANDAアカウントと残高情報を管理

| カラム | 型 | NULL | キー | 説明 |
|--------|-------|------|------|------|
| id | VARCHAR(36) | NO | PK | UUID |
| oanda_account_id | VARCHAR(255) | NO | UK | OANDA Account ID |
| name | VARCHAR(255) | YES | - | アカウント名 |
| balance | DECIMAL(15,2) | YES | - | 残高 |
| currency | VARCHAR(3) | YES | - | 通貨コード（JPY, USDなど） |
| created_at | TIMESTAMP | NO | - | 作成日時 |
| updated_at | TIMESTAMP | NO | - | 更新日時 |

**インデックス**:
- PRIMARY KEY: `id`
- UNIQUE: `oanda_account_id`

---

### orders（注文）

**目的**: 全ての注文履歴を記録

| カラム | 型 | NULL | キー | 説明 |
|--------|-------|------|------|------|
| id | VARCHAR(36) | NO | PK | UUID |
| account_id | VARCHAR(36) | NO | FK | 口座ID |
| currency_pair | VARCHAR(10) | NO | - | 通貨ペア（例: USD_JPY） |
| side | ENUM | NO | - | BUY, SELL |
| type | ENUM | NO | - | MARKET, LIMIT, STOP |
| quantity | DECIMAL(15,4) | NO | - | 数量 |
| price | DECIMAL(15,5) | YES | - | 指値価格 |
| stop_loss | DECIMAL(15,5) | YES | - | 損切り価格 |
| take_profit | DECIMAL(15,5) | YES | - | 利確価格 |
| status | ENUM | NO | - | PENDING, FILLED, CANCELLED, REJECTED |
| filled_price | DECIMAL(15,5) | YES | - | 約定価格 |
| filled_at | TIMESTAMP | YES | - | 約定日時 |
| created_at | TIMESTAMP | NO | - | 注文作成日時 |

**インデックス**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `account_id` → `accounts(id)`
- INDEX: `(account_id, created_at)` - 口座ごとの注文履歴検索
- INDEX: `(status)` - ステータス別検索

---

### positions（ポジション）

**目的**: 現在保有中および過去のポジションを管理

| カラム | 型 | NULL | キー | 説明 |
|--------|-------|------|------|------|
| id | VARCHAR(36) | NO | PK | UUID |
| account_id | VARCHAR(36) | NO | FK | 口座ID |
| currency_pair | VARCHAR(10) | NO | - | 通貨ペア |
| side | ENUM | NO | - | LONG, SHORT |
| quantity | DECIMAL(15,4) | NO | - | 数量 |
| open_price | DECIMAL(15,5) | NO | - | エントリー価格 |
| current_price | DECIMAL(15,5) | NO | - | 現在価格 |
| stop_loss | DECIMAL(15,5) | YES | - | 損切り価格 |
| take_profit | DECIMAL(15,5) | YES | - | 利確価格 |
| unrealized_pnl | DECIMAL(15,2) | YES | - | 含み損益 |
| opened_at | TIMESTAMP | NO | - | オープン日時 |
| closed_at | TIMESTAMP | YES | - | クローズ日時 |
| status | ENUM | NO | - | OPEN, CLOSED |

**インデックス**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `account_id` → `accounts(id)`
- INDEX: `(account_id, status)` - 口座ごとのオープンポジション検索

---

### rule_violations（ルール違反ログ）

**目的**: 全てのルール違反を記録・分析

| カラム | 型 | NULL | キー | 説明 |
|--------|-------|------|------|------|
| id | BIGINT | NO | PK | Auto Increment |
| account_id | VARCHAR(36) | NO | FK | 口座ID |
| rule_name | VARCHAR(255) | NO | - | 違反したルール名 |
| violation_reason | TEXT | NO | - | 違反理由の詳細 |
| attempted_order | JSON | YES | - | 試みた注文の詳細 |
| context | JSON | YES | - | 違反時のコンテキスト |
| created_at | TIMESTAMP | NO | - | 記録日時 |

**context JSONの例**:
```json
{
  "accountBalance": 100000,
  "dailyPnL": -3000,
  "openPositions": 4,
  "currentLeverage": 8.5,
  "marketConditions": {
    "spread": 2.5,
    "rsi": 45
  }
}
```

**インデックス**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `account_id` → `accounts(id)`
- INDEX: `(account_id, created_at)` - 時系列検索
- INDEX: `(rule_name)` - ルール別集計

---

### trade_history（取引履歴）

**目的**: クローズされた取引の履歴を保存

| カラム | 型 | NULL | キー | 説明 |
|--------|-------|------|------|------|
| id | VARCHAR(36) | NO | PK | UUID |
| account_id | VARCHAR(36) | NO | FK | 口座ID |
| position_id | VARCHAR(36) | NO | FK | 元のポジションID |
| currency_pair | VARCHAR(10) | NO | - | 通貨ペア |
| side | ENUM | NO | - | LONG, SHORT |
| quantity | DECIMAL(15,4) | NO | - | 数量 |
| open_price | DECIMAL(15,5) | NO | - | エントリー価格 |
| close_price | DECIMAL(15,5) | NO | - | クローズ価格 |
| realized_pnl | DECIMAL(15,2) | NO | - | 確定損益 |
| opened_at | TIMESTAMP | NO | - | オープン日時 |
| closed_at | TIMESTAMP | NO | - | クローズ日時 |
| duration_seconds | INT | YES | - | 保有時間（秒） |

**インデックス**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `account_id` → `accounts(id)`
- INDEX: `(account_id, closed_at)` - 時系列検索
- INDEX: `(realized_pnl)` - 損益順ソート

---

### daily_performance（日次パフォーマンス）

**目的**: 日ごとの取引成績を集計

| カラム | 型 | NULL | キー | 説明 |
|--------|-------|------|------|------|
| id | BIGINT | NO | PK | Auto Increment |
| account_id | VARCHAR(36) | NO | FK | 口座ID |
| date | DATE | NO | UK | 日付 |
| starting_balance | DECIMAL(15,2) | YES | - | 開始残高 |
| ending_balance | DECIMAL(15,2) | YES | - | 終了残高 |
| realized_pnl | DECIMAL(15,2) | YES | - | 確定損益 |
| unrealized_pnl | DECIMAL(15,2) | YES | - | 含み損益 |
| total_trades | INT | NO | - | 取引回数 |
| winning_trades | INT | NO | - | 勝ちトレード数 |
| losing_trades | INT | NO | - | 負けトレード数 |

**インデックス**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `account_id` → `accounts(id)`
- UNIQUE: `(account_id, date)`
- INDEX: `(date)` - 日付検索

---

### rule_config_history（ルール設定履歴）

**目的**: 環境変数の変更履歴を記録

| カラム | 型 | NULL | キー | 説明 |
|--------|-------|------|------|------|
| id | BIGINT | NO | PK | Auto Increment |
| config_snapshot | JSON | NO | - | 全環境変数のスナップショット |
| changed_by | VARCHAR(255) | YES | - | 変更者 |
| change_reason | TEXT | YES | - | 変更理由 |
| applied_at | TIMESTAMP | NO | - | 適用日時 |

**config_snapshot JSONの例**:
```json
{
  "MAX_POSITION_SIZE": 10000,
  "STOP_LOSS_PIPS": 20,
  "MAX_DAILY_LOSS": 5000,
  "RSI_ENABLED": true,
  "RSI_OVERSOLD": 30,
  ...
}
```

**インデックス**:
- PRIMARY KEY: `id`
- INDEX: `(applied_at)` - 時系列検索

---

## ドメインモデル

### エンティティ

```mermaid
classDiagram
    class Account {
        -id: AccountId
        -oandaAccountId: string
        -balance: Money
        -equity: Money
        -marginUsed: Money
        -positions: Position[]
        +canOpenPosition(size: Quantity): boolean
        +getDailyPnL(): Money
        +getOpenPositionsCount(): number
        +getCurrentLeverage(): number
    }

    class Order {
        -id: OrderId
        -accountId: AccountId
        -currencyPair: CurrencyPair
        -side: OrderSide
        -quantity: Quantity
        -type: OrderType
        -price?: Price
        -stopLoss?: Price
        -takeProfit?: Price
        -status: OrderStatus
        +validate(rules: RuleEngine): ValidationResult
        +execute(): ExecutionResult
        +cancel(): void
    }

    class Position {
        -id: PositionId
        -accountId: AccountId
        -currencyPair: CurrencyPair
        -side: PositionSide
        -quantity: Quantity
        -openPrice: Price
        -currentPrice: Price
        -stopLoss?: Price
        -takeProfit?: Price
        -unrealizedPnL: Money
        +updatePrice(newPrice: Price): void
        +shouldClose(rules: RuleEngine): boolean
        +close(): ClosedPosition
        +updateStopLoss(newPrice: Price): void
        +updateTakeProfit(newPrice: Price): void
    }

    class RuleViolation {
        -id: ViolationId
        -accountId: AccountId
        -ruleName: string
        -reason: string
        -attemptedOrder: Order
        -context: ViolationContext
        -occurredAt: DateTime
    }

    Account "1" --> "*" Position
    Account "1" --> "*" Order
    Account "1" --> "*" RuleViolation
```

### 値オブジェクト（Value Objects）

```mermaid
classDiagram
    class Money {
        -amount: number
        -currency: Currency
        +add(other: Money): Money
        +subtract(other: Money): Money
        +multiply(factor: number): Money
        +isGreaterThan(other: Money): boolean
        +isLessThan(other: Money): boolean
        +equals(other: Money): boolean
    }

    class Price {
        -value: number
        -currencyPair: CurrencyPair
        +pipsTo(other: Price): number
        +add(pips: number): Price
        +subtract(pips: number): Price
    }

    class Quantity {
        -units: number
        +isWithinRange(min: Quantity, max: Quantity): boolean
        +multiply(factor: number): Quantity
    }

    class CurrencyPair {
        -base: Currency
        -quote: Currency
        +toString(): string
        +getPipValue(): number
    }

    class OrderSide {
        <<enumeration>>
        BUY
        SELL
        +opposite(): OrderSide
    }

    class PositionSide {
        <<enumeration>>
        LONG
        SHORT
        +opposite(): PositionSide
    }

    class OrderType {
        <<enumeration>>
        MARKET
        LIMIT
        STOP
    }

    class OrderStatus {
        <<enumeration>>
        PENDING
        FILLED
        CANCELLED
        REJECTED
    }
```

---

## データフロー

### 注文作成から実行までのデータフロー

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant UseCase
    participant Order as Order Entity
    participant RuleEngine
    participant OrderRepo
    participant PositionRepo
    participant OANDA
    participant MySQL

    Client->>API: POST /api/orders
    API->>UseCase: PlaceOrderUseCase.execute()

    UseCase->>Order: Order.create()
    UseCase->>RuleEngine: validate(order)

    alt Validation Success
        RuleEngine-->>UseCase: ValidationSuccess
        UseCase->>OANDA: placeOrder()
        OANDA-->>UseCase: OrderFilled

        UseCase->>OrderRepo: save(order)
        OrderRepo->>MySQL: INSERT orders
        MySQL-->>OrderRepo: Success

        UseCase->>PositionRepo: create(position)
        PositionRepo->>MySQL: INSERT positions
        MySQL-->>PositionRepo: Success

        UseCase-->>API: OrderPlacedResult
        API-->>Client: 200 OK
    else Validation Failed
        RuleEngine-->>UseCase: ValidationError
        UseCase->>OrderRepo: saveViolation()
        OrderRepo->>MySQL: INSERT rule_violations
        UseCase-->>API: ValidationError
        API-->>Client: 400 Bad Request
    end
```

### ポジションクローズのデータフロー

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant UseCase
    participant Position
    participant PositionRepo
    participant TradeRepo
    participant PerformanceRepo
    participant OANDA
    participant MySQL

    Client->>API: POST /api/positions/:id/close
    API->>UseCase: ClosePositionUseCase.execute()

    UseCase->>PositionRepo: findById(id)
    PositionRepo->>MySQL: SELECT positions
    MySQL-->>PositionRepo: Position data
    PositionRepo-->>UseCase: Position entity

    UseCase->>Position: close()
    UseCase->>OANDA: closePosition()
    OANDA-->>UseCase: PositionClosed

    UseCase->>PositionRepo: update(position)
    PositionRepo->>MySQL: UPDATE positions
    MySQL-->>PositionRepo: Success

    UseCase->>TradeRepo: createTrade(closedPosition)
    TradeRepo->>MySQL: INSERT trade_history
    MySQL-->>TradeRepo: Success

    UseCase->>PerformanceRepo: updateDailyPerformance()
    PerformanceRepo->>MySQL: UPDATE daily_performance
    MySQL-->>PerformanceRepo: Success

    UseCase-->>API: PositionClosedResult
    API-->>Client: 200 OK
```

---

## トランザクション設計

### トランザクション境界

```mermaid
graph TD
    UseCase[Use Case Layer] -->|トランザクション開始| Repo1[Repository 1]
    UseCase -->|同一トランザクション| Repo2[Repository 2]
    UseCase -->|同一トランザクション| Repo3[Repository 3]

    Repo1 --> DB[MySQL]
    Repo2 --> DB
    Repo3 --> DB

    UseCase -->|トランザクション終了| Commit[Commit/Rollback]

    style UseCase fill:#e1f5ff
```

**トランザクションスコープ**:
- **Use Case単位**: 1つのユースケース実行が1トランザクション
- **複数リポジトリ操作**: 同一トランザクション内で実行
- **外部API呼び出し**: トランザクション外で実行し、失敗時は補償トランザクション

---

## インデックス戦略

### パフォーマンス最適化のためのインデックス

```mermaid
graph LR
    Query1[口座ごとの注文検索] --> Index1[account_id, created_at]
    Query2[ステータス別注文] --> Index2[status]
    Query3[オープンポジション] --> Index3[account_id, status]
    Query4[日次パフォーマンス] --> Index4[account_id, date]
    Query5[ルール違反分析] --> Index5[rule_name]
```

---

## データ保持戦略

### アーカイブ

```mermaid
graph TD
    Active[アクティブデータ<br/>3ヶ月] -->|移動| Archive[アーカイブ<br/>1年]
    Archive -->|移動| ColdStorage[コールドストレージ<br/>永久保存]

    style Active fill:#ccffcc
    style Archive fill:#ffffcc
    style ColdStorage fill:#ccccff
```

---

## 今後の拡張

### Phase 2
- **market_data** テーブル: 価格履歴、ローソク足データ
- **indicators** テーブル: 計算済みテクニカル指標のキャッシュ

### Phase 3
- **backtest_results** テーブル: バックテスト結果
- **optimization_history** テーブル: ルール最適化履歴
