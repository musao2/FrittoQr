import { useEffect, useRef, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { LuWifiOff, LuCircleAlert, LuLogIn, LuLogOut, LuScanLine, LuMail, LuLock, LuEye, LuEyeOff } from 'react-icons/lu'
import { config, isConfigured, issueToken, getRecent, getSession, login, logout } from './supabase'
import { LogoMark } from './components/Logo'

const ROTATE_SECONDS = 15   // QR har necha soniyada yangilanadi
const RECENT_POLL_MS = 4000 // "oxirgi kelganlar" ro'yxati qancha tez yangilanadi
const TZ = 'Asia/Tashkent'

const fmtTime = (d, withSeconds = false) =>
  new Date(d).toLocaleTimeString('uz-UZ', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}),
  })

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

// Brauzerlar o'zbekcha sanani noto'g'ri chiqaradi, shuning uchun qo'lda yozamiz
const fmtDate = (d) => {
  const t = new Date(new Date(d).toLocaleString('en-US', { timeZone: TZ }))
  return `${WEEKDAYS[t.getDay()]}, ${t.getDate()}-${MONTHS[t.getMonth()]}`
}

export default function App() {
  const [session, setSession] = useState(() => (isConfigured ? getSession() : null))
  if (!isConfigured) return <SetupScreen />
  if (!session) return <LoginScreen onLogin={setSession} />
  return <Kiosk session={session} onLogout={() => setSession(null)} />
}

