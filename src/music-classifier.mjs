import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

export function createMusicClassifier({python='python3',models,timeout=90000}){
 if(!models)return undefined
 let worker, pending
 function stop(error){
  const current=worker;worker=null
  current?.kill()
  if(pending){const job=pending;pending=null;clearTimeout(job.timer);job.reject(error)}
 }
 function ensure(){
  if(worker)return worker
  const proc=spawn(python,['-u',fileURLToPath(new URL('./music-model-worker.py',import.meta.url)),models],{stdio:['pipe','pipe','ignore'],windowsHide:true,shell:false})
  worker=proc
  const closed=()=>{if(worker===proc)stop(Error('Clasificador no disponible'))}
  proc.once('error',closed);proc.once('exit',closed);proc.stdin.on('error',closed)
  const lines=createInterface({input:proc.stdout})
  lines.on('line',line=>{
   if(worker!==proc||!pending)return
   let result
   try{result=JSON.parse(line)}catch{return}
   const job=pending;pending=null;clearTimeout(job.timer)
   if(!result||!Array.isArray(result.labels))job.reject(Error('No se pudo analizar la pista'))
   else job.resolve(result)
  })
  return proc
 }
 return file=>new Promise((resolve,reject)=>{
  if(pending){reject(Error('Clasificador ocupado'));return}
  const proc=ensure()
  pending={resolve,reject,timer:setTimeout(()=>stop(Error('Tiempo de análisis agotado')),timeout)}
  proc.stdin.write(JSON.stringify({file})+'\n')
 })
}
