import assert from 'node:assert/strict'
import fs from 'node:fs'

// Exercise the real hook with a minimal hook host and mocked media devices.
// No camera, browser permissions, network, or React dependency is added.
class HookHost {
  slots=[]; cursor=0; effects=[]
  hooks={
    useRef: value => {const n=this.cursor++;return this.slots[n] ??= {current:value}},
    useState: value => {const n=this.cursor++;if(!this.slots[n])this.slots[n]={value:typeof value==='function'?value():value};return [this.slots[n].value,next=>{this.slots[n].value=typeof next==='function'?next(this.slots[n].value):next}]},
    useCallback:(fn,deps)=>{const n=this.cursor++;const old=this.slots[n];if(!old||deps.some((d,i)=>d!==old.deps[i]))this.slots[n]={fn,deps};return this.slots[n].fn},
    useEffect:(fn,deps)=>{const n=this.cursor++;const old=this.slots[n];if(!old||deps.some((d,i)=>d!==old.deps[i]))this.effects.push(()=>{old?.cleanup?.();this.slots[n]={deps,cleanup:fn()}})},
  }
  // oxlint-disable-next-line react-hooks/rules-of-hooks -- This test host supplies mocked hooks without mounting React.
  render(options){this.cursor=0;globalThis.cameraHookHost=this.hooks;this.result=useCamera(options);return this.result}
  commit(){const queue=this.effects.splice(0);queue.forEach(fn=>fn())}
  unmount(){this.slots.forEach(slot=>slot?.cleanup?.())}
}
let source=fs.readFileSync(new URL('../src/hooks/useCamera.js',import.meta.url),'utf8')
source=source.replace(/import \{[^}]+\} from 'react'/,'const {useCallback,useEffect,useRef,useState}=globalThis.cameraHookHost')
const bootstrap=new HookHost();globalThis.cameraHookHost=bootstrap.hooks
// Hooks are bound through wrappers so each test host remains isolated.
source=source.replace('=globalThis.cameraHookHost','=Object.fromEntries(["useCallback","useEffect","useRef","useState"].map(name=>[name,(...args)=>globalThis.cameraHookHost[name](...args)]))')
const {default:useCamera}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
globalThis.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}}
globalThis.window={isSecureContext:true}
let stopped=0,played=0,requests=[]
const stream=()=>({getTracks:()=>[{stop(){stopped++}}]})
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async constraints=>{requests.push(constraints);return stream()}}}})
const video=()=>({srcObject:null,play:async()=>{played++}})
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}

const host=new HookHost();host.render({active:false});host.commit()
await host.result.start()
let result=host.render({active:false});const lateVideo=video();result.videoRef.current=lateVideo;host.commit();await settle()
assert.ok(lateVideo.srcObject,'late-mounted video must receive the stream')
assert.equal(result.status,'ready');assert.ok(played>0)
host.result.stop();assert.equal(lateVideo.srcObject,null);assert.ok(stopped>0)
host.unmount()
console.log('ok: opening camera has no undefined request id; late-mounted preview attaches and plays; stopping frees the stream')

let resolveRequest
navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{resolveRequest=resolve})
const pending=new HookHost();pending.render({active:false});pending.commit();const opening=pending.result.start();pending.result.stop();const before=stopped;resolveRequest(stream());await opening
assert.equal(stopped,before+1,'cancelled request must release its late stream');assert.equal(pending.result.streamRef.current,null)
pending.unmount()
console.log('ok: a camera request resolved after cancellation cannot reopen the camera')

navigator.mediaDevices.getUserMedia=async constraints=>{requests.push(constraints);return stream()}
const switching=new HookHost();switching.render({active:true,facingMode:'user'});switching.commit();await settle();switching.render({active:true,facingMode:'environment'});switching.commit();await settle()
assert.equal(requests.at(-1).video.facingMode.ideal,'environment')
switching.render({active:false,facingMode:'environment'});switching.commit();assert.equal(switching.result.streamRef.current,null)
switching.unmount()
console.log('ok: changing facing mode releases the old stream; deactivating the view closes the camera')

navigator.mediaDevices.getUserMedia=async()=>{throw Object.assign(new Error('Denied'),{name:'NotAllowedError'})}
const denied=new HookHost();denied.render({active:false});denied.commit();await denied.result.start();result=denied.render({active:false});denied.commit();assert.equal(result.status,'error');assert.equal(result.isPermissionDenied,true);denied.unmount()
console.log('ok: rejected camera permission exposes a usable error instead of leaving a black preview')
navigator.mediaDevices.getUserMedia=async()=>stream()
let finishPlay
const playing=new HookHost();playing.render({active:false});playing.commit();playing.result.videoRef.current={srcObject:null,play:()=>new Promise(resolve=>{finishPlay=resolve})}
const playback=playing.result.start();await settle();playing.result.stop();finishPlay();await playback
result=playing.render({active:false});playing.commit();assert.equal(result.status,'idle');assert.equal(result.streamRef.current,null);playing.unmount()
console.log('ok: closing during video playback cannot restore a stale ready state')
