class ConfettiEffect {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.animationId = null;
        
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }

    createConfetti() {
        const colors = ['#00d4ff', '#7b2ff7', '#ff006e', '#00ff88', '#ffaa00'];
        const confettiCount = 100;

        for (let i = 0; i < confettiCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: -10,
                vx: (Math.random() - 0.5) * 8,
                vy: Math.random() * 5 + 3,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotationVelocity: (Math.random() - 0.5) * 10,
                life: 1,
                decay: Math.random() * 0.015 + 0.015
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles = this.particles.filter(p => p.life > 0);

        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1;
            particle.rotation += particle.rotationVelocity;
            particle.life -= particle.decay;

            this.ctx.save();
            this.ctx.globalAlpha = particle.life;
            this.ctx.translate(particle.x, particle.y);
            this.ctx.rotate((particle.rotation * Math.PI) / 180);

            this.ctx.fillStyle = particle.color;
            this.ctx.shadowColor = particle.color;
            this.ctx.shadowBlur = 10;
            
            this.ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            
            this.ctx.restore();
        });

        if (this.particles.length > 0) {
            this.animationId = requestAnimationFrame(() => this.animate());
        }
    }

    trigger() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.createConfetti();
        this.animate();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.particles = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

const confetti = new ConfettiEffect('confetti');
