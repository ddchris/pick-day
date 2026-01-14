<template>
  <div class="p-4 space-y-6 pb-24">
     <h2 class="text-xl font-bold flex items-center justify-between">
       <div class="flex items-center gap-2">
           <div class="i-carbon-settings text-gray-700 dark:text-gray-300"></div>
           <span>活動設定 (管理員)</span>
       </div>
       <div v-if="userStore.groupId && isIdValid" class="px-3 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-[10px] font-mono rounded-full border border-teal-200 dark:border-teal-800">
           ID: {{ userStore.groupId }}
       </div>
     </h2>

    <div v-if="loading" class="text-center text-gray-400 py-10 flex flex-col items-center gap-2">
       <div class="i-carbon-circle-dash w-8 h-8 animate-spin text-teal-600"></div>
       <span>載入投票資料中...</span>
    </div>

    <div v-else-if="!isAdmin" class="text-center text-red-500 py-10 bg-red-50 dark:bg-red-900/10 rounded-lg">
       <div class="i-carbon-warning-alt text-4xl mb-2 mx-auto"></div>
       您沒有權限存取此頁面
    </div>

    <div v-else class="space-y-6">
       <!-- Global Admin / No Group Warning -->
       <div v-if="!userStore.groupId" class="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 p-4 rounded-lg flex items-start gap-3">
          <div class="i-carbon-warning-filled text-xl mt-0.5"></div>
          <div>
            <p class="font-bold">未偵測到群組資訊</p>
            <p class="text-xs mt-1">您是系統管理員，但目前未從 LINE 群組開啟此頁面。您無法對特定群組進行設定或發送通知。</p>
          </div>
       </div>

       <!-- Invalid ID Warning -->
       <div v-else-if="!isIdValid" class="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-4 rounded-lg flex items-start gap-3 border border-red-200 dark:border-red-800">
          <div class="i-carbon-error-filled text-xl mt-0.5"></div>
          <div>
            <p class="font-bold">偵測到異常的 ID 格式</p>
            <p class="text-xs mt-1">
                目前的群組 ID ({{ userStore.groupId }}) 不符合 LINE 標準格式。<br>
                這通常發生在 Context 遺失或使用了錯誤的連結。請確保您是從群組聊天室點開連結。
            </p>
          </div>
       </div>

       <!-- Debug Info (Temporary for troubleshooting) -->
       <div class="px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs font-mono text-gray-500 mb-4 overflow-x-auto">
           <details>
               <summary class="cursor-pointer hover:text-teal-600 font-bold mb-1 select-none">
                   🐞 除錯資訊 (點擊展開): {{ userStore.groupId || 'Null' }}
               </summary>
               <div class="space-y-2 p-2 bg-gray-100 dark:bg-black/20 rounded border border-gray-200 dark:border-gray-700">
                   <p>Group ID: {{ userStore.groupId }}</p>
                   <p>ID 格式是否正確: <span :class="isIdValid ? 'text-green-500' : 'text-red-500'">{{ isIdValid ? '正確' : '錯誤 (UUID 36字元或 C/R 33字元)' }}</span></p>
                   <p>Context Type: {{ userStore.debugInfo?.type || 'None' }}</p>
                   <p>Raw Context: <pre class="text-[10px]">{{ JSON.stringify(userStore.debugInfo?.rawContext, null, 2) }}</pre></p>
                   <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                       <p class="font-bold text-gray-500">🔍 URL Debug (Detailed):</p>
                       <p class="text-[10px] break-all mb-1">Full: {{ currentUrl }}</p>
                       <p class="text-[10px] break-all mb-1">Search/Hash: {{ urlSnippet }}</p>
                       <p class="break-all text-blue-500">Route Query Keys: {{ Object.keys(userStore.debugInfo?.routeQuery || {}).join(', ') }}</p>
                   </div>

                   <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                       <p class="font-bold text-gray-500 mb-1">📜 Execution Log:</p>
                       <div class="h-32 overflow-y-auto bg-black text-green-400 p-2 rounded text-[10px] font-mono leading-tight">
                           <div v-for="(log, i) in userStore.logs" :key="i">{{ log }}</div>
                       </div>
                   </div>
                   
                   <!-- REMOVED: Group Mapping Tool (Obsolete) -->
               </div>
           </details>
       </div>

       <!-- Status Banner -->
       <div class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
           <div>
               <div class="text-xs text-gray-500">目前狀態</div>
               <div class="font-bold text-lg" :class="status === 'open' ? 'text-teal-600' : 'text-gray-700 dark:text-gray-300'">
                   {{ status === 'open' ? '投票進行中' : (status === 'closed' ? '投票已結束' : '已公佈') }}
               </div>
           </div>
           <div v-if="status === 'open'" class="text-xs text-gray-400 max-w-[50%] text-right">
               投票結束後，此頁面將顯示獲選日期供您設定詳細資訊。
           </div>
       </div>

       <!-- Vote Schedule Settings -->
       <div class="p-5 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
          <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-bold">
                  <div class="i-carbon-time text-xl"></div>
                  <span>自動排程設定</span>
              </div>
              <button @click="saveGroupSettings" :disabled="savingSettings || !isIdValid"
                  class="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  <div v-if="savingSettings" class="i-carbon-circle-dash animate-spin"></div>
                  {{ savingSettings ? '儲存中' : '儲存設定' }}
              </button>
          </div>
            <!-- Auto Schedule -->
            <div class="grid grid-cols-2 gap-4">
                <div>
                   <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">每月自動開啟日期</label>
                   <input type="number" v-model.number="groupSettings.autoVoteStartDay" placeholder="e.g. 25" min="1" max="28"
                       class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                   />
                   <p class="text-[10px] text-gray-400 mt-1">設定當月幾號開始投票</p>
                </div>
                <div>
                   <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">每月自動截止日期</label>
                   <input type="number" v-model.number="groupSettings.autoVoteEndDay" placeholder="e.g. 5" min="1" max="28"
                       class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                   />
                   <p class="text-[10px] text-gray-400 mt-1">設定當月幾號結束投票</p>
                </div>
            </div>
       </div>

       <!-- No Activity State (Only when closed) -->
       <div v-if="status !== 'open' && winningDates.length === 0" class="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
           <div class="text-6xl mb-4 opacity-50">🍃</div>
           <h3 class="text-xl font-bold text-gray-600 dark:text-gray-300">本月沒有活動</h3>
           <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm text-center max-w-xs">
               沒有任何日期超過 3 人投票，<br>或是尚未開始投票。
           </p>
       </div>

       <!-- Winning Dates Configuration -->
       <div v-if="status !== 'open' && winningDates.length > 0" class="space-y-8">
           <div class="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-bold px-1">
               <div class="i-carbon-trophy-filled text-xl"></div>
               <span>獲選日期設定 ({{ winningDates.length }})</span>
           </div>

           <div v-for="(date, idx) in winningDates" :key="date.dateStr" 
               class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden relative transition-all hover:shadow-md"
               :class="{'ring-2 ring-teal-500 dark:ring-teal-600': forms[date.dateStr]?.active}"
           >
               <!-- Rank Badge -->
               <div class="absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white rounded-bl-xl shadow-sm z-10"
                   :class="idx === 0 ? 'bg-amber-500' : 'bg-gray-500'"
               >
                   第 {{ idx + 1 }} 名 ({{ date.countO }}人)
               </div>

               <!-- Header -->
               <div class="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col">
                   <div class="flex items-baseline gap-2">
                       <h3 class="text-xl font-mono font-bold">{{ date.dateStr }}</h3>
                       <span class="text-sm text-gray-500">{{ date.dayName }}</span>
                   </div>
                   <div v-if="date.holidayName" class="text-xs text-red-500 font-bold">{{ date.holidayName }}</div>
               </div>

               <!-- Form -->
               <div class="p-5 space-y-4">
                   <!-- Activity Type -->
                   <div>
                       <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">活動類型 (可複選)</label>
                       <div class="flex flex-col gap-2 mt-2">
                           <div class="flex flex-wrap gap-2">
                               <button v-for="opt in activityOptions" :key="opt"
                                   @click="toggleType(date.dateStr, opt)"
                                   class="px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95"
                                   :class="forms[date.dateStr]?.types.includes(opt)
                                       ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                                       : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50'"
                               >
                                   {{ opt }}
                               </button>
                           </div>
                           
                           <!-- Other Remark Input -->
                           <div v-if="forms[date.dateStr]?.types.includes('其他')" class="animate-fade-in-down">
                               <input type="text" v-model="otherRemarks[date.dateStr]" placeholder="輸入活動說明 (例如: 聖誕交換禮物)"
                                   class="w-full text-sm p-2 bg-gray-50 dark:bg-gray-900 border border-teal-200 dark:border-teal-900 rounded-lg focus:ring-1 focus:ring-teal-500 outline-none transition-shadow"
                               />
                           </div>
                       </div>
                   </div>

                   <div class="grid grid-cols-2 gap-4">
                       <div>
                           <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">集合時間</label>
                           <input type="time" v-model="forms[date.dateStr].time" 
                               class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                           />
                       </div>
                       <div>
                           <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">預估費用</label>
                           <input type="text" v-model="forms[date.dateStr].cost" placeholder="e.g. 500/人"
                               class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                           />
                       </div>
                   </div>

                   <div>
                       <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">集合地點</label>
                       <div class="relative">
                           <div class="absolute left-3 top-2.5 i-carbon-location text-gray-400"></div>
                           <input type="text" v-model="forms[date.dateStr].location" placeholder="輸入地點名稱"
                               class="w-full pl-9 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                           />
                       </div>
                   </div>

                   <div v-if="forms[date.dateStr].cost && forms[date.dateStr].cost !== '0'" class="animate-fade-in-down">
                       <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">繳費資訊 (銀行/帳號)</label>
                       <input type="text" v-model="forms[date.dateStr].paymentInfo" placeholder="e.g. 台新 (812) 1234..."
                           class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                       />
                   </div>

                   <div>
                       <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">備註 / 注意事項</label>
                       <textarea v-model="forms[date.dateStr].remarks" rows="2" placeholder="e.g. 請自備水壺、穿著運動服..."
                           class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow resize-none"
                       ></textarea>
                   </div>
               </div>
           </div>
       </div>

       <!-- Action Bar -->
       <div v-if="status !== 'open' && userStore.groupId" class="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-50 flex gap-3 shadow-lg">
           <button @click="saveEvents" :disabled="saving" 
               class="flex-1 btn bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed font-bold py-3 rounded-xl shadow-blue-500/20 shadow-lg active:scale-[0.98] transition-all"
           >
               <div v-if="saving" class="i-carbon-circle-dash animate-spin mr-2"></div>
               {{ saving ? '儲存中...' : '儲存設定' }}
           </button>
           
           <button @click="announceEvents" :disabled="saving" 
               class="flex-1 btn bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 disabled:cursor-not-allowed font-bold py-3 rounded-xl shadow-teal-500/20 shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
           >
               <div class="i-carbon-bullhorn"></div>
               公佈結果 (Bot)
           </button>
           <div class="text-sm text-gray-500 mt-2">
            當前設定群組: {{ groupProfile?.groupName || '未設定' }}
        </div>
    </div>

    <!-- Error Modal -->
    <div v-if="showError" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div class="p-4 border-b flex justify-between items-center bg-red-50 rounded-t-lg">
                <h3 class="font-bold text-red-700">發送失敗 (Debug Info)</h3>
                <button @click="showError = false" class="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div class="p-4 overflow-y-auto flex-1 bg-gray-50">
                <pre class="text-xs text-gray-700 whitespace-pre-wrap break-all font-mono">{{ errorContent }}</pre>
            </div>
            <div class="p-4 border-t flex justify-end gap-2 bg-white rounded-b-lg">
                <button @click="showError = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">關閉</button>
                <button @click="copyError" class="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 flex items-center gap-2">
                    <span>📋</span> 複製完整錯誤訊息
                </button>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { doc, updateDoc, setDoc } from 'firebase/firestore'
