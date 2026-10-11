#!/usr/bin/env node
// Talks directly to the reseller panel API (api_key only). No other backend involved.
//
//   iptv.mjs <server> credits
//   iptv.mjs <server> list
//   iptv.mjs <server> <1|3|6|12|demo> <package> <name...> [--yes]
//   iptv.mjs <server> renew <name|username> <1|3|6|12> [password] [--yes]
//
// Create and renew only print a PLAN unless --yes is passed.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const die = (msg) => {
  console.error(msg)
  process.exit(1)
}

if (Number(process.versions.node.split('.')[0]) < 18) die('Node 18+ is required.')

const DEFAULT_URL = 'https://activationpanel.ru/api/api.php'
const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOME_DIR = join(homedir(), '.config', 'iptv')
// Later entries win: the home file first, then the plugin folder (git-ignored).
const CONFIG_PATHS = [join(HOME_DIR, 'config.env'), join(PLUGIN_ROOT, 'config.env')]
const LINES_PATH = join(HOME_DIR, 'lines.json') // local history, used to renew by name

function readEnvFile(path) {
  const out = {}
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const i = t.indexOf('=')
      const value = t.slice(i + 1).trim()
      if (value) out[t.slice(0, i).trim()] = value
    }
  } catch {
    // file absent
  }
  return out
}

// Servers are declared as <NAME>_API_KEY (+ optional <NAME>_API_URL), e.g. TREX_API_KEY.
function loadServers() {
  const cfg = Object.assign({}, ...CONFIG_PATHS.map(readEnvFile))
  const servers = []
  for (const [key, value] of Object.entries(cfg)) {
    const m = key.match(/^(.+)_API_KEY$/)
    if (!m) continue
    servers.push({ name: m[1], apiKey: value, url: cfg[`${m[1]}_API_URL`] ?? DEFAULT_URL })
  }
  return servers
}

const argv = process.argv.slice(2)
const yes = argv.includes('--yes')
let urlArg
const positional = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--yes') continue
  if (a === '--url') {
    urlArg = argv[++i]
    continue
  }
  if (a.startsWith('--url=')) {
    urlArg = a.slice('--url='.length)
    continue
  }
  positional.push(a)
}
const [serverArg, ...rest] = positional
if (!serverArg) {
  die('Usage: iptv.mjs <server> credits | list | urls | show <name> | <duration> <package> <name> | renew <name> <duration> [--url <label|n|all>]')
}

const SUBS = { 1: 1, 3: 3, 6: 6, 12: 12, demo: 99 }

// Exact (case-insensitive) match wins; otherwise a unique substring match.
function pick(items, query, label, key) {
  const q = String(query ?? '').toLowerCase()
  const exact = items.filter((x) => key(x).toLowerCase() === q)
  const matches = exact.length ? exact : items.filter((x) => key(x).toLowerCase().includes(q))
  if (matches.length === 1 && q) return matches[0]
  const shown = matches.length ? matches : items
  die(
    `${matches.length ? 'Ambiguous' : 'No matching'} ${label} "${query}". Options:\n  ` +
      (shown.map(key).join('\n  ') || '(none configured)')
  )
}

const servers = loadServers()
if (!servers.length) {
  die(
    'No server configured. Add to config.env (plugin folder or ~/.config/iptv/):\n' +
      '  TREX_API_KEY=your-api-key\n' +
      `  TREX_API_URL=${DEFAULT_URL}   (optional)`
  )
}
const server = pick(servers, serverArg, 'server', (s) => s.name)

// urls.json: { "<server>": { "<label>": "http://host:port", ... } }. Plugin folder wins over home.
const URLS_PATHS = [join(HOME_DIR, 'urls.json'), join(PLUGIN_ROOT, 'urls.json')]
function loadUrls(serverName) {
  const merged = {}
  for (const path of URLS_PATHS) {
    try {
      const data = JSON.parse(readFileSync(path, 'utf8'))
      for (const [name, labels] of Object.entries(data)) {
        if (name.toLowerCase() === serverName.toLowerCase()) Object.assign(merged, labels)
      }
    } catch {
      // file absent or invalid JSON
    }
  }
  return Object.entries(merged)
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([label, v]) => ({ label, url: v.trim().replace(/\/+$/, '') }))
}
const urls = loadUrls(server.name)

