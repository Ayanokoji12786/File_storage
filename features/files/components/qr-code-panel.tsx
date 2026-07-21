'use client'

import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function QrCodePanel({ value, fileName }: { value: string; fileName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('qrcode').then((QRCode) => {
      if (cancelled || !canvasRef.current) return
      setReady(false)
      QRCode.toCanvas(canvasRef.current, value, { width: 200, margin: 1 }, () => {
        if (!cancelled) setReady(true)
      })
    })
    return () => {
      cancelled = true
    }
  }, [value])

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    const anchor = document.createElement('a')
    anchor.href = canvas.toDataURL('image/png')
    anchor.download = `${fileName.replace(/\.[^.]+$/, '')}-qr.png`
    anchor.click()
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border p-4">
      <canvas ref={canvasRef} className="rounded-lg" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={download}
        disabled={!ready}
        className="gap-2"
      >
        <Download className="size-4" />
        Download QR code
      </Button>
    </div>
  )
}
