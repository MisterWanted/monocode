import { useEffect, useRef } from "react";
import { HARNESS_ICONS } from "../chrome/HarnessIcon";
import { HARNESSES, type HarnessId } from "../lib/session";
import { LOGO_CELLS, createSnakeArcade } from "./gridArcade";
import { drawSpeechBubble } from "./speechBubble";

const CELL = 6;
const GAP = 1;
const PITCH = CELL + GAP;
const BORDER_OPACITY = 0.06;
const PEAK_OPACITY = 0.28;
const GAME_PEAK_OPACITY = 0.5;
const LOGO_OPACITY = 0.7;
const BUBBLE_OPACITY = 0.9;
/** How hard the bubble chases the head; the head itself moves cell by cell. */
const BUBBLE_EASE = 0.2;
const CELL_FLICKER_RATE = 0.0018;
const ROW_PULSE_RATE = 0.00035;
const DECAY = 0.93;
const FRAME_MS = 33;

type Cell = { intensity: number };

function parseRgb(value: string, fallback: string) {
  const match = value.match(/\d+/g);
  if (!match || match.length < 3) return fallback;
  return `${match[0]}, ${match[1]}, ${match[2]}`;
}

function parseContentRgb() {
  return parseRgb(getComputedStyle(document.body).color, "235, 238, 241");
}

function parseSurfaceRgb() {
  return parseRgb(
    getComputedStyle(document.body).backgroundColor,
    "20, 22, 25",
  );
}

export function TerminalGridBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const arcade = createSnakeArcade();
    const logos = Object.fromEntries(
      HARNESSES.map((harness) => {
        const image = new Image();
        image.src = HARNESS_ICONS[harness];
        return [harness, image];
      }),
    ) as Record<HarnessId, HTMLImageElement>;

    let raf = 0;
    let cols = 0;
    let rows = 0;
    let cells: Cell[] = [];
    let rgb = parseContentRgb();
    let surfaceRgb = parseSurfaceRgb();
    let lastFrame = 0;
    let bubbleAt: { x: number; y: number } | null = null;

    const layout = () => {
      const { width, height } = root.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const nextCols = Math.ceil(width / PITCH);
      const nextRows = Math.ceil(height / PITCH);
      if (nextCols === cols && nextRows === rows) return;

      cols = nextCols;
      rows = nextRows;
      const needed = cols * rows;
      const prev = cells;
      cells = Array.from({ length: needed }, (_, index) => {
        const existing = prev[index];
        if (existing) return existing;
        return { intensity: Math.random() < 0.12 ? Math.random() * 0.35 : 0 };
      });
      arcade.resize(cols, rows);
    };

    const pulseRow = (row: number, strength = 0.55) => {
      const start = row * cols;
      for (let x = 0; x < cols; x++) {
        const cell = cells[start + x];
        if (!cell) continue;
        cell.intensity = Math.max(
          cell.intensity,
          strength * (0.35 + Math.random() * 0.65),
        );
      }
    };

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      if (time - lastFrame < FRAME_MS) return;
      const dt = lastFrame ? time - lastFrame : FRAME_MS;
      lastFrame = time;

      const { width, height } = root.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      arcade.step(dt);

      if (Math.random() < ROW_PULSE_RATE) {
        pulseRow(Math.floor(Math.random() * rows));
      }

      const stamp = new Float32Array(cols * rows);
      arcade.stamp(stamp, cols, rows);

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${rgb}, ${BORDER_OPACITY})`;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const index = y * cols + x;
          const cell = cells[index];
          if (!cell) continue;

          if (Math.random() < CELL_FLICKER_RATE) {
            cell.intensity = Math.min(
              1,
              cell.intensity + 0.25 + Math.random() * 0.75,
            );
          }
          cell.intensity *= DECAY;

          const game = stamp[index] ?? 0;
          const peak = game > 0.08 ? GAME_PEAK_OPACITY : PEAK_OPACITY;
          const fillOpacity = Math.max(cell.intensity, game) * peak;
          const px = x * PITCH;
          const py = y * PITCH;
          if (fillOpacity > 0.02) {
            ctx.fillStyle = `rgba(${rgb}, ${fillOpacity})`;
            ctx.fillRect(px, py, CELL, CELL);
          }
          ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
        }
      }

      const pickup = arcade.logoPickup();
      const logo = pickup ? logos[pickup.harness] : null;
      if (pickup && logo?.complete && logo.naturalWidth) {
        const span = LOGO_CELLS * PITCH - GAP;
        ctx.globalAlpha = pickup.alpha * LOGO_OPACITY;
        ctx.drawImage(logo, pickup.x * PITCH, pickup.y * PITCH, span, span);
        ctx.globalAlpha = 1;
      }

      const bubble = arcade.speechBubble();
      if (!bubble) {
        bubbleAt = null;
      } else {
        const target = { x: bubble.x * PITCH, y: bubble.y * PITCH };
        // Ease towards the head, but snap when it wraps around an edge so the
        // bubble doesn't sail across the whole canvas to catch up.
        const wrapped = bubbleAt && Math.abs(target.x - bubbleAt.x) > width / 3;
        bubbleAt =
          !bubbleAt || wrapped
            ? target
            : {
                x: bubbleAt.x + (target.x - bubbleAt.x) * BUBBLE_EASE,
                y: bubbleAt.y + (target.y - bubbleAt.y) * BUBBLE_EASE,
              };

        drawSpeechBubble(
          ctx,
          bubble.text,
          bubbleAt.x,
          bubbleAt.y,
          CELL,
          { width, height },
          bubble.alpha * BUBBLE_OPACITY,
          { fg: `rgb(${rgb})`, bg: `rgb(${surfaceRgb})` },
        );
      }
    };

    layout();
    raf = requestAnimationFrame(draw);

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(root);

    const themeObserver = new MutationObserver(() => {
      rgb = parseContentRgb();
      surfaceRgb = parseSurfaceRgb();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-x-0 top-0 h-48 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_65%,transparent_100%)]"
      aria-hidden
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
