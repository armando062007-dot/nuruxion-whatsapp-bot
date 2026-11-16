import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { makeDiscovery, rankVideos } from './music-discovery.mjs'
import { createMusicLibrary, resolveGenre, fingerprint } from './music-library.mjs'
import { rateFor, maxCompactBytes } from './music-compact.mjs'
import { createMusicSystem, normalizePlayQuery, poolForPlayback } from './music-system.mjs'
import { createIncompetech, isIncompetechAudio, parseIncompetech } from './music-incompetech.mjs'
import { parseCommons, isCommonsAudio, commonsCredit } from './music-commons.mjs'
import { parseMixter, isMixterAudio, mixterCredit } from './music-ccmixter.mjs'

async function fixture(t){
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'nuruxion-library-'))
 const inbox=path.join(base,'inbox')
 await fs.mkdir(inbox)
 await fs.writeFile(path.join(inbox,'faded.wav'),'test PCM A')
 await fs.writeFile(path.join(inbox,'other.flac'),'test PCM B')
 let transcodes=0, analyses=0
 const options={root:path.join(base,'library'),inbox,
  execute:async (bin,args,config)=>{
   assert.equal(config.shell,false)
   if(bin==='yt-dlp'){
    assert.ok(args.includes('--no-plugin-dirs'))
    assert.equal(args.at(-1),'https://www.youtube.com/watch?v=aaaaaaaaaaa')
    await fs.writeFile(args[args.indexOf('-o')+1],'test authorized audio')
    return {stdout:''}
   }
   if(bin==='ffprobe')return {stdout:JSON.stringify({format:{duration:180,tags:{title:'Faded',artist:'Alan Walker'}},streams:[{codec_type:'audio'}]})}
   transcodes++
   await fs.writeFile(args.at(-1),'ID3'+transcodes)
   return {stdout:''}
  },
  classifier:async()=>{analyses++;return {labels:[['Electronic---House',0.86]]}}
 }
 const library=createMusicLibrary(options)
 await library.start()
 t.after(async()=>{await library.settle();await fs.rm(base,{recursive:true,force:true})})
 return {base,inbox,library,options,counts:()=>({transcodes,analyses})}
}
const authorization={basis:'propia',provenance:'prueba'}
test('ccMixter selecciona pistas completas por género o título y valida origen y licencia',()=>{
 const item={upload_id:123,user_name:'artista',user_real_name:'Artista',upload_name:'Tema nuevo',upload_tags:'remix,hip_hop',
  file_page_url:'https://ccmixter.org/files/artista/123',license_url:'http://creativecommons.org/licenses/by/3.0/',
  files:[{file_format_info:{mime_type:'audio/mpeg',ps:'3:25'},file_rawsize:12345,download_url:'https://ccmixter.org/content/artista/tema.mp3'}]}
 const [track]=parseMixter([item],'hip hop','Hip-hop')
 assert.ok(isMixterAudio(track))
 assert.match(mixterCredit(track),/CC BY/)
 assert.equal(parseMixter([item],'tema nuevo').length,1)
 assert.equal(parseMixter([item],'marshmello').length,0)
 assert.equal(parseMixter([{...item,license_url:'https://creativecommons.org/licenses/by-nc/3.0/'}],'tema nuevo').length,0)
 assert.equal(isMixterAudio({...track,source:'https://ccmixter.org/content/artista/%2fno.mp3'}),false)
})
test('Commons verifica licencia, origen, coincidencia y créditos',()=>{
 const page={title:'File:Moonlight Sonata.ogg',imageinfo:[{
  url:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Moonlight_Sonata.ogg?utm_source=test',
  descriptionurl:'https://commons.wikimedia.org/wiki/File:Moonlight_Sonata.ogg',mime:'application/ogg',size:1024,
  extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0'},Artist:{value:'<a>Intérprete</a>'}}
 }]}
 const [row]=parseCommons([page],'moonlight sonata')
 assert.ok(isCommonsAudio(row))
 assert.match(commonsCredit(row),/Intérprete.*\nCC BY-SA 4.0/)
 assert.equal(new URL(row.source).search,'')
 assert.equal(parseCommons([page],'marshmello').length,0)
 assert.equal(isCommonsAudio({...row,source:row.source.replace('upload.wikimedia.org','example.org')}),false)
 page.imageinfo[0].extmetadata.LicenseUrl.value='https://example.org/'
 assert.equal(parseCommons([page],'moonlight sonata').length,0)
})

