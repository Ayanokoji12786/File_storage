'use client'

import { useEffect } from 'react'

/** Registers the offline-support service worker (see public/sw.js). */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return null
}
