import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createMusicCache, findChannelTracks, searchChannelTracks } from './music-cache.mjs'
import { createMusicCommand } from './music-command.mjs'

test('el plazo empieza al entregar; el barrido funciona después de reiniciar',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nuruxion-music-'))
  t.after(()=>fs.rm(dir,{recursive:true,force:true}))
  let now=Date.now()
  const options={dir,origin:'https://audio.example',clock:()=>now,download:async()=>new Response('ID3sample',{headers:{'content-type':'audio/mpeg'}})}
  await createMusicCache(options).send('https://audio.example/theme.mp3',async buffer=>{
    assert.equal(buffer.toString(),'ID3sample')
    assert.equal((await fs.readdir(dir)).length,1)
    now+=120000
  })
  const afterRestart=createMusicCache(options)
  now+=1799000
  await afterRestart.sweep()
  assert.equal((await fs.readdir(dir)).length,1)
  now+=1001
  await afterRestart.sweep()
  assert.deepEqual(await fs.readdir(dir),[])
})

test('rechaza otros dominios y borra una entrega fallida',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nuruxion-music-'))
  t.after(()=>fs.rm(dir,{recursive:true,force:true}))
  let calls=0
  const cache=createMusicCache({dir,origin:'https://audio.example',download:async(_,init)=>{
    calls++
    assert.equal(init.redirect,'error')
    return new Response('ID3sample',{headers:{'content-type':'audio/mpeg'}})
  }})
  await assert.rejects(cache.send('https://other.example/theme.mp3',()=>{}),/no autorizado/)
  assert.equal(calls,0)
  await assert.rejects(cache.send('https://audio.example/theme.mp3',()=>{throw Error('envío fallido')}),/envío fallido/)
  assert.deepEqual(await fs.readdir(dir),[])
})

test('YouTube sólo empareja videos del canal con pistas autorizadas',async()=>{
  const track={title:'Luz',artist:'Art',videoId:'approved'}
  const matches=await findChannelTracks('otra búsqueda',[track,{title:'Otra pista',artist:'Art',videoId:'foreign'}],{channelId:'own',key:'test',request:async url=>{
    assert.equal(new URL(url).searchParams.get('channelId'),'own')
    return new Response(JSON.stringify({items:[
      {snippet:{channelId:'own'},id:{videoId:'approved'}},
      {snippet:{channelId:'other'},id:{videoId:'foreign'}},
      {snippet:{channelId:'own'},id:{videoId:'unlisted-in-catalog'}}
    ]}))
  }})
  assert.deepEqual(matches,[track])
})

test('consulta YouTube de nuevo incluso cuando el título ya coincide en el catálogo',async()=>{
  const track={title:'Luz',artist:'Art',videoId:'approved'}
  let calls=0
  const options={channelId:'own',key:'test',request:async()=>{
    calls++
    return new Response(JSON.stringify({items:[{snippet:{channelId:'own'},id:{videoId:calls===1?'approved':'not-in-catalog'}}]}))
  }}
  assert.deepEqual(await searchChannelTracks('Luz',[track],options),{tracks:[track],videoFound:true})
  assert.deepEqual(await searchChannelTracks('Luz',[track],options),{tracks:[],videoFound:true})
  assert.equal(calls,2)
})

test('busca por artista en YouTube sin vincular un canal ni enviar pistas desconocidas',async()=>{
  const track={title:'Luz',artist:'Art',videoId:'approved'}
  const result=await searchChannelTracks('Art electrónica',[track],{key:'test',request:async url=>{
    const params=new URL(url).searchParams
    assert.equal(params.has('channelId'),false)
    assert.equal(params.get('q'),'Art electrónica')
    return new Response(JSON.stringify({items:[
      {snippet:{channelId:'first'},id:{videoId:'unknown'}},
      {snippet:{channelId:'second'},id:{videoId:'approved'}}
    ]}))
  }})
  assert.deepEqual(result,{tracks:[track],videoFound:true})
})

test('encuentra y envía por ID sin ficha local ni enlaces, saltando un MP3 inexistente',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nuruxion-resolver-'))
  t.after(()=>fs.rm(dir,{recursive:true,force:true}))
  const paths=[]
  const command=createMusicCommand({musicDir:dir,catalogPath:path.join(dir,'catalog.json'),env:{
    MUSIC_CACHE_DIR:dir,MUSIC_YOUTUBE_API_KEY:'test',MUSIC_AUDIO_ORIGIN:'https://audio.example',
    MUSIC_AUDIO_URL_TEMPLATE:'https://audio.example/{videoId}.mp3'
  },request:async target=>{
    const url=new URL(target)
    if(url.hostname==='www.googleapis.com')return Response.json({items:[
      {id:{videoId:'aaaaaaaaaaa'},snippet:{title:'Sin audio'}},
      {id:{videoId:'bbbbbbbbbbb'},snippet:{title:'Luz',channelTitle:'Art'}}
    ]})
    paths.push(url.pathname)
    if(url.pathname==='/aaaaaaaaaaa.mp3')return new Response(null,{status:404})
    return new Response('ID3test',{headers:{'content-type':'audio/mpeg'}})
  }})
  let sent=0
  await command.handle({query:'Art',prefix:'?',reply:()=>assert.fail('No debe enviar texto'),sendAudio:(buffer,metadata)=>{
    assert.equal(buffer.toString(),'ID3test')
    assert.equal(metadata.fileName,'Art - Luz.mp3')
    sent++
  }})
  assert.equal(sent,1)
  assert.deepEqual(paths,['/aaaaaaaaaaa.mp3','/bbbbbbbbbbb.mp3'])
  assert.equal((await fs.readdir(dir)).length,1)
})

test('sin clave consulta el buscador público, descarta otros sitios y no manda enlaces',async()=>{
  const command=createMusicCommand({catalogPath:'unused',musicDir:'.',env:{},request:async target=>{
    const url=new URL(target)
    assert.equal(url.hostname,'www.bing.com')
    assert.equal(url.searchParams.get('q'),'site:youtube.com/watch fernanflo')
    return new Response('<rss><channel><item><title>Otro sitio</title><link>https://other.example/watch?v=aaaaaaaaaaa</link></item><item><title>Fernanflo &amp; Luz - YouTube</title><link>https://www.youtube.com/watch?v=bbbbbbbbbbb</link></item></channel></rss>')
  }})
  let result=''
  await command.handle({query:'fernanflo',prefix:'?',reply:text=>{result=text},sendAudio:()=>assert.fail('No hay un MP3 disponible')})
  assert.match(result,/Fernanflo & Luz/)
  assert.doesNotMatch(result,/https?:|www\./)
})
