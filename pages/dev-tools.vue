<template>
  <div class="p-6 space-y-6 max-w-2xl mx-auto">
    <div class="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-4">
      <div class="flex items-center gap-2 mb-2">
        <div class="i-carbon-warning text-yellow-600 dark:text-yellow-400 w-6 h-6"></div>
        <h1 class="text-xl font-bold text-yellow-800 dark:text-yellow-200">開發模式工具</h1>
      </div>
      <p class="text-sm text-yellow-700 dark:text-yellow-300">
        ⚠️ 僅供開發環境使用，生產環境請勿使用
      </p>
    </div>

    <!-- Current Status -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-3">
      <h2 class="font-bold text-lg">當前狀態</h2>
      
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-600 dark:text-gray-400">登入狀態：</span>
          <span :class="userStore.profile ? 'text-green-600 font-bold' : 'text-red-600'">
            {{ userStore.profile ? '✅ 已登入' : '❌ 未登入' }}
          </span>
        </div>
        
        <div v-if="userStore.profile" class="flex justify-between">
          <span class="text-gray-600 dark:text-gray-400">User ID：</span>
          <code class="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
            {{ userStore.profile.userId }}
          </code>
        </div>
        
        <div v-if="userStore.profile" class="flex justify-between">
          <span class="text-gray-600 dark:text-gray-400">顯示名稱：</span>
          <span class="font-medium">{{ userStore.profile.displayName }}</span>
        </div>
        
        <div class="flex justify-between">
          <span class="text-gray-600 dark:text-gray-400">群組 ID：</span>
          <span v-if="userStore.groupId" class="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
            {{ userStore.groupId }}
          </span>
          <span v-else class="text-gray-500">無</span>
        </div>
        
        <div class="flex justify-between">
          <span class="text-gray-600 dark:text-gray-400">管理員：</span>
          <span :class="userStore.isAdmin ? 'text-green-600 font-bold' : 'text-gray-500'">
            {{ userStore.isAdmin ? '✅ 是' : '❌ 否' }}
          </span>
        </div>
        
        <div class="flex justify-between">
          <span class="text-gray-600 dark:text-gray-400">模擬模式：</span>
          <span :class="userStore.mockMode ? 'text-blue-600 font-bold' : 'text-gray-500'">
            {{ userStore.mockMode ? '✅ 啟用' : '❌ 關閉' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Voting Status Control -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-3">
      <h2 class="font-bold text-lg flex items-center gap-2">
        <div class="i-carbon-time"></div>
        <span>投票狀態控制</span>
      </h2>
      
      <div class="grid grid-cols-3 gap-2">
         <button 
           @click="devStore.setOverrideStatus(null)" 
           class="px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
           :class="!devStore.overrideStatus ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'"
         >
           自動 (Auto)
         </button>
         <button 
           @click="devStore.setOverrideStatus('OPEN')" 
           class="px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
           :class="devStore.overrideStatus === 'OPEN' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'"
         >
           強制開啟
         </button>
         <button 
           @click="devStore.setOverrideStatus('CLOSED')" 
           class="px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
           :class="devStore.overrideStatus === 'CLOSED' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'"
         >
           強制關閉
         </button>
      </div>
      <p class="text-xs text-gray-500">
        當前狀態: <span class="font-bold">{{ devStore.overrideStatus || 'Auto' }}</span>
      </p>

      <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
         <h3 class="font-bold text-sm mb-2">自動化模擬流程</h3>
         
         <!-- Open Voting Button -->
         <button 
           @click="simulateOpenAndNotify"
           :disabled="opening"
           class="w-full mb-3 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
         >
            {{ opening ? '開啟進行中...' : '📢 強制開啟 + 機器人通知' }}
         </button>
         <p class="text-[10px] text-gray-400 mb-3">
           將會：1. 狀態設為 OPEN 2. 發送 LINE 開始投票通知
         </p>
         
         <!-- Close Voting Button -->
         <button 
           @click="simulateCloseAndSync"
           :disabled="simulating"
           class="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
         >
            {{ simulating ? '模擬進行中...' : '🚀 強制截止 + 同步結果 + 機器人通知' }}
         </button>
         <p class="text-[10px] text-gray-400 mt-1">
           將會：1. 計算前 2 名日期 2. 寫入 Admin 設定 3. 發送 LINE 通知名單
         </p>

         <!-- Manual Cron Trigger -->
         <button 
           @click="triggerSystemCron"
           :disabled="cronLoading"
           class="w-full mt-6 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-lg"
         >
            {{ cronLoading ? '系統檢查執行中...' : '⚡ 立即執行每日檢查 (Real Cron)' }}
         </button>
         <p class="text-[10px] text-orange-600/70 dark:text-orange-400/70 mt-1 font-bold">
           ⚠️ 注意：這會執行伺服器真實邏輯 (含補發通知、關閉投票)
         </p>
      </div>
    </div>

    <!-- Quick Mock Login -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
      <div class="flex justify-between items-center">
        <h2 class="font-bold text-lg">快速模擬登入</h2>
        <button @click="generateRandomUser" class="text-xs text-blue-600 hover:text-blue-700 font-medium">
           🎲 生成隨機用戶
        </button>
      </div>
      
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium mb-1">User ID</label>
          <input 
            v-model="mockUserId" 
            type="text"
            placeholder="U1234567890abcdef1234567890abcdef"
            class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm font-mono"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">顯示名稱</label>
          <input 
            v-model="mockDisplayName" 
            type="text"
            placeholder="測試用戶"
            class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">群組 ID</label>
          <input 
            v-model="mockGroupId" 
            type="text"
            placeholder="C1234567890abcdef1234567890abcdef"
            class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm font-mono"
          />
        </div>
        
        <div class="flex items-center gap-2">
          <input 
            v-model="mockIsAdmin" 
            type="checkbox"
            id="mock-admin"
            class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label for="mock-admin" class="text-sm font-medium cursor-pointer">
            設定為管理員
          </label>
        </div>
        
        <button 
          @click="applyMockLogin"
          class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          ✨ 套用模擬登入
        </button>
      </div>
    </div>


    <!-- Quick Presets -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
      <h2 class="font-bold text-lg">快速預設</h2>
      
      <div class="grid grid-cols-2 gap-3">
        <button 
          @click="loadPreset('admin')"
          class="p-3 border-2 border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
        >
          <div class="text-2xl mb-1">👑</div>
          <div class="text-sm font-medium">管理員</div>
        </button>
        
        <button 
          @click="loadPreset('user')"
          class="p-3 border-2 border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <div class="text-2xl mb-1">👤</div>
          <div class="text-sm font-medium">一般用戶</div>
        </button>
        
        <button 
          @click="loadPreset('user2')"
          class="p-3 border-2 border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
        >
          <div class="text-2xl mb-1">👥</div>
          <div class="text-sm font-medium">用戶 2</div>
        </button>
        
        <button 
          @click="clearMock"
          class="p-3 border-2 border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <div class="text-2xl mb-1">🗑️</div>
          <div class="text-sm font-medium">清除</div>
        </button>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-3">
      <h2 class="font-bold text-lg">快速操作</h2>
      
      <div class="grid grid-cols-2 gap-3">
        <nuxt-link 
          to="/"
          class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-center transition-colors"
        >
          📅 挑日子
        </nuxt-link>
        
        <nuxt-link 
          to="/admin"
          class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-center transition-colors"
        >
          ⚙️ 管理員
        </nuxt-link>
        
        <nuxt-link 
          to="/admin-setup"
          class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-center transition-colors"
        >
          👑 管理工具
        </nuxt-link>
        
        <nuxt-link 
          to="/result"
          class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-center transition-colors"
        >
          🏆 結果
        </nuxt-link>
      </div>
    </div>

    <!-- Instructions -->
    <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm space-y-2">
      <h3 class="font-bold text-blue-900 dark:text-blue-200">💡 使用說明</h3>
      <ul class="space-y-1 text-blue-800 dark:text-blue-300 list-disc list-inside">
        <li>使用「快速預設」可快速切換不同角色</li>
        <li>管理員預設會自動設定為環境變數中的管理員</li>
        <li>模擬登入後可以測試所有功能</li>
        <li>重新整理頁面後狀態會保持（除非關閉瀏覽器）</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
const userStore = useUserStore()
const devStore = useDevStore()
const config = useRuntimeConfig()

const mockUserId = ref('U1234567890abcdef1234567890abcdef')
const mockDisplayName = ref('開發測試用戶')
const mockGroupId = ref('C1234567890abcdef1234567890abcdef')
const mockIsAdmin = ref(false)

const generateRandomUser = () => {
    const randomHex = Math.random().toString(16).substring(2, 10)
    mockUserId.value = `U${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
    mockDisplayName.value = `User ${randomHex}`
    mockIsAdmin.value = false
    applyMockLogin()
}

const applyMockLogin = async () => {
  // Set mock mode
  userStore.mockMode = true
  
  // Set user profile
  const profile = {
    userId: mockUserId.value,
    displayName: mockDisplayName.value,
    pictureUrl: `https://api.iconify.design/carbon:user-avatar-filled-alt.svg?color=%23${Math.random().toString(16).slice(2, 8)}`
  }
  userStore.profile = profile
  
  // Save to Firestore so results page can see names
  try {
    const { db } = useNuxtApp().$firebase
    const { doc, setDoc } = await import('firebase/firestore')
    await setDoc(doc(db, 'users', profile.userId), {
      ...profile,
      updatedAt: Date.now()
    }, { merge: true })
  } catch (e) {
    console.warn('Mock profile save failed', e)
  }
  
  // Set group ID
  userStore.groupId = mockGroupId.value
  
  // Set admin status
  userStore.isAdmin = mockIsAdmin.value
  
  // Set authenticated
  userStore.isAuthenticated = true
  
  alert('✅ 模擬登入已套用！ (已儲存 Profile)')
}

const scheduleStore = useScheduleStore()

const simulating = ref(false)
const opening = ref(false)
const cronLoading = ref(false)

const triggerSystemCron = async () => {
    if (!confirm('確定要執行系統排程嗎？\n這會真實地檢查日期並可能關閉投票發送通知。')) return
    
    cronLoading.value = true
    try {
        const res: any = await $fetch('/api/admin/trigger-cron', { method: 'POST' })
        alert('✅ 執行成功！\n\n---- 執行報告 ----\n' + (res.summary || []).join('\n'))
    } catch (e: any) {
        console.error(e)
        alert('❌ 執行失敗: ' + e.message)
    } finally {
        cronLoading.value = false
    }
}

const simulateOpenAndNotify = async () => {
    if (!userStore.groupId) {
        alert('❌ 請先設定 Group ID (或使用模擬登入)')
        return
    }
    
    opening.value = true
    try {
        // 1. Set status to OPEN
        devStore.setOverrideStatus('OPEN')
        
        // 2. Get NEXT month for notification (Target)
        const now = new Date()
        let year = now.getFullYear()
        let month = now.getMonth() + 2 // Target Next Month
        if (month > 12) {
             month = 1
             year += 1
        }
        const monthStr = String(month).padStart(2, '0')
        
        // 3. Send LINE notification
        await $fetch('/api/bot/push', {
            method: 'POST',
            body: {
                groupId: userStore.groupId,
                eventData: {
                    openVoting: true,
                    month: `${year}/${monthStr}`,
                    messageType: 'voting_open'
                }
            }
        })
        
        alert('✅ 投票已開啟！\\n1. 狀態已設為 OPEN\\n2. 開啟通知已發送')
        
    } catch (e: any) {
        console.error(e)
        alert('❌ 開啟失敗: ' + e.message)
    } finally {
        opening.value = false
    }
}

const simulateCloseAndSync = async () => {
    if (!userStore.groupId) {
        alert('❌ 請先設定 Group ID (或使用模擬登入)')
        return
    }
    
    simulating.value = true
    try {
        // 1. Calculate Top 2 with minimum 3 participants
        const votes = scheduleStore.votes || {}
        
        const sorted = Object.entries(votes).map(([date, data]) => ({
            date,
            count: data.o_users?.length || 0,  // Use o_users.length, not countO
            participants: data.o_users || []
        }))
        .filter(d => d.count >= 3) // Filter: minimum 3 participants
        .sort((a, b) => b.count - a.count)
        
        const top2 = sorted.slice(0, 2)
        
        if (top2.length === 0) {
            alert('QQ，本月人數不夠，沒有成團')
            simulating.value = false
            return
        }
        
        console.log('[Dev Tools] Top 2 dates:', top2)
        
        // Get participant names from Firestore
        const { db } = useNuxtApp().$firebase
        const { doc, getDoc, updateDoc } = await import('firebase/firestore')
        
        const topDatesWithNames = await Promise.all(top2.map(async (d) => {
          const participantNames = await Promise.all(
            d.participants.map(async (userId: string) => {
              try {
                const userRef = doc(db, 'users', userId)
                const userSnap = await getDoc(userRef)
                return userSnap.exists() ? userSnap.data().displayName || '未知用戶' : '未知用戶'
              } catch {
                return '未知用戶'
              }
            })
          )
          return {
            date: d.date,
            count: d.count,
            participants: participantNames
          }
        }))
        
        // 2. Prepare Event Data for push notification
        const finalEventData = {
            topDates: topDatesWithNames,
            messageType: 'voting_closure'
        }
        
        // 3. Update Firestore (Admin Settings) - Keep for backwards compatibility
        const currentMonthId = scheduleStore.currentMonthId || `${userStore.groupId}_${new Date().getFullYear()}-${String(new Date().getMonth() + 2).padStart(2, '0')}`
        const scheduleRef = doc(db, 'monthlySchedules', currentMonthId)
        
        await updateDoc(scheduleRef, {
            finalEvent: {
              type: '投票結果',
              location: '尚待決定',
              description: `【模擬截止結果】\\n${topDatesWithNames.map((d, i) => `第 ${i+1} 名: ${d.date} (${d.count}人)`).join('\\n')}\\n\\n請管理員確認最終細節。`,
              timestamp: new Date(top2[0].date).getTime()
            },
            status: 'closed',
            updatedAt: Date.now()
        }).catch(async (e: any) => {
             if(e.code === 'not-found') {
                 const { setDoc } = await import('firebase/firestore')
                 await setDoc(scheduleRef, {
                     groupId: userStore.groupId,
                     month: currentMonthId.split('_')[1],
                     finalEvent: {
                       type: '投票結果',
                       location: '尚待決定',
                       description: `【模擬截止結果】\\n${topDatesWithNames.map((d, i) => `第 ${i+1} 名: ${d.date} (${d.count}人)`).join('\\n')}`,
                       timestamp: new Date(top2[0].date).getTime()
                     },
                     votes: {},
                     status: 'closed'
                 })
             } else throw e
        })
        
        // 4. Force Dev Status to CLOSED
        devStore.setOverrideStatus('CLOSED')
        
        // 5. Bot Notification
        await $fetch('/api/bot/push', {
            method: 'POST',
            body: {
                groupId: userStore.groupId,
                eventData: finalEventData
            }
        })
        
        alert('✅ 模擬完成！\n1. 狀態已設為 CLOSED\n2. 結果已寫入 Admin\n3. Bot 通知已發送')
        
    } catch (e: any) {
        console.error(e)
        alert('❌ 模擬失敗: ' + e.message)
    } finally {
        simulating.value = false
    }
}

const loadPreset = (preset: string) => {
  const adminIds = config.public.adminUserIds || ''
  const adminList = adminIds.split(',').map(id => id.trim()).filter(Boolean)
  const firstAdminId = adminList[0] || 'Uadmin1234567890abcdef1234567890'
  
  // Use real Group ID from webhook (if user has logged in via LIFF, this will be available)
  const realGroupId = userStore.groupId || 'C7a2048b1664c4234883479d5857f6b99' // Real Group ID from webhook
  
  switch (preset) {
    case 'admin':
      mockUserId.value = firstAdminId
      mockDisplayName.value = '管理員測試帳號'
      mockGroupId.value = realGroupId
      mockIsAdmin.value = true
      break
      
    case 'user':
      mockUserId.value = 'Uuser11234567890abcdef1234567890a'
      mockDisplayName.value = '一般用戶 1'
      mockGroupId.value = realGroupId
      mockIsAdmin.value = false
      break
      
    case 'user2':
      mockUserId.value = 'Uuser21234567890abcdef1234567890b'
      mockDisplayName.value = '一般用戶 2'
      mockGroupId.value = realGroupId
      mockIsAdmin.value = false
      break
  }
  
  applyMockLogin()
}

const clearMock = () => {
  userStore.mockMode = false
  userStore.profile = null
  userStore.groupId = null
  userStore.isAdmin = false
  userStore.isAuthenticated = false
  
  alert('🗑️ 模擬登入已清除！')
}
</script>
