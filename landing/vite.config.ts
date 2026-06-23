import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Read the version from the root package.json
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/polimi-exam-calendar/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version)
  }
})
