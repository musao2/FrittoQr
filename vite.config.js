import os from 'node:os'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Kompyuterning hozirgi Wi-Fi manzili (o'zgarsa ham har ishga tushganda qaytadan aniqlanadi)
function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) return a.address
    }
  }
  return 'localhost'
}

// Xodimlar saytining Vercel'dagi manzili (VITE_USER_APP_URL berilmasa shu ishlatiladi)
const DEFAULT_USER_APP_URL = 'https://fritto-user.vercel.app'

// QR kiosk ekrani — 5175 portda ishlaydi.
// VITE_USER_APP_URL=auto — faqat kompyuterda (npm run dev): QR havolasi kompyuterning IP manziliga yo'naltiriladi.
// Vercel'da (npm run build) VITE_USER_APP_URL — xodimlar saytining manzili (berilmasa DEFAULT_USER_APP_URL).
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  const userAppUrl = env.VITE_USER_APP_URL

  // Vercel'da VITE_USER_APP_URL berilmasa — xodimlar saytining asosiy manzili ishlatiladi
  if (command === 'build' && (!userAppUrl || userAppUrl === 'auto')) {
    process.env.VITE_USER_APP_URL = DEFAULT_USER_APP_URL
    console.warn(`\n  VITE_USER_APP_URL berilmagan — ${DEFAULT_USER_APP_URL} ishlatiladi\n`)
  } else if (command === 'build' && !/^https:\/\//.test(userAppUrl)) {
    throw new Error(`\n\nVITE_USER_APP_URL noto'g'ri: "${userAppUrl}". U https:// bilan boshlanishi kerak.\n`)
  }

  return {
    plugins: [react()],
    server: { port: 5175, host: true },
    define: {
      // Lokal IP faqat kompyuterda ishlatiladi — Vercel build'iga kirmaydi
      __LAN_USER_APP_URL__: JSON.stringify(command === 'build' ? '' : `https://${lanIp()}:5176`),
    },
  }
})
