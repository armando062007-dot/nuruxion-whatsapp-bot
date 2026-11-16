import { randomBytes, randomInt } from 'node:crypto'
import { foods, supplies } from './kingdom-supplies.mjs'

const kit={pértiga:2,cuña:1,tiza:3,piedra:3,cuerda:1,resina:1,linterna:1,fieltro:1,clavos:1,brújula:1}
const rooms={
 entrada:['Galerías del Derrumbe','Alguien golpea dos veces desde el fondo.',{izquierda:'losas',derecha:'ceniza',avanzar:'santuario'}],
 losas:['Losas de presión','La losa central está hundida y no tiene polvo.',{volver:'entrada',izquierda:'santuario',avanzar:'campanas'}],
 ceniza:['Suelo de ceniza','Las huellas terminan de golpe bajo el polvo.',{volver:'entrada',avanzar:'sal',izquierda:'santuario'}],
 campanas:['Pasillo de las campanas','Hilos tensos cruzan el camino a la altura del tobillo.',{volver:'losas',avanzar:'resonancia'}],
 sal:['Puente de sal','Las grietas se abren bajo el peso de tu mochila.',{volver:'ceniza',avanzar:'marea'}],
 marea:['Compuerta de marea','Tres marcas en el muro. El agua ya alcanzó la primera.',{volver:'sal',avanzar:'carcelero'}],
 resonancia:['Cristales resonantes','El eco de un golpe antiguo todavía vibra.',{volver:'campanas',avanzar:'reflejos'}],
 reflejos:['Pasillo de los reflejos','Tu reflejo dobla antes que tú. Sus botas no levantan polvo.',{volver:'resonancia',avanzar:'reina'}],
 santuario:['Santuario Invertido','Una comerciante cuida el fuego. La inscripción dice: «Alumbra sin quemar».',{volver:'entrada',izquierda:'runas',derecha:'peso',avanzar:'marea'}],
 runas:['Baldosas de runas','El muro muestra una luna, un ojo y una llama.',{volver:'santuario',avanzar:'corazón'}],
 peso:['Puerta de contrapeso','La puerta cede cuando bajas la mochila al suelo.',{volver:'santuario',avanzar:'cofre'}],
 cofre:['Cofre que respira','La cerradura se empaña desde dentro.',{volver:'peso',avanzar:'comecofres'}],
 carcelero:['El Carcelero de Sal','Una cadena arrastra piedras bajo el agua.',{volver:'marea',avanzar:'coloso'}],
 reina:['La Reina de los Espejos','La copia espera a ver qué haces primero.',{volver:'reflejos',avanzar:'corazón'}],
 comecofres:['El Comecofres','Le atrae el sonido de las bisagras de tu mochila.',{volver:'cofre',avanzar:'coloso'}],
 coloso:['El Coloso de las Vetas','Tres anclajes sostienen al coloso sobre un barranco.',{volver:'carcelero',avanzar:'corazón'}],
 corazón:['El Corazón Hueco','Las luces titilan. El cristal busca el fragmento que llevas.',{volver:'santuario'}],
 cisterna:['Cisterna','Caíste a una cámara inferior, pero hay una escalera de servicio.',{avanzar:'santuario'}]
}
const bosses={
 carcelero:[3,['La cadena deja de sonar. Viene un barrido.'],['cubrirte','cebar']],
 reina:[3,['La copia imitará tu última acción.'],['observar','luz']],
 comecofres:[3,['Abre la mandíbula y busca tus cofres.'],['cebar','cubrirte']],
 coloso:[3,['Un anclaje queda tenso: rompe el siguiente antes de que caiga el techo.'],['forzar','cuña']],
 corazón:[4,['Las luces se apagan.','El suelo se parte.','El cristal intenta absorber tu fragmento.'],['luz','saltar','cubrirte']]
}
const normal=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase()
const has=(r,k)=>r.kit[k]>0
const use=(r,k)=>{if(!has(r,k))return false;r.kit[k]--;return true}
const clear=(r,id)=>{r.flags[id]=true}
const hurt=(r,n)=>{
 if(r.wardUntil>r.clock)return
 if(r.shield){n=Math.ceil(n*(100-r.shield)/100);r.shield=0}
 r.hp=Math.max(0,r.hp-n)
}
const availableFood=(owned,down)=>foods.filter(f=>owned.includes(f.id)&&(!down||f.reviveBps))
const foodCommand=f=>'comer '+f.number
function foodOptions(owned,down){return availableFood(owned,down).map(f=>[foodCommand(f),f.name+' · '+f.description])}
function recoverDefeat(r){
 r.downed=false
 if(!r.checkpoint)return false
 r.room=r.checkpoint;r.trail=['entrada'];r.hp=65;r.botin=0;r.cofres=0;r.cache={};loseUnsecuredRelics(r);r.ruido=0;r.shield=0
 return true
}
const gearIds=['brujula_segunda_huella','pacto_ultima_antorcha','sello_cronista','tinta_heraldo','lente_del_reverso','estuche_de_nacar','salvoconducto_de_hilo']
const lensClues={
 losas:'La placa central te quitaría 22 de vida. Lanzar una piedra desde lejos suma 2 de ruido.',
 ceniza:'Saltar sin botas de clavos cuesta 14 de vida. Puedes sondear sin gastar la pértiga.',
 campanas:'Forzar el paso suma 2 de ruido. Agacharte no gasta herramientas.',
 sal:'Si llevas más de 3 entre hallazgos y cofres, pisar sin botas de clavos te quita 18 de vida y te tira a la cisterna.',
 marea:'Forzar dos veces te arrastra a la cisterna y te quita 20 de vida. Cerrar la compuerta no gasta equipo.',
 resonancia:'Forzar cuesta 16 de vida y suma 2 de ruido. Esperar baja 3 de ruido.',
 reflejos:'Seguir al reflejo te quita 12 de vida y te tira a la cisterna. La tiza no hace ruido.',
 runas:'Una baldosa abre el paso. Las otras cuestan 22 de vida por intento; la lente no distingue la correcta.',
 peso:'La cuña se consume. Rodear la puerta no gasta equipo.',
 cofre:'Abrir aquí cuesta 22 de vida. Si lo guardas, puedes abrirlo a salvo en el santuario.'
}
const junction=r=>['entrada','losas','ceniza','santuario'].includes(r.room)
// IDs estables para el sistema futuro. En WhatsApp sólo salen los nombres y las pistas.
const relics={
 miga_lucerna:['Miga de Lucerna','Huele a pan recién hecho, aunque está fría como la piedra.'],
 esencia_velabruma:['Esencia de Velabruma','Una hebra de niebla gira dentro del frasco, incluso cuando lo dejas quieto.'],
 plato_lunacobre:['Plato de Lunacobre','Su borde cambia de color cuando lo acercas al fuego.'],
 baya_sieteluz:['Baya de Sieteluz','Siete puntitos brillan bajo la cáscara, como una constelación diminuta.'],
 migas_ambar:['Perlas de Ámbar Dulce','Crujen como azúcar y dejan un rastro de chispas al rodar.'],
 cuenco_cieloroto:['Cuenco de Cielorroto','Las motas azules de su esmalte cambian de sitio cuando apartas la vista.']
}
const relicByRoom={ceniza:'miga_lucerna',reflejos:'esencia_velabruma',runas:'baya_sieteluz'}
const relicByChallenge={cofre:'plato_lunacobre',cisterna:'cuenco_cieloroto',peso:'migas_ambar'}
function findRelic(r,id){
 if(!id||r.flags['reliquia:'+id])return ''
 r.flags['reliquia:'+id]=true
 r.relics??={}
 r.relics[id]=(r.relics[id]||0)+1
 const [name,hint]=relics[id]
 return `\n\n✨ *Hallazgo extraño: ${name}*\n_${hint} No reconoces la marca que lleva._`
}
const relicList=items=>Object.entries(items||{}).filter(([id,n])=>relics[id]&&n>0).map(([id,n])=>`${relics[id][0]} ×${n}`).join(' · ')
function loseUnsecuredRelics(r){
 r.relics=r.securedRelic?{[r.securedRelic]:1}:{}
}
const encounters={
 losas:{type:'enemy',name:'Varek, el Centinela de Plomo',tell:'Levanta el escudo y deja descubierto el costado.',counter:'flanquear',hp:2,damage:13,reward:3},
 campanas:{type:'enemy',name:'Sibil, la Hilandera de Bronce',tell:'La criatura tensa un hilo antes de saltar.',counter:'cortar hilo',hp:2,damage:16,reward:4},
 sal:{type:'enemy',name:'Brum, el Sabueso de Sal',tell:'Baja la cabeza antes de embestir.',counter:'esquivar',hp:3,damage:15,reward:5},
 resonancia:{type:'puzzle',name:'El mecanismo de Aural',clue:'La inscripción dice: «Primero calla el bronce; después despierta la piedra; al final habla el cristal». Escribe los tres materiales separados por espacios.',answer:'bronce piedra cristal',seconds:45,reward:7},
 runas:{type:'puzzle',name:'El archivo de Neria',clue:'Tres marcas muestran 2, 4 y 8. Cada marca vale el doble de la anterior. ¿Qué número lleva la cuarta?',answer:'16',seconds:30,reward:6},
 peso:{type:'puzzle',name:'La balanza de Drom',clue:'En un plato hay tres pesas de 4 kilos. En el otro ya hay una de 5. ¿Cuántos kilos faltan para igualarlos? Escribe solo el número.',answer:'7',seconds:40,reward:8},
 cofre:{type:'duel',name:'Malvek, el Tahúr del Umbral',rule:'Malvek tira dos dados y se queda con el mayor. Tú tiras uno. En empate gana él. Consigue 2 victorias antes de sufrir 3 derrotas.',choices:[['tirar','Lanzar tu dado']],target:2,maxLoss:3,damage:9,reward:18},
 cisterna:{type:'duel',name:'Isera, la Oráculo Sumergida',rule:'Elige una de tres runas. Isera sella dos al azar cada ronda. Si eliges la única libre, ganas la ronda. Consigue 2 aciertos antes de 3 fallos.',choices:[['runa luna','Elegir Luna'],['runa ojo','Elegir Ojo'],['runa llama','Elegir Llama']],target:2,maxLoss:3,damage:10,reward:16}
}
function encounterOptions(r){
 const e=encounters[r.room],s=r.encounter
 if(s.type==='enemy')return [[e.counter,'Responder a su movimiento'],['atacar','Atacar de frente'],['retirarte','Abandonar el encuentro']]
 if(s.type==='puzzle')return [['cancelar','Cerrar el mecanismo y renunciar al premio']]
 return [...e.choices,['retirarte','Abandonar el desafío']]
}
function finishEncounter(r,status){
 const e=encounters[r.room]
 r.flags['encuentro:'+r.room]=status
 r.encounter=null
 if(status==='ganado'){r.botin+=e.reward;return `¡Superaste a ${e.name}! +${e.reward} hallazgos.`+findRelic(r,relicByChallenge[r.room])}
 return status==='tiempo'?'Se acabó el tiempo. El mecanismo se cerró sin entregar su premio.':'El desafío terminó sin recompensa.'
}
function encounterAction(r,cmd,now,roll){
 const e=encounters[r.room],s=r.encounter
 if(cmd==='retirarte'||cmd==='cancelar')return finishEncounter(r,'retirada')
 if(s.type==='puzzle'){
  if(now>=s.endsAt)return finishEncounter(r,'tiempo')
  if(cmd.slice(10).trim().replace(/\s+/g,' ')===e.answer)return finishEncounter(r,'ganado')
  s.attempts--
  return s.attempts===0?finishEncounter(r,'fallado'):`No encaja. Te quedan ${s.attempts} intentos.`
 }
 if(s.type==='enemy'){
  s.hp--
  if(cmd!==e.counter)hurt(r,e.damage)
  return s.hp===0?finishEncounter(r,'ganado'):`A ${e.name} le quedan ${s.hp} marcas.`
 }
 let won,detail
 if(cmd==='tirar'){
  const player=roll(1,7),a=roll(1,7),b=roll(1,7)
  won=player>Math.max(a,b);detail=`Tu dado: ${player}. Dados de Malvek: ${a} y ${b}.`
 }else{
  const free=e.choices[roll(0,3)][0]
  won=cmd===free;detail=`La runa libre era ${free.split(' ')[1]}.`
 }
 if(won)s.wins++
 else{s.losses++;hurt(r,e.damage)}
 if(s.wins>=e.target)return detail+' '+finishEncounter(r,'ganado')
 if(s.losses>=e.maxLoss)return detail+' '+finishEncounter(r,'fallado')
 return detail+` ${won?'Ganaste':'Perdiste'} la ronda. Marcador: ${s.wins}/${e.target} victorias · ${s.losses}/${e.maxLoss} derrotas.`
}
const roomOptions=(r)=>{
 const id=r.room, boss=bosses[id], a=[]
 const add=(cmd,desc)=>a.push([cmd,desc])
 if(r.encounter)return encounterOptions(r)
 if(boss&&!r.flags[id]){
  if(id==='corazón'&&r.boss[id]===0){add('sellar','Devolver la luz al santuario');add('destruir','Recuperar un material de herrería')}
  else{
   add('pelear','Atacar al jefe')
   const counters=id==='corazón'?[boss[2][Math.min(r.phase,2)]]:boss[2]
   const moves={cubrirte:'Cubrirte del golpe',cebar:'Distraer al guardián',observar:'Estudiar el reflejo',luz:'Alumbrar al guardián',saltar:'Saltar sobre la grieta',forzar:'Romper un anclaje',cuña:'Atorar un anclaje'}
   for(const cmd of counters){const need={cuña:'cuña',luz:'linterna'}[cmd];if((!need||has(r,need))&&(cmd!=='cebar'||has(r,'piedra')||id==='comecofres'&&r.cofres>0))add(cmd,moves[cmd])}
  }
  add('volver','Retroceder');return a
 }
 const protectedRoom=!r.flags[id]
 const choices={
  losas:[['pisar izquierda','Evitar la placa central'],['pisar centro','Pisar la placa'],['lanzar piedra centro','Activar la placa desde lejos','piedra'],['cuña','Inmovilizar la placa','cuña']],
  ceniza:[['sondear','Buscar huecos sin pisarlos','pértiga'],['saltar','Arriesgarte a cruzar']],
  campanas:[['agacharte','Pasar por debajo'],['resina','Pegar el hilo al muro','resina'],['forzar','Hacer sonar las campanas']],
  sal:[['cuerda','Dejar una cuerda para el regreso','cuerda'],['esconder','Dejar el botín a resguardo'],['pisar','Cruzar por el puente']],
  marea:[['cerrarcompuerta','Bajar el agua'],['forzar','Abrir la reja rápido'],['cuerda','Bajar por el desagüe','cuerda']],
  resonancia:[['esperar','Dejar que se apague el eco'],['forzar','Derrumbar los cristales']],
  reflejos:[['marcar','Señalar el camino real','tiza'],['luz','Mostrar el tramo falso','linterna'],['pisar','Seguir tu reflejo']],
  runas:[['pisar luna','Probar la luna'],['pisar ojo','Probar el ojo'],['pisar llama','Probar la llama']],
  peso:[['esconder','Aligerar la mochila'],['cuña','Trabar el mecanismo','cuña'],['rodear','Tomar el desvío']],
  cofre:[['abrir','Abrirlo aquí'],['guardar','Llevarlo cerrado'],['cebar','Distraerlo con una piedra de eco','piedra']]
 }
 if(protectedRoom)for(const [cmd,desc,need] of choices[id]||[])if(!need||has(r,need))add(cmd,desc)
 if(id==='santuario'){if(r.hp<100)add('curar','Descansar');if(r.cofres)add('abrir','Abrir un cofre a salvo');if(r.botin>=4)add('comerciar','Cambiar 4 hallazgos por cuerda');if(!r.flags.calco)add('calcar','Copiar la inscripción');}
 if(protectedRoom&&lensClues[id]&&r.gear?.includes('lente_del_reverso')&&!r.flags.lente)add('examinar trampa','Usar la lente antes de decidir')
 if(id==='santuario'&&r.gear?.includes('salvoconducto_de_hilo')&&!r.flags.salvoconducto)add('paso de servicio','Usar el salvoconducto para bajar a la Cisterna')
 if(id==='santuario'&&r.gear?.includes('estuche_de_nacar')&&!r.securedRelic){
  for(const [key,[name]] of Object.entries(relics))if(r.relics?.[key]>0)add('proteger '+name,'Guardar este objeto en el estuche')
 }
 if(r.gear?.includes('pacto_ultima_antorcha')&&id==='santuario'&&r.botin>0&&!r.sentLoot)add('enviar al refugio','Enviar la mitad de tus hallazgos; los cobras si completas el encargo y sales')
 if(r.gear?.includes('brujula_segunda_huella')){
  if(junction(r))add('marcar cruce','Marcar este cruce para el regreso')
  if(r.mark)add('buscar marca','Consultar cómo volver al cruce marcado')
 }
 if(r.gear?.includes('tinta_heraldo')&&id==='entrada'&&!r.team)add('nombrar equipo','Ver cómo nombrar tu expedición')
 if(id==='marea'&&r.flags.marea&&!r.flags.rescate)add('rescatar','Sacar al minero')
 if(r.cache[id])add('recoger','Recuperar lo que dejaste aquí')
 for(const [cmd,to] of Object.entries(rooms[id][2])){
  if(cmd==='avanzar'&&protectedRoom&&choices[id])continue
  if(id==='santuario'&&cmd==='avanzar'&&!r.flags.calco)continue
  add(cmd,'Ir a '+rooms[to][0])
 }
 if(id==='entrada')add('salir','Regresar con lo recuperado')
 const encounter=encounters[id]
 if(encounter&&!r.flags['encuentro:'+id]&&(!choices[id]||!protectedRoom))add('desafiar',encounter.name)
 return a
}
function fresh(mode){return {mode,room:'entrada',hp:100,ruido:0,botin:0,cofres:0,kit:{...kit},flags:{},cache:{},boss:{},phase:0,boots:'fieltro',checkpoint:null,water:0,turn:0,trail:[]}}
function move(r,to,back=false){
 r.trail??=[]
 if(back)to=r.trail.pop()||to
 else if(to!=='entrada')r.trail.push(r.room)
 if(to==='entrada')r.trail=[]
 r.room=to;r.phase=0;r.lastAction=''
 if(r.gear?.includes('sello_cronista')&&(r.journal?.length||0)<60)(r.journal??=[]).push(rooms[to][0])
 r.ruido=Math.max(0,r.ruido-(r.boots==='fieltro'?1:0))
 if(to==='santuario')r.checkpoint='santuario'
}
function prompt(r,note='',prefix='?',now=Date.now()){
 const [title,hint]=rooms[r.room],boss=bosses[r.room],warning=boss&&!r.flags[r.room]&&r.boss[r.room]!==0?boss[1][Math.min(r.phase,boss[1].length-1)]:hint
 const e=encounters[r.room],s=r.encounter
 const briefing=s?.type==='puzzle'?`🧩 *${e.name}*\n_${e.clue}_\n⏳ ${Math.max(0,Math.ceil((s.endsAt-now)/1000))} s · ${s.attempts} intentos · Premio: ${e.reward} hallazgos.\n✍️ *${prefix}ecoroto responder TU RESPUESTA*`:s?.type==='duel'?`🎲 *${e.name}*\n${e.rule}\n🏆 Premio: ${e.reward} hallazgos.`:s?`⚔️ *${e.name}* · ${s.hp} marcas\n_${e.tell}_`:null
 const whisper=r.room==='santuario'?'_Junto al fuego hay un rincón vacío. Unas huellas diminutas llegan hasta él, pero ninguna sale._':null
 const opts=r.downed?[...foodOptions(r.foodOnHand||[],true),['rendirse','Aceptar la derrota']]:[...roomOptions(r),...(r.hp<100?foodOptions(r.foodOnHand||[],false):foodOptions(r.foodOnHand||[],false).filter(([cmd])=>Number(cmd.split(' ')[1])>=24))]
 const icon={entrada:'🚪',santuario:'🔥',cisterna:'🌊',marea:'🌊',reflejos:'🪞',runas:'🔮',cofre:'🗝️',corazón:'💠'}[r.room]||(boss?'⚔️':'🕯️')
 const scene=r.downed?'🩸 *Has caído.* Sólo una provisión de reanimación puede levantarte.':`👁️ *Pista de la sala*\n_${warning}_`
 const progress=r.hp===0?'Caído':r.hp<=25?'Crítico':r.hp<=60?'Herido':'En pie'
 const actionList=opts.map(([cmd,desc],i)=>`*${i+1}.* ${desc}\n      ↳ \`${prefix}ecoroto ${cmd}\``).join('\n')
 return [
  `${icon} *『 ${title} 』*\n🌘 _Eco Roto · ${r.mode==='investigacion'?'Investigación':r.mode==='caceria'?'Cacería':'Rescate'}_`+(r.team?'\n_Expedición «'+r.team+'»_':''),
  note?'◆ *Lo que acaba de pasar*\n'+note:null,
  [scene,whisper].filter(Boolean).join('\n'),
  briefing,
  `🧭 *Estado de la expedición*\n❤️ Vida: *${r.hp}/100* · ${progress}\n👣 Ruido: *${r.ruido}/6* · 💎 Hallazgos: *${r.botin}* · 🧰 Cofres: *${r.cofres}*`,
  actionList?'▸ *ACCIONES DISPONIBLES*\n'+actionList:null
 ].filter(Boolean).join('\n\n')
}
function act(r,cmd){
 const id=r.room,b=bosses[id]
 if(b&&!r.flags[id]&&cmd!=='volver'){
  r.boss[id]??=b[0]
  if(id==='corazón'&&r.boss[id]===0){clear(r,id);r.botin+=6;clear(r,cmd==='sellar'?'refugio':'material');return cmd==='sellar'?'Sellaste el Corazón. El santuario recibe su luz.':'El Corazón se rompe y deja mineral del Núcleo.'}
  const hp=r.boss[id], counter=id==='corazón'?b[2][Math.min(r.phase,2)]===cmd:b[2].includes(cmd)
  const repeat=id==='reina'&&r.lastAction===cmd
  if(cmd==='cuña')use(r,'cuña')
  if(cmd==='cebar'){if(id==='comecofres'&&r.cofres){r.cofres--;r.swallowed=(r.swallowed||0)+1}else use(r,'piedra')}
  if(repeat)hurt(r,23)
  else if(counter)r.boss[id]--
  else if(cmd==='pelear'){hurt(r,id==='comecofres'?16+r.cofres*4:18);if(id!=='coloso')r.boss[id]--;}
  r.lastAction=cmd;r.phase=(r.phase+1)%3
  if(r.boss[id]===0&&id!=='corazón'){clear(r,id);r.botin+=5;if(id==='comecofres'){r.cofres+=1+(r.swallowed||0);r.swallowed=0;}if(id==='coloso')return 'El Coloso cae y forma un puente hacia el Corazón.';return 'El guardián cae y recuperas su botín.'}
  return r.boss[id]===0?'El Corazón queda expuesto. Puedes sellarlo o destruirlo.':counter&&!repeat?'Leíste su ataque y aprovechaste la abertura.':`El jefe responde. Le quedan ${hp===r.boss[id]?hp:r.boss[id]} marcas.`
 }
 if(rooms[id][2][cmd]){move(r,rooms[id][2][cmd],cmd==='volver');return 'Cambias de galería.'}
 if(cmd==='curar'){r.hp=100;return 'Descansas junto al fuego.'}
 if(cmd==='recoger'){r.botin+=r.cache[id];delete r.cache[id];return 'Recuperaste tu escondite.'}
 if(cmd==='comerciar'){r.botin-=4;r.kit.cuerda++;return 'La comerciante te entrega una cuerda.'}
 if(cmd==='calcar'){clear(r,'calco');return 'Calcaste la luna. La comerciante abre el paso a la compuerta.'}
 if(cmd==='rescatar'){clear(r,'rescate');r.botin+=3;return 'El minero sale contigo y te enseña una marca del Núcleo.'}
 if(cmd==='abrir'&&id==='santuario'){r.cofres--;r.botin+=4;return 'El cofre se abre sin peligro: +4 hallazgos.'}
 if(cmd==='esconder'){const n=Math.ceil(r.botin/2);r.botin-=n;if(n)r.cache[id]=(r.cache[id]||0)+n}
 const cost={'lanzar piedra centro':'piedra',cuña:'cuña',resina:'resina',cuerda:'cuerda',marcar:'tiza',cebar:'piedra'}[cmd]
 if(cost)use(r,cost)
 if(cmd==='forzar'||cmd==='luz'||cmd==='lanzar piedra centro')r.ruido=Math.min(6,r.ruido+2)
 if(cmd==='esperar')r.ruido=Math.max(0,r.ruido-3)
 if(id==='runas'&&cmd!=='pisar luna'){hurt(r,22);return 'La baldosa se hunde y te quema. La puerta sigue cerrada.'}
 if(cmd==='pisar centro'||id==='cofre'&&cmd==='abrir')hurt(r,22)
 if(id==='ceniza'&&cmd==='saltar'&&r.boots!=='clavos')hurt(r,14)
 if(id==='resonancia'&&cmd==='forzar')hurt(r,16)
 if(id==='sal'&&cmd==='pisar'&&r.botin+r.cofres>3&&r.boots!=='clavos'){hurt(r,18);move(r,'cisterna');return 'El puente cede. Encuentras una salida en la cisterna.'}
 if(id==='reflejos'&&cmd==='pisar'){hurt(r,12);move(r,'cisterna');return 'El reflejo era falso. Caes a la cisterna.'}
 if(id==='marea'&&cmd==='forzar'){r.water++;if(r.water>=2){hurt(r,20);move(r,'cisterna');return 'La corriente te arrastra a la cisterna.'}return 'El agua sube otra marca. Cierra la compuerta o baja con cuerda.'}
 clear(r,id);if(id==='cofre'){if(cmd==='guardar')r.cofres++;else r.botin+=3}
 else if(['losas','ceniza','resonancia','runas'].includes(id))r.botin++
 const relic=findRelic(r,relicByRoom[id])
 if(r.ruido>=6&&id!=='santuario'){hurt(r,12);r.ruido=3;return 'El estruendo atrajo al guardián. Sales del alcance, pero pierdes 12 de vida.'+relic}
 return (id==='runas'&&cmd==='pisar luna'?'La luna abre el camino secreto.':cmd==='cuerda'?'La cuerda queda instalada para volver.':'El camino queda despejado para esta expedición.')+relic
}
export function ecoRoto(store,who,input,prefix='?',chat='', {now=Date.now(),roll=randomInt,gear=[],titleId}={}){
 const cmd=normal(input),key='u:'+who
 let u=store[key];const r=u?.run
 const release=()=>{if(u.partner&&store[u.partner]?.guestOf===key)delete store[u.partner].guestOf;delete u.partner;delete u.invite}
 if(cmd==='ayuda')return '🌘 *Eco Roto* · Beta sin impacto en tu economía.\nElige rescate, investigación o cacería. El bot te dirá las reglas y las acciones disponibles en cada escena.'
 if(cmd==='perfil'){
  const title=supplies.find(item=>item.category==='titulos'&&item.id===titleId&&gear.includes(item.id))
  return `📜 *Eco Roto*${title?' · '+title.name:''} · Hallazgos recuperados: ${u?.hallazgos||0}\nRescates: ${u?.logros.rescate||0} · Investigaciones: ${u?.logros.investigacion||0} · Cacerías: ${u?.logros.caceria||0}\nSellos del Corazón: ${u?.sellos||0} · Mineral del Núcleo: ${u?.mineral||0}`+(relicList(u?.relics)?'\nObjetos extraños recuperados: '+relicList(u.relics):'')
 }
 if(cmd==='cronica'&&u?.chronicle)return u.chronicle
 if(u?.guestOf){
  const host=store[u.guestOf]
  if(!host?.run||host.partner!==key)delete u.guestOf
  else{
   if(host.run.chat!==chat)return 'La expedición de tu equipo está en otro grupo.'
   if(cmd==='separar'){delete host.partner;delete u.guestOf;return 'Saliste del equipo.'}
   if(cmd==='apoyar'){const run=host.run;if(run.downed)return 'Tu compañero debe usar una provisión de reanimación.';if(run.flags['apoyo:'+run.room])return 'Ya apoyaste en esta sala.';if(run.hp===100&&run.ruido===0)return 'Tu compañero no necesita apoyo en este momento.';run.flags['apoyo:'+run.room]=true;run.hp=Math.min(100,run.hp+12);run.ruido=Math.max(0,run.ruido-2);return prompt(run,'Tu apoyo recupera hasta 12 de vida y reduce el ruido.',prefix)}
   return prompt(host.run,'El líder elige el camino. Puedes usar apoyar o separar.',prefix)
  }
 }
 if(r?.chat&&r.chat!==chat)return 'Tu expedición está en otro grupo.'
 if(cmd.startsWith('unir ')){
  if(!chat||r)return 'Para unirte necesitas estar en el grupo y no tener una expedición activa.'
  const token=cmd.slice(5)
  const match=Object.entries(store).find(([k,v])=>k!==key&&v.run?.chat===chat&&!v.partner&&v.invite?.code===token&&v.invite.expires>Date.now())
  if(!match)return 'La invitación es inválida, expiró o pertenece a otro grupo.'
  const [hostKey,host]=match;u=store[key]??={run:null,logros:{},hallazgos:0};u.guestOf=hostKey;host.partner=key;delete host.invite
  return 'Te uniste como apoyo. Usa '+prefix+'ecoroto apoyar. El botín queda con quien dirige la expedición.'
 }
 if(cmd==='invitar'&&r&&chat){
  if(u.partner)return 'Ya tienes compañero.'
  let code
  do{code=randomBytes(4).toString('hex')}while(Object.values(store).some(v=>v.invite?.code===code))
  u.invite={code,expires:Date.now()+600000}
  return 'Invitación válida por 10 minutos en este grupo: *'+prefix+'ecoroto unir '+code+'*'
 }
 if(cmd==='separar'&&r){release();return 'Tu expedición continúa en solitario.'}
 if(!r){if(!['rescate','investigacion','caceria'].includes(cmd))return `🌘 *『 ECO ROTO 』*\n_La puerta antigua cedió. Desde abajo llegan dos golpes… y luego, silencio._\n\n📜 *ELIGE TU ENCARGO*\n🪢 *Rescate* · Encuentra al minero atrapado.\n↳ *${prefix}ecoroto rescate*\n\n🔎 *Investigación* · Descifra las runas del santuario.\n↳ *${prefix}ecoroto investigación*\n\n⚔️ *Cacería* · Derrota a un guardián y vuelve para contarlo.\n↳ *${prefix}ecoroto cacería*\n\n_El bot te guiará al entrar a cada sala._`
  u=store[key]??={run:null,logros:{},hallazgos:0};u.run=fresh(cmd);u.run.chat=chat;u.run.gear=gearIds.filter(id=>gear.includes(id));u.run.foodOnHand=foods.filter(f=>gear.includes(f.id)).map(f=>f.id);if(u.run.gear.includes('sello_cronista'))u.run.journal=[rooms.entrada[0]];return prompt(u.run,'La entrada que conocías se hundió. Bajo los escombros, alguien responde a tus pasos.',prefix)}
 r.clock=now
 r.wardUntil=Math.max(r.wardUntil||0,u.ultraUntil||0)
 r.foodOnHand=foods.filter(f=>gear.includes(f.id)).map(f=>f.id)
 const visibleFood=foodOptions(gear,r.downed).filter(([action])=>r.hp<100||Number(action.split(' ')[1])>=24)
 const fromNumber=/^\d{1,2}$/.test(cmd)?(r.downed?[...visibleFood,['rendirse']]:[...roomOptions(r),...visibleFood])[Number(cmd)-1]?.[0]:cmd
 const food=availableFood(gear,r.downed).find(f=>foodCommand(f)===fromNumber&&visibleFood.some(([a])=>a===fromNumber))
 const defeat=note=>{
  if(availableFood(gear,true).length){r.downed=true;return prompt(r,note,prefix,now)}
  if(r.encounter)finishEncounter(r,'fallado')
  if(recoverDefeat(r))return prompt(r,note+' Te rescataron en el santuario. Perdiste el botín sin proteger.',prefix,now)
  release();u.run=null;return note+' Tu expedición terminó sin botín.'
 }
 if(food){
  const wasDown=r.downed
  gear.splice(gear.indexOf(food.id),1)
  r.foodOnHand=foods.filter(f=>gear.includes(f.id)).map(f=>f.id)
  if(wasDown&&food.reviveBps<10000&&roll(0,10000)>=food.reviveBps)return defeat('La reanimación falló y la provisión se consumió.')
  r.downed=false;r.hp=Math.min(100,r.hp+food.heal)
  if(food.shield&&!wasDown)r.shield=Math.max(r.shield||0,food.shield)
  if(food.wardHours&&(!wasDown||food.reviveBps===10000)){
   const end=now+food.wardHours*3600000
   r.wardUntil=Math.max(r.wardUntil,end)
   if(food.reviveBps===10000)u.ultraUntil=Math.max(u.ultraUntil||0,end)
  }
  return prompt(r,`${food.name}: ${wasDown?'Te reanimaste':'Recuperaste vida'}. Vida: ${r.hp}/100.`,prefix,now)
 }
 if(r.downed){
  if(fromNumber!=='rendirse')return prompt(r,'',prefix,now)
  if(r.encounter)finishEncounter(r,'fallado')
  if(recoverDefeat(r))return prompt(r,'Te rescataron en el santuario. Perdiste el botín sin proteger.',prefix,now)
  release();u.run=null;return 'Tu expedición terminó sin botín.'
 }
 if(r.encounter?.type==='puzzle'&&now>=r.encounter.endsAt)return prompt(r,finishEncounter(r,'tiempo'),prefix,now)
 if(r.encounter){
  const options=encounterOptions(r)
  const action=/^\d{1,2}$/.test(cmd)?options[Number(cmd)-1]?.[0]:options.find(([a])=>a===cmd)?.[0]
  const answer=r.encounter.type==='puzzle'&&cmd.startsWith('responder ')?cmd:action
  if(!answer)return prompt(r,'',prefix,now)
  r.turn++
  const note=encounterAction(r,answer,now,roll)
  if(r.hp<=0)return defeat(note)
  return prompt(r,note,prefix,now)
 }
 if(cmd==='mochila')return '🎒 '+Object.entries(r.kit).filter(([,n])=>n>0).map(([k,n])=>`${k}: ${n}`).join(' · ')+`\nBotas: ${r.boots} · Hallazgos: ${r.botin} · Cofres cerrados: ${r.cofres}`+(relicList(r.relics)?'\nObjetos extraños por extraer: '+relicList(r.relics):'')
 if(cmd==='mapa'||cmd==='mapamazmorra')return '🗺️ '+rooms[r.room][0]+'\nPasos: '+Object.values(rooms[r.room][2]).map(k=>rooms[k][0]).join(' · ')
 if(['observar','escuchar','inspeccionar'].includes(cmd)&&!(cmd==='observar'&&r.room==='reina'&&!r.flags.reina))return prompt(r,'Te detienes a leer las señales. No gastaste un turno.',prefix)
 if(cmd==='botas clavos'||cmd==='botas fieltro'){r.boots=cmd.split(' ')[1];return prompt(r,'Cambias de botas.',prefix)}
 if(cmd==='brujula')return '🧭 '+(r.room==='reflejos'?'La aguja gira al revés.':'La aguja apunta hacia las runas del Santuario Invertido.')
 if(cmd.startsWith('nombrar equipo ')&&r.room==='entrada'&&!r.team&&r.gear?.includes('tinta_heraldo')){
  const team=String(input).trim().match(/^nombrar equipo\s+([\p{L}\p{N}][\p{L}\p{N} -]{2,23})$/iu)?.[1]?.trim()
  if(!team||team.length<3)return prompt(r,'Usa un nombre de 3 a 24 caracteres: letras, números, guiones y espacios.',prefix)
  r.team=team;return prompt(r,`La expedición se inscribe como «${team}».`,prefix)
 }
 const opts=roomOptions(r)
 const choice=/^\d{1,2}$/.test(cmd)?opts[Number(cmd)-1]?.[0]:opts.find(([a])=>normal(a)===cmd)?.[0]
 if(!choice)return prompt(r,cmd?'Esa acción no está disponible aquí.':'',prefix)
 if(choice==='examinar trampa'){r.flags.lente=true;return prompt(r,'🔍 '+lensClues[r.room],prefix)}
 if(choice==='paso de servicio'){r.flags.salvoconducto=true;move(r,'cisterna');return prompt(r,'La llave de hilo abre una escalera bajo el santuario.',prefix)}
 if(choice.startsWith('proteger ')){
  const id=Object.keys(relics).find(key=>'proteger '+relics[key][0]===choice)
  r.securedRelic=id
  return prompt(r,`El estuche protege ${relics[id][0]}. Todavía debes salir para conservarlo.`,prefix)
 }
 if(choice==='nombrar equipo')return prompt(r,`Escribe *${prefix}ecoroto nombrar equipo NOMBRE* (3 a 24 caracteres).`,prefix)
 if(choice==='marcar cruce'){r.mark=r.room;return prompt(r,`Marcaste «${rooms[r.room][0]}».`,prefix)}
 if(choice==='buscar marca'){
  const steps=(r.trail||[]).lastIndexOf(r.mark)
  const target=rooms[r.mark][0]
  return prompt(r,r.mark===r.room?`Estás en el cruce marcado: ${target}.`:steps<0?`Marcaste ${target}. La marca no está en tu camino de regreso actual.`:`Para llegar a ${target}, retrocede ${r.trail.length-steps} tramo(s) por tu ruta.`,prefix)
 }
 if(choice==='enviar al refugio'){
  r.sentLoot=Math.ceil(r.botin/2);r.botin-=r.sentLoot
  return prompt(r,`Enviaste ${r.sentLoot} hallazgos. Sólo los cobras si completas tu encargo y sales.`,prefix)
 }
 if(choice==='desafiar'){
  const e=encounters[r.room]
  r.encounter={type:e.type,hp:e.hp,wins:0,losses:0,attempts:3,endsAt:e.seconds?now+e.seconds*1000:null}
  return prompt(r,'Comienza el desafío.',prefix,now)
 }
 if(choice==='salir'){
  const won=r.mode==='rescate'?r.flags.rescate:r.mode==='investigacion'?r.flags.calco&&r.flags.runas:['carcelero','reina','comecofres','coloso','corazón'].some(id=>r.flags[id])||['cofre','cisterna'].some(id=>r.flags['encuentro:'+id]==='ganado')
  const recovered=r.botin+(won?(r.sentLoot||0):0)
  u.logros[r.mode]=(u.logros[r.mode]||0)+(won?1:0);u.hallazgos+=recovered
  if(r.flags.refugio)u.sellos=(u.sellos||0)+1
  if(r.flags.material)u.mineral=(u.mineral||0)+1
  const extracted=relicList(r.relics)
  if(extracted){
   u.relics??={}
   for(const [id,n] of Object.entries(r.relics))if(relics[id])u.relics[id]=(u.relics[id]||0)+n
  }
  if(r.journal){
   const defeated=Object.keys(bosses).filter(id=>r.flags[id]).map(id=>rooms[id][0])
   for(const [id,e] of Object.entries(encounters))if(e.type==='duel'&&r.flags['encuentro:'+id]==='ganado')defeated.push(e.name)
   u.chronicle=`📜 *Crónica de Eco Roto*${r.team?' · '+r.team:''}\nEncargo: ${r.mode} · ${won?'Completado':'Pendiente'}\nRuta: ${r.journal.join(' → ')}\nJefes: ${defeated.join(', ')||'Ninguno'}\nHallazgos extraídos: ${recovered}.`
  }
  release();u.run=null
  return `🚪 *『 REGRESO A LA SUPERFICIE 』*\n\n💎 Saliste con ${recovered} hallazgos de Eco Roto. ${won?'✅ Encargo completado.':'📜 Encargo pendiente.'}\n_Tu economía habitual no cambió._`+(extracted?'\n\n🎒 Guardaste: '+extracted+'.':'')+(r.journal?`\n📖 Lee la última crónica con *${prefix}ecoroto cronica*.`:'')
 }
 r.turn++;const note=act(r,choice)
 if(r.hp<=0)return defeat('El eco se apaga.')
 return prompt(r,note,prefix)
}
