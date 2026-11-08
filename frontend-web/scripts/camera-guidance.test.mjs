import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { create, act } from 'react-test-renderer'
import { createServer } from 'vite'
import { CAMERA_GUIDES, CAMERA_VIEW_LABELS, cameraDescription } from '../src/data/cameraGuidance.js'
import { EXERCISE_REGISTRY } from '../src/lib/exerciseRegistry.js'
import { AVAILABLE_EXERCISES } from '../src/data/exercises.js'

const expected={pushup_wide:'oblicua',pushup_diamond:'oblicua',curl_biceps:'lateral',curl_hammer:'lateral',curl_alternate:'oblicua',shoulder_press:'frontal',arnold_press:'frontal',upright_row:'frontal',lat_pulldown:'frontal',pullup:'frontal',chinup:'oblicua',face_pull:'oblicua',dumbbell_fly:'frontal',punch_cross:'lateral'}
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
after(()=>server.close())
const {default:Guidance}=await server.ssrLoadModule('/src/components/CameraGuidance.jsx')

test('las indicaciones cubren exactamente los 14 ejercicios revisados',()=>{
  assert.deepEqual(Object.keys(CAMERA_GUIDES).sort(),Object.keys(expected).sort())
  assert.equal(EXERCISE_REGISTRY.length,131)
})

for(const [id,view] of Object.entries(expected)) {
  test(`posición y encuadre coherentes: ${id}`,()=>{
    const exercise=EXERCISE_REGISTRY.find(e=>e.id===id),guide=CAMERA_GUIDES[id]
    assert.equal(exercise.vistaCamara,view)
    assert.equal(guide.view,view)
    const description=cameraDescription(exercise)
    assert.equal(AVAILABLE_EXERCISES.find(e=>e.id===id).description,description)
    for(const field of ['position','framing','avoid'])assert.ok(description.includes(guide[field]))
    assert.ok(!description.includes('Colócate de cuerpo entero.'),'Sin instrucción genérica que contradiga el encuadre específico')
    const html=renderToStaticMarkup(React.createElement(Guidance,{exercise}))
    assert.ok(html.includes('Posición y encuadre de cámara'))
    assert.ok(html.includes(CAMERA_VIEW_LABELS[view]))
    for(const field of ['position','framing','avoid'])assert.ok(html.includes(guide[field]))
  })
}

test('los casos de perspectiva indican cómo evitar ocultar la medición',()=>{
  assert.match(CAMERA_GUIDES.pushup_wide.position,/baja.*costado/)
  assert.match(CAMERA_GUIDES.pushup_wide.framing,/caderas/)
  assert.match(CAMERA_GUIDES.pushup_diamond.framing,/manos juntas/)
  assert.match(CAMERA_GUIDES.curl_alternate.framing,/ambos hombros, codos y muñecas/)
  assert.match(CAMERA_GUIDES.face_pull.framing,/rostro.*caderas/)
  assert.match(CAMERA_GUIDES.dumbbell_fly.position,/pies/)
  assert.match(CAMERA_GUIDES.dumbbell_fly.framing,/ambos hombros y codos/)
  assert.match(CAMERA_GUIDES.punch_cross.avoid,/Evita dirigir el puño hacia la cámara/)
})

test('los ejercicios no revisados conservan el texto alternativo y no reciben una guía ajena',()=>{
  for(const exercise of EXERCISE_REGISTRY.filter(e=>!expected[e.id])) {
    const fallback=`Cámara ${exercise.vistaCamara}. Colócate de cuerpo entero.`
    assert.equal(cameraDescription(exercise,fallback),fallback)
    assert.equal(renderToStaticMarkup(React.createElement(Guidance,{exercise})), '')
    assert.ok(renderToStaticMarkup(React.createElement(Guidance,{exercise,fallback})).includes(fallback))
  }
  assert.equal(renderToStaticMarkup(React.createElement(Guidance,{})), '')
})

// Render the actual screens without a browser. No capture/model is started:
// there is no mediaDevices implementation, and the modal camera stays closed.
async function withDocument(fn) {
  const savedWindow=Object.getOwnPropertyDescriptor(globalThis,'window')
  const savedDocument=Object.getOwnPropertyDescriptor(globalThis,'document')
  const savedAct=globalThis.IS_REACT_ACT_ENVIRONMENT
  Object.defineProperty(globalThis,'window',{configurable:true,value:{}})
  Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false,visibilityState:'visible',body:{style:{}},addEventListener(){},removeEventListener(){}}})
  globalThis.IS_REACT_ACT_ENVIRONMENT=true
  try { await fn() }
  finally {
    if(savedWindow)Object.defineProperty(globalThis,'window',savedWindow);else delete globalThis.window
    if(savedDocument)Object.defineProperty(globalThis,'document',savedDocument);else delete globalThis.document
    globalThis.IS_REACT_ACT_ENVIRONMENT=savedAct
  }
}
function assertPanel(root,id) {
  const panel=root.findByProps({'aria-label':'Posición y encuadre de cámara'})
  const text=panel.findAllByType('p').map(node=>node.props.children)
  for(const field of ['position','framing','avoid'])assert.ok(text.includes(CAMERA_GUIDES[id][field]),`${id}: ${field}`)
}

test('cámara individual: seleccionar cada uno de los 14 actualiza la guía real',async()=>{
  const {default:Coach}=await server.ssrLoadModule('/src/components/SquatCoachModal.jsx')
  const {ExercisePicker}=await server.ssrLoadModule('/src/components/ExercisePicker.jsx')
  await withDocument(async()=>{
    let root
    try {
      await act(async()=>{root=create(React.createElement(Coach,{open:true,onClose(){}}))})
      for(const id of Object.keys(expected)) {
        await act(async()=>root.root.findByType(ExercisePicker).props.onSelect(EXERCISE_REGISTRY.find(e=>e.id===id)))
        assertPanel(root.root,id)
      }
    } finally {if(root)await act(async()=>root.unmount())}
  })
})

test('rutinas: la guía real cambia con el ejercicio y coincide con la cámara individual',async()=>{
  const {default:Runner}=await server.ssrLoadModule('/src/components/RoutineRunner.jsx')
  const {RoutineProvider,useRoutine}=await server.ssrLoadModule('/src/context/RoutineContext.jsx')
  await withDocument(async()=>{
    let root,context
    function Probe(){const value=useRoutine();React.useLayoutEffect(()=>{context=value});return null}
    try {
      await act(async()=>{root=create(React.createElement(RoutineProvider,null,React.createElement(Probe),React.createElement(Runner,{onClose(){}})))})
      for(const id of Object.keys(expected)) {
        await act(async()=>context.startRoutine([{exerciseId:id,sets:1,targetReps:10,targetDuration:0,restDuration:30}],{routineTitle:'Prueba ficticia'}))
        assertPanel(root.root,id)
      }
    } finally {if(root)await act(async()=>root.unmount())}
  })
})
