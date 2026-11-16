import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ecoRoto } from './eco-roto.mjs'

function game(mode='rescate',gear=[]){
 let store={}
 const play=(s,who='a',chat='grupo',options)=>ecoRoto(store,who,s,'?',chat,options)
 const many=(...steps)=>steps.map(s=>play(s)).at(-1)
 play(mode,'a','grupo',{gear})
 return {play,many,run:()=>store['u:a'].run,user:()=>store['u:a'],reload:()=>{store=JSON.parse(JSON.stringify(store))}}
}

test('rescate, regreso por la ruta real y cobro interno una sola vez',()=>{
 const g=game()
 g.many('3','calcar','avanzar','forzar')
 assert.equal(g.run().water,1)
 assert.match(g.many('cerrarcompuerta','rescatar','volver'),/Santuario Invertido/)
 g.reload()
 assert.match(g.many('volver','salir'),/3 hallazgos.*Encargo completado/)
 g.play('salir')
 assert.equal(g.user().hallazgos,3)
})

test('las runas fallidas hacen daño sin desbloquear el paso',()=>{
 const g=game('investigación')
 g.many('avanzar','calcar','izquierda','pisar ojo','avanzar')
 assert.equal(g.run().room,'runas')
 assert.equal(g.run().hp,78)
 assert.match(g.play('pisar luna'),/camino secreto/)
 assert.match(g.many('volver','volver','salir'),/Encargo completado/)
})

test('combate de Reina y Corazón con reacciones distintas',()=>{
 const g=game('cacería')
 g.many('izquierda','pisar izquierda','avanzar','agacharte','avanzar','esperar','avanzar','marcar','avanzar')
 const turn=g.run().turn
 g.play('escuchar')
 assert.equal(g.run().turn,turn)
 g.many('observar','observar','luz','observar')
 assert.equal(g.run().hp,77)
 assert.equal(g.run().flags.reina,true)
 g.many('avanzar','luz','saltar','cubrirte','luz','sellar')
 assert.equal(g.run().flags.refugio,true)
 assert.equal(g.run().flags.corazón,true)
})

test('Comecofres, Coloso y apertura segura en santuario',()=>{
 const g=game('cacería')
 g.many('avanzar','derecha','cuña','avanzar','guardar','avanzar','cebar','cubrirte','cubrirte')
 assert.equal(g.run().cofres,2)
 g.many('avanzar','forzar','forzar','forzar','volver')
 assert.equal(g.run().flags.coloso,true)
 assert.equal(g.run().room,'comecofres')
 g.many('volver','volver','volver','abrir')
 assert.equal(g.run().cofres,1)
 assert.equal(g.run().botin,14)
})

test('Carcelero, caída por la marea y recuperación en checkpoint',()=>{
 const g=game('cacería')
 g.many('avanzar','calcar','avanzar','forzar','forzar')
 assert.equal(g.run().room,'cisterna')
 g.many('avanzar','avanzar','cerrarcompuerta','avanzar','cubrirte','cubrirte','cubrirte')
 assert.equal(g.run().flags.carcelero,true)
 g.many('volver','volver','izquierda')
 for(let i=0;i<4;i++)g.play('pisar ojo')
 assert.equal(g.run().room,'santuario')
 assert.equal(g.run().hp,65)
 assert.equal(g.run().botin,0)
})

test('pareja voluntaria, mismo grupo, código de un uso y apoyo sin botín duplicado',()=>{
 const g=game()
 const invite=g.play('invitar').match(/[a-f0-9]{8}(?=\*)/)[0]
 assert.match(g.play('unir '+invite,'b','otro'),/inválida/)
 assert.match(g.play('unir '+invite,'b'),/Te uniste/)
 assert.match(g.play('unir '+invite,'c'),/inválida/)
 g.many('izquierda','pisar centro')
 assert.match(g.play('avanzar','b'),/líder elige/)
 assert.equal(g.run().room,'losas')
 assert.match(g.play('apoyar','b'),/recupera/)
 assert.equal(g.run().hp,90)
 assert.match(g.play('apoyar','b'),/Ya apoyaste/)
 g.many('volver','salir')
 assert.match(g.play('','b'),/ELIGE TU ENCARGO/)
 assert.equal(g.user().hallazgos,1)
})

test('enemigo con nombre: enseña su contraataque y paga solo una vez',()=>{
 const g=game()
 assert.match(g.many('izquierda','pisar izquierda','desafiar'),/Varek, el Centinela/)
 g.play('atacar')
 assert.equal(g.run().hp,87)
 assert.match(g.play('flanquear'),/\+3 hallazgos/)
 assert.equal(g.run().botin,4)
 g.play('desafiar')
 assert.equal(g.run().botin,4)
})

test('acertijos: el reloj persiste, las respuestas tardías no cobran y un acierto sí',()=>{
 const g=game()
 g.many('avanzar','izquierda','pisar luna')
 assert.match(g.play('desafiar','a','grupo',{now:1000}),/30 s.*6 hallazgos/)
 assert.match(g.play('responder 12','a','grupo',{now:2000}),/2 intentos/)
 g.reload()
 assert.match(g.play('responder 16','a','grupo',{now:31000}),/Se acabó el tiempo/)
 assert.equal(g.run().botin,1)
 const h=game()
 h.many('avanzar','derecha','rodear')
 h.play('desafiar','a','grupo',{now:1000})
 assert.match(h.play('responder 7','a','grupo',{now:2000}),/\+8 hallazgos/)
 assert.equal(h.run().botin,8)
})

