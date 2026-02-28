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
  onSwipeNext?: () => void;
  onSwipePrevious?: () => void;
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
  onSwipeNext,
  onSwipePrevious,
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
      onDrag: ({
        down,
        offset: [x, y],
        movement: [mx, my],
        swipe: [swipeX],
        last,
        event
      }) => {
        const isPointerEvent =
          typeof PointerEvent !== "undefined" && event instanceof PointerEvent;
        const pointerType = isPointerEvent ? event.pointerType : "mouse";
        const isTouchLikePointer = pointerType === "touch" || pointerType === "pen";

        if (zoom <= 1) {
          setPan(0, 0);
          setIsInteracting(down);

          if (last && isTouchLikePointer) {
            if (swipeX < 0) {
              onSwipeNext?.();
            } else if (swipeX > 0) {
              onSwipePrevious?.();
            } else {
              // Fallback when the drag didn't hit swipe velocity, but distance is clear.
              const absX = Math.abs(mx);
              const absY = Math.abs(my);
              const isHorizontalSwipe = absX >= 56 && absX > absY * 1.2;
              if (isHorizontalSwipe) {
                if (mx < 0) {
                  onSwipeNext?.();
                } else {
                  onSwipePrevious?.();
                }
              }
            }
          }

          if (!down) {
            setIsInteracting(false);
          }
          return;
        }

        if (isTouchLikePointer && last) {
          // Zoomed-in panning stays free-form; no page navigation while inspecting content.
          setIsInteracting(false);
        } else {
          setIsInteracting(down);
        }
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
        pointer: { touch: true },
        swipe: {
          distance: [56, 56],
          velocity: [0.15, 0.15],
          duration: 280
        }
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
      className="cursor-grab overflow-hidden rounded-[10px] bg-transparent active:cursor-grabbing"
      style={{ touchAction: "none" }}
      {...bind()}
    >
      <div className="origin-center will-change-transform" style={transformStyle}>
        {children}
      </div>
    </div>
  );
}
