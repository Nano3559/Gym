// Preloaded in each test process. Vite SSR may load .env.local; explicit empty
// process values take precedence. Never print environment values.
import { syncBuiltinESMExports } from 'node:module'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
for (const name of Object.keys(process.env)) {
  if (/^(VITE_|SUPABASE_|GEMINI_|OPENAI_)/.test(name)) process.env[name] = ''
}
process.env.TZ = 'UTC'
const denied = () => { throw new Error('CI_OFFLINE: acceso de red no simulado bloqueado') }
globalThis.fetch = denied
http.request = http.get = https.request = https.get = denied
const connect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  // Node normalizes connect arguments to an array in some call paths.
  // Permit named IPC pipes only; all TCP (including local services) is blocked.
  const option = Array.isArray(args[0]) ? args[0][0] : args[0]
  if (!(typeof option === 'string' || option?.path)) return denied()
  return connect.apply(this, args)
}
syncBuiltinESMExports()