test('play admite nombre de artista con errata y título sin prefijo',async t=>{
 const f=await fixture(t)
 await f.library.import({file:'faded.wav',authorization})
 const searches=[]
 const bot=createMusicSystem({library:f.library,catalogPath:path.join(f.base,'manifest.json'),musicDir:f.inbox,discovery:async q=>{searches.push(q);return []}})
 let sent=0
 const run=(query,actor)=>bot.handle({command:'play',query,actor,group:'x',prefix:'?',reply:()=>{},sendAudio:async()=>{sent++}})
 await run('MarshMellow (artista)','a')
 await run('Faded','b')
 assert.deepEqual(searches,['marshmello'])
 assert.equal(sent,1)
 assert.equal(normalizePlayQuery('faded (nombre de la musica)'),'faded')
 assert.equal(normalizePlayQuery('Marshmellow Nights'),'marshmellow nights')
})
const openRow={title:'The Britons',filename:'The Britons.mp3',isrc:'USUAN2600004',length:'00:05:07',genre:'19'}

test('reproduce el MP3 preparado sin descargarlo ni volver a comprimirlo',async t=>{
 const f=await fixture(t)
 const [spec]=parseIncompetech([openRow])
 const name='nuruxion-USUAN2600004.mp3', file=path.join(f.inbox,name)
 await fs.writeFile(file,'ID3preparado')
 await fs.writeFile(path.join(f.inbox,'nuruxion-compact.json'),JSON.stringify([{...spec,file:name,sha256:await fingerprint(file)}]))
 const bot=createMusicSystem({library:f.library,catalogPath:path.join(f.base,'manifest.json'),musicDir:f.inbox,discovery:async()=>assert.fail('Ya está disponible localmente')})
 const sent=[]
 await bot.handle({command:'play',query:'rock',actor:'a',group:'x',prefix:'?',reply:msg=>sent.push(msg),sendAudio:async ({url})=>sent.push(await fs.readFile(url,'utf8'))})
 assert.equal(sent[0],'ID3preparado')
 assert.match(sent[1],/Kevin MacLeod/)
 assert.equal(f.counts().transcodes,0)
})

test('Incompetech limita el origen y no confunde canciones o artistas comerciales',async()=>{
 let requests=0
 const provider=createIncompetech({request:async (url,opts)=>{
  requests++
  assert.equal(url,'https://www.incompetech.com/music/royalty-free/pieces.json')
  assert.equal(opts.redirect,'error')
  return Response.json([openRow,{...openRow,filename:'../bad.mp3'},{...openRow,filename:'bad.exe'}])
 }})
 const [track]=await provider.find('rock','Rock')
 assert.ok(isIncompetechAudio(track))
 assert.ok(!isIncompetechAudio({...track,source:track.source.replace('www.incompetech.com','evil.example')}))
 assert.ok(!isIncompetechAudio({...track,source:track.source+'?redirect=1'}))
 assert.equal(parseIncompetech([{...openRow,filename:'../bad.mp3'}]).length,0)
 assert.equal((await provider.find('Alan Walker')).length,0)
 assert.equal(requests,1)
})

test('Incompetech convierte y envía audio con atribución',async t=>{
 const f=await fixture(t)
 const openMusic=createIncompetech({request:async()=>Response.json([openRow])})
 const library=createMusicLibrary({...f.options,request:async (url,opts)=>{
  assert.equal(url.hostname,'www.incompetech.com')
  assert.equal(opts.redirect,'error')
  return new Response('test source audio')
 }})
 const bot=createMusicSystem({library,openMusic,catalogPath:path.join(f.base,'manifest.json'),musicDir:f.inbox,discovery:async()=>assert.fail('La pista es del catálogo abierto')})
 const sent=[]
 await bot.handle({command:'play',query:'The Britons',actor:'a',group:'x',prefix:'?',reply:msg=>sent.push(msg),sendAudio:async ({url},metadata)=>{
  assert.equal(metadata.mimetype,'audio/mpeg')
  assert.ok((await fs.stat(url)).size>0)
  sent.push('audio')
 }})
 assert.equal(sent[0],'audio')
 assert.match(sent[1],/Kevin MacLeod.*\nLicencia CC BY 4.0:/)
 await library.settle()
})