function Kiosk({ session, onLogout }) {
  const [qrUrl, setQrUrl]       = useState(null) // QR ichidagi havola
  const [secondsLeft, setSecondsLeft] = useState(ROTATE_SECONDS)
  const [error, setError]       = useState(null) // 'setup' | 'network' | 'server' | null
  const [errorText, setErrorText] = useState('')
  const [recent, setRecent]     = useState([])
  const [flash, setFlash]       = useState(null)
  const [now, setNow]           = useState(new Date())
  const lastTopKey = useRef(null)

  // Yangi QR olish
  const refreshQr = useCallback(async () => {
    try {
      const { qr_token } = await issueToken(session)
      setQrUrl(`${config.userAppUrl}/scan?t=${qr_token}`)
      setError(null)
    } catch (err) {
      const msg = String(err?.message || '')
      // Parol o'zgartirilgan yoki kirish bekor qilingan — qayta kirish kerak
      if (msg.includes('KIOSK_AUTH_FAILED') || msg.includes('invalid input syntax for type uuid')) {
        await logout(session).catch(() => {})
        onLogout()
        return
      }
      else if (err?.code === 'PGRST202' || msg.includes('Could not find the function')) setError('setup')
      // Faqat so'rov umuman yetib bormaganda — internet muammosi
      else if (err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(msg)) setError('network')
      // Boshqa hollarda — haqiqiy sababni ekranga chiqaramiz
      else { setError('server'); setErrorText(msg || String(err)) }
      console.error('QR olishda xato:', err)
    } finally {
      setSecondsLeft(ROTATE_SECONDS)
    }
  }, [session, onLogout])

  useEffect(() => {
    refreshQr()
    const id = setInterval(refreshQr, ROTATE_SECONDS * 1000)
    return () => clearInterval(id)
  }, [refreshQr])

  // Soat va QR teskari sanog'i
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date())
      setSecondsLeft(s => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Oxirgi kelgan/ketganlar + yangi skanerlashda katta xabar
  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const rows = await getRecent(session)
        if (!alive) return
        setRecent(rows)
        const top = rows[0]
        const key = top ? `${top.full_name}|${top.action}|${top.happened_at}` : null
        if (lastTopKey.current !== null && key && key !== lastTopKey.current) {
          setFlash(top)
          setTimeout(() => alive && setFlash(null), 4000)
        }
        lastTopKey.current = key ?? ''
      } catch {
        // tarmoq xatosi QR qismida ko'rsatiladi
      }
    }
    poll()
    const id = setInterval(poll, RECENT_POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [session])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Yuqori qism */}
      <header className="h-20 px-8 bg-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LogoMark size={40} />
          <div className="leading-tight">
            <p className="text-lg font-bold text-slate-900 tracking-[0.08em]">FRITTO</p>
            <p className="text-sm text-slate-500">Davomat</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right leading-tight">
            <p className="text-3xl font-semibold text-slate-900 tabular-nums">{fmtTime(now)}</p>
            <p className="text-sm text-slate-500">{fmtDate(now)}</p>
          </div>
          <button
            onClick={async () => {
              if (!window.confirm('QR ekrandan chiqasizmi? Qayta kirish uchun email va parol kerak bo\'ladi.')) return
              await logout(session)
              onLogout()
            }}
            className="p-2 text-slate-400 hover:text-slate-900 cursor-pointer"
            title="Chiqish"
            aria-label="Chiqish"
          >
            <LuLogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 p-8">
        {/* QR */}
        <section className="flex flex-col items-center justify-center text-center">
          <h1 className="text-3xl font-semibold text-slate-900">Kelganda va ketganda skanerlang</h1>
          <p className="text-lg text-slate-500 mt-2">Telefon kamerasini oching va QR kodga yaqin tuting</p>

          <div className="relative mt-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="w-[min(58vh,80vw)] max-w-[560px] aspect-square">
              {qrUrl ? (
                <QRCodeSVG
                  value={qrUrl}
                  size={560}
                  level="M"
                  marginSize={1}
                  fgColor="#0f172a"
                  bgColor="#ffffff"
                  title="Davomat uchun QR kod"
                  className={`w-full h-full transition-opacity ${error ? 'opacity-15' : ''}`}
                />
              ) : (
                <div className="w-full h-full bg-slate-100 rounded-lg animate-pulse" />
              )}
            </div>

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
                {error === 'network' ? <LuWifiOff size={48} className="text-amber-600" /> : <LuCircleAlert size={48} className="text-red-600" />}
                <p className="text-xl font-semibold text-slate-900">
                  {{ setup: 'Baza hali sozlanmagan', network: "Supabase bilan aloqa yo'q", server: 'Serverda xatolik' }[error]}
                </p>
                <p className="text-base text-slate-600 max-w-sm">
                  {{
                    setup: "Supabase → SQL Editor'da 002_qr_attendance.sql faylini ishga tushiring.",
                    network: "Supabase serveriga ulanib bo'lmadi. Qayta urinilmoqda...",
                    server: 'Qayta urinilmoqda. Xato davom etsa, quyidagi matnni administratorga yuboring:',
                  }[error]}
                </p>
                {error === 'server' && (
                  <code className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 max-w-sm break-words">{errorText}</code>
                )}
              </div>
            )}
          </div>

          {/* Teskari sanoq */}
          <div className="mt-6 w-full max-w-md">
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-[width] duration-1000 ease-linear"
                style={{ width: `${(secondsLeft / ROTATE_SECONDS) * 100}%` }}
              />
            </div>
            <p className="text-sm text-slate-500 mt-2">QR kod {secondsLeft} soniyadan keyin yangilanadi</p>
          </div>
        </section>

        {/* O'ng tomon */}
        <aside className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <p className="text-base font-semibold text-slate-900 mb-4">Qanday foydalaniladi?</p>
            <ol className="space-y-4">
              {[
                'Telefon kamerasini oching',
                'QR kodga yaqin tuting (2 metrdan yaqin)',
                "Ochilgan sahifada «Keldi» yoki «Ketdi» chiqadi",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-base text-slate-700 pt-0.5">{t}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <p className="text-base font-semibold text-slate-900 mb-3">Oxirgi kelgan va ketganlar</p>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">Bugun hali hech kim skanerlamagan</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-sm text-slate-900 truncate">{r.full_name}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span className={r.action === 'in' ? 'badge-green' : 'badge-gray'}>
                        {r.action === 'in' ? 'Keldi' : 'Ketdi'}
                      </span>
                      <span className="text-sm text-slate-500 tabular-nums">{fmtTime(r.happened_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>

      {/* Yangi skanerlashda katta xabar */}
      {flash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 animate-fade-overlay">
          <div className={`rounded-2xl px-12 py-10 text-center shadow-2xl ${flash.action === 'in' ? 'bg-green-600' : 'bg-slate-800'}`}>
            {flash.action === 'in' ? <LuLogIn size={56} className="mx-auto text-white" /> : <LuLogOut size={56} className="mx-auto text-white" />}
            <p className="text-4xl font-bold text-white mt-4">{flash.full_name}</p>
            <p className="text-2xl text-white/90 mt-2">
              {flash.action === 'in' ? 'Xush kelibsiz! Ishga keldingiz' : "Xayr! Ishdan ketdingiz"} · {fmtTime(flash.happened_at)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

const LOGIN_ERRORS = {
  INVALID_LOGIN: "Email yoki parol noto'g'ri",
  LOCKED: "Ko'p marta noto'g'ri kiritildi. 5 daqiqadan keyin qayta urinib ko'ring.",
}

function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow]         = useState(false)
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!email || !password) return setError('Email va parolni kiriting')
    setBusy(true)
    setError('')
    try {
      onLogin(await login(email, password))
    } catch (err) {
      const msg = String(err?.message || '')
      const code = Object.keys(LOGIN_ERRORS).find(c => msg.includes(c))
      if (code) setError(LOGIN_ERRORS[code])
      else if (err?.code === 'PGRST202' || msg.includes('Could not find the function'))
        setError("Supabase'da 006_kiosk_login.sql fayli hali ishga tushirilmagan")
      else if (err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(msg))
        setError("Supabase serveriga ulanib bo'lmadi. Qayta urinib ko'ring.")
      else setError(`Xatolik: ${msg || err}`)
      console.error('Kirishda xato:', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex mb-3"><LogoMark size={48} /></div>
          <h1 className="text-xl font-bold text-slate-900 tracking-[0.08em]">FRITTO</h1>
          <p className="text-sm text-slate-500 mt-1">QR davomat ekrani</p>
        </div>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">QR ekranga kirish</h2>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <LuCircleAlert size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="kiosk-email" className="label">Email</label>
            <div className="relative">
              <LuMail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="kiosk-email" type="email" autoComplete="username"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="fritto@fritto.uz" className="input-field pl-9"
              />
            </div>
          </div>

          <div>
            <label htmlFor="kiosk-password" className="label">Parol</label>
            <div className="relative">
              <LuLock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="kiosk-password" type={show ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Parol" className="input-field pl-9 pr-10"
              />
              <button
                type="button" onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label={show ? 'Parolni yashirish' : "Parolni ko'rsatish"}
              >
                {show ? <LuEyeOff size={16} /> : <LuEye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Kirish
          </button>
          <p className="text-xs text-slate-400 text-center">Email va parolni admin panel → Sozlamalar bo'limida o'zgartirish mumkin</p>
        </form>
      </div>
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg bg-white border border-slate-200 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <LuScanLine size={28} className="text-emerald-600" />
          <h1 className="text-xl font-semibold text-slate-900">QR kiosk sozlanmagan</h1>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Loyiha papkasidagi <code className="bg-slate-100 px-1 rounded">.env</code> faylida quyidagilar to'ldirilishi kerak:
        </p>
        <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 overflow-x-auto">{`VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_USER_APP_URL=https://fritto-user.vercel.app`}</pre>
      </div>
    </div>
  )
}
