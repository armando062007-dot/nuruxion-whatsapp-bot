import { comparable } from './music-discovery.mjs'

const origin='https://ccmixter.org'
const clean=s=>typeof s==='string'?s.replace(/https?:\/\/\S+/gi,'').replace(/[\x00-\x1f\x7f*_~`<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,140):''
const cc=/^https:\/\/creativecommons\.org\/licenses\/by\/(?:2\.0|2\.5|3\.0|4\.0)\/$/
const tags={'Hip-hop':'hip_hop','Rap':'rap','Electrónica':'electronic','Rock':'rock','Pop':'pop','Jazz':'jazz','Ambient':'ambient','House':'house','Techno':'techno','Trance':'trance','Dubstep':'dubstep','Blues':'blues','Funk':'funk','Reggae':'reggae','Música latina':'latin','Música clásica':'classical','Metal':'metal','Indie':'indie'}
const user=/^[a-z0-9_-]{1,64}$/i
export function isMixterAudio(spec){
 const a=spec?.authorization
 if(a?.provider!=='ccmixter'||!cc.test(a.basis||'')||!user.test(a.user||'')||!Number.isSafeInteger(a.id)||a.id<1||!clean(a.artist))return false
 if(a.provenance!==origin+'/files/'+a.user+'/'+a.id)return false
 try{
  const url=new URL(spec.source)
  const prefix='/content/'+a.user+'/'
  return url.origin===origin&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname.startsWith(prefix)&&
   /^[^/\\?#%\x00-\x1f\x7f]{1,180}\.mp3$/i.test(decodeURIComponent(url.pathname.slice(prefix.length)))
 }catch{return false}
}
export function mixterCredit(track){
 if(!isMixterAudio(track))return ''
 const a=track.authorization
 return '🎼 '+clean(track.title)+' — '+clean(a.artist)+' (ccMixter)\nLicencia CC BY: '+a.basis+'\nOriginal y créditos del remix: '+a.provenance+'\nConvertido a MP3 por Nuruxion.'
}
export function parseMixter(data,q,genre){
 const terms=comparable(q).split(' ').filter(Boolean),seen=new Set()
 return (Array.isArray(data)?data:[]).slice(0,30).flatMap(row=>{
  if(!row||row.upload_extra?.nsfw||!String(row.upload_tags||'').split(',').includes('remix'))return []
  const title=clean(row.upload_name),artist=clean([row.user_real_name||row.user_name,row.upload_extra?.featuring].filter(Boolean).join(' ft. '))
  const words=new Set(comparable([title,artist,row.user_name].join(' ')).split(' '))
  if(!title||!artist||(!genre&&q!=='random'&&!terms.every(w=>words.has(w))))return []
  if(genre&&!String(row.upload_tags||'').split(',').includes(tags[genre]))return []
  const authorization={provider:'ccmixter',basis:String(row.license_url||'').replace(/^http:/,'https:'),user:row.user_name,id:row.upload_id,provenance:row.file_page_url,artist}
  for(const file of (Array.isArray(row.files)?row.files:[]).slice(0,8)){
   const length=/^(\d{1,2}):([0-5]\d)$/.exec(file?.file_format_info?.ps||'')
   const duration=length?Number(length[1])*60+Number(length[2]):0
   if(file?.file_format_info?.mime_type!=='audio/mpeg'||duration<45||duration>720||!Number.isSafeInteger(file.file_rawsize)||file.file_rawsize<=0||file.file_rawsize>48*1024*1024)continue
   const spec={title,artist,source:file.download_url,genre,transient:true,authorization}
   if(!isMixterAudio(spec)||seen.has(spec.source))continue
   seen.add(spec.source)
   return [spec]
  }
  return []
 })
}
export function createMixter({request=fetch}={}){
 const pending=new Map(),cache=new Map()
 return async function find(query,genre){
  const q=comparable(query),key=genre||q
  if(q.length<3||q.length>150||(genre&&!Object.hasOwn(tags,genre)))return []
  const saved=cache.get(key)
  if(saved&&saved.until>Date.now())return saved.rows
  if(pending.has(key))return pending.get(key)
  if(pending.size>=3)return []
  const job=(async()=>{
   const url=new URL(origin+'/api/query')
   url.search=new URLSearchParams({lic:'by',format:'json',limit:'25',dataview:'default',...(genre?{tags:tags[genre]}:q==='random'?{}:{s:q,search_type:'all'})})
   const res=await request(url,{redirect:'error',signal:AbortSignal.timeout(6500)})
   if(!res.ok||!res.body)return []
   const decoder=new TextDecoder()
   let body='',size=0
   for await(const chunk of res.body){
    size+=chunk.length
    if(size>768*1024)return []
    body+=decoder.decode(chunk,{stream:true})
   }
   const rows=parseMixter(JSON.parse(body+decoder.decode()),q,genre)
   if(cache.size>=250)cache.delete(cache.keys().next().value)
   cache.set(key,{rows,until:Date.now()+10*60000})
   return rows
  })().catch(()=>[]).finally(()=>pending.delete(key))
  pending.set(key,job)
  return job
 }
}
