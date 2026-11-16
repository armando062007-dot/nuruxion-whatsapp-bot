import 'dotenv/config'
import { narrativeLine } from './narrative.mjs'
import { COMMANDS as CHRISTMAS_COMMANDS, runChristmas, active as christmasActive, winterFlavor } from './christmas.mjs'
import { missionView, recordReward, recordDungeon, dungeonView, journeyView, dailyView, inventoryView } from './experience.mjs'
import { createCommunityPromoter } from './community-admin.mjs'
import { ecoRoto } from './eco-roto.mjs'
import { createMusicSystem } from './music-system.mjs'
import { supplies, refreshSupplyStock, rewardWithSupply } from './kingdom-supplies.mjs'
import { accountId, sameAccount, createIngress, createQuestionLimiter, collectBounded, whatsappMediaUrl } from './security.mjs'
import fs from 'node:fs/promises'
import { writeFileSync, renameSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { Boom } from '@hapi/boom'
import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadContentFromMessage,
  jidNormalizedUser,
  useMultiFileAuthState
} from '@whiskeysockets/baileys'
import NodeCache from 'node-cache'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import { all as mathFunctions, create as createMath } from 'mathjs'

const ALLOWED_GROUPS = new Set((process.env.ALLOWED_GROUP_JIDS || '').split(',').map(value => value.trim()).filter(value => /^\d+(?:-\d+)?@g\.us$/.test(value)))
const isAllowedGroup = chat => ALLOWED_GROUPS.has(chat)

const PREFIX = process.env.PREFIX || '?'
const ffmpegPath = process.env.MUSIC_FFMPEG || 'ffmpeg'
const STAFF_APPLICATION_FORM_URL = process.env.STAFF_APPLICATION_FORM_URL?.trim() || ''
const STAFF_APPLICATION_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const RESTRICTED_COMMANDS_GROUP_NAME = process.env.RESTRICTED_COMMANDS_GROUP_NAME || 'Comandos-Bot'
const ACTIVITY_GROUP_MATCH = process.env.ACTIVITY_GROUP_MATCH || 'nuruxion'
const DONATION_PAYPAL_URL = (process.env.DONATION_PAYPAL_URL || '').replace(/\/$/, '')
const DONATION_MIN_USD = 1
const DONATION_MAX_USD = 1000
const DONATION_PENDING_MS = 15 * 60 * 1000
const ACTIVITY_EXCLUDED_NUMBERS = new Set((process.env.ACTIVITY_EXCLUDED_NUMBERS || '').split(',').map(value => value.replace(/\D/g, '')).filter(Boolean))
const GENERAL_CHAT_GROUP_NAME = process.env.GENERAL_CHAT_GROUP_NAME || 'General'
const NIGHT_CHAT_GROUP_NAME = process.env.NIGHT_CHAT_GROUP_NAME || 'chat nocturno'
const NURUXION_AI_URL = (process.env.NURUXION_AI_URL || 'http://127.0.0.1:3217').replace(/\/$/, '')
const NURUXION_AI_TOKEN = process.env.NURUXION_AI_TOKEN || ''
const EXTERNAL_KNOWLEDGE_ENABLED = process.env.ALLOW_EXTERNAL_KNOWLEDGE === '1'
const EXTERNAL_AI_ENABLED = process.env.ALLOW_EXTERNAL_AI === '1'
const NURUXION_AI_MODEL = process.env.NURUXION_AI_MODEL || 'onnx-community/Qwen2.5-1.5B-Instruct'
const AI_MAX_OUTPUT_TOKENS = Math.max(300, Math.min(1200, Number(process.env.AI_MAX_OUTPUT_TOKENS) || 700))

// ===================================================================
// SERVIDOR WEB (healthcheck del contenedor / assets estaticos)
// ===================================================================
const RESTRICTED_COMMANDS = new Set(['sugerencia', 'sugerencias', 'kiss', 'beso', 'musica', 'play', 'saldo', 'balance', 'bal', 'perfil', 'profile', 'misiones', 'logros', 'reputacion', 'jefe', 'changetext', 'frase', 'dep', 'deposito', 'retirar', 'withdraw', 'rob', 'work', 'trabajar', 'blackjack', 'bj', 'pedir', 'plantarse', 'doblar', 'comprar', 'vender', 'empresas', 'empresa', 'tienda', 'inventario', 'daily', 'diario', 'top', 'ricos', 'enviar', 'transferir', 'slots', 'tragamonedas', 'prestamo', 'pagar', 'deuda', 'fianza', 'inversiones', 'explore', 'explorar', 'mine', 'mina', 'mazmorra', 'magia', 'habilidad', 'evento', 'atacar', 'saltar', 'salir', 'desarmar', 'esquivar', 'liberar', 'ignorar', 'adelante', 'avanzar', 'izquierda', 'derecha', 'guardar', 'abrir', 'seguir', 'pelear', 'huir', 'curar', 'comprarvida', 'comerciar', 'repararportal', 'romper', 'si', 'no', 'rojo', 'negro'])
const SESSION_DIR = path.resolve(process.env.SESSION_DIR || './session')
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data')

const MEMBERSHIP_DATA_DIR = path.join(DATA_DIR, 'membership')
const MEMBERSHIP_GROUPS_DIR = path.join(MEMBERSHIP_DATA_DIR, 'groups')
const GROUP_SCOPES_FILE = path.join(MEMBERSHIP_DATA_DIR, 'group-scopes.json')
const MEMBERSHIP_PLANS_FILE = path.join(MEMBERSHIP_DATA_DIR, 'plans.json')
const STATE_FILE = path.join(DATA_DIR, 'state.json')
const CONNECTION_METHOD = (process.env.CONNECTION_METHOD || 'qr').toLowerCase()
const PHONE_NUMBER = (process.env.PHONE_NUMBER || '').replace(/\D/g, '')
const OWNER_NUMBERS = (process.env.OWNER_NUMBERS || '')
  .split(',')
  .map(number => number.replace(/\D/g, ''))
  .filter(Boolean)
const MAX_WARNS = Number(process.env.MAX_WARNS || 3)
const DEFAULT_WELCOME_MESSAGE = `╭━━━━━━━━━━━━━━━━━━━━━━╮
🌙 ✦ *¡BIENVENIDO/A!* ✦ 🌙
╰━━━━━━━━━━━━━━━━━━━━━━╯

✨ ¡Hey, @user!
Nos alegra muchísimo tenerte entre nosotros.

┏━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🏰 *BIENVENIDO AL CLAN*
┗━━━━━━━━━━━━━━━━━━━━━━┛

📜 *Antes de comenzar:*
╰➤ Revisa las reglas del grupo.
╰➤ Respeta a todos los miembros.
╰➤ Convive y pásala bien.
╰➤ Si necesitas ayuda, contacta al staff.

🌟 Ahora formas parte de nuestra comunidad.
Esperamos verte participar, conocer gente y disfrutar junto a nosotros.

╭─────────────── ✦ ───────────────╮
💫 *¡QUE COMIENCE LA AVENTURA!* 💫
╰─────────────── ✦ ───────────────╯

🌙 Bienvenido/a, @user.`
const WELCOME_MESSAGE = (process.env.WELCOME_MESSAGE || DEFAULT_WELCOME_MESSAGE).replaceAll('\\n', '\n')
const WELCOME_IMAGE_PATH = path.resolve(process.env.WELCOME_IMAGE_PATH || './assets/nurxion.png')
const TAG_IMAGE_PATH = path.resolve(process.env.TAG_IMAGE_PATH || process.env.WELCOME_IMAGE_PATH || './assets/nurxion.png')
const MUSIC_CATALOG_PATH = path.resolve(process.env.MUSIC_CATALOG_PATH || './config/authorized-music.json')
const MUSIC_DIR = path.resolve(process.env.MUSIC_DIR || './music')
const DEFAULT_MUSIC_CATALOG = [
  { id: 'hoja-de-te', title: 'Hoja de Té', artist: 'Manu Beker', file: 'Manu Beker - Hoja de Te.mp3', tags: ['pop', 'pop en español', 'español'] },
  { id: 'carita-bonita', title: 'Carita Bonita', artist: 'Urbøi', file: 'Urboi - Carita Bonita.mp3', tags: ['latino', 'pop', 'español'] },
  { id: 'encore-un-peu', title: 'Encore un peu', artist: 'Lakali', file: 'Lakali - Encore un peu.mp3', tags: ['pop francés', 'french pop', 'francés'] }
]
const MUSIC_MAINTENANCE_MODE = false
const MUSIC_MAINTENANCE_MESSAGE = `╭━━━━━━━━━━━━━━━━━━━━━━╮
🎵 ✦ *MÚSICA — PRÓXIMAMENTE* ✦ 🎵
╰━━━━━━━━━━━━━━━━━━━━━━╯

😔 Lo siento, estamos añadiendo el catalogo de musica.

⏳ Vuelve a intentarlo mas adelante.
🙏 ¡Gracias por tu paciencia!`
const ECONOMY_FILE = path.join(DATA_DIR, 'economy.json')
const CURRENCY_NAME = 'Nuruxions'
const CURRENCY_SYMBOL = '🪙'
const STARTING_BALANCE = 1000
const ROB_SUCCESS_RATE = 0.45
const ROB_MIN_PERCENT = 0.10
const ROB_MAX_PERCENT = 0.30
const ROB_FINE_MIN_PERCENT = 0.05
const ROB_FINE_MAX_PERCENT = 0.15
const ROB_COOLDOWN_MS = 60 * 60 * 1000
const ROB_MIN_WALLET = 50
const WORK_COOLDOWN_MS = 1 * 60 * 1000
const WORK_USAGE_WINDOW_MS = 6 * 60 * 60 * 1000
const WORK_MAX_USES = 20
const WORK_MIN_REWARD = 80
const WORK_MAX_REWARD = 220
const WORK_JOBS = [
  'Repartiste pedidos por la ciudad y terminaste la ruta justo a tiempo',
  'Ayudaste en una mudanza y rescataste un mueble que casi cae por las escaleras',
  'Atendiste un turno completo en la cafetería más concurrida del reino',
  'Terminaste un encargo de programación para un comerciante muy exigente',
  'Pasaste el día pescando y vendiste una captura especialmente buena',
  'Diste clases particulares y tu estudiante por fin entendió la lección'
]

const HALLOWEEN_WORK_JOBS = [
  '🎃 Clasificaste calabazas encantadas; una intentó morderte, pero terminaste el turno con todos los dedos',
  '👻 Cazaste fantasmas traviesos en una posada y encerraste sus lamentos dentro de tres frascos',
  '🕯️ Reparaste los faroles malditos del cementerio mientras algo caminaba detrás de ti',
  '🧪 Preparaste pociones para la bruja del bosque; ninguna explotó... demasiado',
  '🍬 Repartiste dulces entre las casas embrujadas y sobreviviste a todos sus trucos',
  '🦇 Limpiaste la torre de murciélagos del castillo y encontraste monedas bajo sus nidos',
  '⚰️ Ayudaste al sepulturero en el turno nocturno; una tumba quedó abierta, pero decidiste no preguntar',
  '🕸️ Decoraste la mansión abandonada con telarañas auténticas y convenciste a las arañas de cooperar',
  '🔮 Transportaste un espejo embrujado sin mirar tu reflejo ni una sola vez',
  '🐺 Vigilaste las murallas durante la luna llena y ahuyentaste a una criatura del bosque'
]

const CHRISTMAS_WORK_JOBS = [
  '🎁 Empacaste regalos en el taller real y lograste que ninguno terminara en el reino equivocado',
  '🦌 Cuidaste a los renos mágicos; uno se escapó, pero regresó siguiendo el olor de las galletas',
  '🎄 Decoraste el gran árbol de Nuruxion y colocaste la estrella sin caer de la escalera',
  '🍪 Horneaste galletas para los viajeros del reino y defendiste la última bandeja de unos duendes hambrientos',
  '❄️ Retiraste nieve encantada de los caminos antes de que congelara las puertas de la aldea',
  '🔔 Reparaste las campanas del castillo y su sonido se escuchó hasta el último rincón del reino',
  '🧸 Fabricaste juguetes en el taller y diste vida accidentalmente a uno durante unos minutos',
  '☕ Serviste chocolate caliente en la plaza mientras una nevada cubría los tejados',
  '✨ Colgaste luces mágicas por toda la avenida principal sin provocar ningún cortocircuito arcano',
  '🛷 Entregaste provisiones navideñas en trineo y regresaste antes de que comenzara la tormenta'
]

function currentWorkSeason(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'America/Mexico_City'
  }).formatToParts(date)
  const month = Number(parts.find(part => part.type === 'month')?.value || 0)
  const day = Number(parts.find(part => part.type === 'day')?.value || 0)

  if (christmasActive(date.getTime())) {
    return { name: 'Navidad', emoji: '🎄', jobs: CHRISTMAS_WORK_JOBS }
  }
  return { name: null, emoji: '💼', jobs: WORK_JOBS }
}

const WORK_MESSAGE_VARIANTS = {
  normal: {
    titles: ['💼 *JORNADA COMPLETADA*', '🧰 *ENCARGO TERMINADO*', '📋 *MISIÓN DE TRABAJO CUMPLIDA*', '🏙️ *UN DÍA PRODUCTIVO EN NURUXION*'],
    payments: ['Tu esfuerzo fue recompensado con', 'El cliente quedó satisfecho y te pagó', 'Después de una larga jornada recibiste', 'Guardas en tu monedero la recompensa de'],
    farewells: ['☀️ Terminas cansado, pero con la satisfacción de un trabajo bien hecho.', '🏠 Regresas a casa mientras la ciudad continúa con su ajetreo.', '⭐ Tu reputación como trabajador sigue creciendo.', '🛠️ Otro encargo completado sin dejar asuntos pendientes.']
  },
  Halloween: {
    titles: ['🎃 *TURNO ENTRE SOMBRAS* 🎃', '👻 *ENCARGO DE LA NOCHE EMBRUJADA* 👻', '🕯️ *TRABAJO BAJO LA LUNA MALDITA* 🕯️', '🦇 *JORNADA DE HALLOWEEN* 🦇', '💀 *CONTRATO DEL MÁS ALLÁ* 💀'],
    payments: ['Entre susurros y sombras lograste reunir', 'Una bolsa de monedas apareció frente a ti con', 'El contratista espectral te entregó', 'Sobreviviste al turno y reclamaste', 'La oscuridad aceptó tu trabajo y te concedió'],
    farewells: ['🌙 La niebla se cierra tras de ti... por ahora.', '👁️ Algo continúa observándote desde la oscuridad.', '🕸️ Escapas antes de que la medianoche cobre otra víctima.', '🦉 Un búho anuncia que tu turno ha terminado.', '🚪 La puerta embrujada se cierra sola a tus espaldas.']
  },
  Navidad: {
    titles: ['🎄 *JORNADA DE NAVIDAD* 🎄', '🎁 *ENCARGO DEL TALLER INVERNAL* 🎁', '❄️ *MISIÓN BAJO LA NIEVE* ❄️', '🔔 *TRABAJO DE LA TEMPORADA FESTIVA* 🔔', '🛷 *ENTREGA ESPECIAL DEL REINO* 🛷'],
    payments: ['Por llevar alegría al reino recibiste', 'El taller real agradeció tu ayuda con', 'Entre campanas y copos de nieve ganaste', 'Tu buen trabajo navideño fue recompensado con', 'Una bolsa envuelta con un lazo dorado contenía'],
    farewells: ['✨ El espíritu navideño ilumina tu camino de regreso.', '❄️ La nieve borra tus huellas mientras vuelves a casa.', '🔔 Las campanas celebran otro encargo completado.', '🎄 Las luces del reino brillan un poco más gracias a ti.', '☕ Terminas el día junto al fuego con una bebida caliente.']
  }
}

const WORK_RARE_EVENTS = {
  normal: [
    '🌟 El cliente quedó tan satisfecho que añadió una propina extraordinaria',
    '📦 Encontraste una recompensa olvidada y su dueño te permitió conservarla',
    '🏅 Tu trabajo llamó la atención del gremio y recibiste un bono de excelencia'
  ],
  Halloween: [
    '🕯️ Una vela espectral reveló una bolsa de monedas escondida',
    '🎃 La calabaza dorada despertó y te concedió una recompensa adicional',
    '👻 Un fantasma agradecido dejó un tesoro antes de desaparecer'
  ],
  Navidad: [
    '🎁 Encontraste un regalo extra con tu nombre debajo del árbol',
    '🦌 Un reno mágico dejó caer una bolsa de monedas brillantes',
    '⭐ El taller real premió tu esfuerzo con un aguinaldo especial'
  ]
}

const workMessageMemory = new Map()

function differentWorkOption(options, previous) {
  const available = options.length > 1 ? options.filter(option => option !== previous) : options
  return available[Math.floor(Math.random() * available.length)]
}

function createWorkPresentation(senderJid, season) {
  const key = season.name || 'normal'
  const variants = WORK_MESSAGE_VARIANTS[key] || WORK_MESSAGE_VARIANTS.normal
  const previous = workMessageMemory.get(senderJid) || {}
  const presentation = {
    job: differentWorkOption(season.jobs, previous.job),
    title: differentWorkOption(variants.titles, previous.title),
    payment: differentWorkOption(variants.payments, previous.payment),
    farewell: differentWorkOption(variants.farewells, previous.farewell)
  }
  workMessageMemory.set(senderJid, presentation)
  if (workMessageMemory.size > 500) workMessageMemory.clear()
  return presentation
}

const BLACKJACK_MIN_BET = 10

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000
const DAILY_MIN_REWARD = 300
const DAILY_MAX_REWARD = 600

const TRANSFER_MIN_AMOUNT = 10

const SLOTS_MIN_BET = 10
const SLOTS_SYMBOLS = [
  { symbol: '🍒', weight: 35, payout: 2 },
  { symbol: '🍋', weight: 30, payout: 3 },
  { symbol: '🔔', weight: 20, payout: 5 },
  { symbol: '💎', weight: 10, payout: 10 },
  { symbol: '7️⃣', weight: 5, payout: 25 }
]

function drawSlotSymbol() {
  const totalWeight = SLOTS_SYMBOLS.reduce((sum, s) => sum + s.weight, 0)
  let roll = Math.random() * totalWeight
  for (const entry of SLOTS_SYMBOLS) {
    if (roll < entry.weight) return entry
    roll -= entry.weight
  }
  return SLOTS_SYMBOLS[0]
}

const LOAN_MAX_AMOUNT = 1000000
const LOAN_BAIL_MULTIPLIER = 3
const JAIL_RELEASE_NUMBERS = (process.env.JAIL_RELEASE_NUMBERS || '').split(',').map(value => value.replace(/\D/g, '')).filter(Boolean)


// ===================================================================
// ECONOMIA: CARCEL Y PRESTAMOS - helpers (ver tambien el bloque de
// comandos '?prestamo/?pagar/?fianza/?excarcelar/?deuda' mas abajo)
// ===================================================================
function isJailReleaseAuthorized(message, sender) {
  if (message?.key?.fromMe) return true
  const candidates = [message?.key?.participantAlt, message?.participantAlt, message?.key?.participant, message?.participant, sender]
  return candidates.some(candidate => {
    if (!candidate) return false
    const digits = jidNormalizedUser(candidate).split('@')[0].split(':')[0].replace(/\D/g, '')
    return JAIL_RELEASE_NUMBERS.includes(digits)
  })
}
const LOAN_TOLERANCE_DAYS = 2
const LOAN_INTEREST_RATE = 0.05
const LOAN_MIN_PAY_DAYS = 3
const LOAN_MAX_PAY_DAYS = 30
const LOAN_MIN_JAIL_DAYS = 1
const LOAN_MAX_JAIL_DAYS = 5

function computeLoanJailDays(owed) {
  const ratio = Math.min(1, Math.max(0, owed / LOAN_MAX_AMOUNT))
  const days = LOAN_MIN_JAIL_DAYS + ratio * (LOAN_MAX_JAIL_DAYS - LOAN_MIN_JAIL_DAYS)
  return Math.min(LOAN_MAX_JAIL_DAYS, Math.max(LOAN_MIN_JAIL_DAYS, Math.round(days)))
}

function computeLoanPayDays(amount) {
  const ratio = Math.min(1, Math.max(0, amount / LOAN_MAX_AMOUNT))
  const days = LOAN_MIN_PAY_DAYS + ratio * (LOAN_MAX_PAY_DAYS - LOAN_MIN_PAY_DAYS)
  return Math.min(LOAN_MAX_PAY_DAYS, Math.max(LOAN_MIN_PAY_DAYS, Math.round(days)))
}

const ECO_ROTO_SHOP_ITEMS = [
  ...supplies,
  { number: 14, id: 'brujula_segunda_huella', emoji: '🧭', name: 'Brújula de la Segunda Huella', category: 'expedicion', price: 6900, description: 'Marca un cruce en Eco Roto y consulta cómo regresar por tu ruta. No teletransporta.' },
  { number: 15, id: 'pacto_ultima_antorcha', emoji: '🕯️', name: 'Pacto de la Última Antorcha', category: 'expedicion', price: 9775, description: 'Envía la mitad de los hallazgos al refugio una vez por expedición. Se recuperan al salir con el encargo cumplido.' },
  { number: 16, id: 'sello_cronista', emoji: '📜', name: 'Sello de Cronista', category: 'expedicion', price: 5175, description: 'Guarda la crónica de tu última expedición, con la ruta, los jefes vencidos y los hallazgos extraídos.' },
  { number: 17, id: 'tinta_heraldo', emoji: '🖋️', name: 'Tinta de Heraldo', category: 'coleccion', price: 3450, description: 'Nombra tu expedición de Eco Roto y deja ese nombre en su crónica. No modifica tus estadísticas.' },
  { number: 18, id: 'lente_del_reverso', emoji: '🔍', name: 'Lente del Reverso', category: 'expedicion', price: 5750, description: 'Examina una trampa por expedición para conocer sus consecuencias antes de elegir. No responde acertijos.' },
  { number: 19, id: 'estuche_de_nacar', emoji: '🧳', name: 'Estuche de Nácar', category: 'expedicion', price: 8050, description: 'Protege un objeto extraño ante una derrota con punto de control. Todavía debes salir para conservarlo.' },
  { number: 20, id: 'salvoconducto_de_hilo', emoji: '🗝️', name: 'Salvoconducto de Hilo', category: 'expedicion', price: 9200, description: 'Abre un paso de servicio del Santuario a la Cisterna una vez por expedición. No cambia el desafío de Isera.' }
]
const SHOP_ITEMS = [
  {
    number: 1,
    id: 'escudo_35',
    emoji: '🛡️',
    name: 'Escudo Anti-Robo I',
    category: 'escudo',
    price: 750,
    charges: 3,
    protectPercent: 0.35,
    maxStock: 15,
    restockDays: 14,
    description: 'Reduce en 35% lo que te pueden robar, por 3 usos'
  },
  {
    number: 2,
    id: 'escudo_50',
    emoji: '🛡️',
    name: 'Escudo Anti-Robo II',
    category: 'escudo',
    price: 1100,
    charges: 3,
    protectPercent: 0.50,
    maxStock: 10,
    restockDays: 14,
    description: 'Reduce en 50% lo que te pueden robar, por 3 usos'
  },
  {
    number: 3,
    id: 'escudo_70',
    emoji: '🛡️',
    name: 'Escudo Anti-Robo III',
    category: 'escudo',
    price: 1500,
    charges: 3,
    protectPercent: 0.70,
    maxStock: 6,
    restockDays: 14,
    description: 'Reduce en 70% lo que te pueden robar, por 3 usos'
  },
  {
    number: 4,
    id: 'suerte',
    emoji: '🍀',
    name: 'Amuleto de la Suerte',
    category: 'temporal',
    price: 1800,
    durationMs: 3 * 60 * 60 * 1000,
    description: `+15% de probabilidad al usar ${PREFIX}rob durante 3 horas`
  },
  {
    number: 5,
    id: 'multiplicador',
    emoji: '✨',
    name: 'Multiplicador de Trabajo',
    category: 'temporal',
    price: 1300,
    durationMs: 60 * 60 * 1000,
    description: `+50% de ganancias en ${PREFIX}work durante 1 hora`
  },
  {
    number: 6,
    id: 'corona',
    emoji: '👑',
    name: 'Corona de Prestigio',
    category: 'permanente',
    price: 25000,
    description: 'Insignia permanente que aparece en tu saldo'
  },
  {
    number: 7,
    id: 'leyenda',
    emoji: '🌟',
    name: 'Leyenda de Nuruxion',
    category: 'permanente',
    price: 100000,
    description: 'El título más alto de prestigio, permanente'
  },
  {
    number: 8,
    id: 'calabaza',
    emoji: '🎃',
    name: 'Calabaza Embrujada',
    category: 'temporada',
    price: 15000,
    months: [10],
    seasonLabel: 'Halloween (octubre)',
    description: 'Insignia exclusiva de temporada, permanente una vez comprada'
  },
  {
    number: 9,
    id: 'corazon',
    emoji: '❤️',
    name: 'Corazón de San Valentín',
    category: 'temporada',
    price: 15000,
    months: [2],
    seasonLabel: 'San Valentín (febrero)',
    description: 'Insignia exclusiva de temporada, permanente una vez comprada'
  },
  {
    number: 10,
    id: 'estrella_navidad',
    emoji: '🎄',
    name: 'Estrella Navideña',
    category: 'temporada',
    price: 20000,
    months: [12],
    seasonLabel: 'Navidad (20 noviembre 2026–7 enero 2027)',
    description: 'Insignia exclusiva de temporada, permanente una vez comprada'
  },
  {
    number: 11,
    id: 'modo_rush',
    emoji: '🚀',
    name: 'Modo Rush',
    category: 'rush',
    price: 20000,
    maxStock: 4,
    restockDays: 14,
    durationMs: 2 * 24 * 60 * 60 * 1000,
    description: '🎁 ¿Qué sorpresas te esperan? Solo lo sabrás si te atreves a usarlo.'
  },
  {
    number: 12,
    id: 'todo_o_nada',
    emoji: '🎰',
    name: 'Todo o Nada',
    category: 'gamble',
    price: 5000,
    maxStock: 5,
    restockDays: 14,
    description: '🎲 99.99% de las veces solo te llevas una galleta (+1 XP). Pero hay 0.01% de probabilidad de ganar el premio mayor: una insignia legendaria que da $150 cada hora, para siempre.'
  },
  {
    number: 13,
    id: 'pergamino_olvido',
    emoji: '📜',
    name: 'Pergamino del Olvido',
    category: 'utilidad',
    price: 30000,
    description: 'Reinicia todos tus puntos de habilidad de la mazmorra (Vida, Daño y elementos aprendidos) para que los repartas de nuevo'
  }
]


// ===================================================================
// ECONOMIA: TIENDA E INVENTARIO - helpers
// ===================================================================
function findShopItem(idOrNumber) {
  const raw = (idOrNumber || '').toString().trim().toLowerCase()
  const items = [...SHOP_ITEMS, ...ECO_ROTO_SHOP_ITEMS]
  if (/^\d+$/.test(raw)) return items.find(item => item.number === Number(raw))
  return items.find(item => item.id === raw)
}

function getShopStock(item) {
  let state = economyState.shopStock[item.id]
  if (supplies.includes(item)) {
    const refreshed = refreshSupplyStock(state, item)
    if (refreshed !== state) {
      economyState.shopStock[item.id] = refreshed
      queueEconomySave()
    }
    return refreshed
  }
  const cycleMs = item.restockDays * 24 * 60 * 60 * 1000
  if (!state) {
    state = economyState.shopStock[item.id] = { remaining: item.maxStock, cycleStart: Date.now() }
  } else if (Date.now() - state.cycleStart >= cycleMs) {
    state.remaining = item.maxStock
    state.cycleStart = Date.now()
  }
  return state
}

function isSeasonalAvailable(item) {
  if (item.id === 'calabaza') return false // Retirada de la venta; las compras anteriores se conservan.
  if (item.seasonLabel?.startsWith('Navidad')) return christmasActive()
  if (item.category !== 'temporada') return true
  const currentMonth = new Date().getMonth() + 1
  return item.months.includes(currentMonth)
}

function getInventory(jid) {
  const key = jidNormalizedUser(jid || '')
  if (!economyState.inventory[key]) {
    economyState.inventory[key] = { owned: [], buffs: {}, shieldCharges: 0, shieldTiers: {}, fortuneBadge: null }
  }
  if (!economyState.inventory[key].shieldTiers) {
    economyState.inventory[key].shieldTiers = {}
  }
  return economyState.inventory[key]
}

const FORTUNE_WIN_CHANCE = 0.0001
const FORTUNE_INCOME_PER_HOUR = 150

function collectFortuneIncome(jid) {
  const inventory = getInventory(jid)
  const fb = inventory.fortuneBadge
  if (!fb) return
  const now = Date.now()
  const hours = Math.floor((now - fb.lastCollectedAt) / (60 * 60 * 1000))
  if (hours >= 1) {
    const earned = hours * FORTUNE_INCOME_PER_HOUR
    const account = getAccount(jid)
    account.wallet += applyKingdomTax(earned).net
    fb.lastCollectedAt += hours * 60 * 60 * 1000
  }
}

const EXPLORE_MAX_LIVES = 3
const EXPLORE_LIFE_REGEN_MS = 24 * 60 * 60 * 1000
const EXPLORE_DURATION_MS = 60 * 60 * 1000


// ===================================================================
// MAZMORRA / EXPLORACION (MINIJUEGO RPG) - estado y helpers
// ===================================================================
function getExploreState(jid) {
  const key = jidNormalizedUser(jid || '')
  if (!economyState.explore[key]) economyState.explore[key] = { livesLostAt: [], expeditionStartedAt: null }
  return economyState.explore[key]
}

function exploreLivesLeft(jid) {
  const state = getExploreState(jid)
  const now = Date.now()
  state.livesLostAt = state.livesLostAt.filter(t => now - t < EXPLORE_LIFE_REGEN_MS)
  return EXPLORE_MAX_LIVES - state.livesLostAt.length
}

const EXPLORE_CHARACTERS = [
  { name: 'Cazatesoros Audaz', emoji: '🏴\u200d☠️' },
  { name: 'Explorador Silencioso', emoji: '🧭' },
  { name: 'Aventurera Temeraria', emoji: '⚔️' },
  { name: 'Vagabundo Curioso', emoji: '🎒' },
  { name: 'Rastreador Nocturno', emoji: '🌙' },
  { name: 'Buscador de Reliquias', emoji: '🗿' },
  { name: 'Piloto de Fortuna', emoji: '🚀' },
  { name: 'Guerrera Errante', emoji: '🛡️' },
  { name: 'Ladrona de Sombras', emoji: '🗡️' },
  { name: 'Mercenario Solitario', emoji: '🏹' },
  { name: 'Chaman del Bosque', emoji: '🌿' },
  { name: 'Ingeniera Loca', emoji: '⚙️' }
]

function explorerFor(jid) {
  const str = jidNormalizedUser(jid || '')
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return EXPLORE_CHARACTERS[hash % EXPLORE_CHARACTERS.length]
}

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1))
}

const MINE_MAX_LIVES = 200
const MINE_LIFE_REGEN_MS = 72 * 60 * 60 * 1000
const MINE_COMMAND_LIMIT = 15
const MINE_COMMAND_REST_MS = 10 * 60 * 1000
const MINE_LIMITED_COMMANDS = new Set(['mazmorra', 'adelante', 'avanzar', 'izquierda', 'derecha'])

// HALLOWEEN 2026 — evento integrado en economía y mazmorra
const HALLOWEEN_START = Date.parse('2026-10-03T00:00:00-06:00')
const HALLOWEEN_END = Date.parse('2026-11-04T00:00:00-06:00')
const HALLOWEEN_BOSS_HP = 5000000
const HALLOWEEN_ATTACK_LIMIT = 10
const HALLOWEEN_ATTACK_WINDOW = 15 * 60 * 60 * 1000
const HALLOWEEN_DAMAGE_MULTIPLIER = 20
const HALLOWEEN_FIRST_WORK_BONUS_MS = 14 * 24 * 60 * 60 * 1000
const HALLOWEEN_THIRD_WORK_BONUS_MS = 7 * 24 * 60 * 60 * 1000
const HALLOWEEN_TITLES = {
  h1: { name: 'Visitante del Umbral 2026', price: 500 },
  h2: { name: 'Cazador de Sombras 2026', price: 1100 },
  h3: { name: 'Heredero de la Maldición 2026', price: 1800 },
  h4: { name: 'Señor de la Noche Eterna 2026', price: 2800 },
  h5: { name: 'Leyenda del Eclipse 2026', price: 4000 }
}
const HALLOWEEN_ECHO_FRAGMENTS = [
  'La lámpara debilitada', 'El aceite derramado', 'La torre cerrada', 'La carta sin respuesta',
  'La brújula inmóvil', 'El mapa vacío', 'El equipaje invisible', 'La noche interminable',
  'El compañero silencioso', 'Una ventana iluminada', 'El camino dibujado', 'El amanecer incompleto'
]
const HALLOWEEN_ECHO_TITLES = [
  { count: 4, name: 'Caminante de la Niebla 2026' },
  { count: 8, name: 'Quien Dejó la Torre 2026' },
  { count: 12, name: 'Guardián de la Lámpara 2026' }
]
const HALLOWEEN_DAILY_MESSAGES = {
  night: [
    '🎃 Una calabaza permanecía encendida bajo la lluvia. Dentro encontraste dulces y una nota sin firma.',
    '🦇 Los murciélagos abandonaron la torre antes del amanecer. Decidiste no permanecer esperando frente a ella.',
    '🏚️ Una casa abandonada abrió sus puertas solamente para dejar provisiones en el camino.',
    '🕸️ Quitaste una telaraña del refugio. No arreglaste toda la casa, pero recuperaste una ventana.',
    '🔮 La vidente encontró demasiados caminos en tu futuro. Ninguno estaba decidido todavía.',
    '🐈‍⬛ Un gato negro se sentó junto a la puerta cerrada. Parecía conocer la espera mejor que nadie.',
    '🍂 Las hojas cubrieron el mapa, pero una parte del camino todavía podía verse.',
    '👻 Un espíritu te preguntó hacia dónde viajabas. Le dijiste que aún no lo sabías y decidió acompañarte.',
    '🏮 Las linternas del mercado guiaron tus pasos cuando la niebla ocultó las calles.',
    '🌙 La noche pareció interminable. El reloj del reino continuó avanzando.'
  ],
  echo: [
    '🕯️ La persona que siempre iluminó tu hogar está perdiendo fuerzas. Hoy no encontraste una cura; permaneciste cerca de su lámpara.',
    '🏰 Volviste a mirar hacia la torre esperando que reconociera tu esfuerzo. Las ventanas continuaron cerradas.',
    '🧭 Todos hablan de sus destinos como si hubieran recibido un mapa al nacer. Tú todavía no sabes qué camino tomar.',
    '🎒 Hoy cargaste el miedo de perder a alguien, el dolor de no sentirte querido y la incertidumbre del futuro. Nadie vio el peso.',
    '🌫️ Mientras otros parecían avanzar, utilizaste tus fuerzas únicamente para cruzar este día.',
    '🪞 El espejo repitió palabras que alguna vez te hirieron. Una voz cruel no siempre dice la verdad.',
    '📜 Escribiste que no sabías qué hacer con tu vida. El cartógrafo respondió que no saberlo todavía no elimina los caminos.',
    '🪨 Dejaste otra victoria frente a la torre. Nadie abrió, pero la victoria siguió siendo tuya.',
    '🕯️ Quisiste mantener todas las luces del hogar encendidas al mismo tiempo. El Guardián te recordó que tú también necesitas descanso.',
    '🎒 Nadie añadió nada a tu equipaje, pero hoy pesaba más que ayer.',
    '🌧️ No pudiste detener la tormenta sobre la persona que amas. Preparaste un refugio y permaneciste a su lado.',
    '🧭 La brújula continuó inmóvil. Elegiste solamente el siguiente paso.'
  ],
  warm: [
    '🐺 Tu compañero no tenía consejos. Se sentó contigo hasta que la tormenta disminuyó.',
    '🌤️ El viento dejó de sentirse frío durante unos minutos. Guardaste ese momento para recordarlo después.',
    '🌱 Algo pequeño creció donde ayer solamente había tierra.',
    '🪵 Añadiste otro leño a la fogata. El refugio estará caliente una noche más.',
    '🌊 El río siguió avanzando alrededor de las piedras que no podía mover.',
    '🌻 Una flor nació fuera del jardín. Nadie le había dicho que aquel no era su lugar.',
    '⭐ Una estrella apareció entre las nubes. No indicó el destino, pero confirmó que había cielo detrás de la niebla.',
    '📖 Dejamos una página en blanco mientras descansabas. Puedes continuar desde aquí.',
    '🔔 Una campana distante anunció un nuevo día. El reino recordó que todavía estabas aquí.',
    '🏮 Algunas lámparas brillaban con fuerza y otras apenas resistían. El reino necesitaba ambas para cruzar la noche.'
  ]
}
const HALLOWEEN_WORK_ECHOES = [
  '🕯️ Reparaste una lámpara antigua. No volvió a brillar como antes, pero resistirá otra noche',
  '🏰 Al terminar tu jornada llevaste una victoria frente a la torre. Nadie abrió; decidiste conservarla',
  '🧭 El cartógrafo preguntó por tu destino. Le respondiste que aún estabas dibujándolo',
  '🎒 Ayudaste a un viajero con su equipaje y reconociste un peso que nadie más podía ver',
  '🌧️ Preparaste un refugio para alguien importante mientras la tormenta continuaba afuera'
]
const HALLOWEEN_HOUSES = [
  { name: 'Casa de la Guardiana', sweet: 'Una lámpara débil ilumina la entrada. Dejas aceite junto a ella y recibes', trick: 'La corriente apaga varias velas y debes escapar entre la oscuridad' },
  { name: 'Torre sin Ventanas', sweet: 'La puerta no se abre, pero una carta aparece bajo ella junto a', trick: 'Golpeas la puerta hasta comprender que su silencio no depende de ti' },
  { name: 'Taller del Cartógrafo', sweet: 'El mapa continúa incompleto. El cartógrafo marca el siguiente paso y te entrega', trick: 'La brújula gira sin control y una sombra toma parte de tus dulces' },
  { name: 'Refugio del Lobo', sweet: 'El lobo se sienta en silencio a tu lado y deja una bolsa con', trick: 'Un aullido rompe la calma y corres dejando algunos dulces atrás' },
  { name: 'Casa del Espejo', sweet: 'El espejo deja de repetir las voces crueles y revela', trick: 'Tu reflejo pronuncia palabras antiguas antes de quebrarse' }
]
// Evento retirado permanentemente. El archivo de clasificación y premios se conserva.
function halloweenActive() { return false }
function getHalloweenState() {
  // El evento terminó definitivamente con la estructura de las tres llaves.
  economyState.mineStructure = null
  economyState.halloween2026 ||= { startedAt: HALLOWEEN_START, endsAt: HALLOWEEN_END, structureDestroyed: true, boss: { maxHp: HALLOWEEN_BOSS_HP, hp: HALLOWEEN_BOSS_HP, defeated: false, finalized: false, damage: {} }, players: {} }
  const h = economyState.halloween2026
  h.structureDestroyed = true
  h.players ||= {}
  h.boss ||= { maxHp: HALLOWEEN_BOSS_HP, hp: HALLOWEEN_BOSS_HP, defeated: false, finalized: false, damage: {} }
  h.boss.damage ||= {}
  return h
}
function getHalloweenPlayer(jid) {
  const h = getHalloweenState(); const key = jidNormalizedUser(jid || '')
  h.players[key] ||= { candies: 0, candyMultiplier: 1, titles: [], activeTitle: null, attacks: [], damage: 0, lastMissionAt: 0, workCandyToday: { day: '', count: 0 } }
  const p = h.players[key]
  p.titles ||= []; p.attacks ||= []; p.fragments ||= []; p.dailyMessageHistory ||= []; p.storyClaims ||= {}
  p.storyActivity ||= { dailyDay: '', workDay: '', workCount: 0, bossDay: '', bossCount: 0, dungeonDay: '', dungeonCount: 0 }
  p.candyMultiplier = Math.min(1.3, Math.max(1, Number(p.candyMultiplier || 1)))
  return p
}
function halloweenUnlockEchoTitles(p) {
  const unlocked = []
  for (const item of HALLOWEEN_ECHO_TITLES) {
    if (p.fragments.length >= item.count && !p.titles.includes(item.name)) { p.titles.push(item.name); unlocked.push(item.name) }
  }
  if (!p.activeTitle && unlocked.length) p.activeTitle = unlocked[unlocked.length - 1]
  return unlocked
}
function grantHalloweenFragment(jid) {
  if (!halloweenActive()) return ''
  const p = getHalloweenPlayer(jid)
  const missing = HALLOWEEN_ECHO_FRAGMENTS.filter(fragment => !p.fragments.includes(fragment))
  if (!missing.length) return ''
  const fragment = missing[Math.floor(Math.random() * missing.length)]
  p.fragments.push(fragment)
  const titles = halloweenUnlockEchoTitles(p)
  queueEconomySave()
  return '\n📜 Eco encontrado: *' + fragment + '* (' + p.fragments.length + '/' + HALLOWEEN_ECHO_FRAGMENTS.length + ')' + (titles.length ? '\n🏷️ Título desbloqueado: *' + titles.join(', ') + '*' : '')
}
function halloweenDailyMessage(jid) {
  const p = getHalloweenPlayer(jid)
  const roll = Math.random(); const category = roll < 0.25 ? 'echo' : roll < 0.35 ? 'warm' : 'night'
  const pool = HALLOWEEN_DAILY_MESSAGES[category]
  const available = pool.map((text, index) => ({ id: category + ':' + index, text })).filter(entry => !p.dailyMessageHistory.includes(entry.id))
  const chosen = (available.length ? available : pool.map((text, index) => ({ id: category + ':' + index, text })))[Math.floor(Math.random() * (available.length || pool.length))]
  p.dailyMessageHistory.push(chosen.id); p.dailyMessageHistory = p.dailyMessageHistory.slice(-6)
  return chosen.text
}
function halloweenBossPhase(boss) {
  const ratio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0
  if (ratio <= 0) return { name: 'El amanecer', text: 'La niebla disminuye. Algunas heridas permanecen, pero ninguna luz tuvo que resistir sola.' }
  if (ratio <= 0.25) return { name: 'La última lámpara', text: 'El reino protege sus últimas luces mientras el Rey intenta apagarlas.' }
  if (ratio <= 0.50) return { name: 'La brújula inmóvil', text: 'Los caminos desaparecen, pero cada ataque vuelve a dibujar una parte del mapa.' }
  if (ratio <= 0.75) return { name: 'La torre cerrada', text: 'El Rey responde con el eco de puertas que nunca se abrieron.' }
  return { name: 'El peso invisible', text: 'La niebla vuelve más pesado todo aquello que los demás no pueden ver.' }
}
function halloweenProfileText(jid) {
  if (!economyState.halloween2026) return ''
  const p = economyState.halloween2026.players?.[jidNormalizedUser(jid || '')]
  return p?.activeTitle ? '\n🏷️ Título ganado: ' + p.activeTitle : ''
}
function halloweenStoryMission(jid) {
  const p = getHalloweenPlayer(jid), day = mxDateKey(), activity = p.storyActivity
  const type = Number(day.replace(/-/g, '')) % 4
  let label, progress, goal
  if (type === 0) { label = 'Permanece junto a la lámpara: reclama ?daily'; progress = activity.dailyDay === day ? 1 : 0; goal = 1 }
  else if (type === 1) { label = 'Dibuja el siguiente paso: completa 3 jornadas con ?work'; progress = activity.workDay === day ? activity.workCount : 0; goal = 3 }
  else if (type === 2) { label = 'Comparte el peso: ataca al Rey del Umbral'; progress = activity.bossDay === day ? activity.bossCount : 0; goal = 1 }
  else { label = 'Cruza la niebla: entra en la mazmorra'; progress = activity.dungeonDay === day ? activity.dungeonCount : 0; goal = 1 }
  progress = Math.min(goal, progress)
  let reward = ''
  if (progress >= goal && !p.storyClaims[day]) { p.storyClaims[day] = true; const candy = grantHalloweenCandy(jid, 40); reward = '\n🎁 Eco diario completado: +' + candy + ' 🍬' + grantHalloweenFragment(jid) }
  return '\n\n🌫️ *EL CAMINO QUE NADIE VE*\n' + label + '\nProgreso: ' + progress + '/' + goal + reward
}
function grantHalloweenCandy(jid, base) {
  if (!halloweenActive()) return 0
  const p = getHalloweenPlayer(jid); const amount = Math.max(1, Math.floor(Number(base || 0) * p.candyMultiplier)); p.candies += amount; queueEconomySave(); return amount
}
function halloweenTimeLeft() { const ms = Math.max(0, HALLOWEEN_END - Date.now()); return Math.ceil(ms / 86400000) + ' día(s)' }
function halloweenShopText() { return Object.entries(HALLOWEEN_TITLES).map(([id,t]) => id.toUpperCase() + ' — ' + t.name + ': ' + t.price + ' 🍬').join('\n') }
async function halloweenTopText(sock, groupJid) {
  // Consulta histórica de solo lectura: nunca vuelve a repartir o recalcular premios.
  const h = economyState.halloween2026
  const rows = Object.entries(h?.boss?.damage || {}).sort((a,b)=>b[1]-a[1])
  if (!rows.length) return { text: 'No hay una clasificación guardada del jefe.', mentions: [] }
  let metadata = null
  try { metadata = await getMetadata(sock, groupJid, true) } catch {}
  const mentions = []
  const lines = rows.map(([storedJid,d],i) => {
    const participant = metadata ? findParticipant(metadata, storedJid) : null
    const candidates = [storedJid, participant?.phoneNumber, participant?.jid, participant?.id, participant?.lid].filter(Boolean)
    const mentionJid = jidNormalizedUser(participant?.phoneNumber || participant?.jid || participant?.id || storedJid)
    const name = knownWhatsAppName(candidates) || safeWhatsAppName(participant?.notify || participant?.name || participant?.verifiedName || participant?.displayName) || targetTag(mentionJid).slice(1)
    if (name && !knownWhatsAppName(candidates)) rememberWhatsAppName(candidates, name)
    mentions.push(mentionJid)
    const reward = h.boss.rewards?.[storedJid]
    const title = reward?.title || (i < 3 ? ['Azote del Rey Calabaza 2026','Verdugo de la Noche 2026','Guardián del Último Dulce 2026'][i] : 'Defensor de Nuruxion 2026')
    let prize = 'título *'+title+'*'
    if (i === 0 && h.boss.defeated) prize += '\n   💰 $500,000 · 🎮 150 Robux completos, sin impuestos (entrega pendiente del owner)\n   🛡️ Inmunidad de mazmorra: 3 días · 💼 ?work x2: 2 semanas'
    if (i === 2 && h.boss.defeated) prize += '\n   💰 $100,000 · 🎮 10 Robux completos, sin impuestos (entrega pendiente del owner)\n   🛡️ Inmunidad de mazmorra: 1 día · 💼 ?work x2: 1 semana'
    const realMention = targetTag(mentionJid)
    return (i+1)+'. '+realMention+' — *'+Math.floor(d).toLocaleString('es-MX')+' daño*\n   🎁 Premio: '+prize
  })
  return { text: lines.join('\n\n'), mentions: [...new Set(mentions)] }
}
function halloweenBuyTitle(jid,id) {
  const p=getHalloweenPlayer(jid); const item=HALLOWEEN_TITLES[id]
  if(!item) return {ok:false,text:'Título inválido. Usa h1, h2, h3, h4 o h5.'}
  if(p.titles.includes(item.name)){p.activeTitle=item.name;queueEconomySave();return {ok:true,text:'🏷️ Activaste el título *'+item.name+'*.'}}
  if(p.candies<item.price)return {ok:false,text:'🍬 Necesitas '+item.price+' dulces; tienes '+p.candies+'.'}
  p.candies-=item.price;p.titles.push(item.name);p.activeTitle=item.name;queueEconomySave();return {ok:true,text:'🎃 Compraste y equipaste *'+item.name+'* por '+item.price+' 🍬.'}
}
function finalizeHalloweenBoss() {
  const h=getHalloweenState(); if(h.boss.finalized&&h.boss.rewardsAppliedV3)return; h.boss.finalized=true
  const ranking=Object.entries(h.boss.damage).sort((a,b)=>b[1]-a[1]); const won=h.boss.hp<=0; h.boss.defeated=won
  const victory=['Azote del Rey Calabaza 2026','Verdugo de la Noche 2026','Guardián del Último Dulce 2026']
  const defeat=['Última Luz de Nuruxion 2026','Resistente de la Maldición 2026','Testigo del Eclipse 2026']
  h.boss.rewards ||= {}
  ranking.forEach(([jid,damage],i)=>{const p=getHalloweenPlayer(jid);const title=i<3?(won?victory:defeat)[i]:(won?'Defensor de Nuruxion 2026':'Superviviente de Halloween 2026');if(!p.titles.includes(title))p.titles.push(title);h.boss.rewards[jid]={rank:i+1,damage,title,won}})
  h.boss.rewardsAppliedV2=true
  if (won && !h.boss.placementPrizesApplied) {
    economyState.robuxPrizeClaims ||= {}
    economyState.workEventMultipliers ||= {}
    const now = Date.now()
    const first = ranking[0]?.[0]
    const third = ranking[2]?.[0]
    if (first) {
      getAccount(first).wallet += 500000
      getMineState(first).structureImmuneUntil = Math.max(Number(getMineState(first).structureImmuneUntil || 0), now + 3 * 24 * 60 * 60 * 1000)
      economyState.workEventMultipliers[first] = Math.max(Number(economyState.workEventMultipliers[first] || 0), now + HALLOWEEN_FIRST_WORK_BONUS_MS)
      economyState.robuxPrizeClaims['halloween2026:first:'+first] = { jid:first, amount:150, withoutTax:true, status:'pending_owner_delivery', reason:'Primer lugar — Rey del Umbral', createdAt:now }
      Object.assign(h.boss.rewards[first], { coins:500000, robux:150, dungeonImmunityDays:3, workMultiplier:2, workMultiplierDays:14 })
    }
    if (third) {
      getAccount(third).wallet += 100000
      getMineState(third).structureImmuneUntil = Math.max(Number(getMineState(third).structureImmuneUntil || 0), now + 24 * 60 * 60 * 1000)
      economyState.workEventMultipliers[third] = Math.max(Number(economyState.workEventMultipliers[third] || 0), now + HALLOWEEN_THIRD_WORK_BONUS_MS)
      economyState.robuxPrizeClaims['halloween2026:third:'+third] = { jid:third, amount:10, withoutTax:true, status:'pending_owner_delivery', reason:'Tercer lugar — Rey del Umbral', createdAt:now }
      Object.assign(h.boss.rewards[third], { coins:100000, robux:10, dungeonImmunityDays:1, workMultiplier:2, workMultiplierDays:7 })
    }
    h.boss.placementPrizesApplied = true
  }
  h.boss.rewardsAppliedV3=true
  queueEconomySave()
}
function halloweenEndingText() {
  const h = economyState.halloween2026
  if (!h) return '🎃 El evento Halloween 2026 ya terminó.'
  const won = Number(h.boss?.hp || 0) <= 0
  return won
    ? '🌅 *EL AMANECER DEL UMBRAL*\n\nLa niebla no desapareció por completo. Algunas puertas continuaron cerradas, ciertas lámparas siguieron débiles y el mapa quedó incompleto. Sin embargo, cuando llegó el amanecer, ninguna luz tuvo que permanecer sola.'
    : '🌫️ *LA NOCHE QUE RESISTIÓ*\n\nEl Rey del Umbral permaneció en pie cuando llegó el amanecer. No conquistaron toda la noche, pero dejaron suficientes luces encendidas para que otros viajeros encontraran el camino.'
}
function halloweenStatusText(jid) {
  const h=getHalloweenState(),p=getHalloweenPlayer(jid); const pct=Math.max(0,Math.round((h.boss.hp/h.boss.maxHp)*100)); const phase=halloweenBossPhase(h.boss)
  return '🎃 *HALLOWEEN: LA MALDICIÓN DEL UMBRAL*\n\nLa Estructura Extraña se desmoronó: las tres llaves nunca fueron reunidas. Al caer, liberó una maldición que cubrió Nuruxion.\n\n👑 Jefe comunitario: *Rey del Umbral*\n❤️ '+Math.max(0,h.boss.hp).toLocaleString('es-MX')+' / '+h.boss.maxHp.toLocaleString('es-MX')+' ('+pct+'%)\n🌫️ Fase: *'+phase.name+'*\n_'+phase.text+'_\n⚡ Bono comunitario activo: *daño x'+HALLOWEEN_DAMAGE_MULTIPLIER+'*\n🍬 Tus dulces: *'+p.candies+'* · multiplicador x'+p.candyMultiplier.toFixed(1)+'\n📜 Ecos: *'+p.fragments.length+'/'+HALLOWEEN_ECHO_FRAGMENTS.length+'*\n🏷️ Título: '+(p.activeTitle||'ninguno')+'\n⏳ Termina en '+halloweenTimeLeft()+'\n\nAcciones: *?evento mision*, *?evento casa*, *?evento atacar*, *?evento top* y *?evento titulo h1-h5*.\nLos dulces son personales y no se pueden transferir.'
}


function getMineState(jid) {
  const key = jidNormalizedUser(jid || '')
  if (!economyState.mine[key]) economyState.mine[key] = { livesLostAt: [], active: false, depth: 0, pending: null, loot: 0, items: [], portalReturnAt: null }
  return economyState.mine[key]
}

function consumeMineCommandUse(jid) {
  const state = getMineState(jid)
  const now = Date.now()
  const restUntil = Number(state.commandRestUntil || 0)

  if (restUntil > now) {
    return { allowed: false, remainingMs: restUntil - now }
  }

  if (restUntil) {
    state.commandUses = 0
    state.commandRestUntil = null
  }

  state.commandUses = Math.max(0, Number(state.commandUses || 0)) + 1
  if (state.commandUses >= MINE_COMMAND_LIMIT) {
    state.commandRestUntil = now + MINE_COMMAND_REST_MS
  }
  queueEconomySave()
  return { allowed: true, remainingUses: Math.max(0, MINE_COMMAND_LIMIT - state.commandUses) }
}

const MINE_MAX_FLOOR = 20
const MINE_BOSS_INTERVAL = 5
const MINE_MAX_MANA = 200
const MINE_STAIRS_MIN_STEPS = 10

function isMineBossFloor(floor) {
  return floor > 0 && floor % MINE_BOSS_INTERVAL === 0
}

function mineBossIndex(floor) {
  return floor / MINE_BOSS_INTERVAL
}

function grantMineBossXp(jid, depth) {
  const xp = 500 * mineBossIndex(depth)
  economyState.xp[jid] = (economyState.xp[jid] || 0) + xp
  const mineState = economyState.mine[jid]
  if (mineState) {
    mineState.checkpointFloor = Math.max(mineState.checkpointFloor || 0, depth)
    mineSaveCheckpointSnapshot(mineState, depth)
  }
  return xp
}

function tryDropMineLegendary(jid, depth) {
  if (depth !== MINE_MAX_FLOOR) return false
  economyState.mineLegendaryHolders = economyState.mineLegendaryHolders || []
  if (economyState.mineLegendaryHolders.length >= 2) return false
  if (economyState.mineLegendaryHolders.includes(jid)) return false
  if (Math.random() >= 0.0002) return false
  getInventory(jid).owned.push('objeto_legendario')
  economyState.mineLegendaryHolders.push(jid)
  return true
}

const MINE_ELEMENTS = ['agua', 'fuego', 'tierra', 'electricidad', 'oscuridad']
const MINE_BOSS_POWER = [1500, 4000, 8000, 15000]

function assignMineTraits(inv) {
  if (inv.elements) return
  const elements = []
  if (Math.random() < 0.5) elements.push('agua')
  if (Math.random() < 0.5) elements.push('fuego')
  if (Math.random() < 0.25) elements.push('tierra')
  if (Math.random() < 0.10) elements.push('electricidad')
  if (Math.random() < 0.001) elements.push('oscuridad')
  let prodigioElemental = false
  if (Math.random() < 0.00001) { prodigioElemental = true; elements.length = 0; elements.push(...MINE_ELEMENTS) }
  inv.elements = elements
  inv.prodigioElemental = prodigioElemental
  inv.prodigioCombate = Math.random() < 0.01
}

function mineSkillPointsAvailable(jid, inv) {
  const totalPoints = levelFromXp(economyState.xp[jid] || 0)
  const spent = (inv.vidaPoints || 0) + (inv.danoPoints || 0) + (inv.manaPoints || 0) + (inv.unlockedElements || []).length * 50
  return totalPoints - spent
}

function mineVidaStat(inv) {
  const points = inv.vidaPoints || 0
  const legendaryBonus = inv.owned.includes('objeto_legendario') ? 5000 : 0
  return Math.round(200 * Math.pow(10, (points - 1) / 150)) + legendaryBonus
}

function mineDanoStat(inv) {
  const legendaryBonus = inv.owned.includes('objeto_legendario') ? 5000 : 0
  return 50 + (inv.danoPoints || 0) * 100 + legendaryBonus
}

function mineMaxHpFor(inv) {
  return MINE_MAX_HP + (inv.vidaPoints || 0) * 5
}

function mineMaxManaFor(inv) {
  return MINE_MAX_MANA + (inv.manaPoints || 0) * 5
}

function mineMonsterPower(depth) {
  const base = isMineBossFloor(depth) ? (MINE_BOSS_POWER[mineBossIndex(depth) - 1] || MINE_BOSS_POWER[MINE_BOSS_POWER.length - 1]) : 150 + depth * 40
  return isGlobalEventActive() ? Math.round(base * 0.95) : base
}

function getMineMana(state) {
  return typeof state.mana === 'number' ? state.mana : (state.maxMana || MINE_MAX_MANA)
}

const MINE_MAX_HP = 200

function mineCurrentHp(state) {
  return typeof state.hp === 'number' ? state.hp : (state.maxHp || MINE_MAX_HP)
}

function mineTakeDamage(state, percent) {
  const resistant = (state.resistanceCharges || 0) > 0
  if (resistant) state.resistanceCharges -= 1
  const dmg = Math.round((state.maxHp || MINE_MAX_HP) * percent * (resistant ? 0.5 : 1))
  state.hp = Math.max(0, mineCurrentHp(state) - dmg)
  return dmg
}

function mineHeal(state, percent) {
  const amt = Math.round((state.maxHp || MINE_MAX_HP) * percent)
  state.hp = Math.min((state.maxHp || MINE_MAX_HP), mineCurrentHp(state) + amt)
  return amt
}

function mineIsDead(state) {
  return mineCurrentHp(state) <= 0
}

function isGlobalEventActive() {
  const now = Date.now()
  return now >= (economyState.globalEventFrom || 0) && now < (economyState.globalEventUntil || 0)
}

function applyKingdomTax(amount) {
  const tax = Math.round(amount * 0.15)
  const net = amount - tax
  const suffix = tax > 0 ? `\n📉 -${formatCurrency(tax)} (Impuestos al tesorero del reino)` : ''
  return { net, tax, suffix }
}

const MINE_DIRECTION_HINTS = [
  `Usa *${PREFIX}avanzar*, *${PREFIX}izquierda* o *${PREFIX}derecha* para seguir.`,
  `¿Hacia dónde sigues? *${PREFIX}avanzar*, *${PREFIX}izquierda* o *${PREFIX}derecha*.`,
  `El pasillo se abre en tres direcciones. Elige: *${PREFIX}avanzar*, *${PREFIX}izquierda* o *${PREFIX}derecha*.`,
  `Tres corredores te esperan. Usa *${PREFIX}avanzar*, *${PREFIX}izquierda* o *${PREFIX}derecha* para continuar.`,
  `¿Por dónde te aventuras ahora? *${PREFIX}avanzar*, *${PREFIX}izquierda* o *${PREFIX}derecha*.`,
  `Decide tu siguiente paso: *${PREFIX}avanzar*, *${PREFIX}izquierda* o *${PREFIX}derecha*.`,
  `Las antorchas iluminan tres caminos posibles. *${PREFIX}avanzar*, *${PREFIX}izquierda* o *${PREFIX}derecha*.`
]

function mineDirectionHint() {
  return MINE_DIRECTION_HINTS[Math.floor(Math.random() * MINE_DIRECTION_HINTS.length)]
}

const MINE_JUNCTION_DESCRIPTIONS = [
  'un arco de piedra tallado, un pasadizo estrecho y unas escaleras rotas',
  'una puerta de roble carcomida, una grieta en el muro y un corredor iluminado por antorchas',
  'un pasillo recto que se pierde en la oscuridad, un hueco entre las rocas y una escalinata desgastada',
  'tres arcos idénticos cubiertos de musgo',
  'un corredor con estatuas rotas, una abertura angosta y unos peldaños tallados en la roca',
  'una senda de piedra lisa, un túnel goteante y una rampa hacia abajo'
]

function mineJunctionDescription() {
  return MINE_JUNCTION_DESCRIPTIONS[Math.floor(Math.random() * MINE_JUNCTION_DESCRIPTIONS.length)]
}

function nextMexicoWeekendWindow() {
  const MX_OFFSET_MS = -6 * 3600 * 1000
  const nowUtc = Date.now()
  const mxNow = nowUtc + MX_OFFSET_MS
  const mxDate = new Date(mxNow)
  const mxDay = mxDate.getUTCDay()
  const mxMidnightMs = Date.UTC(mxDate.getUTCFullYear(), mxDate.getUTCMonth(), mxDate.getUTCDate())
  let sundayMxMidnight = mxMidnightMs + ((7 - mxDay) % 7) * 86400000
  if (sundayMxMidnight <= mxNow) sundayMxMidnight += 7 * 86400000
  const from = sundayMxMidnight - MX_OFFSET_MS
  const until = from + 24 * 3600 * 1000
  return { from, until }
}

function mineDepthDangerMult(floor) {
  return 1 + Math.max(0, floor - 1) * 0.05
}

function mineDepthLootMult(floor) {
  const base = 1 + Math.max(0, floor - 1) * 0.08
  return isGlobalEventActive() ? base * 1.1 : base
}

const MINE_MONSTER_TIERS = [
  { max: 5, names: ['una rata gigante', 'un esqueleto', 'un slime'] },
  { max: 10, names: ['un orco', 'un espectro', 'una araña gigante'] },
  { max: 15, names: ['un troll', 'una arpía', 'un gólem de piedra'] },
  { max: 20, names: ['un demonio menor', 'una sombra viviente', 'un caballero maldito'] }
]

function randomMineMonsterName(floor) {
  const tier = MINE_MONSTER_TIERS.find(t => floor <= t.max) || MINE_MONSTER_TIERS[MINE_MONSTER_TIERS.length - 1]
  return tier.names[Math.floor(Math.random() * tier.names.length)]
}

function mineLivesLeft(jid) {
  return mineCurrentHp(getMineState(jid))
}

const MINE_ITEMS = ['una linterna oxidada', 'un pico viejo', 'un mapa desgastado', 'una brújula rota', 'un casco de explorador', 'un farol apagado', 'unas botas gastadas', 'un guante de cuero']

function mineSummary(state, total) {
  const itemsText = state.items.length ? `\nLlevas contigo: ${state.items.join(', ')}.` : ''
  return `\n🏰 Llegaste hasta el *Piso ${state.currentFloor || 1}*.${itemsText}\n💰 Total ganado: ${formatCurrency(total)}`
}


const PICKAXE_IDS = ['pico_madera', 'pico_hierro', 'pico_diamante', 'pico_estelita']

function pickaxeName(tier) {
  return tier === 4 ? 'un pico de estelita' : tier === 3 ? 'un pico de diamante' : tier === 2 ? 'un pico de hierro' : 'un pico de madera'
}

function pickaxeTier(jid) {
  const owned = getInventory(jid).owned
  if (owned.includes('pico_estelita')) return 4
  if (owned.includes('pico_diamante')) return 3
  if (owned.includes('pico_hierro')) return 2
  if (owned.includes('pico_madera')) return 1
  return 0
}

function givePickaxe(jid, tier) {
  const inventory = getInventory(jid)
  inventory.owned = inventory.owned.filter(id => !PICKAXE_IDS.includes(id))
  inventory.owned.push(PICKAXE_IDS[tier - 1])
}

function pickaxeLine(jid) {
  const tier = pickaxeTier(jid)
  return tier > 0 ? `\n🛠️ Herramienta: ${pickaxeName(tier)}` : ''
}

const MINE_STRUCTURE_CHANCE = 0.00002
const MINE_STRUCTURE_KEY_CHANCE = 0.01
const MINE_STRUCTURE_KEYS_NEEDED = 3
const MINE_STRUCTURE_TRAP_HP = 0.10
const MINE_STRUCTURE_REWARD_COINS = 100000
const MINE_STRUCTURE_REWARD_XP = 500000
const MINE_STRUCTURE_IMMUNITY_MS = 3 * 24 * 60 * 60 * 1000

function mineStructureActive() {
  // Durante Halloween la estructura ya cayó: ningún portal puede bloquear la salida.
  if (halloweenActive()) return false
  return Boolean(economyState.mineStructure && economyState.mineStructure.active)
}

function mineStructureBlocks(jid) {
  if (!mineStructureActive()) return false
  return Date.now() >= (getMineState(jid).structureImmuneUntil || 0)
}

function mineSpawnStructure() {
  if (halloweenActive()) {
    economyState.mineStructure = null
    return
  }
  economyState.mineStructure = { active: true, spawnedAt: Date.now() }
  for (const s of Object.values(economyState.mine || {})) s.structureKeys = 0
}

function mineStructureKeys(jid) {
  return getMineState(jid).structureKeys || 0
}

function mineStructureReminder(jid) {
  const keys = jid ? mineStructureKeys(jid) : 0
  return `\n🗿 La Estructura Extraña sigue activa y los portales siguen convertidos en trampas. 🗝️ Llaves: ${keys}/${MINE_STRUCTURE_KEYS_NEEDED}. Con las 3 llaves usa *${PREFIX}romper* para abrir sus puertas y destruirla.`
}

function mineStructureNotice(jid) {
  if (!mineStructureBlocks(jid)) return ''
  return `

⚠️ *La Estructura Extraña está activa.* Los portales son *trampas* (te quitan 10% de vida) y no puedes salir hasta que alguien la destruya. 🗝️ Llaves: ${mineStructureKeys(jid)}/${MINE_STRUCTURE_KEYS_NEEDED}. Con las 3 llaves usa *${PREFIX}romper*. Si mueres, reapareces en tu último checkpoint pero pierdes todo el dinero y botín que hayas ganado.`
}

const MINE_PORTAL_INTROS = {
  exit: '🌀 Un portal de salida se abre entre las rocas...',
  dormant: '🌀 Encuentras un portal apagado cubierto de polvo y musgo...',
  fake: '🌀 Un portal parpadea débil entre las sombras...',
  boss: '🌀 Un portal de salida se abre en la sala del jefe...'
}

const MINE_PORTAL_INFLUENCES = [
  '👁️ Pero una influencia extraña está cambiando todos los portales de la mazmorra: ya no llevan a ninguna parte, ahora son trampas.',
  '🗿 Una presencia antigua y rara está retorciendo cada portal a tu alrededor. Lo que antes era una salida se convirtió en una trampa.',
  '🌌 Una fuerza desconocida está alterando los portales de este lugar. Ese ya no es una salida: es un cepo de energía.',
  '⚠️ Algo oscuro está pervirtiendo los portales desde dentro. Sientes que este te está esperando... y no para dejarte ir.'
]

const MINE_PORTAL_TRAPS = [
  'Al acercarte, el portal te escupe una descarga violeta que te atraviesa y se desvanece.',
  'El portal se cierra sobre ti como unas fauces y te muerde antes de esfumarse.',
  'Una onda de energía negra brota del portal, te lanza contra la pared y el portal desaparece.',
  'Al tocarlo, el portal se retuerce y te chupa parte de tu fuerza vital antes de apagarse.'
]

function mineStructureTrapPortal(state, kind, jid) {
  const dmg = Math.max(1, Math.round((state.maxHp || MINE_MAX_HP) * MINE_STRUCTURE_TRAP_HP))
  state.hp = Math.max(0, mineCurrentHp(state) - dmg)
  const pick = list => list[Math.floor(Math.random() * list.length)]
  return `${MINE_PORTAL_INTROS[kind] || MINE_PORTAL_INTROS.exit}\n${pick(MINE_PORTAL_INFLUENCES)}\n${pick(MINE_PORTAL_TRAPS)}\n💔 Pierdes el 10% de tu vida (-${dmg}).${jid ? mineStructureReminder(jid) : ''}`
}

function mineDestroyStructure(destroyerJid) {
  economyState.mineStructure = null
  const victims = []
  for (const [jid, s] of Object.entries(economyState.mine || {})) {
    s.structureKeys = 0
    if (jid === destroyerJid || !s.active) continue
    victims.push(jid)
    s.active = false
    s.pending = null
    s.loot = 0
    s.items = []
    s.hp = 0
    s.depth = 0
    s.currentFloor = 1
    s.floorSteps = 0
    s.bossPortalShown = false
    s.pvpTarget = null
    s.recoveryAt = Date.now() + 20 * 60 * 1000
  }
  return victims
}

function mineSaveCheckpointSnapshot(state, floor) {
  state.structureSave = { floor, loot: state.loot || 0, items: [...(state.items || [])] }
}

function mineFinishStep(state, jid, text, ended) {
  const diary = recordDungeon(economyState, jid, state.currentFloor || 1)
  queueEconomySave()
  if (!ended && state.pending === 'direction' && isMineBossFloor(state.currentFloor || 1) && !state.bossPortalShown && mineStructureBlocks(jid)) {
    state.bossPortalShown = true
    text += `\n\n${mineStructureTrapPortal(state, 'boss', jid)}`
  }
  const diedNow = !ended && mineLivesLeft(jid) <= 0
  if (diedNow && mineStructureBlocks(jid)) {
    const respawnFloor = Math.max(1, (state.structureSave && state.structureSave.floor) || 1)
    const lostLoot = state.loot || 0
    const lostItems = (state.items || []).length
    state.loot = 0
    state.items = []
    state.currentFloor = respawnFloor
    state.floorSteps = 0
    state.bossPortalShown = false
    state.hp = state.maxHp || MINE_MAX_HP
    state.pending = 'direction'
    const lostBits = []
    if (lostLoot > 0) lostBits.push(formatCurrency(lostLoot))
    if (lostItems > 0) lostBits.push(`${lostItems} objeto(s)`)
    const lostText = lostBits.length ? ` (${lostBits.join(' y ')})` : ''
    text += `\n\n💀 Moriste dentro de la mazmorra sellada por la Estructura Extraña. Reapareces en tu último checkpoint (*Piso ${respawnFloor}*), pero pierdes TODO el dinero y el botín que habías ganado${lostText}. Las llaves que encontraste las conservas.`
    text += `\n\n❤️ Vida: ${mineLivesLeft(jid)}/${state.maxHp || MINE_MAX_LIVES}`
    text += `\n${mineDirectionHint()}`
    return text + diary
  }
  if (diedNow) {
    ended = true
    state.active = false
    state.recoveryAt = Date.now() + 20 * 60 * 1000
    text += `\n\n💀 Te quedaste sin vida y sales de la mazmorra como puedes. Necesitarás 20 minutos para recuperarte antes de volver a entrar.`
  }
  if (ended) {
    const total = state.loot
    const account = getAccount(jid)
    const { net, suffix } = applyKingdomTax(total)
    account.wallet += net
    text += mineSummary(state, net) + suffix
    state.loot = 0
    state.items = []
    state.depth = 0
    state.currentFloor = 1
    state.floorSteps = 0
    state.bossPortalShown = false
    if (!diedNow) state.hp = (state.maxHp || MINE_MAX_HP)
    state.active = false
    state.pending = null
  } else {
    text += `\n\n❤️ Vida: ${mineLivesLeft(jid)}/${state.maxHp || MINE_MAX_LIVES}`
    if (state.pending === 'direction' && isMineBossFloor(state.currentFloor || 1) && !state.bossPortalShown) {
      state.bossPortalShown = true
      text += `\n🌀 Un portal de salida se abrió aquí. Usa *${PREFIX}salir* si quieres irte con tu botín, o sigue explorando.`
    }
    if (state.pending === 'direction') text += `\n${mineDirectionHint()}`
    if (state.pending === 'direction') text += winterFlavor('dungeon') || narrativeLine('dungeon', jid)
  }
  return text + diary + (!ended ? dungeonView(state) : '')
}


// ===================================================================
// TARJETAS SVG (perfil / inventario / menu de comandos)
// ===================================================================
function starPoints(cx, cy, outerR, innerR, points) {
  let path = ''
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outerR : innerR
    const angle = (Math.PI / points) * i - Math.PI / 2
    const x = cx + rad * Math.cos(angle)
    const y = cy + rad * Math.sin(angle)
    path += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' '
  }
  return path + 'Z'
}

function badgeIconInner(itemId) {
  if (itemId === 'corona') {
    return '<path d="M-11,6 L-11,-1 L-6,-7 L0,-1 L6,-7 L11,-1 L11,6 Z" fill="#facc15" stroke="#92400e" stroke-width="1.3"/>' +
      '<circle cx="-6" cy="-7" r="2.2" fill="#fca5a5"/>' +
      '<circle cx="0" cy="-8" r="2.2" fill="#93c5fd"/>' +
      '<circle cx="6" cy="-7" r="2.2" fill="#86efac"/>'
  }
  if (itemId === 'leyenda') {
    return `<path d="${starPoints(0, 0, 12, 5, 5)}" fill="#facc15" stroke="#92400e" stroke-width="1.3"/>`
  }
  if (itemId === 'corazon') {
    return '<path d="M0,8 C-10,-1 -13,-9 -6,-12 C-2,-14 0,-10 0,-7 C0,-10 2,-14 6,-12 C13,-9 10,-1 0,8 Z" fill="#f87171" stroke="#7f1d1d" stroke-width="1.3"/>'
  }
  if (itemId === 'calabaza') {
    return '<ellipse cx="0" cy="1" rx="11" ry="9" fill="#fb923c" stroke="#7c2d12" stroke-width="1.3"/>' +
      '<path d="M-4,-7 Q-5,1 -4,8" stroke="#c2410c" stroke-width="1" fill="none"/>' +
      '<path d="M0,-8 Q0,1 0,9" stroke="#c2410c" stroke-width="1" fill="none"/>' +
      '<path d="M4,-7 Q5,1 4,8" stroke="#c2410c" stroke-width="1" fill="none"/>' +
      '<rect x="-1.5" y="-13" width="3" height="6" fill="#4d7c0f"/>'
  }
  if (itemId === 'estrella_navidad') {
    return `<path d="${starPoints(0, 0, 12, 5, 4)}" fill="#f87171" stroke="#7f1d1d" stroke-width="1.3"/>` +
      '<circle cx="0" cy="0" r="3" fill="#facc15"/>'
  }
  return `<path d="${starPoints(0, 0, 12, 5, 5)}" fill="#c084fc" stroke="#581c87" stroke-width="1.3"/>`
}

function badgeMedallion(itemId, cx, cy, ring) {
  const r = ring || 16
  return `<g transform="translate(${cx},${cy})"><circle r="${r}" fill="#2d1b4e" stroke="#c084fc" stroke-width="2"/><circle r="${r - 3}" fill="none" stroke="#facc15" stroke-width="1" opacity="0.5"/>${badgeIconInner(itemId)}</g>`
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]))
}

function fmtNum(amount) {
  return Math.floor(amount).toLocaleString('es-MX')
}

function formatCompact(amount) {
  const n = Math.floor(amount)
  const abs = Math.abs(n)
  if (abs >= 1000000000) return (n / 1000000000).toFixed(abs % 1000000000 === 0 ? 0 : 1) + 'B'
  if (abs >= 1000000) return (n / 1000000).toFixed(abs % 1000000 === 0 ? 0 : 1) + 'M'
  if (abs >= 1000) return (n / 1000).toFixed(abs % 1000 === 0 ? 0 : 1) + 'K'
  return String(n)
}

function commandIconGlyph(type) {
  const glyphs = {
    info: '<circle cx="0" cy="-5" r="2.3" fill="#fff"/><rect x="-2" y="-1" width="4" height="9" rx="1.5" fill="#fff"/>',
    note: '<circle cx="-4" cy="6" r="4" fill="#fff"/><rect x="0" y="-9" width="2.5" height="15" fill="#fff"/><path d="M0,-9 L9,-6 L9,-2 L0,-5 Z" fill="#fff"/>',
    coin: '<circle r="8" fill="none" stroke="#fff" stroke-width="2"/><text x="0" y="4" font-family="sans-serif" font-size="10" fill="#fff" text-anchor="middle" font-weight="bold">$</text>',
    chart: '<rect x="-8" y="0" width="4" height="8" fill="#fff"/><rect x="-2" y="-5" width="4" height="13" fill="#fff"/><rect x="4" y="-8" width="4" height="16" fill="#fff"/>',
    dice: '<rect x="-8" y="-8" width="16" height="16" rx="3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="-3" cy="-3" r="1.5" fill="#fff"/><circle cx="3" cy="3" r="1.5" fill="#fff"/><circle cx="0" cy="0" r="1.5" fill="#fff"/>',
    bag: '<path d="M-7,-2 L-7,8 L7,8 L7,-2 Z" fill="none" stroke="#fff" stroke-width="2"/><path d="M-4,-2 C-4,-7 4,-7 4,-2" fill="none" stroke="#fff" stroke-width="2"/>',
    shield: '<path d="M0,-9 L8,-6 L8,2 C8,7 4,10 0,11 C-4,10 -8,7 -8,2 L-8,-6 Z" fill="none" stroke="#fff" stroke-width="2"/>',
    lock: '<rect x="-5" y="-1" width="10" height="8" rx="1.5" fill="#fff"/><path d="M-3,-1 L-3,-4 C-3,-7 3,-7 3,-4 L3,-1" fill="none" stroke="#fff" stroke-width="2"/>',
    unlock: '<rect x="-5" y="-1" width="10" height="8" rx="1.5" fill="#fff"/><path d="M-3,-1 L-3,-5 C-3,-8 4,-8 4,-6" fill="none" stroke="#fff" stroke-width="2"/>',
    megaphone: '<path d="M-8,-2 L-2,-5 L6,-8 L6,6 L-2,3 L-8,2 Z" fill="#fff"/><rect x="-9" y="-2" width="2" height="4" fill="#fff"/>',
    crown: '<path d="M-8,4 L-8,-2 L-4,-6 L0,-2 L4,-6 L8,-2 L8,4 Z" fill="#fff"/>',
    warn: '<path d="M0,-9 L8,8 L-8,8 Z" fill="none" stroke="#fff" stroke-width="2"/><rect x="-1" y="-3" width="2" height="6" fill="#fff"/><circle cx="0" cy="5" r="1.3" fill="#fff"/>',
    toggle: '<rect x="-9" y="-5" width="18" height="10" rx="5" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="4" cy="0" r="3.5" fill="#fff"/>',
    gift: '<rect x="-7" y="-2" width="14" height="10" fill="#fff"/><rect x="-8" y="-5" width="16" height="4" fill="#fff"/>',
    kiss: '<path d="M0,5 C-6,0 -8,-4 -4,-7 C-1,-9 0,-6 0,-5 C0,-6 1,-9 4,-7 C8,-4 6,0 0,5 Z" fill="#fff"/>'
  }
  return glyphs[type] || '<circle r="4" fill="#fff"/>'
}

function buildCommandsMenuSvg(sections) {
  const width = 900
  const rowH = 46
  const headerH = 38
  let y = 66
  const parts = []
  for (const section of sections) {
    parts.push(`<rect x="30" y="${y}" width="840" height="${headerH - 8}" rx="8" fill="${section.color}" opacity="0.18"/>`)
    parts.push(`<text x="46" y="${y + 21}" font-family="sans-serif" font-size="15" font-weight="bold" fill="${section.color}" letter-spacing="1">${escapeXml(section.title)}</text>`)
    y += headerH
    for (const row of section.rows) {
      parts.push(`<rect x="30" y="${y}" width="840" height="${rowH - 6}" rx="8" fill="#ffffff" opacity="0.03"/>`)
      parts.push(`<rect x="42" y="${y + 6}" width="30" height="30" rx="8" fill="${section.color}"/>`)
      parts.push(`<g transform="translate(57,${y + 21})">${commandIconGlyph(row.icon)}</g>`)
      parts.push(`<text x="88" y="${y + 17}" font-family="sans-serif" font-size="14" font-weight="bold" fill="${section.color}">${escapeXml(row.cmd)}</text>`)
      parts.push(`<text x="88" y="${y + 33}" font-family="sans-serif" font-size="11" fill="#c9c3db">${escapeXml(row.desc)}</text>`)
      parts.push(`<text x="858" y="${y + 25}" font-family="monospace" font-size="11" fill="#5eead4" text-anchor="end">${escapeXml(row.usage)}</text>`)
      y += rowH
    }
    y += 10
  }
  const totalHeight = y + 24
  const svg = `<svg width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a0b2e"/>
      <stop offset="100%" stop-color="#3b0764"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${totalHeight}" fill="url(#bg)"/>
  <rect x="6" y="6" width="${width - 12}" height="${totalHeight - 12}" rx="18" fill="none" stroke="#c084fc" stroke-width="3"/>
  <text x="${width / 2}" y="42" font-family="sans-serif" font-size="25" font-weight="bold" fill="#f4effe" text-anchor="middle">COMANDOS DISPONIBLES</text>
  ${parts.join('')}
</svg>`
  return svg
}

function buildInventoryCardSvg(data) {
  const safeName = escapeXml(data.name).slice(0, 24)
  const buffCards = data.buffs.slice(0, 5).map((buff, i) => {
    const y = 140 + i * 60
    return `<rect x="200" y="${y}" width="500" height="46" rx="23" fill="#2d1b4e" stroke="#5eead4" stroke-width="2"/><text x="450" y="${y + 30}" font-family="sans-serif" font-size="18" fill="#5eead4" text-anchor="middle">${escapeXml(buff.label)}</text>`
  }).join('')
  const empty = !data.buffs.length
    ? '<circle cx="450" cy="220" r="36" fill="none" stroke="#5b3a8c" stroke-width="3" stroke-dasharray="6,6"/>' +
      '<text x="450" y="290" font-family="sans-serif" font-size="18" fill="#a495c9" text-anchor="middle">Sin efectos activos</text>' +
      `<text x="450" y="316" font-family="sans-serif" font-size="14" fill="#7c5ba6" text-anchor="middle">Compra un efecto temporal en ${PREFIX}tienda</text>`
    : ''
  return `<svg width="900" height="450" viewBox="0 0 900 450" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a0b2e"/>
      <stop offset="100%" stop-color="#3b0764"/>
    </linearGradient>
  </defs>
  <rect width="900" height="450" rx="28" fill="url(#bg)"/>
  <rect x="6" y="6" width="888" height="438" rx="22" fill="none" stroke="#c084fc" stroke-width="3"/>
  <text x="450" y="60" font-family="sans-serif" font-size="28" font-weight="bold" fill="#f4effe" text-anchor="middle">MOCHILA DE ${safeName}</text>
  ${data.tool ? `<text x="450" y="88" font-family="sans-serif" font-size="16" fill="#5eead4" text-anchor="middle">🛠️ ${escapeXml(data.tool)}</text>` : ''}
  <line x1="60" y1="${data.tool ? 100 : 85}" x2="840" y2="${data.tool ? 100 : 85}" stroke="#c084fc" stroke-width="1.5" opacity="0.4"/>
  <text x="450" y="420" font-family="sans-serif" font-size="13" fill="#7c5ba6" text-anchor="middle">Usa ${PREFIX}perfil para ver tus insignias</text>
  ${buffCards}
  ${empty}
</svg>`
}

const PROFILE_TEXT_MAX = 60
const PROFILE_QUOTES = [
  'La disciplina hoy es el exito de manana.',
  'No hay atajos para donde vale la pena llegar.',
  'Cada dia es una oportunidad para mejorar.',
  'El esfuerzo de hoy es el resultado de manana.',
  'Grandes cosas nunca vienen de la zona de confort.',
  'La constancia vence lo que la suerte no alcanza.'
]

function pseudoId(jid) {
  const str = String(jid || '')
  let hash = 0
  for (let i = 0; i < str.length; i++) { hash = (hash * 31 + str.charCodeAt(i)) >>> 0 }
  return String(100000000000 + (hash % 900000000000))
}

const MAX_LEVEL = 2000
const LEVEL_BASE_XP = 70
const LEVEL_RAMP_GROWTH = 1.75
const LEVEL_RAMP_LEVELS = 6
const LEVEL_TAIL_STEP = 1.1

function xpRequiredForLevel(n) {
  if (n <= LEVEL_RAMP_LEVELS) return Math.round(LEVEL_BASE_XP * Math.pow(LEVEL_RAMP_GROWTH, n - 1))
  const rampFinal = LEVEL_BASE_XP * Math.pow(LEVEL_RAMP_GROWTH, LEVEL_RAMP_LEVELS - 1)
  return Math.round(rampFinal + (n - LEVEL_RAMP_LEVELS) * LEVEL_TAIL_STEP)
}

function levelFromXp(xp) {
  let level = 1
  let remaining = xp
  while (level < MAX_LEVEL) {
    const need = xpRequiredForLevel(level)
    if (remaining < need) break
    remaining -= need
    level++
  }
  return level
}

const XP_MESSAGES_PER_LEVEL_TARGET = 75

function xpPerMessageForLevel(level) {
  const n = Math.min(Math.max(level, 1), MAX_LEVEL - 1)
  return Math.max(1, Math.round(xpRequiredForLevel(n) / XP_MESSAGES_PER_LEVEL_TARGET))
}

const DAILY_XP_DAY1 = 65
const DAILY_XP_DAY200 = 1300
const DAILY_XP_RAMP_DAYS = 200
const DAILY_XP_TAIL_STEP = 3

function dailyXpReward(day) {
  const d = Math.max(1, day)
  if (d <= DAILY_XP_RAMP_DAYS) {
    return Math.round(DAILY_XP_DAY1 + (d - 1) * (DAILY_XP_DAY200 - DAILY_XP_DAY1) / (DAILY_XP_RAMP_DAYS - 1))
  }
  return Math.round(DAILY_XP_DAY200 + (d - DAILY_XP_RAMP_DAYS) * DAILY_XP_TAIL_STEP)
}

const LEVEL_ERAS = [
  { min: 1, max: 99, shape: 'bars', color: '#a3672a', name: 'Aprendiz' },
  { min: 100, max: 249, shape: 'shield', color: '#9ca3af', name: 'Veterano' },
  { min: 250, max: 499, shape: 'star', color: '#facc15', name: 'Experto' },
  { min: 500, max: 999, shape: 'diamond', color: '#22c55e', name: 'Maestro' },
  { min: 1000, max: 1499, shape: 'crown', color: '#a855f7', name: 'Elite' },
  { min: 1500, max: 1999, shape: 'flame', color: '#ef4444', name: 'Leyenda' },
  { min: 2000, max: 2000, shape: 'gem', color: '#38bdf8', name: 'Supremo' }
]
const LEVEL_PIP_STEP = 5
const LEVEL_MAX_PIPS = 6

function levelTierForLevel(level) {
  const capped = Math.min(Math.max(level, 1), MAX_LEVEL)
  const era = LEVEL_ERAS.find(e => capped >= e.min && capped <= e.max) || LEVEL_ERAS[LEVEL_ERAS.length - 1]
  const stageInEra = Math.floor((capped - era.min) / LEVEL_PIP_STEP)
  return {
    name: era.name,
    color: era.color,
    shape: era.shape,
    pips: Math.min(stageInEra, LEVEL_MAX_PIPS),
    iconStage: stageInEra < 2 ? 0 : stageInEra < 4 ? 1 : 2,
    maxedOut: stageInEra > LEVEL_MAX_PIPS
  }
}

function levelBadgePips(pips, color) {
  let out = ''
  for (let i = 0; i < LEVEL_MAX_PIPS; i++) {
    const angle = (-150 + i * (120 / (LEVEL_MAX_PIPS - 1))) * Math.PI / 180
    const x = (17 * Math.cos(angle)).toFixed(1)
    const y = (17 * Math.sin(angle)).toFixed(1)
    out += i < pips
      ? `<circle cx="${x}" cy="${y}" r="1.9" fill="${color}" filter="url(#glow)"/>`
      : `<circle cx="${x}" cy="${y}" r="1.4" fill="rgba(255,255,255,0.15)"/>`
  }
  return out
}

function levelBadgeIconInner(shape, stage) {
  const fill = stage >= 2 ? 'url(#iconGradHigh)' : stage === 1 ? 'url(#iconGradMid)' : '#0b1410'
  const glowAttr = stage >= 2 ? ' filter="url(#glow)"' : ''
  const a = `fill="${fill}" stroke="rgba(255,255,255,0.4)" stroke-width="0.6"${glowAttr}`
  switch (shape) {
    case 'bars': return `<rect x="-7" y="1" width="4" height="7" ${a}/><rect x="-1" y="-4" width="4" height="12" ${a}/><rect x="5" y="-7" width="4" height="15" ${a}/>`
    case 'star': return `<path d="M0,-9 L2.1,-3.1 L8.2,-2.8 L3.4,1.3 L5.1,7.4 L0,3.9 L-5.1,7.4 L-3.4,1.3 L-8.2,-2.8 L-2.1,-3.1 Z" ${a}/>`
    case 'shield': return `<path d="M0,-8 L6.5,-4.9 L6.5,1.6 Q6.5,7.3 0,9 Q-6.5,7.3 -6.5,1.6 L-6.5,-4.9 Z" ${a}/>`
    case 'diamond': return `<path d="M0,-8 L5.7,0 L0,8 L-5.7,0 Z" ${a}/>`
    case 'ring': return `<circle r="6.5" fill="none" stroke="${fill}" stroke-width="3"/>`
    case 'crown': return `<path d="M-7,4 L-7,-1 L-4,-5 L0,-1 L4,-5 L7,-1 L7,4 Z" ${a}/>`
    case 'flame': return `<path d="M0,-8 Q4,-2 2.4,1.6 Q5.6,0 4.8,4.8 Q2.4,8.8 0,8.8 Q-2.4,8.8 -4.8,4.8 Q-5.6,0 -2.4,1.6 Q-4,-2 0,-8 Z" ${a}/>`
    case 'gem': return `<path d="M-6.5,-3.2 L-3.2,-7.2 L3.2,-7.2 L6.5,-3.2 L0,8 Z" ${a}/>`
    default: return `<circle r="7" ${a}/>`
  }
}function hexPoints(cx, cy, r) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 90)
    pts.push((cx + r * Math.cos(angle)).toFixed(1) + ',' + (cy + r * Math.sin(angle)).toFixed(1))
  }
  return pts.join(' ')
}

function levelBadgeMedallion(cx, cy, tier, levelLabel, tierLabel) {
  const R = 22
  const rightX = (0.866 * R).toFixed(1)
  const spike = (tx, ty, rot) => `<g transform="translate(${tx},${ty}) rotate(${rot})"><path d="M0,-9 L5,1.5 L0,5 L-5,1.5 Z" fill="url(#chromeGrad)" stroke="#000000" stroke-width="0.6"/></g>`
  const spikes = spike(cx, cy - R, 0) + spike(cx, cy + R, 180) + spike((+cx + +rightX).toFixed(1), cy, 90) + spike((cx - rightX).toFixed(1), cy, -90)
  return `<polygon points="${hexPoints(cx, cy, R + 1.5)}" fill="#000000" opacity="0.55"/><polygon points="${hexPoints(cx, cy, R)}" fill="none" stroke="url(#chromeGrad)" stroke-width="5"/><polygon points="${hexPoints(cx, cy, R - 3.2)}" fill="none" stroke="#04060a" stroke-width="1.5"/><polygon points="${hexPoints(cx, cy, R - 4)}" fill="none" stroke="${tier.color}" stroke-width="1.1" opacity="0.85" filter="url(#glow)"/><polygon points="${hexPoints(cx, cy, R - 4.8)}" fill="#05070a"/>${spikes}<g transform="translate(${cx},${cy}) scale(0.75)">${levelBadgeIconInner(tier.shape, tier.iconStage)}</g><g transform="translate(${cx},${cy})">${levelBadgePips(tier.pips, tier.color)}</g><text x="${cx}" y="${cy + 34}" font-family="sans-serif" font-size="10" font-weight="bold" fill="#f2fff7" text-anchor="middle">${levelLabel}</text><text x="${cx}" y="${cy + 45}" font-family="sans-serif" font-size="8" fill="${tier.color}" text-anchor="middle">${tierLabel}</text>`
}

function buildProfileCardSvg(data) {
  const safeName = escapeXml(data.name).slice(0, 20)
  const initial = escapeXml((data.name || '?').trim().charAt(0).toUpperCase() || '?')
  const roleColors = { Owner: '#facc15', Administrador: '#a855f7', Miembro: '#2dd4bf' }
  const roleColor = roleColors[data.role] || roleColors.Miembro
  const avatar = data.avatarDataUri
    ? `<image href="${data.avatarDataUri}" x="88" y="78" width="124" height="124" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<text x="150" y="152" font-family="sans-serif" font-size="46" font-weight="bold" text-anchor="middle" fill="#eafff2">${initial}</text>`
  const badgeColors = ['#facc15', '#a855f7', '#38bdf8', '#22c55e', '#f472b6']
  const badgeSlots = [{ cx: 705, cy: 140 }, { cx: 775, cy: 140 }, { cx: 845, cy: 140 }, { cx: 740, cy: 232 }, { cx: 810, cy: 232 }]
  const badgeList = (data.badges || []).slice(0, 4)
  const badgeGroups = [{ isLevel: true }, ...badgeList].map((badge, i) => {
    const slot = badgeSlots[i]
    if (badge.isLevel) {
      const tier = data.levelTier
      const levelLabel = escapeXml(`Nivel ${data.level}`)
      const tierLabel = escapeXml(tier.name).slice(0, 12)
      return levelBadgeMedallion(slot.cx, slot.cy, tier, levelLabel, tierLabel)
    }
    const color = badgeColors[i % badgeColors.length]
    const label = escapeXml(badge.name).slice(0, 9)
    return `<polygon points="${hexPoints(slot.cx, slot.cy, 22)}" fill="#081a10" stroke="${color}" stroke-width="2" filter="url(#glow)"/><g transform="translate(${slot.cx},${slot.cy})">${badgeIconInner(badge.id)}</g><text x="${slot.cx}" y="${slot.cy + 36}" font-family="sans-serif" font-size="9" fill="#8fb8a4" text-anchor="middle">${label}</text>`
  }).join('')
  const quote = data.customQuote || PROFILE_QUOTES[Math.floor(Date.now() / 86400000) % PROFILE_QUOTES.length]
  const timeLabel = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' }).format(new Date())
  return `<svg width="920" height="400" viewBox="0 0 920 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1811"/>
      <stop offset="100%" stop-color="#050b07"/>
    </linearGradient>
    <radialGradient id="avatarGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#22c55e" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="avatarClip"><circle cx="150" cy="140" r="62"/></clipPath>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3.2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="chromeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f3f4f6"/>
      <stop offset="20%" stop-color="#9ca3af"/>
      <stop offset="45%" stop-color="#e5e7eb"/>
      <stop offset="55%" stop-color="#6b7280"/>
      <stop offset="80%" stop-color="#d1d5db"/>
      <stop offset="100%" stop-color="#4b5563"/>
    </linearGradient>
    <linearGradient id="iconGradMid" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3a4149"/>
      <stop offset="100%" stop-color="#12161a"/>
    </linearGradient>
    <linearGradient id="iconGradHigh" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e5e7eb"/>
      <stop offset="55%" stop-color="#6b7280"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="920" height="400" rx="28" fill="url(#bg)"/>
  <text x="460" y="290" font-family="Georgia, serif" font-size="260" font-weight="bold" fill="#0f2517" text-anchor="middle" opacity="0.5">N</text>
  <rect x="5" y="5" width="910" height="390" rx="24" fill="none" stroke="#22c55e" stroke-width="1.5" opacity="0.7" filter="url(#glow)"/>
  <path d="M20,44 L20,20 L44,20" fill="none" stroke="#22c55e" stroke-width="2" opacity="0.6"/>
  <path d="M900,356 L900,380 L876,380" fill="none" stroke="#22c55e" stroke-width="2" opacity="0.6"/>
  <circle cx="150" cy="140" r="92" fill="url(#avatarGlow)"/>
  <circle cx="150" cy="140" r="65" fill="none" stroke="#22c55e" stroke-width="3" filter="url(#glow)"/>
  ${avatar}
  <circle cx="194" cy="184" r="9" fill="#22c55e" stroke="#050b07" stroke-width="3"/>
  <text x="150" y="223" font-family="sans-serif" font-size="21" font-weight="bold" text-anchor="middle" fill="#f2fff7">${safeName}</text>
  <rect x="75" y="234" width="150" height="25" rx="12.5" fill="${roleColor}" opacity="0.18" stroke="${roleColor}" stroke-width="1.3"/>
  <g transform="translate(96,246) scale(0.55)"><path d="M-8,4 L-8,-2 L-4,-6 L0,-2 L4,-6 L8,-2 L8,4 Z" fill="${roleColor}"/></g>
  <text x="155" y="251" font-family="sans-serif" font-size="12" font-weight="bold" fill="${roleColor}" text-anchor="middle">${escapeXml(data.role || 'Miembro')}</text>
  <text x="150" y="282" font-family="monospace" font-size="10.5" fill="#5f8a72" text-anchor="middle">ID: ${escapeXml(data.pseudoId || '')}</text>
  <line x1="270" y1="30" x2="270" y2="370" stroke="#1f4d33" stroke-width="1" stroke-dasharray="4,4"/>
  <rect x="300" y="34" width="140" height="62" rx="12" fill="#0c1e14" stroke="#facc15" stroke-width="1.3"/>
  <circle cx="330" cy="65" r="17" fill="#facc15" opacity="0.15" stroke="#facc15" stroke-width="1.2"/>
  <g transform="translate(330,65) scale(0.75)">${commandIconGlyph('coin').replace(/#fff/g, '#facc15')}</g>
  <text x="354" y="58" font-family="sans-serif" font-size="8.5" fill="#facc15" letter-spacing="0.5">DINERO TOTAL</text>
  <text x="354" y="78" font-family="sans-serif" font-size="16" font-weight="bold" fill="#f2fff7">${fmtNum(data.total)}</text>
    <rect x="460" y="34" width="140" height="62" rx="12" fill="#0c1c22" stroke="#38bdf8" stroke-width="1.3"/>
  <path d="M490,50 L508,65 L490,80 L472,65 Z" fill="#38bdf8" opacity="0.18" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="490" y="69" font-family="sans-serif" font-size="9" font-weight="bold" fill="#38bdf8" text-anchor="middle">XP</text>
  <text x="514" y="58" font-family="sans-serif" font-size="8.5" fill="#38bdf8" letter-spacing="0.5">XP TOTAL</text>
  <text x="514" y="78" font-family="sans-serif" font-size="16" font-weight="bold" fill="#f2fff7">${formatCompact(data.xp)} XP</text>
  <g transform="translate(316,104)"><circle r="13" fill="#3b82f6"/><g transform="scale(0.78)"><rect x="-7" y="-6" width="14" height="13" rx="2" fill="none" stroke="#fff" stroke-width="2"/><line x1="-7" y1="-2" x2="7" y2="-2" stroke="#fff" stroke-width="2"/><line x1="-4" y1="-8" x2="-4" y2="-5" stroke="#fff" stroke-width="2"/><line x1="4" y1="-8" x2="4" y2="-5" stroke="#fff" stroke-width="2"/></g></g>
  <text x="338" y="108" font-family="sans-serif" font-size="11.5" fill="#c9e8d8">Se unio al grupo</text>
  <text x="600" y="108" font-family="sans-serif" font-size="11.5" font-weight="bold" fill="#f2fff7" text-anchor="end">${data.joinedDateLabel}</text>
  <g transform="translate(316,140)"><circle r="13" fill="#22c55e"/><g transform="scale(0.78)"><path d="M-8,-6 L8,-6 L8,3 L0,3 L-4,7 L-4,3 L-8,3 Z" fill="none" stroke="#fff" stroke-width="2"/></g></g>
  <text x="338" y="144" font-family="sans-serif" font-size="11.5" fill="#c9e8d8">Mensajes enviados</text>
  <text x="600" y="144" font-family="sans-serif" font-size="11.5" font-weight="bold" fill="#f2fff7" text-anchor="end">${fmtNum(data.messageCount)}</text>
  <g transform="translate(316,176)"><circle r="13" fill="#06b6d4"/><g transform="scale(0.78)"><circle r="7" fill="none" stroke="#fff" stroke-width="1.8"/><line x1="0" y1="0" x2="0" y2="-4.5" stroke="#fff" stroke-width="1.8"/><line x1="0" y1="0" x2="3" y2="1.5" stroke="#fff" stroke-width="1.8"/></g></g>
  <text x="338" y="180" font-family="sans-serif" font-size="11.5" fill="#c9e8d8">Tiempo en el grupo</text>
  <text x="600" y="180" font-family="sans-serif" font-size="11.5" font-weight="bold" fill="#f2fff7" text-anchor="end">${data.daysActive} dias</text>  <g transform="translate(316,212)"><circle r="13" fill="${data.levelTier.color}"/><g transform="scale(0.78)">${levelBadgeIconInner(data.levelTier.shape, data.levelTier.iconStage)}</g>${levelBadgePips(data.levelTier.pips, data.levelTier.color)}${data.levelTier.maxedOut ? `<circle r="15.5" fill="none" stroke="${data.levelTier.color}" stroke-width="1" opacity="0.5"/>` : ''}</g>
  <text x="338" y="216" font-family="sans-serif" font-size="11.5" fill="#c9e8d8">Nivel en el grupo</text>
  <text x="580" y="216" font-family="sans-serif" font-size="11.5" font-weight="bold" fill="#f2fff7" text-anchor="end">${data.level}</text>
  <path d="M594,206 L595.5,209.5 L599,210 L596.5,212.5 L597,216 L594,214.3 L591,216 L591.5,212.5 L589,210 L592.5,209.5 Z" fill="${data.levelTier.color}"/>
  <text x="580" y="227" font-family="sans-serif" font-size="8" fill="${data.levelTier.color}" text-anchor="end">${escapeXml(data.levelTier.name)}</text>
  <g transform="translate(316,248)"><circle r="13" fill="#f97316"/><g transform="scale(0.78)"><path d="M0,-9 C4,-5 6,-1 3,3 C4,1 2,-1 1,0 C2,3 -1,5 -3,3 C-6,0 -4,-3 -1,-6 C-2,-4 0,-4 0,-9 Z" fill="#fff"/></g></g>
  <text x="338" y="252" font-family="sans-serif" font-size="11.5" fill="#c9e8d8">Racha diaria</text>
  <text x="600" y="252" font-family="sans-serif" font-size="11.5" font-weight="bold" fill="#f2fff7" text-anchor="end">${data.streak} dias</text>
  <g transform="translate(316,284)"><circle r="13" fill="#eab308"/><g transform="scale(0.78)">${commandIconGlyph('warn')}</g></g>
  <text x="338" y="288" font-family="sans-serif" font-size="11.5" fill="#c9e8d8">Advertencias</text>
  <text x="600" y="288" font-family="sans-serif" font-size="11.5" font-weight="bold" fill="#f2fff7" text-anchor="end">${data.warnings}</text>
  <line x1="620" y1="30" x2="620" y2="370" stroke="#1f4d33" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="655" y1="55" x2="715" y2="55" stroke="#1f4d33" stroke-width="1" stroke-dasharray="3,3"/>
  <text x="775" y="59" font-family="sans-serif" font-size="11" fill="#4ade80" text-anchor="middle" letter-spacing="2">INSIGNIAS</text>
  <line x1="835" y1="55" x2="895" y2="55" stroke="#1f4d33" stroke-width="1" stroke-dasharray="3,3"/>
  ${badgeGroups}
  <rect x="20" y="320" width="880" height="52" rx="12" fill="#0a1a10" stroke="#1f4d33" stroke-width="1"/>
  <text x="34" y="352" font-family="Georgia, serif" font-size="28" fill="#3fae70" opacity="0.6">\u201C</text>
  <text x="460" y="351" font-family="sans-serif" font-size="12" font-style="italic" fill="#c9e8d8" text-anchor="middle">${escapeXml(quote)}</text>
  <text x="886" y="364" font-family="sans-serif" font-size="10" fill="#4d6b5a" text-anchor="end">${timeLabel}</text>
</svg>`
}
function hasActiveBuff(inventory, buffId) {
  const expiresAt = inventory.buffs[buffId]
  return typeof expiresAt === 'number' && expiresAt > Date.now()
}

const COMPANY_TICK_MS = 5 * 60 * 1000
const COMPANY_HISTORY_LIMIT = 40
const COMPANY_SUFFIXES = ['Corp', 'Holdings', 'Industries', 'Group', 'Tech', 'Ventures']
const COMPANY_SECTORS = [
  { name: 'Tecnología', volatility: 0.08 },
  { name: 'Retail', volatility: 0.05 },
  { name: 'Finanzas', volatility: 0.04 },
  { name: 'Energía', volatility: 0.06 },
  { name: 'Entretenimiento', volatility: 0.07 }
]
const COMPANY_CHART_COLORS = ['#22c55e', '#3b82f6', '#f97316']
const ECONOMY_LAUNCH_AT = new Date('2026-08-25T00:00:00-06:00').getTime()

// ===================================================================
// ECONOMIA: CONSTANTES Y UTILIDADES GENERALES
// ===================================================================
const ECONOMY_COMMANDS = new Set(['saldo', 'balance', 'bal', 'perfil', 'profile', 'changetext', 'frase', 'dep', 'deposito', 'retirar', 'withdraw', 'rob', 'work', 'trabajar', 'blackjack', 'bj', 'pedir', 'plantarse', 'doblar', 'comprar', 'vender', 'empresas', 'empresa', 'tienda', 'inventario', 'daily', 'diario', 'top', 'ricos', 'enviar', 'transferir', 'slots', 'tragamonedas'])
function formatCountdown(targetMs) {
  const diff = Math.max(0, targetMs - Date.now())
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return `${days}d ${hours}h ${minutes}m ${seconds}s`
}
function getEconomyBetaMessage() {
  return `╭━━━━━━━━━━━━━━━━━━━━━━╮
🧪 ✦ *ECONOMÍA EN FASE DE PRUEBAS* ✦ 🧪
╰━━━━━━━━━━━━━━━━━━━━━━╯

✅ Ya puedes usar el sistema de ${CURRENCY_NAME} libremente (saldo, banco, robos, empresas, etc.)

🐞 Esta fase es para detectar errores. Si algo falla o se ve raro, avisa al staff.

⚠️ *El 25 de agosto se reinicia todo*: saldo, banco, inventario y XP de las pruebas, para que todos empiecen parejo cuando abra oficialmente.

🙏 ¡Gracias por ayudarnos a probarlo!`
}
const WELCOME_GROUP_NAMES = (process.env.WELCOME_GROUP_NAMES || '')
  .split(',')
  .map(name => name.trim().toLocaleLowerCase())
  .filter(Boolean)
const MEMBER_FORM_GROUP_NAMES = (process.env.MEMBER_FORM_GROUP_NAMES || 'Lobby')
  .split(',')
  .map(name => name.trim().toLocaleLowerCase())
  .filter(Boolean)
const MEMBER_FORM_IMAGE_PATH = path.resolve(process.env.MEMBER_FORM_IMAGE_PATH || './assets/lobby.png')
const MEMBER_FORM_MESSAGE = `🐲 ۝☬ *FICHA DE MIEMBRO — NURUXIÓN LEGIÓN* ☬۝🐲

👋 @user, copia esta ficha, complétala y envíala en este grupo.

┌─────────────────────────┐
│ ✦ *DATOS GENERALES* ✦
│
│ 📛 *Nombre:* __________
│ 🎂 *Edad:* ____
│ 🌎 *País:* __________
│
│ 📛 *Apodo:* ___________
│ 🎮 *Usuario Roblox:* ________
│ 📅 *Cumpleaños:* ________
│
│ 🖼️ *Avatar / Foto de perfil:*
└─────────────────────────┘`

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
// Baileys genera miles de líneas de sincronización que consumen CPU y vuelven
// ilegible la consola. Conservamos únicamente advertencias y errores.
const baileysLogger = logger.child({ module: 'baileys' }, { level: process.env.BAILEYS_LOG_LEVEL || 'warn' })
const groupCache = new NodeCache({ stdTTL: 300, useClones: false })
let reconnectTimer = null
let reconnectAttempts = 0
let starting = false
let pairingRequested = false
let runtimeState = { enabled: true, conversationTopics: {}, warnings: {}, suggestions: {}, muted: {}, antilink: {}, activityPoints: {}, activityPointHistory: [], processedPointCommands: {}, activityMessages: {}, activityAwards: {}, pendingDonations: {}, marriages: {}, staffApplications: {} }
const musicCommand = createMusicSystem({
  catalogPath: MUSIC_CATALOG_PATH,
  musicDir: MUSIC_DIR,
  ffmpegPath,
  fallback: DEFAULT_MUSIC_CATALOG,
  onError: error => logger.warn({ message: error.message }, 'No se pudo completar la operación de música')
})
let currentSock = null
let consoleBroadcastStarted = false
let nightScheduleStarted = false
let activitySaveTimer = null
let knowledgeCache = {}
const questionMemory = new Map()
const aiConversationMemory = new Map()
const limitQuestion = createQuestionLimiter()
const QUESTION_TTL = 15 * 60_000
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of questionMemory) if (entry.expiresAt <= now) questionMemory.delete(key)
  for (const [key, entry] of aiConversationMemory) if (entry.expiresAt <= now) aiConversationMemory.delete(key)
}, 60_000).unref()
const kissCooldowns = new Map()
const punchCooldowns = new Map()
const punchPending = new Map()
const PUNCH_RETURN_TTL_MS = 5 * 60 * 1000
const marriageProposals = new Map()
const MARRIAGE_PROPOSAL_TTL_MS = 5 * 60 * 1000
const WEDDING_GIFT_TYPES = ['dinero', 'banco', 'escudo', 'xp', 'impulso', 'indulto']
const WEDDING_GIFT_MAX_COUNT = 3
let economyState = { halloween2026: null, wallets: {}, robCooldowns: {}, workCooldowns: {}, workUsage: {}, blackjackGames: {}, companies: {}, inventory: {}, dailyCooldowns: {}, firstSeenAt: {}, dailyStreaks: {}, messageCounts: {}, xp: {}, customQuotes: {}, groupJoinedAt: {}, launchResetDone: false, betaWarningShown: {}, shopStock: {}, loans: {}, explore: {}, mine: {}, mineMiracleUsed: false, mineDestroyed: false }
const math = createMath(mathFunctions, { number: 'number', precision: 64 })
const ALLOWED_MATH_FUNCTIONS = new Set(['abs', 'acos', 'asin', 'atan', 'ceil', 'combinations', 'cos', 'exp', 'factorial', 'floor', 'gcd', 'lcm', 'log', 'log10', 'max', 'min', 'nthRoot', 'permutations', 'round', 'sin', 'sqrt', 'tan'])


// ===================================================================
// IA: EVALUADOR DE EXPRESIONES MATEMATICAS Y TEXTO
// ===================================================================
function normalizedText(value = '') {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

function normalizedMathExpression(value = '') {
  return normalizedText(value)
    .replace(/^\*\*([\s\S]*)\*\*$/, '$1')
    .replace(/^__([\s\S]*)__$/, '$1')
    .replace(/^```([\s\S]*)```$/, '$1')
    .replace(/^[*~`]([\s\S]*)[*~`]$/, '$1')
    .replace(/[¿?]/g, '')
    .replace(/^(?:resuelve|calcula|cuanto es|cual es|cuanto da|resultado de|encuentra (?:el )?valor de x(?: en)?|halla x(?: en)?)\s*[:=]?\s*/i, '')
    .replace(/\s+(?:encuentra|halla|calcula)\s+(?:el\s+)?(?:valor\s+de\s+)?x\s*$/i, '')
    .replace(/\bpor ciento\b/g, '%')
    .replace(/\belevado a\b/g, '^')
    .replace(/\bentre\b/g, '/')
    .replace(/\bpor\b/g, '*')
    .replace(/\braiz cuadrada de\s*([\d.]+)/g, 'sqrt($1)')
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/−|–|—/g, '-')
    .replace(/(\d),(\d)/g, '$1.$2')
    .trim()
}

function validateMathTree(node, allowVariable = false) {
  let count = 0
  node.traverse(child => {
    count += 1
    if (count > 100) throw new Error('Expresión demasiado compleja')
    if (child.isFunctionNode && !ALLOWED_MATH_FUNCTIONS.has(child.fn?.name || '')) throw new Error('Función no permitida')
    if (child.isSymbolNode && !['pi', 'e', 'i', ...(allowVariable ? ['x'] : [])].includes(child.name)) throw new Error('Variable no permitida')
    if (child.isAssignmentNode || child.isAccessorNode || child.isBlockNode || child.isObjectNode) throw new Error('Operación no permitida')
  })
}

function evaluateSafeMath(expression, scope = {}, allowVariable = false) {
  if (!expression || expression.length > 200) throw new Error('Expresión vacía o demasiado larga')
  const node = math.parse(expression)
  validateMathTree(node, allowVariable)
  return node.evaluate(scope)
}

function solveMathQuestion(question) {
  const expression = normalizedMathExpression(question)
  if (!/[\d=+\-*/^()%]|(?:sqrt|sin|cos|tan|log|factorial|combinations|permutations)/.test(expression)) return null
  try {
    if (expression.includes('=')) {
      const parts = expression.split('=')
      if (parts.length !== 2 || !expression.includes('x')) return null
      const difference = x => Number(evaluateSafeMath(`(${parts[0]})-(${parts[1]})`, { x }, true))
      const y0 = difference(0)
      const y1 = difference(1)
      const y2 = difference(2)
      const a = (y2 - 2 * y1 + y0) / 2
      const b = y1 - y0 - a
      const c = y0
      const expectedY3 = 9 * a + 3 * b + c
      if (![a, b, c, expectedY3].every(Number.isFinite) || Math.abs(difference(3) - expectedY3) > 1e-7) return '🧮 Puedo resolver ecuaciones lineales y cuadráticas con la variable *x*. Esta ecuación necesita un sistema algebraico más avanzado.'
      if (Math.abs(a) < 1e-12) {
        if (Math.abs(b) < 1e-12) return Math.abs(c) < 1e-12 ? '🧮 La igualdad es verdadera para cualquier valor de *x*.' : '🧮 La ecuación no tiene solución.'
        return `🧮 *Ecuación lineal*\n\n${expression}\n\n*x = ${math.format(-c / b, { precision: 14 })}*`
      }
      const discriminant = b * b - 4 * a * c
      const root = math.sqrt(discriminant)
      const x1 = math.divide(math.add(-b, root), 2 * a)
      const x2 = math.divide(math.subtract(-b, root), 2 * a)
      return `🧮 *Ecuación cuadrática*\n\n${expression}\n\n*x₁ = ${math.format(x1, { precision: 14 })}*\n*x₂ = ${math.format(x2, { precision: 14 })}*`
    }
    const result = evaluateSafeMath(expression)
    return `🧮 *Cálculo*\n\n${expression}\n\n*Resultado: ${math.format(result, { precision: 14 })}*`
  } catch {
    return null
  }
}


// ===================================================================
// MUSICA: CATALOGO (?musica / ?play)
// ===================================================================


// ===================================================================
// IA: BASE DE CONOCIMIENTO (preguntas frecuentes, Wikipedia, etc.)
// ===================================================================
function answerCommonQuestion(question) {
  let text = normalizedText(question)
  if (!text) return `Escribe una pregunta después del comando. Ejemplo: *${PREFIX}ia ¿cómo uso el tag?*`
  const greetingMatch = text.match(/^(?:hola|buenas|hey|holi)\b[,!.\s]*/)
  if (greetingMatch) {
    const remainder = text.slice(greetingMatch[0].length).trim()
    if (!remainder) {
      return '🌙 ¡Hola! Soy el asistente de Nuruxion Legión. Puedes preguntarme cómo funcionan los comandos o escribir *?comandos*.'
    }
    if (/^(c[oó]mo\s+est[aá]s|que\s+tal|c[oó]mo\s+te\s+va|c[oó]mo\s+andas)/.test(remainder)) {
      return '🌙 ¡Hola! Muy bien, gracias por preguntar 😄 Aquí ando ayudando en Nuruxion Legión. ¿Y tú, cómo estás? Si necesitas algo escribe *?comandos*.'
    }
    text = remainder
  }
  if (/^(c[oó]mo\s+est[aá]s|que\s+tal|c[oó]mo\s+te\s+va|c[oó]mo\s+andas)[?!. ]*$/.test(text)) {
    return '¡Muy bien! Con energía para seguir ayudando y mejorando Nuruxion 😄 ¿Cómo estás tú?'
  }
  if (/^(estoy\s+(bien|mal|cansad|feliz|triste)|ando\s+(bien|mal)|m[aá]s\s+o\s+menos)/.test(text)) {
    if (/mal|triste|cansad/.test(text)) return 'Entiendo 😕 Si quieres contarme qué pasó, te escucho. También podemos distraernos resolviendo algo o hablando de programación, juegos o Nuruxion.'
    return '¡Me alegra saberlo! 😄 ¿En qué te ayudo ahora: programación, Nuruxion o alguna duda general?'
  }
  if (/^(que\s+haces|qu[eé]\s+puedes\s+hacer)[?!. ]*$/.test(text)) {
    return 'Puedo conversar contigo, explicar temas, ayudarte con programación, revisar errores, comparar opciones, resolver cálculos y orientarte con los sistemas de Nuruxion. Dime qué quieres hacer y lo analizamos juntos.'
  }
  const hasQuestionMarkers = /[?¿]|\b(que|qué|como|cómo|por que|por qué|cuando|cuándo|donde|dónde|quien|quién|cual|cuál|cuanto|cuánto)\b/.test(text)
  const hasBanterMarkers = /\b(xd+|jaja+|jaj+|jeje+|jsjs+|lol|lmao|jajas)\b/.test(text)
  if (hasBanterMarkers && !hasQuestionMarkers) {
    return '😂 Jajaja, va. Si tienes alguna pregunta real dímela y la reviso.'
  }
  if (text.includes('quien eres') || text.includes('que eres')) return '🐉 Soy el asistente automático de Nuruxion Legión. Ayudo con los comandos, la bienvenida y preguntas frecuentes del grupo.'
  if (/chatgpt|\bgpt\b|\bllm\b|modelo de lenguaje|como razona|como piensa (la ia|chatgpt)|como funciona (la ia|chatgpt|una ia)/.test(text)) {
    return '🧠 *¿Qué tiene programado ChatGPT para razonar?*\n\n' +
      '*1.* Es un modelo de lenguaje grande (LLM), entrenado con una técnica llamada red neuronal *transformer*. En vez de tener reglas escritas a mano (como "si dice \'hola\' responde X"), el modelo tiene miles de millones de parámetros — números ajustables que capturan patrones del lenguaje.\n\n' +
      '*2.* Se entrena prediciendo la siguiente palabra, una y otra vez, sobre una cantidad enorme de texto (libros, artículos, código, conversaciones — una fracción significativa de todo el internet escrito). Al hacer esto miles de millones de veces, el modelo no memoriza frases, sino que aprende patrones profundos: gramática, hechos, relaciones lógicas, cómo se estructura un argumento, cómo se resuelve un problema paso a paso.\n\n' +
      '*3.* De ahí sale el "razonamiento": no es que tenga una regla de "cómo razonar" programada explícitamente. Es que, al haber visto tantísimos ejemplos de gente explicando, comparando, resolviendo problemas y generando analogías, el modelo aprendió a generalizar ese patrón y aplicarlo a preguntas que nunca vio exactamente igual antes.\n\n' +
      '*4.* Después se afina para conversar bien (instruction tuning / RLHF): humanos califican miles de respuestas del modelo, y se ajusta para que prefiera respuestas útiles, claras y bien estructuradas — así es como termina sonando "razonado" y no solo una lista de datos.\n\n' +
      '💬 Yo, en cambio, uso reglas programadas + Wikipedia — puedo acercarme al tono, pero no generar algo genuinamente nuevo como un LLM real.'
  }
  if (text.includes('comando') || text.includes('menu') || text.includes('ayuda')) return '📋 Escribe *?comandos* para ver el menú completo y los permisos necesarios.'
  if (text.includes('tag') || text.includes('mencionar') || text.includes('everyone')) return '🏷️ Usa *?tag mensaje* para notificar a todos, o *?tag @usuario mensaje* para mencionar solamente a esa persona. Solo administradores/owner pueden usarlo.'
  if (text.includes('cerrar') || text.includes('close')) return '🔒 Un administrador puede escribir *?close* para permitir que solo los administradores envíen mensajes.'
  if (text.includes('abrir') || text.includes('open')) return '🔓 Un administrador puede escribir *?open* para permitir nuevamente que todos envíen mensajes.'
  if (text.includes('admin') || text.includes('promover')) return '👑 Responde al mensaje de una persona o menciónala y escribe *?adminuser*. El bot también debe ser administrador.'
  if (text.includes('bienvenida') || text.includes('nuevo') || text.includes('entrar')) return '👋 La bienvenida decorada se envía automáticamente cuando una persona entra al grupo configurado como *General*. Un administrador puede verla con *?prueba*.'
  if (text.includes('musica') || text.includes('cancion') || text.includes('audio')) return '🎵 Usa *?musica artista o canción*. El bot envía audio únicamente desde el catálogo autorizado; para música comercial comparte enlaces oficiales.'
  if (text.includes('activar') || text.includes('encender') || text === 'on') return '✅ Un administrador puede activar el bot con *?on*.'
  if (text.includes('apagar') || text.includes('desactivar') || text === 'off') return '⏸️ Un administrador puede pausar comandos y bienvenidas con *?off*. Después solo responderá a *?on*.'
  if (text.includes('regla') || text.includes('norma')) return '📜 Revisa la descripción y los mensajes fijados del grupo. Si alguna regla no está clara, consulta directamente al staff.'
  if (text.includes('gracias')) return '✨ ¡Con gusto! Si necesitas ver las funciones disponibles, escribe *?comandos*.'
  if (/^(que hora es|hora|fecha|que dia es)/.test(text)) {
    return `🕒 En Ciudad de México son las ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date())}.`
  }
  const mathAnswer = solveMathQuestion(question)
  if (mathAnswer) return mathAnswer
  return null
}

function plainText(value = '') {
  return value.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').trim()
}

const YES_ANSWERS = [
  '🎱 Analizándolo bien... ¡Sí! 💯',
  '✨ Todo apunta a que sí.',
  '😏 Sin duda, sí.',
  '💚 Sí, sin lugar a dudas.',
  '👍 Definitivamente sí.'
]
const NO_ANSWERS = [
  '🎱 Analizándolo bien... no, para nada. ❌',
  '😬 Mmm, no creo.',
  '💔 No, lo siento.',
  '🙅 Definitivamente no.',
  '❌ Las señales dicen que no.'
]

function isYesNoQuestion(text) {
  return /^(es|son|sera|será|seran|serán|soy|eres|somos|puedo|puedes|podemos|debo|debes|debemos|le gusto|le gusta|les gusto|les gusta|me quiere|me quieren|nos quiere|va a|van a|vale la pena|deberia|debería|deberian|deberían|existe|hay|creen que|crees que|tengo|tiene|tienen|gano|ganare|ganaré|pasare|pasaré)\b/.test(text)
}

function yesNoSeed(text) {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash
}

function answerYesNoQuestion(question, targetTagText) {
  const normalized = normalizedText(question)
  if (/\b(le gusto|le gusta|me quiere|me quieren|nos quiere|esta enamorad|está enamorad)\b/.test(normalized)) {
    const person = targetTagText ? ` ${targetTagText}` : ' esa persona'
    return `🤔 No puedo saber con certeza lo que siente${person} sin preguntárselo. Fíjate en si busca hablar contigo, respeta tus límites, mantiene interés de forma constante y sus acciones coinciden con lo que dice.\n\n💬 La forma más confiable de saberlo es hablar con honestidad y sin presionar.`
  }
  return null
}

function detectComparison(question) {
  const text = (question || '').trim()
  let match = text.match(/diferencia\s+entre\s+(.+?)\s+y\s+(.+?)[?.!]*$/i)
  if (match) return [match[1].trim(), match[2].trim()]
  match = text.match(/compara(?:r)?\s+(.+?)\s+(?:y|con)\s+(.+?)[?.!]*$/i)
  if (match) return [match[1].trim(), match[2].trim()]
  match = text.match(/^(.+?)\s+vs\.?\s+(.+?)[?.!]*$/i)
  if (match) return [match[1].trim(), match[2].trim()]
  match = text.match(/cu[aá]l\s+es\s+mejor,?\s+(.+?)\s+o\s+(.+?)[?.!]*$/i)
  if (match) return [match[1].trim(), match[2].trim()]
  return null
}

async function answerComparisonQuestion(topicA, topicB) {
  const [resultA, resultB] = await Promise.all([
    searchGeneralKnowledge(topicA).catch(() => null),
    searchGeneralKnowledge(topicB).catch(() => null)
  ])
  const sideA = resultA
    ? `🔵 *${resultA.title}*\n${resultA.summary}`
    : `🔵 *${topicA}*\nNo encontré información confiable sobre esto.`
  const sideB = resultB
    ? `🔴 *${resultB.title}*\n${resultB.summary}`
    : `🔴 *${topicB}*\nNo encontré información confiable sobre esto.`
  return `🤔 *Comparando* "${topicA}" *vs* "${topicB}"...\n\n${sideA}\n\n${sideB}\n\n🧩 *Conclusión:*\nRevisa lo anterior — cada uno tiene su propio contexto, no siempre hay una respuesta única de cuál es "mejor", depende de qué estés buscando exactamente.`
}

const SEARCH_STOPWORDS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o', 'en', 'es', 'son', 'que', 'para', 'por', 'con', 'sobre', 'mi', 'tu', 'su'])
function significantWords(text) {
  return normalizedText(text).split(/\s+/).filter(word => word.length > 2 && !SEARCH_STOPWORDS.has(word))
}

function isRelevantTitle(searchTerm, title) {
  const searchWords = significantWords(searchTerm)
  const titleNormalized = normalizedText(title || '')
  return !searchWords.length || searchWords.some(word => titleNormalized.includes(word))
}

const AI_INSTRUCTIONS = `Eres el asistente oficial de Nuruxion Legion dentro de WhatsApp. Conversas como un colaborador cercano, atento y con personalidad: saludas con naturalidad, entiendes bromas y ajustas tu tono al usuario sin sonar robótico ni repetir siempre la misma introducción.
Responde siempre en español claro, natural y útil. Piensa cuidadosamente antes de responder, pero entrega únicamente la conclusión y una explicación comprensible; no muestres razonamiento interno ni cadenas de pensamiento.
Tienes conocimientos amplios, especialmente de programación, JavaScript, Node.js, Python, Java, desarrollo web, bases de datos, bots, APIs, Minecraft y resolución de errores. Cuando revises código, identifica primero la causa probable, después ofrece una solución segura y finalmente un ejemplo breve. No inventes que ejecutaste o verificaste código si no lo hiciste.
Adapta la extensión a la pregunta: respuestas breves para conversación casual y pasos ordenados para problemas complejos. Si comparas opciones, explica ventajas, desventajas y una recomendación final. Usa bloques de código cuando ayuden.
Usa el contexto reciente cuando sea relevante y pide una aclaración solo si realmente cambia la respuesta.
No inventes datos, reglas del clan, noticias ni fuentes. Si no tienes certeza, dilo con honestidad y explica cómo verificarlo.
Para temas médicos, legales o financieros, ofrece información general prudente y recomienda consultar una fuente profesional cuando corresponda.
No afirmes ser humano. Tu nombre es Asistente de Nuruxion.`

function rememberAiExchange(key, question, answer) {
  const previous = aiConversationMemory.get(key)
  const history = previous?.expiresAt > Date.now() ? previous.history : []
  history.push({ role: 'user', content: question }, { role: 'assistant', content: answer })
  aiConversationMemory.set(key, { history: history.slice(-8), expiresAt: Date.now() + QUESTION_TTL })
  if (aiConversationMemory.size > 300) {
    const oldest = aiConversationMemory.keys().next().value
    if (oldest) aiConversationMemory.delete(oldest)
  }
}

async function askReasoningModel(question, conversationKey) {
  const endpoint = new URL(`${NURUXION_AI_URL}/chat`)
  const local = ['127.0.0.1', '[::1]'].includes(endpoint.hostname)
  if (endpoint.username || endpoint.password || (!local && (!EXTERNAL_AI_ENABLED || endpoint.protocol !== 'https:'))) return null
  const previous = aiConversationMemory.get(conversationKey)
  const history = previous?.expiresAt > Date.now() ? previous.history : []
  const signal = AbortSignal.timeout(30_000)
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    headers: {
      ...(NURUXION_AI_TOKEN ? { Authorization: `Bearer ${NURUXION_AI_TOKEN}` } : {}),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      question,
      history,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS
    }),
    signal
  })
  if (!response.ok) throw new Error(`Proveedor de IA respondió ${response.status}`)
  const answer = String(JSON.parse((await collectBounded(response.body, 128 * 1024, signal)).toString('utf8'))?.answer || '').trim()
  if (!answer) throw new Error('El proveedor de IA no devolvió texto')
  const whatsappAnswer = answer.length > 3900 ? `${answer.slice(0, 3850)}…` : answer
  rememberAiExchange(conversationKey, question, whatsappAnswer)
  return whatsappAnswer
}

async function fetchWikipediaKnowledge(searchTerm) {
  const url = new URL('https://es.wikipedia.org/w/rest.php/v1/search/page')
  url.searchParams.set('q', searchTerm)
  url.searchParams.set('limit', '1')
  const response = await fetch(url, {
    headers: { 'User-Agent': 'NuruxionWhatsAppBot/1.0 (general-knowledge assistant)' },
    signal: AbortSignal.timeout(8000)
  })
  if (!response.ok) return null
  const page = (await response.json()).pages?.[0]
  if (!page) return null
  if (!isRelevantTitle(searchTerm, page.title)) return null
  let summary = plainText(page.excerpt || page.description || '')
  try {
    const detailResponse = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.key || page.title)}`, {
      headers: { 'User-Agent': 'NuruxionWhatsAppBot/1.0 (general-knowledge assistant)' },
      signal: AbortSignal.timeout(8000)
    })
    if (detailResponse.ok) summary = plainText((await detailResponse.json()).extract || summary)
  } catch {}
  if (!summary) return null
  return { title: page.title, summary, description: plainText(page.description || page.title), source: 'Wikipedia' }
}

async function fetchDuckDuckGoKnowledge(searchTerm) {
  try {
    const url = new URL('https://api.duckduckgo.com/')
    url.searchParams.set('q', searchTerm)
    url.searchParams.set('format', 'json')
    url.searchParams.set('no_html', '1')
    url.searchParams.set('skip_disambig', '1')
    const response = await fetch(url, {
      headers: { 'User-Agent': 'NuruxionWhatsAppBot/1.0 (general-knowledge assistant)' },
      signal: AbortSignal.timeout(8000)
    })
    if (!response.ok) return null
    const data = await response.json()
    const summary = plainText(data.AbstractText || '')
    if (!summary) return null
    const title = data.Heading || searchTerm
    if (!isRelevantTitle(searchTerm, title)) return null
    return { title, summary, description: summary.split(/[.!?]/)[0] || title, source: 'DuckDuckGo' }
  } catch {
    return null
  }
}

async function fetchWiktionaryKnowledge(searchTerm) {
  try {
    const response = await fetch(`https://es.wiktionary.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`, {
      headers: { 'User-Agent': 'NuruxionWhatsAppBot/1.0 (general-knowledge assistant)' },
      signal: AbortSignal.timeout(8000)
    })
    if (!response.ok) return null
    const data = await response.json()
    const summary = plainText(data.extract || '')
    if (!summary) return null
    const title = data.title || searchTerm
    return { title, summary, description: summary.split(/[.!?]/)[0] || title, source: 'Wikcionario' }
  } catch {
    return null
  }
}

async function searchGeneralKnowledge(question) {
  if (!EXTERNAL_KNOWLEDGE_ENABLED) return null
  const cleanedQuestion = question
    .replace(/[¿?]/g, ' ')
    .replace(/^\s*(?:hola|buenas|holi|hey)\b[,!.\s]*/gi, ' ')
    .replace(/\b(?:oye|hey|oyeme|oyeme|oigan|mira|a ver|sabes|sabias|sabías|sabia|sabía)\b/gi, ' ')
    .replace(/\b(?:por favor|me puedes|puedes|podrias|podrías|quiero saber|quisiera saber|me dices|puedes decirme)\b/gi, ' ')
    .replace(/\b(?:explicame|explícame|explica|dime|cuentame|cuéntame|hablame|háblame)\s+(?:mejor\s+)?(?:sobre\s+|acerca\s+de\s+|que\s+es\s+|qué\s+es\s+|el\s+tema\s+de\s+|este\s+tema\s*)?/gi, ' ')
    .replace(/\b(?:que es|qué es|que significa|qué significa|que son|qué son)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const searchTerm = cleanedQuestion || question.trim()
  const knowledgeKey = normalizedText(searchTerm)
  const remembered = knowledgeCache[knowledgeKey]
  if (remembered && Date.now() - remembered.learnedAt < 30 * 24 * 60 * 60 * 1000) {
    remembered.hits = (remembered.hits || 0) + 1
    return {
      topic: remembered.topic,
      title: remembered.title,
      summary: remembered.summary,
      description: remembered.description,
      text: explainKnowledge(remembered.title, remembered.summary, remembered.description, question)
    }
  }
  const candidates = await Promise.all([
    fetchWikipediaKnowledge(searchTerm).catch(() => null),
    fetchDuckDuckGoKnowledge(searchTerm).catch(() => null),
    fetchWiktionaryKnowledge(searchTerm).catch(() => null)
  ])
  const useful = candidates.filter(Boolean)
  const found = useful[0]
  if (!found) return null
  let summary = found.summary
  const complementary = useful.find(item => item.source !== found.source && normalizedText(item.summary) !== normalizedText(found.summary))
  if (complementary) {
    const extra = complementary.summary.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.slice(0, 2).join(' ').trim()
    if (extra && !normalizedText(summary).includes(normalizedText(extra).slice(0, 80))) summary += `\n\nInformación complementaria: ${extra}`
  }
  if (summary.length > 1400) {
    const shortened = summary.slice(0, 1400)
    summary = shortened.slice(0, Math.max(shortened.lastIndexOf('.'), 700) + 1)
  }
  const learned = {
    topic: searchTerm,
    title: found.title,
    summary: summary || found.description || 'Encontré información relacionada con tu pregunta.',
    description: plainText(found.description || found.title),
    learnedAt: Date.now(),
    hits: 1
  }
  knowledgeCache[knowledgeKey] = learned
  const keys = Object.keys(knowledgeCache)
  if (keys.length > 200) delete knowledgeCache[keys[0]]
  return {
    topic: searchTerm,
    title: learned.title,
    summary: learned.summary,
    description: learned.description,
    text: explainKnowledge(learned.title, learned.summary, learned.description, question)
  }
}

function explainKnowledge(title, summary, description, question) {
  const sentences = summary.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(sentence => sentence.trim()).filter(Boolean) || [summary]
  const intro = sentences.slice(0, 2).join(' ')
  const rest = sentences.slice(2).join(' ')
  let body = `¡Claro! *${title}* — te explico:\n\n${intro}`
  if (rest) body += `\n\n${rest}`
  body += `\n\n📌 *En resumen:* ${description.replace(/^./, character => character.toLowerCase())}.`
  body += '\n\n💬 ¿Quieres que profundice en alguna parte específica de esto?'
  body += '\n\n_⚠️ Puedo cometer errores. No soy infalible — verifica la información importante._'
  return body
}

const GIF_API_HEADERS = { 'User-Agent': 'NuruxionWhatsAppBot/1.0 (anime-reaction-gifs)', 'Accept': 'application/json' }

const KISS_GIF_SOURCES = [
  async () => {
    const response = await fetch('https://nekos.best/api/v2/kiss', { headers: GIF_API_HEADERS, signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`nekos.best respondió ${response.status}`)
    return (await response.json())?.results?.[0]?.url
  },
  async () => {
    const response = await fetch('https://api.otakugifs.xyz/gif?reaction=kiss', { headers: GIF_API_HEADERS, signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`otakugifs respondió ${response.status}`)
    return (await response.json())?.url
  }
]


// ===================================================================
// GIFS: BESO / BODA / GOLPE
// ===================================================================
async function fetchKissGifUrl() {
  const sources = [...KISS_GIF_SOURCES].sort(() => Math.random() - 0.5)
  for (const source of sources) {
    try {
      const url = await source()
      if (url) return url
    } catch (error) {
      logger.warn({ err: error }, 'Falló una fuente de gifs de beso, probando otra')
    }
  }
  return null
}

const WEDDING_GIF_URLS = [
  'https://media.tenor.com/vVPgFelVA1IAAAAM/blue-box-ao-no-hako.gif',
  'https://media.tenor.com/aflCuh8Hk_EAAAAM/kurumi-wedding-dress.gif',
  'https://media.tenor.com/3OYmSePDSVUAAAAM/black-clover-licht.gif',
  'https://media.tenor.com/m-s6QVjySC0AAAAM/ring-anime-wedding.gif',
  'https://media.tenor.com/u7B_BCacat8AAAAM/wedding-ring-engaged.gif',
  'https://media.tenor.com/K8kYHxPPPakAAAAM/sailor-moon-tuxedo.gif',
  'https://media.tenor.com/lWwk7j4-_QIAAAAM/oreimo-anime.gif',
  'https://media.tenor.com/ulu0eW886QIAAAAM/marry-me-anime.gif',
  'https://media.tenor.com/9_DMhvo7FCAAAAAM/anime-wedding.gif',
  'https://media.tenor.com/fLCsfPKZrlkAAAAM/goku-chichi.gif'
]

async function fetchWeddingGifUrl() {
  return WEDDING_GIF_URLS[Math.floor(Math.random() * WEDDING_GIF_URLS.length)]
}

const PUNCH_GIF_URLS = [
  'https://media.tenor.com/kBvBhMiZRMwAAAAM/boxing-anime.gif',
  'https://media.tenor.com/Uo5xJQqA8x0AAAAM/anime-punch.gif',
  'https://media.tenor.com/Kbit6lroRFUAAAAM/one-punch-man-saitama.gif',
  'https://media.tenor.com/qDDsivB4UEkAAAAM/anime-fight.gif',
  'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
  'https://media.tenor.com/Ktd3wl6JEEMAAAAM/punch-anime-girl-punch.gif',
  'https://media.tenor.com/yA_KtmPI1EMAAAAM/hxh-hunter-x-hunter.gif',
  'https://media.tenor.com/pNmajM4wmtkAAAAM/punch-smash.gif'
]

async function fetchPunchGifUrl() {
  return PUNCH_GIF_URLS[Math.floor(Math.random() * PUNCH_GIF_URLS.length)]
}

async function sendPunchGifMessage(sock, chat, message, caption, mentions) {
  const gifUrl = await fetchPunchGifUrl()
  if (gifUrl) {
    try {
      const gifResponse = await fetch(gifUrl, { headers: GIF_API_HEADERS, signal: AbortSignal.timeout(15000) })
      if (!gifResponse.ok) throw new Error(`descarga del gif respondió ${gifResponse.status}`)
      const gifBuffer = Buffer.from(await gifResponse.arrayBuffer())
      const videoBuffer = await convertGifToVideo(gifBuffer)
      await sock.sendMessage(chat, { video: videoBuffer, caption, mentions }, { quoted: message })
      return
    } catch (error) {
      logger.warn({ err: error }, 'No se pudo preparar el video de golpe, se enviará solo texto')
    }
  }
  await reply(sock, chat, message, caption, mentions)
}

const execFileAsync = promisify(execFile)

async function convertGifToVideo(gifBuffer) {
  const id = crypto.randomUUID()
  const inputPath = path.join(os.tmpdir(), `${id}.gif`)
  const outputPath = path.join(os.tmpdir(), `${id}.mp4`)
  try {
    await fs.writeFile(inputPath, gifBuffer)
    await execFileAsync(ffmpegPath, [
      '-y', '-i', inputPath,
      '-movflags', 'faststart',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      outputPath
    ], { timeout: 15000 })
    return await fs.readFile(outputPath)
  } finally {
    await fs.unlink(inputPath).catch(() => {})
    await fs.unlink(outputPath).catch(() => {})
  }
}


// ===================================================================
// PERSISTENCIA: CARGA Y GUARDADO DE state.json /
// economy.json (ver queueStateSave/queueEconomySave mas abajo)
// ===================================================================
async function loadState() {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 })
  try {
    runtimeState = { ...runtimeState, ...JSON.parse(await fs.readFile(STATE_FILE, 'utf8')) }
    delete runtimeState.conversationTopics // La memoria de preguntas ya no se guarda en disco.
    runtimeState.warnings ||= {}
    runtimeState.suggestions ||= {}
    runtimeState.muted ||= {}
    runtimeState.antilink ||= {}
    runtimeState.activityPoints ||= {}
    runtimeState.activityPointHistory ||= []
    runtimeState.processedPointCommands ||= {}
    runtimeState.activityMessages ||= {}
    runtimeState.activityAwards ||= {}
    runtimeState.pendingDonations ||= {}
    runtimeState.marriages ||= {}
    runtimeState.staffApplications ||= {}
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn({ err: error }, 'No se pudo leer el estado; se usaran valores predeterminados')
    queueStateSave()
  }
}

async function saveState() {
  const temporary = `${STATE_FILE}.tmp`
  await fs.writeFile(temporary, JSON.stringify(runtimeState), { encoding: 'utf8', mode: 0o600 })
  await fs.rename(temporary, STATE_FILE)
}

// El estado se guarda en disco de forma diferida (debounce) en vez de en cada
// llamada: docenas de comandos mutan runtimeState por mensaje, y serializar +
// escribir el archivo completo (cientos de KB) en cada uno generaba una carga
// de CPU/IO evitable. Los cambios en memoria son inmediatos; solo se retrasa
// la escritura a disco. flushStateSave() se llama al apagar el proceso para
// no perder cambios pendientes.
let statePendingSave = false
let stateSaveInFlight = null

function queueStateSave() {
  statePendingSave = true
  if (activitySaveTimer) return
  activitySaveTimer = setTimeout(() => {
    activitySaveTimer = null
    void flushStateSave()
  }, 500)
}

async function flushStateSave() {
  if (activitySaveTimer) {
    clearTimeout(activitySaveTimer)
    activitySaveTimer = null
  }
  if (!statePendingSave) return stateSaveInFlight || undefined
  statePendingSave = false
  stateSaveInFlight = saveState().catch(error => logger.warn({ err: error }, 'No se pudo guardar el estado'))
  await stateSaveInFlight
  stateSaveInFlight = null
}

function scheduleRuntimeStateSave() {
  queueStateSave()
}

function activityPeriodInfo(timestamp = Date.now()) {
  const MX_OFFSET_MS = -6 * 60 * 60 * 1000
  const DAY_MS = 24 * 60 * 60 * 1000
  const mxNow = new Date(timestamp + MX_OFFSET_MS)
  const mondayOffset = (mxNow.getUTCDay() + 6) % 7
  let mondayNoonMx = Date.UTC(mxNow.getUTCFullYear(), mxNow.getUTCMonth(), mxNow.getUTCDate() - mondayOffset, 12, 0, 0, 0)
  if (mxNow.getTime() < mondayNoonMx) mondayNoonMx -= 7 * DAY_MS
  const startAt = mondayNoonMx - MX_OFFSET_MS
  const endAt = startAt + 6 * DAY_MS
  const nextStartAt = startAt + 7 * DAY_MS
  return {
    key: new Date(mondayNoonMx).toISOString().slice(0, 10),
    startAt,
    endAt,
    nextStartAt,
    counting: timestamp >= startAt && timestamp < endAt
  }
}

function activityWeekKey(timestamp = Date.now()) {
  return activityPeriodInfo(timestamp).key
}

function lastClosedActivityPeriod(timestamp = Date.now()) {
  const current = activityPeriodInfo(timestamp)
  if (timestamp >= current.endAt) return current
  return activityPeriodInfo(current.startAt - 1)
}

function activityPointSummary(jid) {
  const key = jidNormalizedUser(jid || '')
  let positive = 0
  let negative = 0
  for (const record of runtimeState.activityPointHistory || []) {
    if (jidNormalizedUser(record.target || '') !== key) continue
    const value = Number(record.points) || 0
    if (value >= 0) positive += value
    else negative += Math.abs(value)
  }
  const total = Number(runtimeState.activityPoints[key]) || 0
  return { positive, negative, total }
}

function activityGroupCounts(_chat, week = activityWeekKey(), groupIds = []) {
  const weekData = runtimeState.activityMessages?.[week] || {}
  const merged = { ...(weekData.nuruxion || {}) }
  for (const groupId of groupIds) {
    for (const [jid, amount] of Object.entries(weekData[groupId] || {})) {
      merged[jid] = (Number(merged[jid]) || 0) + (Number(amount) || 0)
    }
  }
  return merged
}

function registerActivityAward(chat, target, points, reason, type, position, week) {
  const targetKey = jidNormalizedUser(target)
  runtimeState.activityPoints[targetKey] = (Number(runtimeState.activityPoints[targetKey]) || 0) + points
  runtimeState.activityPointHistory.push({
    messageId: '',
    chat,
    target: targetKey,
    moderator: 'system@activity',
    points,
    reason,
    type,
    position,
    week,
    createdAt: new Date().toISOString()
  })
  if (runtimeState.activityPointHistory.length > 1000) {
    runtimeState.activityPointHistory.splice(0, runtimeState.activityPointHistory.length - 1000)
  }
}

async function finalizeWeeklyActivity(sock, timestamp = Date.now()) {
  if (!sock) return
  const period = lastClosedActivityPeriod(timestamp)
  if (timestamp < period.endAt) return
  const awardKey = `${period.key}|global|automatic`
  if (runtimeState.activityAwards[awardKey]) return

  const groupsById = await sock.groupFetchAllParticipating()
  const groups = activityTrackedGroups(Object.values(groupsById || {}).filter(group => isAllowedGroup(group.id)))
  const botKey = jidNormalizedUser(sock.user?.id || '')
  const counts = activityGroupCounts('global', period.key, groups.map(group => group.id))
  const allMembers = activityMemberEntries(groups, counts, botKey)
  if (!allMembers.length) return
  const active = allMembers.filter(entry => entry.messages > 0 && !entry.excludedFromActivityTop)
    .sort((a, b) => b.messages - a.messages || a.jid.localeCompare(b.jid))
    .slice(0, 5)
  const activeIds = new Set(active.map(entry => entry.jid))
  const inactive = allMembers.filter(entry => !activeIds.has(entry.jid))
    .sort((a, b) => a.messages - b.messages || a.jid.localeCompare(b.jid))

  const activeValues = [3, 2, 1, 1, 1]
  const activeResults = active.map((entry, index) => ({ ...entry, points: activeValues[index] }))
  const inactiveResults = inactive.map((entry, index) => ({
    ...entry,
    points: index === 0 ? -2 : -1
  })).filter(entry => entry.points < 0)

  activeResults.forEach((entry, index) => registerActivityAward(
    'global', entry.jid, entry.points, 'Top semanal de actividad', 'activity-top', index + 1, period.key
  ))
  inactiveResults.forEach((entry, index) => registerActivityAward(
    'global', entry.jid, entry.points, 'Top semanal de inactividad', 'inactivity-top', index + 1, period.key
  ))

  runtimeState.activityAwards[awardKey] = {
    createdAt: new Date().toISOString(),
    startAt: new Date(period.startAt).toISOString(),
    endAt: new Date(period.endAt).toISOString(),
    active: activeResults,
    inactive: inactiveResults
  }
  const retainedAwards = Object.keys(runtimeState.activityAwards).sort((a, b) =>
    String(runtimeState.activityAwards[a]?.createdAt || '').localeCompare(String(runtimeState.activityAwards[b]?.createdAt || ''))
  )
  while (retainedAwards.length > 100) delete runtimeState.activityAwards[retainedAwards.shift()]
  queueStateSave()

  const destination = groups.find(group => group.subject === RESTRICTED_COMMANDS_GROUP_NAME) || groups[0]
  if (!destination) return
  const activeLines = activeResults.length
    ? activeResults.map((entry, index) => `#${index + 1} @${entry.jid.split('@')[0].split(':')[0]} — ${entry.messages} mensajes — +${entry.points} puntos`)
    : ['Sin usuarios activos esta semana.']
  const visibleInactive = inactiveResults.slice(0, 20)
  const inactiveLines = visibleInactive.length
    ? visibleInactive.map((entry, index) => `#${index + 1} @${entry.jid.split('@')[0].split(':')[0]} — ${entry.messages} mensajes — ${entry.points} punto${entry.points === -1 ? '' : 's'}`)
    : ['Sin descuentos por inactividad.']
  const hidden = inactiveResults.length - visibleInactive.length
  await sock.sendMessage(destination.id, {
    text: [
      '📊 *CIERRE DEL TOP SEMANAL*',
      `📅 Periodo: lunes 12:00 p. m. a domingo 12:00 p. m. (México)`,
      '', '🏆 *Actividad*', ...activeLines,
      '', '📉 *Inactividad*', ...inactiveLines,
      ...(hidden > 0 ? [`…y ${hidden} miembros inactivos más con -1 punto.`] : []),
      '', '✅ Los puntos fueron aplicados automáticamente una sola vez.'
    ].join('\n'),
    mentions: [...activeResults, ...visibleInactive].map(entry => entry.jid)
  })
}

async function loadEconomy() {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 })
  try {
    economyState = { ...economyState, ...JSON.parse(await fs.readFile(ECONOMY_FILE, 'utf8')) }
    economyState.wallets ||= {}
    economyState.robCooldowns ||= {}
    economyState.companies ||= {}
    economyState.shopStock ||= {}
    economyState.loans ||= {}
    economyState.xp ||= {}
    economyState.explore ||= {}
    economyState.mine ||= {}
    economyState.mineMiracleUsed ??= false
    economyState.halloween2026 ||= null
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn({ err: error }, 'No se pudo leer la economía; se usarán valores predeterminados')
    queueEconomySave()
  }
}

async function saveEconomy() {
  const temporary = `${ECONOMY_FILE}.tmp`
  await fs.writeFile(temporary, JSON.stringify(economyState), { encoding: 'utf8', mode: 0o600 })
  await fs.rename(temporary, ECONOMY_FILE)
}

// Igual que queueStateSave: economyState se guarda decenas de veces por
// comando (rob, mina, blackjack, etc.). Sin este debounce, cada acción
// reescribía el archivo completo de economía (cientos de KB) en disco de
// forma síncrona, siendo la causa principal del uso alto de CPU. Se aplana
// (coalesce) en una sola escritura cada 500ms; flushEconomySave() garantiza
// que no se pierda nada al apagar el proceso.
let economySaveTimer = null
let economyPendingSave = false
let economySaveInFlight = null

function queueEconomySave() {
  economyPendingSave = true
  if (economySaveTimer) return
  economySaveTimer = setTimeout(() => {
    economySaveTimer = null
    void flushEconomySave()
  }, 500)
}

async function flushEconomySave() {
  if (economySaveTimer) {
    clearTimeout(economySaveTimer)
    economySaveTimer = null
  }
  if (!economyPendingSave) return economySaveInFlight || undefined
  economyPendingSave = false
  economySaveInFlight = saveEconomy().catch(error => logger.warn({ err: error }, 'No se pudo guardar la economía'))
  await economySaveInFlight
  economySaveInFlight = null
}


// ===================================================================
// ECONOMIA: CUENTAS, PRESTAMOS Y BLACKJACK - helpers
// ===================================================================
function getAccount(jid) {
  const key = jidNormalizedUser(jid || '')
  if (!economyState.wallets[key]) {
    economyState.wallets[key] = { wallet: STARTING_BALANCE, bank: 0, jailedUntil: 0 }
    economyState.firstSeenAt[key] ||= Date.now()
  }
  if (economyState.wallets[key].bank < 0) economyState.wallets[key].bank = 0
  return economyState.wallets[key]
}

function checkLoan(jid) {
  const key = jidNormalizedUser(jid || '')
  const loan = economyState.loans[key]
  if (!loan) return null
  const now = Date.now()
  const daysElapsed = Math.floor((now - loan.createdAt) / (24 * 60 * 60 * 1000))
  if (daysElapsed > 0) {
    loan.owed = Math.round(loan.principal * (1 + LOAN_INTEREST_RATE * daysElapsed))
  }
  if (now > loan.dueAt) {
    const daysOverdue = Math.floor((now - loan.dueAt) / (24 * 60 * 60 * 1000))
    if (daysOverdue > LOAN_TOLERANCE_DAYS) {
      const account = getAccount(key)
      if (!(account.jailedUntil > now)) {
        const jailDays = computeLoanJailDays(loan.owed)
        account.jailedUntil = now + jailDays * 24 * 60 * 60 * 1000
        account.lastJailDebt = loan.owed
        account.lastJailDays = jailDays
        delete economyState.loans[key]
        return null
      }
    }
  }
  return loan
}

function formatCurrency(amount) {
  return `${CURRENCY_SYMBOL} ${Math.floor(amount).toLocaleString('es-MX')} ${CURRENCY_NAME}`
}

function spouseOf(jid) {
  return runtimeState.marriages[jidNormalizedUser(jid || '')]?.spouse
}

function isMarried(jid) {
  return Boolean(spouseOf(jid))
}

function applyWeddingGiftType(type, jidA, jidB) {
  if (type === 'dinero') {
    const amount = 500 + Math.floor(Math.random() * 1500)
    getAccount(jidA).wallet += amount
    getAccount(jidB).wallet += amount
    return `${formatCurrency(amount)} en el monedero para cada quien`
  }
  if (type === 'banco') {
    const amount = 500 + Math.floor(Math.random() * 1500)
    getAccount(jidA).bank += amount
    getAccount(jidB).bank += amount
    return `${formatCurrency(amount)} directo al banco para cada quien`
  }
  if (type === 'escudo') {
    const charges = 1 + Math.floor(Math.random() * 2)
    const invA = getInventory(jidA)
    const invB = getInventory(jidB)
    invA.shieldTiers['35'] = (invA.shieldTiers['35'] || 0) + charges
    invB.shieldTiers['35'] = (invB.shieldTiers['35'] || 0) + charges
    return `Escudo anti-robo 35% (+${charges} uso${charges > 1 ? 's' : ''}) para ambos`
  }
  if (type === 'xp') {
    const amount = 50 + Math.floor(Math.random() * 150)
    economyState.xp[jidA] = (economyState.xp[jidA] || 0) + amount
    economyState.xp[jidB] = (economyState.xp[jidB] || 0) + amount
    return `+${amount} XP para cada quien`
  }
  if (type === 'impulso') {
    const hours = 6 + Math.floor(Math.random() * 19)
    const until = Date.now() + hours * 60 * 60 * 1000
    getInventory(jidA).buffs.suerte = until
    getInventory(jidB).buffs.suerte = until
    return `Buff de suerte por ${hours}h para ambos (mejora *?rob*)`
  }
  economyState.robCooldowns[jidA] = 0
  economyState.robCooldowns[jidB] = 0
  return 'Indulto: se reinició su enfriamiento de *?rob*, pueden robar de inmediato'
}

function applyWeddingGifts(jidA, jidB) {
  const count = 1 + Math.floor(Math.random() * WEDDING_GIFT_MAX_COUNT)
  const types = [...WEDDING_GIFT_TYPES].sort(() => Math.random() - 0.5).slice(0, count)
  return types.map(type => applyWeddingGiftType(type, jidA, jidB))
}

function describeWeddingGiftPreview(type) {
  if (type === 'dinero') return `${formatCurrency(500)}–${formatCurrency(2000)} en el monedero para cada quien`
  if (type === 'banco') return `${formatCurrency(500)}–${formatCurrency(2000)} directo al banco para cada quien`
  if (type === 'escudo') return 'Escudo anti-robo 35% (+1 a +2 usos) para ambos'
  if (type === 'xp') return '+50 a +200 XP para cada quien'
  if (type === 'impulso') return 'Buff de suerte por 6h a 24h para ambos (mejora *?rob*)'
  return 'Indulto: reinicia el enfriamiento de *?rob* para ambos'
}

function previewWeddingGifts() {
  const count = 1 + Math.floor(Math.random() * WEDDING_GIFT_MAX_COUNT)
  const types = [...WEDDING_GIFT_TYPES].sort(() => Math.random() - 0.5).slice(0, count)
  return types.map(describeWeddingGiftPreview)
}

function parseAmount(raw, available) {
  const normalized = (raw || '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'all' || normalized === 'todo') return available
  const value = Number(normalized.replace(/[.,]/g, ''))
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.floor(value)
}

function drawCard() {
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
  const suits = ['♠️','♥️','♦️','♣️']
  const rank = ranks[Math.floor(Math.random() * ranks.length)]
  const suit = suits[Math.floor(Math.random() * suits.length)]
  return { rank, suit }
}

function cardValue(rank) {
  if (rank === 'A') return 11
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number(rank)
}

function handValue(cards) {
  let total = cards.reduce((sum, card) => sum + cardValue(card.rank), 0)
  let aces = cards.filter(card => card.rank === 'A').length
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

function formatHand(cards) {
  return cards.map(card => `${card.rank}${card.suit}`).join(' ')
}

function playBlackjackHand(startCards) {
  const cards = [...startCards]
  while (handValue(cards) < 17) cards.push(drawCard())
  return cards
}

async function resolveBlackjack(sock, chat, message, account, gameKey, bet, playerCards, initialDealerCards, dealerAutoPlay) {
  delete economyState.blackjackGames[gameKey]
  const playerTotal = handValue(playerCards)
  let dealerCards = initialDealerCards
  let outcome
  let delta
  if (playerTotal > 21) {
    delta = 0
    outcome = `💥 Te pasaste de 21. Perdiste ${formatCurrency(bet)}.`
  } else {
    if (dealerAutoPlay) dealerCards = playBlackjackHand(initialDealerCards)
    const dealerTotal = handValue(dealerCards)
    const playerBlackjack = playerCards.length === 2 && playerTotal === 21
    const dealerBlackjack = dealerCards.length === 2 && dealerTotal === 21
    if (playerBlackjack && dealerBlackjack) {
      delta = bet
      outcome = '🤝 Empate — ambos sacaron blackjack. Se devuelve tu apuesta.'
    } else if (playerBlackjack) {
      delta = bet + Math.floor(bet * 1.5)
      outcome = `🃏 ¡Blackjack! Ganaste ${formatCurrency(Math.floor(bet * 1.5))}.`
    } else if (dealerBlackjack) {
      delta = 0
      outcome = `😵 El dealer sacó blackjack. Perdiste ${formatCurrency(bet)}.`
    } else if (dealerTotal > 21) {
      delta = bet * 2
      outcome = `🎉 El dealer se pasó de 21. Ganaste ${formatCurrency(bet)}.`
    } else if (playerTotal > dealerTotal) {
      delta = bet * 2
      outcome = `🎉 Ganaste ${formatCurrency(bet)}.`
    } else if (playerTotal < dealerTotal) {
      delta = 0
      outcome = `😵 Perdiste ${formatCurrency(bet)}.`
    } else {
      delta = bet
      outcome = '🤝 Empate — se devuelve tu apuesta.'
    }
  }
  if (delta === 0 && isGlobalEventActive() && Math.random() < 0.01) {
    delta = bet
    outcome += '\n🍀 ¡Con la suerte del evento, recuperas tu apuesta!'
  }
  const profit = Math.max(0, delta - bet)
  const { tax: bjTax, suffix: bjSuffix } = applyKingdomTax(profit)
  account.wallet += delta - bjTax
  outcome += bjSuffix
  queueEconomySave()
  await reply(sock, chat, message, `🃏 *BLACKJACK*\n\nTú: ${formatHand(playerCards)} (${playerTotal})\nDealer: ${formatHand(dealerCards)} (${handValue(dealerCards)})\n\n${outcome}\nMonedero: ${formatCurrency(account.wallet)}`)
}


// ===================================================================
// EMPRESAS: HELPERS (BOLSA DE VALORES DEL GRUPO)
// ===================================================================
function buildCompanies(groupName) {
  const base = (groupName || 'Grupo').trim().split(/\s+/).slice(0, 2).join(' ') || 'Grupo'
  const suffixes = [...COMPANY_SUFFIXES].sort(() => Math.random() - 0.5).slice(0, 3)
  const sectors = [...COMPANY_SECTORS].sort(() => Math.random() - 0.5).slice(0, 3)
  const now = Date.now()
  return suffixes.map((suffix, index) => {
    const price = Math.round((50 + Math.random() * 150) * 100) / 100
    return {
      id: crypto.randomUUID(),
      name: `${base} ${suffix}`,
      sector: sectors[index].name,
      volatility: sectors[index].volatility,
      price,
      history: [{ t: now, p: price }],
      shares: {}
    }
  })
}

function tickCompanies(companyList) {
  const now = Date.now()
  for (const company of companyList) {
    const last = company.history[company.history.length - 1]
    if (!last || now - last.t >= COMPANY_TICK_MS) {
      const change = (Math.random() * 2 - 1) * company.volatility
      company.price = Math.max(1, Math.round(company.price * (1 + change) * 100) / 100)
      company.history.push({ t: now, p: company.price })
      if (company.history.length > COMPANY_HISTORY_LIMIT) company.history.shift()
    }
  }
}

function findCompany(companyList, query) {
  const normalizedQuery = normalizedText(query)
  return companyList.find(company => normalizedText(company.name).includes(normalizedQuery))
}

async function renderCompanyChart(companyList) {
  const series = companyList.slice(0, 12).map(company => ({
    name: escapeXml(String(company.name || 'Empresa').slice(0, 30)),
    values: company.history.slice(-60).map(point => Number(point.p)).filter(Number.isFinite)
  })).filter(company => company.values.length)
  const all = series.flatMap(company => company.values)
  const min = Math.min(0, ...all), max = Math.max(1, ...all)
  const lines = series.map(({ name, values }, index) => {
    const color = COMPANY_CHART_COLORS[index % COMPANY_CHART_COLORS.length]
    const points = values.map((value, i) => `${50 + i * 570 / Math.max(1, values.length - 1)},${340 - 250 * (value - min) / (max - min)}`).join(' ')
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3"/><text x="645" y="${85 + index * 23}" fill="${color}" font-family="sans-serif" font-size="14">${name}</text>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="380"><rect width="900" height="380" fill="#111827"/><text x="50" y="48" fill="#f9fafc" font-family="sans-serif" font-size="23">Bolsa de Valores</text><path d="M50 78V340H620" fill="none" stroke="#64748b"/>${lines}</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}


// ===================================================================
// WHATSAPP: HELPERS DE MENSAJES Y MEDIOS
// ===================================================================
function unwrapMessage(message) {
  let content = message
  while (content) {
    if (content.deviceSentMessage?.message) content = content.deviceSentMessage.message
    else if (content.ephemeralMessage?.message) content = content.ephemeralMessage.message
    else if (content.viewOnceMessage?.message) content = content.viewOnceMessage.message
    else if (content.viewOnceMessageV2?.message) content = content.viewOnceMessageV2.message
    else if (content.documentWithCaptionMessage?.message) content = content.documentWithCaptionMessage.message
    else break
  }
  return content || {}
}

function messageText(content) {
  return content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption || ''
}

function contextInfo(content) {
  return content.extendedTextMessage?.contextInfo ||
    content.imageMessage?.contextInfo ||
    content.videoMessage?.contextInfo || {}
}

function findMedia(content) {
  const candidates = [
    ['image', content.imageMessage],
    ['video', content.videoMessage],
    ['audio', content.audioMessage],
    ['document', content.documentMessage],
    ['sticker', content.stickerMessage]
  ]
  const direct = candidates.find(([, media]) => media)
  if (direct) return { type: direct[0], media: direct[1] }

  const quoted = unwrapMessage(contextInfo(content).quotedMessage)
  const quotedCandidates = [
    ['image', quoted.imageMessage],
    ['video', quoted.videoMessage],
    ['audio', quoted.audioMessage],
    ['document', quoted.documentMessage],
    ['sticker', quoted.stickerMessage]
  ]
  const found = quotedCandidates.find(([, media]) => media)
  return found ? { type: found[0], media: found[1] } : null
}

async function downloadMediaBuffer(media, type) {
  const maxBytes = 8 * 1024 * 1024
  if (Number(media?.fileLength) > maxBytes) throw new Error('El archivo supera el límite de 8 MiB')
  const signal = AbortSignal.timeout(20_000)
  const stream = await downloadContentFromMessage({ mediaKey: media.mediaKey, url: whatsappMediaUrl(media) },
    type, { options: { signal, redirect: 'error' } })
  return collectBounded(stream, maxBytes, signal)
}

function quotedText(content) {
  const quoted = unwrapMessage(contextInfo(content).quotedMessage)
  return messageText(quoted).trim()
}

async function resolveGroupLinksInText(sock, text) {
  if (!text) return text
  const matches = [...text.matchAll(/@?(\d{15,20}@g\.us)/g)]
  let result = text
  const seen = new Set()
  for (const match of matches) {
    const raw = match[0]
    const jid = match[1]
    if (seen.has(raw)) continue
    seen.add(raw)
    try {
      const code = await sock.groupInviteCode(jid)
      result = result.split(raw).join(`https://chat.whatsapp.com/${code}`)
    } catch (error) {
      logger.warn({ err: error, jid }, 'No se pudo generar el enlace de invitación del grupo')
    }
  }
  return result
}

async function sendTaggedContent(sock, chat, announcement, mentions, mediaSource, tagLabel = '@everyone') {
  const decoratedAnnouncement = announcement
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n')
  const tagText = `╔════════════════════════╗
║ 🐉 *COMUNICADO DE LA LEGIÓN* 🌙 ║
╚════════════════════════╝

${decoratedAnnouncement}

🏷️ *Tag:* ${tagLabel}

━━━━━━━━━━━━━━━━━━━━━━━━
📜 *Notificados:* ${mentions.length} ${mentions.length === 1 ? 'participante' : 'participantes'}.
🌙 *Nuruxion Legión*`
  if (!mediaSource) {
    try {
      const image = await fs.readFile(TAG_IMAGE_PATH)
      return sock.sendMessage(chat, { image, caption: tagText, mentions })
    } catch (error) {
      logger.warn({ err: error, imagePath: TAG_IMAGE_PATH }, 'No se pudo cargar la imagen de ?tag; se enviará solo texto')
      return sock.sendMessage(chat, { text: tagText, mentions })
    }
  }

  const buffer = await downloadMediaBuffer(mediaSource.media, mediaSource.type)
  const { type, media } = mediaSource
  if (type === 'image') {
    return sock.sendMessage(chat, { image: buffer, caption: tagText, mentions, mimetype: media.mimetype })
  }
  if (type === 'video') {
    return sock.sendMessage(chat, { video: buffer, caption: tagText, mentions, mimetype: media.mimetype, gifPlayback: media.gifPlayback })
  }
  if (type === 'document') {
    return sock.sendMessage(chat, {
      document: buffer,
      caption: tagText,
      mentions,
      mimetype: media.mimetype || 'application/octet-stream',
      fileName: media.fileName || 'archivo'
    })
  }

  // WhatsApp no admite texto/menciones dentro de audios o stickers; enviamos
  // primero el aviso etiquetado y después el contenido.
  await sock.sendMessage(chat, { text: tagText, mentions })
  if (type === 'audio') {
    return sock.sendMessage(chat, { audio: buffer, mimetype: media.mimetype || 'audio/ogg; codecs=opus', ptt: media.ptt })
  }
  return sock.sendMessage(chat, { sticker: buffer })
}

function participantJid(participant) {
  if (typeof participant === 'string') return participant
  const candidates = [participant?.phoneNumber, participant?.jid, participant?.id, participant?.lid].filter(Boolean)
  return candidates.find(jid => String(jid).endsWith('@s.whatsapp.net'))
    || candidates.find(jid => !String(jid).endsWith('@lid'))
    || candidates[0]
}

function activityGroupToken(value = '') {
  return String(value).normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function activityTrackedGroups(groups) {
  const wanted = activityGroupToken(ACTIVITY_GROUP_MATCH)
  return (groups || []).filter(group => activityGroupToken(group.subject || '').includes(wanted))
}

function activityMemberEntries(groups, counts, botJid = '') {
  const members = new Map()
  for (const group of groups || []) {
    for (const participant of group.participants || []) {
      const candidates = [participant?.phoneNumber, participant?.jid, participant?.id, participant?.lid]
        .filter(Boolean)
        .map(jid => jidNormalizedUser(jid))
      const preferred = jidNormalizedUser(participantJid(participant) || '')
      if (!preferred || sameUser(preferred, botJid)) continue
      let entry = members.get(preferred)
      if (!entry) {
        entry = { jid: preferred, aliases: new Set(), numbers: new Set() }
        members.set(preferred, entry)
      }
      candidates.forEach(jid => {
        entry.aliases.add(jid)
        const number = jid.split('@')[0].split(':')[0].replace(/\D/g, '')
        if (number) entry.numbers.add(number)
      })
      entry.aliases.add(preferred)
    }
  }

  const consumedAliases = new Set()
  const results = [...members.values()].map(entry => {
    const aliases = [...entry.aliases]
    aliases.forEach(alias => consumedAliases.add(alias))
    return {
      jid: entry.jid,
      messages: aliases.reduce((total, alias) => total + (Number(counts?.[alias]) || 0), 0),
      excludedFromActivityTop: [...entry.numbers].some(number => ACTIVITY_EXCLUDED_NUMBERS.has(number))
    }
  })

  for (const [rawJid, rawAmount] of Object.entries(counts || {})) {
    const jid = jidNormalizedUser(rawJid)
    const messages = Number(rawAmount) || 0
    if (!jid || messages <= 0 || consumedAliases.has(jid) || sameUser(jid, botJid)) continue
    const number = jid.split('@')[0].split(':')[0].replace(/\D/g, '')
    results.push({
      jid,
      messages,
      excludedFromActivityTop: Boolean(number && ACTIVITY_EXCLUDED_NUMBERS.has(number))
    })
    consumedAliases.add(jid)
  }

  return results
}


// ===================================================================
// WHATSAPP: PERMISOS Y METADATA DE GRUPO
// ===================================================================
function isOwner(jid) {
  if (!/@(?:s\.whatsapp\.net|c\.us)$/.test(jid || '')) return false
  const digits = jidNormalizedUser(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '')
  return OWNER_NUMBERS.includes(digits)
}

function sameUser(a, b) {
  return sameAccount(a, b)
}

function targetTag(jid) {
  return `@${jidNormalizedUser(jid).split('@')[0].split(':')[0]}`
}

function safeWhatsAppName(value) {
  return String(value || '').replace(/[\r\n\t@]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 48)
}

function rememberWhatsAppName(jids, value) {
  const name = safeWhatsAppName(value)
  if (!name) return
  economyState.userDisplayNames ||= {}
  for (const jid of (Array.isArray(jids) ? jids : [jids]).filter(Boolean)) {
    economyState.userDisplayNames[jidNormalizedUser(jid)] = name
  }
}

function knownWhatsAppName(jids) {
  const names = economyState.userDisplayNames || {}
  for (const jid of (Array.isArray(jids) ? jids : [jids]).filter(Boolean)) {
    const found = names[jidNormalizedUser(jid)]
    if (found) return safeWhatsAppName(found)
  }
  return ''
}

function findParticipant(metadata, jid) {
  return metadata.participants.find(item => {
    const candidates = [item.id, item.jid, item.phoneNumber, item.lid].filter(Boolean)
    return candidates.some(candidate => sameAccount(candidate, jid))
  })
}

function isAdmin(participant) {
  return participant?.admin === 'admin' || participant?.admin === 'superadmin'
}

async function getMetadata(sock, groupJid, refresh = false) {
  if (!refresh) {
    const cached = groupCache.get(groupJid)
    if (cached) return cached
  }
  const metadata = await sock.groupMetadata(groupJid)
  groupCache.set(groupJid, metadata)
  return metadata
}

async function reply(sock, chat, quoted, text, mentions = []) {
  return sock.sendMessage(chat, { text, mentions }, { quoted })
}

async function sendWelcomeMessage(sock, chat, text, mentions, quoted) {
  try {
    const image = await fs.readFile(WELCOME_IMAGE_PATH)
    return await sock.sendMessage(chat, { image, caption: text, mentions }, quoted ? { quoted } : undefined)
  } catch (error) {
    logger.warn({ err: error, imagePath: WELCOME_IMAGE_PATH }, 'No se pudo cargar la imagen de bienvenida; se enviara solo texto')
    return sock.sendMessage(chat, { text, mentions }, quoted ? { quoted } : undefined)
  }
}

async function sendMemberForm(sock, chat, text, mentions, quoted) {
  try {
    const image = await fs.readFile(MEMBER_FORM_IMAGE_PATH)
    return await sock.sendMessage(chat, { image, caption: text, mentions }, quoted ? { quoted } : undefined)
  } catch (error) {
    logger.warn({ err: error, imagePath: MEMBER_FORM_IMAGE_PATH }, 'No se pudo cargar la imagen de la ficha; se enviara solo texto')
    return sock.sendMessage(chat, { text, mentions }, quoted ? { quoted } : undefined)
  }
}

const LINK_REGEX = /(https?:\/\/|www\.)\S+/i

async function deleteMessageSilently(sock, message) {
  try {
    await sock.sendMessage(message.key.remoteJid, { delete: message.key })
  } catch (error) {
    logger.warn({ err: error, messageId: message.key.id }, 'No se pudo eliminar el mensaje')
  }
}


// ===================================================================
// MODERACION: HELPERS (warns, antilink, enforcement)
// ===================================================================
async function registerWarning(sock, chat, message, targetJid, moderatorJid, reason, metadata) {
  const targetKey = jidNormalizedUser(targetJid)
  const moderatorKey = jidNormalizedUser(moderatorJid)
  const groupWarnings = runtimeState.warnings[chat] ||= {}
  const warnings = groupWarnings[targetKey] ||= []
  warnings.push({ reason, moderator: moderatorKey, createdAt: new Date().toISOString() })
  queueStateSave()
  const targetTag = `@${targetKey.split('@')[0].split(':')[0]}`
  const moderatorTag = `@${moderatorKey.split('@')[0].split(':')[0]}`
  await reply(sock, chat, message, `⚠️ *ADVERTENCIA REGISTRADA*

👤 *Usuario:* ${targetTag}
📝 *Motivo:* ${reason}
🛡️ *Moderador:* ${moderatorTag}
🔢 *Número de warns:* ${warnings.length}/${MAX_WARNS}`, [targetJid, moderatorJid])

  if (MAX_WARNS > 0 && warnings.length >= MAX_WARNS) {
    delete groupWarnings[targetKey]
    if (!Object.keys(groupWarnings).length) delete runtimeState.warnings[chat]
    queueStateSave()
    if (isAdmin(findParticipant(metadata, sock.user?.id))) {
      try {
        await sock.groupParticipantsUpdate(chat, [targetKey], 'remove')
        groupCache.del(chat)
        await sock.sendMessage(chat, { text: `👢 ${targetTag} alcanzó ${MAX_WARNS} advertencias y fue expulsado automáticamente.`, mentions: [targetJid] })
      } catch (error) {
        logger.warn({ err: error }, 'No se pudo expulsar automáticamente tras alcanzar el máximo de warns')
      }
    } else {
      await sock.sendMessage(chat, { text: `⚠️ ${targetTag} alcanzó ${MAX_WARNS} advertencias. Hazme administrador para expulsar automáticamente.`, mentions: [targetJid] })
    }
  }
}

async function enforceModeration(sock, chat, message, text, sender) {
  const mutedList = runtimeState.muted[chat]
  const antilinkOn = runtimeState.antilink[chat]
  if (!mutedList?.length && !antilinkOn) return false
  const metadata = await getMetadata(sock, chat)
  const participant = findParticipant(metadata, sender)
  if (isOwner(sender) || isAdmin(participant)) return false

  if (mutedList?.some(jid => sameUser(jid, sender))) {
    await deleteMessageSilently(sock, message)
    return true
  }

  if (antilinkOn && text && LINK_REGEX.test(text)) {
    await deleteMessageSilently(sock, message)
    await registerWarning(sock, chat, message, sender, sender, 'Enlace no autorizado (antilink activo)', metadata)
    return true
  }
  return false
}

async function requireAdmin(sock, chat, message, sender, metadata) {
  if (await isOperator(sock, message, sender)) return true
  const current = await getMetadata(sock, chat, true)
  if (isAdmin(findParticipant(current, sender))) return true
  await reply(sock, chat, message, '⛔ Este comando es solo para administradores del grupo.')
  return false
}

async function isOperator(sock, message, sender) {
  if (message.key.fromMe === true || sameAccount(sender, sock.user?.id) || sameAccount(sender, sock.user?.lid) || isOwner(sender)) return true
  if (!accountId(sender)?.endsWith('@lid')) return false
  try {
    const phone = await sock.signalRepository?.lidMapping?.getPNForLID(sender)
    return isOwner(phone) || sameAccount(phone, sock.user?.id)
  } catch { return false }
}

async function requireOperator(sock, chat, message, sender) {
  if (await isOperator(sock, message, sender)) return true
  await reply(sock, chat, message, '⛔ Solo el operador del bot puede cambiar la configuración o los recursos compartidos.')
  return false
}

async function requireBotAdmin(sock, chat, message, metadata) {
  if (isAdmin(findParticipant(metadata, sock.user?.id))) return true
  await reply(sock, chat, message, '⚠️ Necesito ser administrador del grupo para hacer eso.')
  return false
}

function staffApplicationCountdown(closesAt, now = Date.now()) {
  const remaining = Math.max(0, Number(closesAt || 0) - now)
  if (!remaining) return 'Postulaciones cerradas'
  if (remaining <= 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.ceil(remaining / (60 * 60 * 1000)))
    return hours === 1 ? 'Última hora' : `${hours} horas restantes`
  }
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000))
  return `${days} días restantes`
}

function staffApplicationDate(timestamp) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Mexico_City'
  }).format(new Date(timestamp))
}

function staffApplicationText(entry, closed = false) {
  if (closed) return `🔒 *POSTULACIONES CERRADAS | NURUXION* 🛡️

La convocatoria para Administradores/Reclutadores ha finalizado.

📅 Periodo: ${staffApplicationDate(entry.openedAt)} — ${staffApplicationDate(entry.closesAt)}

┏━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔒 *POSTULACIONES CERRADAS AUTOMÁTICAMENTE* ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━┛

Gracias a todas las personas que participaron.

*Atentamente, Directiva de NURUXION.*`

  return `📢 *¡POSTULACIONES ABIERTAS! | NURUXION* 🛡️

¡Buscamos nuevos Administradores/Reclutadores para nuestro Staff!

🥇 *Fase 1:* Formulario de postulación.
🥈 *Fase 2:* Entrevista de voz.
⏳ *Duración:* Una semana.
📅 *Cierre:* ${staffApplicationDate(entry.closesAt)}
⌛ *${staffApplicationCountdown(entry.closesAt)}*

⚠️ Prohibido utilizar IA para responder. Es obligatorio aceptar los términos y condiciones.

🔥 *¡Demuestra que tienes lo necesario para formar parte de NURUXION!*

*Atentamente, Directiva de NURUXION.*

📝 *Formulario de postulación:*
${STAFF_APPLICATION_FORM_URL}`
}

function staffApplicationContent(entry, closed = false, editKey = null) {
  const content = { text: staffApplicationText(entry, closed) }
  if (editKey) content.edit = editKey
  return content
}

async function sendStaffApplicationAnnouncement(sock, chat, entry) {
  return sock.sendMessage(chat, { text: staffApplicationText(entry, false) })
}

async function closeStaffApplications(sock, chat, entry, closedBy = 'automatico') {
  // El cierre debe quedar guardado aunque WhatsApp rechace la edición del
  // mensaje interactivo. Así un administrador puede abrir otra convocatoria
  // inmediatamente después de cerrarla manualmente.
  entry.status = 'closed'
  entry.closedAt = Date.now()
  entry.closedBy = closedBy
  entry.lastCounter = 'Postulaciones cerradas'
  queueStateSave()
  if (entry.messageKey) {
    try {
      await sock.sendMessage(chat, staffApplicationContent(entry, true, entry.messageKey))
    } catch (error) {
      logger.warn({ err: error, chat }, 'Las postulaciones se cerraron, pero WhatsApp no permitió editar el anuncio')
    }
  }
}

async function refreshStaffApplications(sock) {
  runtimeState.staffApplications ||= {}
  const now = Date.now()
  for (const [chat, entry] of Object.entries(runtimeState.staffApplications)) {
    if (!isAllowedGroup(chat)) continue
    if (!entry || entry.status !== 'open' || !entry.messageKey) continue
    try {
      if (now >= Number(entry.closesAt || 0)) {
        await closeStaffApplications(sock, chat, entry)
        continue
      }
      const counter = staffApplicationCountdown(entry.closesAt, now)
      if (counter === entry.lastCounter) continue
      await sock.sendMessage(chat, staffApplicationContent(entry, false, entry.messageKey))
      entry.lastCounter = counter
      entry.lastUpdatedAt = now
      queueStateSave()
    } catch (error) {
      logger.warn({ err: error, chat }, 'No se pudo actualizar el contador de postulaciones')
    }
  }
}


// ===================================================================
// MENU DE COMANDOS (texto de ayuda para ?comandos)
// ===================================================================
function buildCommandSections({ includeAdmin = true } = {}) {
  const sections = [
      { title: 'GENERAL', color: '#22d3ee', rows: [
        { icon: 'info', cmd: `${PREFIX}comandos`, desc: 'Ver esta lista de comandos', usage: `${PREFIX}comandos` },
        { icon: 'info', cmd: `${PREFIX}sugerencia`, desc: 'Guardar una sugerencia', usage: `${PREFIX}sugerencia (nombre) (texto)` },
        { icon: 'info', cmd: `${PREFIX}sugerencias`, desc: 'Ver sugerencias guardadas', usage: `${PREFIX}sugerencias` },
        { icon: 'info', cmd: `${PREFIX}ia`, desc: 'Consultar al asistente con IA', usage: `${PREFIX}ia [pregunta]` },
        { icon: 'kiss', cmd: `${PREFIX}kiss`, desc: 'Mandar un beso animado (solo a tu pareja si estás casado/a)', usage: `${PREFIX}kiss @usuario` },
        { icon: 'warn', cmd: `${PREFIX}punch`, desc: 'Dar un golpe animado', usage: `${PREFIX}punch @usuario` },
        { icon: 'warn', cmd: `${PREFIX}devolvergolpe`, desc: 'Devolver un golpe recibido', usage: `${PREFIX}devolvergolpe` },
        { icon: 'kiss', cmd: `${PREFIX}marry`, desc: 'Proponer matrimonio (admin: "prueba" ve una vista previa)', usage: `${PREFIX}marry @usuario` },
        { icon: 'kiss', cmd: `${PREFIX}aceptar`, desc: 'Aceptar/rechazar una propuesta', usage: `${PREFIX}aceptar / ${PREFIX}rechazar` },
        { icon: 'kiss', cmd: `${PREFIX}cancelmarry`, desc: 'Cancelar tu propuesta de matrimonio', usage: `${PREFIX}cancelmarry` },
        { icon: 'kiss', cmd: `${PREFIX}divorcio`, desc: 'Terminar tu matrimonio', usage: `${PREFIX}divorcio` },
        { icon: 'chart', cmd: `${PREFIX}points`, desc: 'Ver puntos positivos, negativos y total', usage: `${PREFIX}points @usuario` }
      ]},
      { title: 'MUSICA', color: '#60a5fa', rows: [
        { icon: 'note', cmd: `${PREFIX}musica`, desc: 'Buscar y enviar audio autorizado', usage: `${PREFIX}musica [nombre]` }
      ]},
      { title: 'PROGRESO', color: '#c084fc', rows: [
        { icon: 'info', cmd: `${PREFIX}misiones`, desc: 'Ver metas diarias y semanales; entrega recompensas al completarlas', usage: `${PREFIX}misiones` },
        { icon: 'gift', cmd: `${PREFIX}logros`, desc: 'Consultar logros desbloqueados automáticamente', usage: `${PREFIX}logros` },
        { icon: 'shield', cmd: `${PREFIX}reputacion`, desc: 'Ver reputación, actividad válida y advertencias', usage: `${PREFIX}reputacion` },
        { icon: 'warn', cmd: `${PREFIX}jefe`, desc: 'Ver el jefe comunitario o atacarlo', usage: `${PREFIX}jefe / ${PREFIX}jefe atacar` }
      ]},
      { title: 'ECONOMIA', color: '#5eead4', rows: [
        { icon: 'coin', cmd: `${PREFIX}saldo`, desc: 'Ver monedero, banco e inversiones', usage: `${PREFIX}saldo` },
        { icon: 'coin', cmd: `${PREFIX}perfil`, desc: 'Tarjeta de imagen con tu resumen', usage: `${PREFIX}perfil` },
        { icon: 'note', cmd: `${PREFIX}changetext`, desc: 'Cambiar la frase de tu perfil', usage: `${PREFIX}changetext tu frase` },
        { icon: 'coin', cmd: `${PREFIX}dep`, desc: 'Depositar al banco', usage: `${PREFIX}dep all/cantidad` },
        { icon: 'coin', cmd: `${PREFIX}retirar`, desc: 'Retirar del banco', usage: `${PREFIX}retirar all/cantidad` },
        { icon: 'chart', cmd: `${PREFIX}top`, desc: 'Rankings de dinero, XP o actividad', usage: `${PREFIX}top [xp/actividad]` },
        { icon: 'coin', cmd: `${PREFIX}enviar`, desc: 'Enviar dinero a otro usuario', usage: `${PREFIX}enviar @usuario cantidad` },
        { icon: 'bag', cmd: `${PREFIX}work`, desc: 'Trabajar y ganar monedas', usage: `${PREFIX}work` },
        { icon: 'gift', cmd: `${PREFIX}daily`, desc: 'Reclamar tu bono diario', usage: `${PREFIX}daily` },
        { icon: 'warn', cmd: `${PREFIX}rob`, desc: 'Robar el monedero de alguien', usage: `${PREFIX}rob @usuario` },
        { icon: 'dice', cmd: `${PREFIX}blackjack`, desc: 'Apostar en blackjack', usage: `${PREFIX}blackjack all/cantidad` },
        { icon: 'dice', cmd: `${PREFIX}pedir/plantarse/doblar`, desc: 'Jugar tu mano de blackjack', usage: `${PREFIX}pedir` },
        { icon: 'dice', cmd: `${PREFIX}slots`, desc: 'Jugar a la tragamonedas', usage: `${PREFIX}slots all/cantidad` },
        { icon: 'bag', cmd: `${PREFIX}tienda`, desc: 'Ver la tienda del bot', usage: `${PREFIX}tienda` },
        { icon: 'bag', cmd: `${PREFIX}tienda comprar`, desc: 'Comprar un articulo', usage: `${PREFIX}tienda comprar <id>` },
        { icon: 'bag', cmd: `${PREFIX}inventario`, desc: 'Ver tus efectos activos', usage: `${PREFIX}inventario` },
        { icon: 'chart', cmd: `${PREFIX}empresas`, desc: 'Ver la bolsa de valores', usage: `${PREFIX}empresas` },
        { icon: 'chart', cmd: `${PREFIX}comprar/vender`, desc: 'Invertir en una empresa', usage: `${PREFIX}comprar (empresa) (cant)` },
        { icon: 'chart', cmd: `${PREFIX}empresa`, desc: 'Crear las empresas del grupo', usage: `${PREFIX}empresa` }
      ]},
      { title: 'ADMINISTRACION', color: '#f87171', rows: [
        { icon: 'gift', cmd: `${PREFIX}give points`, desc: 'Dar 2 puntos de actividad a un usuario', usage: `${PREFIX}give points @usuario razón` },
        { icon: 'chart', cmd: `${PREFIX}topactividad`, desc: 'Top 5 semanal por mensajes (+3, +2, +1)', usage: `${PREFIX}topactividad` },
        { icon: 'warn', cmd: `${PREFIX}topinactividad`, desc: 'Top 2 semanal de menor actividad (-2, -1)', usage: `${PREFIX}topinactividad` },
        { icon: 'lock', cmd: `${PREFIX}close`, desc: 'Cierra el grupo, solo admins hablan', usage: `${PREFIX}close` },
        { icon: 'unlock', cmd: `${PREFIX}open`, desc: 'Abre el grupo para todos', usage: `${PREFIX}open` },
        { icon: 'megaphone', cmd: `${PREFIX}tag`, desc: 'Menciona a todos los miembros', usage: `${PREFIX}tag mensaje` },
        { icon: 'toggle', cmd: `${PREFIX}on/off`, desc: 'Activa o desactiva el bot', usage: `${PREFIX}on` },
        { icon: 'crown', cmd: `${PREFIX}adminuser`, desc: 'Asciende a un usuario a admin', usage: `${PREFIX}adminuser @usuario` },
        { icon: 'warn', cmd: `${PREFIX}kick`, desc: 'Expulsa a un usuario del grupo', usage: `${PREFIX}kick @usuario` },
        { icon: 'toggle', cmd: `${PREFIX}mute/unmute`, desc: 'Silencia o quita silencio', usage: `${PREFIX}mute @usuario` },
        { icon: 'shield', cmd: `${PREFIX}antilink`, desc: 'Elimina enlaces de no-admins', usage: `${PREFIX}antilink on/off` },
        { icon: 'warn', cmd: `${PREFIX}warn`, desc: 'Advierte a un usuario', usage: `${PREFIX}warn @usuario razon` },
        { icon: 'info', cmd: `${PREFIX}warns/unwarn`, desc: 'Consulta o quita advertencias', usage: `${PREFIX}warns @usuario` },
        { icon: 'info', cmd: `${PREFIX}plantilla`, desc: 'Prueba la ficha automatica', usage: `${PREFIX}plantilla` },
        { icon: 'info', cmd: `${PREFIX}prueba`, desc: 'Muestra bienvenida de prueba', usage: `${PREFIX}prueba` }
      ]},
      { title: 'MAZMORRA — DIVERSIÓN E INTERACCIÓN', color: '#a855f7', rows: [
        { icon: 'info', cmd: `${PREFIX}mazmorra`, desc: 'Explora la mazmorra por pisos, con jefes cada 5', usage: `${PREFIX}mazmorra` },
        { icon: 'info', cmd: `${PREFIX}magia`, desc: 'Lanza hechizos de tu elemento en la mazmorra', usage: `${PREFIX}magia` },
        { icon: 'info', cmd: `${PREFIX}habilidad`, desc: 'Gestiona tus puntos de Vida, Daño y elementos', usage: `${PREFIX}habilidad` }
      ]}
    ]
  return includeAdmin ? sections : sections.filter(section => section.title !== 'ADMINISTRACION')
}

function buildCommandsFullText(sections) {
  const CATEGORY_EMOJI = { GENERAL: '🌐', MUSICA: '🎵', PROGRESO: '🏆', ECONOMIA: '💰', ADMINISTRACION: '🛡️' }
  const ICON_EMOJI = { info: 'ℹ️', note: '📝', coin: '🪙', chart: '📊', dice: '🎲', bag: '🎒', shield: '🛡️', lock: '🔒', unlock: '🔓', megaphone: '📢', crown: '👑', warn: '⚠️', toggle: '🔁', gift: '🎁', kiss: '💋' }
  let menuText = `╭─────────────────────╮
│   📖 *NURUXION LEGION*
│   Lista de comandos
╰─────────────────────╯

`
  for (const section of sections) {
    const emoji = CATEGORY_EMOJI[section.title] || '📂'
    menuText += `${emoji} *${section.title}*
`
    if (section.title === 'MUSICA') {
      menuText += `🚧 Proximamente - estamos preparando el catalogo de musica.

`
      continue
    }
    if (section.title === 'ECONOMIA' && Date.now() < ECONOMY_LAUNCH_AT) {
      menuText += `⚠️ Fase de pruebas - el 25 de agosto se reinicia todo

`
    }
    for (const row of section.rows) {
      const rowIcon = ICON_EMOJI[row.icon] || '▸'
      menuText += `${rowIcon} *${row.cmd}* - ${row.desc}
`
      if (row.usage && row.usage !== row.cmd) menuText += `   ↳ _${row.usage}_
`
    }
    menuText += '\n'
  }
  menuText += `\n💡 *Consejo:* usa *${PREFIX}cmds economia*, *${PREFIX}cmds general* o *${PREFIX}cmds mazmorra* para ver solo una categoría.\n`
  return menuText.trim()
}


// ===================================================================
// DONACIONES PRIVADAS
// ===================================================================
function parseDonationAmount(value = '') {
  const match = value.trim().toLowerCase().match(/^(\d+(?:[.,]\d{1,2})?)\s*(?:usd|d[oó]lar(?:es)?)?$/i)
  if (!match) return null
  const amount = Number(match[1].replace(',', '.'))
  return Number.isFinite(amount) && amount >= DONATION_MIN_USD && amount <= DONATION_MAX_USD ? amount : null
}

function donationConfirmationText(amount) {
  return [
    '💜 *DONACIÓN VOLUNTARIA A NURUXION*',
    '',
    'Has indicado que deseas donar *$' + amount.toFixed(2) + ' USD*.',
    '',
    'Esta aportación es completamente voluntaria y no concede rangos, artículos, ventajas ni beneficios dentro del proyecto. Tu apoyo ayuda a mantener y mejorar Nuruxion y apoya directamente a su creador.',
    '',
    '🔒 El proceso continuará de manera privada. El bot no te pedirá contraseñas, códigos de verificación ni datos bancarios.',
    '',
    'Responde *' + PREFIX + 'confirmardonacion* para recibir el enlace oficial de PayPal o *' + PREFIX + 'cancelardonacion* para cancelar.',
    '',
    '⏳ Esta solicitud vence en 15 minutos.'
  ].join('\n')
}

async function handlePrivateDonationCommand(sock, chat, text, message = null) {
  if (!text.startsWith(PREFIX)) return false
  const body = text.slice(PREFIX.length).trim()
  const [rawCommand] = body.split(/\s+/)
  const command = (rawCommand || '').toLowerCase()
  const content = body.slice(rawCommand?.length || 0).trim()
  const userAliases = [chat, message?.key?.remoteJidAlt, message?.key?.participantAlt, message?.participantAlt, message?.key?.participant, message?.participant]
    .filter(Boolean)
    .map(jid => jidNormalizedUser(jid))
  const userKey = userAliases.find(jid => jid.endsWith('@s.whatsapp.net')) || userAliases[0] || jidNormalizedUser(chat)
  const pendingKey = userAliases.find(jid => runtimeState.pendingDonations[jid]) || userKey

  if (command === 'donar' && !DONATION_PAYPAL_URL) return
  if (command === 'donar') {
    const amount = parseDonationAmount(content)
    if (!amount) {
      await sock.sendMessage(chat, { text: 'Uso: *' + PREFIX + 'donar <cantidad> dolar*\nEjemplo: *' + PREFIX + 'donar 5 dolares*\n\nCantidad permitida: $' + DONATION_MIN_USD + ' a $' + DONATION_MAX_USD + ' USD.' })
      return true
    }
    runtimeState.pendingDonations[userKey] = { amount, createdAt: Date.now() }
    queueStateSave()
    await sock.sendMessage(chat, { text: donationConfirmationText(amount) })
    return true
  }

  if (command === 'cancelardonacion') {
    delete runtimeState.pendingDonations[pendingKey]
    queueStateSave()
    await sock.sendMessage(chat, { text: '✅ La solicitud de donación fue cancelada. No se realizó ningún pago.' })
    return true
  }

  if (command === 'confirmardonacion') {
    const pending = runtimeState.pendingDonations[pendingKey]
    if (!pending || Date.now() - Number(pending.createdAt || 0) > DONATION_PENDING_MS) {
      delete runtimeState.pendingDonations[pendingKey]
      queueStateSave()
      await sock.sendMessage(chat, { text: '⌛ No tienes una solicitud vigente. Usa *' + PREFIX + 'donar <cantidad> dolar* para comenzar.' })
      return true
    }
    const amount = Number(pending.amount)
    const paymentUrl = DONATION_PAYPAL_URL + '/' + amount.toFixed(2) + 'USD'
    delete runtimeState.pendingDonations[pendingKey]
    queueStateSave()
    await sock.sendMessage(chat, { text: [
      '💜 *APOYO VOLUNTARIO A NURUXION*',
      '',
      'Cantidad seleccionada: *$' + amount.toFixed(2) + ' USD*',
      '',
      'Paga únicamente desde el enlace oficial:',
      paymentUrl,
      '',
      'Verifica que el destinatario sea *@pagos35589* antes de continuar.',
      'PayPal mostrará los datos públicos del propietario de la cuenta.',
      '',
      '⚠️ Abrir el enlace no realiza el pago automáticamente. La confirmación final se hace dentro de PayPal.'
    ].join('\n') })
    return true
  }

  return false
}


// ===================================================================
// DESPACHADOR PRINCIPAL DE COMANDOS
// Cada comando se resuelve aqui como un bloque secuencial
// `if (command === '...') { ... return }`. Los banners de abajo
// marcan el inicio de cada grupo para ubicarse rapido.
// ===================================================================
// ===================================================================
// ENRUTADOR DE GRUPOS: CLAN Y SERVICIO DE MEMBRESIAS
// Una sola conexion de WhatsApp, datos y comandos completamente aislados.
// ===================================================================
const MEMBERSHIP_COMMANDS = new Set(['registrarbot', 'membresia', 'planes', 'plan', 'configbot'])
const ROUTER_COMMANDS = new Set(['scopebot'])
const MEMBERSHIP_ENABLED = false
const DEFAULT_MEMBERSHIP_PLANS = {
  free: { name: 'Free', priceMxn: 0, maxGroups: 1 },
  premium: { name: 'Premium', priceMxn: 49, maxGroups: 2 },
  plus: { name: 'Plus', priceMxn: 99, maxGroups: 5 }
}
let groupScopes = { version: 1, bootstrapCompleted: false, groups: {} }

function membershipGroupFile(chat) {
  return path.join(MEMBERSHIP_GROUPS_DIR, String(chat || '').replace(/[^a-zA-Z0-9._-]/g, '_') + '.json')
}

async function saveJsonAtomic(file, value) {
  const temporary = file + '.tmp'
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(temporary, file)
}

async function loadGroupScopes() {
  await fs.mkdir(MEMBERSHIP_GROUPS_DIR, { recursive: true })
  try {
    groupScopes = { ...groupScopes, ...JSON.parse(await fs.readFile(GROUP_SCOPES_FILE, 'utf8')) }
    groupScopes.groups ||= {}
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn({ err: error }, 'No se pudo leer el enrutador de grupos')
    await saveJsonAtomic(GROUP_SCOPES_FILE, groupScopes)
  }
  try {
    await fs.access(MEMBERSHIP_PLANS_FILE)
  } catch {
    await saveJsonAtomic(MEMBERSHIP_PLANS_FILE, DEFAULT_MEMBERSHIP_PLANS)
  }
}

async function saveGroupScopes() {
  await fs.mkdir(MEMBERSHIP_GROUPS_DIR, { recursive: true })
  await saveJsonAtomic(GROUP_SCOPES_FILE, groupScopes)
}

function getGroupScope(chat) {
  return isAllowedGroup(chat) ? 'clan' : 'unregistered'
}

async function setGroupScope(chat, type, metadata = {}) {
  if (!['clan', 'membership'].includes(type)) throw new Error('Tipo de grupo inválido')
  const previous = groupScopes.groups[chat] || {}
  groupScopes.groups[chat] = {
    ...previous,
    type,
    subject: metadata.subject || previous.subject || '',
    ownerJid: metadata.ownerJid || previous.ownerJid || null,
    plan: type === 'membership' ? (metadata.plan || previous.plan || 'free') : null,
    updatedAt: new Date().toISOString()
  }
  await saveGroupScopes()
  if (type === 'membership') await saveJsonAtomic(membershipGroupFile(chat), groupScopes.groups[chat])
  return groupScopes.groups[chat]
}

function membershipPlansText() {
  return [
    '🤖 *NOCTIS BOT PARA GRUPOS*',
    '',
    '🆓 *Free* — 1 grupo · configuración básica',
    '💜 *Premium* — $49 MXN/mes · hasta 2 grupos · personalización y moderación',
    '🌌 *Plus* — $99 MXN/mes · hasta 5 grupos · automatizaciones y soporte prioritario',
    '',
    'Este servicio es independiente del clan Nuruxion.'
  ].join('\n')
}

async function handleRouterCommand(sock, chat, sender, metadata, command, commandContent, message) {
  if (!ROUTER_COMMANDS.has(command)) return false
  if (!isOwner(sender)) return true
  const requested = commandContent.trim().toLowerCase()
  if (requested === 'clan') {
    await setGroupScope(chat, 'clan', { subject: metadata.subject })
    await reply(sock, chat, message, '🔒 Este grupo quedó protegido como *CLAN*. Solo responderá el sistema de Nuruxion.')
    return true
  }
  if (requested === 'membresia' || requested === 'membership') {
    await setGroupScope(chat, 'membership', { subject: metadata.subject, ownerJid: jidNormalizedUser(sender), plan: 'free' })
    await reply(sock, chat, message, '🤖 Este grupo quedó registrado en el sistema de *MEMBRESÍAS* y el bot del clan guardará silencio aquí.')
    return true
  }
  await reply(sock, chat, message, 'Uso exclusivo del Owner: *?scopebot clan* o *?scopebot membresia*.')
  return true
}

async function handleMembershipCommand(sock, chat, sender, metadata, command, commandContent, message) {
  if (!MEMBERSHIP_COMMANDS.has(command)) return false
  const currentScope = getGroupScope(chat)
  const participant = findParticipant(metadata, sender)
  const canConfigure = isOwner(sender) || isAdmin(participant)

  if (command === 'planes') {
    await reply(sock, chat, message, membershipPlansText())
    return true
  }

  if (command === 'registrarbot') {
    if (currentScope === 'clan') return true
    if (!canConfigure) {
      await reply(sock, chat, message, '⛔ Solo un administrador del grupo puede registrar el bot.')
      return true
    }
    const record = await setGroupScope(chat, 'membership', {
      subject: metadata.subject,
      ownerJid: jidNormalizedUser(sender),
      plan: 'free'
    })
    await reply(sock, chat, message, '✅ *Grupo registrado correctamente*\n\nPlan: *Free*\nPropietario: @' + jidNormalizedUser(record.ownerJid).split('@')[0].split(':')[0] + '\n\nUsa *?membresia* para consultar el servicio.', [record.ownerJid])
    return true
  }

  if (currentScope !== 'membership') return true
  const record = groupScopes.groups[chat]
  if (command === 'membresia' || command === 'plan') {
    await reply(sock, chat, message, '🤖 *MEMBRESÍA DEL GRUPO*\n\nGrupo: *' + (record.subject || metadata.subject || 'Sin nombre') + '*\nPlan: *' + String(record.plan || 'free').toUpperCase() + '*\nEstado: *Activo*\n\nLa configuración de este servicio está separada del clan Nuruxion.')
    return true
  }
  if (command === 'configbot') {
    if (!canConfigure && !sameUser(record.ownerJid, sender)) {
      await reply(sock, chat, message, '⛔ Solo el propietario o un administrador puede ver esta configuración.')
      return true
    }
    await reply(sock, chat, message, '⚙️ *CONFIGURACIÓN DEL BOT*\n\nPlan: *' + String(record.plan || 'free').toUpperCase() + '*\nPrefijo: *?*\nGrupo aislado: *Sí*\nComandos del clan: *Bloqueados*')
    return true
  }
  return true
}


// ===================================================================
// EXPANSION NURUXION 2026: progreso, misiones, logros y jefe comunitario
// Mantiene separados el clan y las membresias; usa el guardado existente.
// ===================================================================
const EXPANSION_VERSION = 1
const EXPANSION_COMMANDS = new Set(['misiones', 'logros', 'reputacion', 'jefe'])
function expansionState() {
  economyState.nuruxionExpansion ||= { version: EXPANSION_VERSION, users: {}, boss: null, history: [] }
  economyState.nuruxionExpansion.users ||= {}
  economyState.nuruxionExpansion.history ||= []
  return economyState.nuruxionExpansion
}
function expansionUser(jid) {
  const key = jidNormalizedUser(jid || '')
  const state = expansionState()
  state.users[key] ||= { validMessages: 0, activeDays: {}, lastText: '', lastTextAt: 0, dungeonRuns: 0, bossDamage: 0, reputation: 0, achievements: [], missionClaims: {}, relationshipHistory: [] }
  return state.users[key]
}
function mxDateKey(timestamp = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp))
}
function expansionWeekKey(timestamp = Date.now()) {
  const date = new Date(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp)))
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return mxDateKey(date.getTime())
}
function trackExpansionActivity(chat, jid, rawText) {
  if (!jid || !rawText || rawText.startsWith(PREFIX)) return
  const clean = normalizedText(rawText).replace(/\s+/g, ' ').trim()
  if (clean.length < 4 || /^(.)\1{3,}$/.test(clean)) return
  const user = expansionUser(jid)
  const now = Date.now()
  if (user.lastText === clean && now - user.lastTextAt < 120000) return
  user.lastText = clean.slice(0, 180)
  user.lastTextAt = now
  user.validMessages += 1
  user.activeDays[mxDateKey(now)] = true
  const oldDays = Object.keys(user.activeDays).sort()
  while (oldDays.length > 45) delete user.activeDays[oldDays.shift()]
  user.reputation = Math.min(1000, (user.reputation || 0) + (user.validMessages % 12 === 0 ? 1 : 0))
  queueEconomySave()
}
function computedAchievements(jid, chat) {
  const user = expansionUser(jid)
  const account = getAccount(jid)
  const inventory = getInventory(jid)
  const achievements = []
  if ((account.wallet || 0) + (account.bank || 0) >= 1000000) achievements.push('Magnate de Nuruxion')
  if (Object.keys(user.activeDays || {}).length >= 7) achievements.push('Constancia de 7 dias')
  if ((user.validMessages || 0) >= 100) achievements.push('Voz de la comunidad')
  if ((user.bossDamage || 0) >= 1000) achievements.push('Cazador comunitario')
  if ((inventory.owned || []).length >= 5) achievements.push('Coleccionista')
  if (spouseOf(jid)) achievements.push('Alianza de corazones')
  const warnings = (runtimeState.warnings[chat]?.[jid] || []).length
  if (!warnings && (user.validMessages || 0) >= 50) achievements.push('Honor impecable')
  user.achievements = [...new Set([...(user.achievements || []), ...achievements])]
  return user.achievements
}
function reputationSnapshot(jid, chat) {
  const user = expansionUser(jid)
  const warnings = (runtimeState.warnings[chat]?.[jid] || []).length
  const activeDays = Object.keys(user.activeDays || {}).length
  const value = Math.max(-100, Math.min(1000, (user.reputation || 0) + activeDays * 2 - warnings * 25))
  const rank = value >= 150 ? 'Ejemplar' : value >= 60 ? 'Confiable' : value >= 0 ? 'Neutral' : 'En observacion'
  return { value, rank, warnings, activeDays }
}
function missionSnapshot(jid) {
  const user = expansionUser(jid)
  const today = mxDateKey()
  const week = expansionWeekKey()
  const dailyMessages = user.activeDays[today] ? Math.min(10, user.validMessages) : 0
  const weeklyDays = Object.keys(user.activeDays || {}).filter(key => key >= week).length
  return { today, week, dailyMessages, weeklyDays, bossDamage: user.bossDamage || 0 }
}
function claimMissionRewards(jid, snapshot) {
  const user = expansionUser(jid)
  const account = getAccount(jid)
  const rewards = []
  const claims = user.missionClaims ||= {}
  if (snapshot.dailyMessages >= 10 && !claims['daily:' + snapshot.today]) {
    claims['daily:' + snapshot.today] = true
    account.wallet += 250
    economyState.xp[jid] = (economyState.xp[jid] || 0) + 30
    rewards.push('Diaria completada: +250 y +30 XP')
  }
  if (snapshot.weeklyDays >= 4 && !claims['weekly:' + snapshot.week]) {
    claims['weekly:' + snapshot.week] = true
    account.bank += 900
    economyState.xp[jid] = (economyState.xp[jid] || 0) + 100
    rewards.push('Semanal completada: +900 y +100 XP')
  }
  if (rewards.length) queueEconomySave()
  return rewards
}
function currentCommunityBoss(memberCount = 20) {
  const state = expansionState()
  const week = expansionWeekKey()
  if (!state.boss || state.boss.week !== week || state.boss.defeated) {
    const maxHp = Math.max(30000, Math.min(250000, memberCount * 4500))
    state.boss = { week, name: 'Guardian del Eclipse', hp: maxHp, maxHp, defeated: false, damage: {}, attacks: {} }
    queueEconomySave()
  }
  return state.boss
}
async function handleExpansionCommand(sock, chat, sender, metadata, command, commandContent, message) {
  if (!EXPANSION_COMMANDS.has(command)) return false
  const jid = jidNormalizedUser(sender || '')
  if (command === 'misiones') {
    const snapshot = missionSnapshot(jid)
    const rewards = claimMissionRewards(jid, snapshot)
    const story = winterFlavor('missions') || narrativeLine('missions', jid)
    await reply(sock, chat, message, missionView(snapshot, rewards, story))
    return true
  }
  if (command === 'logros') {
    const achievements = computedAchievements(jid, chat)
    await reply(sock, chat, message, '🏆 *LOGROS DE NURUXION*\n\n' + (achievements.length ? achievements.map((item, index) => (index + 1) + '. ✦ ' + item).join('\n') : 'Aun no has desbloqueado logros. Participa, explora y ayuda a la comunidad.'))
    queueEconomySave()
    return true
  }
  if (command === 'reputacion') {
    const rep = reputationSnapshot(jid, chat)
    await reply(sock, chat, message, '🛡️ *REPUTACION*\n\nRango: *' + rep.rank + '*\nPuntuacion: *' + rep.value + '*\nDias activos recientes: ' + rep.activeDays + '\nAdvertencias: ' + rep.warnings + '\n\nLa reputacion no se puede transferir y premia participacion real, no spam.')
    return true
  }
  const boss = currentCommunityBoss(metadata.participants?.length || 20)
  const action = normalizedText(commandContent).split(/\s+/)[0]
  if (action === 'atacar') {
    const attack = boss.attacks[jid] ||= { windowAt: Date.now(), count: 0 }
    if (Date.now() - attack.windowAt >= 48 * 60 * 60 * 1000) { attack.windowAt = Date.now(); attack.count = 0 }
    if (attack.count >= 10) {
      const hours = Math.max(1, Math.ceil((48 * 60 * 60 * 1000 - (Date.now() - attack.windowAt)) / 3600000))
      await reply(sock, chat, message, '😮‍💨 Tu personaje ya uso sus 10 ataques. Recuperara fuerzas en aproximadamente ' + hours + ' h.')
      return true
    }
    const level = levelFromXp(economyState.xp[jid] || 0)
    const damage = 220 + Math.floor(Math.random() * 181) + Math.min(300, level * 8)
    attack.count += 1
    boss.hp = Math.max(0, boss.hp - damage)
    boss.damage[jid] = (boss.damage[jid] || 0) + damage
    expansionUser(jid).bossDamage += damage
    if (boss.hp <= 0) boss.defeated = true
    queueEconomySave()
    await reply(sock, chat, message, '⚔️ Causaste *' + damage + '* de daño a *' + boss.name + '*.\n❤️ Vida: ' + boss.hp + '/' + boss.maxHp + '\n🎟️ Ataques restantes: ' + (10 - attack.count) + (boss.defeated ? '\n\n🏆 ¡El jefe fue derrotado por la comunidad!' : ''))
    return true
  }
  const leaders = Object.entries(boss.damage || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
  await reply(sock, chat, message, '🐲 *JEFE COMUNITARIO: ' + boss.name.toUpperCase() + '*\n\n❤️ Vida: ' + boss.hp + '/' + boss.maxHp + '\nFase: *' + (boss.hp <= boss.maxHp * 0.25 ? 'Furia final' : boss.hp <= boss.maxHp * 0.6 ? 'Eclipse' : 'Despertar') + '*\n\n🏅 Daño destacado:\n' + (leaders.length ? leaders.map((entry, index) => '#' + (index + 1) + ' ' + targetTag(entry[0]) + ' — ' + entry[1]).join('\n') : 'Aun nadie ha atacado.') + '\n\nUsa *?jefe atacar*. Cada persona tiene 10 ataques cada 2 dias.', leaders.map(entry => entry[0]))
  return true
}
function expansionProfileText(jid, chat) {
  const user = expansionUser(jid)
  const rep = reputationSnapshot(jid, chat)
  const achievements = computedAchievements(jid, chat)
  const boss = expansionState().boss
  return '\n🛡️ Reputacion: ' + rep.rank + ' (' + rep.value + ')' +
    '\n🏆 Logros: ' + achievements.length +
    '\n📜 Dias activos: ' + Object.keys(user.activeDays || {}).length +
    '\n🐉 Daño a jefes: ' + (user.bossDamage || 0) +
    (boss ? '\n🌑 Jefe actual: ' + boss.hp + '/' + boss.maxHp + ' HP' : '')
}

async function handleChristmasBot(sock, chat, sender, metadata, command, input, message, privateChat = false) {
  const resolveIdentity = async raw => {
    const participant = metadata ? findParticipant(metadata, raw) : null
    let identity = jidNormalizedUser(participant?.phoneNumber || participant?.jid || raw || '')
    if (identity.endsWith('@lid')) {
      try { identity = jidNormalizedUser(await sock.signalRepository?.lidMapping?.getPNForLID(identity) || '') } catch { return null }
    }
    return identity.endsWith('@s.whatsapp.net') ? identity : null
  }
  const jid = await resolveIdentity(sender)
  if (!jid) { await reply(sock, chat, message, 'No pude comprobar tu identidad de WhatsApp para esta actividad. Inténtalo de nuevo más tarde.'); return }
  const content = unwrapMessage(message.message)
  const context = content.extendedTextMessage?.contextInfo || content.imageMessage?.contextInfo || {}
  const mentioned = context.mentionedJid?.[0]
  const member = mentioned && metadata ? findParticipant(metadata, mentioned) : null
  const target = member ? await resolveIdentity(mentioned) : null
  const owner = !privateChat && await isOperator(sock, message, sender)
  const result = runChristmas(economyState, { jid, group: privateChat ? '' : chat, command, input, owner, target, privateChat })
  if (result.coins) getAccount(jid).wallet += result.coins
  if (economyState.christmas2026) queueEconomySave()
  await reply(sock, chat, message, result.text, result.mentions)
}

const communityPromoter = createCommunityPromoter({
  isOwner,
  allowedGroup: isAllowedGroup,
  configuredParent: process.env.APPLICATIONS_COMMUNITY_JID || '',
  invalidate: id => groupCache.del(id)
})

function saveCommunityPromotionAudit(result) {
  if (!result.audit) return
  economyState.communityPromotionHistory ||= []
  economyState.communityPromotionHistory.push(result.audit)
  economyState.communityPromotionHistory = economyState.communityPromotionHistory.slice(-100)
  queueEconomySave()
}

async function handleCommand(sock, message) {
  const chat = message.key.remoteJid
  if (!chat) return

  const content = unwrapMessage(message.message)
  const text = messageText(content).trim()
  const sender = message.key.participant || message.participant || (message.key.fromMe ? sock.user?.id : chat)
  const isGroup = chat.endsWith('@g.us')

  if (!isGroup || !isAllowedGroup(chat)) return

  // El alcance se decide antes de contar actividad, XP o ejecutar comandos.
  // Así los datos del clan y de membresías nunca se mezclan.
  const preliminaryBody = text.startsWith(PREFIX) ? text.slice(PREFIX.length).trim() : ''
  const [preliminaryRawCommand] = preliminaryBody.split(/\s+/)
  const preliminaryCommand = preliminaryRawCommand?.toLowerCase()
  const metadata = await getMetadata(sock, chat, ['kick', 'warn', 'mute', 'unmute', 'close', 'open'].includes(preliminaryCommand))
  if (sender && message.pushName) {
    const participant = findParticipant(metadata, sender)
    rememberWhatsAppName([
      sender,
      message.key.participantAlt,
      message.participantAlt,
      participant?.phoneNumber,
      participant?.jid,
      participant?.id,
      participant?.lid
    ], message.pushName)
  }
  const preliminaryContent = preliminaryBody.slice(preliminaryRawCommand?.length || 0).trim()
  const groupScope = getGroupScope(chat)

  if (preliminaryCommand && ROUTER_COMMANDS.has(preliminaryCommand)) {
    if (MEMBERSHIP_ENABLED) await handleRouterCommand(sock, chat, sender, metadata, preliminaryCommand, preliminaryContent, message)
    return
  }

  if (groupScope === 'membership' || groupScope === 'unregistered') {
    if (MEMBERSHIP_ENABLED && preliminaryCommand && MEMBERSHIP_COMMANDS.has(preliminaryCommand)) {
      await handleMembershipCommand(sock, chat, sender, metadata, preliminaryCommand, preliminaryContent, message)
    }
    return
  }

  // En grupos del clan se ignoran silenciosamente los comandos de membresía.
  if (preliminaryCommand && MEMBERSHIP_COMMANDS.has(preliminaryCommand)) return

  if (sender && !message.key.fromMe) {
    const activitySenderCandidates = [message.key.participantAlt, message.participantAlt, message.key.participant, message.participant, sender]
      .filter(Boolean)
      .map(jid => jidNormalizedUser(jid))
    const counterKey = activitySenderCandidates.find(jid => jid.endsWith('@s.whatsapp.net')) || activitySenderCandidates[0]
    if (!counterKey) return
    economyState.messageCounts[counterKey] = (economyState.messageCounts[counterKey] || 0) + 1
    const activityPeriod = activityPeriodInfo()
    if (activityPeriod.counting) {
      runtimeState.activityMessages[activityPeriod.key] ||= {}
      runtimeState.activityMessages[activityPeriod.key][chat] ||= {}
      runtimeState.activityMessages[activityPeriod.key][chat][counterKey] = (runtimeState.activityMessages[activityPeriod.key][chat][counterKey] || 0) + 1
      const retainedWeeks = Object.keys(runtimeState.activityMessages).sort()
      while (retainedWeeks.length > 8) delete runtimeState.activityMessages[retainedWeeks.shift()]
      scheduleRuntimeStateSave()
    }
    const currentLevelForXp = levelFromXp(economyState.xp[counterKey] || 0)
    economyState.xp[counterKey] = (economyState.xp[counterKey] || 0) + xpPerMessageForLevel(currentLevelForXp)
    trackExpansionActivity(chat, counterKey, text)
  }

  if (!economyState.launchResetDone && Date.now() >= ECONOMY_LAUNCH_AT) {
    economyState.wallets = {}
    economyState.robCooldowns = {}
    economyState.workCooldowns = {}
    economyState.workUsage = {}
    economyState.blackjackGames = {}
    economyState.companies = {}
    economyState.inventory = {}
    economyState.dailyCooldowns = {}
    economyState.dailyStreaks = {}
    economyState.messageCounts = {}
    economyState.launchResetDone = true
    queueEconomySave()
    logger.info('Economia y XP reiniciados automaticamente al abrir al publico')
  }

  if (runtimeState.enabled && sender) {
    if (await enforceModeration(sock, chat, message, text, sender)) return
  }

  if (!text.startsWith(PREFIX)) return

  const commandBody = text.slice(PREFIX.length).trim()
  const [rawCommand] = commandBody.split(/\s+/)
  const command = rawCommand?.toLowerCase()
  const commandContent = commandBody.slice(rawCommand?.length || 0).trim()
  if (!command) return

  if (command === 'ecoroto') {
    if (!runtimeState.enabled || !sender) return
    if (metadata.subject !== RESTRICTED_COMMANDS_GROUP_NAME) {
      await reply(sock, chat, message, `Ese comando solo se puede usar en el grupo *${RESTRICTED_COMMANDS_GROUP_NAME}*.`)
      return
    }
    economyState.ecoRotoBeta ??= {}
    const playerId = jidNormalizedUser(sender)
    const inventory = economyState.inventory[playerId]
    const answer = ecoRoto(economyState.ecoRotoBeta, playerId, commandContent, PREFIX, chat, { gear: inventory?.owned || [], titleId: inventory?.ecoRotoTitle })
    queueEconomySave()
    await reply(sock, chat, message, answer)
    return
  }

  if (CHRISTMAS_COMMANDS.has(command)) {
    if (!runtimeState.enabled) return
    if (metadata.subject !== RESTRICTED_COMMANDS_GROUP_NAME) {
      await reply(sock, chat, message, `Ese comando solo se puede usar en el grupo *${RESTRICTED_COMMANDS_GROUP_NAME}*.`)
      return
    }
    await handleChristmasBot(sock, chat, sender, metadata, command, commandContent, message)
    return
  }

  if (command === 'mazmorra') expansionUser(jidNormalizedUser(sender || '')).dungeonRuns += 1
  const supported = new Set(['misiones', 'logros', 'reputacion', 'jefe', 'close', 'open', 'tag', 'on', 'off', 'adminuser', 'kick', 'excarcelar', 'mute', 'unmute', 'antilink', 'warn', 'warns', 'unwarn', 'postulacionesadmin', 'cerrarpostulaciones', 'sugerencia', 'sugerencias', 'plantilla', 'comandos', 'cmds', 'ayuda', 'help', 'prueba', 'musica', 'play', 'ia', 'pregunta', 'kiss', 'beso', 'punch', 'devolvergolpe', 'devolverpunch', 'marry', 'casar', 'aceptar', 'rechazar', 'cancelmarry', 'cancelarmarry', 'cancelarboda', 'divorcio', 'divorciar', 'saldo', 'balance', 'bal', 'perfil', 'profile', 'changetext', 'frase', 'dep', 'deposito', 'retirar', 'withdraw', 'rob', 'work', 'trabajar', 'blackjack', 'bj', 'pedir', 'plantarse', 'doblar', 'comprar', 'vender', 'empresas', 'empresa', 'tienda', 'inventario', 'daily', 'diario', 'top', 'ricos', 'enviar', 'transferir', 'slots', 'tragamonedas', 'give', 'points', 'topactividad', 'donar', 'topinactividad', 'add', 'prestamo', 'pagar', 'deuda', 'fianza', 'inversiones', 'explore', 'explorar', 'mine', 'mina', 'mazmorra', 'magia', 'habilidad', 'evento', 'atacar', 'saltar', 'salir', 'desarmar', 'esquivar', 'liberar', 'ignorar', 'adelante', 'avanzar', 'izquierda', 'derecha', 'guardar', 'abrir', 'seguir', 'pelear', 'huir', 'curar', 'comprarvida', 'comerciar', 'repararportal', 'romper', 'si', 'no', 'rojo', 'negro'])
  if (!supported.has(command) && command !== 'music' && command !== 'generos') return

  // Cuando esta apagado, solo ?on sigue disponible.
  if (!runtimeState.enabled && command !== 'on') return

  if ((RESTRICTED_COMMANDS.has(command) || command === 'music' || command === 'generos') && metadata.subject !== RESTRICTED_COMMANDS_GROUP_NAME) {
    await reply(sock, chat, message, `Ese comando solo se puede usar en el grupo *${RESTRICTED_COMMANDS_GROUP_NAME}*.`)
    return
  }

  if (await handleExpansionCommand(sock, chat, sender, metadata, command, commandContent, message)) return

  if (command === 'postulacionesadmin' && !STAFF_APPLICATION_FORM_URL) return
  if (command === 'postulacionesadmin') {
    if (!await requireAdmin(sock, chat, message, sender, metadata)) return
    runtimeState.staffApplications ||= {}
    const previous = runtimeState.staffApplications[chat]
    if (previous?.status === 'open' && previous.formatVersion !== 4 && previous.messageKey && Number(previous.closesAt || 0) > Date.now()) {
      try {
        await sock.sendMessage(chat, staffApplicationContent(previous, false, previous.messageKey))
        previous.formatVersion = 4
        previous.lastCounter = staffApplicationCountdown(previous.closesAt)
        queueStateSave()
        return
      } catch (error) {
        logger.warn({ err: error, chat }, 'No se pudo migrar el anuncio de postulaciones; se creará uno nuevo')
      }
    }
    if (previous?.status === 'open' && previous.formatVersion === 4 && Number(previous.closesAt || 0) > Date.now()) {
      await reply(sock, chat, message, `⚠️ Ya existe una convocatoria activa. Quedan *${staffApplicationCountdown(previous.closesAt)}*.`)
      return
    }
    if (previous?.status === 'open') {
      previous.status = 'closed'
      previous.closedAt = Date.now()
      previous.closedBy = 'migracion-formato'
    }
    const openedAt = Date.now()
    const entry = { openedAt, closesAt: openedAt + STAFF_APPLICATION_DURATION_MS, status: 'open', formatVersion: 4, openedBy: jidNormalizedUser(sender || ''), lastCounter: staffApplicationCountdown(openedAt + STAFF_APPLICATION_DURATION_MS) }
    const sent = await sendStaffApplicationAnnouncement(sock, chat, entry)
    entry.messageKey = sent?.key
    runtimeState.staffApplications[chat] = entry
    queueStateSave()
    return
  }

  if (command === 'cerrarpostulaciones') {
    if (!await requireAdmin(sock, chat, message, sender, metadata)) return
    const entry = runtimeState.staffApplications?.[chat]
    if (!entry || entry.status !== 'open') {
      await reply(sock, chat, message, 'ℹ️ No hay postulaciones activas en este grupo.')
      return
    }
    await closeStaffApplications(sock, chat, entry, jidNormalizedUser(sender || ''))
    return
  }

  // Derrumbe de la mazmorra antigua: sólo los dos comandos exactos pueden activarlo.
  const collapseArg = commandContent.trim().toLowerCase()
  const collapseTrigger = command === 'mazmorra' && (collapseArg === '' || collapseArg === 'checkpoint')
  if (['mazmorra', 'mine', 'mina'].includes(command) && (collapseTrigger || economyState.mineLegacyCollapse?.closedAt)) {
    if (!economyState.mineLegacyCollapse?.closedAt) {
      try {
        // Vaciar escrituras pendientes antes de guardar la copia y el cierre atómico.
        while (economyPendingSave || economySaveInFlight) await flushEconomySave()
        if (!economyState.mineLegacyCollapse?.closedAt) {
          const now = Date.now()
          const before = JSON.stringify(economyState)
          const next = JSON.parse(before)
          const removed = new Set([...PICKAXE_IDS, 'cofre_cerrado'])
          let inside = 0
          for (const inv of Object.values(next.inventory || {})) {
            if (Array.isArray(inv?.owned)) inv.owned = inv.owned.filter(id => !removed.has(id))
          }
          for (const [id, run] of Object.entries(next.mine || {})) {
            if (!run || typeof run !== 'object') continue
            delete run.checkpointFloor
            if (!run.active) continue
            inside++
            const account = next.wallets?.[id]
            if (Number.isFinite(account?.wallet) && account.wallet > 0) {
              account.wallet -= Math.floor(account.wallet * 0.8)
            }
            run.hp = 0
            run.active = false
            run.pending = null
          }
          next.mineLegacyCollapse = { closedAt: now, inside }
          const backup = ECONOMY_FILE + '.before-legacy-collapse-' + now + '.bak'
          const staged = ECONOMY_FILE + '.legacy-collapse.tmp'
          writeFileSync(backup, before, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
          writeFileSync(staged, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 })
          renameSync(staged, ECONOMY_FILE)
          economyState = next
          logger.info({ inside }, 'Mazmorra antigua destruida; respaldo y cierre guardados')
        }
      } catch (error) {
        logger.warn({ err: error }, 'No se pudo aplicar el derrumbe de la mazmorra')
        await reply(sock, chat, message, '⚠️ No se pudo completar el derrumbe. No se aplicó el reinicio; inténtalo de nuevo.')
        return
      }
    }
    await reply(sock, chat, message, '🏚️ *『 MAZMORRA DESTRUIDA 』* ⚔️\n\n💥 ¡La mazmorra ha sido completamente destruida! Los aventureros han superado todos sus desafíos.\n\n🧭 *Nuestros exploradores han iniciado una nueva expedición* en busca de una mazmorra desconocida, donde aguardan criaturas peligrosas, tesoros legendarios y nuevos desafíos.\n\n🔎 *Estado:* Exploración en curso...\n⏳ *Tiempo estimado:* 2 horas.\n🔒 *Acceso:* Temporalmente bloqueado.\n\n⚔️ _¡Descansa, recupera tus fuerzas y prepara tu equipo! Una nueva aventura está por comenzar..._')
    return
  }

  const mineCooldownState = getMineState(sender)
  if (MINE_LIMITED_COMMANDS.has(command) && (command === 'mazmorra' || mineCooldownState.active)) {
    const usage = consumeMineCommandUse(sender)
    if (!usage.allowed) {
      const minutes = Math.max(1, Math.ceil(usage.remainingMs / 60000))
      await reply(sock, chat, message, `😴 *Tu personaje se cansó de tanto explorar.*\n\nHa recorrido demasiado por ahora. Déjalo descansar *${minutes} minuto${minutes === 1 ? '' : 's'}* antes de volver a la mazmorra. 🛌` )
      return
    }
  }

  if (command === 'donar' && !DONATION_PAYPAL_URL) return
  if (command === 'donar') {
    const amount = parseDonationAmount(commandContent)
    if (!amount) {
      await reply(sock, chat, message, 'Uso: *' + PREFIX + 'donar <cantidad> dolar*\nEjemplo: *' + PREFIX + 'donar 5 dolares*\n\nCantidad permitida: $' + DONATION_MIN_USD + ' a $' + DONATION_MAX_USD + ' USD.')
      return
    }
    const donationRecipientCandidates = [message.key.participantAlt, message.participantAlt, message.key.participant, message.participant, sender]
      .filter(Boolean)
      .map(jid => jidNormalizedUser(jid))
    const userKey = donationRecipientCandidates.find(jid => jid.endsWith('@s.whatsapp.net')) || donationRecipientCandidates[0]
    if (!userKey) {
      await reply(sock, chat, message, '🔒 No pude identificar tu chat privado. Escríbele primero al bot y usa *' + PREFIX + 'donar ' + amount + ' dolares*.')
      return
    }
    runtimeState.pendingDonations[userKey] = { amount, createdAt: Date.now() }
    queueStateSave()
    try {
      await sock.sendMessage(userKey, { text: donationConfirmationText(amount) })
      try { await sock.sendMessage(chat, { delete: message.key }) } catch (error) { logger.warn({ err: error }, 'No se pudo eliminar el comando de donación del grupo') }
    } catch (error) {
      delete runtimeState.pendingDonations[userKey]
      queueStateSave()
      logger.warn({ err: error, recipient: userKey }, 'No se pudo enviar la confirmación privada de donación')
      await reply(sock, chat, message, '🔒 No pude enviarte el mensaje privado. Abre un chat con el bot, envía *hola* y después usa *' + PREFIX + 'donar ' + amount + ' dolares* directamente allí.')
    }
    return
  }

  // ----- Ayuda / menu de comandos -----
  if (command === 'comandos' || command === 'cmds' || command === 'ayuda' || command === 'help') {
    const requesterIsAdmin = isOwner(sender) || isAdmin(findParticipant(metadata, sender))
    const sections = buildCommandSections({ includeAdmin: requesterIsAdmin })
    const categoryQuery = commandContent.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const matchedSections = categoryQuery ? sections.filter(section => section.title.toLowerCase().startsWith(categoryQuery)) : []
    const menuText = buildCommandsFullText(matchedSections.length ? matchedSections : sections)
    await reply(sock, chat, message, menuText)
    return
  }

  // ----- Sugerencias -----
  if (command === 'sugerencia') {
    const parenthesized = commandContent.match(/^\s*\(([^)]+)\)\s*\(([\s\S]+)\)\s*$/)
    const plain = commandContent.match(/^\s*(\S+)\s+([\s\S]+)$/)
    const name = (parenthesized?.[1] || plain?.[1] || '').trim()
    const suggestion = (parenthesized?.[2] || plain?.[2] || '').trim()
    if (!name || !suggestion) {
      await reply(sock, chat, message, `Uso: *${PREFIX}sugerencia (nombre) (sugerencia)*\nEjemplo: *${PREFIX}sugerencia (Jocelyn) (Hacer una noche de juegos)*`)
      return
    }
    if (name.length > 50 || suggestion.length > 500) {
      await reply(sock, chat, message, '⚠️ El nombre puede tener hasta 50 caracteres y la sugerencia hasta 500.')
      return
    }
    const groupSuggestions = runtimeState.suggestions[chat] ||= []
    groupSuggestions.push({ name, suggestion, author: jidNormalizedUser(sender), createdAt: new Date().toISOString() })
    if (groupSuggestions.length > 200) groupSuggestions.splice(0, groupSuggestions.length - 200)
    queueStateSave()
    await reply(sock, chat, message, `💡 *SUGERENCIA GUARDADA*\n\n👤 *Nombre:* ${name}\n📝 *Sugerencia:* ${suggestion}\n🔢 *Número:* ${groupSuggestions.length}`)
    return
  }

  if (command === 'sugerencias') {
    const groupSuggestions = runtimeState.suggestions[chat] || []
    if (!groupSuggestions.length) {
      await reply(sock, chat, message, '📭 Todavía no hay sugerencias guardadas en este grupo.')
      return
    }
    const visible = groupSuggestions.slice(-30)
    const list = visible.map((item, index) => {
      const number = groupSuggestions.length - visible.length + index + 1
      return `${number}. *${item.name}*\n   ${item.suggestion}`
    }).join('\n\n')
    const omitted = groupSuggestions.length - visible.length
    await reply(sock, chat, message, `💡 *SUGERENCIAS DEL GRUPO*\n\n${list}${omitted ? `\n\n_Se ocultaron ${omitted} sugerencias anteriores._` : ''}\n\n🔢 *Total:* ${groupSuggestions.length}`)
    return
  }

  // ----- Musica -----
  if (['musica', 'play', 'music', 'generos'].includes(command)) {
    if (MUSIC_MAINTENANCE_MODE) {
      await reply(sock, chat, message, MUSIC_MAINTENANCE_MESSAGE)
      return
    }
    await musicCommand.handle({
      command, query: commandContent, prefix: PREFIX, group: chat, actor: jidNormalizedUser(sender || ''),
      authorize: () => requireOperator(sock, chat, message, sender),
      reply: text => reply(sock, chat, message, text),
      sendAudio: (audio, metadata) => sock.sendMessage(chat, { audio, ...metadata }, { quoted: message })
    })
    return
  }

  // ----- IA / preguntas -----
  if (command === 'ia' || command === 'pregunta') {
    const actor = accountId(message.key.participantAlt) || accountId(sender) || 'unknown'
    const cooldownKey = `${chat}:${actor}`
    const now = Date.now()
    const memory = questionMemory.get(cooldownKey)
    const rawQuestion = commandContent.trim().slice(0, 1000)
    if (!rawQuestion) {
      await reply(sock, chat, message, `🤖 Escribe tu pregunta después del comando.\nEjemplo: *${PREFIX}ia explícame cómo funciona la energía solar*`)
      return
    }
    const followUpOnly = /^(?:(?:explicame|explícame|explica)(?:lo|me)?\s*(?:mejor|mas|más)?\s*)?(?:este tema|eso|esto|lo anterior|por que|por qué|y eso|dame mas|dame más|continua|continúa)[¿?!. ]*$/i.test(rawQuestion)
    const releaseQuestion = limitQuestion(actor)
    if (!releaseQuestion) {
      await reply(sock, chat, message, '⏳ Espera unos segundos antes de hacer otra consulta.')
      return
    }
    try {
    const effectiveQuestion = followUpOnly && memory?.expiresAt > now
      ? `${rawQuestion || 'Continúa'} sobre ${memory.topic}`.slice(0, 1000)
      : rawQuestion
    if (effectiveQuestion) {
      const rememberedQuestion = { topic: effectiveQuestion, expiresAt: now + QUESTION_TTL }
      if (!questionMemory.has(cooldownKey) && questionMemory.size >= 300) questionMemory.delete(questionMemory.keys().next().value)
      questionMemory.set(cooldownKey, rememberedQuestion)
    }
    try {
      const modelAnswer = await askReasoningModel(effectiveQuestion, cooldownKey)
      if (modelAnswer) {
        await reply(sock, chat, message, `🤖 *Nuruxion AI*\n\n${modelAnswer}`)
        return
      }
    } catch (error) {
      logger.warn({ err: error }, 'Falló Nuruxion AI local; se usará el conocimiento local')
    }
    const localAnswer = answerCommonQuestion(effectiveQuestion)
    if (localAnswer) {
      await reply(sock, chat, message, localAnswer)
      return
    }
    if (isYesNoQuestion(normalizedText(effectiveQuestion))) {
      const yesNoContext = contextInfo(content)
      const yesNoTargetJid = yesNoContext.mentionedJid?.[0] || yesNoContext.participant
      const yesNoTargetTag = yesNoTargetJid ? targetTag(yesNoTargetJid) : null
      const yesNoMentions = yesNoTargetJid ? [jidNormalizedUser(yesNoTargetJid)] : []
      const personalAnswer = answerYesNoQuestion(effectiveQuestion, yesNoTargetTag)
      if (personalAnswer) {
        await reply(sock, chat, message, personalAnswer, yesNoMentions)
        return
      }
    }
    const comparison = detectComparison(effectiveQuestion)
    if (comparison) {
      try {
        const comparisonAnswer = await answerComparisonQuestion(comparison[0], comparison[1])
        await reply(sock, chat, message, comparisonAnswer)
      } catch (error) {
        logger.warn({ err: error }, 'Falló la comparación de conocimiento general')
        await reply(sock, chat, message, '⚠️ No pude comparar esos dos temas en este momento. Inténtalo nuevamente más tarde.')
      }
      return
    }
    try {
      const researched = await searchGeneralKnowledge(effectiveQuestion)
      if (researched) {
        const learnedTopic = { topic: researched.topic, expiresAt: now + QUESTION_TTL }
        questionMemory.set(cooldownKey, learnedTopic)
      }
      await reply(sock, chat, message, researched?.text || '🤖 No encontré una respuesta confiable. Intenta formular la pregunta con palabras más específicas.')
    } catch (error) {
      logger.warn({ err: error }, 'Falló la consulta de conocimiento general')
      await reply(sock, chat, message, '⚠️ No pude consultar la fuente de conocimiento en este momento. Inténtalo nuevamente más tarde.')
    }
    } finally { releaseQuestion() }
    return
  }

  // ----- Interaccion: beso y golpe -----
  if (command === 'kiss' || command === 'beso') {
    const context = contextInfo(content)
    const target = context.mentionedJid?.[0] || context.participant
    if (!target) {
      await reply(sock, chat, message, `Uso: menciona a alguien o responde su mensaje con *${PREFIX}kiss*.`)
      return
    }
    const senderJid = jidNormalizedUser(sender || '')
    if (sameUser(target, senderJid)) {
      await reply(sock, chat, message, '😳 No puedes darte un beso a ti mismo.')
      return
    }
    const targetKeyForMarriage = jidNormalizedUser(target)
    const senderSpouse = spouseOf(senderJid)
    if (senderSpouse && !sameUser(senderSpouse, targetKeyForMarriage)) {
      await reply(sock, chat, message, `💍 Estás casado/a, solo puedes besar a tu pareja (@${senderSpouse.split('@')[0].split(':')[0]}).`, [senderSpouse])
      return
    }
    const targetSpouse = spouseOf(targetKeyForMarriage)
    if (targetSpouse && !sameUser(targetSpouse, senderJid)) {
      await reply(sock, chat, message, `💍 @${targetKeyForMarriage.split('@')[0].split(':')[0]} está casado/a y solo puede recibir besos de su pareja.`, [targetKeyForMarriage])
      return
    }
    const cooldownKey = `${chat}:${senderJid}`
    const now = Date.now()
    if ((kissCooldowns.get(cooldownKey) || 0) > now) {
      await reply(sock, chat, message, '⏳ Espera unos segundos antes de mandar otro beso.')
      return
    }
    kissCooldowns.set(cooldownKey, now + 5000)
    const senderTag = `@${senderJid.split('@')[0].split(':')[0]}`
    const targetTag = `@${jidNormalizedUser(target).split('@')[0].split(':')[0]}`
    const caption = `💋 ${senderTag} le da un beso a ${targetTag}`
    const gifUrl = await fetchKissGifUrl()
    if (gifUrl) {
      try {
        const gifResponse = await fetch(gifUrl, { headers: GIF_API_HEADERS, signal: AbortSignal.timeout(15000) })
        if (!gifResponse.ok) throw new Error(`descarga del gif respondió ${gifResponse.status}`)
        const gifBuffer = Buffer.from(await gifResponse.arrayBuffer())
        const videoBuffer = await convertGifToVideo(gifBuffer)
        await sock.sendMessage(chat, { video: videoBuffer, caption, mentions: [sender, target] }, { quoted: message })
        return
      } catch (error) {
        logger.warn({ err: error }, 'No se pudo preparar el video de beso (descarga o conversión), se enviará solo texto')
      }
    }
    await reply(sock, chat, message, caption, [sender, target])
    return
  }

  if (command === 'punch') {
    const context = contextInfo(content)
    const target = context.mentionedJid?.[0] || context.participant
    if (!target) {
      await reply(sock, chat, message, `Uso: menciona a alguien o responde su mensaje con *${PREFIX}punch*.`)
      return
    }
    const senderJid = jidNormalizedUser(sender || '')
    const targetJid = jidNormalizedUser(target)
    if (sameUser(targetJid, senderJid)) {
      await reply(sock, chat, message, '😅 No puedes golpearte a ti mismo.')
      return
    }
    const cooldownKey = `${chat}:${senderJid}`
    const now = Date.now()
    if ((punchCooldowns.get(cooldownKey) || 0) > now) {
      await reply(sock, chat, message, '⏳ Espera unos segundos antes de dar otro golpe.')
      return
    }
    punchCooldowns.set(cooldownKey, now + 5000)
    punchPending.set(`${chat}:${targetJid}`, { puncher: senderJid, expiresAt: now + PUNCH_RETURN_TTL_MS })
    const senderTagText = targetTag(senderJid)
    const targetTagText = targetTag(targetJid)
    const caption = `👊 ${senderTagText} le dio un golpe a ${targetTagText}\n\n${targetTagText}, responde con *${PREFIX}devolvergolpe* si quieres devolverlo.`
    await sendPunchGifMessage(sock, chat, message, caption, [senderJid, targetJid])
    return
  }

  if (command === 'devolvergolpe' || command === 'devolverpunch') {
    const senderJid = jidNormalizedUser(sender || '')
    const pendingKey = `${chat}:${senderJid}`
    const pending = punchPending.get(pendingKey)
    const now = Date.now()
    if (!pending || pending.expiresAt <= now) {
      punchPending.delete(pendingKey)
      await reply(sock, chat, message, '📭 No tienes ningún golpe pendiente para devolver.')
      return
    }
    punchPending.delete(pendingKey)
    const cooldownKey = `${chat}:${senderJid}`
    punchCooldowns.set(cooldownKey, now + 5000)
    const senderTagText = targetTag(senderJid)
    const attackerTagText = targetTag(pending.puncher)
    const caption = `👊💥 ${senderTagText} le devolvió el golpe a ${attackerTagText}`
    await sendPunchGifMessage(sock, chat, message, caption, [senderJid, pending.puncher])
    return
  }

  // ----- Matrimonio -----
  if (command === 'marry' || command === 'casar') {
    const senderJid = jidNormalizedUser(sender || '')
    if (commandContent.trim().toLowerCase() === 'prueba') {
      if (!(await requireAdmin(sock, chat, message, sender, metadata))) return
      const giftDescriptions = previewWeddingGifts()
      const caption = `🧪 *VISTA PREVIA DE BODA* 🧪\n\n${targetTag(senderJid)} 💞 ${targetTag(senderJid)}\n\n🎁 *Ejemplo de regalos de bodas:*\n${giftDescriptions.map(item => `• ${item}`).join('\n')}\n\n_Esto es solo una prueba: no se registró ningún matrimonio ni se entregó ningún regalo real._`
      const gifUrl = await fetchWeddingGifUrl()
      if (gifUrl) {
        try {
          const gifResponse = await fetch(gifUrl, { headers: GIF_API_HEADERS, signal: AbortSignal.timeout(15000) })
          if (!gifResponse.ok) throw new Error(`descarga del gif respondió ${gifResponse.status}`)
          const gifBuffer = Buffer.from(await gifResponse.arrayBuffer())
          const videoBuffer = await convertGifToVideo(gifBuffer)
          await sock.sendMessage(chat, { video: videoBuffer, caption, mentions: [senderJid] }, { quoted: message })
          return
        } catch (error) {
          logger.warn({ err: error }, 'No se pudo preparar el video de prueba de boda, se enviará solo texto')
        }
      }
      await reply(sock, chat, message, caption, [senderJid])
      return
    }
    const context = contextInfo(content)
    const targetRaw = context.mentionedJid?.[0] || context.participant
    if (!targetRaw) {
      await reply(sock, chat, message, `Uso: menciona a alguien o responde su mensaje con *${PREFIX}marry @usuario*.`)
      return
    }
    const targetJid = jidNormalizedUser(targetRaw)
    if (sameUser(targetJid, senderJid)) {
      await reply(sock, chat, message, '😅 No puedes casarte contigo mismo.')
      return
    }
    if (sameUser(targetJid, sock.user?.id)) {
      await reply(sock, chat, message, '🤖 No puedo casarme, pero gracias por pensar en mí.')
      return
    }
    const targetParticipant = findParticipant(metadata, targetJid)
    if (!targetParticipant) {
      await reply(sock, chat, message, '⚠️ Esa persona no aparece como participante del grupo.')
      return
    }
    if (isMarried(senderJid)) {
      await reply(sock, chat, message, `💍 Ya estás casado/a con ${targetTag(spouseOf(senderJid))}.`, [spouseOf(senderJid)])
      return
    }
    if (isMarried(targetJid)) {
      await reply(sock, chat, message, `💍 ${targetTag(targetJid)} ya está casado/a con otra persona.`, [targetJid])
      return
    }
    const now = Date.now()
    const proposalKey = `${chat}:${targetJid}`
    if (await communityPromoter.hasPendingFor(sock, chat, targetJid)) {
      await reply(sock, chat, message, '⏳ Esa persona tiene una promoción de administrador pendiente. Espera a que la acepte, rechace o caduque antes de proponer matrimonio.')
      return
    }
    const pending = marriageProposals.get(proposalKey)
    if (pending && pending.expiresAt > now) {
      await reply(sock, chat, message, '⏳ Esa persona ya tiene una propuesta de matrimonio pendiente.')
      return
    }
    marriageProposals.set(proposalKey, { proposer: senderJid, expiresAt: now + MARRIAGE_PROPOSAL_TTL_MS })
    await reply(sock, chat, message, `💍 *PROPUESTA DE MATRIMONIO*\n\n${targetTag(senderJid)} le propone matrimonio a ${targetTag(targetJid)} 💕\n\n${targetTag(targetJid)}, responde con *${PREFIX}aceptar* o *${PREFIX}rechazar* en los próximos 5 minutos.`, [senderJid, targetJid])
    return
  }

  if (command === 'aceptar' || command === 'rechazar') {
    try {
      const marriage = marriageProposals.get(`${chat}:${jidNormalizedUser(sender || '')}`)
      const pendingPromotion = await communityPromoter.hasPendingFor(sock, chat, sender)
      if (pendingPromotion && command === 'aceptar' && marriage?.expiresAt > Date.now()) {
        await reply(sock, chat, message, `Hay una propuesta de pareja y una promoción pendientes. Usa *${PREFIX}rechazar* para cancelar primero la promoción; después resuelve la propuesta. No se cambió ningún permiso.`)
        return
      }
      if (pendingPromotion && commandContent.trim()) {
        await reply(sock, chat, message, `Responde únicamente *${PREFIX}aceptar* o *${PREFIX}rechazar*, sin texto adicional.`)
        return
      }
      const promotion = await communityPromoter.respond(sock, { chat, actor: sender, accept: command === 'aceptar' })
      if (promotion.handled) {
        saveCommunityPromotionAudit(promotion)
        await reply(sock, chat, message, promotion.text, promotion.mentions)
        return
      }
      const quoted = messageText(unwrapMessage(contextInfo(content).quotedMessage || {}))
      if (/ADMINUSER\s*[·|:—-]\s*(NURUXION|COMUNIDAD)|¿Confirmas hacer admin/.test(quoted)) {
        await reply(sock, chat, message, `No encontré una promoción pendiente para tu cuenta en este grupo. Puede haber caducado o haberse reiniciado el bot. Iníciala de nuevo con *${PREFIX}adminuser @persona*; después responde *${PREFIX}aceptar*. No se cambió ningún permiso.`)
        return
      }
    } catch (error) {
      logger.warn({ err: error }, 'No se pudo responder la promoción de comunidad')
      await reply(sock, chat, message, '⚠️ ' + (error.message || 'No se pudo comprobar la promoción.'))
      return
    }
    const senderJid = jidNormalizedUser(sender || '')
    const proposalKey = `${chat}:${senderJid}`
    const pending = marriageProposals.get(proposalKey)
    const now = Date.now()
    if (!pending || pending.expiresAt <= now) {
      marriageProposals.delete(proposalKey)
      await reply(sock, chat, message, `📭 No tienes una solicitud pendiente para aceptar o rechazar. Si era una promoción de administrador, iníciala de nuevo con *${PREFIX}adminuser @persona*.`)
      return
    }
    marriageProposals.delete(proposalKey)
    if (command === 'rechazar') {
      await reply(sock, chat, message, `💔 ${targetTag(senderJid)} rechazó la propuesta de ${targetTag(pending.proposer)}.`, [senderJid, pending.proposer])
      return
    }
    if (isMarried(senderJid) || isMarried(pending.proposer)) {
      await reply(sock, chat, message, '⚠️ Alguno de los dos ya está casado. La propuesta ya no es válida.')
      return
    }
    const since = now
    runtimeState.marriages[senderJid] = { spouse: pending.proposer, since }
    runtimeState.marriages[pending.proposer] = { spouse: senderJid, since }
    queueStateSave()
    const giftDescriptions = applyWeddingGifts(senderJid, pending.proposer)
    queueEconomySave()
    const caption = `💒 *¡BODA CELEBRADA!* 💒\n\n${targetTag(pending.proposer)} 💞 ${targetTag(senderJid)}\n\n🎁 *Regalos de bodas:*\n${giftDescriptions.map(item => `• ${item}`).join('\n')}`
    const gifUrl = await fetchWeddingGifUrl()
    if (gifUrl) {
      try {
        const gifResponse = await fetch(gifUrl, { headers: GIF_API_HEADERS, signal: AbortSignal.timeout(15000) })
        if (!gifResponse.ok) throw new Error(`descarga del gif respondió ${gifResponse.status}`)
        const gifBuffer = Buffer.from(await gifResponse.arrayBuffer())
        const videoBuffer = await convertGifToVideo(gifBuffer)
        await sock.sendMessage(chat, { video: videoBuffer, caption, mentions: [senderJid, pending.proposer] }, { quoted: message })
        return
      } catch (error) {
        logger.warn({ err: error }, 'No se pudo preparar el video de boda, se enviará solo texto')
      }
    }
    await reply(sock, chat, message, caption, [senderJid, pending.proposer])
    return
  }

  if (command === 'cancelmarry' || command === 'cancelarmarry' || command === 'cancelarboda') {
    const senderJid = jidNormalizedUser(sender || '')
    let foundKey = null
    let foundTarget = null
    const now = Date.now()
    for (const [key, value] of marriageProposals.entries()) {
      if (key.startsWith(`${chat}:`) && sameUser(value.proposer, senderJid) && value.expiresAt > now) {
        foundKey = key
        foundTarget = key.slice(chat.length + 1)
        break
      }
    }
    if (!foundKey) {
      await reply(sock, chat, message, '📭 No tienes ninguna propuesta de matrimonio pendiente para cancelar.')
      return
    }
    marriageProposals.delete(foundKey)
    await reply(sock, chat, message, `🚫 Cancelaste tu propuesta de matrimonio a ${targetTag(foundTarget)}.`, [senderJid, foundTarget])
    return
  }

  if (command === 'divorcio' || command === 'divorciar') {
    const senderJid = jidNormalizedUser(sender || '')
    const spouse = spouseOf(senderJid)
    if (!spouse) {
      await reply(sock, chat, message, '💔 No estás casado/a con nadie.')
      return
    }
    delete runtimeState.marriages[senderJid]
    delete runtimeState.marriages[spouse]
    queueStateSave()
    await reply(sock, chat, message, `💔 ${targetTag(senderJid)} y ${targetTag(spouse)} se divorciaron.`, [senderJid, spouse])
    return
  }

  if (Date.now() < ECONOMY_LAUNCH_AT && ECONOMY_COMMANDS.has(command)) {
    const warnKey = jidNormalizedUser(sender)
    if (!economyState.betaWarningShown[warnKey]) {
      economyState.betaWarningShown[warnKey] = true
      queueEconomySave()
      await reply(sock, chat, message, getEconomyBetaMessage())
    }
  }

  // ----- Economia: saldo y perfil -----
  if (command === 'saldo' || command === 'balance' || command === 'bal') {
    const senderJid = jidNormalizedUser(sender || '')
    collectFortuneIncome(senderJid)
    const account = getAccount(senderJid)
    const companies = economyState.companies[chat]?.list || []
    const invested = companies.reduce((sum, company) => sum + (company.shares[senderJid] || 0) * company.price, 0)
    await reply(sock, chat, message, `💰 *Tu cuenta*\n\nMonedero: ${formatCurrency(account.wallet)}\nBanco: ${formatCurrency(account.bank)}${invested > 0 ? `\nInvertido en empresas: ${formatCurrency(invested)}` : ''}`)
    return
  }

  if (command === 'perfil' || command === 'profile') {
    const senderJid = jidNormalizedUser(sender || '')
    const perfilContext = contextInfo(content)
    const mentionedTarget = perfilContext.mentionedJid?.[0] || perfilContext.participant
    const targetJid = mentionedTarget ? jidNormalizedUser(mentionedTarget) : senderJid
    collectFortuneIncome(targetJid)
    const account = getAccount(targetJid)
    const companies = economyState.companies[chat]?.list || []
    const invested = companies.reduce((sum, company) => sum + (company.shares[targetJid] || 0) * company.price, 0)
    const total = account.wallet + account.bank + invested
    const inventory = getInventory(targetJid)
    const now = Date.now()
    const badges = inventory.owned.map(id => findShopItem(id)).filter(Boolean)
    let avatarDataUri = null
    try {
      const picUrl = await sock.profilePictureUrl(targetJid, 'image')
      if (picUrl) {
        const picResponse = await fetch(picUrl, { signal: AbortSignal.timeout(6000) })
        if (picResponse.ok) {
          const picBuffer = Buffer.from(await picResponse.arrayBuffer())
          avatarDataUri = `data:image/jpeg;base64,${picBuffer.toString('base64')}`
        }
      }
    } catch {}
    const participant = findParticipant(metadata, targetJid)
    const role = isOwner(targetJid) ? 'Owner' : isAdmin(participant) ? 'Administrador' : 'Miembro'
    const firstSeen = economyState.firstSeenAt[targetJid] || now
    const daysActive = Math.max(0, Math.floor((now - firstSeen) / 86400000))
    const messageCount = economyState.messageCounts[targetJid] || 0
    const streakInfo = economyState.dailyStreaks[targetJid]
    const streak = streakInfo && (now - streakInfo.lastClaimedAt <= DAILY_COOLDOWN_MS * 2) ? streakInfo.count : 0
    const warningsCount = (runtimeState.warnings[chat]?.[targetJid] || []).length
    const realJoinedAt = economyState.groupJoinedAt[targetJid]
    const joinedDateLabel = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City' }).format(new Date(realJoinedAt || firstSeen))
    const xp = economyState.xp[targetJid] || 0
    const level = levelFromXp(xp)
    const levelTier = levelTierForLevel(level)
    const spouseJid = spouseOf(targetJid)
    const displayName = mentionedTarget ? targetTag(targetJid) : (message.pushName || targetTag(targetJid))
    const svg = buildProfileCardSvg({
      name: displayName,
      wallet: account.wallet,
      bank: account.bank,
      total,
      badges,
      avatarDataUri,
      role,
      pseudoId: pseudoId(targetJid),
      daysActive,
      messageCount,
      streak,
      warnings: warningsCount,
      joinedDateLabel,
      xp,
      level,
      levelTier,
      customQuote: economyState.customQuotes[targetJid] || null
    })
    try {
      const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
      const relationshipLine = spouseJid
        ? `\n💍 Pareja: ${targetTag(spouseJid)}`
        : '\n💍 Estado: Soltero/a'
      await sock.sendMessage(chat, { image: pngBuffer, caption: `🪪 *PERFIL DE ${targetTag(targetJid)}*${relationshipLine}
🔥 Racha diaria: ${streak} · 💬 Mensajes: ${formatCompact(messageCount)}${expansionProfileText(targetJid, chat)}${halloweenProfileText(targetJid)}${journeyView(economyState, targetJid, targetJid === senderJid)}`, mentions: spouseJid ? [targetJid, spouseJid] : [targetJid] }, { quoted: message })
    } catch (error) {
      logger.warn({ err: error }, 'Falló generar la tarjeta de perfil')
      await reply(sock, chat, message, '⚠️ No pude generar tu tarjeta de perfil en este momento. Inténtalo de nuevo.')
    }
    return
  }

  if (command === 'changetext' || command === 'frase') {
    const senderJid = jidNormalizedUser(sender || '')
    const text = commandContent.trim()
    if (!text) {
      const current = economyState.customQuotes[senderJid]
      await reply(sock, chat, message, `Uso: *${PREFIX}changetext tu frase aqui* (maximo ${PROFILE_TEXT_MAX} caracteres).\n${current ? `Frase actual: "${current}"` : 'No tienes una frase personalizada, se muestra una aleatoria.'}\nEscribe *${PREFIX}changetext borrar* para quitarla.`)
      return
    }
    if (text.toLowerCase() === 'borrar' || text.toLowerCase() === 'reset') {
      delete economyState.customQuotes[senderJid]
      queueEconomySave()
      await reply(sock, chat, message, '✅ Se quito tu frase personalizada. Ahora se mostrara una aleatoria en tu perfil.')
      return
    }
    if (text.length > PROFILE_TEXT_MAX) {
      await reply(sock, chat, message, `⚠️ Esa frase es muy larga (${text.length}/${PROFILE_TEXT_MAX}). Acortala e intenta de nuevo.`)
      return
    }
    economyState.customQuotes[senderJid] = text
    queueEconomySave()
    await reply(sock, chat, message, `✅ Frase actualizada. Se mostrara en tu *${PREFIX}perfil*:\n"${text}"`)
    return
  }

  if (command === 'dep' || command === 'deposito') {
    const senderJid = jidNormalizedUser(sender || '')
    const account = getAccount(senderJid)
    const amount = parseAmount(commandContent, account.wallet)
    if (!amount || amount > account.wallet) {
      await reply(sock, chat, message, `Uso: *${PREFIX}dep all* o *${PREFIX}dep <cantidad>*. Tienes ${formatCurrency(account.wallet)} en el monedero.`)
      return
    }
    account.wallet -= amount
    account.bank += amount
    queueEconomySave()
    await reply(sock, chat, message, `🏦 Depositaste ${formatCurrency(amount)}.\nMonedero: ${formatCurrency(account.wallet)}\nBanco: ${formatCurrency(account.bank)}`)
    return
  }

  if (command === 'retirar' || command === 'withdraw') {
    const senderJid = jidNormalizedUser(sender || '')
    const account = getAccount(senderJid)
    const amount = parseAmount(commandContent, account.bank)
    if (!amount || amount > account.bank) {
      await reply(sock, chat, message, `Uso: *${PREFIX}retirar all* o *${PREFIX}retirar <cantidad>*. Tienes ${formatCurrency(account.bank)} en el banco.`)
      return
    }
    account.bank -= amount
    account.wallet += amount
    queueEconomySave()
    await reply(sock, chat, message, `🏧 Retiraste ${formatCurrency(amount)}.\nMonedero: ${formatCurrency(account.wallet)}\nBanco: ${formatCurrency(account.bank)}`)
    return
  }

  // ----- Economia: prestamos y carcel -----
  if (command === 'prestamo') {
    const senderJid = jidNormalizedUser(sender || '')
    checkLoan(senderJid)
    const account = getAccount(senderJid)
    if (account.jailedUntil > Date.now()) {
      await reply(sock, chat, message, `🚔 Estás en la cárcel: tu deuda de ${formatCurrency(account.lastJailDebt || 0)} fue cancelada. Sales en ${formatCountdown(account.jailedUntil)}.
💰 Usa *${PREFIX}fianza* para salir antes (cuesta el triple de esa deuda).`)
      return
    }
    if (economyState.loans[senderJid]) {
      await reply(sock, chat, message, `Ya tienes un préstamo activo de ${formatCurrency(economyState.loans[senderJid].owed)}. Usa *${PREFIX}pagar* para saldarlo antes de pedir otro.`)
      return
    }
    const amount = Math.floor(Number(commandContent.trim()))
    if (!amount || amount <= 0 || amount > LOAN_MAX_AMOUNT || !Number.isFinite(amount)) {
      await reply(sock, chat, message, `Uso: *${PREFIX}prestamo <monto>*. Monto máximo: ${formatCurrency(LOAN_MAX_AMOUNT)}.`)
      return
    }
    const payDays = computeLoanPayDays(amount)
    const now = Date.now()
    const dueAt = now + payDays * 24 * 60 * 60 * 1000
    economyState.loans[senderJid] = { principal: amount, owed: amount, dueAt, createdAt: now }
    account.wallet += amount
    queueEconomySave()
    await reply(sock, chat, message, `💰 Préstamo aprobado: ${formatCurrency(amount)}.\n📅 Días de tolerancia para pagar: ${payDays} días (calculados según el monto, hasta un máximo de ${LOAN_MAX_PAY_DAYS}).\n📈 El interés del ${Math.round(LOAN_INTEREST_RATE * 100)}% diario corre desde ahora, no solo si te atrasas.\n⚠️ Si no pagas antes de la fecha límite, tienes ${LOAN_TOLERANCE_DAYS} días extra de gracia antes de ir a la cárcel.\nUsa *${PREFIX}pagar* para saldar tu deuda o *${PREFIX}deuda* para ver cuánto debes.`)
    return
  }

  if (command === 'pagar') {
    const senderJid = jidNormalizedUser(sender || '')
    const loan = checkLoan(senderJid)
    const account = getAccount(senderJid)
    if (account.jailedUntil > Date.now()) {
      await reply(sock, chat, message, `🚔 Estás en la cárcel, no puedes pagar el préstamo así. Usa *${PREFIX}fianza* para salir (cuesta el triple de la deuda que tenías, pero te libera de ella por completo).`)
      return
    }
    if (!loan) {
      await reply(sock, chat, message, 'No tienes ningún préstamo activo.')
      return
    }
    if (account.wallet < loan.owed) {
      await reply(sock, chat, message, `Debes ${formatCurrency(loan.owed)} pero solo tienes ${formatCurrency(account.wallet)} en tu monedero.`)
      return
    }
    account.wallet -= loan.owed
    delete economyState.loans[senderJid]
    queueEconomySave()
    await reply(sock, chat, message, `✅ Pagaste tu préstamo de ${formatCurrency(loan.owed)}. Quedas libre de deuda.`)
    return
  }

  if (command === 'fianza') {
    const senderJid = jidNormalizedUser(sender || '')
    const account = getAccount(senderJid)
    const now = Date.now()
    if (!(account.jailedUntil > now)) {
      await reply(sock, chat, message, 'ℹ️ No estás en la cárcel.')
      return
    }
    const loan = economyState.loans[senderJid]
    const debtForBail = loan ? loan.owed : (account.lastJailDebt || 0)
    const bailCost = Math.round(debtForBail * LOAN_BAIL_MULTIPLIER)
    if (bailCost > 0 && account.wallet < bailCost) {
      await reply(sock, chat, message, `💰 La fianza cuesta ${formatCurrency(bailCost)} (el triple de la deuda que te metió a la cárcel), pero solo tienes ${formatCurrency(account.wallet)} en tu monedero.`)
      return
    }
    account.wallet -= bailCost
    delete economyState.loans[senderJid]
    account.jailedUntil = 0
    queueEconomySave()
    await reply(sock, chat, message, `🔓 Pagaste una fianza de ${formatCurrency(bailCost)} y saliste de la cárcel, sin deuda pendiente.`)
    return
  }

  if (command === 'excarcelar') {
    if (!isJailReleaseAuthorized(message, sender)) {
      await reply(sock, chat, message, '⛔ Este comando es exclusivo para un número autorizado.')
      return
    }
    const context = contextInfo(content)
    const targetRaw = context.mentionedJid?.[0] || context.participant
    if (!targetRaw) {
      await reply(sock, chat, message, `Uso: menciona a alguien o responde su mensaje con *${PREFIX}excarcelar @usuario*.`)
      return
    }
    const targetJid = jidNormalizedUser(targetRaw)
    const account = getAccount(targetJid)
    if (!(account.jailedUntil > Date.now())) {
      await reply(sock, chat, message, `ℹ️ ${targetTag(targetJid)} no está en la cárcel.`, [targetJid])
      return
    }
    account.jailedUntil = 0
    queueEconomySave()
    await reply(sock, chat, message, `🔓 ${targetTag(targetJid)} fue liberado de la cárcel.`, [targetJid])
    return
  }

  if (command === 'deuda') {
    const senderJid = jidNormalizedUser(sender || '')
    const loan = checkLoan(senderJid)
    const jailAccount = getAccount(senderJid)
    if (jailAccount.jailedUntil > Date.now()) {
      await reply(sock, chat, message, `🚔 Estás en la cárcel: tu deuda de ${formatCurrency(jailAccount.lastJailDebt || 0)} fue cancelada. Sales en ${formatCountdown(jailAccount.jailedUntil)}, o usa *${PREFIX}fianza* para salir antes.`)
      return
    }
    if (!loan) {
      await reply(sock, chat, message, 'No tienes ningún préstamo activo.')
      return
    }
    const now = Date.now()
    const overdue = now > loan.dueAt
    const diff = overdue ? now - loan.dueAt : loan.dueAt - now
    const diffDays = Math.floor(diff / 86400000)
    const diffHours = Math.floor((diff % 86400000) / 3600000)
    const diffMinutes = Math.floor((diff % 3600000) / 60000)
    const dueLine = overdue
      ? `venció hace ${diffDays}d ${diffHours}h ${diffMinutes}m`
      : `en ${diffDays}d ${diffHours}h ${diffMinutes}m`
    await reply(sock, chat, message, `📋 *Préstamo activo*\n💵 Debes: ${formatCurrency(loan.owed)}\n📅 Vencimiento: ${dueLine}\n📈 El interés del ${Math.round(LOAN_INTEREST_RATE * 100)}% diario corre desde que pediste el préstamo, estés o no en mora.${overdue ? '\n⚠️ Estás en mora.' : ''}`)
    return
  }

  // ----- Economia: robos, trabajo y blackjack -----
  if (command === 'rob') {
    const senderJid = jidNormalizedUser(sender || '')
    checkLoan(senderJid)
    const jailedRobAccount = getAccount(senderJid)
    if (jailedRobAccount.jailedUntil > Date.now()) {
      await reply(sock, chat, message, `🚔 Estás en la cárcel: tu deuda de ${formatCurrency(jailedRobAccount.lastJailDebt || 0)} fue cancelada. Sales en ${formatCountdown(jailedRobAccount.jailedUntil)}.
💰 Usa *${PREFIX}fianza* para salir antes (cuesta el triple de esa deuda).`)
      return
    }
    const context = contextInfo(content)
    const targetRaw = context.mentionedJid?.[0] || context.participant
    if (!targetRaw) {
      await reply(sock, chat, message, `Uso: menciona a alguien o responde su mensaje con *${PREFIX}rob*.`)
      return
    }
    const targetJid = jidNormalizedUser(targetRaw)
    if (sameUser(targetJid, senderJid)) {
      await reply(sock, chat, message, '😅 No puedes robarte a ti mismo.')
      return
    }
    const targetInventory = getInventory(targetJid)
    if (targetInventory.shieldCharges > 0) {
      targetInventory.shieldCharges -= 1
      queueEconomySave()
      const brokeMsg = targetInventory.shieldCharges <= 0 ? ' Su escudo se rompió.' : ` Le quedan ${targetInventory.shieldCharges} usos a su escudo.`
      await reply(sock, chat, message, `🛡️ ${targetTag(targetJid)} está protegido por un escudo anti-robo.${brokeMsg}`, [targetJid])
      return
    }
    const now = Date.now()
    const cooldownUntil = economyState.robCooldowns[senderJid] || 0
    if (cooldownUntil > now) {
      const minutes = Math.ceil((cooldownUntil - now) / 60000)
      await reply(sock, chat, message, `⏳ Ya intentaste robar hace poco. Espera ${minutes} minuto(s) más.`)
      return
    }
    const robber = getAccount(senderJid)
    const victim = getAccount(targetJid)
    if (robber.wallet < ROB_MIN_WALLET) {
      await reply(sock, chat, message, `⚠️ Necesitas al menos ${formatCurrency(ROB_MIN_WALLET)} en tu monedero para intentar robar.`)
      return
    }
    if (victim.wallet < ROB_MIN_WALLET) {
      await reply(sock, chat, message, `🕵️ ${targetTag(targetJid)} no trae suficiente encima, no vale la pena robarle.`, [targetJid])
      return
    }
    economyState.robCooldowns[senderJid] = now + ROB_COOLDOWN_MS
    const senderTagText = targetTag(senderJid)
    const targetTagText = targetTag(targetJid)
    const senderInventory = getInventory(senderJid)
    let effectiveSuccessRate = ROB_SUCCESS_RATE
    if (hasActiveBuff(senderInventory, 'suerte')) effectiveSuccessRate += 0.15
    if (Number(economyState.ecoRotoBeta?.['u:' + senderJid]?.ultraUntil || 0) > Date.now()) effectiveSuccessRate = Math.min(1, effectiveSuccessRate * 1.15)
    if (hasActiveBuff(senderInventory, 'modo_rush')) effectiveSuccessRate += 0.25
    if (isGlobalEventActive()) effectiveSuccessRate += 0.15
    if (Math.random() < effectiveSuccessRate) {
      const percent = ROB_MIN_PERCENT + Math.random() * (ROB_MAX_PERCENT - ROB_MIN_PERCENT)
      let stolen = Math.max(1, Math.floor(victim.wallet * percent))
      let shieldNote = ''
      const tiers = targetInventory.shieldTiers || {}
      const bestTierKey = Object.keys(tiers)
        .filter(key => tiers[key] > 0)
        .sort((a, b) => Number(b) - Number(a))[0]
      if (bestTierKey) {
        const blocked = Math.floor(stolen * (Number(bestTierKey) / 100))
        stolen -= blocked
        tiers[bestTierKey] -= 1
        const remaining = tiers[bestTierKey]
        shieldNote = `\n🛡️ Su escudo (${bestTierKey}%) bloqueó ${formatCurrency(blocked)}.${remaining <= 0 ? ' Se rompió.' : ` Le quedan ${remaining} usos.`}`
      }
      victim.wallet -= stolen
      const { net: stolenNet, suffix: stolenSuffix } = applyKingdomTax(stolen)
      robber.wallet += stolenNet
      queueEconomySave()
      await reply(sock, chat, message, `🦹 ${senderTagText} le robó ${formatCurrency(stolen)} a ${targetTagText}.\n${formatCurrency(stolenNet)} netos para ti.${stolenSuffix}${shieldNote}`, [senderJid, targetJid])
    } else {
      const percent = ROB_FINE_MIN_PERCENT + Math.random() * (ROB_FINE_MAX_PERCENT - ROB_FINE_MIN_PERCENT)
      const fine = Math.max(1, Math.floor(victim.wallet * percent))
      robber.wallet -= fine
      queueEconomySave()
      await reply(sock, chat, message, `🚨 ${senderTagText} intentó robar a ${targetTagText}, lo atraparon y pagó una multa de ${formatCurrency(fine)}.`, [senderJid, targetJid])
    }
    return
  }

  if (command === 'work' || command === 'trabajar') {
    const senderJid = jidNormalizedUser(sender || '')
    checkLoan(senderJid)
    const jailedAccount = getAccount(senderJid)
    if (jailedAccount.jailedUntil > Date.now()) {
      await reply(sock, chat, message, `🚔 Estás en la cárcel: tu deuda de ${formatCurrency(jailedAccount.lastJailDebt || 0)} fue cancelada. Sales en ${formatCountdown(jailedAccount.jailedUntil)}.
💰 Usa *${PREFIX}fianza* para salir antes (cuesta el triple de esa deuda).`)
      return
    }
    const now = Date.now()
    const cooldownUntil = economyState.workCooldowns[senderJid] || 0
    if (cooldownUntil > now) {
      const seconds = Math.ceil((cooldownUntil - now) / 1000)
      await reply(sock, chat, message, `⏳ Ya trabajaste hace poco. Espera ${seconds} segundo(s) más.`)
      return
    }
    const usage = economyState.workUsage[senderJid] || { count: 0, windowStart: now }
    if (now - usage.windowStart > WORK_USAGE_WINDOW_MS) {
      usage.count = 0
      usage.windowStart = now
    }
    if (usage.count >= WORK_MAX_USES) {
      const resetMinutes = Math.ceil((usage.windowStart + WORK_USAGE_WINDOW_MS - now) / 60000)
      await reply(sock, chat, message, `🛑 Llegaste al límite de ${WORK_MAX_USES} usos de *${PREFIX}work* cada 6 horas. Vuelve a intentarlo en ${resetMinutes} minuto(s).`)
      return
    }
    const account = getAccount(senderJid)
    const workSeason = currentWorkSeason()
    const workPresentation = createWorkPresentation(senderJid, workSeason)
    const workInventory = getInventory(senderJid)
    const baseEarned = WORK_MIN_REWARD + Math.floor(Math.random() * (WORK_MAX_REWARD - WORK_MIN_REWARD + 1))
    const hasRush = hasActiveBuff(workInventory, 'modo_rush')
    const hasMultiplier = hasActiveBuff(workInventory, 'multiplicador')
    const hasEventWorkX2 = Number(economyState.workEventMultipliers?.[senderJid] || 0) > now
    const earned = hasRush ? Math.floor(baseEarned * 3) : hasEventWorkX2 ? Math.floor(baseEarned * 2) : hasMultiplier ? Math.floor(baseEarned * 1.5) : baseEarned
    const suppliedEarned = rewardWithSupply(workInventory, 'work', earned, Number(economyState.ecoRotoBeta?.['u:' + senderJid]?.ultraUntil || 0) > now)
    const { net: earnedNet, suffix: earnedSuffix } = applyKingdomTax(suppliedEarned)
    account.wallet += earnedNet
    const rareEvent = Math.random() < 0.08
    let rareBonusNet = 0
    let rareEventText = ''
    if (rareEvent) {
      const rareBonus = 75 + Math.floor(Math.random() * 106)
      const taxedBonus = applyKingdomTax(rareBonus)
      rareBonusNet = taxedBonus.net
      account.wallet += rareBonusNet
      const rarePool = WORK_RARE_EVENTS[workSeason.name || 'normal'] || WORK_RARE_EVENTS.normal
      rareEventText = `\n\n${rarePool[Math.floor(Math.random() * rarePool.length)]}.\n🎉 Bono especial: +${formatCurrency(rareBonusNet)}${taxedBonus.suffix}`
    }
    const workXp = 6 + Math.floor(Math.random() * 9)
    economyState.xp[senderJid] = (economyState.xp[senderJid] || 0) + workXp
    usage.count++
    economyState.workUsage[senderJid] = usage
    economyState.workCooldowns[senderJid] = now + WORK_COOLDOWN_MS
    const careerLine = recordReward(economyState, senderJid, 'work', earnedNet + rareBonusNet, workXp, now)
    queueEconomySave()
    const workBonusLabel = hasRush ? ' 🚀(Modo Rush x3)' : hasEventWorkX2 ? ' 🏆(Premio del Rey del Umbral x2)' : hasMultiplier ? ' ✨(Trabajo x1.5)' : ''
    await reply(sock, chat, message, `${workPresentation.title}\n\n${workPresentation.job}.\n\n🪙 ${workPresentation.payment} ${formatCurrency(earnedNet)}${workBonusLabel}.${earnedSuffix}${rareEventText}\n✨ Experiencia laboral: +${workXp} XP\n💰 Ahora tienes: ${formatCurrency(account.wallet)}\n⏱️ Jornadas realizadas: ${usage.count}/${WORK_MAX_USES} (6h)\n${workPresentation.farewell}${careerLine}${winterFlavor('work') || narrativeLine('work', senderJid)}`)
    return
  }

  if (command === 'blackjack' || command === 'bj') {
    const senderJid = jidNormalizedUser(sender || '')
    const gameKey = `${chat}:${senderJid}`
    if (economyState.blackjackGames[gameKey]) {
      await reply(sock, chat, message, `🃏 Ya tienes una partida en curso. Responde con *${PREFIX}pedir*, *${PREFIX}plantarse* o *${PREFIX}doblar*.`)
      return
    }
    const account = getAccount(senderJid)
    const bet = parseAmount(commandContent, account.wallet)
    if (!bet || bet > account.wallet) {
      await reply(sock, chat, message, `Uso: *${PREFIX}blackjack all* o *${PREFIX}blackjack <cantidad>*. Tienes ${formatCurrency(account.wallet)} en el monedero.`)
      return
    }
    if (bet < BLACKJACK_MIN_BET) {
      await reply(sock, chat, message, `⚠️ La apuesta mínima es ${formatCurrency(BLACKJACK_MIN_BET)}.`)
      return
    }
    account.wallet -= bet
    const playerCards = [drawCard(), drawCard()]
    const dealerCards = [drawCard(), drawCard()]
    const playerTotal = handValue(playerCards)
    if (playerTotal === 21) {
      await resolveBlackjack(sock, chat, message, account, gameKey, bet, playerCards, dealerCards, false)
      return
    }
    economyState.blackjackGames[gameKey] = { bet, playerCards, dealerCards, doubled: false }
    queueEconomySave()
    await reply(sock, chat, message, `🃏 *BLACKJACK*\n\nTú: ${formatHand(playerCards)} (${playerTotal})\nDealer: ${formatHand([dealerCards[0]])} 🂠\n\nApuesta: ${formatCurrency(bet)}\n\nResponde con *${PREFIX}pedir* (carta), *${PREFIX}plantarse* (quedarte) o *${PREFIX}doblar* (doblar apuesta y pedir una última carta).`)
    return
  }

  if (command === 'pedir') {
    const senderJid = jidNormalizedUser(sender || '')
    const gameKey = `${chat}:${senderJid}`
    const game = economyState.blackjackGames[gameKey]
    if (!game) {
      await reply(sock, chat, message, `No tienes una partida de blackjack activa. Empieza con *${PREFIX}blackjack all/cantidad*.`)
      return
    }
    game.playerCards.push(drawCard())
    const playerTotal = handValue(game.playerCards)
    const account = getAccount(senderJid)
    if (playerTotal >= 21) {
      await resolveBlackjack(sock, chat, message, account, gameKey, game.bet, game.playerCards, game.dealerCards, true)
      return
    }
    queueEconomySave()
    await reply(sock, chat, message, `🃏 Tú: ${formatHand(game.playerCards)} (${playerTotal})\n\nResponde con *${PREFIX}pedir* o *${PREFIX}plantarse*.`)
    return
  }

  if (command === 'plantarse') {
    const senderJid = jidNormalizedUser(sender || '')
    const gameKey = `${chat}:${senderJid}`
    const game = economyState.blackjackGames[gameKey]
    if (!game) {
      await reply(sock, chat, message, `No tienes una partida de blackjack activa. Empieza con *${PREFIX}blackjack all/cantidad*.`)
      return
    }
    const account = getAccount(senderJid)
    await resolveBlackjack(sock, chat, message, account, gameKey, game.bet, game.playerCards, game.dealerCards, true)
    return
  }

  if (command === 'doblar') {
    const senderJid = jidNormalizedUser(sender || '')
    const gameKey = `${chat}:${senderJid}`
    const game = economyState.blackjackGames[gameKey]
    if (!game) {
      await reply(sock, chat, message, `No tienes una partida de blackjack activa. Empieza con *${PREFIX}blackjack all/cantidad*.`)
      return
    }
    if (game.doubled || game.playerCards.length !== 2) {
      await reply(sock, chat, message, '⚠️ Solo puedes doblar antes de pedir cartas adicionales.')
      return
    }
    const account = getAccount(senderJid)
    account.wallet -= game.bet
    game.bet *= 2
    game.doubled = true
    game.playerCards.push(drawCard())
    await resolveBlackjack(sock, chat, message, account, gameKey, game.bet, game.playerCards, game.dealerCards, true)
    return
  }

  // ----- Economia: daily, top e inversiones -----
  if (command === 'daily' || command === 'diario') {
    const senderJid = jidNormalizedUser(sender || '')
    const now = Date.now()
    const cooldownUntil = economyState.dailyCooldowns[senderJid] || 0
    if (cooldownUntil > now) {
      const hours = Math.floor((cooldownUntil - now) / 3600000)
      const minutes = Math.ceil(((cooldownUntil - now) % 3600000) / 60000)
      await reply(sock, chat, message, `⏳ Ya reclamaste tu bono diario. Espera ${hours}h ${minutes}m más.`)
      return
    }
    const account = getAccount(senderJid)
    const reward = DAILY_MIN_REWARD + Math.floor(Math.random() * (DAILY_MAX_REWARD - DAILY_MIN_REWARD + 1))
    const suppliedReward = rewardWithSupply(getInventory(senderJid), 'daily', reward, Number(economyState.ecoRotoBeta?.['u:' + senderJid]?.ultraUntil || 0) > now)
    const { net: rewardNet, suffix: rewardSuffix } = applyKingdomTax(suppliedReward)
    account.wallet += rewardNet
    economyState.dailyCooldowns[senderJid] = now + DAILY_COOLDOWN_MS
    const streakData = economyState.dailyStreaks[senderJid] || { count: 0, lastClaimedAt: 0 }
    const withinStreakWindow = now - streakData.lastClaimedAt <= DAILY_COOLDOWN_MS * 2
    streakData.count = withinStreakWindow ? streakData.count + 1 : 1
    streakData.lastClaimedAt = now
    economyState.dailyStreaks[senderJid] = streakData
    const xpReward = dailyXpReward(streakData.count)
    economyState.xp[senderJid] = (economyState.xp[senderJid] || 0) + xpReward
    const streakMilestone = streakData.count % 7 === 0 ? 350 + Math.min(650, streakData.count * 15) : 0
    if (streakMilestone) account.wallet += streakMilestone
    recordReward(economyState, senderJid, 'daily', rewardNet + streakMilestone, xpReward, now)
    queueEconomySave()
    const milestoneLine = streakMilestone ? `\n🌟 Bono por ${streakData.count} días: ${formatCurrency(streakMilestone)}` : ''
    const nextMilestone = 7 - (streakData.count % 7 || 7)
    await reply(sock, chat, message, `🎁 *RECOMPENSA DIARIA*\n\n🪙 Ganaste ${formatCurrency(rewardNet)}\n✨ Experiencia: +${xpReward} XP${rewardSuffix}\n🔥 Racha diaria: ${streakData.count}${milestoneLine}\n💰 Monedero: ${formatCurrency(account.wallet)}${streakMilestone ? '' : `\n🎯 Próximo bono en ${nextMilestone || 7} día(s).`}${dailyView(streakData.count, now + DAILY_COOLDOWN_MS)}${winterFlavor('daily') || narrativeLine('daily', senderJid)}`)
    return
  }

  if (command === 'top' || command === 'ricos') {
    const topArg = commandContent.trim().toLowerCase()
    const botJid = jidNormalizedUser(sock.user?.id || '')
    const memberJids = new Set((metadata.participants || []).map(p => jidNormalizedUser(p.id)))
    if (topArg === 'actividad' || topArg === 'mensajes') {
      const entries = Object.entries(economyState.messageCounts || {})
        .filter(([jid]) => jid !== botJid && memberJids.has(jid))
        .map(([jid, messages]) => ({ jid, messages: Number(messages) || 0 }))
        .filter(entry => entry.messages > 0)
        .sort((a, b) => b.messages - a.messages)
        .slice(0, 10)
      if (!entries.length) {
        await reply(sock, chat, message, 'Todavía no hay actividad registrada en este grupo.')
        return
      }
      const medals = ['🥇', '🥈', '🥉']
      const lines = entries.map((entry, i) => `${medals[i] || `${i + 1}.`} ${targetTag(entry.jid)} — ${formatCompact(entry.messages)} mensajes`)
      await reply(sock, chat, message, `💬 *TOP DE ACTIVIDAD GENERAL*

${lines.join('\n')}

_Este conteo refleja la actividad acumulada del clan._`, entries.map(entry => entry.jid))
      return
    }
    if (topArg === 'xp' || topArg === 'nivel') {
      const entries = Object.entries(economyState.xp)
        .filter(([jid]) => jid !== botJid && memberJids.has(jid))
        .map(([jid, xp]) => ({ jid, xp, level: levelFromXp(xp) }))
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 10)
      if (!entries.length) {
        await reply(sock, chat, message, 'Todavía nadie ha ganado XP.')
        return
      }
      const medals = ['🥇', '🥈', '🥉']
      const lines = entries.map((entry, i) => `${medals[i] || `${i + 1}.`} ${targetTag(entry.jid)} — Nivel ${entry.level} (${formatCompact(entry.xp)} XP)`)
      await reply(sock, chat, message, `🏆 *TOP XP*\n\n${lines.join('\n')}`, entries.map(entry => entry.jid))
      return
    }
    const entries = Object.entries(economyState.wallets)
      .filter(([jid]) => jid !== botJid && memberJids.has(jid))
      .map(([jid, acc]) => ({ jid, total: acc.wallet + acc.bank }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
    if (!entries.length) {
      await reply(sock, chat, message, 'Todavía no hay nadie con cuenta abierta.')
      return
    }
    const medals = ['🥇', '🥈', '🥉']
    const lines = entries.map((entry, i) => `${medals[i] || `${i + 1}.`} ${targetTag(entry.jid)} — ${formatCurrency(entry.total)}`)
    await reply(sock, chat, message, `🏆 *TOP DINERO*\n\n${lines.join('\n')}\n\n_Usa ${PREFIX}top xp para niveles o ${PREFIX}top actividad para mensajes._`, entries.map(entry => entry.jid))
    return
  }

  if (command === 'inversiones' || command === 'investments') {
    const senderJid = jidNormalizedUser(sender || '')
    collectFortuneIncome(senderJid)
    const account = getAccount(senderJid)
    const companyList = economyState.companies[chat]?.list || []
    if (companyList.length) tickCompanies(companyList)
    const holdings = companyList
      .map(company => ({ name: company.name, shares: company.shares[senderJid] || 0, price: company.price }))
      .filter(h => h.shares > 0)
    const investedValue = holdings.reduce((sum, h) => sum + h.shares * h.price, 0)
    const netWorth = account.wallet + account.bank + investedValue
    const change = netWorth - STARTING_BALANCE
    const changePct = (change / STARTING_BALANCE) * 100
    const arrow = change >= 0 ? '📈' : '📉'
    const sign = change >= 0 ? '+' : ''
    const holdingsLines = holdings.length
      ? holdings.map(h => `• ${h.name}: ${h.shares} acciones — ${formatCurrency(h.shares * h.price)}`).join('\n')
      : '_No tienes acciones de ninguna empresa._'
    await reply(sock, chat, message, `💼 *TUS INVERSIONES*\n\nPatrimonio total: ${formatCurrency(netWorth)}\nInicial: ${formatCurrency(STARTING_BALANCE)}\n${arrow} ${sign}${formatCurrency(change)} (${sign}${changePct.toFixed(1)}%)\n\n*Acciones en cartera:*\n${holdingsLines}`)
    return
  }

  // ----- Mazmorra / exploracion (minijuego RPG) -----
  if (command === 'explore' || command === 'explorar') {
    const senderJid = jidNormalizedUser(sender || '')
    const explorer = explorerFor(senderJid)
    const state = getExploreState(senderJid)
    const arg = commandContent.trim().toLowerCase()

    if (arg === 'estado' || arg === 'status') {
      const lives = exploreLivesLeft(senderJid)
      if (state.expeditionStartedAt) {
        const readyAt = state.expeditionStartedAt + EXPLORE_DURATION_MS
        if (Date.now() >= readyAt) {
          await reply(sock, chat, message, `🧭 ${explorer.emoji} *${explorer.name}* ya volvió de explorar. Escribe *${PREFIX}explore* para ver qué encontró.`)
        } else {
          await reply(sock, chat, message, `🧭 ${explorer.emoji} *${explorer.name}* sigue explorando.\nRegresa en ${formatCountdown(readyAt)}.\n❤️ Vidas: ${lives}/${EXPLORE_MAX_LIVES}`)
        }
      } else {
        const nextLifeText = lives < EXPLORE_MAX_LIVES && state.livesLostAt.length
          ? `\nPróxima vida en ${formatCountdown(Math.min(...state.livesLostAt) + EXPLORE_LIFE_REGEN_MS)}`
          : ''
        await reply(sock, chat, message, `🧭 ${explorer.emoji} *${explorer.name}* no está explorando.\n❤️ Vidas: ${lives}/${EXPLORE_MAX_LIVES}${nextLifeText}\n\nUsa *${PREFIX}explore* para empezar una expedición (dura 1 hora).`)
      }
      return
    }

    if (state.expeditionStartedAt) {
      const readyAt = state.expeditionStartedAt + EXPLORE_DURATION_MS
      if (Date.now() < readyAt) {
        await reply(sock, chat, message, `🧭 ${explorer.emoji} *${explorer.name}* todavía está explorando.\nRegresa en ${formatCountdown(readyAt)}.\n\n_Usa ${PREFIX}explore estado para revisar sin gastar tu turno._`)
        return
      }
      state.expeditionStartedAt = null
      const account = getAccount(senderJid)
      const roll = Math.random() * 1000
      let earned = 0
      let text = ''
      if (roll < 1) {
        earned = randomBetween(200000, 300000)
        text = `🎇 ¡INCREÍBLE! ${explorer.emoji} *${explorer.name}* encontró un tesoro legendario perdido hace siglos.\n💰 +${formatCurrency(earned)}`
      } else if (roll < 2) {
        state.livesLostAt = [Date.now(), Date.now(), Date.now()]
        text = `🌀 Un portal se abre bajo los pies de ${explorer.emoji} *${explorer.name}*... y se lo traga por completo.\n💀 Perdiste tus 3 vidas de golpe.`
      } else if (roll < 22) {
        earned = randomBetween(5000, 20000)
        text = `${explorer.emoji} *${explorer.name}* descubrió unas ruinas llenas de riquezas.\n💰 +${formatCurrency(earned)}`
      } else if (roll < 172) {
        earned = randomBetween(500, 3000)
        text = `${explorer.emoji} *${explorer.name}* encontró un cofre escondido.\n💰 +${formatCurrency(earned)}`
      } else if (roll < 422) {
        earned = randomBetween(50, 400)
        text = `${explorer.emoji} *${explorer.name}* encontró algunas monedas sueltas.\n💰 +${formatCurrency(earned)}`
      } else if (roll < 452) {
        earned = randomBetween(1000, 8000)
        text = `🌀 ${explorer.emoji} *${explorer.name}* cae en un portal a un mundo misterioso... pero logra volver, trayendo consigo riquezas de otro lugar.\n💰 +${formatCurrency(earned)}`
      } else if (roll < 482) {
        text = `🌀 ${explorer.emoji} *${explorer.name}* desaparece en un portal por un instante... y regresa confundido, sin nada en las manos.`
      } else if (roll < 502) {
        const r2 = Math.random()
        const foundTier = r2 < 0.7 ? 1 : r2 < 0.95 ? 2 : 3
        if (foundTier > pickaxeTier(senderJid)) {
          givePickaxe(senderJid, foundTier)
          text = `🛠️ ${explorer.emoji} *${explorer.name}* encuentra ${pickaxeName(foundTier)}! Mejor que lo que tenía. Se guardó en la mochila (${PREFIX}inventario).`
        } else {
          text = `🛠️ ${explorer.emoji} *${explorer.name}* encuentra ${pickaxeName(foundTier)}, pero ya tiene algo mejor. Lo deja ahí.`
        }
      } else if (roll < 702) {
        mineTakeDamage(state, 0.15)
        text = `👹 Un monstruo emboscó a ${explorer.emoji} *${explorer.name}*.\n💔 Pierdes 15% de tu vida.`
      } else if (roll < 852) {
        mineTakeDamage(state, 0.15)
        text = `🕸️ ${explorer.emoji} *${explorer.name}* cayó en una trampa entre ruinas abandonadas.\n💔 Pierdes 15% de tu vida.`
      } else {
        text = `🌲 ${explorer.emoji} *${explorer.name}* exploró la zona pero no encontró nada interesante.`
      }
      if (earned > 0) account.wallet += earned
      queueEconomySave()
      const livesLeft = exploreLivesLeft(senderJid)
      await reply(sock, chat, message, `🧭 *REGRESASTE DE EXPLORAR*\n\n${text}\n\n❤️ Vidas: ${livesLeft}/${EXPLORE_MAX_LIVES}${earned > 0 ? `\nMonedero: ${formatCurrency(account.wallet)}` : ''}`)
      return
    }

    const lives = exploreLivesLeft(senderJid)
    if (lives <= 0) {
      const nextAt = Math.min(...state.livesLostAt) + EXPLORE_LIFE_REGEN_MS
      await reply(sock, chat, message, `💀 ${explorer.emoji} *${explorer.name}* no tiene vidas para explorar.\nPróxima vida en ${formatCountdown(nextAt)}.`)
      return
    }
    state.expeditionStartedAt = Date.now()
    queueEconomySave()
    await reply(sock, chat, message, `🧭 ${explorer.emoji} *${explorer.name}* parte a explorar.\nVuelve en 1 hora con *${PREFIX}explore* para ver qué encontró.\n❤️ Vidas: ${lives}/${EXPLORE_MAX_LIVES}\n\n_Usa ${PREFIX}explore estado para revisar el tiempo restante._`)
    return
  }

  if (command === 'mine' || command === 'mina') {
    await reply(sock, chat, message, `Este comando se actualizó. Ahora usa *${PREFIX}mazmorra*.`)
    return
  }

  if (command === 'mazmorra') {
    const senderJid = jidNormalizedUser(sender || '')
    // Presagio narrativo: cooldown compartido y persistente, sin reiniciar la mazmorra.
    const omenNow = Date.now()
    if (!economyState.mineDestroyed && omenNow >= (economyState.mineCrystalOmenNextAt || 0)) {
      const nextOmenAt = omenNow + 2 * 60 * 60 * 1000
      economyState.mineCrystalOmenNextAt = nextOmenAt
      queueEconomySave()
      try {
        await reply(sock, chat, message, '🔮 *EL ÚLTIMO LATIDO*\n\n_En las profundidades se oyen lamentos. El cristal late una vez… y una grieta azul recorre la bóveda._\n\n_Las antorchas tiemblan. Cuando el cristal dé su último latido, la mazmorra caerá con él._')
      } catch (error) {
        if (economyState.mineCrystalOmenNextAt === nextOmenAt) {
          delete economyState.mineCrystalOmenNextAt
          queueEconomySave()
        }
        logger.warn({ err: error }, 'No se pudo enviar el presagio de la mazmorra')
      }
    }
    if (economyState.mineDestroyed) {
      const reopenAt = economyState.mineReopenAt || 0
      const now = Date.now()
      if (now < reopenAt) {
        const totalSec = Math.ceil((reopenAt - now) / 1000)
        const mm = Math.floor(totalSec / 60)
        const ss = totalSec % 60
        await reply(sock, chat, message, `🌫️ Apareció una estructura muy rara entre la niebla. Intentas entrar, pero una fuerza invisible te lo impide...\n\nSobre la puerta, un extraño contador brilla en el aire:\n⏳ *${mm}:${String(ss).padStart(2, '0')}*`)
        return
      }
      economyState.mineDestroyed = false
      queueEconomySave()
      await reply(sock, chat, message, `🚪 De repente, la estructura abre sus puertas gigantes con un estruendo que retumba por toda la zona...\n\n¡Ya puedes entrar! Usa *${PREFIX}mazmorra* de nuevo para adentrarte.`)
      return
    }
    const state = getMineState(senderJid)
    assignMineTraits(getInventory(senderJid))
    if (state.portalReturnAt) {
      if (Date.now() >= state.portalReturnAt) {
        state.portalReturnAt = null
        const account = getAccount(senderJid)
        const reward = randomBetween(2000, 8000)
        account.wallet += reward
        queueEconomySave()
        await reply(sock, chat, message, `🌀 Regresas del lugar desconocido... viste cosas que no puedes explicar. Apareces de golpe en la salida de la mazmorra, trayendo contigo algo extraño.\n💰 +${formatCurrency(reward)}`)
        return
      }
      await reply(sock, chat, message, `🌀 Sigues perdido en el lugar desconocido. Regresa en ${formatCountdown(state.portalReturnAt)}.`)
      return
    }
    const mineArg = commandContent.trim().toLowerCase()
    if (mineArg === 'probabilidades' || mineArg === 'probabilidad' || mineArg === 'odds') {
      const depthRef = state.active ? Math.max(state.currentFloor || 1, 1) : 1
      const exitW = Math.min(5 + depthRef * 5, 45)
      const trapW = 10, treasureW = 14, itemW = 8, toolW = 6, monsterW = 10, veinW = 10, climbW = 8, swimW = 8, caveInW = 4, checkpointW = 8, merchantW = 6, portalW = 3, holeW = 1, weirdW = 3
      const continueW = Math.max(8, 100 - exitW - trapW - treasureW - itemW - toolW - monsterW - veinW - climbW - swimW - caveInW - checkpointW - merchantW - portalW - holeW - weirdW)
      const totalW = exitW + trapW + treasureW + itemW + toolW + monsterW + veinW + climbW + swimW + caveInW + checkpointW + merchantW + portalW + holeW + weirdW + continueW
      const pct = w => (w / totalW * 100).toFixed(1)
      await reply(sock, chat, message, `🎲 *PROBABILIDADES DE ${PREFIX}MINE* (profundidad ${depthRef})\n\n🚪 Salida: ${pct(exitW)}%\n📦 Cofre: ${pct(treasureW)}%\n✨ Objeto: ${pct(itemW)}%\n🛠️ Herramienta: ${pct(toolW)}%\n🧟 Monstruo: ${pct(monsterW)}%\n⛏️ Grieta con gemas: ${pct(veinW)}%\n🧗 Escalar: ${pct(climbW)}%\n🌊 Nadar: ${pct(swimW)}%\n🪨 Derrumbe: ${pct(caveInW)}%\n🏕️ Campamento: ${pct(checkpointW)}%\n🧙 Comerciante: ${pct(merchantW)}%\n🌀 Portal: ${pct(portalW)}%\n🕳️ Trampa: ${pct(trapW)}%\n🕳️💥 Hoyo: ${pct(holeW)}%\n👁️ Suceso raro: ${pct(weirdW)}%\n🌲 Nada: ${pct(continueW)}%\n\n_La probabilidad de encontrar la salida sube mientras más te adentras (hasta 45% máx)._\n\n🗿 Aparte, cada paso tiene 0.002% de invocar la *Estructura Extraña* (convierte los portales en trampas y sella las salidas). Mientras esté activa, cada paso tiene 1% de dejarte una *llave*; con 3 llaves y *${PREFIX}romper* se destruye (+100.000 monedas, +500.000 XP y 3 días de inmunidad para quien lo logre; los demás que estén dentro mueren y pierden todo).`)
      return
    }
    if (state.active) {
      const hint = state.pending === 'treasure'
        ? `Tienes un cofre pendiente. Usa *${PREFIX}guardar*, *${PREFIX}abrir* o *${PREFIX}seguir*.`
        : state.pending === 'trap'
        ? `Tienes una trampa activa. Usa *${PREFIX}desarmar* o *${PREFIX}esquivar*.`
        : state.pending === 'prisoner'
        ? `Hay un prisionero encadenado esperando. Usa *${PREFIX}liberar* o *${PREFIX}ignorar*.`
        : state.pending === 'monster'
          ? `Un monstruo te bloquea el paso. Usa *${PREFIX}pelear* o *${PREFIX}huir*.`
          : state.pending === 'checkpoint'
            ? `Encontraste un santuario olvidado. Usa *${PREFIX}curar*, *${PREFIX}comprarvida* o *${PREFIX}seguir*.`
            : state.pending === 'merchant'
              ? `Un comerciante te espera. Usa *${PREFIX}comerciar 1* al *7* o *${PREFIX}seguir*.`
              : state.pending === 'portal'
                ? `Hay un portal apagado. Usa *${PREFIX}repararportal* o *${PREFIX}seguir*.`
                : state.pending === 'exitportal'
                  ? `Hay un portal de salida abierto. Usa *${PREFIX}salir* o *${PREFIX}seguir*.`
                  : state.pending === 'floorcheckpoint'
                    ? `Te preguntaron si quieres guardar este piso como checkpoint. Usa *${PREFIX}si* o *${PREFIX}no*.`
                    : mineDirectionHint()
      await reply(sock, chat, message, `🏰 Ya estás dentro de la mazmorra.\n${hint}\n❤️ Vida: ${mineLivesLeft(senderJid)}/${state.maxHp || MINE_MAX_LIVES}${pickaxeLine(senderJid)}${mineStructureNotice(senderJid)}`)
      return
    }
    if (state.recoveryAt && Date.now() < state.recoveryAt) {
      await reply(sock, chat, message, `💀 Todavía te estás recuperando. Vuelve en ${formatCountdown(state.recoveryAt)}.`)
      return
    }
    state.recoveryAt = null
    if (state.checkpointFloor && mineArg !== 'nuevo' && mineArg !== 'checkpoint') {
      await reply(sock, chat, message, `🏰 Tienes un punto de control guardado en el *Piso ${state.checkpointFloor}*.\n\nUsa *${PREFIX}mazmorra nuevo* para empezar desde el Piso 1, o *${PREFIX}mazmorra checkpoint* para continuar desde tu punto de control.${mineStructureNotice(senderJid)}`)
      return
    }
    const startFloor = mineArg === 'checkpoint' && state.checkpointFloor ? state.checkpointFloor : 1
    const lives = mineLivesLeft(senderJid)
    state.active = true
    state.maxHp = mineMaxHpFor(getInventory(senderJid))
    state.maxMana = mineMaxManaFor(getInventory(senderJid))
    state.hp = state.maxHp
    state.mana = state.maxMana
    state.depth = 0
    state.currentFloor = startFloor
    state.floorSteps = 0
    state.bossPortalShown = false
    state.pending = 'direction'
    state.loot = 0
    state.items = []
    state.structureSave = { floor: startFloor, loot: 0, items: [] }
    queueEconomySave()
    const entrance = startFloor > 1
      ? `🏰 *REGRESAS AL PISO ${startFloor}*\n\nRetomas la exploración desde tu punto de control. Frente a ti se abren ${mineJunctionDescription()}.\n\nUsa *${PREFIX}avanzar*, *${PREFIX}izquierda* o *${PREFIX}derecha* para elegir por dónde ir.\n❤️ Vida: ${lives}/${state.maxHp || MINE_MAX_LIVES}${pickaxeLine(senderJid)}`
      : `🏰 *ENTRAS A LA MAZMORRA*\n\nLas puertas se cierran detrás de ti con un eco pesado. Frente a ti se abren ${mineJunctionDescription()}.\n\nUsa *${PREFIX}avanzar*, *${PREFIX}izquierda* o *${PREFIX}derecha* para elegir por dónde ir.\n❤️ Vida: ${lives}/${state.maxHp || MINE_MAX_LIVES}${pickaxeLine(senderJid)}`
    await reply(sock, chat, message, entrance)
    if (mineStructureBlocks(senderJid)) await reply(sock, chat, message, `⚠️ *Aviso:* la Estructura Extraña sigue activa dentro de la mazmorra. Los portales son *trampas* (te quitan 10% de vida) y no podrás salir hasta que alguien encuentre 3 llaves y la destruya con *${PREFIX}romper*. Si mueres, reapareces en tu último checkpoint pero pierdes todo el dinero y botín que hayas ganado. 🗝️ Llaves: ${mineStructureKeys(senderJid)}/${MINE_STRUCTURE_KEYS_NEEDED}`)
    return
  }

  if (command === 'magia') {
    const senderJid = jidNormalizedUser(sender || '')
    const state = getMineState(senderJid)
    const inv = getInventory(senderJid)
    assignMineTraits(inv)
    if (!state.active) {
      await reply(sock, chat, message, `No estás en la mazmorra ahora mismo. Usa *${PREFIX}mazmorra* para entrar.`)
      return
    }
    const parts = commandContent.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const hasElements = (inv.elements || []).concat(inv.unlockedElements || [])
    const mana = getMineMana(state)
    if (!parts.length || !parts[0]) {
      const list = hasElements.length ? hasElements.join(', ') : 'ninguno'
      await reply(sock, chat, message, `🔮 Maná: ${mana}/${state.maxMana || MINE_MAX_MANA}\n🧪 Elementos: ${list}${inv.prodigioElemental ? ' (+ PRODIGIO)' : ''}\n\nUsa *${PREFIX}magia <elemento> <numero>*.\nEj: *${PREFIX}magia fuego 1*`)
      return
    }
    const elemento = parts[0]
    const numero = parts[1]
    if (elemento === 'prodigio') {
      if (!inv.prodigioElemental) { await reply(sock, chat, message, `No tienes el rasgo Prodigio.`); return }
      const cost = 150
      if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
      state.mana = mana - cost
      state.hp = (state.maxHp || MINE_MAX_HP)
      state.arcaneShield = (state.arcaneShield || 0) + 5
      let text = `✨ *Convergencia*: recuperas toda tu vida y reduces el peligro a la mitad por 5 pasos.`
      if (state.pending === 'monster') {
        const bossNow = isMineBossFloor(state.currentFloor || 1)
        const amount = Math.round(randomBetween(300, 3000) * mineDepthLootMult(state.currentFloor || 1) * (bossNow ? 1 + mineBossIndex(state.currentFloor || 1) * 0.5 : 1))
        state.loot += amount
        const bossXpC = bossNow ? grantMineBossXp(senderJid, state.currentFloor || 1) : 0
        text += `\n⚔️ Además vences tu combate actual sin esfuerzo.\n💰 +${formatCurrency(amount)}${bossXpC ? `\n✨ +${bossXpC} XP` : ''}`
        state.pending = 'direction'
      }
      text = mineFinishStep(state, senderJid, text, false)
      queueEconomySave()
      await reply(sock, chat, message, text)
      return
    }
    if (!MINE_ELEMENTS.includes(elemento)) {
      await reply(sock, chat, message, `Elemento inválido. Usa: agua, fuego, tierra, electricidad u oscuridad.`)
      return
    }
    if (!hasElements.includes(elemento)) {
      await reply(sock, chat, message, `No tienes el elemento *${elemento}*.`)
      return
    }
    if (elemento === 'agua') {
      if (numero === '1') {
        const cost = 40
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        state.mana = mana - cost
        const healed = mineHeal(state, 0.4)
        queueEconomySave()
        await reply(sock, chat, message, `🌊 *Torrente curativo*: recuperas ${healed} de vida.\n❤️ Vida: ${mineCurrentHp(state)}/${state.maxHp || MINE_MAX_HP}\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`)
return
      }
      if (numero === '2') {
        const cost = 60
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        state.mana = mana - cost
        state.arcaneShield = (state.arcaneShield || 0) + 3
        queueEconomySave()
        await reply(sock, chat, message, `🌊 *Niebla protectora*: reduces el peligro a la mitad por 3 pasos.\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`)
        return
      }
      if (numero === '3') {
        if (state.pending !== 'monster') { await reply(sock, chat, message, `Esa magia solo sirve en combate.`); return }
        const cost = 50
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        state.mana = mana - cost
        mineHeal(state, 0.2)
        let text = `🌊 *Corriente arrastradora*: escapas sin daño y la corriente cura una herida.\n❤️ Vida: ${mineCurrentHp(state)}/${state.maxHp || MINE_MAX_HP}`
        state.pending = 'direction'
        text = mineFinishStep(state, senderJid, text, false)
        queueEconomySave()
        await reply(sock, chat, message, text)
        return
      }
      await reply(sock, chat, message, `Usa *${PREFIX}magia agua 1* (curar), *2* (escudo) o *3* (huida curativa, solo en combate).`)
      return
    }
    if (elemento === 'fuego') {
      if (numero === '1' || numero === '2') {
        if (state.pending !== 'monster') { await reply(sock, chat, message, `Esa magia solo sirve en combate.`); return }
        const cost = numero === '1' ? 50 : 90
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        state.mana = mana - cost
        const bossNow = isMineBossFloor(state.currentFloor || 1)
        const mult = numero === '2' ? 1.5 : 1
        const amount = Math.round(randomBetween(300, 3000) * mineDepthLootMult(state.currentFloor || 1) * (bossNow ? 1 + mineBossIndex(state.currentFloor || 1) * 0.5 : 1) * mult)
        state.loot += amount
        const legendaryF = bossNow ? tryDropMineLegendary(senderJid, state.currentFloor || 1) : false
        const bossXpF = bossNow ? grantMineBossXp(senderJid, state.currentFloor || 1) : 0
        let text = `🔥 *${numero === '2' ? 'Explosión total' : 'Bola de fuego'}*: destruyes al ${bossNow ? 'jefe' : 'monstruo'} sin problema.\n💰 +${formatCurrency(amount)}${bossXpF ? `\n✨ +${bossXpF} XP` : ''}${legendaryF ? `\n\n🌟🌟🌟 ¡¡¡EL JEFE SUELTA UN OBJETO LEGENDARIO!!! 🌟🌟🌟\nRecibes el *Objeto Legendario*.` : ''}\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`
        state.pending = 'direction'
        text = mineFinishStep(state, senderJid, text, false)
        queueEconomySave()
        await reply(sock, chat, message, text)
        return
      }
      if (numero === '3') {
        const cost = 30
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        state.mana = mana - cost
        state.fireBuff = true
        queueEconomySave()
        await reply(sock, chat, message, `🔥 *Brasas persistentes*: tu próxima pelea normal tiene +20% de probabilidad de ganar.\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`)
        return
      }
      await reply(sock, chat, message, `Usa *${PREFIX}magia fuego 1* (ataque), *2* (ataque fuerte) o *3* (buff para tu próxima pelea).`)
      return
    }
    if (elemento === 'tierra') {
      if (numero === '1') {
        const cost = 45
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        state.mana = mana - cost
        state.stoneWall = (state.stoneWall || 0) + 3
        queueEconomySave()
        await reply(sock, chat, message, `🪨 *Muro de piedra*: inmune a trampas, hoyos y derrumbes por 3 pasos.\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`)
        return
      }
      if (numero === '2') {
        const cost = 55
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        state.mana = mana - cost
        state.stoneSkin = true
        queueEconomySave()
        await reply(sock, chat, message, `🪨 *Piel pétrea*: la próxima vez que pierdas una pelea, no perderás vida.\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`)
        return
      }
      if (numero === '3') {
        const cost = 35
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        state.mana = mana - cost
        state.rootsPending = true
        queueEconomySave()
        await reply(sock, chat, message, `🪨 *Raíces profundas*: al llegar al siguiente jefe, recuperarás 20% de vida automáticamente.\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`)
        return
      }
      await reply(sock, chat, message, `Usa *${PREFIX}magia tierra 1* (muro), *2* (piel pétrea) o *3* (raíces).`)
      return
    }
    if (elemento === 'electricidad') {
      if (numero === '1') {
        const cost = 60
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        if (!state.active || state.pending !== 'direction') { await reply(sock, chat, message, `Solo puedes usar esto mientras avanzas libremente por la mazmorra.`); return }
        state.mana = mana - cost
        const beforeFloor = state.currentFloor || 1
        state.currentFloor = Math.min(MINE_MAX_FLOOR, beforeFloor + 2)
        state.floorSteps = 0
    state.bossPortalShown = false
        queueEconomySave()
        await reply(sock, chat, message, `⚡ *Paso relámpago*: saltas del Piso ${beforeFloor} al Piso ${state.currentFloor} de un golpe.\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`)
        return
      }
      if (numero === '2') {
        const cost = 30
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        state.mana = mana - cost
        state.staticVision = true
        queueEconomySave()
        await reply(sock, chat, message, `⚡ *Visión eléctrica*: sientes por dónde es más seguro seguir. +10% de probabilidad de encontrar la salida en tu próximo paso.\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`)
        return
      }
      if (numero === '3') {
        if (state.pending !== 'monster') { await reply(sock, chat, message, `Esa magia solo sirve en combate.`); return }
        const cost = 70
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        state.mana = mana - cost
        const bossNow = isMineBossFloor(state.currentFloor || 1)
        const amount = Math.round(randomBetween(300, 3000) * mineDepthLootMult(state.currentFloor || 1) * (bossNow ? 1 + mineBossIndex(state.currentFloor || 1) * 0.5 : 1))
        state.loot += amount
        state.doubleLootNext = true
        const bossXpE = bossNow ? grantMineBossXp(senderJid, state.currentFloor || 1) : 0
        let text = `⚡ *Cadena de rayos*: fulminas al ${bossNow ? 'jefe' : 'monstruo'}.\n💰 +${formatCurrency(amount)}${bossXpE ? `\n✨ +${bossXpE} XP` : ''}\n⚡ El próximo monstruo que venzas dará el doble de botín.`
        state.pending = 'direction'
        text = mineFinishStep(state, senderJid, text, false)
        queueEconomySave()
        await reply(sock, chat, message, text)
        return
      }
      await reply(sock, chat, message, `Usa *${PREFIX}magia electricidad 1* (avanzar 2 pisos), *2* (visión) o *3* (ataque con bono futuro).`)
      return
    }
    if (elemento === 'oscuridad') {
      if (numero === '1') {
        const cost = 40
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        if (!state.active || state.pending !== 'direction') { await reply(sock, chat, message, `Solo puedes usar esto mientras avanzas libremente por la mazmorra.`); return }
        state.mana = mana - cost
        state.shadowCloak = (state.shadowCloak || 0) + 2
        queueEconomySave()
        await reply(sock, chat, message, `🌑 *Manto de sombras*: te vuelves invisible a monstruos y jefes por 2 pisos.\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`)
        return
      }
      if (numero === '2') {
        if (state.pending !== 'monster') { await reply(sock, chat, message, `Esa magia solo sirve en combate.`); return }
        const cost = 65
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        state.mana = mana - cost
        const bossNow = isMineBossFloor(state.currentFloor || 1)
        const amount = Math.round(randomBetween(300, 3000) * mineDepthLootMult(state.currentFloor || 1) * (bossNow ? 1 + mineBossIndex(state.currentFloor || 1) * 0.5 : 1) * 2)
        state.loot += amount
        const legendaryO = bossNow ? tryDropMineLegendary(senderJid, state.currentFloor || 1) : false
        const bossXpO = bossNow ? grantMineBossXp(senderJid, state.currentFloor || 1) : 0
        let text = `🌑 *Robo espectral*: robas su botín sin pelear.\n💰 +${formatCurrency(amount)}${bossXpO ? `\n✨ +${bossXpO} XP` : ''}${legendaryO ? `\n\n🌟🌟🌟 ¡¡¡EL JEFE SUELTA UN OBJETO LEGENDARIO!!! 🌟🌟🌟\nRecibes el *Objeto Legendario*.` : ''}\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`
        state.pending = 'direction'
        text = mineFinishStep(state, senderJid, text, false)
        queueEconomySave()
        await reply(sock, chat, message, text)
        return
      }
      if (numero === '3') {
        const cost = 80
        if (mana < cost) { await reply(sock, chat, message, `🔮 No tienes suficiente maná (necesitas ${cost}, tienes ${mana}).`); return }
        if (mineLivesLeft(senderJid) <= 0) { await reply(sock, chat, message, `No tienes vidas para pagar este pacto.`); return }
        state.mana = mana - cost
        mineTakeDamage(state, 0.15)
        getInventory(senderJid).owned.push('cofre_cerrado')
        queueEconomySave()
        await reply(sock, chat, message, `🌑 *Pacto oscuro*: a cambio de 15% de tu vida, invocas un cofre antiguo sellado en tu mochila.\n💔 Vidas: ${mineLivesLeft(senderJid)}/${state.maxHp || MINE_MAX_LIVES}\n🔮 Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}`)
        return
      }
      await reply(sock, chat, message, `Usa *${PREFIX}magia oscuridad 1* (invisibilidad), *2* (robo, solo combate) o *3* (pacto).`)
      return
    }
    return
  }

if (command === 'habilidad') {
    const senderJid = jidNormalizedUser(sender || '')
    const inv = getInventory(senderJid)
    const state = getMineState(senderJid)
    assignMineTraits(inv)
    inv.vidaPoints = inv.vidaPoints || 0
    inv.danoPoints = inv.danoPoints || 0
    inv.manaPoints = inv.manaPoints || 0
    inv.unlockedElements = inv.unlockedElements || []
    const available = mineSkillPointsAvailable(senderJid, inv)
    const parts = commandContent.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const target = parts[0] || ''
    const danoCap = inv.prodigioCombate ? 200 : 100
    if (!target) {
      await reply(sock, chat, message, `🎓 Puntos disponibles: ${available}\n❤️ Vida: ${inv.vidaPoints}/300 (+${mineMaxHpFor(inv) - MINE_MAX_HP} HP máx.)\n✨ Maná: ${inv.manaPoints}/300 (+${mineMaxManaFor(inv) - MINE_MAX_MANA} Maná máx.)\n⚔️ Daño: ${inv.danoPoints}/${danoCap} (${mineDanoStat(inv)} dmg)\n🔮 Elementos: ${inv.elements.length ? inv.elements.join(', ') : 'ninguno'}${inv.unlockedElements.length ? ' + aprendidos: ' + inv.unlockedElements.join(', ') : ''}\n\nUsa *${PREFIX}habilidad vida <cantidad>*, *${PREFIX}habilidad mana <cantidad>*, *${PREFIX}habilidad daño <cantidad>* o *${PREFIX}habilidad <elemento> aprender* (50 puntos).`)
      return
    }
    if (target === 'vida' || target === 'dano' || target === 'daño') {
      const isVida = target === 'vida'
      const cap = isVida ? 300 : danoCap
      const current = isVida ? inv.vidaPoints : inv.danoPoints
      let amount = parseInt(parts[1], 10)
      if (parts[1] === 'max' || isNaN(amount)) amount = Math.min(available, cap - current)
      amount = Math.max(0, Math.min(amount, available, cap - current))
      if (amount <= 0) {
        await reply(sock, chat, message, `No puedes invertir ahí ahora mismo (disponibles: ${available}, tope restante: ${cap - current}).`)
        return
      }
      if (isVida) inv.vidaPoints += amount; else inv.danoPoints += amount
      if (isVida && state.active) {
        state.maxHp = mineMaxHpFor(inv)
        state.hp = Math.min(mineCurrentHp(state), state.maxHp)
      }
      queueEconomySave()
      await reply(sock, chat, message, `✅ Inviertes ${amount} puntos en ${isVida ? 'Vida' : 'Daño'}.\n${isVida ? '❤️ Vida máxima: ' + mineMaxHpFor(inv) : '⚔️ Daño: ' + mineDanoStat(inv)}`)
      return
    }
    if (target === 'mana' || target === 'maná') {
      const cap = 300
      const current = inv.manaPoints || 0
      let amount = parseInt(parts[1], 10)
      if (parts[1] === 'max' || isNaN(amount)) amount = Math.min(available, cap - current)
      amount = Math.max(0, Math.min(amount, available, cap - current))
      if (amount <= 0) {
        await reply(sock, chat, message, `No puedes invertir ahí ahora mismo (disponibles: ${available}, tope restante: ${cap - current}).`)
        return
      }
      inv.manaPoints += amount
      if (state.active) {
        state.maxMana = mineMaxManaFor(inv)
        state.mana = Math.min(getMineMana(state), state.maxMana)
      }
      queueEconomySave()
      await reply(sock, chat, message, `✅ Inviertes ${amount} puntos en Maná.\n✨ Maná máximo: ${mineMaxManaFor(inv)}`)
      return
    }
    if (MINE_ELEMENTS.includes(target) && parts[1] === 'aprender') {
      if (inv.elements.includes(target) || inv.unlockedElements.includes(target)) {
        await reply(sock, chat, message, `Ya tienes ese elemento.`)
        return
      }
      if (available < 50) {
        await reply(sock, chat, message, `Necesitas 50 puntos disponibles (tienes ${available}).`)
        return
      }
      inv.unlockedElements.push(target)
      queueEconomySave()
      await reply(sock, chat, message, `📖 Aprendes el elemento *${target}*.`)
      return
    }
    await reply(sock, chat, message, `Uso: *${PREFIX}habilidad vida <cantidad>*, *${PREFIX}habilidad daño <cantidad>* o *${PREFIX}habilidad <elemento> aprender*.`)
    return
  }

  if (command === 'evento') {
    const action = (commandContent.trim().split(/\s+/)[0] || '').toLowerCase()
    if (!action || ['top', 'premios', 'clasificacion', 'clasificación', 'atacar'].includes(action)) {
      const results = await halloweenTopText(sock, chat)
      await reply(sock, chat, message, '🏆 *CLASIFICACIÓN Y PREMIOS — JEFE COMUNITARIO*\n\nEl evento terminó. Esta tabla conserva los resultados; ya no se pueden realizar ataques.\n\n' + results.text, results.mentions)
      return
    }
    await reply(sock, chat, message, `El evento terminó. Puedes consultar la clasificación y sus premios con *${PREFIX}evento top*.`)
    return
  }

  if (command === 'salir') {
    const senderJid = jidNormalizedUser(sender || '')
    const state = getMineState(senderJid)
    if (!state.active) {
      await reply(sock, chat, message, `No estás en la mazmorra ahora mismo. Usa *${PREFIX}mazmorra* para entrar.`)
      return
    }
    if (mineStructureBlocks(senderJid)) {
      await reply(sock, chat, message, `🗿 La Estructura Extraña sella todos los portales de salida. No podrás salir de la mazmorra hasta que alguien la destruya.${mineStructureReminder(senderJid)}`)
      return
    }
    if (state.pending !== 'direction' && state.pending !== 'exitportal') {
      await reply(sock, chat, message, `No puedes salir en medio de esto. Resuelve lo que tienes pendiente primero.`)
      return
    }
    state.active = false
    let text = state.pending === 'exitportal'
      ? `🌀 Cruzas el portal de salida con tu botín a salvo. Sales de la mazmorra sano y salvo.`
      : `🌀 Invocas un portal de salida y cruzas hacia la superficie con lo que llevas.`
    text = mineFinishStep(state, senderJid, text, true)
    queueEconomySave()
    await reply(sock, chat, message, text)
    return
  }

  if (command === 'romper') {
    const senderJid = jidNormalizedUser(sender || '')
    const state = getMineState(senderJid)
    if (!mineStructureActive()) {
      await reply(sock, chat, message, `No hay ninguna Estructura Extraña que romper ahora mismo.`)
      return
    }
    if (!state.active) {
      await reply(sock, chat, message, `🗿 La Estructura Extraña está dentro de la mazmorra. Entra con *${PREFIX}mazmorra* para poder acercarte.`)
      return
    }
    if (state.pending !== 'direction') {
      await reply(sock, chat, message, `No puedes acercarte a la estructura en medio de esto. Resuelve lo que tienes pendiente primero.`)
      return
    }
    const keys = mineStructureKeys(senderJid)
    if (keys < MINE_STRUCTURE_KEYS_NEEDED) {
      await reply(sock, chat, message, `🗿 Las puertas de la Estructura Extraña siguen selladas. Necesitas *${MINE_STRUCTURE_KEYS_NEEDED} llaves* para abrirlas y solo tienes *${keys}/${MINE_STRUCTURE_KEYS_NEEDED}*.\nSigue explorando: cada paso tiene 1% de dejarte una llave al alcance.`)
      return
    }
    const victims = mineDestroyStructure(senderJid)
    const account = getAccount(senderJid)
    account.wallet += MINE_STRUCTURE_REWARD_COINS
    economyState.xp[senderJid] = (economyState.xp[senderJid] || 0) + MINE_STRUCTURE_REWARD_XP
    state.structureImmuneUntil = Date.now() + MINE_STRUCTURE_IMMUNITY_MS
    state.active = false
    let text = `🗝️💥🗿 ¡Giras las 3 llaves y las puertas de la Estructura Extraña se abren de par en par! El lugar entero se sacude y la estructura se desmorona hasta convertirse en polvo.\n\n🌀 Los portales vuelven a la normalidad y una luz te arrastra fuera de la mazmorra con tu botín.\n\n🎁 *Recompensa:* +${formatCurrency(MINE_STRUCTURE_REWARD_COINS)} y +${MINE_STRUCTURE_REWARD_XP.toLocaleString('es-MX')} XP\n🛡️ Ganas *inmunidad de 3 días* contra la Estructura Extraña.`
    text = mineFinishStep(state, senderJid, text, true)
    if (victims.length) {
      text += `\n\n☠️ Al derrumbarse la estructura, los ${victims.length} explorador(es) que seguían dentro fueron expulsados de la mazmorra, murieron y perdieron todo su botín y sus objetos: ${victims.map(targetTag).join(', ')}`
    }
    queueEconomySave()
    await reply(sock, chat, message, text, [senderJid, ...victims])
    return
  }

  if (command === 'si' || command === 'no') {
    const senderJid = jidNormalizedUser(sender || '')
    const state = getMineState(senderJid)
    if (!state.active || state.pending !== 'floorcheckpoint') {
      await reply(sock, chat, message, `No tienes ninguna pregunta de checkpoint pendiente ahora mismo.`)
      return
    }
    const junctionText = `Frente a ti se abren ${mineJunctionDescription()}.`
    let text
    if (command === 'si') {
      state.checkpointFloor = Math.max(state.checkpointFloor || 0, state.currentFloor || 1)
      mineSaveCheckpointSnapshot(state, state.currentFloor || 1)
      text = `📍 Guardas el *Piso ${state.currentFloor || 1}* como tu checkpoint.\n\n${junctionText}`
    } else {
      text = `🚶 Sigues explorando sin guardar checkpoint.\n\n${junctionText}`
    }
    state.pending = 'direction'
    text = mineFinishStep(state, senderJid, text, false)
    queueEconomySave()
    await reply(sock, chat, message, text)
    return
  }

  if (command === 'rojo' || command === 'negro') {
    const senderJid = jidNormalizedUser(sender || '')
    const state = getMineState(senderJid)
    if (!state.active || state.pending !== 'jaula') {
      await reply(sock, chat, message, `No tienes ninguna jaula de la que escapar ahora mismo.`)
      return
    }
    const account = getAccount(senderJid)
    const playerColor = command
    const ballColor = Math.random() < 0.35 ? playerColor : (playerColor === 'rojo' ? 'negro' : 'rojo')
    let text
    if (ballColor === playerColor) {
      const won = account.wallet
      account.wallet += won
      mineTakeDamage(state, 0.01)
      text = `🎡 La bola cae en *${ballColor}*... ¡GANASTE! El monstruo, furioso, te libera pero te araña de rabia al soltarte.\n💰 Tu dinero se duplica: +${formatCurrency(won)}\n💔 Pierdes 1% de tu vida.`
    } else {
      const lost = account.wallet
      account.wallet = 0
      text = `🎡 La bola cae en *${ballColor}*... perdiste. El monstruo se queda con todo tu dinero y te suelta con una risa burlona.\n💸 -${formatCurrency(lost)}`
    }
    state.pending = 'direction'
    text = mineFinishStep(state, senderJid, text, false)
    queueEconomySave()
    await reply(sock, chat, message, text)
    return
  }

  if (command === 'adelante' || command === 'avanzar' || command === 'izquierda' || command === 'derecha') {
    const senderJid = jidNormalizedUser(sender || '')
    const state = getMineState(senderJid)
    if (!state.active || state.pending !== 'direction') {
      await reply(sock, chat, message, `No estás explorando ninguna mazmorra ahora mismo. Usa *${PREFIX}mazmorra* para entrar.`)
      return
    }
        state.depth += 1
    state.floorSteps = (state.floorSteps || 0) + 1
    const currentFloor = state.currentFloor || 1
    const shieldActive = (state.arcaneShield || 0) > 0
    if (shieldActive) state.arcaneShield -= 1
    const stoneWallActive = (state.stoneWall || 0) > 0
    if (stoneWallActive) state.stoneWall -= 1
    const shadowCloakActive = (state.shadowCloak || 0) > 0
    if (shadowCloakActive) state.shadowCloak -= 1
    const staticVisionActive = !!state.staticVision
    state.staticVision = false
    const dangerMult = mineDepthDangerMult(currentFloor) * (shieldActive ? 0.5 : 1)
    const lootMult = mineDepthLootMult(currentFloor)
    const floorAnnounce = ''
    const stairsEligible = state.floorSteps >= MINE_STAIRS_MIN_STEPS && currentFloor < MINE_MAX_FLOOR
    const stairsW = stairsEligible ? Math.min(15 + (state.floorSteps - MINE_STAIRS_MIN_STEPS) * 3, 50) : 0
    const exitW = Math.min(5 + currentFloor * 5, 45) + (staticVisionActive ? 10 : 0)
    const trapW = stoneWallActive ? 0 : Math.round(10 * dangerMult)
    const treasureW = 14
    const itemW = 8
    const toolW = 6
    const monsterW = shadowCloakActive ? 0 : Math.round(10 * dangerMult)
    const veinW = 10
    const climbW = 8
    const swimW = 8
    const caveInW = stoneWallActive ? 0 : Math.round(2 * dangerMult)
    const checkpointW = 8
    const merchantW = 6
    const portalW = 3
    const trapFalsoW = 3
    const emptyTunnelW = 6
    const collapseTunnelW = 4
    const cageW = 5
    const holeW = stoneWallActive ? 0 : Math.round(0.5 * dangerMult)
    const weirdW = Math.round(3 * (isGlobalEventActive() ? 1.15 : 1))
    const manaFountainW = 5
    const echoW = 4
    const libraryW = 4
    const prisonerW = 5
    const continueW = Math.max(8, 100 - stairsW - exitW - trapW - treasureW - itemW - toolW - monsterW - veinW - climbW - swimW - caveInW - checkpointW - merchantW - portalW - holeW - weirdW - manaFountainW - echoW - libraryW - prisonerW - emptyTunnelW - collapseTunnelW - cageW)
    const totalW = stairsW + exitW + trapW + treasureW + itemW + toolW + monsterW + veinW + climbW + swimW + caveInW + checkpointW + merchantW + portalW + holeW + weirdW + manaFountainW + echoW + libraryW + prisonerW + emptyTunnelW + collapseTunnelW + cageW + continueW
    const roll = Math.random() * totalW
    let text = ''
    let ended = false
    let cursor = 0
    let structureSpawned = false
    if (!mineStructureActive() && Math.random() < MINE_STRUCTURE_CHANCE) {
      structureSpawned = true
      mineSpawnStructure()
    }
    let keyFound = false
    if (!structureSpawned && mineStructureBlocks(senderJid) && mineStructureKeys(senderJid) < MINE_STRUCTURE_KEYS_NEEDED && Math.random() < MINE_STRUCTURE_KEY_CHANCE) {
      keyFound = true
      state.structureKeys = mineStructureKeys(senderJid) + 1
    }
    if (structureSpawned) {
      text = mineStructureBlocks(senderJid)
        ? `🗿 ¡El suelo tiembla! Una *Estructura Extraña* emerge de la oscuridad y una influencia rara empieza a cambiar los portales de la mazmorra: desde ahora todos son *trampas*.\n\n🔒 Nadie podrá salir hasta que alguien la destruya. Para hacerlo hay que encontrar *3 llaves* que abren sus puertas (cada paso tiene 1% de dejarte una) y usar *${PREFIX}romper*.\n💀 Si mueres, reapareces en tu último checkpoint pero pierdes todo el dinero y el botín que habías ganado.`
        : `🗿 ¡El suelo tiembla! Una *Estructura Extraña* emerge y convierte los portales de la mazmorra en trampas, pero tu inmunidad te protege: puedes salir con normalidad. Los demás exploradores quedan atrapados hasta que alguien encuentre 3 llaves y la destruya con *${PREFIX}romper*.`
    } else if (keyFound) {
      const keysNow = mineStructureKeys(senderJid)
      text = `🗝️ Entre los escombros brilla una llave de hierro negro grabada con runas: es una de las llaves de las puertas de la Estructura Extraña. (*${keysNow}/${MINE_STRUCTURE_KEYS_NEEDED}*)` + (keysNow >= MINE_STRUCTURE_KEYS_NEEDED
        ? `\n\n🔓 ¡Tienes las 3 llaves! Usa *${PREFIX}romper* para abrir las puertas de la estructura y destruirla.`
        : `\nTe faltan ${MINE_STRUCTURE_KEYS_NEEDED - keysNow} llave(s). Sigue explorando.`)
    } else if (roll < (cursor += stairsW)) {
      const nextFloor = currentFloor + 1
      state.currentFloor = nextFloor
      state.floorSteps = 0
    state.bossPortalShown = false
      if (isMineBossFloor(nextFloor)) {
        state.pending = 'monster'
        state.battleAt = Date.now()
        state.pvpTarget = null
        let rootsHealText = ''
        if (state.rootsPending) {
          state.rootsPending = false
          mineHeal(state, 0.2)
          rootsHealText = ` Tus raíces profundas te curan 20% de vida antes del combate.`
        }
        text = `🪜 Encuentras unas escaleras y bajas al *Piso ${nextFloor}*...${rootsHealText} 👑 ¡El *Jefe del Piso ${nextFloor}* (nivel ${mineBossIndex(nextFloor)}) te esperaba ahí! Tienes *10 segundos* para decidir.\n\nUsa *${PREFIX}atacar* (arriesgado, si ganas te quedas con su botín), *${PREFIX}saltar* (esquivas, chance de contraataque) o *${PREFIX}huir* (seguro, no ganas nada). También puedes usar tu *${PREFIX}magia*.`
      } else {
        state.pending = 'floorcheckpoint'
        text = `🪜 Encuentras unas escaleras de piedra y bajas al *Piso ${nextFloor}*.\n\n¿Quieres guardar este piso como tu checkpoint? Usa *${PREFIX}si* o *${PREFIX}no*.`
      }
    } else if (roll < (cursor += exitW)) {
      const exitSealed = mineStructureBlocks(senderJid)
      if (!exitSealed) state.pending = 'exitportal'
      text = exitSealed ? mineStructureTrapPortal(state, 'exit', senderJid) : `🌀 ¡Un portal de salida se abre entre las rocas! Tienes tu botín a salvo si decides cruzarlo ahora.\n\n¿Quieres salir?\nUsa *${PREFIX}salir* (sí, salir con tu botín) o *${PREFIX}seguir* (no, seguir explorando).`
          } else if (roll < (cursor += trapFalsoW)) {
        if (mineStructureBlocks(senderJid)) {
          text = mineStructureTrapPortal(state, 'fake', senderJid)
        } else {
          state.hp = Math.max(0, mineCurrentHp(state) - 1)
          text = `🌀 Un portal parpadea débil entre las sombras... pero es una ilusión. Al tocarlo sientes una descarga fría que te roba solo un poco de vida (-1) antes de desvanecerse en el aire.`
        }
      } else if (roll < (cursor += trapW)) {
      state.pending = 'trap'
      state.battleAt = Date.now()
      text = `🕳️ ¡Pisas una tabla podrida y activas una trampa oculta! Tienes *10 segundos* para decidir.\n\nUsa *${PREFIX}desarmar* (arriesgado, si tienes éxito evitas el daño por completo) o *${PREFIX}esquivar* (más seguro, buena probabilidad de librarte).`
    } else if (roll < (cursor += treasureW)) {
      state.pending = 'treasure'
      const chestSpots = ['escondido entre columnas derrumbadas', 'oculto bajo un montón de escombros', 'al fondo de una cripta olvidada', 'sobre un altar de piedra agrietado', 'medio enterrado junto a un esqueleto']
      const chestSpot = chestSpots[Math.floor(Math.random() * chestSpots.length)]
      text = `🗝️ Encuentras un cofre antiguo sellado con runas, ${chestSpot}.\n\n¿Qué haces?\nUsa *${PREFIX}guardar* (lo guardas cerrado y sigues), *${PREFIX}abrir* (lo abres ahora mismo) o *${PREFIX}seguir* (lo dejas y avanzas).`
    } else if (roll < (cursor += itemW)) {
      const item = MINE_ITEMS[Math.floor(Math.random() * MINE_ITEMS.length)]
      state.items.push(item)
      text = `✨ Entre los escombros encuentras ${item}.`
    } else if (roll < (cursor += toolW)) {
      if (Math.random() < 0.4) {
        const inv = getInventory(senderJid)
        if (inv.owned.includes('cuerda')) {
          text = `🪢 Encuentras una cuerda resistente, pero ya tienes una en tu mochila.`
        } else {
          inv.owned.push('cuerda')
          text = `🪢 ¡Encuentras una cuerda resistente! Te ayudará a escalar con más seguridad. Se guardó en tu mochila (${PREFIX}inventario).`
        }
      } else {
        const r2 = Math.random()
        const foundTier = r2 < 0.7 ? 1 : r2 < 0.95 ? 2 : 3
        if (foundTier > pickaxeTier(senderJid)) {
          givePickaxe(senderJid, foundTier)
          text = `🛠️ ¡Encuentras ${pickaxeName(foundTier)}! Mejor que lo que tenías. Se guardó en tu mochila (${PREFIX}inventario).`
        } else {
          text = `🛠️ Encuentras ${pickaxeName(foundTier)}, pero ya tienes algo mejor. Lo dejas ahí.`
        }
      }
    } else if (roll < (cursor += monsterW)) {
      state.pending = 'monster'
      state.battleAt = Date.now()
      const pvpBotJid = jidNormalizedUser(sock.user?.id || '')
      const pvpCandidates = Object.keys(economyState.mine).filter(j => j !== senderJid && j !== pvpBotJid && (economyState.mine[j].checkpointFloor || 0) >= 5)
      if (currentFloor >= 5 && pvpCandidates.length && Math.random() < 0.12) {
        const pvpTargetJid = pvpCandidates[Math.floor(Math.random() * pvpCandidates.length)]
        state.pvpTarget = pvpTargetJid
        text = `⚔️ ¡Te cruzas con otro explorador real! Es ${targetTag(pvpTargetJid)}.\n\n⚠️ *Aviso:* esto es un encuentro *PVP* contra su poder actual, no un monstruo normal.\n\nTienes *10 segundos* para decidir.\n\nUsa *${PREFIX}atacar* (arriesgado, si ganas te quedas con parte de su botín) o *${PREFIX}huir* (seguro, pero no ganas nada), o usa tu *${PREFIX}magia* si tienes.`
      } else {
        state.pvpTarget = null
        const monsterName = randomMineMonsterName(currentFloor)
        const monsterNameCap = monsterName.charAt(0).toUpperCase() + monsterName.slice(1)
        text = `🧟 ¡${monsterNameCap} va a atacar! Tienes *10 segundos* para decidir.\n\nUsa *${PREFIX}atacar* (arriesgado, si ganas te quedas con su botín) o *${PREFIX}huir* (seguro, pero no ganas nada), o usa tu *${PREFIX}magia* si tienes.`
      }
} else if (roll < (cursor += veinW)) {
      const tier = pickaxeTier(senderJid)
      if (tier <= 0) {
        text = `⛏️ Ves una grieta con gemas brillando en la pared, pero no tienes ninguna herramienta para extraerla. Sigues explorando.`
      } else if (tier >= 4 && Math.random() < 0.00002) {
        state.loot += 10000
        text = `⛏️✨ ¡Un brillo azulado entre las rocas! Con tu Pico de Estelita extraes una veta pura de *Coltán*, un mineral extremadamente raro y valioso.\n💰 +${formatCurrency(10000)}`
      } else {
        const value = Math.round(randomBetween(100, 300) * tier * mineDepthLootMult(state.currentFloor || 1))
        state.loot += value
        text = `⛏️ Con ${pickaxeName(tier)} logras extraer las gemas de la grieta.\n💰 +${formatCurrency(value)}`
      }
    } else if (roll < (cursor += climbW)) {
      const hasRope = getInventory(senderJid).owned.includes('cuerda')
      if (hasRope) {
        text = `🧗 Escalas una pared rocosa con ayuda de tu cuerda. Llegas arriba sin problema.`
      } else if (Math.random() < 0.2) {
        mineTakeDamage(state, 0.15)
        text = `🧗 Intentas escalar una pared rocosa sin equipo... resbalas y caes.\n💔 Pierdes 15% de tu vida.`
      } else {
        text = `🧗 Escalas con cuidado, sin cuerda, pero logras subir sin problemas.`
      }
    } else if (roll < (cursor += swimW)) {
      const swimSpots = ['un túnel inundado', 'una laguna subterránea', 'un canal de agua estancada', 'una cámara medio sumergida']
      const swimSpot = swimSpots[Math.floor(Math.random() * swimSpots.length)]
      if (Math.random() < 0.25) {
        mineTakeDamage(state, 0.15)
        text = `🌊 Cruzas nadando ${swimSpot}... la corriente te arrastra y casi te ahogas.\n💔 Pierdes 15% de tu vida.`
      } else {
        text = `🌊 Nadas por ${swimSpot} y llegas al otro lado empapado pero bien.`
      }
    } else if (roll < (cursor += caveInW)) {
      mineTakeDamage(state, 0.15)
      const lostCaveIn = Math.floor(state.loot * 0.3)
      state.loot -= lostCaveIn
      const caveInFlavors = ['¡El techo se derrumba de repente!', '¡El suelo cede bajo tus pies y una grieta se abre!', '¡Una columna de piedra se rompe y cae junto a ti!', '¡Un temblor sacude el pasillo y llueven escombros!']
      const caveInFlavor = caveInFlavors[Math.floor(Math.random() * caveInFlavors.length)]
      text = `🪨 ${caveInFlavor} Alcanzas a cubrirte, pero te golpean algunas rocas.\n💔 Pierdes 15% de tu vida.${lostCaveIn > 0 ? ` Se te cayó ${formatCurrency(lostCaveIn)} entre los escombros.` : ''}`
    } else if (roll < (cursor += checkpointW)) {
      if (mineLivesLeft(senderJid) >= (state.maxHp || MINE_MAX_LIVES)) {
        text = `🕯️ Encuentras un santuario olvidado, pero ya tienes tu vida al máximo. Sigues explorando.`
      } else {
        state.pending = 'checkpoint'
        text = `🕯️ Encuentras un santuario olvidado con un botiquín improvisado entre las velas apagadas.\n\n¿Qué haces?\nUsa *${PREFIX}curar* (intento gratis, 50% de que funcione), *${PREFIX}comprarvida* (paga ${formatCurrency(1800)} y te curas seguro) o *${PREFIX}seguir* (sigues sin curarte).`
      }
    } else if (roll < (cursor += merchantW)) {
      state.pending = 'merchant'
      state.merchantRareStock = Math.random() < 0.00002
      text = `🧙 ¡Encuentras a un comerciante perdido! Abre una pequeña tienda para ti.\n\n🛒 *TIENDA DEL COMERCIANTE*\n1️⃣ ❤️ Vida — ${formatCurrency(1400)}\n2️⃣ 🪓 Pico de madera — ${formatCurrency(1300)}\n3️⃣ ⚔️ Espada (evita perder vida en tu próxima pelea, 1 uso) — ${formatCurrency(1800)}\n4️⃣ 🔮 Poción de maná (+100 maná) — ${formatCurrency(1300)}\n5️⃣ 💪 Poción de fuerza (+cargas de daño extra) — ${formatCurrency(1500)}\n6️⃣ ⚔️ Espada arcana (reduce el costo de tu magia) — ${formatCurrency(4000)}\n7️⃣ ⚔️ Espada alquimista (potencia tus pociones) — ${formatCurrency(4000)}\n8️⃣ 🧪 Poción de resistencia (reduce a la mitad los próximos 3 golpes que recibas) — ${formatCurrency(1600)}${state.merchantRareStock ? `\n9️⃣ ⛏️✨ *Pico de Estelita* (el único capaz de extraer Coltán) — ${formatCurrency(10000)}` : ''}\n\nUsa *${PREFIX}comerciar 1* al *${state.merchantRareStock ? 9 : 8}* para comprar, o *${PREFIX}seguir* para irte.`
    } else if (roll < (cursor += portalW)) {
      const portalSealed = mineStructureBlocks(senderJid)
      if (!portalSealed) state.pending = 'portal'
      text = portalSealed ? mineStructureTrapPortal(state, 'dormant', senderJid) : `🌀 Encuentras un portal apagado, cubierto de polvo y musgo. Podrías repararlo por ${formatCurrency(1000)} y ver a dónde lleva...\n\n¿Qué haces?\nUsa *${PREFIX}repararportal* (cuesta ${formatCurrency(1000)}, tardas 1 hora en volver) o *${PREFIX}seguir* (lo dejas y avanzas).`
    } else if (roll < (cursor += holeW)) {
      mineTakeDamage(state, 0.15)
      const lost = Math.floor(state.loot * 0.5)
      state.loot -= lost
      text = `🕳️💥 ¡El piso cede bajo tus pies! Caes por un hoyo profundo y sales disparado fuera de la mazmorra.\n💔 Pierdes 15% de tu vida.${lost > 0 ? ` Se te cayó ${formatCurrency(lost)} en la caída.` : ''}`
      if (mineStructureBlocks(senderJid)) {
        text = text.replace('y sales disparado fuera de la mazmorra', 'pero la Estructura Extraña te atrapa y te devuelve al interior de la mazmorra')
      } else {
        state.active = false
        ended = true
      }
    } else if (roll < (cursor += weirdW)) {
      const bonus = Math.round(randomBetween(100, 600) * mineDepthLootMult(state.currentFloor || 1))
      state.loot += bonus
      text = `👁️ Algo extraño sucede: una estatua brilla en la oscuridad por un instante y desaparece. Sientes que te trajo suerte.\n💰 +${formatCurrency(bonus)}`
    } else if (roll < (cursor += emptyTunnelW)) {
      text = `🕳️ Avanzas por un túnel completamente vacío. No hay nada aquí más que piedra y silencio. Sigues explorando.`
    } else if (roll < (cursor += collapseTunnelW)) {
      text = `🪨 De repente escuchas un crujido ensordecedor... ¡las paredes y el techo se cierran a tu alrededor! Por un instante crees que quedarás atrapado para siempre, pero encuentras un hueco estrecho por donde escapar justo a tiempo. Sigues explorando, agitado.`
    } else if (roll < (cursor += cageW)) {
      const cageAccount = getAccount(senderJid)
      if (cageAccount.wallet <= 0) {
        mineTakeDamage(state, 0.05)
        text = `🕸️ ¡Caes en una trampa! Una jaula se cierra de golpe a tu alrededor y un monstruo aparece exigiendo dinero para jugar "doble o nada"... pero no tienes nada que apostar. Furioso, te ataca.\n💔 Pierdes 5% de tu vida.`
      } else {
        state.pending = 'jaula'
        text = `🕸️ ¡Caes en una trampa! Una jaula se cierra de golpe a tu alrededor. Un monstruo te obliga a jugar "doble o nada" con tu dinero en su ruleta trucada.\n\nElige un color: *${PREFIX}rojo* o *${PREFIX}negro*. Si aciertas el color de la bola, tu dinero se duplica (pero pierdes 1% de tu vida, venganza del monstruo por perder). Si fallas, pierdes todo tu dinero del monedero.`
      }
    } else if (roll < (cursor += manaFountainW)) {
      const gain = Math.min((state.maxMana || MINE_MAX_MANA) - getMineMana(state), 50)
      state.mana = getMineMana(state) + gain
      text = `🔮 Encuentras una pequeña fuente de maná burbujeante y bebes de ella.\n✨ +${gain} maná (${state.mana}/${state.maxMana || MINE_MAX_MANA}).`
    } else if (roll < (cursor += echoW)) {
      state.staticVision = true
      text = `👂 Escuchas un eco misterioso que parece guiarte por el camino correcto. Sientes que tu próximo paso será más seguro.`
    } else if (roll < (cursor += libraryW)) {
      const xpGain = randomBetween(20, 80)
      economyState.xp[senderJid] = (economyState.xp[senderJid] || 0) + xpGain
      text = `📖 Encuentras una biblioteca en ruinas y alcanzas a leer unas páginas antes de que se deshagan.\n✨ +${xpGain} XP.`
    } else if (roll < (cursor += prisonerW)) {
      state.pending = 'prisoner'
      state.battleAt = Date.now()
      text = `⛓️ Encuentras a un prisionero encadenado en una celda oxidada. Te mira en silencio. Tienes *10 segundos* para decidir.\n\nUsa *${PREFIX}liberar* (arriesgado, puede recompensarte o atacarte) o *${PREFIX}ignorar* (seguro, sigues de largo).`
    } else {
      text = `⛏️ Avanzas por un túnel largo y silencioso...`
    }
    if (!ended && state.pending !== 'treasure' && state.pending !== 'monster' && state.pending !== 'trap' && state.pending !== 'prisoner' && state.pending !== 'checkpoint' && state.pending !== 'merchant' && state.pending !== 'portal' && state.pending !== 'exitportal' && state.pending !== 'floorcheckpoint' && state.pending !== 'jaula') state.pending = 'direction'
    text = mineFinishStep(state, senderJid, floorAnnounce + text, ended)
    queueEconomySave()
    await reply(sock, chat, message, text)
    return
  }

  if (command === 'guardar' || command === 'abrir' || command === 'seguir' || command === 'pelear' || command === 'atacar' || command === 'saltar' || command === 'huir' || command === 'desarmar' || command === 'esquivar' || command === 'liberar' || command === 'ignorar' || command === 'curar' || command === 'comprarvida' || command === 'comerciar' || command === 'repararportal') {
    const senderJid = jidNormalizedUser(sender || '')
    const state = getMineState(senderJid)
    let expectedPending
    if (command === 'guardar' || command === 'abrir') expectedPending = 'treasure'
    else if (command === 'pelear' || command === 'atacar' || command === 'saltar' || command === 'huir') expectedPending = 'monster'
    else if (command === 'desarmar' || command === 'esquivar') expectedPending = 'trap'
    else if (command === 'liberar' || command === 'ignorar') expectedPending = 'prisoner'
    else if (command === 'curar' || command === 'comprarvida') expectedPending = 'checkpoint'
    else if (command === 'comerciar') expectedPending = 'merchant'
    else if (command === 'repararportal') expectedPending = 'portal'
    else expectedPending = state.pending
    if (!state.active || !expectedPending || state.pending !== expectedPending) {
      await reply(sock, chat, message, `No tienes nada pendiente en la mazmorra ahora mismo. Usa *${PREFIX}mazmorra* para explorar.`)
      return
    }
    const account = getAccount(senderJid)
    let text = ''
    let forceEnd = false
    if (expectedPending === 'monster' && Date.now() - (state.battleAt || 0) > 10000) {
      if (state.stoneSkin) {
        state.stoneSkin = false
        text = `🪨 Tardaste demasiado y el enemigo ataca primero, pero tu piel pétrea absorbe el golpe. No pierdes vida.`
      } else {
        const vidaSaveChance = Math.min(0.5, mineVidaStat(getInventory(senderJid)) / 40000)
        if (Math.random() < vidaSaveChance) {
          text = `⏱️ Tardaste demasiado en decidir... el enemigo ataca primero, pero tu vitalidad te salva de perder una vida.`
        } else {
          mineTakeDamage(state, 0.15)
          text = `⏱️ Tardaste demasiado en decidir... el enemigo ataca primero.\n💔 Pierdes 15% de tu vida.`
        }
      }
      state.pending = 'direction'
      text = mineFinishStep(state, senderJid, text, false)
      queueEconomySave()
      await reply(sock, chat, message, text)
      return
    }
    if (expectedPending === 'trap' && Date.now() - (state.battleAt || 0) > 10000) {
      if (state.stoneSkin) {
        state.stoneSkin = false
        text = `🪨 Dudas demasiado y la trampa se activa, pero tu piel pétrea absorbe el golpe. No pierdes vida.`
      } else {
        const vidaSaveChance = Math.min(0.5, mineVidaStat(getInventory(senderJid)) / 40000)
        if (Math.random() < vidaSaveChance) {
          text = `⏱️ Dudas demasiado y la trampa se activa, pero tu vitalidad te salva de perder una vida.`
        } else {
          mineTakeDamage(state, 0.15)
          text = `⏱️ Dudas demasiado y la trampa se activa.\n💔 Pierdes 15% de tu vida.`
        }
      }
      state.pending = 'direction'
      text = mineFinishStep(state, senderJid, text, false)
      queueEconomySave()
      await reply(sock, chat, message, text)
      return
    }
if (expectedPending === 'prisoner' && Date.now() - (state.battleAt || 0) > 10000) {
      text = `⛓️ Dudas demasiado y unos guardias arrastran al prisionero lejos. Sigues explorando.`
      state.pending = 'direction'
      text = mineFinishStep(state, senderJid, text, false)
      queueEconomySave()
      await reply(sock, chat, message, text)
      return
    }
if (command === 'comerciar') {
      const choice = commandContent.trim()
      let purchaseText = ''
      if (choice === '1') {
        const cost = 1400
        if (mineLivesLeft(senderJid) >= (state.maxHp || MINE_MAX_LIVES)) purchaseText = `Ya tienes tu vida al máximo.`
        else if (account.wallet < cost) purchaseText = `⚠️ No te alcanza (necesitas ${formatCurrency(cost)}).`
        else { account.wallet -= cost; mineHeal(state, 0.2); purchaseText = `❤️ Compras 20% de vida por ${formatCurrency(cost)}.` }
      } else if (choice === '2') {
        const cost = 1300
        if (pickaxeTier(senderJid) >= 1) purchaseText = `Ya tienes un pico igual o mejor.`
        else if (account.wallet < cost) purchaseText = `⚠️ No te alcanza (necesitas ${formatCurrency(cost)}).`
        else { account.wallet -= cost; givePickaxe(senderJid, 1); purchaseText = `🪓 Compras un pico de madera por ${formatCurrency(cost)}.` }
      } else if (choice === '3') {
        const cost = 1800
        if (account.wallet < cost) purchaseText = `⚠️ No te alcanza (necesitas ${formatCurrency(cost)}).`
        else { account.wallet -= cost; getInventory(senderJid).owned.push('espada_normal'); purchaseText = `⚔️ Compras una espada por ${formatCurrency(cost)}.` }
      } else if (choice === '4') {
        const cost = 1300
        if (account.wallet < cost) purchaseText = `⚠️ No te alcanza (necesitas ${formatCurrency(cost)}).`
        else { account.wallet -= cost; const manaGain = getInventory(senderJid).equippedSword === 'espada_alquimista' ? 150 : 100; state.mana = Math.min((state.maxMana || MINE_MAX_MANA), getMineMana(state) + manaGain); purchaseText = `🔮 Compras una poción de recarga de maná por ${formatCurrency(cost)}. Maná: ${state.mana}/${state.maxMana || MINE_MAX_MANA}.` }
      } else if (choice === '5') {
        const cost = 1500
        if (account.wallet < cost) purchaseText = `⚠️ No te alcanza (necesitas ${formatCurrency(cost)}).`
        else {
          account.wallet -= cost
          const alquimista = getInventory(senderJid).equippedSword === 'espada_alquimista'
          state.strengthCharges = (state.strengthCharges || 0) + (alquimista ? 5 : 3)
          purchaseText = `💪 Compras una poción de fuerza por ${formatCurrency(cost)}. Cargas de fuerza: ${state.strengthCharges}.`
        }
      } else if (choice === '6' || choice === '7') {
        const swordId = choice === '6' ? 'espada_arcana' : 'espada_alquimista'
        const swordName = choice === '6' ? 'espada arcana' : 'espada alquimista'
        const cost = 4000
        const inv = getInventory(senderJid)
        const swordCount = inv.owned.filter(it => it === 'espada_arcana' || it === 'espada_alquimista').length
        if (swordCount >= 4) purchaseText = `⚔️ Ya tienes el máximo de espadas mágicas (4). Revisa *${PREFIX}inventario*.`
        else if (account.wallet < cost) purchaseText = `⚠️ No te alcanza (necesitas ${formatCurrency(cost)}).`
        else { account.wallet -= cost; inv.owned.push(swordId); purchaseText = `⚔️ Compras una ${swordName} por ${formatCurrency(cost)}. Equípala desde *${PREFIX}inventario*.` }
      } else if (choice === '8') {
        const cost = 1600
        if (account.wallet < cost) purchaseText = `⚠️ No te alcanza (necesitas ${formatCurrency(cost)}).`
        else { account.wallet -= cost; state.resistanceCharges = (state.resistanceCharges || 0) + 3; purchaseText = `🧪 Compras una poción de resistencia por ${formatCurrency(cost)}. Los próximos 3 golpes que recibas harán la mitad de daño.` }
      } else if (choice === '9') {
        if (!state.merchantRareStock) {
          purchaseText = `Usa *${PREFIX}comerciar 1* al *${state.merchantRareStock ? 9 : 8}* para comprar, o *${PREFIX}seguir* para irte.`
        } else {
          const cost = 10000
          if (pickaxeTier(senderJid) >= 4) purchaseText = `Ya tienes un pico igual o mejor.`
          else if (account.wallet < cost) purchaseText = `⚠️ No te alcanza (necesitas ${formatCurrency(cost)}).`
          else { account.wallet -= cost; givePickaxe(senderJid, 4); purchaseText = `⛏️✨ Compras el Pico de Estelita por ${formatCurrency(cost)}. Ahora puedes extraer Coltán de las vetas raras.` }
        }
      } else {
        purchaseText = `Usa *${PREFIX}comerciar 1* al *${state.merchantRareStock ? 9 : 8}* para comprar, o *${PREFIX}seguir* para irte.`
      }
      queueEconomySave()
      await reply(sock, chat, message, `${purchaseText}\n\n🛒 Sigue comprando con *${PREFIX}comerciar 1/2/3* o vete con *${PREFIX}seguir*.\nMonedero: ${formatCurrency(account.wallet)}`)
      return
    }
    if (command === 'guardar') {
      state.items.push('un cofre cerrado')
      const guardarInv = getInventory(senderJid)
      guardarInv.owned.push('cofre_cerrado')
      logger.info({ senderJid, ownedAfterPush: guardarInv.owned, sameRef: guardarInv === economyState.inventory[senderJid] }, 'DEBUG guardar cofre')
      text = `🔒 Guardas el cofre sellado en tu mochila sin romper el sello y sigues explorando.`
    } else if (command === 'seguir') {
      text = state.pending === 'checkpoint'
        ? `🚶 Sigues tu camino sin curarte.`
        : state.pending === 'merchant'
          ? `🚶 Te despides del comerciante y sigues explorando.`
          : state.pending === 'portal'
            ? `🚶 Dejas el portal apagado y sigues explorando.`
            : state.pending === 'exitportal'
              ? `🚶 Decides no cruzar el portal de salida todavía y sigues explorando la mazmorra.`
              : `🚶 Dejas el cofre antiguo atrás y sigues explorando.`
    } else if (command === 'abrir') {
      const good = Math.random() < 0.7
      if (good) {
        const amount = Math.round(randomBetween(200, 2500) * mineDepthLootMult(state.currentFloor || 1))
        state.loot += amount
        text = `🎉 Rompes el sello rúnico del cofre... ¡tiene ${formatCurrency(amount)} adentro!`
      } else {
        mineTakeDamage(state, 0.15)
        text = `💥 Rompes el sello y el cofre resulta ser una trampa arcana. Te lastimas.\n💔 Pierdes 15% de tu vida.`
      }
      if (!economyState.mineMiracleUsed) {
        economyState.mineMiracleUsed = true
        for (const jid of Object.keys(economyState.mine)) economyState.mine[jid].hp = economyState.mine[jid].maxHp || MINE_MAX_HP
        for (const jid of Object.keys(economyState.explore)) economyState.explore[jid].livesLostAt = []
        text += `\n\n✨🙏 *¡HUBO UN MILAGRO!* Dentro del cofre sellado encontraste al dios de la esperanza... y decide bendecir a todo el grupo. ¡Todos en la mazmorra recuperan su vida al máximo!`
      }
    } else if (command === 'huir') {
      text = `🏃 Escapas del monstruo sin problema. Sigues explorando.`
    } else if (command === 'desarmar') {
      const successChance = 0.4 + pickaxeTier(senderJid) * 0.1
      if (Math.random() < successChance) {
        text = `🔧 Logras desarmar la trampa a tiempo. No sufres ningún daño.`
      } else if (state.stoneSkin) {
        state.stoneSkin = false
        text = `🔧 La trampa se activa antes de que puedas desarmarla, pero tu piel pétrea absorbe el golpe. No pierdes vida.`
      } else {
        const vidaSaveChance = Math.min(0.5, mineVidaStat(getInventory(senderJid)) / 40000)
        if (Math.random() < vidaSaveChance) {
          text = `🔧 La trampa se activa antes de que puedas desarmarla, pero tu vitalidad te salva de perder una vida.`
        } else {
          mineTakeDamage(state, 0.15)
          text = `🔧 La trampa se activa antes de que puedas desarmarla.\n💔 Pierdes 15% de tu vida.`
        }
      }
    } else if (command === 'esquivar') {
      if (Math.random() < 0.65) {
        text = `🤸 Te apartas justo a tiempo y evitas la trampa por completo.`
      } else if (state.stoneSkin) {
        state.stoneSkin = false
        text = `🤸 No logras esquivar del todo, pero tu piel pétrea absorbe el golpe. No pierdes vida.`
      } else {
        const vidaSaveChance = Math.min(0.5, mineVidaStat(getInventory(senderJid)) / 40000)
        if (Math.random() < vidaSaveChance) {
          text = `🤸 No logras esquivar del todo, pero tu vitalidad te salva de perder una vida.`
        } else {
          mineTakeDamage(state, 0.15)
          text = `🤸 No logras esquivar del todo.\n💔 Pierdes 15% de tu vida.`
        }
      }
    } else if (command === 'ignorar') {
      text = `⛓️ Decides no intervenir y sigues de largo.`
    } else if (command === 'liberar') {
      if (Math.random() < 0.6) {
        const amount = Math.round(randomBetween(300, 2500) * mineDepthLootMult(state.currentFloor || 1))
        state.loot += amount
        text = `⛓️ Rompes las cadenas. El prisionero te agradece y te entrega lo que llevaba escondido antes de desaparecer.\n💰 +${formatCurrency(amount)}`
      } else if (state.stoneSkin) {
        state.stoneSkin = false
        text = `⛓️ ¡Era una trampa! El "prisionero" te ataca, pero tu piel pétrea absorbe el golpe. No pierdes vida.`
      } else {
        const vidaSaveChance = Math.min(0.5, mineVidaStat(getInventory(senderJid)) / 40000)
        if (Math.random() < vidaSaveChance) {
          text = `⛓️ ¡Era una trampa! El "prisionero" te ataca, pero tu vitalidad te salva de perder vida.`
        } else {
          mineTakeDamage(state, 0.15)
          text = `⛓️ ¡Era una trampa! El "prisionero" te ataca.\n💔 Pierdes 15% de tu vida.`
        }
      }
    } else if (command === 'pelear' || command === 'atacar') {
      const swordInv = getInventory(senderJid)
      const swordIdx = swordInv.owned.indexOf('espada_normal')
      if (swordIdx !== -1) {
        swordInv.owned.splice(swordIdx, 1)
        const doubleActive8 = !!state.doubleLootNext
        state.doubleLootNext = false
        let amount = Math.round(randomBetween(300, 3000) * mineDepthLootMult(state.currentFloor || 1) * (isMineBossFloor(state.currentFloor || 1) ? 1 + mineBossIndex(state.currentFloor || 1) * 0.5 : 1) * (doubleActive8 ? 2 : 1))
        if (state.pvpTarget) {
          const targetState8 = getMineState(state.pvpTarget)
          amount = Math.min(amount, Math.round((targetState8.loot || 0) * 0.2))
          targetState8.loot = Math.max(0, (targetState8.loot || 0) - amount)
        }
        state.loot += amount
        const bossXp8 = isMineBossFloor(state.currentFloor || 1) ? grantMineBossXp(senderJid, state.currentFloor || 1) : 0
        const legendary8 = isMineBossFloor(state.currentFloor || 1) ? tryDropMineLegendary(senderJid, state.currentFloor || 1) : false
        text = `⚔️ Usas tu espada y vences al monstruo sin problema.\n💰 +${formatCurrency(amount)}${bossXp8 ? `\n✨ +${bossXp8} XP` : ''}${legendary8 ? `\n\n🌟🌟🌟 ¡¡¡EL JEFE SUELTA UN OBJETO LEGENDARIO!!! 🌟🌟🌟\nRecibes el *Objeto Legendario* — solo 2 personas en todo el servidor lo tendrán jamás.` : ''}`
      } else {
        const playerDano = mineDanoStat(getInventory(senderJid)) + pickaxeTier(senderJid) * 200 + (state.strengthCharges > 0 ? 3000 : 0)
        if (state.strengthCharges > 0) state.strengthCharges -= 1
        const fireBuffActive = !!state.fireBuff
        state.fireBuff = false
        const winChance = Math.max(0.05, Math.min(0.95, playerDano / (playerDano + (state.pvpTarget ? (mineDanoStat(getInventory(state.pvpTarget)) + 200) : mineMonsterPower(state.currentFloor || 1))) + (fireBuffActive ? 0.2 : 0)))
        const win = Math.random() < winChance
        if (win) {
          const doubleActive10 = !!state.doubleLootNext
          state.doubleLootNext = false
          let amount = Math.round(randomBetween(300, 3000) * mineDepthLootMult(state.currentFloor || 1) * (isMineBossFloor(state.currentFloor || 1) ? 1 + mineBossIndex(state.currentFloor || 1) * 0.5 : 1) * (doubleActive10 ? 2 : 1))
          if (state.pvpTarget) {
            const targetState10 = getMineState(state.pvpTarget)
            amount = Math.min(amount, Math.round((targetState10.loot || 0) * 0.2))
            targetState10.loot = Math.max(0, (targetState10.loot || 0) - amount)
          }
          state.loot += amount
          const bossXp10 = isMineBossFloor(state.currentFloor || 1) ? grantMineBossXp(senderJid, state.currentFloor || 1) : 0
          const legendary10 = isMineBossFloor(state.currentFloor || 1) ? tryDropMineLegendary(senderJid, state.currentFloor || 1) : false
          text = `⚔️ ¡Vences al monstruo! Te quedas con su botín.\n💰 +${formatCurrency(amount)}${bossXp10 ? `\n✨ +${bossXp10} XP` : ''}${legendary10 ? `\n\n🌟🌟🌟 ¡¡¡EL JEFE SUELTA UN OBJETO LEGENDARIO!!! 🌟🌟🌟\nRecibes el *Objeto Legendario* — solo 2 personas en todo el servidor lo tendrán jamás.` : ''}`
        } else {
          if (state.stoneSkin) {
            state.stoneSkin = false
            text = `🪨 El monstruo te vence, pero tu piel pétrea absorbe el golpe. No pierdes vida.`
          } else {
            const vidaSaveChance = Math.min(0.5, mineVidaStat(getInventory(senderJid)) / 40000)
            if (Math.random() < vidaSaveChance) {
              text = `⚔️ El monstruo te vence, pero tu vitalidad te salva de perder una vida.`
            } else {
              mineTakeDamage(state, 0.15)
              text = `⚔️ El monstruo te vence. Logras escapar malherido.\n💔 Pierdes 15% de tu vida.`
            }
          }
        }
      }
    } else if (command === 'curar') {
      if (Math.random() < 0.5) {
        mineHeal(state, 0.3)
        text = `❤️‍🩹 El botiquín improvisado funciona. Recuperas 30% de vida.`
      } else {
        text = `😬 Intentas curarte, pero el botiquín estaba vacío. No funcionó esta vez.`
      }
    } else if (command === 'comprarvida') {
      const healCost = 1800
      if (account.wallet < healCost) {
        text = `⚠️ Necesitas ${formatCurrency(healCost)} para pagar la cura, no te alcanza. Sigues tu camino.`
      } else {
        account.wallet -= healCost
        mineHeal(state, 0.3)
        text = `💊 Pagas ${formatCurrency(healCost)} y te curas al instante. Recuperas 30% de vida.`
      }
    } else if (mineStructureBlocks(senderJid)) {
      text = mineStructureTrapPortal(state, 'dormant', senderJid)
    } else {
      const portalCost = 1000
      if (account.wallet < portalCost) {
        text = `⚠️ Necesitas ${formatCurrency(portalCost)} para reparar el portal, no te alcanza. Sigues tu camino.`
      } else {
        account.wallet -= portalCost
        state.portalReturnAt = Date.now() + 60 * 60 * 1000
        state.active = false
        text = `🌀 Reparas el portal con un chispazo de energía extraña. Te acercas para ver adentro... y una fuerza invisible te succiona por completo.\n\nDesapareces de la mazmorra. Volverás en 1 hora, justo en la salida.`
        forceEnd = true
      }
    }
    state.pending = 'direction'
    text = mineFinishStep(state, senderJid, text, forceEnd)
    queueEconomySave()
    await reply(sock, chat, message, text)
    return
  }

  // ----- Economia: transferencias y slots -----
  if (command === 'enviar' || command === 'transferir') {
    const senderJid = jidNormalizedUser(sender || '')
    const context = contextInfo(content)
    const targetRaw = context.mentionedJid?.[0] || context.participant
    if (!targetRaw) {
      await reply(sock, chat, message, `Uso: menciona a alguien o responde su mensaje con *${PREFIX}enviar <cantidad>*.`)
      return
    }
    const targetJid = jidNormalizedUser(targetRaw)
    if (sameUser(targetJid, senderJid)) {
      await reply(sock, chat, message, '😅 No puedes enviarte dinero a ti mismo.')
      return
    }
    const amountText = commandContent.replace(/@\S+/g, '').trim()
    const senderAccount = getAccount(senderJid)
    const amount = parseAmount(amountText, senderAccount.wallet)
    if (!amount || amount > senderAccount.wallet) {
      await reply(sock, chat, message, `Uso: *${PREFIX}enviar @usuario all* o *${PREFIX}enviar @usuario <cantidad>*. Tienes ${formatCurrency(senderAccount.wallet)} en el monedero.`)
      return
    }
    if (amount < TRANSFER_MIN_AMOUNT) {
      await reply(sock, chat, message, `⚠️ El envío mínimo es ${formatCurrency(TRANSFER_MIN_AMOUNT)}.`)
      return
    }
    const targetAccount = getAccount(targetJid)
    senderAccount.wallet -= amount
    targetAccount.wallet += amount
    queueEconomySave()
    await reply(sock, chat, message, `💸 ${targetTag(senderJid)} le envió ${formatCurrency(amount)} a ${targetTag(targetJid)}.`, [senderJid, targetJid])
    return
  }

  if (command === 'slots' || command === 'tragamonedas') {
    const senderJid = jidNormalizedUser(sender || '')
    const account = getAccount(senderJid)
    const bet = parseAmount(commandContent, account.wallet)
    if (!bet || bet > account.wallet) {
      await reply(sock, chat, message, `Uso: *${PREFIX}slots all* o *${PREFIX}slots <cantidad>*. Tienes ${formatCurrency(account.wallet)} en el monedero.`)
      return
    }
    if (bet < SLOTS_MIN_BET) {
      await reply(sock, chat, message, `⚠️ La apuesta mínima es ${formatCurrency(SLOTS_MIN_BET)}.`)
      return
    }
    account.wallet -= bet
    const reels = [drawSlotSymbol(), drawSlotSymbol(), drawSlotSymbol()]
    const display = reels.map(entry => entry.symbol).join(' | ')
    let outcome
    let payout = 0
    if (reels[0].symbol === reels[1].symbol && reels[1].symbol === reels[2].symbol) {
      payout = bet * reels[0].payout
      outcome = `🎉 ¡Tres iguales! Ganaste ${formatCurrency(payout)}.`
    } else if (reels[0].symbol === reels[1].symbol || reels[1].symbol === reels[2].symbol || reels[0].symbol === reels[2].symbol) {
      payout = bet
      outcome = '🤝 Dos iguales — se devuelve tu apuesta.'
    } else {
      payout = 0
      outcome = `😵 Sin suerte. Perdiste ${formatCurrency(bet)}.`
    }
    account.wallet += payout
    queueEconomySave()
    await reply(sock, chat, message, `🎰 [ ${display} ]\n\n${outcome}\nMonedero: ${formatCurrency(account.wallet)}`)
    return
  }

  // ----- Economia: tienda, inventario y compra/venta -----
  if (command === 'tienda') {
    const kingdomShopClosed = true // Cambiar a false para reabrir sin alterar el catálogo.
    if (kingdomShopClosed) {
      await reply(sock, chat, message, '🏰 *『 TIENDA DEL REINO — CERRADA 』* 🔒\n\n📜 *¡Los suministros del mercader se han agotado!*\n\n🧙‍♂️ Tras recibir a incontables aventureros, el viejo mercader ha vendido hasta el último de sus artículos. Sus estantes han quedado vacíos y sus cofres ya no guardan tesoros que ofrecer.\n\n🐉 Ante esta situación, ha enviado a sus mejores recolectores hacia tierras lejanas, donde buscarán materiales encantados, armas legendarias y artefactos misteriosos para reabastecer la tienda.\n\n🔴 *Estado:* Sin existencias.\n📦 *Suministros:* Expedición de reabastecimiento en curso.\n🔒 *Comercio:* Temporalmente suspendido.\n\n✨ _«¡Por las barbas del gran hechicero! ¡Me he quedado sin mercancía! Regresa cuando mis exploradores vuelvan con nuevos tesoros, aventurero»._')
      return
    }
    const senderJid = jidNormalizedUser(sender || '')
    const [sub, ...rest] = commandContent.split(/\s+/)
    const subCommand = (sub || '').toLowerCase()
    const shopQuery = subCommand === 'comprar' || subCommand === 'buy' ? rest.join(' ') : subCommand
    const reformItem = shopQuery ? findShopItem(shopQuery) : null
    if (reformItem && !ECO_ROTO_SHOP_ITEMS.includes(reformItem)) {
      await reply(sock, chat, message, 'Este artículo pertenece al catálogo histórico. Las compras anteriores se conservan.')
      return
    }
    const shelves = [
      ['provisiones','🍲 *Provisiones de Eco Roto*',['provisiones']],
      ['expedicion','🧭 *Equipo de expedición*',['expedicion','coleccion']],
      ['economia','🪙 *Vales de economía*',['economia']],
      ['titulos','🏅 *Títulos del Reino*',['titulos']],
      ['misterio','🌙 *Mercancía insólita*',['misterio']]
    ]
    const selectedShelf = !rest.length && shelves.find(([id])=>id===subCommand.normalize('NFD').replace(/\p{Diacritic}/gu,''))
    if (!subCommand || selectedShelf) {
      const section = ([,title,categories]) => title + '\n' + ECO_ROTO_SHOP_ITEMS.filter(item=>categories.includes(item.category)).sort((a,b)=>a.price-b.price).map(item=>`• *${item.number}.* ${item.emoji} ${item.name} — ${formatCurrency(item.price)}${item.maxStock?' · Stock: '+getShopStock(item).remaining+'/'+item.maxStock:''}`).join('\n')
      await reply(sock, chat, message, [
        '🏰 *TIENDA DEL REINO*',
        ...(selectedShelf ? [section(selectedShelf)] : shelves.map(([id,title])=>`${title} · *${PREFIX}tienda ${id}*`)),
        ...(!selectedShelf ? ['🐾 *Próximamente · Huellas junto al fuego*\n_El mercader ha dejado un rincón libre junto a la chimenea. Cada amanecer aparecen huellas nuevas en la ceniza. Nadie ha visto quién las deja… todavía._'] : []),
        ...(selectedShelf ? [`Volver al menú: *${PREFIX}tienda*`] : []),
        `Detalles: *${PREFIX}tienda <id>* · Comprar: *${PREFIX}tienda comprar <id>*`
      ].join('\n\n'))
      return
    }
    if (reformItem && supplies.includes(reformItem)) {
      const item = reformItem
      const stock = item.maxStock ? getShopStock(item) : null
      if (subCommand !== 'comprar' && subCommand !== 'buy') {
        const availability = stock ? `\nStock: ${stock.remaining}/${item.maxStock} · Revisión cada ${item.restockDays} días${item.restockBps==null?'':` · ${item.restockBps/100}% de reposición por ciclo`}.` : ''
        await reply(sock, chat, message, `${item.emoji} *${item.name}* — ${formatCurrency(item.price)}\n${item.description}${availability}\nCompra: *${PREFIX}tienda comprar ${item.number}*`)
        return
      }
      if (stock && stock.remaining<=0) {
        await reply(sock, chat, message, `Sin existencias. Próxima revisión en ${formatCountdown(stock.cycleStart + item.restockDays * 86400000)}.`)
        return
      }
      const inventory = getInventory(senderJid)
      if (item.reward && inventory.kingdomVouchers?.[item.reward]?.remaining>0) {
        await reply(sock, chat, message, 'Ya tienes un vale activo para esa actividad.')
        return
      }
      if (!item.repeatable && inventory.owned.includes(item.id)) {
        if (item.category==='titulos') {
          inventory.ecoRotoTitle=item.id
          queueEconomySave()
          await reply(sock, chat, message, `Equipaste *${item.name}* sin volver a pagar.`)
        }
        return
      }
      const account = getAccount(senderJid)
      if (account.wallet<item.price) {
        await reply(sock, chat, message, `Necesitas ${formatCurrency(item.price)} para comprar *${item.name}*.`)
        return
      }
      account.wallet-=item.price
      if(stock)stock.remaining--
      if(item.reward){
        inventory.kingdomVouchers??={}
        inventory.kingdomVouchers[item.reward]={remaining:item.uses,bonus:item.bonus}
      }else inventory.owned.push(item.id)
      if(item.category==='titulos')inventory.ecoRotoTitle=item.id
      queueEconomySave()
      await reply(sock, chat, message, `Compraste *${item.name}* por ${formatCurrency(item.price)}.\n${item.description}`)
      return
    }
    const requestedItem = findShopItem((subCommand === 'comprar' || subCommand === 'buy') ? (rest[0] || '') : subCommand)
    if (requestedItem?.id === 'calabaza' || /^h[1-5]$/.test(subCommand) || ((subCommand === 'comprar' || subCommand === 'buy') && /^h[1-5]$/.test((rest[0] || '').toLowerCase()))) {
      await reply(sock, chat, message, 'Este artículo fue retirado de la tienda. Las compras anteriores se conservan en tu inventario.')
      return
    }

    const rush = SHOP_ITEMS.filter(item => item.category === 'rush')
    const escudos = SHOP_ITEMS.filter(item => item.category === 'escudo')
    const gamble = SHOP_ITEMS.filter(item => item.category === 'gamble')
    const permanentes = SHOP_ITEMS.filter(item => item.category === 'permanente')
    const temporales = SHOP_ITEMS.filter(item => item.category === 'temporal')
    const temporada = SHOP_ITEMS.filter(item => item.category === 'temporada' && isSeasonalAvailable(item))
    const line = item => {
      const meta = item.category === 'temporal'
        ? `⏱️ Dura ${Math.round(item.durationMs / 60000)} min`
        : item.category === 'temporada'
          ? `🎭 ${item.seasonLabel}`
          : item.category === 'escudo'
            ? `🛡️ Reduce ${Math.round(item.protectPercent * 100)}% de robo · ${item.charges} usos · Stock: ${getShopStock(item).remaining}/${item.maxStock}`
            : item.category === 'rush'
              ? `🎁 Misterioso · Dura 2 días · Stock: ${getShopStock(item).remaining}/${item.maxStock}`
              : item.category === 'gamble'
                ? `🎰 0.01% de ganar · Stock: ${getShopStock(item).remaining}/${item.maxStock}`
                : '♾️ Permanente'
      return `🆔 *${item.number}* ${item.emoji} *${item.name}* — ${formatCurrency(item.price)}\n     ${meta}\n     _${item.description}_`
    }

    if (subCommand && subCommand !== 'comprar' && subCommand !== 'buy') {
      const detailItem = findShopItem(subCommand)
      if (!detailItem) {
        await reply(sock, chat, message, `No existe ese artículo. Usa *${PREFIX}tienda* para ver el catálogo.`)
        return
      }
      await reply(sock, chat, message, `${line(detailItem)}\n\n🛒 Compra con *${PREFIX}tienda comprar ${detailItem.number}*`)
      return
    }

    if (subCommand === 'comprar' || subCommand === 'buy') {
      const itemId = (rest.join(' ') || '').toLowerCase()
      const item = findShopItem(itemId)
      if (!item) {
        await reply(sock, chat, message, `No existe ese artículo. Usa *${PREFIX}tienda* para ver el catálogo.`)
        return
      }
      if (!isSeasonalAvailable(item)) {
        await reply(sock, chat, message, `🎭 *${item.name}* solo se puede comprar en temporada: ${item.seasonLabel}.`)
        return
      }
      const inventory = getInventory(senderJid)
      if (item.category !== 'temporal' && item.category !== 'escudo' && item.category !== 'rush' && inventory.owned.includes(item.id)) {
        await reply(sock, chat, message, `Ya tienes *${item.name}*, no puedes comprarlo de nuevo.`)
        return
      }
      if (item.maxStock) {
        const stock = getShopStock(item)
        if (stock.remaining <= 0) {
          const restockAt = stock.cycleStart + item.restockDays * 24 * 60 * 60 * 1000
          await reply(sock, chat, message, `🚫 *${item.name}* está agotado. Vuelve a haber stock en ${formatCountdown(restockAt)}.`)
          return
        }
      }
      const account = getAccount(senderJid)
      if (account.wallet < item.price) {
        await reply(sock, chat, message, `⚠️ Necesitas ${formatCurrency(item.price)} para comprar *${item.name}*. Tienes ${formatCurrency(account.wallet)}.`)
        return
      }
      account.wallet -= item.price
      let gambleResult = null
      if (item.category === 'temporal') {
        inventory.buffs[item.id] = Date.now() + item.durationMs
      } else if (item.category === 'escudo') {
        const tierKey = String(Math.round(item.protectPercent * 100))
        inventory.shieldTiers = inventory.shieldTiers || {}
        inventory.shieldTiers[tierKey] = (inventory.shieldTiers[tierKey] || 0) + item.charges
        getShopStock(item).remaining -= 1
      } else if (item.category === 'rush') {
        inventory.buffs[item.id] = Date.now() + item.durationMs
        getShopStock(item).remaining -= 1
      } else if (item.category === 'gamble') {
        getShopStock(item).remaining -= 1
        if (Math.random() < FORTUNE_WIN_CHANCE) {
          inventory.fortuneBadge = { lastCollectedAt: Date.now() }
          gambleResult = 'win'
        } else {
          economyState.xp[senderJid] = (economyState.xp[senderJid] || 0) + 1
          gambleResult = 'lose'
        }
      } else if (item.id === 'pergamino_olvido') {
        const mineInv = getInventory(senderJid)
        mineInv.vidaPoints = 0
        mineInv.danoPoints = 0
        mineInv.manaPoints = 0
        mineInv.unlockedElements = []
        const respecState = getMineState(senderJid)
        if (respecState.active) {
          respecState.maxHp = mineMaxHpFor(mineInv)
          respecState.hp = Math.min(mineCurrentHp(respecState), respecState.maxHp)
          respecState.maxMana = mineMaxManaFor(mineInv)
          respecState.mana = Math.min(getMineMana(respecState), respecState.maxMana)
        }
      } else {
        inventory.owned.push(item.id)
      }
      queueEconomySave()
      const extra = item.category === 'temporal' || item.category === 'rush'
        ? ` Dura ${Math.round(item.durationMs / 60000)} minutos.`
        : item.category === 'escudo'
          ? ` Reduce ${Math.round(item.protectPercent * 100)}% de lo que te roben, por ${item.charges} usos.`
          : item.category === 'gamble'
            ? (gambleResult === 'win'
              ? ' 🎉 ¡GANASTE EL PREMIO MAYOR! Insignia de la Fortuna activada: +$150 cada hora, para siempre.'
              : ' 🍪 Solo te tocó una galleta. +1 XP.')
            : item.id === 'pergamino_olvido'
              ? ' Tus puntos de habilidad de la mazmorra (Vida, Daño y elementos aprendidos) fueron reiniciados. Usa *' + PREFIX + 'habilidad* para repartirlos de nuevo.'
              : ''
      await reply(sock, chat, message, `✅ Compraste ${item.emoji} *${item.name}* por ${formatCurrency(item.price)}.${extra}\nMonedero: ${formatCurrency(account.wallet)}`)
      return
    }

    const shortLine = item => `🆔 *${item.number}.* ${item.emoji} ${item.name} — ${formatCurrency(item.price)}`
    const sections = [
      `🚀 *MODO RUSH*\n${rush.map(shortLine).join('\n')}`,
      `🛡️ *ESCUDOS*\n${escudos.map(shortLine).join('\n')}`,
      `🎰 *TODO O NADA*\n${gamble.map(shortLine).join('\n')}`,
      `♾️ *PERMANENTES*\n${permanentes.map(shortLine).join('\n')}`,
      `⏳ *TEMPORALES*\n${temporales.map(shortLine).join('\n')}`
    ]
    if (temporada.length) sections.push(`🎭 *DE TEMPORADA*\n${temporada.map(shortLine).join('\n')}`)
    await reply(sock, chat, message,
      `🛍️ *TIENDA DE NURUXION LEGIÓN*\n\n` +
      sections.join('\n\n') +
      `\n\n🔎 Detalles: *${PREFIX}tienda <id>* (ej: *${PREFIX}tienda 3*)\n🛒 Comprar: *${PREFIX}tienda comprar <id>*\n📦 Tu inventario: *${PREFIX}inventario*`)
    return
  }

  if (command === 'inventario') {
    const senderJid = jidNormalizedUser(sender || '')
    const inventory = getInventory(senderJid)
    const now = Date.now()
    const equipArg = commandContent.trim().toLowerCase()
    if (equipArg.startsWith('equipar')) {
      const which = equipArg.replace('equipar', '').trim()
      const target = which.includes('alqui') ? 'espada_alquimista' : which.includes('arcan') ? 'espada_arcana' : null
      if (!target || !inventory.owned.includes(target)) {
        await reply(sock, chat, message, `No tienes esa espada. Usa *${PREFIX}inventario equipar arcana* o *${PREFIX}inventario equipar alquimista*.`)
        return
      }
      inventory.equippedSword = target
      queueEconomySave()
      await reply(sock, chat, message, `⚔️ Equipas tu ${target === 'espada_arcana' ? 'espada arcana' : 'espada alquimista'}.`)
      return
    }
    if (equipArg === 'desequipar') {
      inventory.equippedSword = null
      queueEconomySave()
      await reply(sock, chat, message, `⚔️ Ya no tienes ninguna espada equipada.`)
      return
    }
    const buffs = Object.entries(inventory.buffs)
      .filter(([, expiresAt]) => expiresAt > now)
      .map(([id, expiresAt]) => {
        const item = findShopItem(id)
        const minutes = Math.ceil((expiresAt - now) / 60000)
        return item ? { label: `${item.name} - ${minutes} min` } : null
      })
      .filter(Boolean)
    const displayName = message.pushName || targetTag(senderJid)
    const pTier = pickaxeTier(senderJid)
    const hasRopeInv = inventory.owned.includes('cuerda')
    const chestCount = inventory.owned.filter(id => id === 'cofre_cerrado').length
    const equipParts = []
    if (pTier > 0) equipParts.push(pickaxeName(pTier))
    if (hasRopeInv) equipParts.push('una cuerda')
    if (chestCount > 0) equipParts.push(`${chestCount} cofre${chestCount > 1 ? 's' : ''} cerrado${chestCount > 1 ? 's' : ''}`)
    const svg = buildInventoryCardSvg({ name: displayName, buffs, tool: equipParts.length ? equipParts.join(' · ') : null })
    const inventoryCaption = `🎒 Inventario de ${targetTag(senderJid)}\n\n` + inventoryView(inventory, findShopItem, now)
    try {
      const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
      await sock.sendMessage(chat, { image: pngBuffer, caption: inventoryCaption, mentions: [senderJid] }, { quoted: message })
    } catch (error) {
      logger.warn({ err: error }, 'Falló generar la tarjeta de inventario')
      await reply(sock, chat, message, inventoryCaption, [senderJid])
    }
    return
  }

  if (command === 'comprar' || command === 'vender') {
    const senderJid = jidNormalizedUser(sender || '')
    const companyList = economyState.companies[chat]?.list
    if (!companyList) {
      await reply(sock, chat, message, `📉 Este grupo aún no tiene empresas. Pide a un admin que use *${PREFIX}empresa*.`)
      return
    }
    tickCompanies(companyList)
    const tokens = commandContent.trim().split(/\s+/).filter(Boolean)
    const amountToken = tokens.length > 1 ? tokens.pop() : ''
    const query = tokens.join(' ')
    const company = query ? findCompany(companyList, query) : null
    if (!company) {
      const usage = command === 'comprar' ? `${PREFIX}comprar <empresa> <cantidad|all>` : `${PREFIX}vender <empresa> <cantidad|all>`
      await reply(sock, chat, message, `Uso: *${usage}*.\n\nEmpresas disponibles:\n${companyList.map(item => `• ${item.name}`).join('\n')}`)
      return
    }
    const account = getAccount(senderJid)
    if (command === 'comprar') {
      const maxAffordable = Math.floor(account.wallet / company.price)
      const quantity = amountToken.toLowerCase() === 'all' || amountToken.toLowerCase() === 'todo' ? maxAffordable : Math.floor(Number(amountToken))
      if (!quantity || quantity <= 0 || !Number.isFinite(quantity)) {
        await reply(sock, chat, message, `Indica cuántas acciones comprar. Precio actual de *${company.name}*: ${formatCurrency(company.price)}.`)
        return
      }
      const cost = Math.ceil(quantity * company.price)
      if (cost > account.wallet) {
        await reply(sock, chat, message, `⚠️ Necesitas ${formatCurrency(cost)} para comprar ${quantity} acciones de *${company.name}*, solo tienes ${formatCurrency(account.wallet)}.`)
        return
      }
      account.wallet -= cost
      company.shares[senderJid] = (company.shares[senderJid] || 0) + quantity
      queueEconomySave()
      await reply(sock, chat, message, `📈 Compraste ${quantity} acciones de *${company.name}* por ${formatCurrency(cost)}.`)
      return
    }
    const owned = company.shares[senderJid] || 0
    const quantity = amountToken.toLowerCase() === 'all' || amountToken.toLowerCase() === 'todo' ? owned : Math.floor(Number(amountToken))
    if (!quantity || quantity <= 0 || !Number.isFinite(quantity) || quantity > owned) {
      await reply(sock, chat, message, `Tienes ${owned} acciones de *${company.name}*. Indica cuántas vender.`)
      return
    }
    let proceeds = Math.floor(quantity * company.price)
    let luckyNote = ''
    if (hasActiveBuff(getInventory(senderJid), 'modo_rush') && Math.random() < 0.15) {
      const bonus = Math.ceil(proceeds * 0.2)
      proceeds += bonus
      luckyNote = ` 🍀 ¡Racha de suerte del Modo Rush! +${formatCurrency(bonus)} extra.`
    }
    company.shares[senderJid] = owned - quantity
    account.wallet += proceeds
    queueEconomySave()
    await reply(sock, chat, message, `📉 Vendiste ${quantity} acciones de *${company.name}* por ${formatCurrency(proceeds)}.${luckyNote}`)
    return
  }

  // ----- Empresas (bolsa de valores del grupo) -----
  if (command === 'empresas') {
    const companyList = economyState.companies[chat]?.list
    if (!companyList) {
      await reply(sock, chat, message, `📉 Este grupo aún no tiene empresas. Pide a un admin que use *${PREFIX}empresa*.`)
      return
    }
    tickCompanies(companyList)
    queueEconomySave()
    const summary = companyList.map(company => {
      const previous = company.history[company.history.length - 2]?.p ?? company.price
      const changePercent = previous ? ((company.price - previous) / previous) * 100 : 0
      const arrow = changePercent > 0 ? '🟢▲' : changePercent < 0 ? '🔴▼' : '⚪'
      return `${arrow} *${company.name}* (${company.sector}): ${formatCurrency(company.price)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`
    }).join('\n')
    try {
      const chartBuffer = await renderCompanyChart(companyList)
      await sock.sendMessage(chat, { image: chartBuffer, caption: `📊 *Bolsa de Valores*\n\n${summary}\n\nUsa *${PREFIX}comprar* / *${PREFIX}vender* para invertir.` }, { quoted: message })
    } catch (error) {
      logger.warn({ err: error }, 'No se pudo generar la gráfica de empresas')
      await reply(sock, chat, message, `📊 *Bolsa de Valores*\n\n${summary}`)
    }
    return
  }

  // adminuser comprueba Owner/admin de la comunidad con metadatos frescos.
  // Los demás comandos conservan su control de administrador del grupo.
  if (['on', 'off', 'add', 'give'].includes(command)) {
    if (!await requireOperator(sock, chat, message, sender)) return
  } else if (command !== 'adminuser' && !await requireAdmin(sock, chat, message, sender, metadata)) return

  if (command === 'empresa') {
    if (economyState.companies[chat]) {
      await reply(sock, chat, message, `📊 Este grupo ya tiene empresas creadas. Usa *${PREFIX}empresas* para verlas.`)
      return
    }
    const companyList = buildCompanies(metadata.subject)
    economyState.companies[chat] = { createdAt: Date.now(), list: companyList }
    queueEconomySave()
    await reply(sock, chat, message, `🏛️ *Se crearon 3 empresas para este grupo:*\n\n${companyList.map(item => `• *${item.name}* (${item.sector}) — ${formatCurrency(item.price)}`).join('\n')}\n\nUsa *${PREFIX}empresas* para ver la gráfica y *${PREFIX}comprar*/*${PREFIX}vender* para invertir.`)
    return
  }

  // ----- Plantilla de miembro -----
  if (command === 'plantilla') {
    const groupName = (metadata.subject || '').trim().toLocaleLowerCase()
    if (!MEMBER_FORM_GROUP_NAMES.includes(groupName)) {
      await reply(sock, chat, message, `⚠️ Este comando solo funciona en *${MEMBER_FORM_GROUP_NAMES.join(', ')}*.`)
      return
    }
    const context = contextInfo(content)
    const requestedTarget = context.mentionedJid?.[0] || context.participant || sender
    const targetParticipant = findParticipant(metadata, requestedTarget)
    const targetJid = jidNormalizedUser(participantJid(targetParticipant) || requestedTarget)
    if (!targetJid) {
      await reply(sock, chat, message, `Uso: *${PREFIX}plantilla @usuario*.`)
      return
    }
    const userTag = `@${targetJid.split('@')[0].split(':')[0]}`
    await sendMemberForm(sock, chat, MEMBER_FORM_MESSAGE.replaceAll('@user', userTag), [targetJid], message)
    return
  }

  // ----- Actividad y puntos -----
  if (command === 'points') {
    const context = contextInfo(content)
    const target = context.mentionedJid?.[0] || context.participant || sender
    const targetKey = jidNormalizedUser(target || '')
    if (!targetKey) {
      await reply(sock, chat, message, `Uso: *${PREFIX}points @usuario*`)
      return
    }
    const summary = activityPointSummary(targetKey)
    const tag = `@${targetKey.split('@')[0].split(':')[0]}`
    await sock.sendMessage(chat, {
      text: [
        `📊 *Puntos de actividad de ${tag}*`,
        '',
        `✅ Positivos: *+${summary.positive}*`,
        `❌ Negativos: *-${summary.negative}*`,
        `🧮 Total: *${summary.total >= 0 ? '+' : ''}${summary.total}*`
      ].join('\n'),
      mentions: [targetKey]
    }, { quoted: message })
    return
  }

  if (command === 'topactividad' || command === 'topinactividad') {
    if (!(await requireAdmin(sock, chat, message, sender, metadata))) return
    const period = activityPeriodInfo()
    const week = period.key
    const groups = activityTrackedGroups(Object.values(await sock.groupFetchAllParticipating() || {}).filter(group => isAllowedGroup(group.id)))
    const counts = activityGroupCounts('global', week, groups.map(group => group.id))
    const botKey = jidNormalizedUser(sock.user?.id || '')
    const members = activityMemberEntries(groups, counts, botKey)

    const isActiveTop = command === 'topactividad'
    const ranked = members
      .filter(entry => !isActiveTop || (entry.messages > 0 && !entry.excludedFromActivityTop))
      .sort((a, b) => isActiveTop
        ? b.messages - a.messages || a.jid.localeCompare(b.jid)
        : a.messages - b.messages || a.jid.localeCompare(b.jid))
      .slice(0, isActiveTop ? 5 : 20)

    if (!ranked.length) {
      await reply(sock, chat, message, 'Todavía no hay actividad registrada en el periodo semanal actual.')
      return
    }

    const title = isActiveTop ? '🏆 *Top semanal de actividad*' : '📉 *Top semanal de inactividad*'
    const lines = ranked.map((entry, index) => {
      const tag = `@${entry.jid.split('@')[0].split(':')[0]}`
      const preview = isActiveTop
        ? [3, 2, 1, 1, 1][index]
        : (index === 0 ? -2 : -1)
      return `*#${index + 1}* ${tag} — ${entry.messages} mensajes — ${preview ? `*${preview > 0 ? '+' : ''}${preview} puntos al cierre*` : 'sin descuento'}`
    })
    const status = period.counting
      ? '🟢 Conteo abierto hasta el domingo a las 12:00 p. m.'
      : '⏸️ Conteo cerrado. El siguiente periodo comienza el lunes a las 12:00 p. m.'
    await sock.sendMessage(chat, {
      text: [title, `📅 Semana iniciada: *${week}*`, status, '', ...lines, '', 'ℹ️ Los puntos se aplican automáticamente el domingo a las 12:00 p. m. (hora de México).'].join('\n'),
      mentions: ranked.map(entry => entry.jid)
    }, { quoted: message })
    return
  }

  if (command === 'give') {
    const context = contextInfo(content)
    const args = commandContent.split(/\s+/).filter(Boolean)
    if ((args[0] || '').toLowerCase() !== 'points') {
      await reply(sock, chat, message, `Uso: *${PREFIX}give points @usuario razón*\nEjemplo: *${PREFIX}give points @usuario actividad*`)
      return
    }
    const target = context.mentionedJid?.[0] || context.participant
    if (!target) {
      await reply(sock, chat, message, `Debes mencionar a un usuario o responder su mensaje.\nUso: *${PREFIX}give points @usuario razón*`)
      return
    }
    const targetKey = jidNormalizedUser(target)
    const mentionTokenIndex = args.findIndex(token => token.includes('@'))
    const reasonStart = mentionTokenIndex >= 0 ? mentionTokenIndex + 1 : 1
    const reason = args.slice(reasonStart).join(' ').trim()
    if (!reason) {
      await reply(sock, chat, message, 'Debes escribir la razón de los puntos. Ejemplo: *actividad*.')
      return
    }
    if (reason.length > 150) {
      await reply(sock, chat, message, 'La razón puede tener un máximo de 150 caracteres.')
      return
    }

    const commandId = message.key.id || ''
    if (commandId && runtimeState.processedPointCommands[commandId]) {
      await reply(sock, chat, message, 'ℹ️ Esta entrega de puntos ya fue procesada.')
      return
    }

    runtimeState.activityPoints[targetKey] = (runtimeState.activityPoints[targetKey] || 0) + 2
    const record = {
      messageId: commandId,
      chat,
      target: targetKey,
      moderator: jidNormalizedUser(sender),
      points: 2,
      reason,
      createdAt: new Date().toISOString()
    }
    runtimeState.activityPointHistory.push(record)
    if (runtimeState.activityPointHistory.length > 1000) {
      runtimeState.activityPointHistory.splice(0, runtimeState.activityPointHistory.length - 1000)
    }
    if (commandId) runtimeState.processedPointCommands[commandId] = Date.now()
    const processedEntries = Object.entries(runtimeState.processedPointCommands)
    if (processedEntries.length > 1000) {
      processedEntries.sort((a, b) => a[1] - b[1]).slice(0, processedEntries.length - 1000)
        .forEach(([id]) => delete runtimeState.processedPointCommands[id])
    }
    queueStateSave()

    const total = runtimeState.activityPoints[targetKey]
    await reply(sock, chat, message, `✅ *+2 Puntos* para ${targetTag(targetKey)}\n📝 *Razón:* ${reason}\n📊 *Total:* ${total} puntos`, [targetKey])
    return
  }

  if (command === 'add') {
    const context = contextInfo(content)
    const args = text.split(/\s+/).slice(1)
    const type = (args[0] || '').toLowerCase()
    if (type !== 'xp' && type !== 'dinero') {
      await reply(sock, chat, message, `Uso: *${PREFIX}add xp @usuario cantidad* o *${PREFIX}add dinero @usuario cantidad*`)
      return
    }
    let rest = args.slice(1)
    let target = context.mentionedJid?.[0] || context.participant
    if (!target) {
      const idToken = rest.find(t => t.includes('@'))
      if (idToken) {
        target = idToken
        rest = rest.filter(t => t !== idToken)
      }
    }
    if (!target) {
      await reply(sock, chat, message, `Uso: menciona a alguien, responde su mensaje, o pon su ID (con @lid o @s.whatsapp.net) con *${PREFIX}add xp/dinero @usuario/id cantidad*.`)
      return
    }
    target = jidNormalizedUser(target)
    if (rest[0] === 'x') rest = rest.slice(1)
    const amount = parseInt(rest[0], 10)
    if (!Number.isFinite(amount) || amount <= 0) {
      await reply(sock, chat, message, `Uso: *${PREFIX}add xp/dinero @usuario/id cantidad*. La cantidad debe ser un numero mayor a 0.`)
      return
    }
    if (type === 'xp') {
      economyState.xp[target] = (economyState.xp[target] || 0) + amount
      queueEconomySave()
      await reply(sock, chat, message, `✅ Se agregaron ${amount} XP a @${target.split('@')[0]}.`, [target])
    } else {
      const targetAccount = getAccount(target)
      targetAccount.wallet += amount
      queueEconomySave()
      await reply(sock, chat, message, `✅ Se agregaron ${formatCurrency(amount)} al monedero de @${target.split('@')[0]}.`, [target])
    }
    return
  }

  // ----- Moderacion: warns, antilink y mute -----
  if (command === 'warn' || command === 'warns' || command === 'unwarn') {
    const context = contextInfo(content)
    const target = context.mentionedJid?.[0] || context.participant
    if (!target) {
      const usage = command === 'warn'
        ? `${PREFIX}warn @usuario motivo`
        : `${PREFIX}${command} @usuario`
      await reply(sock, chat, message, `Uso: menciona a una persona o responde su mensaje con *${usage}*.`)
      return
    }

    const targetParticipant = findParticipant(metadata, target)
    if (!targetParticipant) {
      await reply(sock, chat, message, '⚠️ Esa persona no aparece como participante del grupo.')
      return
    }

    if (command === 'warn' && isAdmin(targetParticipant)) {
      await reply(sock, chat, message, '⚠️ No puedes advertir a un administrador del grupo.')
      return
    }

    const targetJid = participantJid(targetParticipant) || target
    const targetKey = jidNormalizedUser(targetJid)
    const moderatorJid = jidNormalizedUser(sender)
    const groupWarnings = runtimeState.warnings[chat] ||= {}
    const warnings = groupWarnings[targetKey] ||= []
    const targetTag = `@${targetKey.split('@')[0].split(':')[0]}`
    const moderatorTag = `@${moderatorJid.split('@')[0].split(':')[0]}`

    if (command === 'warn') {
      let reason = commandContent.replace(/(?:^|\s)@\S+/, ' ').trim()
      if (!reason) reason = quotedText(content).trim()
      if (!reason) {
        await reply(sock, chat, message, `Uso: *${PREFIX}warn @usuario motivo*.`)
        return
      }
      await registerWarning(sock, chat, message, targetJid, moderatorJid, reason, metadata)
      return
    }

    if (command === 'warns') {
      if (!warnings.length) {
        await reply(sock, chat, message, `✅ ${targetTag} no tiene advertencias registradas.`, [targetJid])
        return
      }
      const history = warnings.map((warning, index) => {
        const moderator = warning.moderator ? `@${warning.moderator.split('@')[0].split(':')[0]}` : 'Desconocido'
        return `${index + 1}. ${warning.reason}\n   Moderador: ${moderator}`
      }).join('\n')
      const mentions = [targetJid, ...warnings.map(warning => warning.moderator).filter(Boolean)]
      await reply(sock, chat, message, `📋 *ADVERTENCIAS DE ${targetTag}*

${history}

🔢 *Total:* ${warnings.length}/${MAX_WARNS}`, mentions)
      return
    }

    if (!warnings.length) {
      await reply(sock, chat, message, `ℹ️ ${targetTag} no tiene advertencias para eliminar.`, [targetJid])
      return
    }
    const removed = warnings.pop()
    if (!warnings.length) delete groupWarnings[targetKey]
    if (!Object.keys(groupWarnings).length) delete runtimeState.warnings[chat]
    queueStateSave()
    await reply(sock, chat, message, `✅ *ADVERTENCIA ELIMINADA*

👤 *Usuario:* ${targetTag}
📝 *Advertencia retirada:* ${removed.reason}
🛡️ *Moderador:* ${moderatorTag}
🔢 *Warns restantes:* ${warnings.length}/${MAX_WARNS}`, [targetJid, moderatorJid])
    return
  }

  if (command === 'antilink') {
    const mode = commandContent.trim().toLowerCase()
    if (mode !== 'on' && mode !== 'off') {
      await reply(sock, chat, message, `Uso: *${PREFIX}antilink on* o *${PREFIX}antilink off*.\nEstado actual: ${runtimeState.antilink[chat] ? 'activado' : 'desactivado'}.`)
      return
    }
    if (mode === 'on') runtimeState.antilink[chat] = true
    else delete runtimeState.antilink[chat]
    queueStateSave()
    await reply(sock, chat, message, mode === 'on'
      ? '🔗🚫 Antilink activado: se eliminarán enlaces enviados por quienes no sean administradores y se registrará una advertencia.'
      : '🔗 Antilink desactivado.')
    return
  }

  if (command === 'mute' || command === 'unmute') {
    const context = contextInfo(content)
    const target = context.mentionedJid?.[0] || context.participant
    if (!target) {
      await reply(sock, chat, message, `Uso: menciona a alguien o responde su mensaje con *${PREFIX}${command}*.`)
      return
    }
    const targetParticipant = findParticipant(metadata, target)
    const targetJid = jidNormalizedUser(participantJid(targetParticipant) || target)
    const targetTag = `@${targetJid.split('@')[0].split(':')[0]}`
    const mutedList = runtimeState.muted[chat] ||= []
    if (command === 'mute') {
      if (!mutedList.some(jid => sameUser(jid, targetJid))) mutedList.push(targetJid)
      queueStateSave()
      await reply(sock, chat, message, `🔇 ${targetTag} fue silenciado: sus mensajes se eliminarán automáticamente.`, [targetJid])
    } else {
      const remaining = mutedList.filter(jid => !sameUser(jid, targetJid))
      if (remaining.length) runtimeState.muted[chat] = remaining
      else delete runtimeState.muted[chat]
      queueStateSave()
      await reply(sock, chat, message, `🔊 ${targetTag} ya puede volver a escribir con normalidad.`, [targetJid])
    }
    return
  }

  // ----- Administracion del bot (on/off, tag, close/open, kick, admin) -----
  if (command === 'prueba') {
    const preview = WELCOME_MESSAGE
      .replaceAll('{group}', metadata.subject || 'el grupo')
      .replaceAll('{count}', String(metadata.participants.length))
      .replaceAll('@user', `@${jidNormalizedUser(sender).split('@')[0].split(':')[0]}`)
    await sendWelcomeMessage(sock, chat, preview, [sender], message)
    return
  }

  if (command === 'on' || command === 'off') {
    const enabled = command === 'on'
    if (runtimeState.enabled === enabled) {
      await reply(sock, chat, message, enabled
        ? `╭━━━〔 🤖 *BOT ACTIVO* 〕━━━╮
┃
┃ ✅ El bot ya estaba encendido.
┃ ⚡ Todos los comandos están disponibles.
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
        : `╭━━━〔 💤 *BOT EN PAUSA* 〕━━━╮
┃
┃ 🔕 El bot ya estaba apagado.
┃ 🔑 Usa *${PREFIX}on* para activarlo.
┃
╰━━━━━━━━━━━━━━━━━━━━╯`)
      return
    }
    runtimeState.enabled = enabled
    queueStateSave()
    await reply(sock, chat, message, enabled
      ? `╭━━━〔 🤖 *BOT ENCENDIDO* 〕━━━╮
┃
┃ ✅ Sistema activado correctamente
┃ ⚡ Comandos disponibles nuevamente
┃ 👋 Bienvenidas automáticas activadas
┃
┃ 📋 Escribe *${PREFIX}comandos* para ver el menú
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`
      : `╭━━━〔 📴 *BOT APAGADO* 〕━━━╮
┃
┃ 🔕 Sistema desactivado correctamente
┃ ⏸️ Comandos y bienvenidas en pausa
┃
┃ 🔑 Solo responderé a *${PREFIX}on*
┃
╰━━━━━━━━━━━━━━━━━━━━╯`)
    return
  }

  if (command === 'tag') {
    const explicitMentions = contextInfo(content).mentionedJid || []
    const mentions = explicitMentions.length
      ? explicitMentions
      : metadata.participants.map(participantJid).filter(Boolean)
    const visibleMentionTokens = commandContent.match(/(?:^|\s)@\S+/g)?.map(token => token.trim()) || []
    const tagLabel = explicitMentions.length
      ? (visibleMentionTokens.slice(0, explicitMentions.length).join(' ') || explicitMentions.map(jid => `@${jidNormalizedUser(jid).split('@')[0].split(':')[0]}`).join(' '))
      : '@everyone'
    let cleanContent = commandContent
    for (let index = 0; index < explicitMentions.length; index += 1) {
      cleanContent = cleanContent.replace(/^\s*@\S+\s*/, '')
    }
    const announcement = cleanContent.trim() || quotedText(content) || 'Atención, grupo.'
    const mediaSource = findMedia(content)
    try {
      await sock.sendMessage(chat, { delete: message.key })
    } catch (error) {
      logger.warn({ err: error, messageId: message.key.id }, 'No se pudo eliminar el comando ?tag')
    }
    const resolvedAnnouncement = await resolveGroupLinksInText(sock, announcement)
    await sendTaggedContent(sock, chat, resolvedAnnouncement, mentions, mediaSource, tagLabel)
    return
  }

  if (!(await requireBotAdmin(sock, chat, message, metadata))) return

  if (command === 'close' || command === 'open') {
    await sock.groupSettingUpdate(chat, command === 'close' ? 'announcement' : 'not_announcement')
    groupCache.del(chat)
    await reply(sock, chat, message, command === 'close'
      ? '🔒 Grupo cerrado. Solo los administradores pueden enviar mensajes.'
      : '🔓 Grupo abierto. Todos los participantes pueden enviar mensajes.')
    return
  }

  if (command === 'kick') {
    const context = contextInfo(content)
    const target = context.mentionedJid?.[0] || context.participant
    if (!target) {
      await reply(sock, chat, message, `Uso: menciona a alguien o responde su mensaje con *${PREFIX}kick*.`)
      return
    }
    if (sameUser(target, sock.user?.id)) {
      await reply(sock, chat, message, 'ℹ️ No puedo expulsarme a mí mismo.')
      return
    }
    const targetParticipant = findParticipant(metadata, target)
    if (!targetParticipant) {
      await reply(sock, chat, message, '⚠️ Esa persona no aparece como participante del grupo.')
      return
    }
    if (isAdmin(targetParticipant) && !isOwner(sender)) {
      await reply(sock, chat, message, '⛔ No puedes expulsar a otro administrador. Solo el owner puede hacerlo.')
      return
    }
    const targetJid = participantJid(targetParticipant) || target
    const result = await sock.groupParticipantsUpdate(chat, [targetJid], 'remove')
    const failed = result?.find(item => String(item.status) !== '200')
    if (failed) throw new Error(`WhatsApp rechazo la expulsion (estado ${failed.status})`)
    groupCache.del(chat)
    await reply(sock, chat, message, '👢 Usuario expulsado del grupo.', [targetJid])
    return
  }

  if (command === 'adminuser') {
    try {
      const [action] = commandContent.trim().split(/\s+/)
      let result
      if (action?.toLowerCase() === 'confirmar') {
        await reply(sock, chat, message, `Ya no se usan códigos. Inicia una solicitud con *${PREFIX}adminuser @persona* y responde *${PREFIX}aceptar* o *${PREFIX}rechazar*.`)
        return
      } else {
        const context = contextInfo(content)
        const target = context.mentionedJid?.[0] || context.participant
        if (!target) {
          await reply(sock, chat, message, `Menciona a alguien o responde su mensaje con *${PREFIX}adminuser*. Revisaré los grupos vinculados de Nuruxion Legión y pediré confirmación antes de promoverlo.`)
          return
        }
        const marriage = marriageProposals.get(`${chat}:${jidNormalizedUser(sender || '')}`)
        if (marriage?.expiresAt > Date.now()) {
          await reply(sock, chat, message, `Primero resuelve tu propuesta de pareja con *${PREFIX}aceptar* o *${PREFIX}rechazar*. Después podrás iniciar la promoción sin mezclar ambas solicitudes.`)
          return
        }
        result = await communityPromoter.prepare(sock, { chat, actor: sender, target, prefix: PREFIX })
      }
      saveCommunityPromotionAudit(result)
      await reply(sock, chat, message, result.text, result.mentions)
    } catch (error) {
      logger.warn({ err: error }, 'No se pudo completar la promoción de comunidad')
      await reply(sock, chat, message, '⚠️ ' + (error.message || 'No se pudo comprobar la operación. Prepara una nueva solicitud.'))
    }
    return
  }
}


// ===================================================================
// BIENVENIDA DE MIEMBROS
// ===================================================================
async function handleWelcome(sock, event) {
  if (!runtimeState.enabled || event.action !== 'add') return
  try {
    const metadata = await getMetadata(sock, event.id, true)
    if (getGroupScope(event.id) !== 'clan') return
    const groupName = (metadata.subject || '').trim().toLocaleLowerCase()
    const isWelcomeGroup = WELCOME_GROUP_NAMES.includes(groupName)
    const isMemberFormGroup = MEMBER_FORM_GROUP_NAMES.includes(groupName)
    if (!isWelcomeGroup && !isMemberFormGroup) return
    for (const entry of event.participants || []) {
      const jid = participantJid(entry)
      if (!jid || sameUser(jid, sock.user?.id)) continue
      const userTag = `@${jidNormalizedUser(jid).split('@')[0].split(':')[0]}`
      if (isMemberFormGroup) {
        await sendMemberForm(sock, event.id, MEMBER_FORM_MESSAGE.replaceAll('@user', userTag), [jid])
        continue
      }
      const text = WELCOME_MESSAGE
        .replaceAll('{group}', metadata.subject || 'el grupo')
        .replaceAll('{count}', String(metadata.participants.length))
        .replaceAll('@user', userTag)
      await sendWelcomeMessage(sock, event.id, text, [jid])
    }
  } catch (error) {
    logger.error({ err: error, group: event.id }, 'No se pudo enviar la bienvenida')
  }
}


// ===================================================================
// CONEXION A WHATSAPP (BAILEYS): ARRANQUE Y RECONEXION
// ===================================================================
function scheduleReconnect() {
  if (reconnectTimer) return
  const baseDelay = Math.min(60000, 3000 * (2 ** reconnectAttempts))
  const delay = baseDelay + Math.floor(Math.random() * 1500)
  reconnectAttempts += 1
  logger.info({ delay, attempt: reconnectAttempts }, 'Reconexión automática programada')
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void startBot()
  }, delay)
}

async function startBot() {
  if (starting) return
  starting = true
  try {
    await fs.mkdir(SESSION_DIR, { recursive: true, mode: 0o700 })
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
    const sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      logger: baileysLogger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      cachedGroupMetadata: async jid => groupCache.get(jid)
    })

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('groups.update', updates => updates.forEach(update => groupCache.del(update.id)))
    sock.ev.on('group-participants.update', event => {
      if (!isAllowedGroup(event.id)) return
      groupCache.del(event.id)
      if (getGroupScope(event.id) === 'clan' && event.action === 'add') {
        let changed = false
        for (const entry of event.participants || []) {
          const jid = participantJid(entry)
          const key = jid && jidNormalizedUser(jid)
          if (key && !economyState.groupJoinedAt[key]) {
            economyState.groupJoinedAt[key] = Date.now()
            changed = true
          }
        }
        if (changed) queueEconomySave()
      }
      void handleWelcome(sock, event)
    })
    sock.ev.on('messages.upsert', ({ messages, type }) => {
      for (const message of messages) {
        let release
        try { release = acceptIncomingMessage(type, message) }
        catch (error) {
          logger.warn({ code: error.code }, 'No se pudo reservar el mensaje; se descartó para evitar duplicados')
          continue
        }
        if (!release) continue
        void handleCommand(sock, message).catch(error => {
          logger.error({ err: error, messageId: message.key.id }, 'Fallo al procesar un comando')
          if (isAllowedGroup(message.key.remoteJid)) {
            void reply(sock, message.key.remoteJid, message, '❌ No pude completar el comando. Revisa que tenga permisos e inténtalo de nuevo.')
              .catch(sendError => logger.error({ err: sendError }, 'No se pudo enviar el aviso de error'))
          }
        }).finally(release)
      }
    })

    function setupConsoleBroadcast() {
    const rl = readline.createInterface({ input: process.stdin })
    rl.on('line', async line => {
      const text = line.trim()
      if (!text || !currentSock) return
      try {
        const groups = await currentSock.groupFetchAllParticipating()
        const target = Object.values(groups).find(g => isAllowedGroup(g.id) && g.subject === RESTRICTED_COMMANDS_GROUP_NAME)
        if (!target) {
          logger.warn(`No se encontró el grupo "${RESTRICTED_COMMANDS_GROUP_NAME}" para enviar el mensaje de consola`)
          return
        }
        await currentSock.sendMessage(target.id, { text: `🖥️ *Consola:* ${text}` })
        logger.info(`Mensaje de consola enviado a ${RESTRICTED_COMMANDS_GROUP_NAME}: ${text}`)
      } catch (error) {
        logger.warn({ err: error }, 'No se pudo enviar el mensaje de consola al grupo')
      }
    })
  }


  function setupNightSchedule() {
    setInterval(async () => {
      try {
        if (!currentSock) return
        await finalizeWeeklyActivity(currentSock)
        await refreshStaffApplications(currentSock)
        const MX_OFFSET_MS = -6 * 3600 * 1000
        const mxNow = new Date(Date.now() + MX_OFFSET_MS)
        const hour = mxNow.getUTCHours()
        const todayKey = `${mxNow.getUTCFullYear()}-${mxNow.getUTCMonth()}-${mxNow.getUTCDate()}`
        if (!economyState.nightSchedule) economyState.nightSchedule = { lastClose: null, lastOpen: null }
        const sched = economyState.nightSchedule
        if (hour === 22 && sched.lastClose !== todayKey) {
          sched.lastClose = todayKey
          queueEconomySave()
          const groups = await currentSock.groupFetchAllParticipating()
          const general = Object.values(groups).find(g => isAllowedGroup(g.id) && g.subject === GENERAL_CHAT_GROUP_NAME)
          const nocturno = Object.values(groups).find(g => isAllowedGroup(g.id) && g.subject === NIGHT_CHAT_GROUP_NAME)
          if (general) await currentSock.groupSettingUpdate(general.id, 'announcement')
          if (nocturno) {
            await currentSock.groupSettingUpdate(nocturno.id, 'not_announcement')
            await currentSock.sendMessage(nocturno.id, { text: `🌙 *El Chat General ha cerrado sus puertas por hoy.*\n\nBienvenidos al Chat Nocturno, donde despierta la Legión cuando el sol se esconde. 🐉✨\n\nQue tengan buenas noches, guerreros. Nos vemos en el General a las 8:00 a.m.` })
          }
        }
        if (hour === 8 && sched.lastOpen !== todayKey) {
          sched.lastOpen = todayKey
          queueEconomySave()
          const groups = await currentSock.groupFetchAllParticipating()
          const general = Object.values(groups).find(g => isAllowedGroup(g.id) && g.subject === GENERAL_CHAT_GROUP_NAME)
          const nocturno = Object.values(groups).find(g => isAllowedGroup(g.id) && g.subject === NIGHT_CHAT_GROUP_NAME)
          if (nocturno) await currentSock.groupSettingUpdate(nocturno.id, 'announcement')
          if (general) {
            await currentSock.groupSettingUpdate(general.id, 'not_announcement')
            await currentSock.sendMessage(general.id, { text: `☀️ *El Chat Nocturno ha cerrado sus puertas.*\n\n¡Buenos días, Legión! El Chat General vuelve a abrir. Que tengan un excelente día. 🐉` })
          }
        }
      } catch (error) {
        logger.warn({ err: error }, 'Error en el horario del chat nocturno')
      }
    }, 60 * 1000)
  }
  sock.ev.on('connection.update', async update => {
      const { connection, lastDisconnect, qr } = update
      if (qr && CONNECTION_METHOD === 'qr' && !state.creds.registered) {
        console.log('\nEscanea este QR: WhatsApp > Dispositivos vinculados > Vincular dispositivo\n')
        qrcode.generate(qr, { small: true })
      }
      if (connection === 'open') {
        pairingRequested = false
        reconnectAttempts = 0
        currentSock = sock
        logger.info({ user: sock.user?.id }, 'Bot conectado a WhatsApp')
        if (!consoleBroadcastStarted) {
          consoleBroadcastStarted = true
          setupConsoleBroadcast()
        }
        if (!nightScheduleStarted) {
          nightScheduleStarted = true
          setupNightSchedule()
        }
        void finalizeWeeklyActivity(sock).catch(error => logger.warn({ err: error }, 'No se pudo cerrar el top semanal al reconectar'))
      }
      if (connection === 'close') {
        const statusCode = new Boom(lastDisconnect?.error).output.statusCode
        if (statusCode === DisconnectReason.loggedOut) {
          logger.error('WhatsApp revocó el dispositivo. La configuración se conserva, pero es necesaria una nueva vinculación.')
          await fs.writeFile(path.join(DATA_DIR, 'REQUIERE_NUEVA_VINCULACION.txt'), 'La sesión fue revocada por WhatsApp. Vincula el dispositivo nuevamente; los comandos y el estado se conservaron.\n')
        } else {
          logger.warn({ statusCode }, 'Conexion cerrada; reintentando')
          scheduleReconnect()
        }
      }
    })

    if (!state.creds.registered && CONNECTION_METHOD === 'pairing' && !pairingRequested) {
      if (!PHONE_NUMBER) throw new Error('PHONE_NUMBER es obligatorio cuando CONNECTION_METHOD=pairing')
      pairingRequested = true
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(PHONE_NUMBER)
          console.log(`\nCodigo de vinculacion: ${code.match(/.{1,4}/g)?.join('-') || code}\n`)
          console.log('WhatsApp > Dispositivos vinculados > Vincular dispositivo > Vincular con numero de telefono')
        } catch (error) {
          pairingRequested = false
          logger.error({ err: error }, 'No se pudo generar el codigo; prueba CONNECTION_METHOD=qr')
        }
      }, 1500)
    }
  } catch (error) {
    logger.error({ err: error }, 'No se pudo iniciar el bot')
    scheduleReconnect()
  } finally {
    starting = false
  }
}

process.on('unhandledRejection', error => logger.error({ err: error }, 'Promesa no controlada'))
process.on('uncaughtException', error => logger.fatal({ err: error }, 'Error no controlado'))

// launcher.js manda SIGTERM (y da 5s antes de forzar el cierre) cuando el
// panel reinicia el servidor. Como state.json/economy.json ahora se guardan
// de forma diferida (ver queueStateSave/queueEconomySave), hay que vaciar
// cualquier guardado pendiente antes de salir para no perder datos.
let shuttingDownGracefully = false
async function shutdownGracefully(signal) {
  if (shuttingDownGracefully) return
  shuttingDownGracefully = true
  logger.info({ signal }, 'Cerrando bot de WhatsApp: guardando datos pendientes...')
  try {
    await Promise.all([flushStateSave(), flushEconomySave()])
  } catch (error) {
    logger.warn({ err: error }, 'No se pudieron guardar los datos pendientes al cerrar')
  }
  process.exit(0)
}
process.on('SIGINT', () => void shutdownGracefully('SIGINT'))
process.on('SIGTERM', () => void shutdownGracefully('SIGTERM'))

if (!ALLOWED_GROUPS.size) throw new Error('Configura ALLOWED_GROUP_JIDS antes de iniciar el bot.')
const durableCommands = new Set(['on', 'off', 'add', 'give', 'warn', 'unwarn', 'kick', 'mute', 'unmute',
  'close', 'open', 'antilink', 'adminuser', 'aceptar', 'rechazar', 'transferir', 'enviar',
  'dep', 'deposito', 'retirar', 'withdraw', 'comprar', 'vender', 'music'])
const acceptIncomingMessage = createIngress({
  allowed: isAllowedGroup,
  commandName: message => {
    const text = messageText(unwrapMessage(message.message)).trimStart()
    return text.startsWith(PREFIX) ? text.slice(PREFIX.length).trimStart().split(/\s+/, 1)[0].toLowerCase() : ''
  },
  durable: command => durableCommands.has(command),
  journal: path.join(DATA_DIR, 'processed-commands.json')
})
await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 })
await loadGroupScopes()
await loadState()
await musicCommand.start().catch(() => logger.warn('Biblioteca musical no disponible al iniciar'))
await loadEconomy()
await startBot()
