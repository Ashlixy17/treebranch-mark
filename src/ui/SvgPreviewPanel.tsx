import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const SCALE_STEP = 0.25

interface ViewState {
  scale: number
  x: number
  y: number
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

interface SvgPreviewPanelProps {
  svg: string | null
  title: string
  emptyTitle: string
  emptyDescription: string
  zoomControlsLabel: string
  zoomOutLabel: string
  zoomInLabel: string
  resetZoomLabel: string
}

const DEFAULT_VIEW: ViewState = { scale: 1, x: 0, y: 0 }

export function SvgPreviewPanel({
  svg,
  title,
  emptyTitle,
  emptyDescription,
  zoomControlsLabel,
  zoomOutLabel,
  zoomInLabel,
  resetZoomLabel,
}: SvgPreviewPanelProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    setView(DEFAULT_VIEW)
    dragRef.current = null
    setIsDragging(false)
  }, [svg])

  useEffect(() => {
    const preview = previewRef.current

    if (!preview || !svg) {
      return
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault()

      if (event.deltaY === 0) {
        return
      }

      const bounds = preview?.getBoundingClientRect()

      if (!bounds) {
        return
      }

      const origin = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      }
      const delta = event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP

      setView((current) => zoomAt(current, current.scale + delta, origin))
    }

    preview.addEventListener('wheel', handleWheel, { passive: false })

    return () => preview.removeEventListener('wheel', handleWheel)
  }, [svg])

  function zoomBy(delta: number) {
    const bounds = previewRef.current?.getBoundingClientRect()
    const origin = bounds
      ? { x: bounds.width / 2, y: bounds.height / 2 }
      : { x: 0, y: 0 }

    setView((current) => zoomAt(current, current.scale + delta, origin))
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    }
    setIsDragging(true)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current

    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    setView((current) => ({
      ...current,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    }))
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current

    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId)
    dragRef.current = null
    setIsDragging(false)
  }

  return (
    <section className="svg-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        {svg ? (
          <div className="svg-toolbar" role="group" aria-label={zoomControlsLabel}>
            <span className="svg-format">svg</span>
            <button type="button" aria-label={zoomOutLabel} onClick={() => zoomBy(-SCALE_STEP)}>
              −
            </button>
            <button type="button" aria-label={resetZoomLabel} onClick={() => setView(DEFAULT_VIEW)}>
              {Math.round(view.scale * 100)}%
            </button>
            <button type="button" aria-label={zoomInLabel} onClick={() => zoomBy(SCALE_STEP)}>
              +
            </button>
          </div>
        ) : (
          <span>svg</span>
        )}
      </div>
      {svg ? (
        <div
          ref={previewRef}
          className={`svg-preview${isDragging ? ' is-dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
        >
          <div
            className="svg-preview-content"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      ) : (
        <div className="svg-empty">
          <div>
            <strong>{emptyTitle}</strong>
            <span>{emptyDescription}</span>
          </div>
        </div>
      )}
    </section>
  )
}

function zoomAt(current: ViewState, requestedScale: number, origin: { x: number; y: number }): ViewState {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, requestedScale))

  if (scale === current.scale) {
    return current
  }

  const ratio = scale / current.scale

  return {
    scale,
    x: origin.x - (origin.x - current.x) * ratio,
    y: origin.y - (origin.y - current.y) * ratio,
  }
}
