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
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.4;
    context.strokeStyle = "#0a2542";
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const position = point(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(position.x, position.y);
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
    if (inkRef.current) {
      onChange(event.currentTarget.toDataURL("image/png"));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
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
        onPointerCancel={finish}
      />
      <div className="signature-line"><span>{hasInk ? "Signature prête" : "Tracez votre signature au-dessus"}</span></div>
    </div>
  );
}
