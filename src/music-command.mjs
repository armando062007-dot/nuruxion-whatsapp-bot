import * as fs from 'node:fs/promises'
import path from 'node:path'
import { createMusicCache, searchChannelTracks } from './music-cache.mjs'

export function createMusicCommand({catalogPath, musicDir, fallback=[], env=process.env, onError=()=>{}, request=fetch}){
  let tracks=fallback
  const cache=createMusicCache({
    dir:path.resolve(env.MUSIC_CACHE_DIR||'./data/music-cache'),
    origin:env.MUSIC_AUDIO_ORIGIN,
    onError,
    download:request
  })
  async function start(){
    try{
      const rows=JSON.parse(await fs.readFile(catalogPath,'utf8'))
      if(!Array.isArray(rows))throw Error('Catálogo inválido')
      tracks=rows.filter(track=>track?.title&&track?.artist&&(
        typeof track.source==='string'||
        (typeof track.file==='string'&&path.basename(track.file)===track.file)
      ))
    }catch(error){if(error.code!=='ENOENT')onError(error)}
    await cache.sweep().catch(onError)
    const timer=setInterval(()=>{void cache.sweep().catch(onError)},60000)
    timer.unref()
  }
  async function handle({query,prefix,reply,sendAudio}){
    if(!query.trim()){
      await reply('🎵 Escribe una canción, género o artista. Ejemplo: *'+prefix+'musica electrónica*.')
      return
    }
    try{
      const candidates=[]
      let foundTitle
      const template=env.MUSIC_AUDIO_URL_TEMPLATE
      const {tracks:matches,videoFound}=await searchChannelTracks(query,tracks,{
        key:env.MUSIC_YOUTUBE_API_KEY,request,
        onVideo: (id,snippet)=>{
          foundTitle??=String(snippet?.title||'Video de YouTube').replace(/(?:https?:\/\/|www\.)\S+/gi,'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,140)
          if(template?.includes('{videoId}')&&/^[\w-]{11}$/.test(id)){
            candidates.push({title:snippet?.title||'Pista',artist:snippet?.channelTitle||'YouTube',source:template.replaceAll('{videoId}',id)})
          }
        }
      })
      if(!matches.length&&!candidates.length){
        await reply(videoFound?'🔎 Encontré en YouTube: '+(foundTitle||'un video relacionado')+'. No tengo el MP3 para enviarlo.':'🎵 No encontré una pista disponible para enviar como audio.')
        return
      }
      const deliver=(track,buffer)=>sendAudio(buffer,{
        mimetype:'audio/mpeg',
        fileName:(track.artist+' - '+track.title).replace(/[\\/:*?"<>|\r\n]/g,'_')+'.mp3'
      })
      if(!matches.length){
        for(const track of candidates.slice(0,3)){
          try{
            await cache.send(track.source,buffer=>deliver(track,buffer))
            return
          }catch(error){if(error.code!=='AUDIO_NOT_FOUND')throw error}
        }
        await reply('🎵 Encontré videos en YouTube, pero no hay un MP3 disponible para esas coincidencias.')
        return
      }
      const track=matches[Math.floor(Math.random()*matches.length)]
      if(track.source)await cache.send(track.source,buffer=>deliver(track,buffer))
      else{
        if(!/\.mp3$/i.test(track.file)||path.basename(track.file)!==track.file)throw Error('Archivo local no válido')
        const file=path.join(musicDir,track.file)
        if((await fs.stat(file)).size>16*1024*1024)throw Error('Archivo demasiado grande')
        await deliver(track,await fs.readFile(file))
      }
    }catch(error){
      onError(error)
      await reply('⚠️ No pude enviar el audio en este momento. Inténtalo de nuevo más tarde.')
    }
  }
  return {start,handle}
}
