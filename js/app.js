/**
 * Main application - ties everything together
 */

class GestureCanvasApp {
    constructor() {
        // DOM elements
        this.videoElement = document.getElementById('webcam');
        this.drawingCanvas = document.getElementById('drawingCanvas');
        this.handOverlay = document.getElementById('handOverlay');
        this.webcamCanvas = document.getElementById('webcamCanvas');
        this.gestureCursor = document.getElementById('gestureCursor');
        this.gestureIndicator = document.getElementById('gestureIndicator');
        this.gestureText = document.getElementById('gestureText');
        this.zoomIndicator = document.getElementById('zoomIndicator');

        // Initialize components
        this.canvas = new DrawingCanvas(this.drawingCanvas);
        this.gestureRecognizer = new GestureRecognizer();
        this.toolManager = new ToolManager(this.canvas);

        // Connect tool manager to canvas for real-time preview drawing
        this.canvas.setToolManager(this.toolManager);

        // Hand tracker will be initialized later
        this.hands = null;
        this.camera = null;

        // State
        this.isInitialized = false;
        this.zoomIndicatorTimeout = null;

        // Drawing state - track if we're currently drawing
        this.isCurrentlyDrawing = false;
        this.isCurrentlyPanning = false;

        // Toolbar hover state for hand interaction
        this.hoveredButton = null;
        this.hoverStartTime = 0;
        this.HOVER_DWELL_TIME = 3000; // 3 seconds hold to auto-activate
        this.dwellActivated = false; // prevent repeat activation on same hover
        this.isOverToolbar = false;

        // Bind methods
        this.onHandResults = this.onHandResults.bind(this);
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Starting initialization...');
        this.gestureText.textContent = 'Initializing...';

        try {
            // First, request camera permission explicitly
            console.log('Requesting camera access...');
            this.gestureText.textContent = 'Requesting camera access...';

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });

            console.log('Camera access granted');
            this.gestureText.textContent = 'Camera access granted. Loading hand tracking...';

            // Set up video element
            this.videoElement.srcObject = stream;
            this.videoElement.setAttribute('playsinline', '');
            this.videoElement.setAttribute('autoplay', '');

