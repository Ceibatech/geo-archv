"use client";

import { useEffect, useRef, useState } from "react";

export function SignaturePad({
  label,
  onChange,
}: {
  label: string;
  onChange: (value: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const inkRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncCanvas = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(ratio, ratio);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 2.4;
      context.strokeStyle = "#0a2542";
      context.fillStyle = "#0a2542";
    };

    syncCanvas();
    const observer = new ResizeObserver(syncCanvas);
    observer.observe(canvas);

    return () => observer.disconnect();
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const position = point(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(position.x, position.y);
    context.lineTo(position.x, position.y);
    context.stroke();
    inkRef.current = true;
    setHasInk(true);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const position = point(event);
    context.lineTo(position.x, position.y);
    context.stroke();
    inkRef.current = true;
    setHasInk(true);
  }

  function finish(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const context = event.currentTarget.getContext("2d");
    context?.closePath();
    if (!inkRef.current) {
      onChange(null);
      setHasInk(false);
      return;
    }

    const dataUrl = event.currentTarget.toDataURL("image/png");
    if (dataUrl.length <= "data:image/png;base64,".length + 32) {
      inkRef.current = false;
      setHasInk(false);
      onChange(null);
      return;
    }

    onChange(dataUrl);
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.beginPath();
    }
    drawingRef.current = false;
    inkRef.current = false;
    setHasInk(false);
    onChange(null);
  }

  return (
    <div className="signature-field">
      <div className="signature-field-heading">
        <div>
          <span className="field-label">{label}</span>
          <small>Signez avec le doigt, la souris ou un stylet.</small>
        </div>
        <button className="signature-clear" type="button" onClick={clear} disabled={!hasInk}>Effacer</button>
      </div>
      <canvas
        ref={canvasRef}
        className="signature-canvas"
        aria-label={label}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerLeave={finish}
        onPointerCancel={finish}
      />
      <div className="signature-line"><span>{hasInk ? "Signature prête" : "Tracez votre signature au-dessus"}</span></div>
    </div>
  );
}
