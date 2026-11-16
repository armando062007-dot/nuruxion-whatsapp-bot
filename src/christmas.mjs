import { randomUUID } from 'node:crypto'

export const START = Date.parse('2026-11-20T00:00:00-06:00')
export const END = Date.parse('2027-01-08T00:00:00-06:00')
export const COMMANDS = new Set(['navidad', 'regalos', 'jefenavidad'])
export const active = (now = Date.now()) => now >= START && now < END
const DAY = 86400000
const dateKey = now => Math.floor((now - 6 * 3600000) / DAY)
const BOSS = [
  { name: 'Ladrón de Regalos', hp: 90000, offset: 0, title: 'Guardián de los Regalos' },
  { name: 'Guardián de Hielo', hp: 180000, offset: 10, title: 'Rompehielos de Nuruxion' },
  { name: 'Coloso del Invierno', hp: 300000, offset: 25, title: 'Luz del Invierno 2026' }
]
const SHOP = { farol: [30, 'Farol del Camino'], aurora: [60, 'Viajero de la Aurora'], guardian: [100, 'Guardián del Refugio'] }
const LETTERS = ['Gracias por acompañar al equipo.', 'Tu ayuda hizo este camino más ligero.', 'Aquí también hay sitio para ti, aunque hoy no tengas ganas de celebrar.', 'No hace falta resolverlo todo para compartir un rato juntos.']
const STORIES = [
  'En aquella mesa también había sitio para quien llegara sin ganas de celebrar.',
  'El guardián dejó una luz junto a la puerta. La búsqueda de su pequeña compañera continuaba, sin noticias confirmadas.',
  'La nieve hacía más pesado el camino. Esta vez aceptó que alguien llevara parte del equipaje.',
  'Entre todos los encargos, encontró unos minutos en los que nadie le exigió una sonrisa.',
  'Un viajero leyó el aviso de búsqueda y ofreció preguntar en otra aldea. No prometió respuestas que todavía no tenía.',
  'El refugio no pedía victorias para abrir sus puertas. Bastaba con necesitar una pausa.'
]
const ROUTES = ['Posada del Farol', 'Aldea de los Pinos', 'Puente Nevado', 'Torre de la Aurora', 'Refugio del Valle']
export function winterFlavor(kind, now = Date.now()) {
  if (!active(now)) return ''
  const d = dateKey(now)
  const weather = ['Nieve suave', 'Aurora', 'Ventisca'][Math.abs(d) % 3]
  return '\n\n❄️ *Luces de Nuruxion · ' + weather + '*\n' + STORIES[Math.abs(d + (kind === 'work' ? 2 : kind === 'dungeon' ? 4 : 0)) % STORIES.length]
}
function init(root) {
  root.christmas2026 ||= { players: {}, tree: 0, caravan: 0, bosses: BOSS.map(b => ({ hp: b.hp, damage: {}, support: {}, shield: 3, warmth: 0 })), secret: {}, settings: { gifts: true, bosses: true, missions: true, exchange: true, giftLimit: 3, attackLimit: 6 }, pending: {}, audit: [] }
  return root.christmas2026
}
function player(s, id) {
  return s.players[id] ||= { stars: 0, materials: 0, parcels: 0, delivered: 0, donations: 0, crafted: 0, sent: 0, support: 0, damage: 0, clues: 0, days: {}, claims: {}, titles: [], cosmetics: [], inbox: [] }
}
function daily(p, now) { return p.days[dateKey(now)] ||= { deliveries: 0, attacks: 0, support: 0, mission: false, clues: false, letters: 0 } }
function limitedDays(p, now) { for (const k of Object.keys(p.days)) if (+k < dateKey(now) - 8) delete p.days[k] }
function bossIndex(s, now) { return BOSS.findIndex((b,i) => now >= START + b.offset * DAY && s.bosses[i].hp > 0 && (i === 0 || s.bosses[i-1].hp <= 0)) }
function top(s) {
  const rows = Object.entries(s.players).map(([id,p]) => [id,p.damage + p.support * 500]).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,10)
  return { text: '🏆 *CLASIFICACIÓN NAVIDEÑA*\nDaño + apoyo × 500 (separada del evento anterior).\n\n' + (rows.map(([id,n],i)=>`${i+1}. @${id.split('@')[0]} — ${n} puntos`).join('\n') || 'Aún no hay contribuciones.') + '\n\nPremios por jefe: 1,000 monedas + título para cada participante de combate o apoyo; reclamar con ?navidad premios. Sin Robux.', mentions: rows.map(([id])=>id) }
}

