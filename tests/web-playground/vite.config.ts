import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vue',
              test: /node_modules[\\/](?:vue|vue-router)(?:[\\/]|$)/,
              priority: 40,
            },
            {
              name: 'element-plus',
              test: /node_modules[\\/]element-plus(?:[\\/]|$)/,
              priority: 30,
            },
            {
              name: 'element-icons',
              test: /node_modules[\\/]@element-plus[\\/]icons-vue/,
              priority: 30,
            },
            {
              name: 'chart',
              test: /node_modules[\\/](?:chart\.js|@kurkle)(?:[\\/]|$)/,
              priority: 20,
            },
            {
              name: 'tiptap',
              test: /node_modules[\\/](?:@tiptap|prosemirror-|orderedmap|rope-sequence|w3c-keyname)/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              entriesAware: true,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
