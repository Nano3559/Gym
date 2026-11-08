import { angleAt, distance, midPoint } from './geometry.js'
export { angleAt, distance, midPoint }
export const bodyScale = p => Math.max(distance(midPoint(p[11],p[12]),midPoint(p[23],p[24])), 0.05)
export const spread = (p,a,b) => distance(p[a],p[b]) / bodyScale(p)
export const tilt = (a,b) => Math.atan2(Math.abs(a.x-b.x), Math.abs(a.y-b.y)) * 180 / Math.PI
export const horizontal = (a,b) => Math.abs(a.y-b.y) < Math.abs(a.x-b.x) * 0.5
export const sideIndex = (index, analyzer) => (analyzer.config.side ?? analyzer.activeSide) === 'right' ? (index % 2 ? index + 1 : index - 1) : index
export const joint = (p,a,b,c,analyzer) => angleAt(p[sideIndex(a,analyzer)],p[sideIndex(b,analyzer)],p[sideIndex(c,analyzer)])
export const bilateral = (p, fn) => Math.max(fn(0),fn(1))
