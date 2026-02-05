/**
 * Gesture recognition system for hand tracking
 * Detects various gestures from MediaPipe hand landmarks
 */

class GestureRecognizer {
    constructor() {
        // Landmark indices for fingers
        this.LANDMARKS = {
            WRIST: 0,
            THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
            INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
            MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
            RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
            PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20
        };

        // Gesture detection thresholds
        this.TAP_DURATION = 300; // Max ms for a tap gesture
        this.TAP_COOLDOWN = 400; // Cooldown between taps
        this.TAP_DISTANCE_THRESHOLD = 30; // Max movement for a tap

        // State tracking
        this.lastTapTime = 0;
        this.previousGestureType = null;
        this.gestureHistory = [];

        // Smoothed position with heavy smoothing for stability
        this.smoothedPosition = { x: 0.5, y: 0.5 };
        this.positionHistory = [];
        this.maxPositionHistory = 8; // More history = smoother movement

        // For tap detection
        this.pointingStartTime = null;
        this.pointingStartPosition = null;
        this.wasPointing = false;

        // For palm panning - extra smooth
        this.palmPositionHistory = [];
        this.maxPalmHistory = 12; // Even more smoothing for palm

        // Two-hand tracking for zoom
        this.twoHandState = {
            active: false,
            initialDistance: null,
            lastDistance: null
        };

        // Event emitter
        const emitter = Utils.createEventEmitter();
        this.on = emitter.on.bind(emitter);
        this.off = emitter.off.bind(emitter);
        this.emit = emitter.emit.bind(emitter);
    }

    /**
     * Process hand landmarks and detect gestures
     * @param {Array} hands - Array of hand landmark results
     * @param {number} canvasWidth - Width of the canvas
     * @param {number} canvasHeight - Height of the canvas
     */
    process(hands, canvasWidth, canvasHeight) {
        if (!hands || hands.length === 0) {
            this.resetState();
            this.emit('noHands', {});
            return null;
        }

        // Only use the first hand (zoom removed)
        const landmarks = hands[0];
        const gesture = this.analyzeHand(landmarks, canvasWidth, canvasHeight);

        // Get cursor position based on gesture type
        let rawPosition = gesture.cursorPosition;

        // Use different smoothing for palm vs pointing
        if (gesture.isOpenPalm) {
            gesture.smoothedPosition = this.smoothPalmPosition(rawPosition, canvasWidth, canvasHeight);
        } else {
            gesture.smoothedPosition = this.smoothPosition(rawPosition, canvasWidth, canvasHeight);
        }

        // Detect tap (pointing then stopping briefly)
        gesture.isTap = this.detectTap(gesture);

        // Track gesture history
        this.gestureHistory.push({
            type: gesture.type,
            timestamp: Date.now()
        });
        if (this.gestureHistory.length > 20) {
            this.gestureHistory.shift();
        }

        // Emit gesture events
        this.emitGestureEvents(gesture);

        this.previousGestureType = gesture.type;

        return gesture;
    }

    /**
     * Smooth position using moving average
     */
    smoothPosition(rawPosition, canvasWidth, canvasHeight) {
        // Add to history
        this.positionHistory.push({ ...rawPosition });
        if (this.positionHistory.length > this.maxPositionHistory) {
            this.positionHistory.shift();
        }

        // Calculate weighted moving average (more recent = higher weight)
        let totalWeight = 0;
        let weightedX = 0;
        let weightedY = 0;

        for (let i = 0; i < this.positionHistory.length; i++) {
            const weight = i + 1; // Linear weighting
            weightedX += this.positionHistory[i].x * weight;
            weightedY += this.positionHistory[i].y * weight;
            totalWeight += weight;
        }

        const smoothedX = weightedX / totalWeight;
        const smoothedY = weightedY / totalWeight;

        // Apply lerp for extra smoothness
        this.smoothedPosition.x = Utils.lerp(this.smoothedPosition.x, smoothedX, 0.5);
        this.smoothedPosition.y = Utils.lerp(this.smoothedPosition.y, smoothedY, 0.5);

        return {
            x: this.smoothedPosition.x * canvasWidth,
            y: this.smoothedPosition.y * canvasHeight
        };
    }

