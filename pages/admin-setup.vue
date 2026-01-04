<template>
  <div class="p-4 max-w-2xl mx-auto space-y-6">
    <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
      <h2 class="text-xl font-bold mb-2 flex items-center gap-2">
        <div class="i-carbon-user-admin text-blue-600"></div>
        管理員設定工具
      </h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        使用此工具查看你的 LINE User ID 並設定管理員
      </p>
    </div>

    <!-- Current User Info -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
      <h3 class="font-bold mb-3">📋 當前用戶資訊</h3>
      <div v-if="userStore.profile" class="space-y-2 text-sm">
        <div class="flex items-start gap-2">
          <span class="font-semibold min-w-24">User ID:</span>
          <div class="flex-1">
            <code class="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-xs break-all">
              {{ userStore.profile.userId }}
            </code>
            <button 
              @click="copyUserId" 
              class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
            >
              複製
            </button>
          </div>
        </div>
        <div class="flex gap-2">
          <span class="font-semibold min-w-24">名稱:</span>
          <span>{{ userStore.profile.displayName }}</span>
        </div>
        <div class="flex gap-2">
          <span class="font-semibold min-w-24">群組 ID:</span>
          <code v-if="userStore.groupId" class="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-xs">
            {{ userStore.groupId }}
          </code>
          <span v-else class="text-red-500">未在群組中</span>
        </div>
        <div class="flex gap-2">
          <span class="font-semibold min-w-24">管理員:</span>
          <span :class="userStore.isAdmin ? 'text-green-600 font-bold' : 'text-gray-500'">
            {{ userStore.isAdmin ? '✅ 是' : '❌ 否' }}
          </span>
          <button @click="recheckAdmin" class="text-xs bg-gray-200 px-2 py-1 rounded ml-2">重測權限</button>
        </div>
      </div>
      <div v-else class="text-gray-400">
        請先登入...
      </div>
    </div>

    <!-- Admin IDs from Env -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
      <h3 class="font-bold mb-3">🔑 環境變數中的管理員</h3>
      <div v-if="envAdminIds.length > 0" class="space-y-2">
        <div 
          v-for="(id, index) in envAdminIds" 
          :key="index"
          class="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs break-all font-mono"
        >
          {{ id }}
          <span v-if="userStore.profile?.userId === id" class="ml-2 text-green-600 font-bold">
            (你)
          </span>
        </div>
      </div>
      <div v-else class="text-yellow-600">
        ⚠️ 尚未設定環境變數中的管理員
      </div>
    </div>

    <!-- Group Admins from Firestore -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
      <h3 class="font-bold mb-3">👥 Firestore 中的群組管理員</h3>
      <div v-if="loading" class="text-gray-400">載入中...</div>
      <div v-else-if="!userStore.groupId" class="text-yellow-600">
        ⚠️ 需要在 LINE 群組中才能查看
      </div>
      <div v-else-if="groupAdminIds.length > 0" class="space-y-2">
        <div 
          v-for="(id, index) in groupAdminIds" 
          :key="index"
          class="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs break-all font-mono flex items-center justify-between"
        >
          <span>
            {{ id }}
            <span v-if="userStore.profile?.userId === id" class="ml-2 text-green-600 font-bold">
              (你)
            </span>
          </span>
        </div>
      </div>
      <div v-else class="text-gray-400">
        此群組尚未設定管理員
      </div>

      <button 
        v-if="userStore.groupId && !loading"
        @click="refreshGroupAdmins"
        class="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded w-full"
      >
        🔄 重新載入
      </button>
    </div>

    <!-- Instructions -->
    <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
      <h3 class="font-bold mb-2 flex items-center gap-2">
        <div class="i-carbon-information text-yellow-600"></div>
        設定步驟
      </h3>
      <ol class="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
        <li>複製上方的 User ID</li>
        <li>在專案的 <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">.env</code> 文件中設定：
          <pre class="bg-gray-800 text-gray-100 p-2 rounded mt-1 text-xs overflow-x-auto">NUXT_PUBLIC_ADMIN_USER_IDS=你的User ID</pre>
        </li>
        <li>重啟開發伺服器：<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">npm run dev</code></li>
        <li>重新載入此頁面，檢查管理員狀態</li>
      </ol>
    </div>

    <!-- Quick Links -->
    <div class="flex gap-3">
      <nuxt-link 
        to="/" 
        class="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-center rounded"
      >
        返回首頁
      </nuxt-link>
      <nuxt-link 
        v-if="userStore.isAdmin"
        to="/admin" 
        class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-center rounded"
      >
        前往管理頁面
      </nuxt-link>
    </div>
  </div>
</template>

<script setup lang="ts">
const userStore = useUserStore()
const config = useRuntimeConfig()

const loading = ref(false)
const groupAdminIds = ref<string[]>([])

const envAdminIds = computed(() => {
  const adminIds = config.public.adminUserIds || ''
  return adminIds.split(',').map(id => id.trim()).filter(Boolean)
})

const copyUserId = () => {
  if (userStore.profile?.userId) {
    navigator.clipboard.writeText(userStore.profile.userId)
    alert('User ID 已複製到剪貼簿！')
  }
}

const fetchGroupAdmins = async () => {
  if (!userStore.groupId) return
  
  loading.value = true
  try {
    const response = await $fetch<{ adminIds: string[] }>(
      `/api/admin/manage?groupId=${userStore.groupId}`,
      { method: 'GET' }
    )
    groupAdminIds.value = response.adminIds || []
  } catch (error) {
    console.error('Failed to fetch group admins:', error)
    groupAdminIds.value = []
  } finally {
    loading.value = false
  }
}

const recheckAdmin = async () => {
  if (!userStore.profile) return
  await userStore.checkAndInitializeAdmin()
  
  // Also force manual check here to verify logic
  const adminIds = config.public.adminUserIds || ''
  const envList = adminIds.split(',').map(id => id.trim()).filter(Boolean)
  const isEnvAdmin = envList.includes(userStore.profile.userId)
  
  alert(`重測結果:\nUser Store Admin: ${userStore.isAdmin}\nEnv Check Should Be: ${isEnvAdmin}\nEnv List: ${JSON.stringify(envList)}`)
}

const refreshGroupAdmins = () => {
  fetchGroupAdmins()
}

onMounted(() => {
  fetchGroupAdmins()
})
</script>