test('yt-dlp usa argumentos seguros y agrupa solicitudes por artista o título',async()=>{
 let calls=0
 const discovery=makeDiscovery({execute:async (bin,args,opts)=>{
  calls++
  assert.equal(bin,'yt-dlp')
  assert.equal(opts.shell,false)
  assert.ok(args.includes('--skip-download'))
  assert.ok(args.includes('--no-plugin-dirs'))
  assert.match(args.at(-1),/^ytsearch12:(alan walker|faded)$/)
  return {stdout:JSON.stringify({entries:[
   {id:'aaaaaaaaaaa',title:'Faded (Official Video)',channel:'Alan Walker',duration:210},
   {id:'bbbbbbbbbbb',title:'Faded tutorial',channel:'Alan Walker',duration:210},
   {id:'aaaaaaaaaaa',title:'Duplicado'}
  ]})}
 }})
 const result=await Promise.all([discovery('Alan Walker'),discovery('alan walker')])
 assert.deepEqual(result[0],result[1])
 assert.equal(calls,1)
 assert.equal(result[0].length,1)
 assert.equal((await discovery('Faded'))[0].title,'Faded (Official Video)')
 assert.equal(rankVideos([{id:'ccccccccccc',title:'Unavailable',availability:'private'}],'x').length,0)
})

test('importación deduplicada, análisis sólo una vez, persistencia e integridad',async t=>{
 const f=await fixture(t)
 const spec={file:'faded.wav',authorization,videoId:'aaaaaaaaaaa'}
 const [a,b]=await Promise.all([f.library.import(spec),f.library.import(spec)])
 assert.equal(a.id,b.id)
 assert.equal(a.genre,'House')
 assert.deepEqual(f.counts(),{transcodes:1,analyses:1})
 await f.library.import(spec)
 assert.deepEqual(f.counts(),{transcodes:1,analyses:1})
 await f.library.played(a,'chatA','alan walker')
 const restarted=createMusicLibrary(f.options)
 await restarted.start()
 assert.equal(restarted.find(a.id).plays,1)
 assert.equal(restarted.group('chatA').recent[0],a.id)
 const file=await restarted.fileForPlayback(a)
 await fs.writeFile(file,'BAD1')
 assert.equal(await restarted.fileForPlayback(a),null)
 assert.equal(a.availability,'unavailable')
})

test('compacta MP3 previos sin cambiar ID, créditos ni historial y conserva el archivo si no hay ahorro',async t=>{
 const f=await fixture(t)
 const first=createMusicLibrary({...f.options,execute:async(bin,args,opts)=>{
  if(bin==='ffprobe')return f.options.execute(bin,args,opts)
  await fs.writeFile(args.at(-1),'ID3'+'.'.repeat(250))
  return {stdout:''}
 }})
 await first.start()
 const a=await first.import({file:'faded.wav',authorization})
 const b=await first.import({file:'other.flac',authorization})
 await first.played(a,'chat','faded')
 const catalogFile=path.join(f.options.root,'catalog.json')
 const old=JSON.parse(await fs.readFile(catalogFile,'utf8'))
 delete old.tracks[a.id].encoding
 delete old.tracks[b.id].encoding
 for(const track of [a,b]){
  const file=path.join(f.options.root,'media',track.id+'.mp3')
  await fs.writeFile(file,Buffer.alloc(1_100_000,65))
  old.tracks[track.id].size=1_100_000
  old.tracks[track.id].sha256=await fingerprint(file)
 }
 await fs.writeFile(catalogFile,JSON.stringify(old))
 const next=createMusicLibrary({...f.options,execute:async(bin,args,opts)=>{
  assert.equal(args[args.indexOf('-b:a')+1],'40k')
  if(args.includes(path.join(f.options.root,'media',b.id+'.mp3')))throw Error('No se pudo leer la pista')
  await fs.writeFile(args.at(-1),'ID3compact')
  return {stdout:''}
 }})
 await next.start()
 const result=await next.compactStored()
 assert.equal(result.converted,1)
 assert.equal(result.failed,1)
 assert.equal(result.bytesSaved,1_099_990)
 assert.equal(next.group('chat').recent[0],a.id)
 assert.deepEqual(next.find(a.id).authorization,authorization)
 assert.ok((await next.fileForPlayback(next.find(a.id))).endsWith('.compact.mp3'))
 assert.ok((await next.fileForPlayback(next.find(b.id))).endsWith(b.id+'.mp3'))
 const restarted=createMusicLibrary(f.options)
 await restarted.start()
 assert.ok(await restarted.fileForPlayback(restarted.find(a.id)))
})