test('Malvek se queda con el dado mayor y gana el empate; el premio cuenta para cacería',()=>{
 const g=game('cacería')
 g.many('avanzar','derecha','rodear','avanzar','guardar')
 assert.match(g.play('desafiar'),/En empate gana él/)
 const throwDice=(...dice)=>g.play('tirar','a','grupo',{roll:()=>dice.shift()})
 assert.match(throwDice(5,1,5),/Perdiste la ronda/)
 assert.equal(g.run().hp,91)
 throwDice(6,1,5)
 assert.match(throwDice(6,3,4),/\+18 hallazgos/)
 assert.match(g.many('volver','volver','volver','salir'),/18 hallazgos.*Encargo completado/)
})

test('Isera gana dos de las tres opciones y el minijuego termina al tercer fallo',()=>{
 const g=game()
 g.many('avanzar','calcar','avanzar','forzar','forzar')
 assert.match(g.play('desafiar'),/Isera, la Oráculo Sumergida/)
 const miss=()=>g.play('runa luna','a','grupo',{roll:()=>1})
 miss();miss()
 assert.match(miss(),/sin recompensa/)
 assert.equal(g.run().hp,50)
 assert.equal(g.run().encounter,null)
})

test('el objeto extraño no revela su función y sólo se guarda al extraerlo',()=>{
 const g=game()
 const found=g.many('derecha','sondear')
 assert.match(found,/Miga de Lucerna/)
 assert.doesNotMatch(found,/mascota/i)
 assert.match(g.play('mochila'),/Miga de Lucerna ×1/)
 assert.doesNotMatch(g.play('perfil'),/Miga de Lucerna/)
 g.reload()
 assert.match(g.many('volver','salir'),/Guardaste: Miga de Lucerna ×1/)
 assert.match(g.play('perfil'),/Miga de Lucerna ×1/)
})

test('la derrota en una expedición no acredita los objetos pendientes',()=>{
 const g=game()
 g.many('derecha','sondear','izquierda','izquierda','pisar luna','volver','volver','derecha','izquierda','izquierda')
 g.run().hp=1
 g.run().room='reflejos'
 assert.match(g.play('pisar'),/Perdiste el botín/)
 assert.doesNotMatch(g.play('mochila'),/Miga de Lucerna/)
 assert.doesNotMatch(g.play('perfil'),/Miga de Lucerna/)
})

test('brújula, tinta y crónica son contextuales y requieren propiedad',()=>{
 const plain=game()
 assert.doesNotMatch(plain.play(''),/marcar cruce|nombrar equipo/)
 const g=game('rescate',['brujula_segunda_huella','tinta_heraldo','sello_cronista'])
 assert.match(g.play('nombrar equipo Guardia de Ámbar'),/Guardia de Ámbar/)
 g.many('marcar cruce','avanzar','izquierda')
 assert.match(g.play('buscar marca'),/retrocede 2 tramo/)
 assert.match(g.many('volver','volver','salir'),/ecoroto cronica/)
 assert.match(g.play('cronica'),/Guardia de Ámbar.*\n.*\n.*Santuario Invertido/)
})

test('el pacto guarda la mitad una vez y sólo la entrega al completar el encargo',()=>{
 const g=game('rescate',['pacto_ultima_antorcha'])
 g.many('avanzar','calcar','avanzar','cerrarcompuerta','rescatar','volver')
 assert.match(g.play('enviar al refugio'),/Enviaste 2 hallazgos/)
 assert.equal(g.run().botin,1)
 assert.doesNotMatch(g.play(''),/enviar al refugio/)
 assert.match(g.many('volver','salir'),/3 hallazgos.*Encargo completado/)
 const h=game('rescate',['pacto_ultima_antorcha'])
 h.many('avanzar','derecha','rodear','avanzar','cebar','volver','volver','enviar al refugio')
 assert.equal(h.run().sentLoot,2)
 assert.match(h.many('volver','salir'),/1 hallazgos.*Encargo pendiente/)
})

test('la lente y el salvoconducto se ofrecen sólo donde corresponden y se usan una vez',()=>{
 const g=game('rescate',['lente_del_reverso','salvoconducto_de_hilo'])
 g.play('izquierda')
 assert.match(g.play('examinar trampa'),/22 de vida/)
 assert.doesNotMatch(g.play(''),/ecoroto examinar trampa/)
 g.many('izquierda','paso de servicio')
 assert.equal(g.run().room,'cisterna')
 assert.equal(g.run().hp,100)
 assert.match(g.play(''),/Isera/)
 assert.doesNotMatch(g.play('avanzar'),/ecoroto paso de servicio/)
})

test('el estuche protege exactamente un hallazgo y sólo se acredita al salir',()=>{
 const g=game('rescate',['estuche_de_nacar'])
 g.many('derecha','sondear','izquierda')
 assert.match(g.play('proteger miga de lucerna'),/El estuche protege/)
 g.many('izquierda','pisar luna','volver','izquierda')
 for(let i=0;i<5;i++)g.play('pisar ojo')
 // La sala de runas ya se despejó: provocar una caída posterior con una trampa sin resolver.
 g.run().room='reflejos';g.run().hp=1
 assert.match(g.play('pisar'),/Perdiste el botín sin proteger/)
 assert.match(g.play('mochila'),/Miga de Lucerna ×1/)
 assert.doesNotMatch(g.play('mochila'),/Baya de Sieteluz/)
 assert.doesNotMatch(g.play('perfil'),/Miga de Lucerna/)
 assert.match(g.many('volver','salir'),/Guardaste: Miga de Lucerna ×1/)
})
