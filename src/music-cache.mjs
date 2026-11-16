import * as fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const ttl = 30 * 60 * 1000
const limit = 16 * 1024 * 1024
const cacheFile = /^[0-9a-f-]{36}\.mp3$/
const normalize = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export function createMusicCache({dir, origin, clock=Date.now, lifetime=ttl, download=fetch, onError=()=>{}}) {
  const active = new Set()
  async function sweep() {
    for (const entry of await fs.readdir(dir, {withFileTypes:true}).catch(error => {
      if(error.code==='ENOENT')return []
      throw error
    })) {
      if(!entry.isFile() || !cacheFile.test(entry.name) || active.has(entry.name))continue
      const file=path.join(dir,entry.name)
      const stat=await fs.stat(file).catch(error=>{if(error.code!=='ENOENT')throw error})
      if(stat && clock()-stat.mtimeMs>=lifetime)await fs.rm(file,{force:true})
    }
  }
  async function withTemporaryAudio(load, deliver) {
    if(active.size>=3)throw Error('Demasiadas solicitudes simultáneas')
    const name=randomUUID()+'.mp3',file=path.join(dir,name)
    active.add(name)
    let sent=false
    try {
      const buffer=await load()
      if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>limit)throw Error('Archivo de audio inválido')
      await fs.mkdir(dir,{recursive:true,mode:0o700})
      await fs.writeFile(file,buffer,{flag:'wx',mode:0o600})
      await deliver(buffer)
      const when=new Date(clock())
      await fs.utimes(file,when,when)
      sent=true
      const timer=setTimeout(()=>{void fs.rm(file,{force:true}).catch(onError)},lifetime)
      timer.unref()
    } finally {
      active.delete(name)
      if(!sent)await fs.rm(file,{force:true}).catch(onError)
    }
  }
  async function send(source, deliver) {
    if(!origin)throw Error('Origen de audio no configurado')
    const url=new URL(source), allowed=new URL(origin)
    if(url.protocol!=='https:'||allowed.protocol!=='https:'||url.origin!==allowed.origin||url.username||url.password)throw Error('Origen de audio no autorizado')
    return withTemporaryAudio(async()=>{
      const response=await download(url,{redirect:'error',signal:AbortSignal.timeout(25000)})
      if(response.status===404||response.status===410){
        if(response.body)await response.body.cancel()
        throw Object.assign(Error('Audio no disponible'),{code:'AUDIO_NOT_FOUND'})
      }
      if(!response.ok||!response.body||!/^audio\/(mpeg|mp3)(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw Error('La fuente no devolvió un MP3')
      if(Number(response.headers.get('content-length'))>limit)throw Error('Archivo demasiado grande')
      const chunks=[]
      let total=0
      for await (const chunk of response.body){
        total+=chunk.length
        if(total>limit)throw Error('Archivo demasiado grande')
        chunks.push(chunk)
      }
      if(!total)throw Error('Archivo vacío')
      return Buffer.concat(chunks,total)
    },deliver)
  }
  return {send,sweep}
}

const entities={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}
const htmlText=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(_,token)=>{
  if(token[0]!=='#')return entities[token.toLowerCase()]||''
  const code=token[1].toLowerCase()==='x'?parseInt(token.slice(2),16):Number(token.slice(1))
  return code<=0x10ffff?String.fromCodePoint(code):''
})

export async function searchPublicVideos(query, request=fetch, {wide=false}={}) {
  const url=new URL('https://www.bing.com/search')
  url.searchParams.set('format','rss')
  url.searchParams.set('q',(wide?'site:youtube.com ':'site:youtube.com/watch ')+query.slice(0,150))
  const response=await request(url,{redirect:'error',signal:AbortSignal.timeout(8000)})
  if(!response.ok||!response.body)throw Error('Buscador público no disponible')
  let size=0
  const decoder=new TextDecoder()
  let html=''
  for await(const chunk of response.body){
    size+=chunk.length
    if(size>512*1024)throw Error('Respuesta del buscador demasiado grande')
    html+=decoder.decode(chunk,{stream:true})
  }
  html+=decoder.decode()
  if(!/<rss\b/i.test(html))throw Error('Buscador público no disponible')
  const hits=new Map()
  for(const [,item] of html.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
    const href=item.match(/<link>([\s\S]*?)<\/link>/i)?.[1]
    if(!href)continue
    try{
      const link=new URL(htmlText(href.trim()))
      if(link.protocol!=='https:')continue
      const id=['www.youtube.com','youtube.com','m.youtube.com','music.youtube.com'].includes(link.hostname)&&link.pathname==='/watch'
        ? link.searchParams.get('v') : link.hostname==='youtu.be'?link.pathname.slice(1):null
      if(!id||!/^[\w-]{11}$/.test(id)||hits.has(id))continue
      const title=htmlText(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/\s*[-–]\s*YouTube\s*$/i,'').replace(/(?:https?:\/\/|www\.)\S+/gi,'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,140)
      hits.set(id,{title:title||'Video de YouTube'})
      if(hits.size>=10)break
    }catch{}
  }
  return hits
}

// YouTube sólo aporta metadatos; sin clave, un buscador público encuentra videos indexados.
export async function searchChannelTracks(query, tracks, {channelId,key,request=fetch,onVideo=()=>{}}={}) {
  const words=normalize(query).split(/\s+/).filter(Boolean)
  if(!words.length)return {tracks:[],videoFound:false}
  const local=tracks.filter(item=>words.every(word=>normalize([item.title,item.artist,item.id,...(item.tags||[])].join(' ')).includes(word)))
  if(!key){
    const hits=await searchPublicVideos(query,request).catch(error=>{
      if(local.length)return new Map()
      throw error
    })
    for(const [id,snippet] of hits)onVideo(id,snippet)
    const matched=tracks.filter(item=>item.videoId&&hits.has(item.videoId))
    return {tracks:matched.length?matched:local,videoFound:hits.size>0}
  }
  const params=new URLSearchParams({part:'snippet',type:'video',q:query.slice(0,150),maxResults:'15',key})
  if(channelId)params.set('channelId',channelId)
  const response=await request('https://www.googleapis.com/youtube/v3/search?'+params,{signal:AbortSignal.timeout(8000)})
  if(!response.ok)throw Error('Búsqueda de canal no disponible')
  const data=await response.json()
  const found=new Set()
  for(const item of data.items||[]){
    const id=item.id?.videoId
    if(!id||found.has(id)||(channelId&&item.snippet?.channelId!==channelId))continue
    found.add(id)
    onVideo(id,item.snippet)
  }
  const matched=tracks.filter(item=>item.videoId&&found.has(item.videoId))
  return {tracks:matched,videoFound:found.size>0}
}

export async function findChannelTracks(...args) {
  return (await searchChannelTracks(...args)).tracks
}