// `defaultToMain`: use "main" (or the first URL) when --url is absent instead of asking.
function resolveUrls(arg, defaultToMain) {
  if (!urls.length) return []
  if (!arg) {
    if (urls.length === 1) return [urls[0]]
    if (defaultToMain) return [urls.find((u) => u.label.toLowerCase() === 'main') ?? urls[0]]
    console.log(`URL required. Which URL for ${server.name}?`)
    urls.forEach((u, i) => console.log(`  ${i + 1}  ${u.label}  ${u.url}`))
    console.log('Rerun the same command with --url <label|number|all>')
    process.exit(2)
  }
  if (arg.toLowerCase() === 'all') return urls
  const n = Number(arg)
  if (Number.isInteger(n) && n >= 1 && n <= urls.length) return [urls[n - 1]]
  const hit = urls.find((u) => u.label.toLowerCase() === arg.toLowerCase())
  if (hit) return [hit]
  die(`Unknown URL "${arg}". Options:\n  ${urls.map((u, i) => `${i + 1}  ${u.label}`).join('\n  ')}`)
}

function printLinks(username, password, chosen) {
  if (!chosen.length) {
    console.log('  (no URLs configured for this server in urls.json)')
    return
  }
  console.log('Credentials (username - password - server url):')
  for (const u of chosen) console.log(`  ${u.label}: ${username} - ${password} - ${u.url}`)
  console.log('M3U links:')
  for (const u of chosen) {
    console.log(`  ${u.label}: ${u.url}/get.php?username=${username}&password=${password}&type=m3u_plus&output=ts`)
  }
}
const labelOf = (chosen) => (chosen.length ? chosen.map((u) => u.label).join(',') : 'none')

async function call(params) {
  const qs = new URLSearchParams({ ...params, api_key: server.apiKey })
  let res
  try {
    res = await fetch(`${server.url}?${qs}`, { signal: AbortSignal.timeout(20000) })
  } catch (err) {
    die(`Cannot reach the ${server.name} API (${err.cause?.code ?? err.message}).`)
  }
  if (!res.ok) die(`${server.name} API HTTP error: ${res.status}`)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    die(`${server.name} API returned a non-JSON response.`)
  }
  const first = Array.isArray(data) ? data[0] : data
  if (first && (first.status === 'false' || first.status === false)) {
    die(`${server.name} API error: ${first.message ?? first.messasge ?? 'unknown error'}`)
  }
  return data
}
const one = (data) => (Array.isArray(data) ? data[0] : data)

function loadLines() {
  try {
    return JSON.parse(readFileSync(LINES_PATH, 'utf8'))
  } catch {
    return []
  }
}
function saveLines(lines) {
  mkdirSync(HOME_DIR, { recursive: true })
  writeFileSync(LINES_PATH, JSON.stringify(lines, null, 2), { mode: 0o600 })
}

async function creditsLine() {
  try {
    const r = one(await call({ action: 'reseller_info' }))
    return `credits: ${r.credits}`
  } catch {
    return 'credits: unavailable'
  }
}

// Find a line in the local history by name or username (exact first, then unique partial).
function findLine(query, passwordArg) {
  const history = loadLines().filter((l) => l.server.toLowerCase() === server.name.toLowerCase())
  const q = query.toLowerCase()
  const hits = history.filter((l) => l.name.toLowerCase() === q || l.username.toLowerCase() === q)
  const partial = hits.length ? hits : history.filter((l) => `${l.name} ${l.username}`.toLowerCase().includes(q))
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) {
    die(`Ambiguous line "${query}". Options:\n  ${partial.map((l) => `${l.name} / ${l.username}`).join('\n  ')}`)
  }
  if (passwordArg) return { name: query, username: query, password: passwordArg }
  die(
    `No line "${query}" in the local history for ${server.name}.\n` +
      'Pass the line password as an extra argument to use a line created elsewhere.'
  )
}