test('el presupuesto de bitrate cubre una canción de 12 minutos sin truncarla',()=>{
 assert.equal(rateFor(180),40)
 assert.equal(rateFor(720),8)
 assert.ok(720*rateFor(720)*125<maxCompactBytes)
})

test('género, otra, grupos separados y envío compatible con Baileys',async t=>{
 const f=await fixture(t)
 const [a,b]=await Promise.all([
  f.library.import({file:'faded.wav',authorization}),
  f.library.import({file:'other.flac',title:'Otra',authorization})
 ])
 for(const id of [a.id,b.id])await f.library.correct(id,'electronica')
 const bot=createMusicSystem({library:f.library,catalogPath:path.join(f.base,'manifest.json'),musicDir:f.inbox,discovery:async()=>assert.fail('El género ya tiene archivos')})
 const sent=[]
 const run=(query,actor,group='chatA')=>bot.handle({command:'play',query,actor,group,prefix:'?',reply:()=>assert.fail('Se esperaba audio'),sendAudio:async (audio,metadata)=>{
  assert.equal(metadata.mimetype,'audio/mpeg')
  assert.equal(typeof audio.url,'string')
  assert.ok((await fs.stat(audio.url)).size>0)
  sent.push(audio.url)
 }})
 await run('Electronic','first')
 await run('otra','second')
 assert.notEqual(sent[0],sent[1])
 assert.equal(f.library.group('chatA').query,'electronic')
 assert.equal(f.library.group('chatB'),null)
 assert.equal(resolveGenre('ROCK'),'Rock')
 assert.equal(resolveGenre('reggaetón'),'Reguetón')
 assert.deepEqual(poolForPlayback([a], [a.id]),[a])
})

test('resultados sin autorización no envían enlaces y los fallos no detienen el bot',async t=>{
 const f=await fixture(t)
 let querySeen='', messages=[]
 const bot=createMusicSystem({library:f.library,catalogPath:path.join(f.base,'manifest.json'),musicDir:f.inbox,discovery:async query=>{
  querySeen=query
  if(query==='rock')throw Error('proveedor fuera de línea')
  return [{id:'aaaaaaaaaaa',title:'Faded',score:3}]
 }})
 const run=(query,actor,command='play',authorize=async()=>false)=>bot.handle({command,query,actor,group:'x',prefix:'?',authorize,reply:msg=>messages.push(msg),sendAudio:()=>assert.fail('No debe descargar')})
 await run('Alan Walker','a')
 assert.equal(querySeen,'alan walker')
 assert.match(messages.at(-1),/No encontré una pista con audio/)
 assert.doesNotMatch(messages.at(-1),/https?:/)
 await run('rock','b')
 assert.match(messages.at(-1),/No pude/)
 await run('stats','c','music')
 assert.match(messages.at(-1),/Pistas: 0/)
 await run('add faded.wav','d','music')
 assert.equal(f.library.list().length,0)
 await assert.rejects(f.library.import({file:'../outside.mp3',authorization}),/Archivo no permitido/)
})

test('un ID con permiso explícito se descarga y convierte sin archivo previo',async t=>{
 const f=await fixture(t)
 const spec={title:'Faded',artist:'Alan Walker',videoId:'aaaaaaaaaaa',youtubeDownload:true,authorization}
 await assert.rejects(f.library.import(spec),/YouTube no autorizada/)
 const manifest=path.join(f.base,'manifest.json')
 await fs.writeFile(manifest,JSON.stringify([{title:spec.title,artist:spec.artist,videoId:spec.videoId,authorization:{...authorization,youtubeDownload:true}}]))
 const bot=createMusicSystem({library:f.library,catalogPath:manifest,musicDir:f.inbox})
 let sent=0
 await bot.handle({command:'play',query:'Faded',actor:'a',group:'x',prefix:'?',reply:()=>assert.fail('Se esperaba un MP3'),sendAudio:async ({url})=>{
  assert.equal(await fs.readFile(url,'utf8'),'ID31')
  sent++
 }})
 assert.equal(sent,1)
 assert.equal(f.library.fromVideo(spec.videoId).authorization.youtubeDownload,true)
})