import { getNextMonthTargets, getVotingPeriodStatus, type DateInfo } from '~/utils/date-helper'

const userStore = useUserStore()
const scheduleStore = useScheduleStore()
const { $toast } = useNuxtApp() 

const loading = ref(true)
const isAdmin = computed(() => userStore.isAdmin)
// Trust server ID, but check basic presence
const isIdValid = computed(() => !!userStore.groupId)

const generatedLink = ref('')
const currentUrl = ref('')
const urlSnippet = computed(() => {
    if (typeof window === 'undefined') return ''
    return currentUrl.value ? new URL(currentUrl.value).search + new URL(currentUrl.value).hash : ''
})
const statusMsg = ref('')

const saving = ref(false)
const savingSettings = ref(false)
const status = computed(() => scheduleStore.status)

const activityOptions = ['爬山', '踏青', '桌遊', '逛街', '密室', '聚餐', '其他']

interface EventForm {
    types: string[]
    time: string
    location: string
    cost: string
    paymentInfo: string
    remarks: string
    active: boolean
}

const forms = reactive<Record<string, EventForm>>({})
const otherRemarks = reactive<Record<string, string>>({}) 

const groupSettings = reactive({
    autoVoteStartDay: null as number | null,
    autoVoteEndDay: null as number | null
})

