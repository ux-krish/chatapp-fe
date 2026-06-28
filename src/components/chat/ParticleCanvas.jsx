import React, { useRef, useEffect, useCallback } from 'react';

/**
 * Interactive Particle Canvas — Antigravity-style constellation effect
 * 
 * Renders floating particles connected by lines. Particles drift lazily
 * and are repelled/attracted by the mouse cursor, creating a living,
 * breathing background. Designed for dark UIs.
 */
function ParticleCanvas({ className = '' }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef([]);
  const dimensionsRef = useRef({ w: 0, h: 0 });

  // Configuration — tuned for a subtle, premium look
  const CONFIG = {
    particleCount: 80,
    particleMinRadius: 1,
    particleMaxRadius: 2.5,
    particleColor: 'rgba(16, 185, 129, ',  // emerald-500 base
    lineColor: 'rgba(16, 185, 129, ',
    lineMaxDist: 140,
    mouseRadius: 180,
    mouseRepelForce: 0.035,
    driftSpeed: 0.3,
    returnForce: 0.008,
    damping: 0.97,
  };

  const initParticles = useCallback((width, height) => {
    const particles = [];
    for (let i = 0; i < CONFIG.particleCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      particles.push({
        x,
        y,
        originX: x,
        originY: y,
        vx: (Math.random() - 0.5) * CONFIG.driftSpeed,
        vy: (Math.random() - 0.5) * CONFIG.driftSpeed,
        radius: CONFIG.particleMinRadius + Math.random() * (CONFIG.particleMaxRadius - CONFIG.particleMinRadius),
        opacity: 0.15 + Math.random() * 0.35,
        // Individual phase offset for organic pulsing
        phase: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;
  }, []);

  const draw = useCallback((ctx, time) => {
    const { w, h } = dimensionsRef.current;
    const particles = particlesRef.current;
    const mouse = mouseRef.current;

    ctx.clearRect(0, 0, w, h);

    // Update and draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Gentle sine-wave pulsing on opacity
      const pulse = Math.sin(time * 0.001 + p.phase) * 0.1;

      // Mouse interaction — repel if too close
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < CONFIG.mouseRadius && dist > 0) {
        const force = (CONFIG.mouseRadius - dist) / CONFIG.mouseRadius * CONFIG.mouseRepelForce;
        p.vx -= (dx / dist) * force;
        p.vy -= (dy / dist) * force;
      }

      // Gentle pull back towards origin
      p.vx += (p.originX - p.x) * CONFIG.returnForce;
      p.vy += (p.originY - p.y) * CONFIG.returnForce;

      // Damping
      p.vx *= CONFIG.damping;
      p.vy *= CONFIG.damping;

      // Move
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges softly
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;

      // Draw particle
      const alpha = Math.max(0, Math.min(1, p.opacity + pulse));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `${CONFIG.particleColor}${alpha.toFixed(3)})`;
      ctx.fill();

      // Draw connections to nearby particles
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const ldx = p.x - p2.x;
        const ldy = p.y - p2.y;
        const ldist = Math.sqrt(ldx * ldx + ldy * ldy);

        if (ldist < CONFIG.lineMaxDist) {
          const lineAlpha = (1 - ldist / CONFIG.lineMaxDist) * 0.12;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `${CONFIG.lineColor}${lineAlpha.toFixed(3)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      // Draw line from particle to mouse if close enough (subtle glow effect)
      if (dist < CONFIG.mouseRadius * 0.8 && dist > 0) {
        const mouseLineAlpha = (1 - dist / (CONFIG.mouseRadius * 0.8)) * 0.15;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = `${CONFIG.lineColor}${mouseLineAlpha.toFixed(3)})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }
    }
  }, []);

  const animate = useCallback((time) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    draw(ctx, time);
    animFrameRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      dimensionsRef.current = { w: rect.width, h: rect.height };
      initParticles(rect.width, rect.height);
    };

    resizeCanvas();
    animFrameRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      resizeCanvas();
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [animate, initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-auto z-0 ${className}`}
      style={{ opacity: 0.65 }}
    />
  );
}

export default ParticleCanvas;
