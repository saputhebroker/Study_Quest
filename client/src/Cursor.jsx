import { useEffect, useRef } from "react";

const COLORS = ["#FAC775", "#AFA9EC", "#ffffff", "#5DCAA5"];

function star(ctx, x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.3 : r;
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export default function Cursor() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W = 0;
    let H = 0;

    function resize() {
      const d = window.devicePixelRatio || 1;
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * d;
      canvas.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    resize();

    const mouse = { x: -100, y: -100 };
    const rocket = { x: -100, y: -100 };
    let angle = -Math.PI / 4;
    let scale = 1;
    let visible = false;
    let hot = false;
    let parts = [];
    let raf;

    function onMove(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!visible) {
        visible = true;
        rocket.x = mouse.x;
        rocket.y = mouse.y;
      }

      // lets the CSS spotlight follow the mouse
      const root = document.documentElement.style;
      root.setProperty("--mx", mouse.x + "px");
      root.setProperty("--my", mouse.y + "px");

      hot = !!(e.target.closest && e.target.closest("button, textarea"));
    }

    function onLeave() {
      visible = false;
    }

    function onClick(e) {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 1 + Math.random() * 3;
        parts.push({
          kind: "star",
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 1,
          r: 3 + Math.random() * 4,
          color: COLORS[i % COLORS.length],
        });
      }
    }

    function frame() {
      ctx.clearRect(0, 0, W, H);
      let speed = 0;

      if (visible) {
        const vx = (mouse.x - rocket.x) * 0.2;
        const vy = (mouse.y - rocket.y) * 0.2;
        rocket.x += vx;
        rocket.y += vy;
        speed = Math.hypot(vx, vy);

        // turn smoothly toward the direction of travel
        if (speed > 0.4) {
          const target = Math.atan2(vy, vx);
          const diff =
            ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          angle += diff * 0.18;
        }

        // flame puffs when flying fast
        if (speed > 1 && Math.random() < 0.8) {
          parts.push({
            kind: "flame",
            x: rocket.x - Math.cos(angle) * 12,
            y: rocket.y - Math.sin(angle) * 12,
            vx: -Math.cos(angle) * 1.5 + (Math.random() - 0.5),
            vy: -Math.sin(angle) * 1.5 + (Math.random() - 0.5),
            life: 1,
            r: 3 + Math.random() * 3,
          });
        }
      }

      scale += ((hot ? 1.35 : 1) - scale) * 0.2;

      // particles
      if (parts.length > 220) parts = parts.slice(-220);
      for (const q of parts) {
        q.x += q.vx;
        q.y += q.vy;
        q.life -= q.kind === "flame" ? 0.04 : 0.025;
      }
      parts = parts.filter((q) => q.life > 0);
      for (const q of parts) {
        if (q.kind === "flame") {
          ctx.fillStyle = `rgba(239, 159, 39, ${q.life})`;
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.r * q.life, 0, Math.PI * 2);
          ctx.fill();
        } else {
          star(ctx, q.x, q.y, q.r * (0.5 + q.life), q.color, q.life);
        }
      }

      if (visible) {
        // real pointer position, so clicks are never a surprise
        ctx.fillStyle = "rgba(124, 140, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // rocket
        ctx.save();
        ctx.translate(rocket.x, rocket.y);
        ctx.rotate(angle);
        ctx.scale(scale, scale);

        const f = 6 + Math.min(speed * 2, 10) + Math.random() * 3;
        ctx.fillStyle = "#EF9F27";
        ctx.beginPath();
        ctx.moveTo(-10, -3);
        ctx.lineTo(-10 - f, 0);
        ctx.lineTo(-10, 3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#D85A30";
        ctx.beginPath();
        ctx.moveTo(-4, -6);
        ctx.lineTo(-12, -12);
        ctx.lineTo(-10, -5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-4, 6);
        ctx.lineTo(-12, 12);
        ctx.lineTo(-10, 5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#E6E8EE";
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.quadraticCurveTo(6, -8, -10, -6);
        ctx.lineTo(-10, 6);
        ctx.quadraticCurveTo(6, 8, 16, 0);
        ctx.fill();

        ctx.fillStyle = "#7c8cff";
        ctx.beginPath();
        ctx.arc(3, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      raf = requestAnimationFrame(frame);
    }
    frame();

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="rocket-canvas" />;
}