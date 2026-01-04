<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-900 shadow-2xl overflow-hidden relative">
    <header class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-50">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold bg-gradient-to-r from-teal-500 to-blue-500 bg-clip-text text-transparent">
          <slot name="header">Pick Dates</slot>
        </h1>
      </div>
      
      <div class="flex items-center gap-3">
        <button @click="uiStore.toggleDark()" class="icon-btn text-xl">
           <div class="i-carbon-moon dark:i-carbon-sun"></div>
        </button>
        
        <div v-if="userStore.profile" class="relative group">
           <img 
             :src="userStore.profile.pictureUrl || 'https://api.iconify.design/carbon:user-avatar-filled-alt.svg'" 
             class="w-8 h-8 rounded-full border-2 border-gray-100 dark:border-gray-700 object-cover" 
             alt="Avatar"
           />
        </div>

        <!-- Hamburger Menu -->
        <HamburgerMenu />
      </div>
    </header>

    <main class="flex-1 overflow-y-auto overflow-x-hidden relative">
      <!-- Warning Banners -->
    <div v-if="!userStore.mockMode && !userStore.isInitializing" class="flex flex-col">
      <!-- Missing Identity Warning -->
      <div v-if="!userStore.profile" class="bg-red-600 text-white p-4 text-center text-sm font-bold shadow-md animate-slide-down relative z-[60]">
         <div class="flex items-center justify-center gap-2 mb-1">
           <div class="i-carbon-warning-filled text-xl"></div>
           <p>請設定在 LINE APP 內部開啟網頁</p>
         </div>
         <p class="text-xs opacity-90 font-normal">目前無法取得您的身分資訊。請確保您是在 LINE 應用程式內直接開啟此連結。</p>
      </div>

      <!-- External Browser / Missing Group Warning -->
      <div v-else-if="!userStore.groupId" class="bg-blue-600 text-white p-4 flex flex-col gap-3 shadow-md animate-slide-down relative z-[60]">
        <div class="flex items-start gap-3">
            <div class="i-carbon-information-filled text-2xl mt-0.5 shrink-0"></div>
            <div>
              <p class="font-bold text-sm mb-1">請設定在 LINE APP 內部開啟網頁</p>
              <p class="text-xs opacity-90 leading-relaxed">目前未偵測到群組資訊。請從 <span class="font-bold underline">LINE 群組內</span> 點擊連結開啟，以獲得完整的功能權限。</p>
            </div>
        </div>
        
        <!-- Debug Metadata -->
        <div class="mt-1 p-2 bg-black/20 rounded text-[10px] font-mono flex flex-col gap-1 opacity-80">
            <div class="flex flex-wrap gap-x-4">
                <span>Type: {{ userStore.debugInfo?.type || 'null' }}</span>
                <span>Client: {{ userStore.isInLineClient ? 'LINE' : 'External' }}</span>
                <span v-if="userStore.initError" class="text-red-300">Error: {{ userStore.initError }}</span>
            </div>
            <div class="truncate text-teal-300">
                RawID: {{ userStore.debugInfo?.groupId || userStore.debugInfo?.roomId || 'Missing' }}
            </div>
        </div>
      </div>
    </div>

      <slot />
    </main>
    
    <div class="fixed bottom-4 right-4 z-50 pointer-events-none">
       <!-- Toast Container can go here -->
    </div>

    <!-- Debug Info (Bottom Safe Area) -->
    <!-- Debug Info Removed -->
  </div>
</template>

<script setup lang="ts">
const userStore = useUserStore()
const uiStore = useUiStore()
const config = useRuntimeConfig()
</script>

<style scoped>
.icon-btn {
  @apply p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95;
}
</style>
