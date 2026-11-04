// Only research parity; no application import or deployment path.
import { readFile } from 'node:fs/promises'
import { predictResearch } from './predict-research.mjs'
const [modelPath, rowsPath] = process.argv.slice(2)
const model=JSON.parse(await readFile(modelPath,'utf8')),rows=JSON.parse(await readFile(rowsPath,'utf8'))
if(model.version!=='dietfits-comparison-v2'||model.training_protocol!=='dietfits-comparison-v2'||model.independent_validation!==false)throw new Error('Artefacto v2 incompatible.')
process.stdout.write(JSON.stringify(predictResearch({...model,version:'dietfits-three-months-research-v1'},rows)))
