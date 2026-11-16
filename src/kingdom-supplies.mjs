import { randomInt } from 'node:crypto'

const food=(number,id,name,price,maxStock,restockDays,heal,description,extra={})=>({number,id,name,price,maxStock,restockDays,heal,description,emoji:'🍲',category:'provisiones',repeatable:true,...extra})
export const foods=[
 food(21,'pan_de_brasal','Pan de Brasal · Común',450,20,7,10,'Recupera 10 de vida en Eco Roto.'),
 food(22,'sopa_de_umbraraiz','Sopa de Umbraraíz · Poco común',800,15,7,20,'Recupera 20 de vida en Eco Roto.'),
 food(23,'guiso_de_sietevetas','Guiso de Sietevetas · Raro',1400,13,9,35,'Recupera 35 de vida en Eco Roto.'),
 food(24,'festin_de_lumbreazul','Festín de Lumbreazul · Épico',2600,11,12,50,'Recupera 50 de vida y reduce 35 % el siguiente golpe.',{shield:35}),
 food(25,'banquete_del_fenix_velado','Banquete del Fénix Velado · Legendario',5500,9,14,75,'Si sigues en pie: +75 de vida, escudo del 60 % para el siguiente golpe e invulnerabilidad por 2 horas en Eco Roto. Si caíste: 40 % de levantarte con 75 de vida. La comida se gasta aunque falle.',{shield:60,reviveBps:4000,wardHours:2,restockBps:2000}),
 food(26,'ambrosia_del_sol_hueco','Ambrosía del Sol Hueco · Ultra legendaria',10500,3,14,100,'Recupera toda la vida o te reanima. Da 7 días de invulnerabilidad en Eco Roto, +15 % de pago en trabajo y diario, y +15 % relativo a la probabilidad de éxito del robo durante esos 7 días.',{reviveBps:10000,wardHours:168,restockBps:500})
]
// El catálogo sólo recibe la ficha pública. Los efectos quedan reservados hasta activar las mascotas.
const mysteryRations=[
 [27,'migas_de_lunaclara','Migas de Lunaclara',813,'Un saquito que huele a miel tostada. El mercader lo guarda bajo llave y nunca explica por qué.',{energy:10}],
 [33,'semillas_de_niebla','Semillas de Niebla',1375,'Las semillas repiquetean dentro del frasco aunque nadie lo agite.',{energy:20,bond:3}],
 [34,'rocio_de_sietelunas','Rocío de Sietelunas',2375,'Una gota de rocío que se divide en siete al tocar la plata.',{energy:35,bond:6,xp:20}],
 [35,'trufa_del_alba_hueca','Trufa del Alba Hueca',4250,'Bajo su corteza oscura late una brasa que no da calor.',{energy:50,bond:10,xp:45,fatigueShield:1}],
 [36,'nectar_del_ultimo_cometa','Néctar del Último Cometa',8750,'La botella guarda una luz que se inclina hacia las estrellas al caer la noche.',{energy:75,bond:18,xp:90,fatigueShield:2}],
 [37,'corazon_de_aurora','Corazón de Aurora',16250,'En el centro de esta pieza traslúcida amanece, incluso bajo tierra.',{energy:100,bond:30,xp:180,fatigueShield:3}]
]
export const companionRationEffects=Object.freeze(Object.fromEntries(mysteryRations.map(([,id,,,,effect])=>[id,Object.freeze(effect)])))
const mysteryCatalog=mysteryRations.map(([number,id,name,price,description],i)=>{
 const {maxStock,restockDays,restockBps}=foods[i]
 return {number,id,name,price,description,maxStock,restockDays,restockBps,repeatable:true,category:'misterio',emoji:'🌙'}
})
export const supplies=[
 ...foods,
 ...mysteryCatalog,
 {number:28,id:'vale_del_forjador',name:'Vale del Forjador',emoji:'⚒️',category:'economia',price:100,maxStock:12,restockDays:7,repeatable:true,description:'Añade 35 % al pago de tus próximos tres trabajos. Se activa al comprar; uno activo a la vez.',reward:'work',uses:3,bonus:35},
 {number:29,id:'bono_del_amanecer',name:'Bono del Amanecer',emoji:'🌅',category:'economia',price:120,maxStock:8,restockDays:9,repeatable:true,description:'Añade 30 % al pago base de tus próximas dos recompensas diarias. Se activa al comprar; uno activo a la vez.',reward:'daily',uses:2,bonus:30},
 {number:30,id:'titulo_vigia_del_rescoldo',name:'Vigía del Rescoldo',emoji:'🔥',category:'titulos',price:3800,description:'Título cosmético permanente. Aparece en tu perfil de Eco Roto al comprarlo.'},
 {number:31,id:'titulo_notario_de_la_niebla',name:'Notario de la Niebla',emoji:'📜',category:'titulos',price:6200,description:'Título cosmético permanente. Aparece en tu perfil de Eco Roto al comprarlo.'},
 {number:32,id:'titulo_custodio_del_umbral',name:'Custodio del Umbral',emoji:'🌘',category:'titulos',price:11000,description:'Título cosmético permanente. Aparece en tu perfil de Eco Roto al comprarlo.'}
]
export const DAY_MS=86400000
// Anclar el ciclo a la primera consulta; nunca volver a tirar dentro del mismo ciclo.
export function refreshSupplyStock(state,item,now=Date.now(),roll=randomInt){
 const cycleMs=item.restockDays*DAY_MS
 if(state&&now-state.cycleStart<cycleMs)return state
 const cycleStart=state?state.cycleStart+Math.floor((now-state.cycleStart)/cycleMs)*cycleMs:now
 const available=item.restockBps==null||roll(0,10000)<item.restockBps
 return {cycleStart,remaining:available?item.maxStock:0}
}
export function rewardWithSupply(inventory,kind,amount,ultra=false){
 const voucher=inventory.kingdomVouchers?.[kind]
 let percent=ultra?15:0
 if(voucher?.remaining>0){
  percent+=voucher.bonus
  if(--voucher.remaining===0)delete inventory.kingdomVouchers[kind]
 }
 return Math.floor(amount*(100+percent)/100)
}