const winningDates = ref<(DateInfo & { countO: number })[]>([])

// --- Helper Functions (Defined before use) ---

const calculateWinningDates = (targets: DateInfo[]) => {
    const votes = scheduleStore.votes
    const candidates = targets.map(d => {
        const vote = votes[d.dateStr]
        return {
            ...d,
            countO: vote?.o_users?.length || 0
        }
    })
    .filter(d => d.countO >= 3)
    .sort((a, b) => b.countO - a.countO)
    return candidates.slice(0, 2)
}

const initForm = (dateStr: string) => {
    if (!forms[dateStr]) {
        const existing = scheduleStore.events[dateStr]
        const rawTypes = existing?.types || []
        let parsedTypes: string[] = []
        let remark = ''
        
        rawTypes.forEach((t: string) => {
            if (t.startsWith('其他:')) {
                parsedTypes.push('其他')
                remark = t.replace('其他:', '').trim()
            } else {
                parsedTypes.push(t)
            }
        })
        
        if (remark) otherRemarks[dateStr] = remark

        forms[dateStr] = {
            types: parsedTypes,
            time: existing?.time || '10:00',
            location: existing?.location || '',
            cost: existing?.cost || '',
            paymentInfo: existing?.paymentInfo || '',
            remarks: existing?.remarks || '',
            active: false
        }
    }
}

