import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import Sitemap from 'vite-plugin-sitemap'
import { curatedClosets } from './src/data/closets'

import fs from 'node:fs'

const dynamicRoutes = curatedClosets.map(c => `/closets/${c.id}`);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ensure-dist',
      enforce: 'post',
      generateBundle() {
        if (!fs.existsSync('dist')) {
          fs.mkdirSync('dist', { recursive: true });
        }
      }
    },
    Sitemap({
      hostname: 'https://www.aisthetic.shop',
      dynamicRoutes,
      generateRobotsTxt: true
    })
  ],
})
