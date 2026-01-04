<template>
  <div class="p-4 space-y-6 pb-20">
    <header class="text-center space-y-2">
       <div class="i-carbon-information-filled text-4xl text-teal-600 block mx-auto"></div>
       <h2 class="text-2xl font-bold">關於挑日子</h2>
       <p class="text-gray-500 text-sm">如何決定下一次的聚會時間？</p>
    </header>
    
    <div class="space-y-4">
       <!-- Rule 1 -->
       <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <h3 class="font-bold flex items-center gap-2 mb-2">
             <div class="bg-teal-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</div>
             開放填寫
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-300">
             每個月 <span class="font-bold text-teal-600">24號 ~ 30號</span> 開放填寫下個月的日期。
             只能選擇週末與國定假日。
          </p>
       </div>

       <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <h3 class="font-bold flex items-center gap-2 mb-2">
             <div class="bg-teal-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</div>
             如何投票
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-300">
             點擊 <span class="font-bold">O</span> 代表有空，<span class="font-bold">X</span> 代表沒空。
             系統會自動儲存您的選擇。
          </p>
       </div>

       <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <h3 class="font-bold flex items-center gap-2 mb-2">
             <div class="bg-teal-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</div>
             結果公佈
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-300">
             每月 30 號截止後，系統會統計最多人有空的日期（至少 3 人），並由管理員發布最終活動資訊。
          </p>
       </div>
    </div>
    
    <div class="text-center text-xs text-gray-400 mt-10">
       Designed for LINE Groups
    </div>
  </div>
</template>
