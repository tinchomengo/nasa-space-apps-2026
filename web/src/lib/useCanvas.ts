import { useEffect, useRef, useState } from 'react'

/** Canvas sized to its container's width (CSS px) with devicePixelRatio scaling. */
export function useCanvas(height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const c = canvasRef.current
    if (!c || width === 0) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.floor(width * dpr)
    c.height = Math.floor(height * dpr)
    c.style.width = `${width}px`
    c.style.height = `${height}px`
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    draw(ctx, width, height)
  })

  return { wrapRef, canvasRef, width }
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
