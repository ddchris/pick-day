# 📋 管理員設定快速開始

## 🎯 最簡單的設定方式（3 步驟）

### 步驟 1：取得你的 LINE User ID

訪問這個頁面來查看你的 User ID：
```
http://localhost:3000/admin-setup
```

或者在瀏覽器 Console 輸入：
```javascript
console.log('My User ID:', liff.getProfile())
```

### 步驟 2：設定環境變數

編輯 `.env` 文件，找到這一行：
```env
NUXT_PUBLIC_ADMIN_USER_IDS=your-line-user-id-1,your-line-user-id-2
```

替換成你的實際 User ID（多個用逗號分隔）：
```env
NUXT_PUBLIC_ADMIN_USER_IDS=U1234567890abcdef1234567890abcdef
```

### 步驟 3：重啟伺服器

```bash
# 停止當前伺服器 (Ctrl+C)
npm run dev
```

完成！🎉 現在你可以訪問管理員頁面了。

---

## 📍 相關頁面

- `/` - 首頁（投票頁面）
- `/admin` - 管理員頁面（設定活動）
- `/admin-setup` - 管理員設定工具（查看 User ID）
- `/result` - 結果頁面
- `/about` - 關於頁面

---

## 📚 詳細文檔

更多設定方式和疑難排解，請參考：
- [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md) - 完整管理員設定指南
- [FIREBASE_ENV_SETUP.md](./FIREBASE_ENV_SETUP.md) - Firebase 環境變數設定

---

## 🔧 已創建的檔案

### 工具函數
- `utils/admin.ts` - 管理員檢查工具

### API 端點
- `server/api/admin/manage.ts` - 管理員管理 API
- `server/api/admin/init-group.post.ts` - 群組初始化 API

### 頁面
- `pages/admin-setup.vue` - 管理員設定輔助頁面

### 設定
- `.env` - 環境變數（含管理員 User IDs）
- `nuxt.config.ts` - 已添加 `adminUserIds` 配置

---

## ✨ 功能特性

1. **自動初始化**：首次登入時自動初始化群組管理員
2. **多重檢查**：支援環境變數和 Firestore 兩種方式
3. **即時更新**：透過 API 動態管理管理員
4. **視覺化工具**：`/admin-setup` 頁面可視化管理員狀態

---

需要幫助？查看 [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md) 📖
