# 管理員設定指南 👨‍💼

本專案支援兩種設定管理員的方式：環境變數設定和 API 手動管理。

## 📋 目錄
1. [如何取得 LINE User ID](#如何取得-line-user-id)
2. [方式 1：透過環境變數設定（推薦）](#方式-1透過環境變數設定推薦)
3. [方式 2：透過 Firestore 手動設定](#方式-2透過-firestore-手動設定)
4. [方式 3：透過 API 管理](#方式-3透過-api-管理)
5. [檢查管理員權限](#檢查管理員權限)

---

## 🔍 如何取得 LINE User ID

### 方法 1：從 LIFF 應用取得（最簡單）
1. 在應用中打開瀏覽器開發者工具（F12）
2. 登入後，在 Console 輸入：
   ```javascript
   console.log(liff.getProfile())
   ```
3. 查看輸出的 `userId` 欄位，格式類似：`U1234567890abcdef1234567890abcdef`

### 方法 2：添加臨時日誌
在 `stores/user.ts` 的 `initLiff()` 函數中，臨時添加：
```typescript
const profile = await liff.getProfile()
console.log('My LINE User ID:', profile.userId) // 👈 添加這行
```

---

## 🌟 方式 1：透過環境變數設定（推薦）

這是最簡單且安全的方式，適合初始設定。

### 步驟 1：編輯 `.env` 文件

打開 `.env` 文件，找到這一行：
```env
NUXT_PUBLIC_ADMIN_USER_IDS=your-line-user-id-1,your-line-user-id-2
```

替換成你實際的 LINE User ID（可以設定多個，用逗號分隔）：
```env
NUXT_PUBLIC_ADMIN_USER_IDS=U1234567890abcdef1234567890abcdef,Uabcdef1234567890abcdef1234567890
```

### 步驟 2：重啟開發伺服器

修改 `.env` 後需要重啟：
```bash
# 按 Ctrl+C 停止伺服器
npm run dev
```

### 步驟 3：初始化群組（首次設定）

當第一次在某個 LINE 群組中使用時，需要初始化該群組的管理員設定。

你可以在應用中調用：
```javascript
// 在瀏覽器 Console 執行
await $fetch('/api/admin/init-group', {
  method: 'POST',
  body: { groupId: 'YOUR_GROUP_ID' }
})
```

或者，自動初始化可以在用戶登入時進行（見下方自動初始化）。

---

## 🗄️ 方式 2：透過 Firestore 手動設定

直接在 Firebase Console 中管理管理員。

### 步驟 1：前往 Firestore

1. 打開 [Firebase Console](https://console.firebase.google.com/)
2. 選擇你的專案 `pick-52c90`
3. 左側選單 → Firestore Database

### 步驟 2：創建或編輯群組文件

1. 找到或創建 `groups` collection
2. 創建一個文件，文件 ID 為你的 `groupId`（LINE 群組 ID）
3. 添加 `adminIds` 欄位，類型為 `array`
4. 在陣列中添加 LINE User ID（字串格式）

範例結構：
```
groups (collection)
  └── C1234567890abcdef... (document, groupId)
      ├── adminIds: ["U1234567890abcdef...", "Uabcdef1234567890..."]
      ├── createdAt: 1234567890
      └── updatedAt: 1234567890
```

---

## 🔧 方式 3：透過 API 管理

使用 API 動態添加或移除管理員。

### 取得群組管理員列表

```javascript
const response = await $fetch('/api/admin/manage?groupId=YOUR_GROUP_ID', {
  method: 'GET'
})
console.log(response.adminIds)
```

### 添加管理員

```javascript
await $fetch('/api/admin/manage?groupId=YOUR_GROUP_ID', {
  method: 'POST',
  body: {
    userId: 'U1234567890abcdef...',
    action: 'add'
  }
})
```

### 移除管理員

```javascript
await $fetch('/api/admin/manage?groupId=YOUR_GROUP_ID', {
  method: 'POST',
  body: {
    userId: 'U1234567890abcdef...',
    action: 'remove'
  }
})
```

---

## ✅ 檢查管理員權限

### 在前端檢查（簡易版）

使用環境變數快速檢查：
```typescript
import { isUserAdmin } from '~/utils/admin'

const userStore = useUserStore()
const isAdmin = isUserAdmin(userStore.profile?.userId || '')
```

### 在前端檢查（完整版）

從 Firestore 檢查群組特定的管理員：
```typescript
import { checkGroupAdmin } from '~/utils/admin'

const userStore = useUserStore()
const isAdmin = await checkGroupAdmin(
  userStore.groupId || '',
  userStore.profile?.userId || ''
)
```

---

## 🚀 自動初始化（建議添加）

為了讓新群組自動使用環境變數中的管理員，可以在 `stores/user.ts` 中添加自動初始化邏輯：

在 `initLiff()` 函數的最後添加：
```typescript
// 在 initLiff() 的最後，Firebase 登入成功後
if (this.groupId && this.isAuthenticated) {
  // 嘗試初始化群組（如果已存在則不會重複創建）
  try {
    await $fetch('/api/admin/init-group', {
      method: 'POST',
      body: { groupId: this.groupId }
    })
  } catch (error) {
    console.log('Group already initialized or init failed:', error)
  }
}
```

---

## 📝 注意事項

1. **LINE User ID 格式**：
   - 必須是完整的 User ID，通常以 `U` 開頭
   - 長度：33 個字元
   - 範例：`U1234567890abcdef1234567890abcdef`

2. **環境變數更新**：
   - 修改 `.env` 後必須重啟開發伺服器
   - 部署到生產環境時，記得在平台設定環境變數

3. **安全性**：
   - `NUXT_PUBLIC_*` 開頭的環境變數會暴露在前端
   - 敏感操作應該在伺服器端進行額外驗證

4. **群組 ID**：
   - LINE 群組 ID 從 `liff.getContext()` 取得
   - 格式類似：`C1234567890abcdef...`

---

## 🐛 疑難排解

### 為什麼我看不到管理員頁面？

1. 檢查 `.env` 中的 `NUXT_PUBLIC_ADMIN_USER_IDS` 是否設定正確
2. 檢查 Firestore 中 `groups/{groupId}/adminIds` 是否包含你的 User ID
3. 確認是在 LINE 群組環境中（不是 1對1 聊天）
4. 檢查瀏覽器 Console 是否有錯誤訊息

### 環境變數沒有生效？

1. 確認 `.env` 文件在專案根目錄
2. 確認變數名稱正確（必須以 `NUXT_` 開頭）
3. 重啟開發伺服器
4. 清除瀏覽器快取並重新載入

### 如何在生產環境設定？

在你的部署平台（Vercel / Netlify / 等）：
1. 前往環境變數設定頁面
2. 添加 `NUXT_PUBLIC_ADMIN_USER_IDS`
3. 值為你的 LINE User ID（多個用逗號分隔）
4. 重新部署應用

---

## 📚 相關檔案

- `utils/admin.ts` - 管理員工具函數
- `server/api/admin/manage.ts` - 管理員管理 API
- `server/api/admin/init-group.post.ts` - 群組初始化 API
- `pages/admin.vue` - 管理員頁面
- `stores/user.ts` - 用戶狀態管理

---

需要更多幫助？請查看專案文件或聯繫開發團隊。
