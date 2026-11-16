import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ecoRoto} from './eco-roto.mjs'
import {foods, supplies, companionRationEffects, refreshSupplyStock, rewardWithSupply, DAY_MS} from './kingdom-supplies.mjs'

test('reposición garantizada y tiradas únicas de 14 días, incluso al recargar',()=>{
 const [common,,,epic,legend,ultra]=foods
 const never=()=>{throw Error('No debería volver a sortear')}
 assert.equal(refreshSupplyStock(null,common,1000,never).remaining,20)
 assert.equal(refreshSupplyStock(null,epic,1000,never).remaining,11)
 for(const item of [legend,ultra]){
  assert.equal(item.restockDays,14)
  let empty=refreshSupplyStock(null,item,1000,()=>item.restockBps)
  assert.equal(empty.remaining,0)
  empty=JSON.parse(JSON.stringify(empty))
  assert.equal(refreshSupplyStock(empty,item,1000+14*DAY_MS-1,never),empty)
  assert.equal(refreshSupplyStock(empty,item,1000+14*DAY_MS,()=>item.restockBps-1).remaining,item.maxStock)
 }
})

test('curación y escudo consumen un artículo; escudo dura sólo un golpe',()=>{
 const store={},gear=[foods[0].id,foods[3].id]
 const run=()=>store['u:a'].run
 const play=(cmd,now=1000)=>ecoRoto(store,'a',cmd,'?','grupo',{now,gear})
 play('rescate');play('izquierda');play('pisar centro')
 assert.equal(run().hp,78)
 assert.match(play('comer 21'),/88\/100/)
 assert.equal(gear.length,1)
 play('comer 24')
 assert.equal(run().shield,35)
 play('desafiar');play('atacar')
 assert.equal(run().hp,91)
 assert.equal(run().shield,0)
})

test('fallar reanimación consume legendaria; la ambrosía revive y protege siete días',()=>{
 const store={},gear=[foods[4].id,foods[5].id]
 const play=(cmd,now=1000,roll=()=>9999)=>ecoRoto(store,'a',cmd,'?','grupo',{now,roll,gear})
 play('rescate');play('izquierda')
 const run=store['u:a'].run;run.hp=1
 assert.match(play('pisar centro'),/Has caído/)
 assert.match(play('comer 25'),/reanimación falló/)
 assert.equal(run.downed,true)
 assert.match(play('comer 26'),/Te reanimaste.*100\/100/)
 assert.equal(store['u:a'].ultraUntil,1000+7*DAY_MS)
 assert.equal(gear.length,0)
 play('desafiar');play('atacar')
 assert.equal(run.hp,100)
 run.hp=100
 play('atacar',1000+7*DAY_MS)
 assert.equal(run.hp,87)
})

test('los vales se consumen solo para la actividad correcta',()=>{
 const inv={kingdomVouchers:{work:{remaining:1,bonus:35}}}
 assert.equal(rewardWithSupply(inv,'daily',100),100)
 assert.equal(rewardWithSupply(inv,'work',100,true),150)
 assert.equal(rewardWithSupply(inv,'work',100),100)
})

test('las seis mercancías misteriosas heredan ciclos y stock sin exponer efectos',()=>{
 const mystery=supplies.filter(item=>item.category==='misterio')
 assert.equal(mystery.length,6)
 mystery.forEach((item,i)=>{
  assert.deepEqual([item.maxStock,item.restockDays,item.restockBps],[foods[i].maxStock,foods[i].restockDays,foods[i].restockBps])
  assert.doesNotMatch(JSON.stringify(item),/mascota|energy|bond|fatigueShield/i)
  assert.ok(companionRationEffects[item.id].energy>0)
 })
 const store={},gear=mystery.map(item=>item.id)
 ecoRoto(store,'a','rescate','?','grupo',{gear})
 const run=store['u:a'].run
 run.hp=50
 const reply=ecoRoto(store,'a','comer 27','?','grupo',{gear})
 assert.match(reply,/no está disponible/)
 assert.equal(run.hp,50)
 assert.equal(gear.length,6)
})
