# EchoSpeak AI Proxy（Cloudflare Worker × Groq）

本 Worker 為 EchoSpeak Phase 2 的安全 AI 閘道層，負責：
1. 以純 Web Crypto API 驗證前端夾帶的 **Firebase Auth ID Token（RS256）**。
2. 以 **Cloudflare KV（`QUOTA_KV`）** 控管每位學員的每日免費額度（一般學員 30 次/日、管理員 300 次/日）。
3. 伺服器端使用加密保存的 `GROQ_API_KEY` 呼叫 **Groq Whisper Large V3 Turbo（極速語音辨識）** 與 **Llama 3.3 70B Versatile（角色扮演、美式自然度改寫、發音連音教練）**。

---

## 快速部署步驟（約 3 分鐘）

### 1. 安裝相依套件並登入 Cloudflare
```bash
npm --prefix worker install
npx --prefix worker wrangler login
```

### 2. 建立每日額度用的 KV Namespace
```bash
npx --prefix worker wrangler kv namespace create QUOTA_KV
```
複製輸出的 `id`，取消註解並貼到 `worker/wrangler.toml` 的 `[[kv_namespaces]]` 區塊：
```toml
[[kv_namespaces]]
binding = "QUOTA_KV"
id = "貼上剛剛產生的 KV ID"
```

### 3. 設定 Groq API Key Secret（加密儲存，不進 Git）
於 [Groq Console](https://console.groq.com/keys) 取得 API Key 後執行：
```bash
npx --prefix worker wrangler secret put GROQ_API_KEY
```

### 4. 部署 Worker 上線
```bash
npm run deploy:worker
```
部署完成後會取得公開網址，例如：
`https://echospeak-ai.<your-subdomain>.workers.dev`

可先測試健康檢查端點：
```bash
curl https://echospeak-ai.<your-subdomain>.workers.dev/api/ai/health
```

### 5. 同步部署前端 GitHub Pages
```bash
# 帶入 Worker 網址重新建置並部署 GitHub Pages
VITE_AI_API_BASE=https://echospeak-ai.<your-subdomain>.workers.dev npm run deploy:pages
```

---

## 本機開發測試
```bash
cp worker/.dev.vars.example worker/.dev.vars
# 編輯 worker/.dev.vars 填入 GROQ_API_KEY
npm run dev:worker
```
Worker 啟動於 `http://localhost:8787`，前端可直接於「AI 口說實戰 ➜ Proxy 設定」貼上 `http://localhost:8787` 測試。
