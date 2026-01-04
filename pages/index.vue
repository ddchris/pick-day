<template>
  <div class="h-full flex flex-col">
    <!-- Status Banner -->
    <div class="px-4 py-3 text-sm font-medium flex justify-between items-center z-10 sticky top-0 transition-colors"
       :class="status === 'OPEN' ? 'bg-teal-600 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700'"
    >
      <div class="flex items-center gap-2">
         <div class="i-carbon-calendar w-5 h-5"></div>
         <span class="text-base font-bold">{{ status === 'OPEN' ? '本月挑日子開放中' : '非填寫期間' }}</span>
      </div>
      <span class="font-mono text-sm font-bold opacity-90">
         <template v-if="settingsLoaded">
            開放: {{ groupSettings.start || 24 }}日 - {{ groupSettings.end || 30 }}日
         </template>
         <span v-else class="text-xs opacity-50">載入排程中...</span>
      </span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex flex-col items-center justify-center opacity-50 space-y-2">
       <div class="i-carbon-circle-dash w-8 h-8 animate-spin text-teal-600"></div>
       <span class="text-xs">Loading dates...</span>
    </div>

    <!-- Date List -->
    <div v-else class="flex-1 p-4 espacio-y-3 pb-24 pt-0">
       <div v-if="targets.length === 0" class="text-center py-10 text-gray-400">
          下個月無需挑日子 (無假日/週末?)
       </div>

       <div v-for="date in targets" :key="date.dateStr" 
         class="group relative bg-white dark:bg-gray-800 rounded-xl p-2 my-2 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between transition-transform active:scale-[0.99]"
       >
          <!-- Date Info -->
          <div class="flex flex-col flex-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -m-2 p-2 rounded-lg transition-colors" @click="openDetails(date.dateStr)">
             <div class="flex items-baseline gap-2">
                <span class="font-bold text-lg font-mono tracking-tight">{{ date.dateStr.slice(5) }}</span>
                <span class="text-sm font-sans text-gray-500 dark:text-gray-400" :class="{'text-red-500 font-bold': date.isWeekend || date.isHoliday}">{{ date.dayName }}</span>
             </div>
             <span v-if="date.holidayName" class="text-xs text-red-500 font-bold mt-0.5">{{ date.holidayName }}</span>
             
             <!-- Votes Indicator (Only show counts if closed or always?) User said "Show O/X stats" -->
             <div class="flex items-center gap-3 text-xs text-gray-400 mt-1">
                 <div class="flex items-center gap-1">
                    <div class="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                    <span>{{ getVoteCounts(date.dateStr).o }}</span>
                 </div>
                 <div class="flex items-center gap-1">
                    <div class="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                     <span>{{ getVoteCounts(date.dateStr).x }}</span>
                 </div>
             </div>
          </div>
          
          <!-- Voting Toggle -->
          <!-- Only active if OPEN and logged in -->
          <div class="isolate inline-flex rounded-lg shadow-sm">
             <button 
               @click="handleVote(date.dateStr, 'O')"
               :disabled="status !== 'OPEN'"
               class="relative inline-flex items-center justify-center w-12 h-10 rounded-l-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium focus:z-10 focus:outline-none transition-colors"
               :class="getMyVote(date.dateStr) === 'O' 
                 ? '!bg-teal-500 !text-white !border-teal-500 shadow-inner' 
                 : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 opacity-60 grayscale'"
             >
               <div class="i-carbon-checkmark-filled w-6 h-6"></div>
             </button>
             <button 
               @click="handleVote(date.dateStr, 'X')"
               :disabled="status !== 'OPEN'"
               class="relative inline-flex items-center justify-center w-12 h-10 rounded-r-lg border border-l-0 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium focus:z-10 focus:outline-none transition-colors"
               :class="getMyVote(date.dateStr) === 'X'
                 ? '!bg-red-500 !text-white !border-red-500 shadow-inner' 
                 : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 opacity-60 grayscale'"
             >
               <div class="i-carbon-close-filled w-6 h-6"></div>
             </button>
          </div>
       </div>
    </div>
    <!-- Participant Detail Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
        
        <!-- Modal Card -->
        <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up">
            <!-- Header -->
            <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                <div>
                   <h3 class="font-bold text-lg text-gray-800 dark:text-gray-100">{{ selectedDate.slice(5) }} 參加狀況</h3>
                   <p class="text-xs text-gray-500">點擊背景關閉</p>
                </div>
                <button @click="closeModal" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <div class="i-carbon-close text-xl"></div>
                </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-4 space-y-6">
                <div v-if="detailsLoading" class="flex flex-col items-center justify-center py-8 text-gray-400">
                    <div class="i-carbon-circle-dash w-8 h-8 animate-spin mb-2 text-teal-500"></div>
                    <span class="text-xs">載入名單中...</span>
                </div>

                <div v-else class="space-y-6">
                    <!-- O List -->
                    <div>
                        <div class="flex items-center gap-2 mb-3">
                            <div class="w-2 h-2 rounded-full bg-teal-500"></div>
                            <span class="font-bold text-gray-700 dark:text-gray-200">可以參加 ({{ currentDetails.o.length }})</span>
                        </div>
                        <div class="flex flex-wrap gap-2">
                             <span v-for="name in currentDetails.o" :key="name" 
                                class="px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-sm rounded-full border border-teal-100 dark:border-teal-800"
                             >
                                {{ name }}
                             </span>
                             <span v-if="currentDetails.o.length === 0" class="text-sm text-gray-400 italic">尚無人參加</span>
                        </div>
                    </div>

                    <!-- X List -->
                    <div>
                        <div class="flex items-center gap-2 mb-3">
                            <div class="w-2 h-2 rounded-full bg-red-400"></div>
                            <span class="font-bold text-gray-700 dark:text-gray-200">無法參加 ({{ currentDetails.x.length }})</span>
                        </div>
                        <div class="flex flex-wrap gap-2">
                             <span v-for="name in currentDetails.x" :key="name" 
                                class="px-3 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-full border border-red-100 dark:border-red-800"
                             >
                                {{ name }}
                             </span>
                             <span v-if="currentDetails.x.length === 0" class="text-sm text-gray-400 italic">尚無人無法參加</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getNextMonthTargets, getVotingPeriodStatus, type DateInfo } from '~/utils/date-helper'
