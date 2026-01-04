# Firebase Service Account 設定說明

## 🔍 什麼是 Service Account？

Firebase Admin SDK 需要 Service Account 來在**伺服器端**執行 Firebase 操作，例如：
- 驗證 LINE ID Token
- 創建自訂 Firebase Auth Token
- 管理 Firestore 資料（伺服器端）

---

## ⚠️ 目前狀態

你的應用目前使用 **預設認證 (Default Credentials)**，這在開發環境可能會有限制。

日誌顯示：
```
[Firebase Admin] No service account provided, using default credentials
```

---

## 🚀 如何取得 Service Account

### 步驟 1：前往 Firebase Console

1. 打開 [Firebase Console](https://console.firebase.google.com/)
2. 選擇你的專案：`pick-52c90`

### 步驟 2：生成 Service Account Key

1. 左側選單 → **⚙️ 專案設定 (Project Settings)**
2. 選擇 **服務帳戶 (Service Accounts)** 分頁
3. 點擊 **產生新的私密金鑰 (Generate New Private Key)**
4. 確認並下載 JSON 檔案

**重要**：這個 JSON 檔案包含敏感資訊，請妥善保管！

### 步驟 3：設定環境變數

#### 方法 1：使用整個 JSON（開發環境）

打開下載的 JSON 檔案，複製**整個內容**（壓縮成一行），然後設定到 `.env`：

```env
NUXT_FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"pick-52c90","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-...@pick-52c90.iam.gserviceaccount.com","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

**注意**：
- 整個 JSON 必須在**同一行**
- 不要有換行符號
- 保留所有引號和轉義字元

#### 方法 2：使用檔案路徑（生產環境推薦）

或者，你可以修改 `server/utils/firebase.ts` 來讀取檔案：

```typescript
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ...

if (!apps.length) {
  try {
    const serviceAccountPath = resolve(process.cwd(), 'service-account.json')
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
    
    initializeApp({
      credential: cert(serviceAccount)
    })
  } catch (e) {
    // Fallback...
  }
}
```

但記得將 `service-account.json` 加入 `.gitignore`！

---

## 🔒 安全性最佳實踐

### ✅ 必做事項

1. **絕對不要提交 Service Account 到 Git**
   - 已在 `.gitignore` 中排除 `.env`
   - 如果使用 JSON 檔案，也要加入 `.gitignore`

2. **使用環境變數**
   - 開發環境：`.env` 檔案
   - 生產環境：部署平台的環境變數設定

3. **定期輪換金鑰**
   - 至少每 90 天輪換一次
   - 如果金鑰外洩，立即刪除並重新生成

### ⚠️ 注意事項

- Service Account 擁有**完整的 Firebase 專案權限**
- 外洩可能導致資料被竊取或刪除
- 只在伺服器端使用，**永遠不要暴露在前端**

---

## 🌐 生產環境部署

### Vercel
1. 前往專案設定 → Environment Variables
2. 添加 `NUXT_FIREBASE_SERVICE_ACCOUNT`
3. 貼上壓縮成一行的 JSON
4. 選擇環境：Production, Preview, Development

### Netlify
1. 前往 Site Settings → Environment Variables
2. 添加 `NUXT_FIREBASE_SERVICE_ACCOUNT`
3. 貼上壓縮成一行的 JSON

### 其他平台
參考平台文檔設定環境變數。

---

## 🐛 疑難排解

### 錯誤：Failed to parse service account JSON

**原因**：JSON 格式錯誤或包含換行

**解決方案**：
1. 確保 JSON 在同一行
2. 使用線上工具壓縮 JSON（移除空白和換行）
3. 檢查是否有遺漏的引號或逗號

### 錯誤：Permission denied

**原因**：Service Account 權限不足

**解決方案**：
1. 前往 Firebase Console → IAM & Admin
2. 確認 Service Account 有 **Firebase Admin** 角色
3. 或者使用 Firebase Console 重新生成金鑰

### 使用預設認證的限制

如果不設定 Service Account，部分功能可能無法正常運作：
- ✅ 讀取公開資料：正常
- ⚠️ 驗證用戶：可能失敗
- ❌ 創建自訂 Token：會失敗
- ⚠️ 寫入資料：可能失敗

---

## 📝 JSON 格式範例

完整的 Service Account JSON 看起來像這樣（記得壓縮成一行）：

```json
{
  "type": "service_account",
  "project_id": "pick-52c90",
  "private_key_id": "1234567890abcdef...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@pick-52c90.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

壓縮成一行後：
```
{"type":"service_account","project_id":"pick-52c90",...}
```

---

## ✅ 檢查清單

設定完成後，檢查以下項目：

- [ ] Service Account JSON 已下載
- [ ] JSON 已壓縮成一行（無換行）
- [ ] 已設定到 `.env` 的 `NUXT_FIREBASE_SERVICE_ACCOUNT`
- [ ] `.env` 檔案在 `.gitignore` 中
- [ ] 重啟開發伺服器
- [ ] 檢查日誌：應顯示 `[Firebase Admin] Initialized with service account`
- [ ] 測試登入功能

---

## 📚 相關資源

- [Firebase Admin SDK 文檔](https://firebase.google.com/docs/admin/setup)
- [Service Account 最佳實踐](https://cloud.google.com/iam/docs/best-practices-for-securing-service-accounts)
- [Nuxt Runtime Config](https://nuxt.com/docs/guide/going-further/runtime-config)

---

需要協助？請查看主要文檔或聯繫開發團隊。
