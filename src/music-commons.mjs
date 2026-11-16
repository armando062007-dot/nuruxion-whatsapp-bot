import { comparable } from './music-discovery.mjs'

const api='https://commons.wikimedia.org/w/api.php'
const userAgent='NuruxionMusic/1.0'
const licenses=new Map([
 ['CC BY 4.0','https://creativecommons.org/licenses/by/4.0/'],
 ['CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/'],
 ['CC0','https://creativecommons.org/publicdomain/zero/1.0/'],
 ['Public domain','https://creativecommons.org/publicdomain/mark/1.0/']
])
for(const version of ['2.0','2.5','3.0']){
 licenses.set('CC BY '+version,'https://creativecommons.org/licenses/by/'+version+'/')
 licenses.set('CC BY-SA '+version,'https://creativecommons.org/licenses/by-sa/'+version+'/')
}
const clean=value=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot|#\d+);/g,' ').replace(/[\x00-\x1f\x7f*_~`]/g,' ').replace(/https?:\/\/\S+/gi,'').replace(/\s+/g,' ').trim().slice(0,180):''
const audioPath=/^\/wikipedia\/commons\/[a-f0-9]\/[a-f0-9]{2}\/[^/]+\.(?:ogg|oga|opus|flac|mp3|wav|m4a)$/i
const nonSong=/\b(?:sample|snippet|excerpt|preview|tutorial|pronunciation|interview|trailer|karaoke|sound effect)\b/i
const licenseUrl=value=>typeof value==='string'?value.replace(/^http:/,'https:').replace(/\/+$/,'')+'/':''

export function isCommonsAudio(spec){
 const a=spec?.authorization
 if(a?.provider!=='wikimedia-commons'||!licenses.has(a.license)||a.basis!==licenses.get(a.license))return false
 if(a.license.startsWith('CC BY')&&!clean(a.artist))return false
 try{
  const file=new URL(spec.source),page=new URL(a.provenance)
  return file.origin==='https://upload.wikimedia.org'&&!file.username&&!file.password&&!file.search&&!file.hash&&audioPath.test(file.pathname)&&!/%(?:2f|5c|00)/i.test(file.pathname)&&
   page.origin==='https://commons.wikimedia.org'&&!page.username&&!page.password&&!page.search&&!page.hash&&page.pathname.startsWith('/wiki/File:')
 }catch{return false}
}

export function commonsCredit(track){
 if(!isCommonsAudio(track))return ''
 const a=track.authorization
 return '🎼 '+clean(track.title)+' — '+(clean(a.artist)||'Wikimedia Commons')+'\n'+a.license+': '+a.basis+'\nOriginal: '+a.provenance+'\nConvertido a MP3 sin recortar por Nuruxion.'
}

export function parseCommons(pages,query){
 const terms=comparable(query).split(' ').filter(Boolean)
 if(!terms.length)return []
 const seen=new Set()
 return (Array.isArray(pages)?pages:[]).slice(0,16).flatMap(page=>{
  const info=page?.imageinfo?.[0],meta=info?.extmetadata
  const label=meta?.LicenseShortName?.value,basis=licenses.get(label)
  if(!basis||(label!=='Public domain'&&licenseUrl(meta?.LicenseUrl?.value)!==basis))return []
  if(!Number.isFinite(info.size)||info.size<=0||info.size>48*1024*1024||!(/^(?:audio\/|application\/ogg$)/i.test(info.mime||'')))return []
  if(Number.isFinite(info.duration)&&(info.duration<30||info.duration>720))return []
  const filename=clean(page.title?.replace(/^File:/,'').replace(/\.[a-z0-9]+$/i,'').replace(/_/g,' '))
  const title=clean(meta?.ObjectName?.value)||filename, artist=clean(meta?.Artist?.value)
  if(!title||nonSong.test(title+' '+filename))return []
  const words=new Set(comparable([title,filename,artist].join(' ')).split(' '))
  if(!terms.every(word=>words.has(word)))return []
  try{
   const source=new URL(info.url);source.search='';source.hash=''
   const spec={title,artist:artist||'Wikimedia Commons',source:source.href,transient:true,
    authorization:{provider:'wikimedia-commons',license:label,basis,provenance:info.descriptionurl,artist}}
   if(!isCommonsAudio(spec)||seen.has(spec.source))return []
   seen.add(spec.source)
   return [{spec,index:Number.isInteger(page.index)?page.index:999}]
  }catch{return []}
 }).sort((a,b)=>a.index-b.index).map(row=>row.spec)
}

export function createCommonsMusic({request=fetch}={}){
 const recent=new Map(),pending=new Map()
 return async function find(query){
  const q=comparable(query)
  if(q.length<3||q.length>150)return []
  const cached=recent.get(q)
  if(cached&&cached.until>Date.now())return cached.rows
  if(pending.has(q))return pending.get(q)
  if(pending.size>=3)return []
  const job=(async()=>{
   const url=new URL(api)
   url.search=new URLSearchParams({action:'query',generator:'search',gsrnamespace:'6',gsrlimit:'16',gsrsearch:q+' filetype:audio',prop:'imageinfo',iiprop:'url|size|mime|extmetadata',iiextmetadatafilter:'LicenseShortName|LicenseUrl|Artist|ObjectName',format:'json',formatversion:'2'})
   const res=await request(url,{redirect:'error',headers:{'User-Agent':userAgent},signal:AbortSignal.timeout(7000)})
   if(!res.ok||!res.body)return []
   const decoder=new TextDecoder()
   let body='',size=0
   for await(const chunk of res.body){
    size+=chunk.length
    if(size>512*1024)return []
    body+=decoder.decode(chunk,{stream:true})
   }
   const rows=parseCommons(JSON.parse(body+decoder.decode()).query?.pages,q)
   if(recent.size>=250)recent.delete(recent.keys().next().value)
   recent.set(q,{rows,until:Date.now()+15*60000})
   return rows
  })().catch(()=>[]).finally(()=>pending.delete(q))
  pending.set(q,job)
  return job
 }
}