            // Wait for video to be ready
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    console.log('Video metadata loaded');
                    resolve();
                };
            });

            await this.videoElement.play();
            console.log('Video playing, dimensions:', this.videoElement.videoWidth, 'x', this.videoElement.videoHeight);

            // Initialize MediaPipe Hands
            console.log('Initializing MediaPipe Hands...');
            this.gestureText.textContent = 'Loading hand tracking model...';

            this.hands = new Hands({
                locateFile: (file) => {
                    console.log('Loading MediaPipe file:', file);
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
                }
            });

            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.hands.onResults((results) => this.onHandResults(results));

            // Use Camera utility from MediaPipe
            console.log('Setting up camera...');
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    if (this.hands) {
                        await this.hands.send({ image: this.videoElement });
                    }
                },
                width: 1280,
                height: 720
            });

            await this.camera.start();
            console.log('Camera started successfully');

            // Set up UI events
            this.setupUIEvents();
            this.setupCanvasEvents();
            this.setupWebcamPreview();

            // Save initial history state
            this.canvas.saveHistory();

            // Clear the hand overlay (we won't use it on canvas)
            const overlayCtx = this.handOverlay.getContext('2d');
            overlayCtx.clearRect(0, 0, this.handOverlay.width, this.handOverlay.height);

            this.isInitialized = true;
            this.gestureText.textContent = 'Ready! Point finger to draw, open palm to pan.';
            console.log('Gesture Canvas initialized successfully');

        } catch (error) {
            console.error('Initialization failed:', error);
            this.gestureText.textContent = 'Error: ' + error.message;

            if (error.name === 'NotAllowedError') {
                this.gestureText.textContent = 'Camera access denied. Please allow camera access and refresh.';
            } else if (error.name === 'NotFoundError') {
                this.gestureText.textContent = 'No camera found. Please connect a camera and refresh.';
            }
        }
    }

    /**
     * Handle hand tracking results
     */
    onHandResults(results) {
        // Draw webcam preview with hand skeleton (only in preview, not on canvas)
        this.drawWebcamPreview(results);

        // Extract hands
        const hands = results.multiHandLandmarks || [];

        // Process gestures
        const gesture = this.gestureRecognizer.process(
            hands,
            window.innerWidth,
            window.innerHeight
        );

        // Update gesture indicator
        this.updateGestureIndicator(gesture);

        // Update cursor position
        this.updateCursor(gesture);

        // Handle gestures for drawing/panning
        this.handleGestures(gesture);
    }

    /**
     * Check if a screen position is over a clickable toolbar button
     * Returns the button element or null
     */
    getToolbarButtonAt(screenX, screenY) {
        // Check all interactive toolbar buttons
        const buttons = document.querySelectorAll('.tool-btn, .color-btn, .stroke-btn, .action-btn');
        for (const btn of buttons) {
            const rect = btn.getBoundingClientRect();
            if (screenX >= rect.left && screenX <= rect.right &&
                screenY >= rect.top && screenY <= rect.bottom) {
                return btn;
            }
        }
        return null;
    }

    /**
     * Check if screen position is over the toolbar area
     */
    isPositionOverToolbar(screenX, screenY) {
        const toolbar = document.getElementById('toolbar');
        if (!toolbar) return false;
        const rect = toolbar.getBoundingClientRect();
        // Add some padding for easier targeting
        const pad = 10;
        return screenX >= rect.left - pad && screenX <= rect.right + pad &&
               screenY >= rect.top - pad && screenY <= rect.bottom + pad;
    }

    /**
     * Update toolbar hover state based on cursor position
     * Auto-activates button after HOVER_DWELL_TIME (3s hold)
     */
    updateToolbarHover(screenX, screenY) {
        const btn = this.getToolbarButtonAt(screenX, screenY);
        const overToolbar = this.isPositionOverToolbar(screenX, screenY);

        // Remove hover from previous button
        if (this.hoveredButton && this.hoveredButton !== btn) {
            this.hoveredButton.classList.remove('gesture-hover');
            this.hoveredButton.classList.remove('gesture-dwell');
            this.hoveredButton = null;
            this.hoverStartTime = 0;
            this.dwellActivated = false;
        }

        this.isOverToolbar = overToolbar;

        if (btn) {
            if (this.hoveredButton !== btn) {
                // New button hovered
                this.hoveredButton = btn;
                this.hoverStartTime = Date.now();
                this.dwellActivated = false;
                btn.classList.add('gesture-hover');
            } else if (this.hoverStartTime && !this.dwellActivated) {
                const elapsed = Date.now() - this.hoverStartTime;

                // Show dwell progress after 1 second
                if (elapsed > 1000) {
                    btn.classList.add('gesture-dwell');
                }

                // Auto-activate after full dwell time
                if (elapsed >= this.HOVER_DWELL_TIME) {
                    this.dwellActivated = true;
                    btn.classList.remove('gesture-dwell');
                    this.activateHoveredButton();
                }
            }
        }

        return overToolbar;
    }

    /**
     * Clear toolbar hover state
     */
    clearToolbarHover() {
        if (this.hoveredButton) {
            this.hoveredButton.classList.remove('gesture-hover');
            this.hoveredButton.classList.remove('gesture-dwell');
            this.hoveredButton = null;
            this.hoverStartTime = 0;
            this.dwellActivated = false;
        }
        this.isOverToolbar = false;
    }

    /**
     * Activate the currently hovered toolbar button (simulate click)
     */
    activateHoveredButton() {
        if (!this.hoveredButton) return;

        // Flash the button to give visual feedback
        this.hoveredButton.classList.add('gesture-activated');
        setTimeout(() => {
            if (this.hoveredButton) {
                this.hoveredButton.classList.remove('gesture-activated');
            }
        }, 300);

        // Simulate a click on the button
        this.hoveredButton.click();
    }

    /**
     * Handle gesture events
     */
    handleGestures(gesture) {
        if (!gesture) {
            // No hand - stop any ongoing actions
            if (this.isCurrentlyDrawing) {
                this.toolManager.onPinchEnd(0, 0);
                this.isCurrentlyDrawing = false;
            }
            if (this.isCurrentlyPanning) {
                this.toolManager.onPanEnd();
                this.isCurrentlyPanning = false;
            }
            this.clearToolbarHover();
            return;
        }

        const pos = gesture.smoothedPosition;

        // Always update toolbar hover state
        const overToolbar = this.updateToolbarHover(pos.x, pos.y);

        // INDEX FINGER POINTING
        if (gesture.isPointing) {
            // If over toolbar, don't draw - instead handle toolbar interaction
            if (overToolbar) {
                // Stop drawing if we were drawing
                if (this.isCurrentlyDrawing) {
                    this.toolManager.onPinchEnd(pos.x, pos.y);
                    this.isCurrentlyDrawing = false;
                }
                // Don't start drawing when over toolbar
                return;
            }

            // Not over toolbar - clear hover and draw
            this.clearToolbarHover();

            // Stop panning if we were panning
            if (this.isCurrentlyPanning) {
                this.toolManager.onPanEnd();
                this.isCurrentlyPanning = false;
            }

            // Start or continue drawing
            if (!this.isCurrentlyDrawing) {
                this.toolManager.onPinchStart(pos.x, pos.y);
                this.isCurrentlyDrawing = true;
            } else {
                this.toolManager.onPinchMove(pos.x, pos.y);
            }
        }
        // OPEN PALM = PANNING
        else if (gesture.isOpenPalm) {
            this.clearToolbarHover();

            // Stop drawing if we were drawing
            if (this.isCurrentlyDrawing) {
                this.toolManager.onPinchEnd(pos.x, pos.y);
                this.isCurrentlyDrawing = false;
            }

            // Start or continue panning
            if (!this.isCurrentlyPanning) {
                this.toolManager.onPanStart(pos.x, pos.y);
                this.isCurrentlyPanning = true;
            } else {
                this.toolManager.onPanMove(pos.x, pos.y);
            }
        }
        // OTHER GESTURES - stop drawing/panning
        else {
            if (this.isCurrentlyDrawing) {
                this.toolManager.onPinchEnd(pos.x, pos.y);
                this.isCurrentlyDrawing = false;
            }
            if (this.isCurrentlyPanning) {
                this.toolManager.onPanEnd();
                this.isCurrentlyPanning = false;
            }
        }

        // Tap for toolbar button activation or canvas selection
        if (gesture.isTap) {
            if (this.hoveredButton) {
                // Tap on toolbar button - activate it
                this.activateHoveredButton();
            } else if (!this.isCurrentlyDrawing) {
                // Tap on canvas - select element
                this.toolManager.onTap(pos.x, pos.y);
            }
        }

        // Fist for deselect
        if (gesture.isFist) {
            this.clearToolbarHover();
            this.toolManager.onFist();
        }

    }

    /**
     * Set up UI event handlers
     */
    setupUIEvents() {
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.toolManager.setTool(tool);

                // Update active state
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Stroke color buttons
        document.querySelectorAll('#strokeColors .color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                this.toolManager.setStrokeColor(color);

                document.querySelectorAll('#strokeColors .color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Fill color buttons
        document.querySelectorAll('#fillColors .color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                this.toolManager.setFillColor(color);

                document.querySelectorAll('#fillColors .color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Stroke width buttons
        document.querySelectorAll('.stroke-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const width = parseInt(btn.dataset.width);
                this.toolManager.setStrokeWidth(width);

                document.querySelectorAll('.stroke-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Action buttons
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.canvas.undo();
        });

        document.getElementById('redoBtn').addEventListener('click', () => {
            this.canvas.redo();
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            if (confirm('Clear all drawings?')) {
                this.canvas.clear();
            }
        });

        document.getElementById('resetViewBtn').addEventListener('click', () => {
            this.canvas.resetView();
        });

        // Webcam toggle
        document.getElementById('toggleWebcam').addEventListener('click', () => {
            document.getElementById('webcamPreview').classList.toggle('hidden');
        });

        // Help toggle
        document.getElementById('helpToggle').addEventListener('click', () => {
            document.getElementById('helpPanel').classList.toggle('open');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.canvas.redo();
                    } else {
                        this.canvas.undo();
                    }
                } else if (e.key === 'y') {
                    e.preventDefault();
                    this.canvas.redo();
                }
            }

            // Tool shortcuts
            switch (e.key) {
                case 'v':
                case 'V':
                    this.selectToolByName('select');
                    break;
                case 'p':
                case 'P':
                    this.selectToolByName('freehand');
                    break;
                case 'r':
                case 'R':
                    this.selectToolByName('rectangle');
                    break;
                case 'c':
                case 'C':
                    this.selectToolByName('circle');
                    break;
                case 'l':
                case 'L':
                    this.selectToolByName('line');
                    break;
                case 'a':
                case 'A':
                    this.selectToolByName('arrow');
                    break;
                case 'Escape':
                    this.canvas.deselectAll();
                    break;
                case 'Delete':
                case 'Backspace':
                    if (this.canvas.selectedElement) {
                        this.canvas.removeElement(this.canvas.selectedElement);
                    }
                    break;
            }
        });
    }

    /**
     * Select tool by name and update UI
     */
    selectToolByName(name) {
        this.toolManager.setTool(name);
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === name);
        });
    }

    /**
     * Set up canvas event handlers
     */
    setupCanvasEvents() {
        this.canvas.on('historyChanged', ({ canUndo, canRedo }) => {
            document.getElementById('undoBtn').disabled = !canUndo;
            document.getElementById('redoBtn').disabled = !canRedo;
        });
    }

    /**
     * Set up webcam preview canvas
     */
    setupWebcamPreview() {
        this.webcamCanvas.width = 200;
        this.webcamCanvas.height = 150;
    }

    /**
     * Draw webcam preview with hand skeleton (only in preview box)
     */
    drawWebcamPreview(results) {
        const ctx = this.webcamCanvas.getContext('2d');
        const width = this.webcamCanvas.width;
        const height = this.webcamCanvas.height;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Draw video (mirrored)
        if (this.videoElement && this.videoElement.readyState >= 2) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(this.videoElement, -width, 0, width, height);
            ctx.restore();
        }

        // Draw hands on preview ONLY
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                this.drawLandmarksOnPreview(ctx, landmarks, width, height);
            }
        }
    }

    /**
     * Draw landmarks on webcam preview
     */
    drawLandmarksOnPreview(ctx, landmarks, width, height) {
        const toCanvas = (point) => ({
            x: (1 - point.x) * width,
            y: point.y * height
        });

        const HAND_CONNECTIONS = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20],
            [5, 9], [9, 13], [13, 17]
        ];

        ctx.save();
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;

        for (const [i, j] of HAND_CONNECTIONS) {
            const start = toCanvas(landmarks[i]);
            const end = toCanvas(landmarks[j]);
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }

        for (let i = 0; i < landmarks.length; i++) {
            const point = toCanvas(landmarks[i]);
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = [4, 8, 12, 16, 20].includes(i) ? '#ff0000' : '#00ff00';
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Update gesture indicator text
     */
    updateGestureIndicator(gesture) {
        const text = this.gestureRecognizer.getGestureName(gesture);
        this.gestureText.textContent = text;
    }

    /**
     * Update cursor position and state
     */
    updateCursor(gesture) {
        if (!gesture || !gesture.smoothedPosition) {
            this.hideCursor();
            return;
        }

        const pos = gesture.smoothedPosition;
        this.gestureCursor.style.left = pos.x + 'px';
        this.gestureCursor.style.top = pos.y + 'px';
        this.gestureCursor.classList.add('visible');

        // Update cursor state based on gesture
        this.gestureCursor.classList.toggle('pinching', gesture.isPointing);
        this.gestureCursor.classList.toggle('panning', gesture.isOpenPalm);
    }

    /**
     * Hide cursor
     */
    hideCursor() {
        this.gestureCursor.classList.remove('visible');
    }

    /**
     * Show zoom indicator
     */
    showZoomIndicator() {
        const percent = Math.round(this.canvas.transform.scale * 100);
        this.zoomIndicator.textContent = percent + '%';
        this.zoomIndicator.classList.add('visible');

        // Hide after delay
        clearTimeout(this.zoomIndicatorTimeout);
        this.zoomIndicatorTimeout = setTimeout(() => {
            this.zoomIndicator.classList.remove('visible');
        }, 1500);
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.camera) {
            this.camera.stop();
        }
        this.canvas.stopRenderLoop();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GestureCanvasApp();
    window.app.init();
});
