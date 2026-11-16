import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { searchPublicVideos } from './music-cache.mjs'

export const runProcess=promisify(execFile)
export const normalizeMusic=s=>String(s??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim().replace(/\s+/g,' ')
const nonMusic=/\b(entrevista|interview|tutorial|reaction|reaccion|podcast|documentary|noticias|review|teaser|trailer)\b/
const videoId=/^[A-Za-z0-9_-]{11}$/
export const comparable=s=>normalizeMusic(s).replace(/['’‘.]/g,'').replace(/\$/g,'s').replace(/[^\p{L}\p{N}]+/gu,' ').trim()
const compact=s=>s.replace(/\s+/g,'')
const cleanQuery=s=>normalizeMusic(s).replace(/^\(([^()]*)\)$/,'$1').replace(/^@/,'').replace(/_/g,' ').trim()
const artistHit=(query,artist)=>{
 const clean=comparable(artist).replace(/(?: official(?: artist channel)?|vevo| topic)$/,'').trim()
 return Boolean(clean)&&compact(query)===compact(clean)
}
const contractions=/\b(dont|cant|wont|isnt|arent|didnt|doesnt|couldnt|wouldnt|shouldnt|youre|im|ive|its)\b/g
const spellings={dont:"don't",cant:"can't",wont:"won't",isnt:"isn't",arent:"aren't",didnt:"didn't",doesnt:"doesn't",couldnt:"couldn't",wouldnt:"wouldn't",shouldnt:"shouldn't",youre:"you're",im:"i'm",ive:"i've",its:"it's"}
const variants=q=>[...new Set([q.replace(contractions,w=>spellings[w]),q.replace(/[’‘]/g,"'"),'"'+q.replace(/["’‘]/g,'').replace(contractions,w=>spellings[w])+'" music'])]
const providerError=e=>{
 const message=String(e?.stderr||e?.cause?.code||e?.message||'')
 if(e?.code==='ENOENT')return 'ejecutable ausente'
 if(e?.killed||e?.name==='TimeoutError'||/timed? ?out/i.test(message))return 'tiempo agotado'
 if(/not a bot|captcha|sign in|HTTP Error 429/i.test(message))return 'acceso automatizado limitado'
 if(/403|forbidden/i.test(message))return 'acceso rechazado'
 if(/ENOTFOUND|EAI_AGAIN|ECONN|network/i.test(message))return 'fallo de red'
 return 'respuesta no disponible'
}
export function rankVideos(entries,query){
 const q=comparable(query), words=q.split(' ').filter(Boolean), seen=new Set()
 if(!words.length)return []
 return entries.flatMap(e=>{
  const title=String(e?.title||''),artist=String(e?.channel||e?.uploader||'')
  if(!videoId.test(e?.id||'')||seen.has(e.id)||!title||nonMusic.test(normalizeMusic(title))||/private|premium|subscriber|unavailable/.test(e.availability||'')||e.is_live||e.live_status==='is_upcoming')return []
  if(e.duration!=null&&(!Number.isFinite(e.duration)||e.duration<30||e.duration>900))return []
  const headline=comparable(title), channel=comparable(artist).replace(/ topic$/,'')
  const available=new Set(comparable([title,artist,e.track,e.artist,...(Array.isArray(e.tags)?e.tags:[])].join(' ')).split(' '))
  const artistMatch=[artist,e.artist].some(value=>artistHit(q,value))
  if(!artistMatch&&!words.every(word=>available.has(word))&&!(q.length>=5&&[headline,channel].some(value=>compact(value)===compact(q))))return []
  seen.add(e.id)
  const score=(headline===q?8:(' '+headline+' ').includes(' '+q+' ')?4:0)
   +(artistMatch?7:0)
   +(/official|oficial| - topic$/i.test(title+' '+artist)?3:0)
  return [{id:e.id,title,artist,duration:e.duration??null,score}]
 }).sort((a,b)=>b.score-a.score)
}

export function makeDiscovery({binary='yt-dlp',execute=runProcess,publicSearch=searchPublicVideos,onStatus=()=>{}}={}){
 const pending=new Map()
 async function youtube(query){
  const {stdout}=await execute(typeof binary==='function'?await binary():binary,['--ignore-config','--no-plugin-dirs','--no-warnings','--flat-playlist','--skip-download','--dump-single-json','--socket-timeout','6','--retries','1','--extractor-retries','1','--','ytsearch12:'+query],{shell:false,timeout:14000,maxBuffer:1024*1024,windowsHide:true})
  return JSON.parse(stdout).entries||[]
 }
 async function fetchResults(query){
  const searches=variants(query)
  let failure
  const direct=await youtube(searches[0]).catch(e=>{failure=providerError(e);return []})
  let matches=rankVideos(direct,query)
  if(matches.length){onStatus('YouTube · '+matches.length+' coincidencias');return matches}
  onStatus('YouTube · '+(failure||direct.length+' candidatos, ninguno relevante'))
  const found=await Promise.allSettled([
   ...(failure?[]:[youtube(searches[0]+' official audio')]),
   ...searches.map(q=>publicSearch(q)),
   publicSearch(query+' official audio',undefined,{wide:true})
  ])
  matches=rankVideos(found.flatMap(r=>r.status!=='fulfilled'?[]:Array.isArray(r.value)?r.value:[...r.value].map(([id,item])=>({id,title:item.title,channel:item.artist}))),query)
  onStatus('Búsqueda ampliada · '+matches.length+' coincidencias · '+found.filter(r=>r.status==='rejected').length+' fuentes fallidas')
  if(found.every(r=>r.status==='rejected'))throw Error('Búsqueda musical no disponible')
  return matches
 }
 return async function discover(query){
  const q=cleanQuery(query)
  if(!q||q.length>150||/[\x00-\x1f\x7f]/.test(q)||/https?:\/\//i.test(q))return []
  if(pending.has(q))return pending.get(q)
  if(pending.size>=3)throw Error('Búsquedas ocupadas')
  const job=fetchResults(q).finally(()=>pending.delete(q))
  pending.set(q,job)
  return job
 }
}
