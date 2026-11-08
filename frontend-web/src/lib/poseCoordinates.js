// MediaPipe normalizes x by image width and y by image height. Geometry needs
// equal units on both axes. Express x in image-height units, leaving y intact
// so existing vertical thresholds keep their scale. These points are for
// analysis ONLY: overlays/callbacks must keep the original normalized points.
export function toAnalysisLandmarks(landmarks, width, height) {
  if (!Array.isArray(landmarks) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return []
  const aspect = width / height
  return landmarks.map(point => point ? { ...point, x: point.x * aspect } : point)
}