    /**
     * Extra smooth position for palm panning
     */
    smoothPalmPosition(rawPosition, canvasWidth, canvasHeight) {
        // Add to palm history
        this.palmPositionHistory.push({ ...rawPosition });
        if (this.palmPositionHistory.length > this.maxPalmHistory) {
            this.palmPositionHistory.shift();
        }

        // Calculate weighted moving average with heavier smoothing
        let totalWeight = 0;
        let weightedX = 0;
        let weightedY = 0;

        for (let i = 0; i < this.palmPositionHistory.length; i++) {
            const weight = (i + 1) * (i + 1); // Quadratic weighting for smoother movement
            weightedX += this.palmPositionHistory[i].x * weight;
            weightedY += this.palmPositionHistory[i].y * weight;
            totalWeight += weight;
        }

        const smoothedX = weightedX / totalWeight;
        const smoothedY = weightedY / totalWeight;

        // Very smooth lerp for palm
        this.smoothedPosition.x = Utils.lerp(this.smoothedPosition.x, smoothedX, 0.25);
        this.smoothedPosition.y = Utils.lerp(this.smoothedPosition.y, smoothedY, 0.25);

        return {
            x: this.smoothedPosition.x * canvasWidth,
            y: this.smoothedPosition.y * canvasHeight
        };
    }

    /**
     * Analyze a single hand's landmarks
     */
    analyzeHand(landmarks, canvasWidth, canvasHeight) {
        const L = this.LANDMARKS;

        // Get key landmark positions
        const thumbTip = landmarks[L.THUMB_TIP];
        const indexTip = landmarks[L.INDEX_TIP];
        const indexMcp = landmarks[L.INDEX_MCP];
        const middleTip = landmarks[L.MIDDLE_TIP];
        const ringTip = landmarks[L.RING_TIP];
        const pinkyTip = landmarks[L.PINKY_TIP];
        const wrist = landmarks[L.WRIST];
        const palmCenter = landmarks[L.MIDDLE_MCP];

        // Calculate finger states
        const fingerStates = this.getFingerStates(landmarks);

        // Check for open palm (all fingers extended)
        const isOpenPalm = fingerStates.index && fingerStates.middle &&
                          fingerStates.ring && fingerStates.pinky;

        // Check for fist (all fingers curled)
        const isFist = !fingerStates.index && !fingerStates.middle &&
                       !fingerStates.ring && !fingerStates.pinky;

        // Check for pointing (only index extended) - THIS IS THE DRAWING GESTURE
        const isPointing = fingerStates.index && !fingerStates.middle &&
                          !fingerStates.ring && !fingerStates.pinky;

        // Determine cursor position based on gesture
        let cursorPosition;
        if (isOpenPalm) {
            // Use palm center for panning (more stable)
            cursorPosition = {
                x: 1 - palmCenter.x,
                y: palmCenter.y
            };
        } else {
            // Use index fingertip for pointing/drawing
            cursorPosition = {
                x: 1 - indexTip.x,
                y: indexTip.y
            };
        }

        // Determine primary gesture type
        let gestureType = 'idle';
        if (isFist) {
            gestureType = 'fist';
        } else if (isOpenPalm) {
            gestureType = 'palm';
        } else if (isPointing) {
            gestureType = 'point'; // This is now the drawing gesture
        }

        return {
            type: gestureType,
            cursorPosition,
            isOpenPalm,
            isFist,
            isPointing,
            isDrawing: isPointing, // Point = draw
            isPanning: isOpenPalm, // Palm = pan
            isTap: false, // Set later
            fingerStates,
            landmarks,
            confidence: this.calculateConfidence(landmarks)
        };
    }

    /**
     * Determine which fingers are extended
     */
    getFingerStates(landmarks) {
        const L = this.LANDMARKS;

        // For each finger, check if tip is above (lower y value) pip joint
        const isExtended = (tipIdx, pipIdx, mcpIdx) => {
            const tip = landmarks[tipIdx];
            const pip = landmarks[pipIdx];
            const mcp = landmarks[mcpIdx];
            const wrist = landmarks[L.WRIST];

            // Tip should be above pip (lower y) - more lenient threshold
            const tipAbovePip = tip.y < pip.y + 0.02;

            // Tip should be further from wrist than mcp
            const tipDist = Utils.distance(tip, wrist);
            const mcpDist = Utils.distance(mcp, wrist);

            return tipAbovePip && tipDist > mcpDist * 0.85;
        };

        // Thumb detection
        const isThumbExtended = () => {
            const tip = landmarks[L.THUMB_TIP];
            const indexMcp = landmarks[L.INDEX_MCP];
            const dist = Utils.distance(tip, indexMcp);
            return dist > 0.08;
        };

        return {
            thumb: isThumbExtended(),
            index: isExtended(L.INDEX_TIP, L.INDEX_PIP, L.INDEX_MCP),
            middle: isExtended(L.MIDDLE_TIP, L.MIDDLE_PIP, L.MIDDLE_MCP),
            ring: isExtended(L.RING_TIP, L.RING_PIP, L.RING_MCP),
            pinky: isExtended(L.PINKY_TIP, L.PINKY_PIP, L.PINKY_MCP)
        };
    }

