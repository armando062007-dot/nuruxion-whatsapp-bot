import fs from 'node:fs/promises'
import path from 'node:path'
import { randomInt } from 'node:crypto'
import { makeDiscovery, normalizeMusic, comparable } from './music-discovery.mjs'
import { createMusicLibrary, genres, resolveGenre, fingerprint } from './music-library.mjs'
import { maxCompactBytes } from './music-compact.mjs'
import { createMusicClassifier } from './music-classifier.mjs'
import { createMusicCache } from './music-cache.mjs'
import { createMusicRuntime } from './music-runtime.mjs'
import { createIncompetech, incompetechCredit, isIncompetechAudio } from './music-incompetech.mjs'
import { createCommonsMusic, commonsCredit } from './music-commons.mjs'
import { createMixter, mixterCredit } from './music-ccmixter.mjs'

const text=s=>String(s||'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,140)
const safeName=s=>text(s).replace(/[\\/:*?"<>|]/g,'_')
const keyRE=/^[a-f\d]{64}$/
const videoRE=/^[A-Za-z0-9_-]{11}$/
const authorizationValid=a=>a&&typeof a==='object'&&typeof a.basis==='string'&&a.basis.trim()&&typeof a.provenance==='string'&&a.provenance.trim()
const choose=items=>items[randomInt(items.length)]
const noAudio='🎵 No encontré una pista con audio disponible para esa búsqueda.'
export function normalizePlayQuery(value){
 const query=normalizeMusic(value).replace(/\s+\((?:actor|artista|t[ií]tulo|nombre de la m[uú]sica)\)$/u,'')
 // Corrige el nombre artístico, sin modificar títulos que contengan esa palabra.
 return query.replace(/^(yt )?marshmellow$/u,(_,prefix='')=>prefix+'marshmello')
}
const wordsContain=(value,phrase)=>(' '+value+' ').includes(' '+phrase+' ')
function matchesLocalRecording(hit,item){
 if(!item.file||item.videoId)return false
 const title=comparable(item.title), artist=comparable(item.artist)
 if(!title||!artist)return false
 const hitTitle=comparable(hit.title).replace(/ (?:official|oficial|video|music|audio|hd|4k)(?: (?:official|oficial|video|music|audio|hd|4k))*$/,'')
 const hitArtist=comparable(hit.artist).replace(/(?: official(?: artist channel)?| vevo| topic)$/,'')
 return (hitTitle===title&&hitArtist===artist)||hitTitle===artist+' '+title||hitTitle===title+' '+artist
}
export function poolForPlayback(items,recent){
 const remaining=items.filter(t=>!recent.includes(t.id))
 const noLast=items.filter(t=>t.id!==recent[0])
 const pool=remaining.length?remaining:noLast.length?noLast:items
 if(!pool.length)return []
 const min=Math.min(...pool.map(t=>t.plays||0))
 return pool.filter(t=>(t.plays||0)<=min+2)
}
export function createMusicSystem({catalogPath,musicDir,fallback=[],ffmpegPath,env=process.env,onError=()=>{},discovery,library,openMusic=library?null:createIncompetech(),commonsMusic=library?null:createCommonsMusic(),mixter=!library&&env.MUSIC_CCMIXTER==='1'?createMixter():null}){
 const root=path.resolve(env.MUSIC_LIBRARY_DIR||'./data/music-library')
 const runtimeStatus=status=>console.info('[music] '+status)
 let engineStatus='Verificando yt-dlp'
 let searchStatus='Sin búsquedas en este arranque'
 const ytDlp=createMusicRuntime({root,configured:env.MUSIC_YTDLP,onStatus:status=>{
  engineStatus=status
  runtimeStatus(status)
  void fs.writeFile(path.join(root,'search-runtime.json'),JSON.stringify({status,checkedAt:new Date().toISOString()}),{mode:0o600}).catch(onError)
 }})
 const history=Number(env.MUSIC_RECENT_COUNT||8)
 const catalog=library||createMusicLibrary({root,inbox:path.resolve(env.MUSIC_INBOX_DIR||musicDir),ffmpeg:env.MUSIC_FFMPEG||ffmpegPath||'ffmpeg',ffprobe:env.MUSIC_FFPROBE||'ffprobe',ytDlp,origin:env.MUSIC_AUDIO_ORIGIN,historySize:Number.isInteger(history)?Math.min(50,Math.max(1,history)):8,
  classifier:createMusicClassifier({models:env.MUSIC_MODEL_DIR,python:env.MUSIC_PYTHON||'python3'}),onError})
 const discover=discovery||makeDiscovery({binary:ytDlp,onStatus:status=>{searchStatus=status;runtimeStatus(status)}})
 let manifest=[], prepared=[], startup
 const oldCache=createMusicCache({dir:path.resolve(env.MUSIC_CACHE_DIR||'./data/music-cache')})
 const active=new Set(), cooldown=new Map()
 function start(){
  return startup??=(async()=>{
   await catalog.start()
   if(!library)void (async()=>{
    const result=await catalog.compactStored()
    const report=path.join(root,'compaction-under-1mb.json')
    let sample
    if(openMusic&&!await fs.access(report).then(()=>true,()=>false)){
     let track
     try{
      const [spec]=await openMusic.find('The Britons')
      if(spec){
       track=await catalog.import(spec)
       if(await catalog.useFile(track,async()=>{}))sample={title:track.title,bytes:track.size,duration:track.duration,encoding:track.encoding}
      }
     }catch{onError(Error('No se pudo validar la compresión musical'))}
     finally{if(track)catalog.finishPlayback(track)}
    }
    await fs.writeFile(report,JSON.stringify({...result,maxBytes:999999,sample,checkedAt:new Date().toISOString()}),{mode:0o600})
   })().catch(onError)
   if(!library&&mixter)void (async()=>{
    const file=path.join(root,'ccmixter-probe-v1.json')
    if(await fs.access(file).then(()=>true,()=>false))return
    const rows=await mixter('hip hop','Hip-hop')
    let status='sin pistas verificables',bytes
    for(const spec of rows.slice(0,3)){
     let track
     try{
      track=await catalog.import(spec)
      if(await catalog.useFile(track,async()=>{})){status='MP3 convertido e íntegro';bytes=track.size;break}
     }catch{status='descarga o conversión fallida'}
     finally{if(track)catalog.finishPlayback(track)}
    }
    await fs.writeFile(file,JSON.stringify({status,candidates:rows.length,bytes,checkedAt:new Date().toISOString()}),{mode:0o600})
   })().catch(onError)
   if(!library&&commonsMusic)void (async()=>{
    const probeFile=path.join(root,'commons-probe-v2.json')
    if(await fs.access(probeFile).then(()=>true,()=>false))return
    const candidates=await commonsMusic('Beethoven Moonlight Sonata')
    let status='sin candidato verificable',bytes
    for(const spec of candidates.slice(0,3)){
     let track
     try{
      track=await catalog.import(spec)
      if(await catalog.useFile(track,async()=>{})){status='MP3 convertido e íntegro';bytes=track.size;break}
     }catch{status='descarga o conversión fallida'}
     finally{if(track)catalog.finishPlayback(track)}
    }
    await fs.writeFile(probeFile,JSON.stringify({status,candidates:candidates.length,bytes,checkedAt:new Date().toISOString()}),{mode:0o600})
   })().catch(onError)
   if(!library&&openMusic)void (async()=>{
    const probeFile=path.join(root,'incompetech-probe-v2.json')
    if(await fs.access(probeFile).then(()=>true,()=>false))return
    let track
    const [spec]=await openMusic.find('The Britons')
    let status=spec?'archivo no procesado':'catálogo no accesible'
    if(spec)try{
     track=await catalog.import(spec)
     if(await catalog.useFile(track,async()=>{}))status='MP3 convertido e íntegro'
    }catch{status='descarga o conversión fallida'}
    finally{if(track)catalog.finishPlayback(track)}
    const counts=await openMusic.counts()
    await fs.writeFile(probeFile,JSON.stringify({status,tracks:[...counts.values()].reduce((n,x)=>n+x,0),genres:counts.size,checkedAt:new Date().toISOString()}),{mode:0o600})
   })().catch(onError)
   if(!library&&!discovery)void (async()=>{
    const probeFile=path.join(root,'search-probe-v2.json')
    if(await fs.access(probeFile).then(()=>true,()=>false))return
    const results=await Promise.all(['Caballo Dorado','Linkin Park'].map(async artist=>{
     const status=[]
     const probe=makeDiscovery({binary:ytDlp,onStatus:value=>status.push(value)})
     const matches=await probe(artist).catch(()=>[])
     return {artist,results:matches.length,status}
    }))
    await fs.writeFile(probeFile,JSON.stringify({checkedAt:new Date().toISOString(),results}),{mode:0o600})
   })().catch(onError)
   await oldCache.sweep().catch(onError)
   setInterval(()=>void oldCache.sweep().catch(onError),60000).unref()
   try{
    const rows=JSON.parse(await fs.readFile(catalogPath,'utf8'))
    if(!Array.isArray(rows))throw Error('Catálogo autorizado inválido')
    manifest=rows.filter(t=>t&&typeof t.title==='string'&&typeof t.artist==='string'&&(t.file||t.source||t.authorization?.youtubeDownload===true))
   }catch(e){if(e.code!=='ENOENT')onError(e)}
   if(!manifest.length)manifest=fallback
   try{
    const file=path.join(musicDir,'nuruxion-compact.json')
    if((await fs.stat(file)).size>1024*1024)throw Error('Índice musical demasiado grande')
    const rows=JSON.parse(await fs.readFile(file,'utf8'))
    if(Array.isArray(rows))prepared=rows.filter(t=>t&&/^nuruxion-[A-Z0-9]+\.mp3$/.test(t.file||'')&&keyRE.test(t.sha256||'')&&isIncompetechAudio(t))
   }catch(e){if(e.code!=='ENOENT')onError(e)}
   if(!library&&prepared.length)void (async()=>{
    let count=0,total=0,max=0
    for(const row of prepared){
     const file=path.join(musicDir,row.file)
     const stat=await fs.lstat(file).catch(()=>null)
     if(!stat?.isFile()||!stat.size||stat.size>maxCompactBytes||await fingerprint(file).catch(()=>null)!==row.sha256)continue
     count++;total+=stat.size;max=Math.max(max,stat.size)
    }
    let sample
    let track
    try{
     track=await catalog.import({...prepared[0],legacyDir:musicDir,precompressed:true})
     if(await catalog.useFile(track,async()=>{}))sample={title:track.title,bytes:track.size,encoding:track.encoding}
    }catch{onError(Error('No se pudo validar el paquete musical'))}
    finally{if(track)catalog.finishPlayback(track)}
    await fs.writeFile(path.join(root,'prepared-pack-probe.json'),JSON.stringify({count,expected:prepared.length,total,max,sample,checkedAt:new Date().toISOString()}),{mode:0o600})
   })().catch(onError)
  })()
 }
 function spec(item){
  const youtubeDownload=!item.file&&!item.source&&item.authorization?.youtubeDownload===true
  if(youtubeDownload&&(!authorizationValid(item.authorization)||!videoRE.test(item.videoId||'')))return null
  if(item.source&&!authorizationValid(item.authorization))return null
  return {file:item.file,source:item.source,title:item.title,artist:item.artist,youtubeDownload,transient:true,videoId:videoRE.test(item.videoId||'')?item.videoId:null,legacyDir:musicDir,
   authorization:item.authorization||{basis:'archivo local administrado',provenance:'catálogo local preexistente'}}
 }
 async function deliver(track,group,query,sendAudio,reply){
  if(track.availability==='uncached'&&track.importSpec)track=await catalog.import(track.importSpec)
  try{
   if(!await catalog.useFile(track,file=>sendAudio({url:file},{mimetype:'audio/mpeg',ptt:false,fileName:safeName(track.artist+' - '+track.title)+'.mp3'})))return false
   const credit=incompetechCredit(track)||commonsCredit(track)||mixterCredit(track)
   if(credit&&reply)await Promise.resolve().then(()=>reply(credit)).catch(()=>onError(Error('No se pudo enviar el crédito musical')))
   await catalog.played(track,group,query)
   return true
  }finally{catalog.finishPlayback(track)}
 }
 async function play({query,group,actor,prefix,reply,sendAudio}){
  const normalized=normalizePlayQuery(query)
  if(!normalized||normalized.length>150||/https?:\/\//i.test(normalized)){await reply('🎵 Usa *'+prefix+'play <título, artista o género>* sin enlaces.');return}
  const cooldownKey=group+'\0'+actor
  const now=Date.now()
  if(active.has(group)||active.size>=6||(cooldown.get(cooldownKey)||0)>now){await reply('⏳ Ya hay una solicitud en curso o reciente. Inténtalo en unos segundos.');return}
  if(cooldown.size>5000){for(const [k,expiry] of cooldown)if(expiry<=now)cooldown.delete(k)}
  if(cooldown.size>=6000)cooldown.delete(cooldown.keys().next().value)
  cooldown.set(cooldownKey,now+4000)
  active.add(group)
  try{
   const history=catalog.group(group),recent=history?.recent||[]
   const savedQuery=normalized==='otra'?history?.query:normalized
   if(!savedQuery){await reply('🎵 Todavía no hay una búsqueda anterior en este chat.');return}
   const forceYouTube=savedQuery==='yt'||savedQuery.startsWith('yt ')
   const q=forceYouTube?savedQuery.slice(2).trim():savedQuery
   if(!q){await reply('🔎 Usa *'+prefix+'play yt <canción o artista>*.');return}
   if(forceYouTube&&/^\(?\s*(artista|cancion|t[ií]tulo)\s*\)?$/i.test(q)){
    await reply('🔎 Sustituye el ejemplo por un nombre, como *'+prefix+'play yt Alan Walker*.');return
   }
   const genre=forceYouTube?undefined:resolveGenre(q)
   const comparableQuery=comparable(q.replace(/^\(([^()]*)\)$/,'$1'))
   const matches=t=>q==='random'||(genre?t.genre===genre:Boolean(comparableQuery)&&(
    wordsContain(comparable(t.title),comparableQuery)||wordsContain(comparable(t.artist),comparableQuery)||
    comparable(t.artist+' '+t.title)===comparableQuery||comparable(t.title+' '+t.artist)===comparableQuery||
    comparable(t.artist).replace(/ /g,'')===comparableQuery.replace(/ /g,'')
   ))
   const exactArtist=t=>Boolean(comparableQuery)&&comparable(t.artist).replace(/ /g,'')===comparableQuery.replace(/ /g,'')
   const sendTrack=track=>deliver(track,group,savedQuery,sendAudio,reply)
   async function tryCommons(){
    if(!commonsMusic||genre||q==='random')return false
    const recorded=new Map(catalog.list().map(t=>[t.source,t]))
    const candidates=[...await commonsMusic(q)]
    candidates.sort((a,b)=>Number(recent.includes(recorded.get(a.source)?.id))-Number(recent.includes(recorded.get(b.source)?.id)))
    for(const spec of candidates.slice(0,3)){
     try{if(await sendTrack(await catalog.import(spec)))return true}catch{onError(Error('Audio de Commons no disponible'))}
    }
    return false
   }
   async function tryOpen(){
    if(!openMusic&&!mixter&&!prepared.length)return false
    const recorded=new Map(catalog.list().map(t=>[t.source,t]))
    const availablePrepared=prepared.filter(t=>q==='random'||(genre?t.genre===genre:matches(t)||q==='incompetech'))
    const ready=availablePrepared.map(t=>({...t,legacyDir:musicDir,precompressed:true}))
    const needsAlternatives=(genre||q==='random'||normalized==='otra')&&ready.every(t=>recent.includes(recorded.get(t.source)?.id))
    const results=ready.length&&!needsAlternatives?[ready]:[ready,...await Promise.all([openMusic?.find(q,genre)||[],mixter?.(q,genre)||[]])]
    let candidates=results.flat().map(spec=>({
     spec,id:recorded.get(spec.source)?.id||spec.source,plays:recorded.get(spec.source)?.plays||0
    }))
    for(let attempts=0;candidates.length&&attempts<3;attempts++){
     const selected=choose(poolForPlayback(candidates,recent))
     candidates=candidates.filter(t=>t!==selected)
     try{if(await sendTrack(await catalog.import(selected.spec)))return true}catch{onError(Error('Audio de Incompetech no disponible'))}
    }
    return false
   }
   async function tryLocal(match=matches){
   let eligible=catalog.list().filter(t=>['available','uncached'].includes(t.availability)&&match(t))
   if(!genre&&q!=='random'&&eligible.some(t=>normalizeMusic(t.title)===q))eligible=eligible.filter(t=>normalizeMusic(t.title)===q)
   while(eligible.length){
    const track=choose(poolForPlayback(eligible,recent))
    try{if(await sendTrack(track))return true}catch{onError(Error('No se pudo reproducir pista guardada'))}
    eligible=eligible.filter(t=>t.id!==track.id)
   }
   const legacy=manifest.filter(t=>q==='random'||(genre?(t.tags||[]).some(tag=>resolveGenre(tag)===genre):match(t)))
   if(legacy.length){
    const exact=legacy.filter(t=>normalizeMusic(t.title)===q)
    const options=[...(exact.length?exact:legacy)]
    for(let i=options.length-1;i>0;i--){const j=randomInt(i+1);[options[i],options[j]]=[options[j],options[i]]}
    for(const item of options.slice(0,6)){
     const candidate=spec(item)
     if(!candidate)continue
     try{const track=await catalog.import(candidate);if((!genre||track.genre===genre)&&await sendTrack(track))return true}catch{onError(Error('Pista local no disponible'))}
    }
   }
   return false
   }
   if(!forceYouTube&&(genre||q==='random')&&await tryOpen())return
   if(!forceYouTube&&await tryLocal())return
   if(!forceYouTube&&!genre&&q!=='random'&&(await tryOpen()||await tryCommons()))return
   if(!forceYouTube&&q==='random'){await reply('🎵 No hay pistas disponibles en la biblioteca.');return}
   const hits=await discover(q).catch(e=>{if(!forceYouTube)throw e;return []})
   if(!hits.length){
    if(forceYouTube&&(await tryLocal()||await tryOpen()||await tryCommons()))return
    await reply(noAudio)
    return
   }
   const choices=[...hits].sort((a,b)=>Number(recent.includes(catalog.fromVideo(a.id)?.id))-Number(recent.includes(catalog.fromVideo(b.id)?.id)))
   for(const hit of choices.slice(0,12)){
    const existing=catalog.fromVideo(hit.id)
    if(existing&&(!genre||existing.genre===genre)){
     try{if(await sendTrack(existing))return}catch{onError(Error('Audio guardado no disponible'))}
    }
    const namedMatches=manifest.filter(t=>matchesLocalRecording(hit,t))
    const allowed=manifest.find(t=>t.videoId===hit.id)||(namedMatches.length===1?namedMatches[0]:null)
    const candidate=allowed&&spec(allowed)
    if(!candidate)continue
    try{const track=await catalog.import(candidate);if((!genre||track.genre===genre)&&await sendTrack(track))return}catch{onError(Error('Audio autorizado no disponible'))}
   }
   if(forceYouTube&&(await tryLocal(exactArtist)||await tryOpen()||await tryCommons()))return
   await reply(noAudio)
  }catch{onError(Error('Solicitud musical fallida'));await reply('⚠️ No pude completar la búsqueda o reproducción. Inténtalo más tarde.')}
  finally{active.delete(group)}
 }
 async function handle(context){
  const {command,query,prefix,reply,authorize}=context
  try{await start()}catch{await reply('⚠️ La biblioteca musical no está disponible.');return}
  if(command==='play'||command==='musica')return play(context)
   if(command==='generos'){
    const counts=await openMusic?.counts?.()||new Map()
    const local=catalog.list().filter(t=>t.authorization?.provider!=='incompetech'&&['available','uncached'].includes(t.availability))
    const entries=genres.map(g=>[g,(counts.get(g)||0)+local.filter(t=>t.genre===g).length]).filter(([,n])=>n>0)
    await reply(entries.length?'🎼 *Géneros con audio disponible*\n'+entries.map(([g,n])=>g+' · '+n).join('\n'):'🎼 No hay géneros disponibles ahora.')
    return
   }
  const [raw,...parts]=query.trim().split(/\s+/),action=normalizeMusic(raw),arg=parts.join(' ')
  if(['add','remove','reclassify','genre'].includes(action)&&!await authorize())return
  try{
   if(action==='list'){
    const page=/^\d+$/.test(arg)?Math.max(1,Number(arg)):1
    const tracks=catalog.list(), rows=tracks.slice((page-1)*10,page*10)
    await reply(rows.length?'🎵 *Biblioteca · página '+page+'*\n'+rows.map(t=>t.id+' · '+text(t.title)+' — '+text(t.artist)+' · '+t.genre).join('\n'):'🎵 No hay canciones en esta página.');return
   }
   if(action==='status'||action==='stats'){
    const tracks=catalog.list()
    await reply('🎵 Pistas: '+tracks.length+' · Disponibles: '+tracks.filter(t=>t.availability==='available').length+' · Trabajos: '+catalog.pending()+' · Reproducciones: '+tracks.reduce((n,t)=>n+t.plays,0)+' · Pendientes de análisis o revisión: '+tracks.filter(t=>['pending','review'].includes(t.classification?.status)).length+(action==='status'?'\nBuscador: '+engineStatus+'\nÚltima búsqueda: '+searchStatus:''));return
   }
   if(action==='add'){
    if(!arg||arg.length>200)throw Error('Nombre inválido')
    const track=await catalog.import({file:arg,transient:true,authorization:{basis:'importación declarada autorizada por administrador',provenance:'bandeja de importación'}})
    catalog.finishPlayback(track)
    await reply('✅ '+text(track.title)+' · '+track.genre+' · '+track.classification.status+'\nID: '+track.id);return
   }
   const id=parts[0]
   if(['info','remove','reclassify','genre'].includes(action)){
    const track=keyRE.test(id||'')&&catalog.find(id)
    if(!track){await reply('🎵 No encontré ese ID en la biblioteca.');return}
    if(action==='info'){await reply('🎵 *'+text(track.title)+'* — '+text(track.artist)+'\n'+track.genre+(track.subgenre?' · '+text(track.subgenre):'')+' · '+Math.round(track.duration)+' s\n'+track.availability+' · '+track.classification.status+' · '+track.plays+' reproducciones');return}
    if(action==='remove'){await catalog.remove(id);await reply('🗑️ Pista retirada de la biblioteca.');return}
    if(action==='genre'){await reply(await catalog.correct(id,parts.slice(1).join(' '))?'✅ Género corregido.':'Género inválido.');return}
    const result=await catalog.reclassify(id)
    await reply('🎼 '+result.genre+' · '+result.classification.status);return
   }
   await reply('🎵 *'+prefix+'music list*, *'+prefix+'music info <id>*, *'+prefix+'music status*, *'+prefix+'music stats*. Administración: add, remove, reclassify y genre.')
  }catch{onError(Error('Operación de biblioteca fallida'));await reply('⚠️ No se pudo completar la operación musical.')}
 }
 return {start,handle}
}
