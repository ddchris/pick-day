import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  shortcuts: [
    ['btn', 'px-4 py-2 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
    ['icon-btn', 'text-[0.9em] inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600 !outline-none'],
  ],
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  rules: [
    ['animate-slide-up', { animation: 'slide-up 0.3s ease-out' }],
    ['animate-fade-in', { animation: 'fade-in 0.2s ease-out' }],
    ['animate-slide-down', { animation: 'slide-down 0.4s ease-out' }],
  ],
  theme: {
    animation: {
      keyframes: {
        'slide-up': '{ from { transform: translateY(100%); } to { transform: translateY(0); } }',
        'fade-in': '{ from { opacity: 0; } to { opacity: 1; } }',
        'slide-down': '{ from { transform: translateY(-100%); } to { transform: translateY(0); } }',
      },
    },
  },
})
