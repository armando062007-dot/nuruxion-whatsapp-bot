import * as fs from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import path from 'node:path'
import { runProcess, normalizeMusic } from './music-discovery.mjs'
import { isIncompetechAudio, incompetechGenres } from './music-incompetech.mjs'
import { isCommonsAudio } from './music-commons.mjs'
import { isMixterAudio } from './music-ccmixter.mjs'
import { compactMp3, maxCompactBytes } from './music-compact.mjs'

export const genres=[...new Set(['Electrónica','Rock','Pop','Reguetón','Rap','Trap','Hip-hop','Metal','Jazz','Música clásica','Salsa','Cumbia','Bachata','Regional mexicano','Corridos','Banda','Indie','Techno','House','Trance','Dubstep','Ambient',...incompetechGenres,'Otros'])]
const aliases=new Map(genres.map(x=>[normalizeMusic(x),x]))
for(const [a,b] of Object.entries({electronic:'Electrónica',hiphop:'Hip-hop','hip hop':'Hip-hop',reggaeton:'Reguetón',classical:'Música clásica',indiepop:'Indie'}))aliases.set(a,b)
for(const [a,b] of Object.entries({latina:'Música latina',africana:'Música africana',mundial:'Música del mundo',soundtrack:'Bandas sonoras','banda sonora':'Bandas sonoras',navidad:'Festiva'}))aliases.set(a,b)
export const resolveGenre=s=>aliases.get(normalizeMusic(s))
export function classifyLabel(label){
 const [parent,style='']=normalizeMusic(label).split('---')
 const options=[style,parent]
 for(const value of options){
  const direct=resolveGenre(value)
  if(direct)return direct
  for(const [pattern,genre] of [[/reggaeton|regueton/,'Reguetón'],[/corridos?/,'Corridos'],[/regional mexican|ranchera|norteno/,'Regional mexicano'],[/\bbanda\b/,'Banda'],[/\bindie\b/,'Indie'],[/\bmetal\b/,'Metal'],[/\btrap\b/,'Trap'],[/\brap\b/,'Rap'],[/hip.hop/,'Hip-hop'],[/electronic/,'Electrónica'],[/classical/,'Música clásica']])if(pattern.test(value))return genre
 }
 return 'Otros'
}
export const fingerprint=async file=>{
 const hash=createHash('sha256')
 for await(const chunk of createReadStream(file))hash.update(chunk)
 return hash.digest('hex')
}
const playable=/\.(mp3|m4a|ogg|wav|flac)$/i
const maxOutput=16*1024*1024,maxInput=48*1024*1024,maxDuration=720

