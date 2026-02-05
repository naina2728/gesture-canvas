/**
 * Hand tracking system using MediaPipe Hands
 * Manages webcam capture and hand landmark detection
 */

class HandTracker {
    constructor(options = {}) {
        this.options = {
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5,
            ...options
        };

        this.videoElement = null;
        this.hands = null;
        this.camera = null;
        this.isRunning = false;
        this.lastResults = null;

        // Callbacks
        this.onResults = null;
        this.onError = null;

        // Performance tracking
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = Date.now();

        // Event emitter
        const emitter = Utils.createEventEmitter();
        this.on = emitter.on.bind(emitter);
        this.off = emitter.off.bind(emitter);
        this.emit = emitter.emit.bind(emitter);
    }

    /**
     * Initialize MediaPipe Hands and webcam
     */
    async initialize(videoElement) {
        this.videoElement = videoElement;

        try {
            // Initialize MediaPipe Hands
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
                }
            });

            this.hands.setOptions({
                maxNumHands: this.options.maxNumHands,
                modelComplexity: this.options.modelComplexity,
                minDetectionConfidence: this.options.minDetectionConfidence,
                minTrackingConfidence: this.options.minTrackingConfidence
            });

            // Set up results callback
            this.hands.onResults((results) => this.handleResults(results));

            // Wait for model to load
            await this.hands.initialize();

            this.emit('initialized', {});
            return true;
        } catch (error) {
            console.error('Failed to initialize hand tracking:', error);
            this.emit('error', { message: 'Failed to initialize hand tracking', error });
            if (this.onError) this.onError(error);
            return false;
        }
    }

    /**
     * Start webcam capture and hand tracking
     */
    async start() {
        if (this.isRunning) return;

        try {
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });

            this.videoElement.srcObject = stream;
            await this.videoElement.play();

            // Start processing loop
            this.isRunning = true;
            this.processFrame();

            this.emit('started', {
                width: this.videoElement.videoWidth,
                height: this.videoElement.videoHeight
            });

            return true;
        } catch (error) {
            console.error('Failed to start camera:', error);
            this.emit('error', { message: 'Failed to access camera', error });
            if (this.onError) this.onError(error);
            return false;
        }
    }

    /**
     * Stop hand tracking
     */
    stop() {
        this.isRunning = false;

        if (this.videoElement && this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }

        this.emit('stopped', {});
    }

    /**
     * Process a single video frame
     */
    async processFrame() {
        if (!this.isRunning) return;

        if (this.videoElement.readyState >= 2) {
            try {
                await this.hands.send({ image: this.videoElement });
            } catch (error) {
                console.error('Error processing frame:', error);
            }
        }

        // Schedule next frame
        requestAnimationFrame(() => this.processFrame());
    }

    /**
     * Handle MediaPipe results
     */
    handleResults(results) {
        this.lastResults = results;

        // Update FPS
        this.frameCount++;
        const now = Date.now();
        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }

        // Extract hand landmarks
        const hands = [];
        if (results.multiHandLandmarks) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                hands.push(results.multiHandLandmarks[i]);
            }
        }

        // Emit results
        this.emit('results', {
            hands,
            handedness: results.multiHandedness || [],
            image: results.image,
            fps: this.fps
        });

        // Legacy callback support
        if (this.onResults) {
            this.onResults(hands, results);
        }
    }

    /**
     * Draw hand landmarks on a canvas
     */
    drawLandmarks(ctx, landmarks, options = {}) {
        const {
            color = '#1971c2',
            lineWidth = 2,
            radius = 4,
            drawConnections = true
        } = options;

        if (!landmarks || landmarks.length === 0) return;

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Convert normalized coordinates to canvas coordinates (mirrored)
        const toCanvas = (point) => ({
            x: (1 - point.x) * width,
            y: point.y * height
        });

        // Hand connections for drawing skeleton
        const HAND_CONNECTIONS = [
            [0, 1], [1, 2], [2, 3], [3, 4],     // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],     // Index
            [0, 9], [9, 10], [10, 11], [11, 12], // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17]           // Palm
        ];

        ctx.save();

        // Draw connections
        if (drawConnections) {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';

            for (const [i, j] of HAND_CONNECTIONS) {
                const start = toCanvas(landmarks[i]);
                const end = toCanvas(landmarks[j]);

                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
            }
        }

        // Draw landmarks
        for (let i = 0; i < landmarks.length; i++) {
            const point = toCanvas(landmarks[i]);

            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);

            // Highlight fingertips
            if ([4, 8, 12, 16, 20].includes(i)) {
                ctx.fillStyle = '#e03131';
            } else {
                ctx.fillStyle = color;
            }

            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Draw webcam frame to canvas (mirrored)
     */
    drawVideo(ctx) {
        if (!this.videoElement || this.videoElement.readyState < 2) return;

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(this.videoElement, -width, 0, width, height);
        ctx.restore();
    }

    /**
     * Get current video dimensions
     */
    getVideoDimensions() {
        if (!this.videoElement) return { width: 0, height: 0 };
        return {
            width: this.videoElement.videoWidth,
            height: this.videoElement.videoHeight
        };
    }

    /**
     * Check if camera is available
     */
    static async checkCameraAvailable() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(device => device.kind === 'videoinput');
        } catch (error) {
            return false;
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandTracker;
}
