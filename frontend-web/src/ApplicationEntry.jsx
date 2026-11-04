import { Suspense, lazy } from 'react'
const App=lazy(()=>import('./App.jsx'))
const Demo=import.meta.env.DEV?lazy(()=>import('./demo/DemoProgressApp.jsx')):null

export default function ApplicationEntry(){
  const showDemo=import.meta.env.DEV&&typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('demo')==='hito4'
  return <Suspense fallback={<p role="status">Cargando aplicación...</p>}>{showDemo?<Demo/>:<App/>}</Suspense>
}
