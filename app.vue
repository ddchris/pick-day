<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import '@unocss/reset/tailwind.css'

const uiStore = useUiStore()
const userStore = useUserStore()

onMounted(async () => {
  uiStore.initTheme()
  if (import.meta.client) {
      await userStore.initLiff()
  }
})
</script>

<style>
body {
  @apply bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300;
  /* Ensure centering on desktop */
  display: flex;
  justify-content: center;
  min-height: 100vh;
}

#__nuxt {
  width: 100%;
  max-width: 28rem; /* max-w-md */
}
</style>
