import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { START, END, active, winterFlavor, runChristmas } from './christmas.mjs'
const state = { halloween2026: { boss: { defeated:true, damage: {a:200} } }, wallets:{}, inventory:{}, workEventMultipliers:{a:9999999999999} }
const originalArchive=JSON.stringify(state)
const user='12025550101@s.whatsapp.net', other='12025550102@s.whatsapp.net', third='12025550103@s.whatsapp.net'
let now=START-1, money=0
const call=(input='',extra={})=>{const r=runChristmas(state,{jid:user,group:'clan@g.us',input,now,...extra});money+=r.coins;return r}
for (const command of ['navidad','regalos','jefenavidad']) for(const input of ['','repartir','jefe atacar','premios','amigo apuntarme','fabricar','arbol aportar','mision','top']) assert.match(call(input,{command}).text,/comienza el 20/)
assert.equal(JSON.stringify(state),originalArchive)
assert.equal(active(START-1),false);assert.equal(active(START),true);assert.equal(active(END-1),true);assert.equal(active(END),false)
assert.equal(winterFlavor('work',START-1),'');assert.ok(winterFlavor('daily',START));assert.equal(winterFlavor('dungeon',END),'')
assert.match(call('panel').text,/exclusiva/)
assert.match(call('panel',{owner:true}).text,/Inicio fijo/)
let pending=call('configurar regalos cerrar',{owner:true}).text.match(/confirmar ([a-f0-9]+)/)[1]
assert.match(call('confirmar '+pending,{owner:false}).text,/exclusiva/)
assert.match(call('confirmar '+pending,{owner:true,group:'other@g.us'}).text,/inválida/)
assert.match(call('confirmar '+pending,{owner:true}).text,/confirmado/)
assert.equal(state.christmas2026.settings.gifts,false)
assert.match(call('confirmar '+pending,{owner:true}).text,/inválida/)
pending=call('configurar limite-regalos 4',{owner:true}).text.match(/confirmar ([a-f0-9]+)/)[1]
assert.match(call('confirmar '+pending,{owner:true,now:START+300000}).text,/caducada/)
assert.equal(state.christmas2026.settings.giftLimit,3)
// Config cannot override the hard start date.
pending=call('configurar regalos abrir',{owner:true}).text.match(/confirmar ([a-f0-9]+)/)[1]
call('confirmar '+pending,{owner:true});assert.match(call('regalos repartir').text,/comienza/);assert.equal(money,0)
now=START
for(let i=0;i<3;i++)assert.equal(call('repartir',{command:'regalos'}).coins,100)
assert.equal(call('repartir',{command:'regalos'}).coins,0)
assert.equal(call('repartir',{command:'regalos',group:'other@g.us'}).coins,0,'daily cap is global, not per group')
const restartSnapshot=JSON.parse(JSON.stringify(state))
assert.equal(runChristmas(restartSnapshot,{jid:user,group:'clan@g.us',command:'regalos',input:'repartir',now}).coins,0,'restart does not reset daily caps')
assert.equal(call('mision').coins,150);assert.equal(call('mision').coins,0)
call('fabricar');assert.equal(state.christmas2026.players[user].parcels,1)
assert.match(call('regalar',{target:user}).text,/otra persona/)
call('regalar',{target:other});assert.equal(state.christmas2026.players[other].stars,5)
const coinsBefore=money
assert.match(call('regalar',{target:other}).text,/Necesitas/);assert.equal(money,coinsBefore)
for(const input of ['tienda __proto__','tienda constructor','configurar __proto__ abrir'])call(input,{owner:true})
assert.ok(Number.isFinite(state.christmas2026.players[user].stars))
const d1=state.christmas2026.players[user].days
now+=86400000
assert.equal(call('repartir',{command:'regalos'}).coins,100)
assert.equal(call('mision').coins,150)
call('huellas');assert.equal(state.christmas2026.players[user].clues,1);call('huellas');assert.equal(state.christmas2026.players[user].clues,1)
call('carta 1',{target:other});assert.equal(state.christmas2026.players[other].inbox.length,1)
call('carta 2',{target:other});call('carta 3',{target:other});assert.equal(state.christmas2026.players[other].inbox.length,2)
for(const jid of [user,other,third])call('amigo apuntarme',{jid})
assert.match(call('amigo ver').text,/por privado/)
pending=call('configurar sorteo preparar',{owner:true}).text.match(/confirmar ([a-f0-9]+)/)[1]
call('confirmar '+pending,{owner:true})
const pairs=state.christmas2026.secret['clan@g.us'].pairs
assert.equal(Object.keys(pairs).length,3);assert.equal(new Set(Object.values(pairs)).size,3)
for(const [a,b] of Object.entries(pairs))assert.notEqual(a,b)
assert.deepEqual(call('amigo ver',{privateChat:true}).mentions,[pairs[user]])
assert.equal(call('regalos repartir',{privateChat:true}).coins,0)
assert.match(call('amigo regalar').text,/fabrica/)
call('fabricar');assert.match(call('amigo regalar').text,/entregado/);assert.match(call('amigo regalar').text,/Ya entregaste/)
// Boss caps, phases and participation awards are persisted, not re-issued by top.
for(let i=0;i<6;i++)call('atacar',{command:'jefenavidad'})
const damage=state.christmas2026.players[user].damage
call('atacar',{command:'jefenavidad'});assert.equal(state.christmas2026.players[user].damage,damage)
for(let i=0;i<3;i++)call('proteger',{command:'jefenavidad'})
assert.equal(state.christmas2026.players[user].support,3)
call('curar',{command:'jefenavidad'});assert.equal(state.christmas2026.players[user].support,3)
state.christmas2026.bosses[0].hp=0
assert.match(call('jefe').text,/No hay un jefe/)
assert.equal(call('premios').coins,1000);assert.equal(call('premios').coins,0)
state.christmas2026.tree=100
assert.equal(call('premios',{jid:other}).coins,250);assert.equal(call('premios',{jid:other}).coins,0)
now=START+10*86400000
assert.match(call('jefe').text,/Guardián de Hielo/)
call('jefe proteger');assert.equal(state.christmas2026.bosses[1].shield,2)
call('jefe proteger');assert.equal(state.christmas2026.bosses[1].shield,2)
call('jefe proteger',{jid:other});assert.equal(state.christmas2026.bosses[1].shield,1)
const persisted=JSON.parse(JSON.stringify(state));const saved=JSON.stringify(persisted.halloween2026)
assert.equal(runChristmas(persisted,{jid:user,group:'clan@g.us',input:'premios',now}).coins,250)
assert.equal(runChristmas(persisted,{jid:user,group:'clan@g.us',input:'premios',now}).coins,0)
assert.equal(JSON.stringify(persisted.halloween2026),saved)
now=END
assert.equal(call('regalos repartir').coins,0);assert.ok(call('resumen').text.includes('TU INVIERNO'));assert.ok(call('top').text.includes('CLASIFICACIÓN'))
assert.equal(JSON.stringify(state.halloween2026),JSON.parse(originalArchive).halloween2026?JSON.stringify(JSON.parse(originalArchive).halloween2026):'')
const source=fs.readFileSync(new URL('./index.js',import.meta.url),'utf8')
const fn=source.slice(source.indexOf('function currentWorkSeason('),source.indexOf('\nconst WORK_MESSAGE_VARIANTS'))
const c=vm.createContext({Date,Intl,christmasActive:active,CHRISTMAS_WORK_JOBS:['winter'],WORK_JOBS:['normal']})
vm.runInContext(fn,c)
assert.equal(vm.runInContext(`currentWorkSeason(new Date(${START-1})).name`,c),null)
assert.equal(vm.runInContext(`currentWorkSeason(new Date(${START})).name`,c),'Navidad')
assert.equal(vm.runInContext(`currentWorkSeason(new Date(${END})).name`,c),null)
console.log('PASS: exact CDMX date gates; gifts/missions/crafting/letters/secret pairs; private assignment; global daily caps; owner confirmation scope/expiry/replay; boss phases/support/awards; persisted claims; seasonal work blocked until Nov 20.')
