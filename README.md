<div align=center style=margin-bottom:30px>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/emjudge.svg">
  <source media="(prefers-color-scheme: light)" srcset="apps/web/public/emjudge-dark.svg">
  <img alt="EM Logo" src="https://elvismao.com/logo.svg" width="200"/>
</picture>

</div>

前端作業繳交與自動評測平台。學生上傳 HTML/CSS/JS 或 React 作業，系統在隔離的 Docker 環境中用 Playwright 執行測試，產出分數、測試結果、截圖與 log。

## 目錄

- [系統需求](#系統需求)
- [快速開始（開發環境）](#快速開始開發環境)
- [環境變數](#環境變數)
- [專案結構](#專案結構)
- [資料庫](#資料庫)
- [API 端點](#api-端點)
- [Judge Worker](#judge-worker)
- [出題與測試腳本](#出題與測試腳本)
- [前端頁面](#前端頁面)
- [正式部署](#正式部署)
- [使用流程](#使用流程)

---

## 系統需求

| 工具       | 版本                            |
| ---------- | ------------------------------- |
| Node.js    | >= 20                           |
| pnpm       | >= 10                           |
| Docker     | >= 24（建議使用 rootless mode） |
| PostgreSQL | >= 15                           |
| MinIO      | latest                          |

## 快速開始（開發環境）

### 1. 安裝依賴

```bash
pnpm install
```

### 2. 啟動 PostgreSQL 和 MinIO

```bash
docker compose up -d
```

這會啟動：

- PostgreSQL on `localhost:5432`（帳號 `postgres` / 密碼 `postgres` / 資料庫 `judge`）
- MinIO on `localhost:9000`（API）和 `localhost:9001`（管理介面，帳號 `minioadmin` / `minioadmin`）

### 3. 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env`，至少修改：

- `JWT_SECRET` — 改成一個隨機字串
- `DEFAULT_ADMIN_PASSWORD` — 預設管理員密碼

### 4. 初始化資料庫

```bash
pnpm db:migrate   # 建立資料表
pnpm db:seed      # 建立預設管理員帳號
```

Seed 完成後會印出預設帳號密碼：

```
Seed completed. Default admin: admin / <你設定的密碼>
```

### 5. 啟動開發伺服器

```bash
pnpm dev
```

這會同時啟動：

- API server on `http://localhost:3000`
- Web dev server on `http://localhost:5173`（自動 proxy `/api` 到 API server）

### 6. 啟動 Judge Worker（另開 terminal）

```bash
pnpm dev:worker
```

### 7. 建置 Judge Runner Docker 映像

```bash
docker build -t judge-runner:latest docker/judge-runner/
```

---

## 環境變數

| 變數                               | 說明                           | 預設值                                                |
| ---------------------------------- | ------------------------------ | ----------------------------------------------------- |
| `PORT`                             | API server port                | `3000`                                                |
| `HOST`                             | API server host                | `0.0.0.0`                                             |
| `DATABASE_URL`                     | PostgreSQL 連線字串            | `postgresql://postgres:postgres@localhost:5432/judge` |
| `JWT_SECRET`                       | JWT 簽名密鑰                   | `dev-secret-change-in-production`                     |
| `JWT_EXPIRES_IN`                   | JWT 過期時間                   | `7d`                                                  |
| `CORS_ORIGIN`                      | 允許的 CORS origin             | `http://localhost:5173`                               |
| `DEFAULT_ADMIN_PASSWORD`           | seed 時的管理員密碼            | `admin123`                                            |
| `MINIO_ENDPOINT`                   | MinIO host                     | `localhost`                                           |
| `MINIO_PORT`                       | MinIO port                     | `9000`                                                |
| `MINIO_ACCESS_KEY`                 | MinIO access key               | `minioadmin`                                          |
| `MINIO_SECRET_KEY`                 | MinIO secret key               | `minioadmin`                                          |
| `MINIO_USE_SSL`                    | MinIO 是否使用 SSL             | `false`                                               |
| `MINIO_PUBLIC_BASE_URL`            | MinIO 對外 base path           | `/img`                                                |
| `WORKER_ID`                        | Worker 識別名稱                | `worker-<pid>`                                        |
| `POLL_INTERVAL_MS`                 | Worker 輪詢間隔（ms）          | `3000`                                                |
| `WORK_DIR`                         | Worker 工作目錄                | `.cache/judge-work`                                   |
| `JUDGE_PNPM_STORE_DIR`             | React 評測共用 pnpm cache 目錄 | `.cache/judge-pnpm-store`                             |
| `JUDGE_PNPM_STORE_MOUNT_PATH`      | 容器內 pnpm store 掛載位置     | `/pnpm/store`                                         |
| `JUDGE_PNPM_STORE_CLEANUP_HOUR_TW` | 每日清 cache 時間（UTC+8）     | `5`                                                   |
| `DOCKER_BIN`                       | Docker 執行檔路徑              | `docker`                                              |
| `JUDGE_IMAGE`                      | Judge 容器映像名稱             | `judge-runner:latest`                                 |

---

## 專案結構

```
frontend-judge/
├── apps/
│   ├── api/                        # Fastify 後端 API
│   │   └── src/
│   │       ├── db/                 # schema.sql, migrate, seed, connection pool
│   │       ├── middleware/         # JWT 認證、角色權限 guard
│   │       ├── routes/            # 路由（auth, me, admin, classes, assignments, submissions）
│   │       ├── services/          # 商業邏輯層
│   │       ├── utils/             # MinIO client
│   │       ├── config.ts          # 環境變數（Zod 驗證）
│   │       └── index.ts           # 應用程式入口
│   ├── web/                        # React 前端
│   │   └── src/
│   │       ├── components/        # UI 元件
│   │       │   ├── ui/            # shadcn-style 基礎元件（Button, Card, Badge, Input）
│   │       │   ├── markdown-renderer.tsx
│   │       │   ├── score-chart.tsx
│   │       │   ├── file-uploader.tsx
│   │       │   └── submission-grid.tsx
│   │       ├── hooks/             # React Query hooks（use-api.ts）
│   │       ├── layouts/           # AppLayout, AuthGuard
│   │       ├── lib/               # API client, query keys, utils
│   │       ├── pages/             # 所有頁面
│   │       ├── stores/            # Auth store
│   │       └── app.tsx            # 路由定義
│   └── worker/                     # Judge worker（獨立 process）
│       └── src/
│           ├── pipelines/         # Judge pipeline（base interface + HTML/React 實作）
│           ├── config.ts
│           ├── db.ts
│           ├── minio.ts
│           └── index.ts           # 輪詢 loop
├── packages/
│   ├── shared/                     # 前後端共用的 Zod schema、型別、常數、權限
│   │   └── src/
│   │       ├── schemas/           # auth, user, class, assignment, submission, common
│   │       ├── constants.ts
│   │       ├── permissions.ts
│   │       └── index.ts
│   └── config/                     # 共用 tsconfig
├── docker/
│   └── judge-runner/Dockerfile     # Playwright + serve 映像
├── docker-compose.yml              # 開發用 PostgreSQL + MinIO
└── pnpm-workspace.yaml
```

---

## 資料庫

共 12 張資料表：

| 資料表                 | 說明                                                            |
| ---------------------- | --------------------------------------------------------------- |
| `users`                | 使用者帳號（含角色：admin / teacher / student）                 |
| `classes`              | 班級                                                            |
| `class_members`        | 班級成員（多對多）                                              |
| `assignments`          | 作業（屬於班級，類型：html-css-js / react）                     |
| `assignment_specs`     | 作業的 judge 設定（啟動指令、測試腳本、timeout、允許/禁止路徑） |
| `submissions`          | 學生繳交（狀態、分數）                                          |
| `submission_files`     | 繳交的檔案列表（路徑 + MinIO key）                              |
| `submission_runs`      | 每次評測執行（測試結果 JSONB、log）                             |
| `submission_artifacts` | 評測產物（截圖、log 檔案，存在 MinIO）                          |
| `judge_jobs`           | PostgreSQL-based job queue（狀態、重試次數、鎖定機制）          |
| `password_reset_logs`  | 密碼重置紀錄                                                    |
| `bulk_import_jobs`     | 批次匯入紀錄                                                    |

完整 SQL schema 請見 `apps/api/src/db/schema.sql`。

---

## API 端點

- Swagger UI：`/api/docs`
- OpenAPI JSON：`/api/docs/json`

### Auth

| Method | Path              | 說明           | 權限 |
| ------ | ----------------- | -------------- | ---- |
| POST   | `/api/auth/login` | 登入，取得 JWT | 公開 |

### Me（個人）

| Method | Path                      | 說明         | 權限 |
| ------ | ------------------------- | ------------ | ---- |
| GET    | `/api/me`                 | 取得個人資料 | 登入 |
| PATCH  | `/api/me/profile`         | 修改暱稱     | 登入 |
| POST   | `/api/me/change-password` | 修改密碼     | 登入 |

### Admin（管理）

| Method | Path                              | 說明                   | 權限  |
| ------ | --------------------------------- | ---------------------- | ----- |
| GET    | `/api/admin/users`                | 列出所有使用者（分頁） | admin |
| POST   | `/api/admin/users`                | 建立使用者             | admin |
| POST   | `/api/admin/users/bulk-import`    | 批次匯入使用者         | admin |
| POST   | `/api/admin/users/reset-password` | 重置使用者密碼         | admin |

### Classes（班級）

| Method | Path                             | 說明                                   | 權限                         |
| ------ | -------------------------------- | -------------------------------------- | ---------------------------- |
| GET    | `/api/classes`                   | 列出班級（staff 全部，student 自己的） | 登入                         |
| GET    | `/api/classes/:id`               | 班級詳情（含成員）                     | 登入（student 限自己的班級） |
| GET    | `/api/classes/:id/score-history` | 分數歷史（圖表用）                     | 登入                         |
| POST   | `/api/classes`                   | 建立班級                               | admin, teacher               |
| PATCH  | `/api/classes/:id`               | 更新班級                               | admin, teacher               |
| POST   | `/api/classes/:id/members`       | 新增成員                               | admin, teacher               |
| DELETE | `/api/classes/:id/members`       | 移除成員                               | admin, teacher               |

### Assignments（作業）

| Method | Path                           | 說明                | 權限           |
| ------ | ------------------------------ | ------------------- | -------------- |
| GET    | `/api/classes/:id/assignments` | 列出班級的作業      | 登入           |
| GET    | `/api/assignments/:id`         | 作業詳情（含 spec） | 登入           |
| POST   | `/api/assignments`             | 建立作業            | admin, teacher |
| PATCH  | `/api/assignments/:id`         | 更新作業            | admin, teacher |
| DELETE | `/api/assignments/:id`         | 刪除作業            | admin, teacher |

### Submissions（繳交）

| Method | Path                               | 說明                                   | 權限                     |
| ------ | ---------------------------------- | -------------------------------------- | ------------------------ |
| POST   | `/api/assignments/:id/submit`      | 上傳繳交（multipart）                  | 登入                     |
| GET    | `/api/assignments/:id/submissions` | 列出繳交（staff 全部，student 自己的） | 登入                     |
| GET    | `/api/submissions/:id`             | 繳交詳情（含檔案、評測結果）           | 登入（student 限自己的） |
| GET    | `/api/artifacts/:id/url`           | 取得 artifact 的 presigned URL         | 登入                     |

---

## Judge Worker

Worker 是獨立的 process，透過輪詢 PostgreSQL `judge_jobs` 表取得待評測工作。

### 運作流程

1. **取得工作** — 使用 `SELECT FOR UPDATE SKIP LOCKED` 原子性地鎖定一筆 pending job
2. **下載檔案** — 從 MinIO `submissions` bucket 下載學生繳交的檔案
3. **準備環境** — 寫入 Playwright 設定檔和測試腳本
4. **Docker 執行** — 在隔離容器中啟動 static server / build project，執行 Playwright 測試
5. **解析結果** — 讀取 Playwright JSON reporter 產出的結果檔
6. **上傳 artifacts** — 截圖、log 上傳到 MinIO `artifacts` bucket
7. **寫回 DB** — 更新 `submission_runs`、`submissions`、`judge_jobs` 的狀態與分數

### 重試機制

- 預設最多重試 3 次（`JUDGE_MAX_ATTEMPTS`）
- 失敗後 status 回到 `pending`，下次輪詢會再取得
- 超過重試上限後 status 變成 `dead`，submission 變成 `error`
- 啟動時會自動清理鎖定超過 5 分鐘的 stale job

### Docker 容器隔離

- HTML/CSS/JS 題：`--network=none`（完全斷網）、`--memory=512m`、`--cpus=1`
- React 題：`--network=host`（需要安裝依賴與 build）、`--memory=1g`、`--cpus=2`

---

## 出題與測試腳本

### HTML/CSS/JS 題型

學生繳交的檔案結構範例：

```
index.html
style.css
script.js
assets/
  image.png
```

系統會用 `serve` 在容器內啟動 static server，然後跑 Playwright 測試。

測試腳本範例：

```typescript
import { test, expect } from "@playwright/test";

test("頁面標題正確", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/My Page/);
});

test("有一個 nav 元素", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("nav")).toBeVisible();
});

test("按鈕點擊後顯示訊息", async ({ page }) => {
  await page.goto("/");
  await page.click("#myButton");
  await expect(page.locator("#message")).toHaveText("Hello!");
});

test("截圖", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: "artifacts/screenshot.png", fullPage: true });
});
```

每個 test case 預設 10 分，通過得分、未通過 0 分。

### React 題型

學生的 React 專案會依 assignment spec 的 `allowedPaths` / `blockedPaths` 過濾後放進評測工作目錄。

目前預設會阻擋：

- `Dockerfile`
- `*.sh`
- `node_modules/**`
- `.env`

系統會在容器內用 `pnpm install` / `pnpm run build`，並掛載 repo 內的共用 pnpm store。該 cache 會在每日 UTC+8 `05:00` 後第一次 React 評測時清空一次，然後重新累積；建議把 `.cache/` 保留在 repo 根目錄並加入 `.gitignore`。

### 在出題頁設定

在建立作業時可以設定：

| 欄位                | 說明                     |
| ------------------- | ------------------------ |
| 標題                | 作業標題                 |
| 描述                | Markdown 格式的題目描述  |
| 題型                | `html-css-js` 或 `react` |
| 截止時間            | 選填                     |
| 允許多次提交        | 預設是                   |
| Playwright 測試腳本 | 完整的 `.spec.ts` 內容   |

---

## 前端頁面

| 路由                                | 頁面                                                  | 權限           |
| ----------------------------------- | ----------------------------------------------------- | -------------- |
| `/`                                 | 首頁（平台介紹 + 登入入口）                           | 公開           |
| `/login`                            | 登入                                                  | 公開           |
| `/profile`                          | 個人設定（修改暱稱、密碼）                            | 登入           |
| `/classes`                          | 班級列表                                              | 登入           |
| `/classes/:id`                      | 班級詳情（分數折線圖 + 作業列表 + 成員）              | 登入           |
| `/assignments/:id`                  | 作業詳情（題目描述 + 上傳 + 繳交列表 list/grid 切換） | 登入           |
| `/submissions/:id`                  | 繳交詳情（檔案列表 + 評測結果 + 截圖）                | 登入           |
| `/classes/:classId/assignments/new` | 建立作業                                              | admin, teacher |
| `/admin`                            | 管理後台（使用者管理、建立帳號、批次匯入、重置密碼）  | admin          |

---

## 正式部署

### 1. 建置 shared package

```bash
pnpm --filter @judge/shared build
```

### 2. 建置前端

```bash
pnpm --filter @judge/web build
```

產出在 `apps/web/dist/`，用 nginx 或任何 static server 提供。

### 3. 建置後端

```bash
pnpm --filter @judge/api build
```

啟動：

```bash
node apps/api/dist/index.js
```

### 4. 建置 Worker

```bash
pnpm --filter @judge/worker build
```

啟動：

```bash
node apps/worker/dist/index.js
```

可以啟動多個 worker 實例（設定不同 `WORKER_ID`），PG queue 的 `SKIP LOCKED` 會自動分配工作。

### 5. Nginx 設定範例

```nginx
server {
    listen 80;
    server_name judge.example.com;

    # 前端靜態檔案
    location / {
        root /path/to/apps/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50M;
    }
}
```

### 6. 正式環境 checklist

- [ ] 設定強密碼的 `JWT_SECRET`
- [ ] 設定 `DEFAULT_ADMIN_PASSWORD` 並在 seed 後刪除或修改
- [ ] 修改 PostgreSQL 和 MinIO 的帳號密碼
- [ ] 設定 `CORS_ORIGIN` 為正式域名
- [ ] MinIO 正式環境建議啟用 SSL（`MINIO_USE_SSL=true`）
- [ ] 建置 `judge-runner:latest` Docker 映像
- [ ] 設定 Docker rootless mode
- [ ] 考慮用 systemd 或 PM2 管理 API 和 Worker process

---

## 使用流程

### 管理員

1. 用預設帳號 `admin` 登入
2. 進入「管理」頁面
3. 建立使用者（單筆或批次匯入）
   - 批次匯入格式：每行 `帳號,密碼,暱稱,角色`，例如 `student01,pass123,小明,student`
4. 建立班級
5. 將學生加入班級

### 老師

1. 登入後進入班級
2. 點「出題」建立作業
3. 填寫標題、Markdown 描述、選擇題型
4. 貼上 Playwright 測試腳本
5. 設定截止時間
6. 建立後學生即可看到作業
7. 在作業詳情頁可切換 list / grid 檢視所有學生的繳交，grid 模式會顯示截圖

### 學生

1. 登入後看到自己的班級
2. 進入班級查看作業列表和分數折線圖
3. 點進作業查看題目描述
4. 選擇檔案或整個資料夾上傳
5. 系統自動排入評測 queue
6. 評測完成後可查看分數、測試結果、log 和截圖
7. 若允許多次提交，可重新上傳改善分數