const toggleType = (dateStr: string, type: string) => {
    const f = forms[dateStr]
    if (!f) return
    if (f.types.includes(type)) {
        f.types = f.types.filter(t => t !== type)
    } else {
        f.types.push(type)
    }
}

// --- Status & Settings Management ---

const fetchLatestGroup = async () => {
    try {
        statusMsg.value = '正在讀取目前管理群組...'
        const res = await $fetch('/api/admin/get-latest-group')
        if (res.success && res.group) {
            userStore.groupId = res.group.groupId
            
            // Load Settings
            if (res.group.autoVoteStartDay) groupSettings.autoVoteStartDay = res.group.autoVoteStartDay
            if (res.group.autoVoteEndDay) groupSettings.autoVoteEndDay = res.group.autoVoteEndDay
            
            console.log('[Admin] Locked to Latest Group:', res.group.groupName, res.group.groupId)
            statusMsg.value = `已鎖定群組：${res.group.groupName}`
        } else {
            statusMsg.value = '尚未加入任何群組，或讀取失敗 (請先邀請機器人加入群組)'
        }
    } catch (e) {
        console.error('Failed to fetch latest group:', e)
        statusMsg.value = '讀取群組資訊失敗'
    }
}

const saveGroupSettings = async () => {
    if (!userStore.groupId) return
    savingSettings.value = true
    try {
        const { db } = useNuxtApp().$firebase
        const { doc, setDoc } = await import('firebase/firestore')
        
        // Single Source of Truth
        const systemGroupRef = doc(db, 'system', 'latestGroup')
        
        await setDoc(systemGroupRef, {
            autoVoteStartDay: groupSettings.autoVoteStartDay,
            autoVoteEndDay: groupSettings.autoVoteEndDay,
            updatedAt: Date.now()
        }, { merge: true })
        
        alert('✅ 排程設定已儲存 (已更新至目前管理群組)')
    } catch (e: any) {
        console.error(e)
        alert('❌ 儲存失敗: ' + e.message)
    } finally {
        savingSettings.value = false
    }
}

// --- Lifecycle ---