export function createMusicLibrary({root,inbox,ffmpeg='ffmpeg',ffprobe='ffprobe',ytDlp='yt-dlp',origin,execute=runProcess,request=fetch,classifier,historySize=8,diskLimit=512*1024*1024,onError=()=>{}}){
 const library=path.join(root,'catalog.json'), media=path.join(root,'media')
 let state={tracks:{},groups:{},jobs:{}}, writes=Promise.resolve(), tail=Promise.resolve()
 const inFlight=new Map()
 const leases=new Map()
 const cleanup=new Map(), expiry=new Map()
 const save=()=>{
  const snapshot=JSON.stringify(state)
  const job=writes.then(async()=>{const temporary=library+'.tmp';await fs.writeFile(temporary,snapshot,{mode:0o600});await fs.rename(temporary,library)})
  writes=job.catch(()=>{});return job
 }
 const fileFor=track=>path.join(media,track.id+(track.compactFile?'.compact':'')+'.mp3')
 const list=()=>Object.values(state.tracks)
 const find=id=>Object.hasOwn(state.tracks,id)?state.tracks[id]:null
 const fromVideo=id=>list().find(t=>t.videoId===id||t.videoIds?.includes(id))
 function schedule(kind,payload,key){
  if(inFlight.has(key))return inFlight.get(key)
  if(inFlight.size>=12)return Promise.reject(Error('Cola musical llena'))
  const id=randomUUID()
  state.jobs[id]={kind,payload,key}
  const recorded=save()
  // The queue may be busy; handle a persistence failure immediately.
  recorded.catch(()=>{})
  const job=tail.then(async()=>{
   await recorded
   try{return await (kind==='import'?importTrack(payload):classify(payload.id,true))}
   finally{delete state.jobs[id];await save()}
  }).finally(()=>inFlight.delete(key))
  tail=job.catch(()=>{})
  inFlight.set(key,job)
  return job
 }
 async function start(){
  await fs.mkdir(media,{recursive:true,mode:0o700})
  try{state=JSON.parse(await fs.readFile(library,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
  for(const entry of await fs.readdir(media))if(/^\.part-[a-f\d-]+\.(?:mp3|input)$/.test(entry))await fs.rm(path.join(media,entry),{force:true})
  // Recover cleanly if a restart interrupted an atomic catalog switch.
  for(const entry of await fs.readdir(media)){
   const match=/^([a-f\d]{64})(\.compact)?\.mp3$/.exec(entry),track=match&&find(match[1])
   if(track&&Boolean(match[2])!==Boolean(track.compactFile))await fs.rm(path.join(media,entry),{force:true})
  }
  for(const track of list())if(track.transient&&/^[a-f\d]{64}$/.test(track.id)){
   await fs.rm(fileFor(track),{force:true})
   track.availability='uncached'
  }
  if(list().some(t=>t.transient))await save()
  const jobs=Object.values(state.jobs||{})
  state.jobs={}
  for(const job of jobs)void schedule(job.kind,job.payload,job.key).catch(onError)
 }
 async function compactStored(){
  const result={converted:0,alreadyCompact:0,kept:0,failed:0,bytesSaved:0}
  for(const track of list()){
   if(track.transient||track.availability!=='available'||!/^[a-f\d]{64}$/.test(track.id))continue
   if(track.size<=maxCompactBytes){result.alreadyCompact++;continue}
   const task=tail.then(async()=>{
    if(find(track.id)!==track||leases.has(track.id)){result.kept++;return}
    const original=await fileForPlayback(track)
    if(!original){result.failed++;return}
    const temp=path.join(media,'.part-'+randomUUID()+'.mp3')
    const compactFile=!track.compactFile
    const compact=fileFor({id:track.id,compactFile})
    try{
     const {size,encoding}=await transcode(original,temp,track.duration)
     if(!size||size>maxOutput)throw Error('Compresión inválida')
     if(size>=track.size||leases.has(track.id)||find(track.id)!==track){result.kept++;return}
     const hash=await fingerprint(temp)
     if(leases.has(track.id)||find(track.id)!==track){result.kept++;return}
     const previous={size:track.size,sha256:track.sha256,encoding:track.encoding,compactFile:track.compactFile}
     await fs.rename(temp,compact)
     Object.assign(track,{size,sha256:hash,encoding,compactFile})
     try{await save()}catch(error){Object.assign(track,previous);throw error}
     if(!leases.has(track.id))await fs.rm(original,{force:true})
     result.bytesSaved+=previous.size-size
     result.converted++
    }finally{await fs.rm(temp,{force:true})}
   })
   tail=task.catch(()=>{})
   await task.catch(()=>{result.failed++;onError(Error('No se pudo compactar una pista guardada'))})
  }
  return result
 }
 async function fileForPlayback(track){
  if(!track||!/^[a-f\d]{64}$/.test(track.id)||track.availability==='unavailable')return null
  const file=fileFor(track)
  const stat=await fs.lstat(file).catch(()=>null)
  if(stat?.isFile()&&stat.size===track.size&&await fingerprint(file).catch(()=>null)===track.sha256)return file
  track.availability=track.transient?'uncached':'unavailable';await save();return null
 }
 async function classify(id,force=false){
  const t=find(id)
  if(!t)return null
  if(t.classification?.status==='manual'||(!force&&['classified','review'].includes(t.classification?.status)))return t
  if(!classifier)return t
  try{
   const file=await fileForPlayback(t)
   if(!file)return t
   const result=await classifier(file)
   if(find(id)!==t||t.classification?.status==='manual')return t
   const [label='',score=0]=result.labels?.[0]||[]
   t.genre=score>=0.32?classifyLabel(label):'Otros'
   t.subgenre=t.genre!=='Otros'?label.split('---').at(-1).trim():null
   t.classification={status:t.genre==='Otros'?'review':'classified',model:'Essentia Discogs400 EfficientNet',version:'1',score,label}
  }catch{if(t.classification?.status!=='manual')t.classification={status:'pending'};onError(Error('Clasificación pendiente'))}
  await save();return t
 }
 async function download(spec,file){
   const url=new URL(spec.source)
  if(!isIncompetechAudio(spec)&&!isCommonsAudio(spec)&&!isMixterAudio(spec)&&(!origin||url.protocol!=='https:'||url.origin!==new URL(origin).origin||url.username||url.password))throw Error('Origen no autorizado')
  const signal=AbortSignal.timeout(25000)
  const response=await request(url,{redirect:'error',signal})
  if(!response.ok||!response.body||Number(response.headers.get('content-length'))>maxInput)throw Error('Audio no disponible')
  let bytes=0
  await pipeline(response.body,new Transform({transform(chunk,_,done){bytes+=chunk.length;done(bytes>maxInput?Error('Audio demasiado grande'):null,chunk)}}),createWriteStream(file,{flags:'wx',mode:0o600}),{signal})
 }
 const transcode=(input,output,duration)=>compactMp3({execute,ffmpeg,input,output,duration})
 async function importTrack(spec){
  if(!spec.authorization)throw Error('Falta autorización')
  const token=randomUUID(), temp=path.join(media,'.part-'+token+'.mp3'), inputTemp=path.join(media,'.part-'+token+'.input')
  try{
   let input
   if(spec.youtubeDownload===true){
    if(!/^[A-Za-z0-9_-]{11}$/.test(spec.videoId||'')||spec.authorization?.youtubeDownload!==true||
      typeof spec.authorization.basis!=='string'||!spec.authorization.basis.trim()||
      typeof spec.authorization.provenance!=='string'||!spec.authorization.provenance.trim())throw Error('Descarga de YouTube no autorizada')
    await execute(typeof ytDlp==='function'?await ytDlp():ytDlp,['--ignore-config','--no-plugin-dirs','--no-playlist','--no-part','--no-mtime','--socket-timeout','8','--retries','1','--fragment-retries','1','--max-filesize','48M','-f','bestaudio[protocol=https]','-o',inputTemp,'--','https://www.youtube.com/watch?v='+spec.videoId],{shell:false,timeout:60000,maxBuffer:128*1024,windowsHide:true})
    input=inputTemp
   }
   else if(spec.source&&!spec.precompressed){await download(spec,inputTemp);input=inputTemp}
   else{
    if(!playable.test(spec.file||'')||path.basename(spec.file)!==spec.file)throw Error('Archivo no permitido')
    const base=spec.legacyDir||inbox
    input=path.join(base,spec.file)
    const real=await fs.realpath(input), rootReal=await fs.realpath(base)
    if(path.dirname(real)!==rootReal)throw Error('Ruta fuera del catálogo')
    input=real
   }
   const stat=await fs.stat(input)
   if(!stat.isFile()||!stat.size||stat.size>maxInput)throw Error('Tamaño inválido')
   const id=await fingerprint(input), existing=find(id)
   if(cleanup.has(id))await cleanup.get(id)
   if(existing&&await fileForPlayback(existing)){
    if(spec.videoId&&existing.videoId!==spec.videoId){existing.videoIds=[...new Set([...(existing.videoIds||[]),spec.videoId])];await save()}
    return existing
   }
   const opts={shell:false,timeout:25000,maxBuffer:128*1024,windowsHide:true}
   let info
   try{
    const {stdout}=await execute(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=duration:format_tags=title,artist:stream=codec_type','-of','json',input],opts)
    info=JSON.parse(stdout)
   }catch(error){
    if(error.code!=='ENOENT')throw error
    const {stderr}=await execute(ffmpeg,['-nostdin','-hide_banner','-protocol_whitelist','file,pipe','-i',input,'-map','0:a:0','-t','1','-f','null','-'],opts)
    const match=String(stderr).match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
    if(!match||!/\bAudio:/.test(stderr))throw Error('Duración o formato inválidos')
    info={format:{duration:Number(match[1])*3600+Number(match[2])*60+Number(match[3])},streams:[{codec_type:'audio'}]}
   }
   const duration=Number(info.format?.duration)
   if(!info.streams?.some(x=>x.codec_type==='audio')||!Number.isFinite(duration)||duration<=0||duration>maxDuration)throw Error('Duración o formato inválidos')
   const prepared=spec.precompressed===true&&isIncompetechAudio(spec)&&spec.sha256===id&&stat.size<=maxCompactBytes
   if(spec.precompressed&&!prepared)throw Error('MP3 preparado no coincide con el manifiesto')
   const {encoding}=prepared?(await fs.copyFile(input,temp),{encoding:'precomprimido'}):await transcode(input,temp,duration)
   const size=(await fs.stat(temp)).size
   if(!size||size>maxOutput)throw Error('Archivo excede el límite de WhatsApp')
   const stored=await fs.readdir(media,{withFileTypes:true})
   let used=0
   for(const entry of stored)if(entry.isFile()&&/^[a-f\d]{64}(?:\.compact)?\.mp3$/.test(entry.name)&&entry.name!==id+'.mp3')used+=(await fs.stat(path.join(media,entry.name))).size
   if(used+size>diskLimit)throw Error('Biblioteca sin espacio')
   const tags=info.format?.tags||{}
   const track={...existing,id,title:String(spec.title||tags.title||path.parse(spec.file||'Pista').name).slice(0,140),artist:String(spec.artist||tags.artist||'Desconocido').slice(0,140),genre:existing?.genre||'Otros',subgenre:existing?.subgenre||null,duration,source:spec.youtubeDownload?'https://www.youtube.com/watch?v='+spec.videoId:spec.source||spec.file,videoId:spec.videoId||existing?.videoId||null,file:id+'.mp3',format:'mp3',size,addedAt:existing?.addedAt||Date.now(),lastPlayedAt:existing?.lastPlayedAt||null,plays:existing?.plays||0,availability:'available',classification:existing?.classification||{status:'pending'},authorization:spec.authorization,sha256:await fingerprint(temp)}
   track.transient=existing?Boolean(existing.transient):spec.transient===true
   track.compactFile=false
   track.encoding=encoding
   if(track.transient)track.importSpec=spec
   await fs.rename(temp,fileFor(track));state.tracks[id]=track;await save()
   if(track.transient){
    clearTimeout(expiry.get(id))
    const timer=setTimeout(()=>finishPlayback(track),30*60000);timer.unref();expiry.set(id,timer)
   }else if(classifier&&track.classification.status==='pending')await classify(id)
   return track
  }finally{await Promise.all([fs.rm(temp,{force:true}),fs.rm(inputTemp,{force:true})])}
 }
 async function remove(id){
  const track=find(id)
  if(!track)return false
  delete state.tracks[id];await save()
  clearTimeout(expiry.get(id));expiry.delete(id)
  if(!leases.has(id))await fs.rm(fileFor(track),{force:true})
  return true
 }
 function finishPlayback(track){
  if(!track?.transient||find(track.id)!==track||track.availability!=='available'||leases.has(track.id)||cleanup.has(track.id))return
  const job=(async()=>{
   if(classifier&&track.classification?.status==='pending')await schedule('classify',{id:track.id},'classify:'+track.id).catch(onError)
   if(leases.has(track.id)||find(track.id)!==track)return
   clearTimeout(expiry.get(track.id));expiry.delete(track.id)
   track.availability='uncached'
   await fs.rm(fileFor(track),{force:true})
   await save()
  })().catch(onError).finally(()=>cleanup.delete(track.id))
  cleanup.set(track.id,job)
 }
 async function settle(){
  await Promise.allSettled([...cleanup.values()])
  await tail
  await writes
 }
 async function useFile(track,send){
  if(find(track.id)!==track)return false
  leases.set(track.id,(leases.get(track.id)||0)+1)
  try{
   const file=await fileForPlayback(track)
   if(!file)return false
   await send(file)
   return true
  }finally{
   const remaining=leases.get(track.id)-1
   if(remaining)leases.set(track.id,remaining)
   else{
    leases.delete(track.id)
    if(!find(track.id))await fs.rm(fileFor(track),{force:true})
   }
  }
 }
 function group(id){return Object.hasOwn(state.groups,id)?state.groups[id]:null}
 async function suggested(groupId,query,videoId){
  const previous=group(groupId)
  const suggestions=[videoId,...(previous?.suggestions||[]).filter(id=>id!==videoId)].slice(0,historySize)
  Object.defineProperty(state.groups,groupId,{value:{query,recent:previous?.recent||[],suggestions},enumerable:true,configurable:true,writable:true})
  await save()
 }
 async function played(track,groupId,query){
  track.plays++;track.lastPlayedAt=Date.now()
  const old=group(groupId)?.recent||[]
  Object.defineProperty(state.groups,groupId,{value:{query,recent:[track.id,...old.filter(x=>x!==track.id)].slice(0,historySize),suggestions:group(groupId)?.suggestions||[]},enumerable:true,configurable:true,writable:true})
  await save()
 }
 async function correct(id,genre){
  const track=find(id), value=resolveGenre(genre)
  if(!track||!value)return false
  track.genre=value;track.subgenre=null;track.classification={status:'manual'};await save();return true
 }
 return {start,compactStored,list,find,fromVideo,fileForPlayback,useFile,finishPlayback,settle,group,played,suggested,correct,remove,pending:()=>inFlight.size,
  import:spec=>schedule('import',spec,'import:'+(spec.videoId||spec.source||spec.file)),
  reclassify:id=>schedule('classify',{id},'classify:'+id)}
}
