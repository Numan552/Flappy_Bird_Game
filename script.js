// ==========================================
// GAME CONFIGURATION & CONSTANTS
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// Physics adjustments
const GRAVITY = 0.25;
const JUMP_STRENGTH = -5.5;
const MAX_FALL_SPEED = 8;
const PIPE_SPEED_START = 2;
const PIPE_SPAWN_RATE = 140; // Fixed: Increased from 100 to 140 for perfect pipe spacing
const PIPE_GAP_START = 130;

// Game State Tracking
let gameState = 'START'; // START, PLAYING, PAUSED, GAMEOVER
let score = 0;
let highScore = localStorage.getItem('flappy_highscore') || 0;
let frameCount = 0;
let currentPipeSpeed = PIPE_SPEED_START;
let currentPipeGap = PIPE_GAP_START;

// Background Day/Night setting
let isNight = false;

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const pauseScreen = document.getElementById('pause-screen');
const liveScoreDisplay = document.getElementById('live-score');
const finalScoreDisplay = document.getElementById('final-score');
const highScoreDisplay = document.getElementById('high-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// ==========================================
// SOUND SYNTHESIZER (Web Audio API)
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    // Resume context if suspended (browser security restriction)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'jump') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'score') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.25);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
    }
}

// ==========================================
// ENTITIES & CLASSES
// ==========================================

class Bird {
    constructor() {
        this.x = 60;
        this.y = 250;
        this.radius = 14;
        this.velocity = 0;
        this.angle = 0;
    }

    reset() {
        this.x = 60;
        this.y = 250;
        this.velocity = 0;
        this.angle = 0;
    }

    jump() {
        this.velocity = JUMP_STRENGTH;
        this.angle = -0.3; // Tilt upward slightly
        playSound('jump');
    }

