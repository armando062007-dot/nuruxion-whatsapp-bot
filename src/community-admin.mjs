import { randomBytes } from 'node:crypto'
const canonical = value => String(value || '').replace(/:\d+(?=@)/,'').replace(/@c\.us$/,'@s.whatsapp.net').replace(/^521(\d{10})@/,'52$1@')
const title = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const admin = p => p?.admin === 'admin' || p?.admin === 'superadmin'
const fields = p => [p?.id,p?.jid,p?.phoneNumber,p?.lid].filter(Boolean).map(canonical)
const matches = (p,ids) => fields(p).some(id => ids.has(id))
const member = (g,ids) => (g?.participants || []).find(p => matches(p,ids))
const requester = (plan,ids) => [plan.actor,...(plan.actorIds || [])].some(id=>ids.has(canonical(id)))
const safeName = value => String(value || 'Grupo').replace(/[\r\n*_`~]/g,' ').slice(0,70)
async function read(promise) {
  let timer
  try { return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Consulta de WhatsApp agotada')),8000)})]) }
  finally { clearTimeout(timer) }
}
async function identity(sock,jid) {
  const ids = new Set([canonical(jid)].filter(Boolean)), mapping=sock.signalRepository?.lidMapping
  try {
    const other=String(jid).endsWith('@lid') ? await read(Promise.resolve(mapping?.getPNForLID?.(jid))) : await read(Promise.resolve(mapping?.getLIDForPN?.(canonical(jid))))
    if(other)ids.add(canonical(other))
  } catch {}
  const own=[sock.user?.id,sock.user?.lid].filter(Boolean).map(canonical)
  if(own.some(id=>ids.has(id)))for(const id of own)ids.add(id)
  return ids
}
const reasons = {ready:'se promoverá',already:'ya es admin',absent:'no pertenece',bot:'bot sin permisos de admin',unknown:'no se pudo comprobar',unlinked:'ya no está vinculado',failed:'WhatsApp rechazó la promoción',unverified:'enviado, pendiente de comprobar',promoted:'promovido y comprobado'}

export function createCommunityPromoter({ isOwner = () => false, configuredParent = '', allowedGroup = () => false, now = Date.now, invalidate = () => {} } = {}) {
  const pending = new Map(), locks = new Set()
  function prune() { for(const [key,p] of pending)if(now()>=p.expires)pending.delete(key) }
  async function scope(sock,chat,actor) {
    const all=Object.values(await read(sock.groupFetchAllParticipating()) || {})
    const parents=all.filter(g=>g.isCommunity && (configuredParent ? g.id===configuredParent : title(g.subject)==='nuruxionlegion'))
    if(parents.length!==1)throw Error('No pude identificar una única comunidad Nuruxion Legión. No se modificó ningún grupo.')
    const parent=await read(sock.groupMetadata(parents[0].id))
    if(!parent.isCommunity || (!configuredParent && title(parent.subject)!=='nuruxionlegion'))throw Error('No pude comprobar la identidad de la comunidad.')
    const origin=await read(sock.groupMetadata(chat))
    if(origin.id!==parent.id && origin.linkedParent!==parent.id)throw Error('Este comando solo funciona dentro de la comunidad Nuruxion Legión.')
    const actorIds=await identity(sock,actor), originActor=member(origin,actorIds)
    for(const id of fields(originActor))actorIds.add(id)
    const botIds=new Set([sock.user?.id,sock.user?.lid].filter(Boolean).map(canonical))
    if([...actorIds].some(id=>botIds.has(id)))for(const id of botIds)actorIds.add(id)
    if(![...actorIds].some(isOwner) && ![...actorIds].some(id=>botIds.has(id)) && !admin(member(parent,actorIds)))throw Error('Solo Owner o administradores de la comunidad pueden preparar o confirmar esta promoción masiva.')
    const groups=all.filter(g=>g.linkedParent===parent.id && g.id!==parent.id && allowedGroup(g.id))
    if(groups.length>60)throw Error('La comunidad tiene demasiados grupos para una sola operación segura.')
    return {parent,origin,actorIds,botIds,groups}
  }
  async function check(sock,id,parentId,targetIds,botIds) {
    try {
      const group=await read(sock.groupMetadata(id))
      const row={id,name:safeName(group.subject)}
      if(group.linkedParent!==parentId || group.isCommunity)return {...row,status:'unlinked'}
      const p=member(group,targetIds)
      if(!p)return {...row,status:'absent'}
      if(admin(p))return {...row,status:'already'}
      if(!admin(member(group,botIds)))return {...row,status:'bot'}
      return {...row,status:'ready',participant:p.id || p.jid || p.phoneNumber || p.lid}
    } catch { return {id,name:'Grupo no disponible',status:'unknown'} }
  }
  return {
    hasPending(chat,actor) {
      return [...pending.values()].some(p=>p.chat===chat && requester(p,new Set([canonical(actor)])) && now()<p.expires)
    },
    async hasPendingFor(sock,chat,actor) {
      if(this.hasPending(chat,actor))return true
      if(![...pending.values()].some(p=>p.chat===chat && now()<p.expires))return false
      const ids=await identity(sock,actor)
      return [...pending.values()].some(p=>p.chat===chat && requester(p,ids) && now()<p.expires)
    },
    async respond(sock,{chat,actor,accept}) {
      let found=[...pending.entries()].find(([,p])=>p.chat===chat && requester(p,new Set([canonical(actor)])))
      if(!found && [...pending.values()].some(p=>p.chat===chat)) {
        const ids=await identity(sock,actor)
        found=[...pending.entries()].find(([,p])=>p.chat===chat && requester(p,ids))
      }
      if(!found)return {handled:false}
      const [token,plan]=found
      if(now()>=plan.expires){pending.delete(token);return {handled:true,text:'⏳ La solicitud de administrador caducó. Vuelve a usar ?adminuser mencionando a la persona.',mentions:[]}}
      if(accept!==true){pending.delete(token);return {handled:true,text:'✅ Promoción cancelada. No se modificó ningún permiso.',mentions:[]}}
      return {handled:true,...await this.confirm(sock,{chat,actor,token})}
    },
    async prepare(sock,{chat,actor,target,prefix='?'}) {
      prune()
      // Una nueva petición sustituye a la anterior aunque no haya grupos elegibles.
      for(const [key,p]of pending)if(p.chat===chat && requester(p,new Set([canonical(actor)])))pending.delete(key)
      const s=await scope(sock,chat,actor)
      for(const [key,p]of pending)if(p.chat===chat && requester(p,s.actorIds))pending.delete(key)
      const targetIds=await identity(sock,target), current=member(s.origin,targetIds)
      if(!current)throw Error('La persona debe aparecer como miembro del grupo desde el que ejecutas el comando.')
      for(const id of fields(current))targetIds.add(id)
      if([...targetIds].some(id=>s.botIds.has(id)))throw Error('El bot no puede promoverse a sí mismo.')
      const targetJid=[...targetIds].find(id=>id.endsWith('@s.whatsapp.net')) || canonical(target)
      const rows=[]
      // Tres consultas simultáneas como máximo para no saturar WhatsApp.
      for(let i=0;i<s.groups.length;i+=3)rows.push(...await Promise.all(s.groups.slice(i,i+3).map(g=>check(sock,g.id,s.parent.id,targetIds,s.botIds))))
      const eligible=rows.filter(r=>r.status==='ready')
      const list=rows.map(r=>`• ${r.name}: ${reasons[r.status]}`).join('\n') || 'No hay grupos vinculados disponibles para el bot.'
      if(!eligible.length)return {text:'ℹ️ *ADMINUSER · COMUNIDAD*\n\n'+list+'\n\nNo hay promociones posibles. No se cambió ningún permiso.',mentions:[targetJid]}
      if(pending.size>=100)throw Error('Hay demasiadas solicitudes pendientes. Espera unos minutos.')
      for(const [key,p]of pending)if(p.chat===chat && requester(p,s.actorIds))pending.delete(key)
      const token=randomBytes(16).toString('hex')
      pending.set(token,{chat,actor:canonical(actor),actorIds:[...s.actorIds],targetJid,targetIds:[...targetIds],parent:s.parent.id,groups:eligible.map(r=>r.id),expires:now()+300000})
      return {text:'🛡️ *ADMINUSER · NURUXION*\n\n'+list+'\n\n¿Confirmas hacer admin a @'+targetJid.split('@')[0]+' en todos los grupos disponibles de Nuruxion? ('+eligible.length+' grupo(s))\n\n*'+prefix+'aceptar* para confirmar\n*'+prefix+'rechazar* para cancelar\n\nSolo quien inició la solicitud puede responder, en este mismo grupo, durante 5 minutos. No cambia el propietario ni añade a la persona a otros grupos.',mentions:[targetJid],token}
    },
    async confirm(sock,{chat,actor,token}) {
      prune()
      const plan=pending.get(String(token || '').toLowerCase())
      const ids=plan && requester(plan,new Set([canonical(actor)])) ? new Set([canonical(actor)]) : await identity(sock,actor)
      if(!plan || plan.chat!==chat || !requester(plan,ids))throw Error('Confirmación inválida, usada o caducada. Vuelve a mencionar a la persona con ?adminuser.')
      const s=await scope(sock,chat,actor)
      if(pending.get(String(token).toLowerCase())!==plan)throw Error('Esta confirmación ya fue usada o sustituida. Prepara una nueva solicitud.')
      if(now()>=plan.expires){pending.delete(String(token).toLowerCase());throw Error('La confirmación caducó mientras se comprobaban los grupos. Prepara una nueva solicitud.')}
      if(s.parent.id!==plan.parent || !plan.actorIds.some(id=>s.actorIds.has(id)))throw Error('La comunidad o la identidad de quien confirma cambió. Prepara una nueva solicitud.')
      const lock=plan.parent+':'+plan.targetJid
      if(locks.has(lock))throw Error('Ya hay una promoción en curso para esta persona. Espera el resultado.')
      pending.delete(String(token).toLowerCase()); locks.add(lock)
      const results=[],targetIds=new Set(plan.targetIds), linked=new Set(s.groups.map(g=>g.id))
      try {
        for(const id of plan.groups) {
          if(!linked.has(id)){results.push({id,name:'Grupo desvinculado',status:'unlinked'});continue}
          const row=await check(sock,id,plan.parent,targetIds,s.botIds)
          if(row.status!=='ready'){results.push(row);continue}
          try {
            const response=await sock.groupParticipantsUpdate(id,[row.participant],'promote')
            invalidate(id)
            if(!Array.isArray(response)||response.length!==1||String(response[0].status)!=='200'){results.push({...row,status:'failed'});continue}
            const verified=await check(sock,id,plan.parent,targetIds,s.botIds)
            results.push({...row,status:verified.status==='already'?'promoted':'unverified'})
          } catch { invalidate(id);results.push({...row,status:'unverified'}) }
        }
      } finally { locks.delete(lock) }
      const promoted=results.filter(r=>r.status==='promoted').length
      return {text:'🛡️ *RESULTADO ADMINUSER*\n\n'+results.map(r=>'• '+r.name+': '+reasons[r.status]).join('\n')+'\n\n✅ Promociones comprobadas: '+promoted+'/'+plan.groups.length+'.\nNo se realizaron cambios fuera de la lista confirmada. Los resultados pendientes no se reintentan automáticamente.',mentions:[plan.targetJid],audit:{at:now(),actor:canonical(actor),target:plan.targetJid,parent:plan.parent,results:results.map(({id,status})=>({id,status}))}}
    }
  }
}
