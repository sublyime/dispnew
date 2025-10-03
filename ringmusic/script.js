class MusicFractal {
    constructor() {
        this.canvas = document.getElementById('fractalCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        
        this.rings = [];
        this.radarSweep = new RadarSweep(this.centerX, this.centerY);
        this.audioSystem = new AudioSystem();
        this.isRunning = false;
        this.animationId = null;
        
        this.speed = 1.0;
        this.currentScale = 'pentatonic';
        this.baseNote = 'A';
        
        // Initialize with first ring
        this.reset();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const speedSlider = document.getElementById('speed');
        const speedValue = document.getElementById('speedValue');
        const scaleSelect = document.getElementById('scale');
        const baseNoteSelect = document.getElementById('baseNote');
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const resetBtn = document.getElementById('resetBtn');
        
        speedSlider.addEventListener('input', (e) => {
            this.speed = parseFloat(e.target.value);
            speedValue.textContent = this.speed.toFixed(1);
        });
        
        scaleSelect.addEventListener('change', (e) => {
            this.currentScale = e.target.value;
            this.audioSystem.setScale(this.currentScale, this.baseNote);
        });
        
        baseNoteSelect.addEventListener('change', (e) => {
            this.baseNote = e.target.value;
            this.audioSystem.setScale(this.currentScale, this.baseNote);
        });
        
        startBtn.addEventListener('click', () => this.start());
        stopBtn.addEventListener('click', () => this.stop());
        resetBtn.addEventListener('click', () => this.reset());
    }
    
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.animate();
        }
    }
    
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
    
    reset() {
        this.stop();
        this.rings = [];
        // Create initial ring with one dot
        const initialRing = new Ring(this.centerX, this.centerY, 80, 1);
        this.rings.push(initialRing);
        this.radarSweep.reset();
        this.draw();
    }
    
    animate() {
        if (!this.isRunning) return;
        
        this.update();
        this.draw();
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    update() {
        // Update radar sweep
        this.radarSweep.update(this.speed);
        
        // Check for collisions between radar and dots
        this.checkCollisions();
    }
    
    checkCollisions() {
        const radarAngle = this.radarSweep.angle;
        
        this.rings.forEach((ring, ringIndex) => {
            ring.dots.forEach((dot, dotIndex) => {
                // Allow dots to be hit multiple times by checking if enough time has passed
                const timeSinceLastHit = Date.now() - (dot.lastHitTime || 0);
                const canBeHit = timeSinceLastHit > 100; // 100ms cooldown to prevent rapid firing
                
                if (canBeHit && this.isRadarHittingDot(ring, dot, radarAngle)) {
                    this.handleDotHit(ring, dot, ringIndex, dotIndex);
                }
            });
        });
    }
    
    isRadarHittingDot(ring, dot, radarAngle) {
        // Calculate the angle from center to the dot
        const dotX = ring.x + Math.cos(dot.angle) * ring.radius;
        const dotY = ring.y + Math.sin(dot.angle) * ring.radius;
        
        const dotAngle = Math.atan2(dotY - this.centerY, dotX - this.centerX);
        
        // Normalize angles to [0, 2π]
        const normalizedRadarAngle = ((radarAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const normalizedDotAngle = ((dotAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        
        // Check if radar angle is close to dot angle (within a small threshold)
        const threshold = 0.1; // Adjust for sensitivity
        const angleDiff = Math.abs(normalizedRadarAngle - normalizedDotAngle);
        
        return angleDiff < threshold || angleDiff > (2 * Math.PI - threshold);
    }
    
    handleDotHit(ring, dot, ringIndex, dotIndex) {
        // Mark when dot was last hit
        dot.lastHitTime = Date.now();
        
        // Play note
        const noteIndex = (ringIndex + dotIndex) % this.audioSystem.scale.length;
        this.audioSystem.playNote(noteIndex);
        
        // Create new ring with one additional dot
        const newRadius = ring.radius * 1.3; // Make it larger
        const currentRingDots = ring.dots.length;
        const newDotCount = currentRingDots + 1; // Add just one more dot
        
        // Always create new ring (remove radius limit)
        const newRing = new Ring(ring.x, ring.y, newRadius, newDotCount);
        this.rings.push(newRing);
        
        // Visual effect for hit dot
        dot.hitTime = Date.now();
    }
    
    draw() {
        // Clear canvas with fade effect
        this.ctx.fillStyle = 'rgba(0, 4, 40, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw rings and dots
        this.rings.forEach(ring => ring.draw(this.ctx));
        
        // Draw radar sweep
        this.radarSweep.draw(this.ctx);
    }
}

class Ring {
    constructor(x, y, radius, numDots) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.dots = [];
        
        // Create random dots on the ring
        for (let i = 0; i < numDots; i++) {
            this.dots.push({
                angle: Math.random() * 2 * Math.PI,
                lastHitTime: 0,
                hitTime: 0
            });
        }
    }
    
    draw(ctx) {
        // Draw ring circle
        ctx.strokeStyle = 'rgba(78, 205, 196, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Draw dots
        this.dots.forEach(dot => {
            const dotX = this.x + Math.cos(dot.angle) * this.radius;
            const dotY = this.y + Math.sin(dot.angle) * this.radius;
            
            ctx.beginPath();
            
            // Check if dot was recently hit for visual effect
            const timeSinceHit = Date.now() - dot.hitTime;
            const isRecentlyHit = timeSinceHit < 1000; // 1 second effect
            
            if (isRecentlyHit) {
                // Hit dot effect
                const maxTime = 1000; // 1 second
                const progress = Math.min(timeSinceHit / maxTime, 1);
                
                const size = 6 + (1 - progress) * 10; // Shrinking effect
                const alpha = Math.max(0.3, 1 - progress); // Keep some visibility
                
                ctx.fillStyle = `rgba(255, 107, 107, ${alpha})`;
                ctx.arc(dotX, dotY, size, 0, 2 * Math.PI);
                ctx.fill();
                
                // Ripple effect
                if (progress < 0.5) {
                    const rippleRadius = progress * 30;
                    ctx.strokeStyle = `rgba(255, 107, 107, ${0.5 - progress})`;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(dotX, dotY, rippleRadius, 0, 2 * Math.PI);
                    ctx.stroke();
                }
            } else {
                // Normal dot
                ctx.fillStyle = '#4ecdc4';
                ctx.arc(dotX, dotY, 6, 0, 2 * Math.PI);
                ctx.fill();
                
                // Glow effect
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#4ecdc4';
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });
    }
}

class RadarSweep {
    constructor(centerX, centerY) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.angle = 0;
        this.length = 300; // Adjusted for smaller canvas
    }
    
    update(speed) {
        this.angle += 0.02 * speed;
        if (this.angle > 2 * Math.PI) {
            this.angle -= 2 * Math.PI;
        }
    }
    
    reset() {
        this.angle = 0;
    }
    
    draw(ctx) {
        const endX = this.centerX + Math.cos(this.angle) * this.length;
        const endY = this.centerY + Math.sin(this.angle) * this.length;
        
        // Draw radar line with gradient
        const gradient = ctx.createLinearGradient(this.centerX, this.centerY, endX, endY);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Draw center dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, 4, 0, 2 * Math.PI);
        ctx.fill();
    }
}

class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.scale = [];
        this.baseFrequency = 440; // A4
        this.initAudio();
        this.setScale('pentatonic', 'A');
    }
    
    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.error('Web Audio API not supported:', error);
        }
    }
    
    setScale(scaleName, baseNote) {
        const noteFrequencies = {
            'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
            'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
            'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
        };
        
        this.baseFrequency = noteFrequencies[baseNote];
        
        const scaleIntervals = {
            pentatonic: [0, 2, 4, 7, 9], // Major pentatonic
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            blues: [0, 3, 5, 6, 7, 10],
            chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        };
        
        const intervals = scaleIntervals[scaleName] || scaleIntervals.pentatonic;
        this.scale = intervals.map(interval => {
            return this.baseFrequency * Math.pow(2, interval / 12);
        });
    }
    
    playNote(noteIndex) {
        if (!this.audioContext || this.scale.length === 0) return;
        
        // Resume audio context if suspended (required for user interaction)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const frequency = this.scale[noteIndex % this.scale.length];
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        // Envelope for smooth note
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.musicFractal = new MusicFractal();
});