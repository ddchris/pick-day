<template>
  <div class="min-h-full flex flex-col p-4 space-y-6">
     <!-- Header -->
     <div class="flex flex-col gap-1">
       <h2 class="text-2xl font-bold flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">
         <div class="i-carbon-trophy-filled text-yellow-500 text-2xl"></div>
         <span>投票結果</span>
       </h2>
       <span class="text-sm text-gray-500 dark:text-gray-400">即使截止，仍可查看大家的選擇</span>
     </div>
     
     <!-- Voting In Progress Banner -->
     <div v-if="votingStatus === 'OPEN'" class="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl p-6 text-center border border-teal-200 dark:border-teal-700 mb-4">
       <div class="text-5xl mb-3">📊</div>
       <h2 class="text-xl font-bold text-teal-800 dark:text-teal-200 mb-2">投票正在進行中</h2>
       <p class="text-sm text-teal-600 dark:text-teal-300">
         排名結果為即時統計，最終結果將在投票截止後公布
       </p>
     </div>
     
     <div v-if="loading" class="flex-1 flex justify-center py-20">
         <div class="i-carbon-circle-dash w-8 h-8 animate-spin text-gray-400"></div>
     </div>
     
     <div v-else-if="rankedDates.length === 0" class="text-center text-gray-400 py-10">
         尚未有人投票或無候選日期
     </div>
     
     <div v-else class="space-y-4 pb-20">
         <div v-for="(date, idx) in rankedDates" :key="date.dateStr"
            @click="showDetails(date)"
            class="relative overflow-hidden rounded-2xl p-4 border flex justify-between items-center transition-all bg-white dark:bg-gray-800 cursor-pointer hover:shadow-md active:scale-[0.98]"
            :class="idx < 2 ? 'border-yellow-400 dark:border-yellow-600 shadow-lg scale-[1.01]' : 'border-gray-100 dark:border-gray-700 opacity-90'"
         >
            <!-- Badge for Top 2 -->
            <div v-if="idx < 2" class="absolute -right-4 -top-4 w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full blur-xl"></div>
            
            <div class="flex items-center gap-4 z-10">
               <div class="flex flex-col items-center justify-center w-8 h-8 rounded-lg font-bold text-lg" 
                  :class="idx === 0 ? 'bg-yellow-500 text-white shadow-md' : (idx === 1 ? 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200' : 'text-gray-400')"
               >
                  {{ idx + 1 }}
               </div>
               
               <div class="flex flex-col">
                  <div class="flex items-baseline gap-2">
                      <span class="font-mono font-bold text-lg">{{ date.dateStr.slice(5) }}</span>
                      <span class="text-sm text-gray-500 dark:text-gray-400">{{ date.dayName }}</span>
                  </div>
                  <div class="text-xs text-red-500 font-bold" v-if="date.holidayName">{{ date.holidayName }}</div>
               </div>
            </div>
            
            <div class="flex flex-col items-end z-10">
               <div class="flex items-baseline gap-1">
                   <span class="font-bold text-2xl" :class="date.countO > 0 ? 'text-teal-600 dark:text-teal-400' : 'text-gray-300'">{{ date.countO }}</span>
                   <span class="text-xs text-gray-400">人 OK</span>
               </div>
               <!-- Avatars Preview (Top 3) -->
               <div class="flex -space-x-1.5 mt-1 overflow-hidden" v-if="date.o_users.length > 0">
                   <!-- In real app, we need to resolve userId to PictureUrl. 
                        This requires storing Profiles or fetching them. 
                        For now, we show placeholders or just count. -->
                   <div v-for="u in date.o_users.slice(0,3)" :key="u" 
                     class="w-4 h-4 rounded-full border border-white dark:border-gray-800 bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-[10px] text-teal-600 font-bold"
                   >
                     {{ userNames[u]?.charAt(0) || '?' }}
                   </div>
                   <div v-if="date.o_users.length > 3" class="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-700 text-[8px] flex items-center justify-center border border-white dark:border-gray-800">+</div>
               </div>
            </div>
         </div>
     </div>

    <!-- Details Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="selectedDate" class="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="selectedDate = null"></div>
          
          <div class="relative bg-white dark:bg-gray-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up sm:animate-fade-in">
             <div class="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <div class="flex flex-col">
                  <h3 class="text-xl font-bold">{{ selectedDate.dateStr }} {{ selectedDate.dayName }}</h3>
                  <span class="text-xs text-gray-400">投票詳情</span>
                </div>
                <button @click="selectedDate = null" class="icon-btn text-gray-400">
                  <div class="i-carbon-close w-6 h-6"></div>
                </button>
             </div>
             
             <div class="px-6 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
                <!-- OK List -->
                <div class="space-y-3">
                   <div class="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold">
                      <div class="i-carbon-checkmark-filled w-5 h-5"></div>
                      <span>可以參加 ({{ selectedDate.o_users.length }})</span>
                   </div>
                   <div class="flex flex-wrap gap-2">
                      <div v-for="u in selectedDate.o_users" :key="u" 
                        class="px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg text-sm font-medium border border-teal-100 dark:border-teal-900/50 flex items-center gap-2"
                      >
                         <img v-if="userAvatars[u]" :src="userAvatars[u]" class="w-5 h-5 rounded-full object-cover border border-teal-200" alt="avatar" />
                         <div v-else class="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center text-[10px] text-white font-bold">{{ userNames[u]?.charAt(0) || '?' }}</div>
                         {{ userNames[u] || '載入中...' }}
                      </div>
                      <div v-if="selectedDate.o_users.length === 0" class="text-gray-400 text-sm italic">尚無人投票</div>
                   </div>
                </div>

                <!-- Not OK List -->
                <div class="space-y-3">
                   <div class="flex items-center gap-2 text-red-500 dark:text-red-400 font-bold">
                      <div class="i-carbon-close-filled w-5 h-5"></div>
                      <span>不克參加 ({{ selectedDate.x_users.length }})</span>
                   </div>
                   <div class="flex flex-wrap gap-2">
                      <div v-for="u in selectedDate.x_users" :key="u" 
                        class="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium border border-red-100 dark:border-red-900/50 flex items-center gap-2"
                      >
                         <img v-if="userAvatars[u]" :src="userAvatars[u]" class="w-5 h-5 rounded-full object-cover border border-red-200" alt="avatar" />
                         <div v-else class="w-5 h-5 rounded-full bg-red-400 flex items-center justify-center text-[10px] text-white font-bold">{{ userNames[u]?.charAt(0) || '?' }}</div>
                         {{ userNames[u] || '載入中...' }}
                      </div>
                      <div v-if="selectedDate.x_users.length === 0" class="text-gray-400 text-sm italic">尚無人投票</div>
                   </div>
                </div>
             </div>
             
             <div class="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 text-center">
                <button @click="selectedDate = null" class="w-full py-2.5 font-bold text-gray-500">關閉</button>
             </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { getNextMonthTargets, type DateInfo } from '~/utils/date-helper'