const [action, ...args] = rest

if (action === 'credits') {
  const r = one(await call({ action: 'reseller_info' }))
  console.log(`Server: ${server.name}`)
  console.log(`  reseller: ${r.username}  enabled: ${r.enabled}  credits: ${r.credits}`)
} else if (action === 'urls') {
  console.log(`Server: ${server.name}`)
  if (!urls.length) console.log('  (no URLs configured in urls.json)')
  urls.forEach((u, i) => console.log(`  ${i + 1}  ${u.label}  ${u.url}`))
} else if (!action || action === 'list') {
  const bouquets = await call({ action: 'bouquet' })
  console.log(`Server: ${server.name}`)
  console.log('Packages:')
  for (const b of bouquets) console.log(`  ${b.id}  ${b.name}`)
} else if (action === 'show') {
  const [query] = args
  if (!query) die('Usage: <server> show <name|username> [--url <label|number|all>]')
  const target = findLine(query)
  const chosen = resolveUrls(urlArg, true)
  console.log(`Line: ${server.name} | ${target.name} | package: ${target.packageName ?? '?'}`)
  printLinks(target.username, target.password, chosen)
} else if (action === 'renew') {
  const [query, dur, passwordArg] = args
  const sub = SUBS[dur]
  if (!query || !sub || sub === 99) die('Usage: <server> renew <name|username> <1|3|6|12> [password] [--url <label|number|all>]')
  const target = findLine(query, passwordArg)
  const chosen = resolveUrls(urlArg, true)
  console.log(
    `PLAN renew: ${server.name} | ${target.name} / ${target.username} | +${sub} month(s) | url: ${labelOf(chosen)} | ${await creditsLine()}`
  )
  if (!yes) process.exit(0)
  const r = one(await call({ action: 'renew', type: 'm3u', username: target.username, password: target.password, sub: String(sub) }))
  console.log(`Renewed. ${r.message ?? r.messasge ?? ''}`.trim())
  try {
    const info = one(await call({ action: 'device_info', username: target.username, password: target.password }))
    console.log(`  expires: ${info.expire}`)
  } catch {
    // device_info is best effort
  }
  printLinks(target.username, target.password, chosen)
} else {
  const sub = SUBS[action]
  if (!sub) die('Duration must be 1, 3, 6, 12 or demo.')
  const [pkg, ...nameParts] = args
  const name = nameParts.join(' ').trim()
  if (!pkg || !name) die('Usage: <server> <duration> <package> <name> --url <label|number|all>')
  const bouquets = await call({ action: 'bouquet' })
  const bouquet = pick(bouquets, pkg, 'package', (b) => b.name)
  // Resolved before anything is created, so a missing or bad --url never costs credits.
  const chosen = resolveUrls(urlArg, false)
  console.log(
    `PLAN create: ${server.name} | ${bouquet.name} (${bouquet.id}) | ${action === 'demo' ? 'demo' : `${sub} month(s)`} | name: ${name} | url: ${labelOf(chosen)} | ${await creditsLine()}`
  )
  if (!yes) process.exit(0)
  const r = one(await call({ action: 'new', type: 'm3u', sub: String(sub), pack: String(bouquet.id), note: name }))
  let username
  let password
  try {
    const p = new URL(r.url).searchParams
    username = p.get('username') ?? undefined
    password = p.get('password') ?? undefined
  } catch {
    // url missing or relative
  }
  if (username && password) {
    const lines = loadLines()
    lines.push({
      server: server.name,
      name,
      username,
      password,
      packageName: bouquet.name,
      sub,
      userId: r.user_id,
      createdAt: new Date().toISOString(),
    })
    saveLines(lines)
  }
  console.log(`Created. ${r.message ?? ''}`.trim())
  if (username && password) {
    printLinks(username, password, chosen)
  } else {
    console.log('  username/password not found in the response. Raw url field:', r.url ?? '(none)')
  }
}
