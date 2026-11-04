import { useEffect, useRef, useState, useCallback } from 'react'
import { useRoutine } from '../context/RoutineContext.jsx'
import { getExerciseById } from '../lib/exerciseRegistry.js'

export function useVoiceFeedback(poseState = { repCount: 0 }) {
  const {
    status,
    routine,
    currentIndex,
    targetReps,
    isPaused,
  } = useRoutine()

  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const lastAnnouncedRef = useRef(null)
  const lastCountdownRef = useRef(null)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const speak = useCallback((text) => {
    if (!voiceEnabled || !supported) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'es-ES'
      utterance.rate = 1.1
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
    } catch {
      // Voz no disponible
    }
  }, [voiceEnabled, supported])

  useEffect(() => {
    if (!voiceEnabled || isPaused) return

    if (status === 'PREPARING' && currentIndex < routine.length) {
      const exercise = getExerciseById(routine[currentIndex]?.exerciseId)
      const text = `Siguiente ejercicio: ${exercise?.nombre ?? 'Ejercicio'}`
      if (lastAnnouncedRef.current !== text) {
        lastAnnouncedRef.current = text
        speak(text)
      }
    }

    if (status === 'RESTING') {
      const text = 'Empieza el descanso'
      if (lastAnnouncedRef.current !== text) {
        lastAnnouncedRef.current = text
        speak(text)
      }
    }
  }, [status, currentIndex, routine, voiceEnabled, isPaused, speak])

  useEffect(() => {
    if (status !== 'EXERCISING' || isPaused || !voiceEnabled) return

    const count = targetReps - poseState.repCount
    if (count > 0 && count <= 3 && lastCountdownRef.current !== count) {
      lastCountdownRef.current = count
      speak(`${count}`)
    }
  }, [status, poseState.repCount, targetReps, isPaused, voiceEnabled, speak])

  useEffect(() => {
    if (status !== 'EXERCISING') {
      lastCountdownRef.current = null
    }
  }, [status])

  useEffect(() => {
    if (isPaused && supported) window.speechSynthesis.cancel()
    return () => { if (supported) window.speechSynthesis.cancel() }
  }, [isPaused, supported])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      if (prev && supported) {
        window.speechSynthesis.cancel()
      }
      return !prev
    })
  }, [supported])

  return {
    voiceEnabled,
    toggleVoice,
    supported,
  }
}
