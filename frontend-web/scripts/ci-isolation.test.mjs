import assert from 'node:assert/strict'
import {test} from 'node:test'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
test('CI: bloquea fetch real y borra configuración externa',()=>{
 assert.throws(()=>fetch('https://example.invalid'),/CI_OFFLINE/)
 for(const name of ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY'])assert.equal(process.env[name],'')
})
test('CI: bloquea HTTP, HTTPS y TCP incluso a servicios locales',()=>{
 for(const fn of [()=>http.get('http://127.0.0.1:54321'),()=>https.request('https://example.invalid'),()=>net.connect({host:'127.0.0.1',port:54321}),()=>net.createConnection(443,'example.invalid')])assert.throws(fn,/CI_OFFLINE/)
})
