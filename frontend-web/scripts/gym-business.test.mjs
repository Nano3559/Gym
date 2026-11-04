import assert from 'node:assert/strict'
import { test, beforeEach, afterEach } from 'node:test'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { isAdminUser } from '../src/lib/adminAccess.js'
import { isReceptionUser } from '../src/lib/receptionAccess.js'
import { daysUntil, getMembershipStatus } from '../src/lib/membershipStatus.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let calls, reply, rpcReply, authReply, roots
const user = { id: 'test-user', email: 'test@example.invalid' }
const planId = '10000000-0000-4000-8000-000000000001'
function double() {
  return {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async args => { calls.push({ auth: 'signIn', args }); return authReply },
      signUp: async args => { calls.push({ auth: 'signUp', args }); return authReply },
      signOut: async () => { calls.push({ auth: 'signOut' }); return {} },
    },
    from(table) {
      const call = { table, methods: [] }; calls.push(call)
      const chain = new Proxy({}, { get(_, method) {
        if (method === 'then') return (resolve, reject) => Promise.resolve(reply(call)).then(resolve, reject)
        return (...args) => { call.methods.push([method, ...args]); return chain }
      } })
      return chain
    },
    rpc: async (name, args) => { calls.push({ rpc: name, args }); return rpcReply },
    channel: name => {
      const channel = { on(event, filter, callback) { calls.push({ channel: name, event, filter, callback }); return channel }, subscribe() { return channel } }
      return channel
    },
    removeChannel: channel => calls.push({ removed: channel }),
  }
}
beforeEach(() => {
  calls = []; roots = []
  reply = () => ({ data: [], error: null })
  rpcReply = { data: { id: 'created' }, error: null }
  authReply = { data: { user, session: { user } }, error: null }
  globalThis.__gymSupabaseDouble = double()
})
afterEach(async () => { for (const root of roots) await act(async () => root.unmount()) })
async function mount(useHook) {
  let current
  function Probe() { const value = useHook(); React.useLayoutEffect(() => { current = value }); return null }
  await act(async () => { roots.push(create(React.createElement(Probe))) })
  return { get current() { return current }, async invoke(fn) { let result; await act(async () => { result = await fn(current) }); return result } }
}
async function auth() {
  const { AuthProvider, useAuth } = await import('../src/context/AuthContext.jsx')
  let current
  function Probe() { const value = useAuth(); React.useLayoutEffect(() => { current = value }); return null }
  await act(async () => { roots.push(create(React.createElement(AuthProvider, null, React.createElement(Probe)))) })
  return current
}
const { default: useBookings } = await import('../src/hooks/useBookings.js')
const { default: useMembership } = await import('../src/hooks/useMembership.js')
const { default: useAdminClients } = await import('../src/hooks/useAdminClients.js')
const payment = await import('../src/services/paymentService.js')