test('play yt no envía enlaces ni conserva una búsqueda sin reproducción',async t=>{
 const f=await fixture(t)
 await f.library.import({file:'faded.wav',authorization})
 const searches=[]
 const bot=createMusicSystem({library:f.library,catalogPath:path.join(f.base,'manifest.json'),musicDir:f.inbox,discovery:async query=>{
  searches.push(query)
  return [{id:'aaaaaaaaaaa',title:'Faded',score:8},{id:'bbbbbbbbbbb',title:'Otra versión',score:2}]
 }})
 const messages=[]
 for(const [query,actor] of [['yt Faded','a'],['otra','b']])await bot.handle({command:'play',query,actor,group:'x',prefix:'?',reply:msg=>messages.push(msg),sendAudio:()=>assert.fail('El archivo local no coincide por ID')})
 assert.deepEqual(searches,['faded'])
 assert.match(messages[0],/No encontré una pista con audio/)
 assert.match(messages[1],/Todavía no hay una búsqueda anterior/)
})

test('corrige apóstrofos y rechaza coincidencias irrelevantes aunque sean oficiales',async()=>{
 const calls=[]
 const find=makeDiscovery({
  execute:async (_bin,args)=>{
   calls.push(args.at(-1))
   return {stdout:JSON.stringify({entries:[{id:'aaaaaaaaaaa',title:'Don Don (Official Video)'}]})}
  },
  publicSearch:async q=>new Map(q.includes('"')?[
   ['bbbbbbbbbbb',{title:'Don’t Cry Baby'}],
   ['ccccccccccc',{title:'Don Don (Official Video)'}]
  ]:[])
 })
 assert.deepEqual((await find('dont cry baby')).map(track=>track.id),['bbbbbbbbbbb'])
 assert.equal(calls[0],"ytsearch12:don't cry baby")
})

test('PayaSO DE RODEO y payaso de rodeo consultan y clasifican igual',async()=>{
 const find=makeDiscovery({execute:async (_bin,args)=>{
  assert.equal(args.at(-1),'ytsearch12:payaso de rodeo')
  return {stdout:JSON.stringify({entries:[{id:'aaaaaaaaaaa',title:'PayaSO de RODEO'}]})}
 }})
 const [mixed,lower]=await Promise.all([find('PayaSO DE RODEO'),find('payaso de rodeo')])
 assert.deepEqual(mixed,lower)
 assert.equal(mixed[0].id,'aaaaaaaaaaa')
})

test('acepta nombres entre paréntesis y amplía la búsqueda cuando el índice estricto no encuentra al artista',async()=>{
 const find=makeDiscovery({
  execute:async()=>{throw Object.assign(Error('yt-dlp no disponible'),{code:'ENOENT'})},
  publicSearch:async (query,_,options)=>new Map(options?.wide&&query==='artista ejemplo official audio'?
   [['aaaaaaaaaaa',{title:'Artista Ejemplo - Tema Oficial'}],['bbbbbbbbbbb',{title:'Otro artista'}]]:[])
 })
 assert.deepEqual((await find('(Artista Ejemplo)')).map(t=>t.id),['aaaaaaaaaaa'])
})

test('reconoce variantes del nombre artístico, sin confundir títulos',()=>{
 const entries=[{id:'aaaaaaaaaaa',title:'Faded',channel:'AlanWalkerVEVO'},{id:'bbbbbbbbbbb',title:'Otra canción',channel:'Otro'}]
 assert.equal(rankVideos(entries,'Alan Walker')[0]?.id,'aaaaaaaaaaa')
})

test('play yt reutiliza el MP3 local sin ID si coinciden título y artista',async t=>{
 const f=await fixture(t)
 const manifest=path.join(f.base,'manifest.json')
 await fs.writeFile(manifest,JSON.stringify([{title:'Faded',artist:'Alan Walker',file:'faded.wav'}]))
 const bot=createMusicSystem({library:f.library,catalogPath:manifest,musicDir:f.inbox,discovery:async()=>[
  {id:'bbbbbbbbbbb',title:'Faded',artist:'Otro artista',score:10},
  {id:'aaaaaaaaaaa',title:'Alan Walker - Faded (Official Video)',score:9}
 ]})
 let sent=0
 await bot.handle({command:'play',query:'yt faded',actor:'a',group:'x',prefix:'?',reply:()=>assert.fail('Se esperaba audio'),sendAudio:async ({url})=>{assert.ok(url.endsWith('.mp3'));sent++}})
 assert.equal(sent,1)
})