import { collection, query, where, getDocs, documentId } from 'firebase/firestore'

const scheduleStore = useScheduleStore()
const userStore = useUserStore()
const devStore = useDevStore()

const votingStatus = computed(() => {
    if (devStore.overrideStatus) return devStore.overrideStatus
    return scheduleStore.status === 'open' ? 'OPEN' : 'CLOSED'
})

const loading = ref(true)
const rankedDates = ref<any[]>([])
const selectedDate = ref<any | null>(null)
const userNames = reactive<Record<string, string>>({})
const userAvatars = reactive<Record<string, string>>({})

const showDetails = (date: any) => {
    selectedDate.value = date
}

const fetchUserNames = async (userIds: string[]) => {
    const missingIds = userIds.filter(id => !userNames[id])
    if (missingIds.length === 0) return

    try {
        const { db } = useNuxtApp().$firebase
        const usersRef = collection(db, 'users')
        
        for (let i = 0; i < missingIds.length; i += 30) {
            const chunk = missingIds.slice(i, i + 30)
            const q = query(usersRef, where(documentId(), 'in', chunk))
            try {
                const snap = await getDocs(q)
                const foundIds = new Set<string>()
                
                snap.forEach(doc => {
                    const data = doc.data()
                    userNames[doc.id] = data.displayName || '未知用戶'
                    userAvatars[doc.id] = data.pictureUrl || '' 
                    foundIds.add(doc.id)
                })

                // Mark missing ones
                chunk.forEach(id => {
                    if (!foundIds.has(id)) {
                         userNames[id] = '未知用戶 (Missing)'
                         userAvatars[id] = ''
                    }
                })
            } catch (err) {
                console.error('Chunk fetch failed', err)
                chunk.forEach(id => {
                     if (!userNames[id]) userNames[id] = '載入失敗'
                })
            }
        }
    } catch (e) {
        console.error('Failed to fetch user info', e)
    }
}

onMounted(async () => {
    // We assume data is already subscribed if we came from Index, 
    // BUT user might land here deeply.
    // Ideally we re-fetch or ensure subscription.
    loading.value = true
    
    try {
        const holidays = await $fetch<any[]>('/holidays.json').catch(() => [])
        const targets = getNextMonthTargets(holidays)
        
        // Ensure subscription
        // If we are in 'read-only' mode (e.g. results shared in chat), we definitely need groupId.
        if (userStore.groupId) {
             const dates = targets.map(d => d.dateStr)
             await scheduleStore.subscribeToDates(userStore.groupId, dates)
        }
        
        // Wait a tick for data sync (Firestore is fast but async)
        // With onSnapshot, it updates reactive state.
        
        // Compute Ranking
        // Reactive watcher to update list
        watchEffect(() => {
             const ranked = targets.map(d => {
                 const vote = scheduleStore.votes[d.dateStr]
                 const o_users = vote?.o_users || []
                 const x_users = vote?.x_users || []
                 
                 // Collect all unique user IDs to fetch names
                 const allUserIds = [...new Set([...o_users, ...x_users])]
                 
                 // Pre-fill current user if available to avoid "Unknown" for self
                 if (userStore.profile?.userId && userStore.profile.displayName) {
                     userNames[userStore.profile.userId] = userStore.profile.displayName
                     userAvatars[userStore.profile.userId] = userStore.profile.pictureUrl || ''
                 }

                 if (allUserIds.length > 0) {
                     fetchUserNames(allUserIds)
                 }

                 return {
                     ...d,
                     o_users,
                     x_users,
                     countO: o_users.length,
                     countX: x_users.length
                 }
             })
             // Sort: Count O desc
             .sort((a, b) => b.countO - a.countO)
             
             rankedDates.value = ranked
        })
        
    } finally {
        loading.value = false
    }
})
</script>