for (const [role, admin, reception] of [['admin',true,false],['reception',false,true],['trainer',false,true],['member',false,false],['unknown',false,false]]) {
  test(`roles: ${role}, acceso administrativo y recepción`, () => {
    const account = { email: 'someone@example.invalid', app_metadata: { gym_role: role } }
    assert.equal(isAdminUser(account), admin); assert.equal(isReceptionUser(account), reception)
  })
}
test('roles: visitante y metadatos de usuario no conceden privilegios', () => {
  for (const account of [null, {}, { user_metadata: { gym_role: 'admin', role: 'admin' } }]) {
    assert.equal(isAdminUser(account),false); assert.equal(isReceptionUser(account),false)
  }
})
test('roles: un rol explícito de miembro prevalece sobre el correo de staff', () => {
  assert.equal(isAdminUser({email:'admin@ironforge.com',app_metadata:{gym_role:'member'}}),false)
  assert.equal(isReceptionUser({email:'recepcion@ironforge.com',app_metadata:{gym_role:'member'}}),false)
})
test('autenticación: login correcto llama al proveedor, sin acceso ficticio', async () => {
  const ctx = await auth()
  assert.deepEqual(await ctx.signIn('test@example.invalid','fake-password'),{ok:true})
  assert.deepEqual(calls.find(c=>c.auth==='signIn').args,{email:'test@example.invalid',password:'fake-password'})
})
for (const [message, expected] of [['Invalid login credentials',/incorrectos/],['Email not confirmed',/confirmar/],['Service unavailable',/Service unavailable/]]) {
  test(`autenticación: ${message}`, async () => {
    const ctx = await auth(); authReply={error:{message}}
    const result=await ctx.signIn('test@example.invalid','wrong'); assert.equal(result.ok,false);assert.match(result.message,expected)
  })
}
test('autenticación: la antigua cuenta demo no evita la validación', async () => {
  const ctx=await auth();authReply={error:{message:'Invalid login credentials'}}
  assert.equal((await ctx.signIn('recepcion@ironforge.com','fake-password')).ok,false)
  assert.ok(calls.some(c=>c.auth==='signIn'))
})
const signup={nombre:'Prueba',apellido:'Ficticia',correo:'test@example.invalid',password:'fake-password',telefono:'000000',ci:'TEST-CI'}
test('registro: conserva datos del perfil y propietario', async()=>{
  const ctx=await auth();assert.deepEqual(await ctx.signUp(signup),{ok:true,needsConfirmation:false})
  const row=calls.find(c=>c.table==='profiles').methods.find(m=>m[0]==='upsert')[1]
  assert.equal(row.id,user.id);assert.equal(row.nombre,'Prueba');assert.equal(row.email,signup.correo)
})
test('registro: confirmación de correo sin usuario no escribe perfil',async()=>{
  const ctx=await auth();authReply={data:{user:null,session:null},error:null}
  assert.deepEqual(await ctx.signUp(signup),{ok:true,needsConfirmation:true})
  assert.ok(!calls.some(c=>c.table==='profiles'))
})
for(const [message,expected] of [['User already registered',/registrado/],['Password too short',/6 caracteres/]]){
 test(`registro: ${message}`,async()=>{const ctx=await auth();authReply={error:{message}};const r=await ctx.signUp(signup);assert.equal(r.ok,false);assert.match(r.message,expected)})
}
test('registro: CI duplicado se informa',async()=>{
 const ctx=await auth();reply=()=>({error:{code:'23505'}});assert.match((await ctx.signUp(signup)).message,/CI/)
})
test('autenticación: cierre llama signOut',async()=>{await (await auth()).signOut();assert.ok(calls.some(c=>c.auth==='signOut'))})
test('reservas: sin sesión no reserva ni cancela',async()=>{
 const h=await mount(()=>useBookings(null));assert.equal((await h.invoke(v=>v.createBooking('class'))).ok,false);assert.equal((await h.invoke(v=>v.cancelBooking('booking'))).ok,false);assert.equal(calls.length,0)
})
test('reservas: usa RPC de cupos y devuelve la reserva',async()=>{
 const h=await mount(()=>useBookings(user.id));const r=await h.invoke(v=>v.createBooking('class-a'))
 assert.equal(r.ok,true);assert.deepEqual(calls.find(c=>c.rpc),{rpc:'reservar_clase',args:{p_class_id:'class-a'}})
 assert.ok(calls.filter(c=>c.table==='bookings').every(c=>c.methods.some(m=>m[0]==='eq'&&m[1]==='user_id'&&m[2]===user.id)))
})
for(const message of ['No hay cupos disponibles','Ya tienes una reserva','Clase no disponible']){
 test(`reservas: propaga rechazo RPC «${message}»`,async()=>{
  const h=await mount(()=>useBookings(user.id));rpcReply={error:{message}};assert.deepEqual(await h.invoke(v=>v.createBooking('class-a')),{ok:false,message})
 })
}
test('cancelación: filtra propietario y estado confirmado',async()=>{
 const h=await mount(()=>useBookings(user.id));assert.equal((await h.invoke(v=>v.cancelBooking('booking-a'))).ok,true)
 const q=calls.find(c=>c.table==='bookings'&&c.methods.some(m=>m[0]==='update'))
 for(const pair of [['id','booking-a'],['user_id',user.id],['estado','confirmada']])assert.ok(q.methods.some(m=>m[0]==='eq'&&m[1]===pair[0]&&m[2]===pair[1]))
 assert.equal(q.methods.find(m=>m[0]==='update')[1].estado,'cancelada')
})
test('cancelación: acceso rechazado no se informa como éxito',async()=>{
 const h=await mount(()=>useBookings(user.id));reply=c=>({data:[],error:c.methods.some(m=>m[0]==='update')?{message:'Acceso denegado'}:null})
 assert.deepEqual(await h.invoke(v=>v.cancelBooking('foreign')),{ok:false,message:'Acceso denegado'})
})
test('membresías: fechas inválidas, vencimiento y frontera de cinco días',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-01-01T12:00Z'))
 assert.equal(daysUntil('invalid'),null);assert.equal(daysUntil(null),null)
 for(const [date,status] of [['2026-01-01T12:00Z','vencida'],['2025-12-31','vencida'],['2026-01-06T12:00Z','por_vencer'],['2026-01-07T12:00Z','activa']])assert.equal(getMembershipStatus(date).key,status)
})
test('membresías: carga solo membresía activa del propietario',async()=>{
 reply=c=>({data:c.table==='memberships'?{id:'membership-a'}:[],error:null})
 const h=await mount(()=>useMembership(user.id));assert.equal(h.current.membership.id,'membership-a')
 const q=calls.find(c=>c.table==='memberships');assert.ok(q.methods.some(m=>m[0]==='eq'&&m[1]==='estado'&&m[2]==='activa'));assert.ok(q.methods.some(m=>m[0]==='eq'&&m[1]==='user_id'&&m[2]===user.id))
})
test('membresías: sin sesión o con error devuelve null',async()=>{
 const guest=await mount(()=>useMembership(null));assert.equal(guest.current.membership,null);assert.equal(calls.length,0)
 reply=()=>({data:null,error:{message:'denied'}});const h=await mount(()=>useMembership(user.id));assert.equal(h.current.membership,null);assert.equal(h.current.loading,false)
})
const pay={transactionId:'txn-test',userId:user.id,planId,monto:100,metodoPago:'qr'}
test('pagos: registra pendiente sin confirmar ni crear membresía',async()=>{
 assert.deepEqual(await payment.crearRegistroPagoPendiente(pay),{ok:true})
 const row=calls.find(c=>c.table==='payments').methods.find(m=>m[0]==='insert')[1]
 assert.equal(row.estado_pago,'pendiente');assert.equal(row.user_id,user.id);assert.equal(row.plan_id,planId);assert.ok(!calls.some(c=>c.rpc))
})
test('pagos: rechazo al registrar pendiente se propaga',async()=>{
 reply=()=>({error:{message:'denied'}});assert.deepEqual(await payment.crearRegistroPagoPendiente(pay),{ok:false,message:'denied'})
})
test('pagos: confirmación delega renovación atómica a RPC',async()=>{
 const r=await payment.confirmarPagoExitoso(pay);assert.equal(r.ok,true);assert.deepEqual(r.membership,{id:'created'})
 assert.deepEqual(calls.find(c=>c.rpc).args,{p_transaction_id:pay.transactionId,p_user_id:user.id,p_plan_id:planId,p_monto:100,p_metodo_pago:'qr'})
})
test('pagos: plan desconocido sin respaldo no confirma',async()=>{
 reply=()=>({data:null,error:null});assert.equal((await payment.confirmarPagoExitoso({...pay,planId:'missing'})).ok,false);assert.ok(!calls.some(c=>c.rpc))
})
test('pagos: plan por código se traduce a UUID',async()=>{
 reply=()=>({data:{id:planId},error:null});assert.equal((await payment.confirmarPagoExitoso({...pay,planId:'basico'})).ok,true);assert.equal(calls.find(c=>c.rpc).args.p_plan_id,planId)
})
test('pagos: rechazo del servidor no renueva localmente',async()=>{
 rpcReply={error:{message:'Pago no autorizado'}};assert.deepEqual(await payment.confirmarPagoExitoso(pay),{ok:false,message:'Pago no autorizado'})
})
test('pagos: QR conserva monto, moneda y transacción; IDs distintos',()=>{
 const id=payment.generarTransactionId();assert.notEqual(id,payment.generarTransactionId());assert.match(id,/^txn-/)
 const payload=JSON.parse(payment.generarPayloadQR(user,{id:planId,nombre:'Prueba',precio:'100'},id));assert.equal(payload.monto,100);assert.equal(payload.moneda,'BOB');assert.equal(payload.user_id,user.id)
})
test('pagos: suscripción filtra transacción y permite liberar canal',()=>{
 let observed;const stop=payment.escucharEstadoPago('txn-test',row=>{observed=row});const q=calls.find(c=>c.channel)
 assert.equal(q.filter.filter,'transaction_id=eq.txn-test');q.callback({new:{estado_pago:'exitoso'}});assert.equal(observed.estado_pago,'exitoso');stop();assert.ok(calls.some(c=>c.removed))
})
const client={id:'test-user',nombre:'Prueba',apellido:'Ficticia',planNombre:'Plan de prueba'}
for(const estado of ['permitido','denegado']){
 test(`asistencia: registra ${estado} y motivo sin datos reales`,async()=>{
  const h=await mount(()=>useAdminClients());const record=await h.invoke(v=>v.registerAttendance(client,estado,'Membresía vencida'))
  assert.equal(record.estado,estado);const row=calls.find(c=>c.table==='gym_attendance').methods.find(m=>m[0]==='insert')[1]
  assert.equal(row.user_id,user.id);assert.equal(row.motivo,estado==='denegado'?'Membresía vencida':null)
 })
}
test('asistencia: error de permiso no añade ingreso local',async()=>{
 const h=await mount(()=>useAdminClients());const before=h.current.attendance.length;reply=()=>({error:new Error('Acceso denegado')})
 await assert.rejects(h.invoke(v=>v.registerAttendance(client)),/Acceso denegado/);assert.equal(h.current.attendance.length,before)
})
test('membresías: congelar sin ID falla antes de contactar servicio',async()=>{
 const h=await mount(()=>useAdminClients());await assert.rejects(h.invoke(v=>v.freezeMembership(null,7)),/membresía/);assert.ok(!calls.some(c=>c.rpc))
})
test('membresías: congelación usa RPC y propaga rechazo',async()=>{
 const h=await mount(()=>useAdminClients());globalThis.__gymSupabaseDouble.auth.getSession=async()=>({data:{session:{user}}})
 await h.invoke(v=>v.freezeMembership('membership-a',7));assert.deepEqual(calls.find(c=>c.rpc).args,{p_membership_id:'membership-a',p_days:7})
 rpcReply={error:new Error('No autorizado')};await assert.rejects(h.invoke(v=>v.freezeMembership('membership-a',7)),/No autorizado/)
})