test('play yt envía audio local para otro artista si falla YouTube',async t=>{
 const f=await fixture(t)
 const manifest=path.join(f.base,'manifest.json')
 await fs.writeFile(manifest,JSON.stringify([{title:'Tema de prueba',artist:'Artista alternativo',file:'faded.wav'}]))
 const bot=createMusicSystem({library:f.library,catalogPath:manifest,musicDir:f.inbox,discovery:async()=>{throw Error('Fallo externo')}})
 let sent=0
 await bot.handle({command:'play',query:'yt ARTISTA ALTERNATIVO',actor:'a',group:'x',prefix:'?',reply:()=>assert.fail('Se esperaba audio'),sendAudio:async ({url},options)=>{
  assert.ok(url.endsWith('.mp3'))
  assert.equal(options.mimetype,'audio/mpeg')
  assert.equal(options.ptt,false)
  sent++
 }})
 assert.equal(sent,1)
})

test('play yt manda una pista del mismo artista aunque sus resultados solo tengan enlaces',async t=>{
 const f=await fixture(t)
 await f.library.import({file:'other.flac',title:'Pista local',artist:'Artista alternativo',authorization})
 const bot=createMusicSystem({library:f.library,catalogPath:path.join(f.base,'manifest.json'),musicDir:f.inbox,discovery:async()=>[
  {id:'bbbbbbbbbbb',title:'Otra canción',artist:'Artista alternativo',score:7}
 ]})
 let sent=0
 await bot.handle({command:'play',query:'yt Artista alternativo',actor:'a',group:'x',prefix:'?',reply:()=>assert.fail('No debe enviar solo un enlace'),sendAudio:async ({url},metadata)=>{
  assert.ok((await fs.stat(url)).size>0)
  assert.equal(metadata.mimetype,'audio/mpeg')
  sent++
 }})
 assert.equal(sent,1)
})

test('si no existe ffprobe, FFmpeg valida el audio antes de convertir',async t=>{
 const f=await fixture(t)
 const library=createMusicLibrary({...f.options,execute:async(bin,args,config)=>{
  if(bin==='ffprobe')throw Object.assign(Error('missing'),{code:'ENOENT'})
  if(args.at(-1)==='-')return {stderr:'Duration: 00:03:30.50, start: 0\nStream #0:0: Audio: mp3'}
  return f.options.execute(bin,args,config)
 }})
 await library.start()
 const track=await library.import({file:'faded.wav',title:'Faded',authorization})
 assert.equal(track.duration,210.5)
 assert.ok(await library.fileForPlayback(track))
})

test('artista y título juntos: audio no PTT, limpieza tras envío y género persistente',async t=>{
 const f=await fixture(t)
 const manifest=path.join(f.base,'manifest.json')
 await fs.writeFile(manifest,JSON.stringify([{title:'Faded',artist:'Alan Walker',file:'faded.wav'}]))
 const bot=createMusicSystem({library:f.library,catalogPath:manifest,musicDir:f.inbox,discovery:async()=>assert.fail('Debe encontrar el original local')})
 let sent
 const play=actor=>bot.handle({command:'play',query:'Alan Walker Faded',actor,group:'x',prefix:'?',reply:()=>assert.fail('Se esperaba audio'),sendAudio:async ({url},metadata)=>{
  assert.equal(metadata.ptt,false)
  assert.equal(metadata.mimetype,'audio/mpeg')
  assert.ok((await fs.stat(url)).size)
  assert.equal(f.counts().analyses,actor==='first'?0:1)
  sent=url
 }})
 await play('first')
 await f.library.settle()
 await assert.rejects(fs.stat(sent),{code:'ENOENT'})
 assert.ok((await fs.stat(path.join(f.inbox,'faded.wav'))).size)
 const track=f.library.list()[0]
 assert.equal(track.availability,'uncached')
 assert.equal(track.genre,'House')
 await play('second')
 await f.library.settle()
 assert.equal(f.counts().analyses,1)
 assert.equal(f.library.find(track.id).plays,2)
})