    /**
     * Detect tap gesture (brief pointing without much movement)
     */
    detectTap(gesture) {
        const now = Date.now();
        const isPointing = gesture.isPointing;

        // Started pointing
        if (isPointing && !this.wasPointing) {
            this.pointingStartTime = now;
            this.pointingStartPosition = { ...gesture.cursorPosition };
        }

        // Stopped pointing - check if it was a tap
        if (!isPointing && this.wasPointing && this.pointingStartTime) {
            const duration = now - this.pointingStartTime;
            const timeSinceLastTap = now - this.lastTapTime;

            // Check if movement was small (stayed in place)
            let movement = 0;
            if (this.pointingStartPosition) {
                movement = Utils.distance(this.pointingStartPosition, gesture.cursorPosition);
            }

            // It's a tap if: short duration, small movement, and cooldown passed
            if (duration < this.TAP_DURATION &&
                movement < 0.1 && // Normalized distance
                timeSinceLastTap > this.TAP_COOLDOWN) {
                this.lastTapTime = now;
                this.wasPointing = isPointing;
                this.pointingStartTime = null;
                return true;
            }
        }

        this.wasPointing = isPointing;
        return false;
    }

    /**
     * Process two hands for zoom gesture
     */
    processTwoHands(hands, canvasWidth, canvasHeight) {
        const L = this.LANDMARKS;

        // Get index fingertips of both hands
        const hand1Index = hands[0][L.INDEX_TIP];
        const hand2Index = hands[1][L.INDEX_TIP];

        // Calculate distance between index fingers
        const currentDistance = Utils.distance(hand1Index, hand2Index);

        // Get midpoint for zoom center
        const midpoint = Utils.midpoint(hand1Index, hand2Index);

        // Initialize or update zoom state
        if (!this.twoHandState.active) {
            this.twoHandState.active = true;
            this.twoHandState.initialDistance = currentDistance;
            this.twoHandState.lastDistance = currentDistance;
        }

        // Calculate zoom delta
        const zoomDelta = currentDistance / this.twoHandState.lastDistance;
        this.twoHandState.lastDistance = currentDistance;

        // Overall zoom factor relative to start
        const totalZoom = currentDistance / this.twoHandState.initialDistance;

        const gesture = {
            type: 'zoom',
            cursorPosition: {
                x: 1 - midpoint.x,
                y: midpoint.y
            },
            smoothedPosition: {
                x: (1 - midpoint.x) * canvasWidth,
                y: midpoint.y * canvasHeight
            },
            zoomDelta,
            totalZoom,
            twoHandDistance: currentDistance,
            isDrawing: false,
            isPanning: false,
            isOpenPalm: false,
            isFist: false,
            isPointing: false,
            isTap: false
        };

        this.emit('zoom', gesture);
        return gesture;
    }

    /**
     * Calculate confidence score for gesture detection
     */
    calculateConfidence(landmarks) {
        const zValues = landmarks.map(l => l.z || 0);
        const avgZ = zValues.reduce((a, b) => a + b, 0) / zValues.length;
        const variance = zValues.reduce((sum, z) => sum + Math.pow(z - avgZ, 2), 0) / zValues.length;
        return Math.max(0, 1 - variance * 10);
    }

    /**
     * Emit appropriate gesture events
     */
    emitGestureEvents(gesture) {
        // Emit tap event
        if (gesture.isTap) {
            this.emit('tap', gesture);
        }

        // Emit fist event
        if (gesture.isFist) {
            this.emit('fist', gesture);
        }

        // Always emit move event for cursor tracking
        this.emit('move', gesture);
    }

    /**
     * Reset gesture state (when no hands detected)
     */
    resetState() {
        this.previousGestureType = null;
        this.twoHandState.active = false;
        this.twoHandState.initialDistance = null;
        this.pointingStartTime = null;
        this.wasPointing = false;
        // Don't clear position history to avoid jumps when hand returns
    }

    /**
     * Get human-readable gesture name
     */
    getGestureName(gesture) {
        if (!gesture) return 'No hand detected';

        switch (gesture.type) {
            case 'palm': return 'Open Palm (Panning)';
            case 'fist': return 'Fist (Deselect)';
            case 'point': return 'Pointing (Drawing)';
            default: return 'Idle';
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GestureRecognizer;
}
