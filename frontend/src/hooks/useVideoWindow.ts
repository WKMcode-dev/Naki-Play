import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'

interface Position {
  x: number
  y: number
}

export function useVideoWindow(stageRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [position, setPosition] = useState<Position>()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const drag = useRef<{ pointerId: number; start: Position; origin: Position } | undefined>(undefined)

  const keepOnScreen = useCallback((next: Position) => {
    const stage = stageRef.current
    if (!stage) return next
    const bounds = stage.getBoundingClientRect()
    const rootStyle = getComputedStyle(document.documentElement)
    const inset = (side: string) => Number.parseFloat(rootStyle.getPropertyValue(`--safe-${side}`)) || 0
    const viewport = window.visualViewport
    const left = (viewport?.offsetLeft ?? 0) + inset('left') + 12
    const top = (viewport?.offsetTop ?? 0) + inset('top') + 12
    const right = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - inset('right') - 12
    const bottom = Math.min(
      (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - inset('bottom'),
      document.querySelector('.player-bar')?.getBoundingClientRect().top ?? window.innerHeight,
    ) - 12
    return {
      x: Math.min(Math.max(next.x, left), Math.max(left, right - bounds.width)),
      y: Math.min(Math.max(next.y, top), Math.max(top, bottom - bounds.height)),
    }
  }, [stageRef])

  useEffect(() => {
    function syncFullscreen() {
      setIsFullscreen(Boolean(stageRef.current && document.fullscreenElement === stageRef.current))
      drag.current = undefined
      setIsDragging(false)
    }
    function exitWithEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || !stageRef.current || document.fullscreenElement !== stageRef.current) return
      event.preventDefault()
      void document.exitFullscreen().catch(() => undefined)
    }
    syncFullscreen()
    document.addEventListener('fullscreenchange', syncFullscreen)
    document.addEventListener('keydown', exitWithEscape)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen)
      document.removeEventListener('keydown', exitWithEscape)
    }
  }, [stageRef, enabled])

  useEffect(() => {
    const stage = stageRef.current
    if (!enabled || !stage) return
    function resize() {
      if (document.fullscreenElement === stageRef.current) return
      setPosition((current) => {
        if (!current) return current
        const next = keepOnScreen(current)
        return next.x === current.x && next.y === current.y ? current : next
      })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    window.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('resize', resize)
    document.addEventListener('fullscreenchange', resize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('resize', resize)
      document.removeEventListener('fullscreenchange', resize)
    }
  }, [stageRef, enabled, keepOnScreen])

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    const stage = stageRef.current
    if (!stage || document.fullscreenElement === stage || !event.isPrimary || event.button !== 0) return
    const bounds = stage.getBoundingClientRect()
    drag.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: bounds.left, y: bounds.top },
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    event.preventDefault()
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    setPosition(keepOnScreen({
      x: current.origin.x + event.clientX - current.start.x,
      y: current.origin.y + event.clientY - current.start.y,
    }))
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = undefined
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const stage = stageRef.current
    if (!stage || document.fullscreenElement === stage) return
    const directions: Record<string, Position> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    const bounds = stage.getBoundingClientRect()
    const step = event.shiftKey ? 40 : 16
    setPosition(keepOnScreen({ x: bounds.left + direction.x * step, y: bounds.top + direction.y * step }))
  }

  async function toggleFullscreen() {
    const stage = stageRef.current
    if (!stage) return
    if (document.fullscreenElement === stage) {
      await document.exitFullscreen()
    } else {
      if (!stage.requestFullscreen) throw new Error('A tela cheia não está disponível neste dispositivo.')
      await stage.requestFullscreen()
    }
  }

  return { position, isFullscreen, isDragging, startDrag, moveDrag, endDrag, moveWithKeyboard, toggleFullscreen }
}
