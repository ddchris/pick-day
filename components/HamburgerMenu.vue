<template>
  <div class="relative">
    <!-- Hamburger Button -->
    <button 
      @click="isOpen = !isOpen"
      class="icon-btn text-xl relative z-50"
      :class="{ 'text-teal-600': isOpen }"
    >
      <div v-if="!isOpen" class="i-carbon-menu"></div>
      <div v-else class="i-carbon-close"></div>
    </button>

    <!-- Menu Overlay -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div 
          v-if="isOpen"
          @click="isOpen = false"
          class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99]"
        ></div>
      </Transition>

      <!-- Menu Panel -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-all duration-250 ease-in"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <div 
          v-if="isOpen"
          class="fixed top-0 right-0 h-full w-72 shadow-2xl z-[100] flex flex-col bg-white dark:bg-[#1A212E]"
        >
          <!-- Menu Header -->
          <div class="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">選單</h2>
              <button @click="isOpen = false" class="icon-btn text-gray-400 hover:text-gray-600">
                <div class="i-carbon-close w-5 h-5"></div>
              </button>
            </div>
          </div>

          <!-- User Info -->
          <div v-if="userStore.profile" class="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <div class="flex items-center gap-3">
              <img 
                :src="userStore.profile.pictureUrl || 'https://api.iconify.design/carbon:user-avatar-filled-alt.svg'"
                class="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-700"
                alt="Avatar"
              />
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {{ userStore.profile.displayName }}
                </div>
                <div v-if="userStore.isAdmin" class="text-xs text-teal-600 dark:text-teal-400 font-medium">
                  👑 管理員
                </div>
              </div>
            </div>
          </div>

          <!-- Navigation Links -->
          <nav class="flex-1 py-4">
            <nuxt-link
              v-for="item in menuItems"
              :key="item.path"
              :to="item.path"
              @click="isOpen = false"
              class="flex items-center gap-3 px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              :class="{ 
                'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-semibold': isCurrentRoute(item.path),
                'opacity-50': item.disabled
              }"
            >
              <div :class="item.icon" class="w-5 h-5"></div>
              <span>{{ item.label }}</span>
              <div v-if="item.badge" class="ml-auto">
                <span class="px-2 py-0.5 text-xs font-bold rounded-full bg-teal-600 text-white">
                  {{ item.badge }}
                </span>
              </div>
            </nuxt-link>
          </nav>

          <!-- Footer -->
          <div class="p-4 border-t border-gray-100 dark:border-gray-800">
            <div class="text-xs text-center text-gray-400">
              Pick Dates v1.0
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const userStore = useUserStore()
const route = useRoute()
const isOpen = ref(false)

const menuItems = computed(() => {
  const allItems = [
    {
      path: '/',
      label: '挑日子',
      icon: 'i-carbon-calendar',
    },
    {
      path: '/result',
      label: '活動結果',
      icon: 'i-carbon-trophy',
    },
    {
      path: '/admin',
      label: '管理員設定',
      icon: 'i-carbon-settings',
      requiresAdmin: true,
    },
    {
      path: '/admin-setup',
      label: '管理員工具',
      icon: 'i-carbon-user-admin',
      badge: userStore.isAdmin ? undefined : 'Setup',
      requiresAdmin: true,
    },
    {
      path: '/dev-tools',
      label: '🛠️ 開發工具',
      icon: 'i-carbon-development',
      badge: 'DEV',
      requiresAdmin: true,
    },
    {
      path: '/about',
      label: '關於',
      icon: 'i-carbon-information',
    },
  ]

  // Filter based on Environment and Admin Status
  return allItems.filter(item => {
    // Determine if we are in Production
    const isProd = import.meta.env.PROD
    
    if (item.requiresAdmin) {
        // In Production: Only Admin can see
        if (isProd) {
            return userStore.isAdmin
        }
        // In Dev: Everyone can see (for testing convenience)
        // OR reuse existing logic? 
        // User request: "Formal environment... only admin can see"
        // Implication: Dev environment is lenient.
        return true
    }
    
    return true
  })
})

const isCurrentRoute = (path: string) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

// Close menu when route changes
watch(() => route.path, () => {
  isOpen.value = false
})

// Close menu on escape key
onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen.value) {
      isOpen.value = false
    }
  }
  window.addEventListener('keydown', handleEscape)
  
  onUnmounted(() => {
    window.removeEventListener('keydown', handleEscape)
  })
})
</script>


