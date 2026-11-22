# AGENTS.md

## 專案名稱
**英文對話練習教學網站**（`english`）

## 專案簡介
依據 NotebookLM 筆記本「英文對話練習」（10 份來源教材）所設計的互動式英文對話學習平台，聚焦於：
- **聽力磨耳朵**（常速 ➜ 慢速 ➜ 中文循環播放）
- **3 秒直覺反應開口**（高頻 Q&A 快速反應訓練）
- **四步驟實戰情境演練**（純聽、雙語精讀、角色扮演跟讀、反向測驗）
- **道地美式口語升級**（萬用詞槽句型、教科書 vs. 美式緩衝語氣對照、隨身急救卡與 SRS 複習）

## 資料夾結構
```text
/home/admin/english/
├── AGENTS.md                           # 專案指南與同步對照表
├── .gitignore                          # Git 忽略規則
├── package.json                        # 根目錄腳本（dev / build / tts:generate / seed:firebase / deploy:pages）
├── firebase.json / .firebaserc         # Firebase 專案與 Cloud Firestore 設定（echospeak-english-studio）
├── firestore.rules / firestore.indexes.json # Firestore 安全規則與索引
├── docs/
│   └── plan-features-and-database.md   # 功能架構與資料庫規劃書（18 張表設計）
├── shared/
│   └── types.ts                        # 前後端共用 18 張表 TypeScript 型別定義
├── data/
│   └── seed-notebooklm.json            # 自 NotebookLM「英文對話練習」萃取之 4 大主題種子教材
├── scripts/
│   ├── generate-tts.mjs                # Edge TTS 批次音檔產生器（常速 / 慢速 / 中文 MP3）
│   ├── seed-firebase.mjs               # Firebase Firestore 18 張集合種子資料寫入腳本
│   └── deploy-gh-pages.mjs             # 一鍵打包前端並推送至 GitHub Pages（gh-pages 分支）
├── server/                             # Node.js + Express + Firebase Admin API 後端
└── client/                             # Vite + React + Tailwind CSS 前端網站與 public/audio/
```

## 同步對照表
| 項目 | 位置 / 狀態 |
| :--- | :--- |
| **本地路徑** | `/home/admin/english` |
| **GitHub Repo** | `https://github.com/rh6554ya-netizen/english`（Public） |
| **線上部署（GitHub Pages）** | `https://rh6554ya-netizen.github.io/english/`（`gh-pages` 分支） |
| **Firebase 專案** | `echospeak-english-studio`（Firestore `asia-east1` 台灣，18 張集合 457 筆資料，已啟用唯讀規則保護與 Firebase Auth 串接） |
| **Obsidian 工作筆記** | `英文教學網站/工作流程.md` |
| **Obsidian 規劃書** | `英文教學網站/功能與資料庫規劃.md` |
| **NotebookLM 來源筆記本** | 英文對話練習 |
