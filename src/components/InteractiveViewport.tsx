import { PropsWithChildren, useEffect, useMemo, useRef } from "react";
import { useGesture } from "@use-gesture/react";

type InteractiveViewportProps = PropsWithChildren<{
  zoom: number;
  panX: number;
  panY: number;
  isInteracting: boolean;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setIsInteracting: (isInteracting: boolean) => void;
}>;

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
}

export function InteractiveViewport({
  zoom,
  panX,
  panY,
  isInteracting,
  setZoom,
  setPan,
  setIsInteracting,
  children
}: InteractiveViewportProps) {
  const settleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  const bind = useGesture(
    {
      onDrag: ({ down, offset: [x, y] }) => {
        if (zoom <= 1) {
          if (!down) {
            setPan(0, 0);
            setIsInteracting(false);
          }
          return;
        }

        setIsInteracting(down);
        setPan(x, y);
      },
      onPinch: ({ offset: [scale], last }) => {
        const nextZoom = clampZoom(scale);
        setZoom(nextZoom);
        setIsInteracting(!last);
      },
      onWheel: ({ event, delta: [, dy], ctrlKey, metaKey }) => {
        if (!ctrlKey && !metaKey) {
          return;
        }

        event.preventDefault();
        setIsInteracting(true);

        const zoomDelta = -dy * 0.0025;
        setZoom(clampZoom(zoom + zoomDelta));

        if (settleTimerRef.current !== null) {
          window.clearTimeout(settleTimerRef.current);
        }

        settleTimerRef.current = window.setTimeout(() => {
          setIsInteracting(false);
          settleTimerRef.current = null;
        }, 140);
      }
    },
    {
      drag: {
        from: () => [panX, panY],
        filterTaps: true,
        pointer: { touch: true }
      },
      pinch: {
        from: () => [zoom, 0],
        scaleBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
        rubberband: true
      },
      wheel: {
        eventOptions: { passive: false }
      }
    }
  );

  const transformStyle = useMemo(
    () => ({
      transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`,
      transition: isInteracting ? "none" : "transform 160ms ease-out"
    }),
    [panX, panY, zoom, isInteracting]
  );

  return (
    <div
      className="cursor-grab touch-none overflow-hidden rounded-[10px] bg-transparent active:cursor-grabbing"
      {...bind()}
    >
      <div className="origin-center will-change-transform" style={transformStyle}>
        {children}
      </div>
    </div>
  );
}