onMounted(async () => {
    if (import.meta.server) return
    loading.value = true

    try {
        // 1. Fetch Latest
        await fetchLatestGroup()
        
        // 2. Fetch Holidays
        const holidays = await $fetch<any[]>('/holidays.json').catch(() => [])
        const targets = getNextMonthTargets(holidays)
        
        // 3. Subscribe to Schedule
        stopWatch = watch(() => userStore.groupId, async (newGroupId) => {
            if (!newGroupId) return
            
            // Reset
            Object.keys(forms).forEach(key => delete forms[key])
            Object.keys(otherRemarks).forEach(key => delete otherRemarks[key])
            winningDates.value = []

            if (targets.length > 0) {
                 const [y, m] = targets[0].dateStr.split('-')
                 await scheduleStore.subscribeToMonth(newGroupId, Number(y), Number(m))
                 const dateStrs = targets.map(d => d.dateStr)
                 await scheduleStore.subscribeToDates(newGroupId, dateStrs)
            }
        }, { immediate: true })

        // 4. Calc Winners
        watchEffect(() => {
            const winners = calculateWinningDates(targets)
            winningDates.value = winners
            winners.forEach(w => initForm(w.dateStr))
        })
        
        // 5. Sync Events
        watch(() => scheduleStore.events, (newEvents) => {
             if (!newEvents) return
             Object.entries(newEvents).forEach(([date, evt]: [string, any]) => {
                if (forms[date]) {
                    const rawTypes = evt.types || []
                    let parsedTypes: string[] = []
                    let remark = ''
                    rawTypes.forEach((t: string) => {
                        if (t.startsWith('其他:')) {
                            parsedTypes.push('其他')
                            remark = t.replace('其他:', '').trim()
                        } else {
                            parsedTypes.push(t)
                        }
                    })
                    if (remark) otherRemarks[date] = remark

                    forms[date] = {
                        types: parsedTypes,
                        time: evt.time || '10:00',
                        location: evt.location || '',
                        cost: evt.cost || '',
                        paymentInfo: evt.paymentInfo || '',
                        remarks: evt.remarks || '',
                        active: true
                    }
                }
             })
        }, { deep: true })
        
    } catch (e) {
        console.error(e)
    } finally {
        setTimeout(() => { loading.value = false }, 1500)
    }
    
    if (typeof window !== 'undefined') {
        currentUrl.value = window.location.href
    }
})

let stopWatch: (() => void) | undefined
onUnmounted(() => {
    if (stopWatch) stopWatch()
})

const getScheduleId = () => {
    if (scheduleStore.currentMonthId) return scheduleStore.currentMonthId
    
    // Derive from targets if possible or date
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 2 // Target is usually next month
    // Handle Dec -> Jan wrap? 
    // Wait, targets is accurate.
    if (winningDates.value.length > 0) {
        // Use first winning date to determine YYYYMM
        const [y, m] = winningDates.value[0].dateStr.split('-')
        return `${userStore.groupId}_${y}${m}`
    }
    // Fallback default (current month +1)
    return `${userStore.groupId}_${year}${String(month > 12 ? 1 : month).padStart(2,'0')}`
}

const saveEvents = async () => {
    const scheduleId = getScheduleId()
    if (!userStore.groupId || !scheduleId) return
    saving.value = true
    
    try {
        const { db } = useNuxtApp().$firebase
        const scheduleRef = doc(db, 'monthlySchedules', scheduleId)
        
        // Prepare events object
        const eventsData: Record<string, any> = {}
        winningDates.value.forEach(d => {
            const f = forms[d.dateStr]
            if (!f) return
            
            // Process types to include custom remark
            const processedTypes = f.types.map(t => {
                if (t === '其他' && otherRemarks[d.dateStr]) {
                    return `其他: ${otherRemarks[d.dateStr]}`
                }
                return t
            })

            eventsData[d.dateStr] = {
                types: processedTypes,
                time: f.time,
                location: f.location,
                cost: f.cost,
                paymentInfo: f.paymentInfo,
                remarks: f.remarks
            }
        })

        // Also update finalEvent (legacy/backward compat) - pick TOP 1
        const top1 = winningDates.value[0]
        let finalEventData = null
        if (top1) {
            const f = forms[top1.dateStr]
             // Construct timestamp for legacy field
            const dateObj = new Date(top1.dateStr)
            if (f.time) {
                const [h, m] = f.time.split(':')
                dateObj.setHours(Number(h || 0), Number(m || 0))
            }
            
            finalEventData = {
                type: f.types.join(','), // Legacy is string
                location: f.location,
                description: `${f.remarks}\n(費用: ${f.cost})`,
                timestamp: dateObj.getTime()
            }
        }
        
        await updateDoc(scheduleRef, {
            events: eventsData,
            ...(finalEventData && { finalEvent: finalEventData }),
            updatedAt: Date.now()
        }).catch(async (err) => {
            // Need to create if missing (unlikely if voting exists but possible)
            if (err.code === 'not-found') {
                const [_, yyyymm] = scheduleId.split('_')
                 await setDoc(scheduleRef, {
                    groupId: userStore.groupId,
                    month: yyyymm,
                    status: 'closed',
                    events: eventsData,
                    votes: {},
                    ...(finalEventData && { finalEvent: finalEventData }),
                })
            } else throw err
        })
        
        alert('✅ 設定已儲存')
    } catch (e: any) {
        console.error(e)
        alert('❌ 儲存失敗: ' + (e.message || '未知錯誤'))
    } finally {
        saving.value = false
    }
}

