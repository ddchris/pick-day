# Firebase 環境變數設置說明

## 📝 已完成的設置

### 1. 環境變數文件
- ✅ `.env` - 包含實際的 Firebase 配置值（已加入 .gitignore，不會被提交到 Git）
- ✅ `.env.example` - 範本文件，可以提交到 Git 供其他開發者參考

### 2. Nuxt 配置
- ✅ `nuxt.config.ts` - 已設置 `runtimeConfig` 來讀取環境變數
- ✅ `plugins/firebase.client.ts` - 使用環境變數初始化 Firebase

## 🔑 環境變數對應

Nuxt 會自動將環境變數映射到 `runtimeConfig`：

| 環境變數 | Runtime Config |
|---------|---------------|
| `NUXT_PUBLIC_FIREBASE_API_KEY` | `config.public.firebaseApiKey` |
| `NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `config.public.firebaseAuthDomain` |
| `NUXT_PUBLIC_FIREBASE_PROJECT_ID` | `config.public.firebaseProjectId` |
| `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `config.public.firebaseStorageBucket` |
| `NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `config.public.firebaseMessagingSenderId` |
| `NUXT_PUBLIC_FIREBASE_APP_ID` | `config.public.firebaseAppId` |
| `NUXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `config.public.firebaseMeasurementId` |
| `NUXT_PUBLIC_LIFF_ID` | `config.public.liffId` |
| `NUXT_FIREBASE_SERVICE_ACCOUNT` | `config.firebaseServiceAccount` |

## 🚀 使用方式

### 開發環境
環境變數會自動從 `.env` 文件載入：
```bash
npm run dev
```

### 生產環境
需要在部署平台（如 Vercel、Netlify 等）設置環境變數：
1. 前往部署平台的環境變數設置頁面
2. 複製 `.env` 中的變數名稱和值
3. 逐一添加到平台中

## 📌 注意事項

1. **不要提交 `.env`** - 此文件包含敏感信息，已經在 `.gitignore` 中
2. **使用 `.env.example`** - 與團隊分享配置範本
3. **Public vs Private** - 
   - `NUXT_PUBLIC_*` - 前端可訪問
   - `NUXT_*` - 僅伺服器端可訪問

## 🔧 更新 LIFF ID

別忘了更新 `.env` 中的 `NUXT_PUBLIC_LIFF_ID`：
```env
NUXT_PUBLIC_LIFF_ID=your-actual-liff-id
```

## 📚 參考資源
- [Nuxt Runtime Config](https://nuxt.com/docs/guide/going-further/runtime-config)
- [Firebase Console](https://console.firebase.google.com/)
- [LINE Developers](https://developers.line.biz/)