    update() {
        // Apply Gravity
        this.velocity += GRAVITY;
        if (this.velocity > MAX_FALL_SPEED) {
            this.velocity = MAX_FALL_SPEED;
        }
        this.y += this.velocity;

        // Dynamic Angular Rotation based on Velocity
        if (this.velocity > 3) {
            this.angle += 0.08;
            if (this.angle > Math.PI / 3) this.angle = Math.PI / 3; // Max faceplant rotation
        } else if (this.velocity < 0) {
            this.angle = -0.2;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Body (Classic Yellow/Orange Flappy Look)
        ctx.fillStyle = '#f7d308';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // White Big Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(6, -4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pupil
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(8, -4, 2, 0, Math.PI * 2);
        ctx.fill();

        // Orange Beak
        ctx.fillStyle = '#f75308';
        ctx.beginPath();
        ctx.moveTo(10, -1);
        ctx.lineTo(20, 2);
        ctx.lineTo(10, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Wing
        ctx.fillStyle = '#ffffffaa';
        ctx.beginPath();
        ctx.arc(-6, 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}

class Pipe {
    constructor(x) {
        this.x = x;
        // Randomize gap positioning safely away from canvas top and bottom
        this.topHeight = Math.floor(Math.random() * (CANVAS_HEIGHT - currentPipeGap - 160)) + 40;
        this.bottomY = this.topHeight + currentPipeGap;
        this.width = 60;
        this.passed = false;
    }

    update() {
        this.x -= currentPipeSpeed;
    }

    draw() {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';

        // Pipe color schemes
        const pipeGrad = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
        pipeGrad.addColorStop(0, '#73bf2e');
        pipeGrad.addColorStop(0.3, '#9beb34');
        pipeGrad.addColorStop(1, '#4b821a');

        ctx.fillStyle = pipeGrad;

        // --- Top Pipe ---
        ctx.fillRect(this.x, 0, this.width, this.topHeight);
        ctx.strokeRect(this.x, -5, this.width, this.topHeight + 5);
        // Top Pipe Rim Lip
        ctx.fillRect(this.x - 4, this.topHeight - 24, this.width + 8, 24);
        ctx.strokeRect(this.x - 4, this.topHeight - 24, this.width + 8, 24);

        // --- Bottom Pipe ---
        const bHeight = CANVAS_HEIGHT - this.bottomY;
        ctx.fillRect(this.x, this.bottomY, this.width, bHeight);
        ctx.strokeRect(this.x, this.bottomY, this.width, bHeight + 5);
        // Bottom Pipe Rim Lip
        ctx.fillRect(this.x - 4, this.bottomY, this.width + 8, 24);
        ctx.strokeRect(this.x - 4, this.bottomY, this.width + 8, 24);
    }
}

// Background & Environment System
class Environment {
    constructor() {
        this.bgX = 0;
        this.groundX = 0;
        this.groundHeight = 80;
    }

    update() {
        // Parallax background movement
        this.bgX = (this.bgX - (currentPipeSpeed * 0.2)) % CANVAS_WIDTH;
        this.groundX = (this.groundX - currentPipeSpeed) % CANVAS_WIDTH;
    }

    drawBackground() {
        if (isNight) {
            // Night Gradient Background
            let nightGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
            nightGrad.addColorStop(0, '#0f172a');
            nightGrad.addColorStop(1, '#1e1b4b');
            ctx.fillStyle = nightGrad;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // Draw Celestial Object (Moon)
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.arc(280, 90, 25, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Day Gradient Background
            let dayGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
            dayGrad.addColorStop(0, '#70c5ce');
            dayGrad.addColorStop(1, '#bae6fd');
            ctx.fillStyle = dayGrad;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // Draw Sun
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(280, 90, 30, 0, Math.PI * 2);
            ctx.fill();
        }

        // Distant Pixel Art Style Scenery (Mountains/City Silhouettes)
        ctx.fillStyle = isNight ? '#334155' : '#8cd69e';
        for (let i = 0; i < 2; i++) {
            let offset = this.bgX + (i * CANVAS_WIDTH);
            ctx.fillRect(offset, CANVAS_HEIGHT - 160, 80, 80);
            ctx.fillRect(offset + 60, CANVAS_HEIGHT - 190, 100, 110);
            ctx.fillRect(offset + 200, CANVAS_HEIGHT - 140, 90, 60);
        }
    }

    drawGround() {
        // Ground base layout
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        
        for (let i = 0; i < 2; i++) {
            let offset = this.groundX + (i * CANVAS_WIDTH);
            
            // Mud Bottom
            ctx.fillStyle = '#dcd487';
            ctx.fillRect(offset, CANVAS_HEIGHT - this.groundHeight, CANVAS_WIDTH, this.groundHeight);
            
            // Green grass upper border
            ctx.fillStyle = '#73bf2e';
            ctx.fillRect(offset, CANVAS_HEIGHT - this.groundHeight, CANVAS_WIDTH, 14);
            
            // Border divider line
            ctx.beginPath();
            ctx.moveTo(offset, CANVAS_HEIGHT - this.groundHeight);
            ctx.lineTo(offset + CANVAS_WIDTH, CANVAS_HEIGHT - this.groundHeight);
            ctx.moveTo(offset, CANVAS_HEIGHT - this.groundHeight + 14);
            ctx.lineTo(offset + CANVAS_WIDTH, CANVAS_HEIGHT - this.groundHeight + 14);
            ctx.stroke();
        }
    }
}

// Instantiate Global Class Modules
const bird = new Bird();
const env = new Environment();
let pipes = [];

// ==========================================
// GAMEPLAY LOGIC & MANAGEMENT
// ==========================================

function initGame() {
    score = 0;
    frameCount = 0;
    currentPipeSpeed = PIPE_SPEED_START;
    currentPipeGap = PIPE_GAP_START;
    isNight = Math.random() > 0.5; // 50% chance of randomizing Day/Night environment cyclic change
    pipes = [];
    bird.reset();
}

function checkCollisions(bird, pipe) {
    // Structural Padding for accurate retro collision boxes
    const bLeft = bird.x - bird.radius + 3;
    const bRight = bird.x + bird.radius - 3;
    const bTop = bird.y - bird.radius + 3;
    const bBottom = bird.y + bird.radius - 3;

    // Check collision with top pipe
    if (bRight > pipe.x && bLeft < pipe.x + pipe.width) {
        if (bTop < pipe.topHeight || bBottom > pipe.bottomY) {
            return true;
        }
    }
    return false;
}

function increaseDifficulty() {
    // Slowly escalate structural speed & gap variables over scored markers
    if (score > 0 && score % 5 === 0) {
        currentPipeSpeed = PIPE_SPEED_START + (score * 0.08);
        currentPipeGap = Math.max(95, PIPE_GAP_START - (score * 1.2)); // Cap minimum size gap
    }
}

// Main Update Loop Core
function update() {
    if (gameState !== 'PLAYING') return;

    frameCount++;
    env.update();
    bird.update();

    // Floor and Ceiling Collisions
    if (bird.y + bird.radius >= CANVAS_HEIGHT - env.groundHeight) {
        handleGameOver();
        return;
    }
    if (bird.y - bird.radius <= 0) {
        bird.y = bird.radius;
        bird.velocity = 0.5; // bump down bouncing mechanics
    }

    // Process and Manage Dynamic Spawning Pipes array
    // First pipe spawns after a slight delay, then spawns continuously at intervals
    if (pipes.length === 0 && frameCount === 10) {
        pipes.push(new Pipe(CANVAS_WIDTH + 40));
    } else if (frameCount % PIPE_SPAWN_RATE === 0) {
        pipes.push(new Pipe(CANVAS_WIDTH));
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].update();

        // Frame Check Collision Matrix
        if (checkCollisions(bird, pipes[i])) {
            handleGameOver();
            return;
        }

        // Score Progression Event Logic
        if (!pipes[i].passed && pipes[i].x + pipes[i].width / 2 < bird.x) {
            pipes[i].passed = true;
            score++;
            liveScoreDisplay.textContent = score;
            playSound('score');
            increaseDifficulty();
        }

        // Clean out screen left bounded indices
        if (pipes[i].x + pipes[i].width < 0) {
            pipes.splice(i, 1);
        }
    }
}

// Main Render Drawing Pipeline
function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Layer orders
    env.drawBackground();

    // Render Active Pipe array stream
    for (let pipe of pipes) {
        pipe.draw();
    }

    env.drawGround();
    bird.draw();
}

// Central RequestAnimationFrame System Handle
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function handleGameOver() {
    gameState = 'GAMEOVER';
    playSound('hit');

    // High Score Processing Local Storage Unit
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('flappy_highscore', highScore);
    }

    // Toggle UI Displays Elements
    liveScoreDisplay.classList.add('hidden');
    finalScoreDisplay.textContent = score;
    highScoreDisplay.textContent = highScore;
    gameOverScreen.classList.remove('hidden');
}

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseScreen.classList.remove('hidden');
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        pauseScreen.classList.add('hidden');
    }
}

function triggerJumpAction() {
    if (gameState === 'PLAYING') {
        bird.jump();
    } else if (gameState === 'START') {
        startGame();
    }
}

function startGame() {
    initGame();
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    liveScoreDisplay.classList.remove('hidden');
    liveScoreDisplay.textContent = score;
}


// EVENT LISTENERS & INPUT CONTROLS

// Global Keyboard Router Handles
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault(); // Stop native page scrolling behavior
        triggerJumpAction();
    }
    if (e.code === 'KeyP') {
        togglePause();
    }
});

// Mobile Tapping/Clicking Interactive Engine Bound
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    triggerJumpAction();
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    // Ensure mouse clicks on actual canvas screen process gameplay jump triggers
    if (gameState === 'PLAYING') {
        triggerJumpAction();
    }
});

// UI Button Explicit Event Routing Setup
startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
});

restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
});

// Start Render Phase execution
requestAnimationFrame(gameLoop);