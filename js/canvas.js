/**
 * Canvas system with pan/zoom and element management
 */

class DrawingCanvas {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        // Viewport transform
        this.transform = {
            x: 0,      // Pan offset X
            y: 0,      // Pan offset Y
            scale: 1   // Zoom level
        };

        // Zoom limits
        this.minScale = 0.1;
        this.maxScale = 4;

        // Elements
        this.elements = [];
        this.selectedElement = null;

        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;

        // Grid settings
        this.showGrid = true;
        this.gridSize = 20;

        // Performance
        this.needsRender = true;
        this.animationFrame = null;

        // Tool manager reference for preview drawing
        this.toolManager = null;

        // Initialize
        this.resize();
        this.startRenderLoop();

        // Handle resize
        window.addEventListener('resize', () => this.resize());

        // Event emitter
        const emitter = Utils.createEventEmitter();
        this.on = emitter.on.bind(emitter);
        this.off = emitter.off.bind(emitter);
        this.emit = emitter.emit.bind(emitter);
    }

    /**
     * Set tool manager reference for preview drawing
     */
    setToolManager(toolManager) {
        this.toolManager = toolManager;
    }

    /**
     * Resize canvas to fill window
     */
    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        this.ctx.scale(dpr, dpr);
        this.needsRender = true;
    }

    /**
     * Start the render loop
     */
    startRenderLoop() {
        const loop = () => {
            // Always render if tool manager is actively drawing (for real-time preview)
            const isActivelyDrawing = this.toolManager && this.toolManager.isDrawing;
            if (this.needsRender || isActivelyDrawing) {
                this.render();
                this.needsRender = false;
            }
            this.animationFrame = requestAnimationFrame(loop);
        };
        loop();
    }

    /**
     * Stop the render loop
     */
    stopRenderLoop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    /**
     * Request a render on next frame
     */
    requestRender() {
        this.needsRender = true;
    }

    /**
     * Render the canvas
     */
    render() {
        const ctx = this.ctx;
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);

        // Save context state
        ctx.save();

        // Apply viewport transform
        ctx.translate(this.transform.x, this.transform.y);
        ctx.scale(this.transform.scale, this.transform.scale);

        // Draw grid
        if (this.showGrid) {
            this.drawGrid(ctx, width, height);
        }

        // Draw all elements
        for (const element of this.elements) {
            element.draw(ctx);
        }

        // Draw current tool preview (real-time drawing)
        if (this.toolManager) {
            this.toolManager.drawPreview(ctx);
        }

        // Draw selection for selected element
        if (this.selectedElement) {
            this.selectedElement.drawSelection(ctx);
        }

        // Restore context
        ctx.restore();
    }

    /**
     * Draw background grid
     */
    drawGrid(ctx, width, height) {
        const gridSize = this.gridSize;
        const scale = this.transform.scale;
        const offsetX = this.transform.x;
        const offsetY = this.transform.y;

        // Calculate visible area in canvas coordinates
        const startX = Math.floor(-offsetX / scale / gridSize) * gridSize;
        const startY = Math.floor(-offsetY / scale / gridSize) * gridSize;
        const endX = startX + Math.ceil(width / scale / gridSize) * gridSize + gridSize;
        const endY = startY + Math.ceil(height / scale / gridSize) * gridSize + gridSize;

        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 1 / scale;

        ctx.beginPath();

        // Vertical lines
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }

        // Horizontal lines
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }

        ctx.stroke();
    }

    /**
     * Convert screen coordinates to canvas coordinates
     */
    screenToCanvas(screenX, screenY) {
        return {
            x: (screenX - this.transform.x) / this.transform.scale,
            y: (screenY - this.transform.y) / this.transform.scale
        };
    }

    /**
     * Convert canvas coordinates to screen coordinates
     */
    canvasToScreen(canvasX, canvasY) {
        return {
            x: canvasX * this.transform.scale + this.transform.x,
            y: canvasY * this.transform.scale + this.transform.y
        };
    }

    /**
     * Pan the canvas
     */
    pan(deltaX, deltaY) {
        this.transform.x += deltaX;
        this.transform.y += deltaY;
        this.requestRender();
        this.emit('pan', { x: this.transform.x, y: this.transform.y });
    }

    /**
     * Zoom the canvas
     * @param {number} factor - Zoom factor (> 1 to zoom in, < 1 to zoom out)
     * @param {number} centerX - Screen X coordinate to zoom around
     * @param {number} centerY - Screen Y coordinate to zoom around
     */
    zoom(factor, centerX, centerY) {
        const oldScale = this.transform.scale;
        const newScale = Utils.clamp(oldScale * factor, this.minScale, this.maxScale);

        if (newScale === oldScale) return;

        // Adjust pan to keep the center point fixed
        const scaleChange = newScale / oldScale;
        this.transform.x = centerX - (centerX - this.transform.x) * scaleChange;
        this.transform.y = centerY - (centerY - this.transform.y) * scaleChange;
        this.transform.scale = newScale;

        this.requestRender();
        this.emit('zoom', { scale: this.transform.scale });
    }

    /**
     * Set zoom level directly
     */
    setZoom(scale, centerX, centerY) {
        const factor = scale / this.transform.scale;
        this.zoom(factor, centerX, centerY);
    }

    /**
     * Reset viewport to default
     */
    resetView() {
        this.transform.x = 0;
        this.transform.y = 0;
        this.transform.scale = 1;
        this.requestRender();
        this.emit('viewReset', {});
    }

    /**
     * Add an element to the canvas
     */
    addElement(element) {
        this.elements.push(element);
        this.saveHistory();
        this.requestRender();
        this.emit('elementAdded', { element });
    }

    /**
     * Remove an element from the canvas
     */
    removeElement(element) {
        const index = this.elements.indexOf(element);
        if (index !== -1) {
            this.elements.splice(index, 1);
            if (this.selectedElement === element) {
                this.selectedElement = null;
            }
            this.saveHistory();
            this.requestRender();
            this.emit('elementRemoved', { element });
        }
    }

    /**
     * Find element at a screen position
     */
    getElementAt(screenX, screenY) {
        const canvasPos = this.screenToCanvas(screenX, screenY);

        // Search from top (last added) to bottom
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const element = this.elements[i];
            if (element.containsPoint(canvasPos)) {
                return element;
            }
        }

        return null;
    }

    /**
     * Select an element
     */
    selectElement(element) {
        // Deselect previous
        if (this.selectedElement) {
            this.selectedElement.selected = false;
        }

        this.selectedElement = element;

        if (element) {
            element.selected = true;
        }

        this.requestRender();
        this.emit('selectionChanged', { element });
    }

    /**
     * Deselect all elements
     */
    deselectAll() {
        this.selectElement(null);
    }

    /**
     * Clear all elements
     */
    clear() {
        this.elements = [];
        this.selectedElement = null;
        this.saveHistory();
        this.requestRender();
        this.emit('cleared', {});
    }

    /**
     * Save current state to history
     */
    saveHistory() {
        // Remove any redo states
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Save current state
        const state = this.elements.map(el => el.toJSON());
        this.history.push(state);

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        this.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.historyIndex > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Undo last action
     */
    undo() {
        if (!this.canUndo()) return;

        this.historyIndex--;
        this.restoreFromHistory();
        this.emit('undo', {});
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (!this.canRedo()) return;

        this.historyIndex++;
        this.restoreFromHistory();
        this.emit('redo', {});
    }

    /**
     * Restore state from history
     */
    restoreFromHistory() {
        const state = this.history[this.historyIndex];
        this.elements = state.map(data => Element.fromJSON(data));
        this.selectedElement = null;
        this.requestRender();

        this.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    /**
     * Export canvas as image
     */
    exportAsImage(type = 'png') {
        // Create temporary canvas with just the elements
        const tempCanvas = document.createElement('canvas');
        const bounds = this.getElementsBounds();

        if (!bounds) return null;

        const padding = 20;
        tempCanvas.width = bounds.width + padding * 2;
        tempCanvas.height = bounds.height + padding * 2;

        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        tempCtx.translate(-bounds.x + padding, -bounds.y + padding);

        for (const element of this.elements) {
            element.draw(tempCtx);
        }

        return tempCanvas.toDataURL(`image/${type}`);
    }

    /**
     * Get bounding box of all elements
     */
    getElementsBounds() {
        if (this.elements.length === 0) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const element of this.elements) {
            const bounds = element.getBounds();
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Serialize canvas state to JSON
     */
    toJSON() {
        return {
            transform: { ...this.transform },
            elements: this.elements.map(el => el.toJSON())
        };
    }

    /**
     * Load canvas state from JSON
     */
    fromJSON(data) {
        if (data.transform) {
            this.transform = { ...data.transform };
        }
        if (data.elements) {
            this.elements = data.elements.map(d => Element.fromJSON(d));
        }
        this.selectedElement = null;
        this.history = [this.elements.map(el => el.toJSON())];
        this.historyIndex = 0;
        this.requestRender();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DrawingCanvas;
}
