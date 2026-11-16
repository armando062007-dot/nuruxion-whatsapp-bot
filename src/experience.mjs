const n = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0)
const fmt = value => Math.floor(n(value)).toLocaleString('es-MX')
export function progress(value, goal, size = 8) {
  const limit = Math.max(1,n(goal)), amount = Math.min(limit,n(value))
  const filled = Math.floor(amount / limit * size)
  return '▰'.repeat(filled) + '▱'.repeat(size-filled) + ` ${fmt(amount)}/${fmt(limit)}`
}
export function missionView(snapshot, rewards = [], story = '') {
  const daily = n(snapshot.dailyMessages), weekly = n(snapshot.weeklyDays)
  const line = (name,value,goal) => `${value>=goal?'✅':'▫️'} *${name}*\n${progress(value,goal)}`
  return '📜 *MISIONES DE NURUXION*\n\n'+line('Conversación diaria',daily,10)+'\n'+(daily>=10?'Meta completada.':'Faltan '+fmt(10-daily)+' mensajes válidos; el spam no cuenta.')+'\n\n'+line('Participación semanal',weekly,4)+'\n'+(weekly>=4?'Meta completada.':'Puedes completarla a tu ritmo durante la semana.')+'\n\n🐉 Daño comunitario acumulado: '+fmt(snapshot.bossDamage)+'\n\n'+(rewards.length?'🎁 *Acabas de recibir*\n• '+rewards.join('\n• '):'Las recompensas se entregan automáticamente al completar cada meta; consultarlas otra vez no las duplica.')+story
}
const RANKS = [[0,'Aprendiz del gremio'],[10,'Oficial del gremio'],[30,'Artesano de confianza'],[75,'Maestro de encargos'],[150,'Referente del gremio']]
function entry(root,jid) {
  root.journey ||= {}
  return root.journey[jid] ||= { work:0, daily:0, bestFloor:0, steps:0, rewards:[], chapters:[] }
}
function rank(count) { return RANKS.filter(([v])=>count>=v).at(-1) }
export function recordReward(root,jid,type,coins,xp,now=Date.now()) {
  const p = entry(root,jid), previous = rank(p.work)[1]
  if(type==='work')p.work++
  if(type==='daily')p.daily++
  p.rewards.push({type,coins:n(coins),xp:n(xp),at:now});p.rewards=p.rewards.slice(-6)
  if(type!=='work')return ''
  const current=rank(p.work), next=RANKS.find(([v])=>v>p.work)
  return '\n\n🧰 *Oficio · '+current[1]+'*\n'+(next?progress(p.work,next[0])+' jornadas registradas · siguiente distinción: '+next[1]:fmt(p.work)+' jornadas registradas · distinción máxima')+(current[1]!==previous?'\n🏅 ¡Nueva distinción desbloqueada! Es cosmética; no cambia el pago.':'')+'\nRegistro desde esta actualización; sin obligación de mantener una racha.'
}
const CHAPTERS = [
  [5,'La mochila invisible','En la primera pausa alguien ofreció llevar parte de la carga, sin pedir explicaciones.'],
  [15,'La luz del umbral','El viajero recordó la lámpara de casa y a la compañera que seguía buscando. No había noticias confirmadas.'],
  [30,'Un mapa compartido','Seguía sin tener todas las respuestas. Esta vez dejó que otros revisaran un camino mientras descansaba.']
]
export function recordDungeon(root,jid,floor) {
  const p=entry(root,jid);p.steps++;p.bestFloor=Math.max(n(p.bestFloor),n(floor))
  const fresh=CHAPTERS.filter(([at,title])=>p.bestFloor>=at&&!p.chapters.includes(title))
  for(const [,title] of fresh)p.chapters.push(title)
  return fresh.map(([,title,text])=>'\n\n📖 *Diario · '+title+'*\n'+text).join('')
}
export function dungeonView(state) {
  const floor=Math.max(1,n(state.currentFloor)), maxHp=Math.max(1,n(state.maxHp)||10), hp=Math.min(maxHp,n(state.hp??maxHp))
  const boss = Math.ceil(floor/5)*5
  return '\n\n🧭 *Ruta de exploración*\nPiso '+fmt(floor)+' · '+(floor%5===0?'piso de jefe':'próximo piso de jefe: '+fmt(boss))+'\n❤️ '+progress(hp,maxHp)+(hp<=maxHp*.25?'\nTu personaje está debilitado. Revisa las opciones del encuentro antes de arriesgar el botín.':'')
}
export function journeyView(root,jid,self=false) {
  const p=root.journey?.[jid];if(!p)return '\n\n📖 El diario comenzará con la próxima recompensa o exploración.'
  let text='\n\n📖 *Diario de aventuras*\n🧰 '+rank(p.work)[1]+' · '+fmt(p.work)+' jornadas\n🎁 '+fmt(p.daily)+' recompensas diarias registradas\n🧭 Mejor piso registrado: '+fmt(p.bestFloor)+'\nCapítulos: '+(p.chapters.join(' · ')||'Por descubrir en la mazmorra')
  if(self && p.rewards.length)text+='\n\n🧾 *Últimas recompensas de daily/work*\n'+p.rewards.slice(-3).map(r=>new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Mexico_City'}).format(new Date(r.at))+' · '+(r.type==='work'?'Trabajo':'Diaria')+': +'+fmt(r.coins)+' monedas · +'+fmt(r.xp)+' XP').join('\n')
  return text.length > 430 ? text.slice(0,426)+'…' : text
}
export function dailyView(streak, nextAt) {
  const stage=n(streak)%7||7
  return '\n\n🎯 *Camino al bono semanal*\n'+progress(stage,7)+'\n⏰ Próxima recompensa: '+new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'America/Mexico_City'}).format(new Date(nextAt))+' (CDMX)'
}
export function inventoryView(inventory, findItem, now=Date.now()) {
  const groups = { 'Equipo y herramientas':[], 'Consumibles y defensas':[], 'Distinciones y colección':[], 'Otros objetos':[] }
  const counts=new Map();for(const id of inventory.owned||[])counts.set(id,(counts.get(id)||0)+1)
  for(const [id,count] of counts) {
    const item=findItem(id), label=(item?.name||id)+(count>1?' ×'+count:'')+(inventory.equippedSword===id?' ✓ equipado':'')
    const group=/pico|espada|cuerda|cofre/.test(id)?'Equipo y herramientas':['temporal','escudo','rush'].includes(item?.category)?'Consumibles y defensas':['permanente','temporada'].includes(item?.category)?'Distinciones y colección':'Otros objetos'
    groups[group].push(label)
  }
  const sections=Object.entries(groups).filter(([,items])=>items.length).map(([name,items])=>'*'+name+'*\n'+items.slice(0,4).map(x=>'• '+x).join('\n')+(items.length>4?'\n… y '+(items.length-4)+' tipos más':''))
  const buffs=Object.entries(inventory.buffs||{}).filter(([,until])=>until>now).map(([id,until])=>(findItem(id)?.name||id)+' · '+Math.ceil((until-now)/60000)+' min')
  let text='🎒 *TU INVENTARIO*\n'+(sections.length?sections.join('\n\n'):'Todavía no tienes objetos guardados.')+'\n\n✨ *Efectos activos*\n'+(buffs.slice(0,3).join('\n')||'Ninguno; los efectos vencidos no se muestran.')
  if(inventory.equippedSword&&!counts.has(inventory.equippedSword))text+='\n⚔️ Equipo sin objeto disponible: revisa tu selección.'
  return text.length>850?text.slice(0,846)+'…':text
}
