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

// QR kiosk ekrani — 5175 portda ishlaydi.
// VITE_USER_APP_URL=auto — faqat kompyuterda (npm run dev): QR havolasi kompyuterning IP manziliga yo'naltiriladi.
// Vercel'da (npm run build) VITE_USER_APP_URL ga xodimlar saytining haqiqiy manzili yozilishi SHART.
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  const userAppUrl = env.VITE_USER_APP_URL

  if (command === 'build' && (!userAppUrl || userAppUrl === 'auto' || !/^https:\/\//.test(userAppUrl))) {
    throw new Error(
      '\n\nVITE_USER_APP_URL sozlanmagan.\n' +
      "Vercel → Project → Settings → Environment Variables bo'limiga xodimlar saytining manzilini yozing,\n" +
      'masalan: VITE_USER_APP_URL=https://fritto-user.vercel.app\n'
    )
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