const announceEvents = async () => {
    if (!userStore.groupId) {
        alert('無法取得群組 ID')
        return
    }

    // Filter to only configured events (must have types or location)
    const validEvents = winningDates.value.filter(d => {
        const f = forms[d.dateStr]
        return f && f.types.length > 0
    })

    if (validEvents.length === 0) {
        alert('❌ 無法公佈：請至少為一個日期設定活動類型')
        return
    }

    // Check partials
    if (validEvents.length < winningDates.value.length) {
        if (!confirm(`⚠️ 只有 ${validEvents.length} 個日期已設定類型，其他日期將被忽略。確定要公佈嗎？`)) return
    }

    const unconfigured = validEvents.some(d => {
        const f = forms[d.dateStr]
        return !f.location
    })
    
    if (unconfigured) {
        if (!confirm('⚠️ 部分活動尚未設定地點，確定要公佈嗎？')) return
    }

    saving.value = true
    try {
        // Resolve Participant Names
        const { db } = useNuxtApp().$firebase
        const { getDoc, doc } = await import('firebase/firestore')

        // Send ONLY valid info
        // We map to promises to fetch names parallelly per event? 
        // Or better: collect all unique IDs first to minimize reads?
        // For simplicity (small group): iterate events, fetch their users.
        
        const eventsList = await Promise.all(validEvents.map(async d => {
            const votes = scheduleStore.votes[d.dateStr]
            const userIds = votes?.o_users || []
            
            // Resolve names
            const members: { name: string, avatar: string }[] = []
            if (userIds.length > 0) {
                const userDocs = await Promise.all(userIds.map(uid => getDoc(doc(db, 'users', uid))))
                members.push(...userDocs.map(snap => {
                    if (snap.exists()) {
                        const d = snap.data()
                        return { name: d.displayName || '未知', avatar: d.pictureUrl || '' }
                    }
                    return { name: '未知', avatar: '' } // Fallback
                }))
            }

            return {
                date: d.dateStr,
                dayName: d.dayName,
                participants: members, // Pass structured data
                participantCount: userIds.length,
                ...forms[d.dateStr]
            }
        }))

        const res = await $fetch<any>('/api/bot/push', {
            method: 'POST',
            body: {
                groupId: userStore.groupId,
                eventData: {
                    messageType: 'event_announcement',
                    events: eventsList
                }
            }
        })

        
        if (res.success) {
            alert(res.mock ? '通知已模擬發送 (終端機可查看)' : '📢 詳細活動資訊已推播至群組！')
        }
    } catch (e: any) {
        console.error(e)
        // detailed message is usually in _data.message for createError
        const data = e.response?._data
        let serverMsg = data?.message || data?.statusMessage || e.message
        
        // If it's an object, stringify it
        if (typeof serverMsg === 'object') {
            serverMsg = JSON.stringify(serverMsg, null, 2)
        }
        
        errorContent.value = serverMsg
        showError.value = true
    } finally {
        saving.value = false
    }
}

// Error Modal Logic
const showError = ref(false)
const errorContent = ref('')

const copyError = async () => {
    try {
        await navigator.clipboard.writeText(errorContent.value)
        alert('已複製到剪貼簿')
    } catch (err) {
        console.error('Copy failed', err)
        alert('複製失敗，請手動複製')
    }
}
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <!-- ... existing template content ... -->
    <!-- I need to inject the modal at the root of the template, but I can't overwrite the whole file nicely. -->
    <!-- Strategy: I will append the modal markup to the end of the template in a separate edit or try to find a safe insertion point. -->
    <!-- Wait, I am in the <script> block here. I need to close script and start template if I were replacing more. -->
    <!-- The user's file structure is <script setup> then <template>. -->
    <!-- I will split this into two edits: 1. Add state/logic in script. 2. Add UI in template. -->
    <!-- This replace_file_content corresponds to the Script logic. -->
  </div>
</template>

<style scoped>
/* Slight fade in for items */
@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-down {
    animation: fadeInDown 0.2s ease-out forwards;
}
</style>
