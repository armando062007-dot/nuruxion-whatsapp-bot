import { comparable } from './music-discovery.mjs'

const origin='https://www.incompetech.com'
const base=origin+'/music/royalty-free/'
const media='mp3-royaltyfree/'
const artist='Kevin MacLeod'
const license='https://creativecommons.org/licenses/by/4.0/'
const isrc=/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/
const byGenre={2:'Música africana',3:'Blues',4:'Música clásica',5:'Contemporánea',6:'Disco',7:'Electrónica',8:'Funk',9:'Festiva',10:'Terror',11:'Jazz',12:'Música latina',13:'Moderna',14:'Musical',15:'Polka',16:'Pop',18:'Reggae',19:'Rock',20:'Cine mudo',21:'Ska',22:'Bandas sonoras',23:'Cortinillas',25:'Música del mundo',26:'Urbana'}
export const incompetechGenres=Object.values(byGenre)
const filename=/^[^/\\\x00-\x1f\x7f?#%]{1,160}\.mp3$/i
const titleOf=s=>typeof s==='string'?s.replace(/[\x00-\x1f\x7f*~`_]/g,' ').trim().slice(0,140):''
const provenance=id=>base+'index.html?isrc='+id

export function isIncompetechAudio(spec){
 const a=spec?.authorization
 if(a?.provider!=='incompetech'||a.basis!==license||!isrc.test(a.isrc||'')||a.provenance!==provenance(a.isrc))return false
 try{
  const url=new URL(spec.source)
  const name=decodeURIComponent(url.pathname.slice((new URL(base).pathname+media).length))
  return filename.test(name)&&url.href===base+media+encodeURIComponent(name)
 }catch{return false}
}

export function incompetechCredit(track){
 const a=track?.authorization
 return isIncompetechAudio(track)
  ? '🎼 '+titleOf(track.title)+' — '+artist+' (Incompetech)\nLicencia CC BY 4.0: '+license+'\nOriginal: '+a.provenance+'\nConversión a MP3 por Nuruxion.'
  : ''
}

export function parseIncompetech(rows){
 if(!Array.isArray(rows)||rows.length>6000)throw Error('Catálogo Incompetech inválido')
 const seen=new Set()
 return rows.flatMap(row=>{
  const title=titleOf(row?.title)
  if(!title||typeof row.filename!=='string'||!filename.test(row.filename)||typeof row.isrc!=='string'||!isrc.test(row.isrc)||seen.has(row.isrc))return []
  const length=/^00:(\d\d):([0-5]\d)$/.exec(row.length||'')
  const duration=length?Number(length[1])*60+Number(length[2]):0
  if(duration<30||duration>720)return []
  seen.add(row.isrc)
  return [{title,artist,source:base+media+encodeURIComponent(row.filename),genre:byGenre[row.genre]||'Otros',
   transient:true,authorization:{provider:'incompetech',basis:license,isrc:row.isrc,provenance:provenance(row.isrc)}}]
 })
}

export function createIncompetech({request=fetch,clock=Date.now}={}){
 let rows=[],next=0,pending
 async function tracks(){
  if(clock()<next)return rows
  if(pending)return pending
  pending=(async()=>{
   const res=await request(base+'pieces.json',{redirect:'error',signal:AbortSignal.timeout(8000)})
   if(!res.ok||!res.body)throw Error('Catálogo Incompetech no disponible')
   const decoder=new TextDecoder()
   let body='',bytes=0
   for await(const chunk of res.body){
    bytes+=chunk.length
    if(bytes>2*1024*1024)throw Error('Catálogo Incompetech demasiado grande')
    body+=decoder.decode(chunk,{stream:true})
   }
   const parsed=parseIncompetech(JSON.parse(body+decoder.decode()))
   if(!parsed.length)throw Error('Catálogo Incompetech vacío')
   rows=parsed;next=clock()+6*3600000
   return rows
  })().catch(()=>{next=clock()+60000;return rows}).finally(()=>{pending=null})
  return pending
 }
 async function find(query,genre){
  const q=comparable(query),a=comparable(artist)
  if(!q)return []
  return (await tracks()).filter(t=>{
   const title=comparable(t.title)
   return q==='random'||(genre?t.genre===genre:[title,a,'incompetech',a+' '+title,title+' '+a].includes(q))
  })
 }
 async function counts(){
  const result=new Map()
  for(const track of await tracks())result.set(track.genre,(result.get(track.genre)||0)+1)
  return result
 }
 return {find,counts,tracks}
}
