import React, { useRef, useEffect, useState } from "react";
import "./Asteroids.sass";

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

function Asteroids() {
  const canvasRef = useRef(null);
  const [hud, setHUD] = useState({
    score: 0,
    wave: 1,
    lives: 3,
    shield: 100,
  });
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [finalScore, setFinalScore] = useState(0);

  // --- GAME STATE ---
  // These must NOT be in React state (for performance); use refs/let.
  const shipRef = useRef();
  const bulletsRef = useRef([]);
  const asteroidsRef = useRef([]);
  const particlesRef = useRef([]);
  const keysRef = useRef({});
  const lastShotRef = useRef(0);

  // ----------- CLASSES (ported from original) -----------
  class Ship {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.angle = -Math.PI / 2;
      this.velocity = { x: 0, y: 0 };
      this.thrust = 0.3;
      this.friction = 0.98;
      this.size = 8;
      this.invulnerable = 0;
      this.thrustParticles = [];
    }
    update(keys, shield) {
      if (this.invulnerable > 0) this.invulnerable--;
      if (keys["ArrowLeft"] || keys["a"] || keys["A"]) this.angle -= 0.15;
      if (keys["ArrowRight"] || keys["d"] || keys["D"]) this.angle += 0.15;
      if (keys["ArrowUp"] || keys["w"] || keys["W"]) {
        this.velocity.x += Math.cos(this.angle) * this.thrust;
        this.velocity.y += Math.sin(this.angle) * this.thrust;
        this.addThrustParticle();
      }
      const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
      if (speed > 7) {
        this.velocity.x = (this.velocity.x / speed) * 7;
        this.velocity.y = (this.velocity.y / speed) * 7;
      }
      this.velocity.x *= this.friction;
      this.velocity.y *= this.friction;
      this.x += this.velocity.x;
      this.y += this.velocity.y;
      // Wrap
      if (this.x < 0) this.x = CANVAS_WIDTH;
      if (this.x > CANVAS_WIDTH) this.x = 0;
      if (this.y < 0) this.y = CANVAS_HEIGHT;
      if (this.y > CANVAS_HEIGHT) this.y = 0;
      // Update thrust particles
      this.thrustParticles = this.thrustParticles.filter((p) => {
        p.life--;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        return p.life > 0;
      });
    }
    addThrustParticle() {
      if (Math.random() < 0.6) {
        const backX = this.x - Math.cos(this.angle) * 12;
        const backY = this.y - Math.sin(this.angle) * 12;
        this.thrustParticles.push({
          x: backX + (Math.random() - 0.5) * 4,
          y: backY + (Math.random() - 0.5) * 4,
          vx:
            -Math.cos(this.angle) * (2 + Math.random() * 2) +
            (Math.random() - 0.5),
          vy:
            -Math.sin(this.angle) * (2 + Math.random() * 2) +
            (Math.random() - 0.5),
          life: 20 + Math.random() * 15,
        });
      }
    }
    draw(ctx, shield) {
      ctx.save();
      ctx.translate(this.x, this.y);
      // Thrust particles
      this.thrustParticles.forEach((p) => {
        const alpha = p.life / 35;
        ctx.fillStyle = `rgba(255, ${100 + p.life * 3}, 0, ${alpha})`;
        ctx.fillRect(p.x - this.x - 1, p.y - this.y - 1, 2, 2);
      });
      ctx.rotate(this.angle);
      if (this.invulnerable === 0 || Math.floor(this.invulnerable / 5) % 2) {
        // Ship body
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, -8);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.stroke();
        // Shield indicator
        if (shield > 0 && shield < 100) {
          ctx.strokeStyle = `rgba(0, 255, 136, ${shield / 100})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    getCollisionRadius() {
      return 12;
    }
  }

  class Bullet {
    constructor(x, y, angle) {
      this.x = x;
      this.y = y;
      this.angle = angle;
      this.velocity = {
        x: Math.cos(angle) * 10,
        y: Math.sin(angle) * 10,
      };
      this.life = 60;
    }
    update() {
      this.x += this.velocity.x;
      this.y += this.velocity.y;
      this.life--;
      if (this.x < 0) this.x = CANVAS_WIDTH;
      if (this.x > CANVAS_WIDTH) this.x = 0;
      if (this.y < 0) this.y = CANVAS_HEIGHT;
      if (this.y > CANVAS_HEIGHT) this.y = 0;
      return this.life > 0;
    }
    draw(ctx) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(this.x - 1, this.y - 1, 3, 3);
    }
  }

  class Asteroid {
    constructor(x, y, size) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.velocity = {
        x: (Math.random() - 0.5) * (4 - size * 0.5),
        y: (Math.random() - 0.5) * (4 - size * 0.5),
      };
      this.rotation = 0;
      this.rotationSpeed = (Math.random() - 0.5) * 0.08;
      this.radius = size * 15;
      this.points = this.generateShape();
    }
    generateShape() {
      const points = [];
      const numPoints = 8 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const radius = this.radius + (Math.random() - 0.5) * this.radius * 0.3;
        points.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      }
      return points;
    }
    update() {
      this.x += this.velocity.x;
      this.y += this.velocity.y;
      this.rotation += this.rotationSpeed;
      if (this.x < -this.radius) this.x = CANVAS_WIDTH + this.radius;
      if (this.x > CANVAS_WIDTH + this.radius) this.x = -this.radius;
      if (this.y < -this.radius) this.y = CANVAS_HEIGHT + this.radius;
      if (this.y > CANVAS_HEIGHT + this.radius) this.y = -this.radius;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.strokeStyle = "#aaa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) {
        ctx.lineTo(this.points[i].x, this.points[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    checkCollision(point, radius = 0) {
      const dx = point.x - this.x;
      const dy = point.y - this.y;
      return Math.sqrt(dx * dx + dy * dy) < this.radius + radius;
    }
  }

  class Particle {
    constructor(x, y, color = "#fff") {
      this.x = x;
      this.y = y;
      this.velocity = {
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 0.5) * 8,
      };
      this.life = 30 + Math.random() * 20;
      this.maxLife = this.life;
      this.color = color;
    }
    update() {
      this.x += this.velocity.x;
      this.y += this.velocity.y;
      this.velocity.x *= 0.98;
      this.velocity.y *= 0.98;
      this.life--;
      return this.life > 0;
    }
    draw(ctx) {
      const alpha = this.life / this.maxLife;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(this.x - 1, this.y - 1, 2, 2);
    }
  }

  // ---- GAME LOGIC ----
  function initGame() {
    shipRef.current = new Ship(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    bulletsRef.current = [];
    asteroidsRef.current = [];
    particlesRef.current = [];
    for (let i = 0; i < 5; i++) {
      let x, y;
      do {
        x = Math.random() * CANVAS_WIDTH;
        y = Math.random() * CANVAS_HEIGHT;
      } while (
        Math.sqrt(
          (x - shipRef.current.x) ** 2 + (y - shipRef.current.y) ** 2
        ) < 100
      );
      asteroidsRef.current.push(new Asteroid(x, y, 3));
    }
  }

  function handleShooting() {
    const keys = keysRef.current;
    // Guard against undefined shipRef.current
    if (!shipRef.current) return;
    if (
      (keys[" "] || keys["Space"]) &&
      Date.now() - lastShotRef.current > 200
    ) {
      const bulletX =
        shipRef.current.x + Math.cos(shipRef.current.angle) * 15;
      const bulletY =
        shipRef.current.y + Math.sin(shipRef.current.angle) * 15;
      bulletsRef.current.push(
        new Bullet(bulletX, bulletY, shipRef.current.angle)
      );
      lastShotRef.current = Date.now();
    }
  }

  function checkCollisions() {
    // Bullets vs asteroids
    for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
      for (let j = asteroidsRef.current.length - 1; j >= 0; j--) {
        if (asteroidsRef.current[j].checkCollision(bulletsRef.current[i], 3)) {
          // Explosion particles
          for (let k = 0; k < 6; k++)
            particlesRef.current.push(
              new Particle(
                asteroidsRef.current[j].x,
                asteroidsRef.current[j].y
              )
            );
          // Score
          setHUD((prev) => ({
            ...prev,
            score: prev.score + (4 - asteroidsRef.current[j].size) * 20,
          }));
          // Break asteroid
          if (asteroidsRef.current[j].size > 1) {
            for (let k = 0; k < 2; k++) {
              const angle = Math.random() * Math.PI * 2;
              const distance = 20;
              const newX =
                asteroidsRef.current[j].x + Math.cos(angle) * distance;
              const newY =
                asteroidsRef.current[j].y + Math.sin(angle) * distance;
              asteroidsRef.current.push(
                new Asteroid(
                  newX,
                  newY,
                  asteroidsRef.current[j].size - 1
                )
              );
            }
          }
          asteroidsRef.current.splice(j, 1);
          bulletsRef.current.splice(i, 1);
          break;
        }
      }
    }
    // Ship vs asteroids
    if (shipRef.current && shipRef.current.invulnerable === 0) {
      for (let asteroid of asteroidsRef.current) {
        if (
          asteroid.checkCollision(
            shipRef.current,
            shipRef.current.getCollisionRadius()
          )
        ) {
          if (hud.shield > 0) {
            setHUD((prev) => ({
              ...prev,
              shield: Math.max(0, prev.shield - 25),
            }));
          } else {
            setHUD((prev) => ({
              ...prev,
              lives: prev.lives - 1,
            }));
          }
          shipRef.current.invulnerable = 120;
          shipRef.current.velocity.x *= 0.5;
          shipRef.current.velocity.y *= 0.5;
          for (let i = 0; i < 10; i++)
            particlesRef.current.push(
              new Particle(shipRef.current.x, shipRef.current.y)
            );
          if (hud.lives <= 1) {
            setGameOver(true);
            setFinalScore(hud.score);
            setTimeout(() => {
              setShowStart(false);
            }, 100);
          }
          break;
        }
      }
    }
    // All asteroids destroyed
    if (asteroidsRef.current.length === 0 && shipRef.current) {
      setHUD((prev) => ({
        ...prev,
        wave: prev.wave + 1,
        shield: Math.min(100, prev.shield + 25),
      }));
      const numAsteroids = 4 + hud.wave;
      for (let i = 0; i < numAsteroids; i++) {
        let x, y;
        do {
          x = Math.random() * CANVAS_WIDTH;
          y = Math.random() * CANVAS_HEIGHT;
        } while (
          Math.sqrt(
            (x - shipRef.current.x) ** 2 + (y - shipRef.current.y) ** 2
          ) < 120
        );
        asteroidsRef.current.push(new Asteroid(x, y, 3));
      }
    }
  }

  // ---------- GAME LOOP ----------
  useEffect(() => {
    // Keydown/up listeners (global)
    const keydown = (e) => {
      keysRef.current[e.key] = true;
      keysRef.current[e.code] = true;
      if (
        (e.key === " " || e.code === "Space") &&
        !gameStarted &&
        !gameOver
      ) {
        setGameStarted(true);
        setShowStart(false);
        setGameOver(false);
        setHUD({
          score: 0,
          wave: 1,
          lives: 3,
          shield: 100,
        });
        setTimeout(() => {
          initGame();
        }, 100);
        e.preventDefault();
        return;
      }
      if ((e.key === "r" || e.key === "R") && gameOver) {
        setGameStarted(true);
        setGameOver(false);
        setHUD({
          score: 0,
          wave: 1,
          lives: 3,
          shield: 100,
        });
        setTimeout(() => {
          initGame();
        }, 100);
      }
      e.preventDefault();
    };
    const keyup = (e) => {
      keysRef.current[e.key] = false;
      keysRef.current[e.code] = false;
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);

    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    };
    // eslint-disable-next-line
  }, [gameStarted, gameOver]);

  useEffect(() => {
    let animationId;
    if (!gameStarted || gameOver) return;
    function gameLoop() {
      // Render
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Input
      handleShooting();
      // Update
      if (shipRef.current) {
        shipRef.current.update(keysRef.current, hud.shield);
      }
      bulletsRef.current = bulletsRef.current.filter((b) => b.update());
      asteroidsRef.current.forEach((a) => a.update());
      particlesRef.current = particlesRef.current.filter((p) => p.update());
      // Collisions
      checkCollisions();

      // Draw
      if (shipRef.current) {
        shipRef.current.draw(ctx, hud.shield);
      }
      bulletsRef.current.forEach((b) => b.draw(ctx));
      asteroidsRef.current.forEach((a) => a.draw(ctx));
      particlesRef.current.forEach((p) => p.draw(ctx));

      animationId = requestAnimationFrame(gameLoop);
    }
    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
    // eslint-disable-next-line
  }, [gameStarted, gameOver, hud.lives, hud.wave, hud.shield, hud.score]);

  // --- HUD/Overlays ---
  return (
    <div className="asteroids-root">
      <div className="game-hud">
        <div className="hud-section">
          <div className="score">{hud.score}</div>
          <div>
            Wave: <span>{hud.wave}</span>
          </div>
        </div>
        <div className="hud-section">
          <div>
            Lives: <span>{hud.lives}</span>
          </div>
          <div>
            Shield: <span>{Math.floor(hud.shield)}</span>%
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        tabIndex={0}
      />

      <div className="controls">
        <div>↑ Thrust | ← → Rotate | SPACE: Shoot</div>
        <div>Destroy asteroids and survive!</div>
      </div>

      {showStart && (
        <div className="start-screen">
          <h1>ASTEROIDS</h1>
          <div style={{ fontSize: 16, marginBottom: 15 }}>Enhanced Edition</div>
          <div style={{ fontSize: 14 }}>Press SPACE to start</div>
        </div>
      )}
      {gameOver && (
        <div className="game-over">
          <h1>GAME OVER</h1>
          <div style={{ fontSize: 16, marginBottom: 10 }}>
            Score: <span>{finalScore}</span>
          </div>
          <div style={{ fontSize: 14 }}>Press R to restart</div>
        </div>
      )}
    </div>
  );
}

export default Asteroids;