import { doc, getDoc } from 'firebase/firestore'

const userStore = useUserStore()
const scheduleStore = useScheduleStore()

const devStore = useDevStore()
const loading = ref(true)
const settingsLoaded = ref(false)
const targets = ref<DateInfo[]>([])
const groupSettings = reactive({ start: 24, end: 30 }) // Default

const status = computed(() => {
    if (devStore.overrideStatus) return devStore.overrideStatus
    // If not loaded, maybe rely on defaults OR force closed?
    // Using defaults is fine for logic as long as UI doesn't mislead.
    return getVotingPeriodStatus(new Date(), Number(groupSettings.start), Number(groupSettings.end))
})

// Modal Logic
const showModal = ref(false)
const selectedDate = ref('')
const detailsLoading = ref(false)
const currentDetails = reactive({ o: [] as string[], x: [] as string[] })
const userCache = new Map<string, string>() // ID -> DisplayName

const closeModal = () => {
    showModal.value = false
}

const openDetails = async (dateStr: string) => {
    selectedDate.value = dateStr
    showModal.value = true
    detailsLoading.value = true
    
    // Reset
    currentDetails.o = []
    currentDetails.x = []

    try {
        const vote = scheduleStore.votes[dateStr]
        if (!vote) throw new Error('No data')
        
        const { db } = useNuxtApp().$firebase
        
        // Helper to resolve names
        const resolveNames = async (ids: string[]) => {
            return Promise.all(ids.map(async (uid) => {
                if (userCache.has(uid)) return userCache.get(uid)!
                
                // Fetch
                try {
                    const snap = await getDoc(doc(db, 'users', uid))
                    const name = snap.exists() ? (snap.data().displayName || '未知用戶') : '未知用戶'
                    userCache.set(uid, name)
                    return name
                } catch {
                    return '未知用戶'
                }
            }))
        }

        const [oNames, xNames] = await Promise.all([
            resolveNames(vote.o_users || []),
            resolveNames(vote.x_users || [])
        ])
        
        currentDetails.o = oNames
        currentDetails.x = xNames
        
    } catch (e) {
        console.error(e)
    } finally {
        detailsLoading.value = false
    }
}

const fetchHolidays = async () => {
    try {
        const data = await $fetch<any[]>('/holidays.json').catch(e => {
            console.log('Holidays file not found, using default')
            return []
        })
        return data
    } catch {
        return []
    }
}

// ... existing helpers ...
const getMyVote = (date: string) => {
    const userId = userStore.profile?.userId
    if (!userId) return null
    const vote = scheduleStore.votes[date]
    if (vote?.o_users.includes(userId)) return 'O'
    if (vote?.x_users.includes(userId)) return 'X'
    return null
}

const getVoteCounts = (date: string) => {
    const vote = scheduleStore.votes[date]
    return {
        o: vote?.o_users.length || 0, // Use array length as truth
        x: vote?.x_users.length || 0
    }
}

const handleVote = async (date: string, type: 'O' | 'X') => {
    if (!userStore.groupId) {
        alert('請從 LINE 群組開啟')
        return
    }
    await scheduleStore.toggleVote(userStore.groupId, date, type)
    // No explicit save needed (auto-save)
    // Haptic feedback could be nice here if LIFF supports it (liff.vibrate?)
}

onMounted(async () => {
    const holidays = await fetchHolidays()
    targets.value = getNextMonthTargets(holidays)
    
    // Helper to fetch settings (Single Source of Truth)
    const loadGroupSettings = async () => {
        try {
             const { db } = useNuxtApp().$firebase
             const { doc, getDoc } = await import('firebase/firestore')
             // Always fetch from system/latestGroup as requested
             const groupSnap = await getDoc(doc(db, 'system', 'latestGroup'))
             
             if (groupSnap.exists()) {
                 const d = groupSnap.data()
                 console.log('[Index] Loaded Global Settings:', d)
                 
                 // Update ID to match the active group
                 if (d.groupId && d.groupId !== userStore.groupId) {
                     console.log('[Index] Switching to active group:', d.groupId)
                     userStore.groupId = d.groupId
                 }

                 groupSettings.start = d.autoVoteStartDay || 24
                 groupSettings.end = d.autoVoteEndDay || 30
             } else {
                 console.log('[Index] No active group settings found')
             }
        } catch (e) {
            console.error('[Index] Failed to load group settings:', e)
        } finally {
            settingsLoaded.value = true
        }
    }

    // Subscribe if we have groupId
    if (userStore.groupId) {
        await loadGroupSettings()
        const dates = targets.value.map(d => d.dateStr)
        scheduleStore.subscribeToDates(userStore.groupId, dates)
    } 
    
    // Watch for groupId changes (init or change)
    watch(() => userStore.groupId, async (newVal) => {
        if (newVal) {
             await loadGroupSettings()
             const dates = targets.value.map(d => d.dateStr)
             scheduleStore.subscribeToDates(newVal, dates)
        }
    })
    
    loading.value = false
})
</script>
