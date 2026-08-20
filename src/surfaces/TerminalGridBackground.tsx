import { useEffect, useRef } from "react";

const CELL = 6;
const GAP = 1;
const PITCH = CELL + GAP;
const BORDER_OPACITY = 0.06;
const PEAK_OPACITY = 0.28;
const CELL_FLICKER_RATE = 0.0018;
const ROW_PULSE_RATE = 0.00035;
const DECAY = 0.93;
const FRAME_MS = 33;

type Cell = { intensity: number };

function parseContentRgb() {
  const { color } = getComputedStyle(document.body);
  const match = color.match(/\d+/g);
  if (!match || match.length < 3) return "235, 238, 241";
  return `${match[0]}, ${match[1]}, ${match[2]}`;
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

    let raf = 0;
    let cols = 0;
    let rows = 0;
    let cells: Cell[] = [];
    let rgb = parseContentRgb();
    let lastFrame = 0;

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
      lastFrame = time;

      const { width, height } = root.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      if (Math.random() < ROW_PULSE_RATE) {
        pulseRow(Math.floor(Math.random() * rows));
      }

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${rgb}, ${BORDER_OPACITY})`;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = cells[y * cols + x];
          if (!cell) continue;

          if (Math.random() < CELL_FLICKER_RATE) {
            cell.intensity = Math.min(
              1,
              cell.intensity + 0.25 + Math.random() * 0.75,
            );
          }

          cell.intensity *= DECAY;

          const px = x * PITCH;
          const py = y * PITCH;
          const fillOpacity = cell.intensity * PEAK_OPACITY;
          if (fillOpacity > 0.02) {
            ctx.fillStyle = `rgba(${rgb}, ${fillOpacity})`;
            ctx.fillRect(px, py, CELL, CELL);
          }
          ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
        }
      }
    };

    layout();
    raf = requestAnimationFrame(draw);

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(root);

    const themeObserver = new MutationObserver(() => {
      rgb = parseContentRgb();
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
      className="pointer-events-none absolute inset-x-0 top-0 h-48 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_35%,transparent_100%)]"
      aria-hidden
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