// Reductor síncrono: valida y registra antes de enviar mensajes, sin llamadas de red.
// Todas las claves de identidad/target y permisos son resueltas por el adaptador del bot.
export function runChristmas(root, { jid, group = '', command = 'navidad', input = '', owner = false, target = null, now = Date.now(), privateChat = false } = {}) {
  const args = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().split(/\s+/)
  let action = args[0] || ''
  if (command === 'regalos') { args.unshift('regalos'); action = 'regalos' }
  if (command === 'jefenavidad') { args.unshift('jefe'); action = 'jefe' }
  const reply = (text, coins = 0, mentions = []) => ({ text, coins, mentions })
  // No inicializar ni repartir nada antes de la fecha.
  if (!active(now) && !['panel','configurar','confirmar'].includes(action)) {
    if (now < START) return reply('🎄 Navidad comienza el 20 de noviembre de 2026 a las 00:00, hora de Ciudad de México. Todavía no hay recompensas ni actividades disponibles.')
    if (['top','resumen','premios'].includes(action)) { /* consulta y cobro histórico */ }
    else return reply('La temporada terminó. Conservas tu progreso, regalos y títulos. Consulta ?navidad resumen, ?navidad top o ?navidad premios.')
  }
  if (['panel','configurar','confirmar'].includes(action) && !owner) return reply('⛔ Esta herramienta es exclusiva del Owner.')
  const s = init(root)
  if (action === 'panel') return reply('🛠️ *PANEL OWNER · NAVIDAD*\nInicio fijo: 20/11/2026 00:00 CDMX. Cierre: 08/01/2027 00:00 CDMX.\n' + JSON.stringify(s.settings) + '\n?navidad configurar regalos|jefes|misiones|intercambio abrir|cerrar\n?navidad configurar limite-regalos 1-10\n?navidad configurar limite-ataques 1-12\n?navidad configurar sorteo preparar\nCada cambio requiere confirmar el código temporal. No permite adelantar la apertura. Premios: monedas virtuales y cosméticos; sin Robux.')
  if (action === 'configurar') {
    const keys = { regalos: 'gifts', jefes: 'bosses', misiones: 'missions', intercambio: 'exchange', 'limite-regalos': 'giftLimit', 'limite-ataques': 'attackLimit', sorteo: 'draw' }
    const key = Object.hasOwn(keys, args[1]) ? keys[args[1]] : null
    let value
    if (['gifts','bosses','missions','exchange'].includes(key)) value = args[2] === 'abrir' ? true : args[2] === 'cerrar' ? false : undefined
    if (['giftLimit','attackLimit'].includes(key)) { const n = Number(args[2]); if (Number.isInteger(n) && n >= 1 && n <= (key === 'giftLimit' ? 10 : 12)) value = n }
    if (key === 'draw' && args[2] === 'preparar' && active(now)) value = group
    if (value === undefined) return reply('Configuración inválida. Consulta ?navidad panel. El sorteo solo se prepara durante la temporada.')
    const token = randomUUID().replaceAll('-','').slice(0,16)
    for (const [k,v] of Object.entries(s.pending)) if (v.owner === jid || now > v.expires) delete s.pending[k]
    s.pending[token] = { owner: jid, group, key, value, expires: now + 300000 }
    return reply(`⚠️ Vas a cambiar ${args[1]} a ${args[2]}. No se borrará progreso. Confirma en este grupo antes de 5 minutos: ?navidad confirmar ${token}`)
  }
  if (action === 'confirmar') {
    const ticket = s.pending[args[1]]
    if (!ticket || ticket.owner !== jid || ticket.group !== group || now >= ticket.expires) return reply('Confirmación inválida o caducada.')
    delete s.pending[args[1]]
    if (ticket.key === 'draw') {
      if (!active(now) || !s.settings.exchange) return reply('El intercambio no está abierto.')
      const pool = s.secret[group]
      if (!pool || pool.drawn) return reply('No hay inscripciones abiertas o el sorteo ya está hecho.')
      const ids = Object.keys(pool.enrolled)
      if (ids.length < 3) return reply('Se necesitan al menos 3 inscritos voluntarios.')
      // Orden aleatorio y asignación circular: nadie se asigna a sí mismo.
      for (let i=ids.length-1;i>0;i--) { const j = Number.parseInt(randomUUID().slice(0,8),16) % (i+1); [ids[i],ids[j]]=[ids[j],ids[i]] }
      pool.pairs = Object.fromEntries(ids.map((id,i)=>[id,ids[(i+1)%ids.length]])); pool.drawn = true
    } else s.settings[ticket.key] = ticket.value
    s.audit.push({ at: now, owner: jid, group, key: ticket.key, value: ticket.value }); s.audit = s.audit.slice(-100)
    return reply('✅ Cambio confirmado y guardado. La fecha de inicio no se modificó.')
  }
  if (privateChat) {
    if (action !== 'amigo' || args[1] !== 'ver') return reply('Por privado solo está disponible ?navidad amigo ver. El resto de actividades se usa en Comandos-Bot.')
    const matches = Object.values(s.secret).filter(pool=>pool.drawn && pool.pairs?.[jid])
    return reply(matches.length ? matches.map(pool=>'🎅 Tu amigo secreto: @'+pool.pairs[jid].split('@')[0]+'\nEntrega desde el grupo con ?navidad amigo regalar. No compartas esta asignación.').join('\n\n') : 'Aún no tienes una asignación. Inscríbete voluntariamente en tu grupo con ?navidad amigo apuntarme.',0,matches.map(pool=>pool.pairs[jid]))
  }
  const p = player(s, jid), d = daily(p, now)
  limitedDays(p, now)
  if (action === 'top') return top(s)
  if (action === 'resumen' || action === 'inventario') return reply(`📖 *TU INVIERNO EN NURUXION*\n🎁 Entregas: ${p.delivered} · regalos enviados: ${p.sent}\n🛠️ Fabricados: ${p.crafted} · materiales: ${p.materials} · paquetes: ${p.parcels}\n⭐ Estrellas: ${p.stars} · apoyo: ${p.support} · daño: ${p.damage}\n🐾 Fragmentos de búsqueda: ${p.clues}/6\n🏷️ ${p.titles.join(', ') || 'Sin títulos todavía'}\n🎨 ${p.cosmetics.join(', ') || 'Sin adornos todavía'}\n✉️ ${p.inbox.slice(-5).join('\n') || 'Sin cartas recientes'}\nNo hay penalizaciones por ausentarte.`)
  if (action === 'premios') {
    let coins = 0
    s.bosses.forEach((b,i)=>{ if (b.hp <= 0 && ((b.damage[jid]||0)>0 || (b.support[jid]||0)>0) && !p.claims['boss'+i]) { p.claims['boss'+i]=true; coins+=1000; if(!p.titles.includes(BOSS[i].title))p.titles.push(BOSS[i].title) } })
    const stages = Math.min(3, Math.floor(s.tree/100))
    for (let i=1;i<=stages;i++) if(!p.claims['tree'+i]) { p.claims['tree'+i]=true; coins+=250; p.cosmetics.push(['Esfera del Clan','Guirnalda del Refugio','Estrella Comunitaria'][i-1]) }
    return reply(coins ? `🎁 Reclamaste ${coins} monedas virtuales y tus títulos/adornos nuevos. Cada premio se entrega una sola vez.` : 'No tienes premios nuevos. Conservas todos los anteriores.',coins)
  }
  if (!action || action === 'ayuda') return reply(`🎄 *NAVIDAD: LAS LUCES DE NURUXION*\n20 noviembre → 7 enero · CDMX\n🎁 ?regalos repartir · ?navidad fabricar\n📜 ?navidad misiones · ?navidad mision\n🛷 ?navidad caravana · ?navidad caravana aportar\n🎄 ?navidad arbol · ?navidad arbol aportar\n👹 ?jefenavidad · ?jefenavidad atacar|proteger|curar\n🎅 ?navidad amigo · ✉️ ?navidad carta\n🐾 ?navidad huellas · 🏠 ?navidad refugio\n🛍️ ?navidad tienda · ?navidad top\n🎁 ?navidad premios · ?navidad resumen\n${winterFlavor('daily',now)}\nNo se pierde progreso por faltar un día. Sin pagos ni premios de Robux.`)
  if (action === 'refugio') return reply('🏠 *REFUGIO DEL INVIERNO*\nAquí no necesitas demostrar nada. Puedes descansar y volver cuando quieras. No hay coste, tarea ni recompensa por quedarte.' + winterFlavor('daily',now))
  if (action === 'regalos') {
    if (!s.settings.gifts) return reply('El reparto está cerrado temporalmente.')
    if (args[1] !== 'repartir') return reply(`🎁 ?regalos repartir: entrega a una aldea, hasta ${s.settings.giftLimit} veces por día. Cada entrega: 100 monedas, 3 estrellas y 2 materiales. Sin coste.`)
    if (d.deliveries >= s.settings.giftLimit) return reply('Ya completaste los repartos disponibles de hoy. Mañana habrá nuevas rutas; no perderás nada por descansar.')
    d.deliveries++; p.delivered++; p.stars+=3; p.materials+=2
    const routes = s.caravan >= 100 ? ROUTES : ROUTES.filter(route => route !== 'Torre de la Aurora')
    const route = routes[(dateKey(now)+d.deliveries)%routes.length]
    return reply(`🎁 Entregaste provisiones en ${route}. +100 monedas, +3 estrellas y +2 materiales.\nRepartos de hoy: ${d.deliveries}/${s.settings.giftLimit}.` + winterFlavor('work',now),100)
  }
  if (action === 'fabricar') {
    if (!s.settings.gifts) return reply('El taller está cerrado temporalmente.')
    if (p.materials < 4) return reply('Un paquete cuesta 4 materiales navideños. Consíguelos repartiendo regalos o completando misiones; no se gastan objetos del inventario normal.')
    p.materials-=4; p.parcels++; p.crafted++
    return reply('🛠️ Fabricaste un paquete con 4 materiales. Úsalo en el amigo secreto o regálalo con ?navidad regalar @usuario.')
  }
  if (action === 'regalar') {
    if (!s.settings.gifts || !s.settings.exchange) return reply('Los intercambios están cerrados temporalmente.')
    if (!target || target === jid) return reply('Menciona a otra persona del grupo. No se permiten autorregalos.')
    if (p.parcels < 1) return reply('Necesitas un paquete fabricado: ?navidad fabricar.')
    p.parcels--; p.sent++; player(s,target).stars+=5
    return reply('🎁 Entregaste un paquete a @'+target.split('@')[0]+'. Recibió 5 estrellas. No se transfiere dinero real.',0,[target])
  }
  if (action === 'misiones' || action === 'mision') {
    if (!s.settings.missions) return reply('Las misiones están cerradas temporalmente.')
    if (action === 'misiones') return reply(`📜 *ENCARGOS DE INVIERNO*\nDiario: ?navidad mision — +150 monedas, 3 materiales y 5 estrellas.\nSemanal: ?navidad mision semanal, completa 6 repartos — +400 monedas y 10 estrellas.\nEncargos rotativos: recuperar paquetes, reparar faroles, llevar mantas y revisar caminos. Sin rachas obligatorias.`)
    if (args[1] === 'semanal') {
      const week = Math.floor((now-START)/(7*DAY)), key='week'+week
      p.weekly ||= {}; const delivered = p.weekly[week] || 0
      // Las entregas de la semana se calculan a partir de los contadores diarios retenidos.
      const from = dateKey(START)+week*7
      const count = Object.entries(p.days).filter(([day])=>+day>=from && +day<from+7).reduce((n,[,v])=>n+v.deliveries,0)
      if(p.claims[key])return reply('Ya cobraste el encargo semanal.')
      if(Math.max(delivered,count)<6)return reply(`Encargo semanal: ${Math.max(delivered,count)}/6 repartos. No necesitas hacerlos en días consecutivos.`)
      p.claims[key]=true; p.stars+=10; return reply('📜 Encargo semanal completado: +400 monedas y +10 estrellas.',400)
    }
    if (d.mission) return reply('Tu encargo diario ya está completo. Puedes descansar; mañana habrá otro.')
    d.mission=true; p.materials+=3; p.stars+=5
    const task=['Recuperaste paquetes junto al puente','Reparaste los faroles de la posada','Llevaste mantas al refugio','Revisaste un camino para la caravana'][dateKey(now)%4]
    return reply('📜 '+task+'. +150 monedas, +3 materiales y +5 estrellas.' + winterFlavor('daily',now),150)
  }
  if (['caravana','arbol'].includes(action)) {
    const tree = action === 'arbol', key = tree ? 'tree' : 'caravan', limit = tree ? 300 : 100
    if (args[1] !== 'aportar') return reply((tree?'🎄 Árbol del clan: ':'🛷 Reparación del trineo: ')+s[key]+'/'+limit+' materiales.\n?navidad '+action+' aportar: aporta 2 materiales. '+(tree?'Cada 100 desbloquea adornos y 250 monedas para todos mediante ?navidad premios.':'Al llegar a 100 se abre la Ruta de la Aurora y se refuerza el combate contra los jefes.'))
    if (!s.settings.missions) return reply('Las aportaciones están cerradas temporalmente.')
    if(s[key]>=limit)return reply('Esta obra comunitaria ya está completa. No se consumirán más materiales.')
    const amount=Math.min(2,limit-s[key]); if(p.materials<amount)return reply('No tienes suficientes materiales navideños.')
    p.materials-=amount; p.donations+=amount; s[key]+=amount
    return reply(`✅ Aportaste ${amount} materiales. Progreso: ${s[key]}/${limit}.`)
  }
  if (action === 'huellas') {
    if(!s.settings.missions)return reply('La ruta de búsqueda está en pausa.')
    if(d.clues)return reply('Hoy ya revisaste esta ruta. No hay nuevas noticias confirmadas.')
    if(p.clues>=6)return reply('El cuaderno conserva los seis relatos de la búsqueda. La compañera sigue perdida; no se da por hecho un final.')
    d.clues=true; const scenes=['Revisaste huellas en la nieve: no se pudo confirmar de quién eran.','Dejaste un aviso en la posada.','Un viajero ofreció preguntar en el valle.','Un sonido conocido resultó ser el viento; alguien te acompañó de regreso.','Preparaste un lugar junto al hogar, sin saber todavía dónde estaba tu compañera.','La búsqueda seguía abierta. Aceptaste descansar mientras otros revisaban otro camino.']; return reply('🐾 *RUTA DE LAS PEQUEÑAS HUELLAS*\n'+scenes[p.clues++])
  }
  if (action === 'carta') {
    const n=Number(args[1]); if(!Number.isInteger(n)||n<1||n>LETTERS.length||!target||target===jid)return reply('✉️ Menciona a alguien y elige: ?navidad carta 1 @usuario\n'+LETTERS.map((t,i)=>`${i+1}. ${t}`).join('\n'))
    if(!s.settings.exchange)return reply('Las cartas están en pausa.')
    if(d.letters>=2)return reply('Ya enviaste las dos cartas de hoy.')
    d.letters++; const receiver=player(s,target); receiver.inbox.push(LETTERS[n-1]); receiver.inbox=receiver.inbox.slice(-10)
    return reply('✉️ Para @'+target.split('@')[0]+': '+LETTERS[n-1],0,[target])
  }
  if (action === 'amigo') {
    if(!s.settings.exchange)return reply('El amigo secreto está cerrado temporalmente.')
    const pool=s.secret[group] ||= {enrolled:{},drawn:false,pairs:{},sent:{}}
    if(args[1]==='apuntarme') { if(pool.drawn)return reply('El sorteo de este grupo ya se realizó.'); pool.enrolled[jid]=true; return reply('🎅 Te inscribiste voluntariamente. Solo se usan regalos virtuales; no se comparten números públicamente. Después del sorteo consulta por privado al bot: ?navidad amigo ver. Puedes salir antes con ?navidad amigo salir.') }
    if(args[1]==='salir') {if(pool.drawn)return reply('El sorteo ya está realizado; no hay obligación de entregar ni castigo por no hacerlo.');delete pool.enrolled[jid];return reply('Saliste de la inscripción.')}
    if(args[1]==='ver')return reply('Para no revelar tu asignación al grupo, escribe por privado al bot: ?navidad amigo ver.')
    if(args[1]==='regalar') {const to=pool.pairs[jid];if(!to)return reply('Todavía no tienes asignación.');if(pool.sent[jid])return reply('Ya entregaste tu regalo secreto.');if(p.parcels<1)return reply('Primero fabrica un paquete.');pool.sent[jid]=true;p.parcels--;p.sent++;player(s,to).stars+=5;return reply('🎅 Regalo secreto entregado. La identidad del destinatario no se publica.')}
    return reply(`🎅 Amigo secreto: ${Object.keys(pool.enrolled).length} inscritos. Sorteo ${pool.drawn?'realizado':'pendiente del Owner'}.\n?navidad amigo apuntarme|salir|ver|regalar. Participación voluntaria, sin pagos ni penalizaciones.`)
  }
  if (action === 'tienda') {
    const item=Object.hasOwn(SHOP,args[1]) ? SHOP[args[1]] : null; if(!item)return reply('🛍️ *TIENDA NAVIDEÑA*\n'+Object.entries(SHOP).map(([id,[cost,name]])=>`${id}: ${name} — ${cost} estrellas`).join('\n')+'\nCompra: ?navidad tienda farol. Son adornos y títulos cosméticos, sin ventaja de combate.')
    if(p.cosmetics.includes(item[1]))return reply('Ya tienes este cosmético.')
    if(p.stars<item[0])return reply('No tienes suficientes estrellas.')
    p.stars-=item[0];p.cosmetics.push(item[1]);return reply('🎨 Desbloqueaste '+item[1]+'. Se conserva después del evento.')
  }
  if (action === 'jefe') {
    const i=bossIndex(s,now)
    if(i<0)return reply('No hay un jefe disponible ahora. Las fases se abren el 20/11, 30/11 y 15/12; cada jefe requiere derrotar al anterior. Consulta ?navidad top o ?navidad premios.')
    const b=s.bosses[i], spec=BOSS[i], mode=args[1]||''
    if(!['atacar','proteger','curar'].includes(mode))return reply(`👹 *${spec.name}*\n❤️ ${b.hp}/${spec.hp}\n${i===0?'Esquiva cada tercer ataque: el apoyo lo contrarresta.':i===1?'Escudo: '+b.shield+'/3. Proteger rompe una capa; alternen jugadores.':'Bajo 40% de vida su furia reduce daño: curar prepara calor para contrarrestarla.'}\n?jefenavidad atacar|proteger|curar\nAtaques diarios: ${d.attacks}/${s.settings.attackLimit}; apoyos: ${d.support}/3. El apoyo también cuenta para premios.`)
    if(!s.settings.bosses)return reply('Los combates están pausados por el Owner.')
    if(mode!=='atacar') {
      if(d.support>=3)return reply('Ya realizaste los tres apoyos de hoy.')
      if(i===1 && mode==='proteger' && b.lastSupport===jid && b.shield>0)return reply('Otro compañero debe alternar contigo para romper la siguiente capa.')
      d.support++;p.support++;b.support[jid]=(b.support[jid]||0)+1;b.warmth=Math.min(6,b.warmth+1);b.lastSupport=jid
      if(i===1&&mode==='proteger')b.shield=Math.max(0,b.shield-1)
      return reply('🛡️ Tu apoyo prepara el siguiente ataque del equipo'+(i===1?'. Escudo restante: '+b.shield+'/3.':'.')+' También cuenta como participación para los premios.')
    }
    if(d.attacks>=s.settings.attackLimit)return reply('Ya usaste los ataques disponibles de hoy. El descanso no quita progreso.')
    d.attacks++; let damage=1200+(s.caravan>=100?300:0);const boosted=b.warmth>0
    if(boosted)b.warmth--
    if((i===0&&d.attacks%3===0&&!boosted)||(i===1&&b.shield>0)||(i===2&&b.hp<spec.hp*.4&&!boosted))damage=Math.floor(damage/2)
    damage=Math.min(b.hp,damage); b.hp-=damage;b.damage[jid]=(b.damage[jid]||0)+damage;p.damage+=damage
    return reply(`⚔️ Causaste ${damage} de daño. ❤️ ${b.hp}/${spec.hp}.`+(b.hp===0?'\n🏆 ¡Jefe derrotado! Sus participantes pueden usar ?navidad premios. La siguiente fase respetará su fecha.':''))
  }
  return reply('No reconozco esa actividad. Consulta ?navidad ayuda.')
}
