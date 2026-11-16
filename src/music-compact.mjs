import fs from 'node:fs/promises'

export const maxCompactBytes=999999
export const rates=[64,56,48,40,32,24,16,8]
export const rateFor=duration=>rates.find(rate=>duration*rate*125<=980000)
export async function compactMp3({execute,ffmpeg,input,output,duration}){
 const start=rateFor(duration)
 for(const rate of rates.slice(rates.indexOf(start))){
  const sampleRate=rate>=56?'32000':rate>=32?'24000':'16000'
  await execute(ffmpeg,['-y','-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',input,'-map','0:a:0','-vn','-map_metadata','-1','-threads','1','-ac',rate>=56?'2':'1','-ar',sampleRate,'-c:a','libmp3lame','-b:a',rate+'k',output],{shell:false,timeout:90000,maxBuffer:128*1024,windowsHide:true})
  const {size}=await fs.stat(output)
  if(size>0&&size<=maxCompactBytes)return {size,encoding:rate+'k'}
 }
 throw Error('No fue posible comprimir la pista completa a menos de 1 MB')
}
