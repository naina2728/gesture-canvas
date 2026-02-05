/**
 * Drawing tools for the gesture canvas
 * Each tool handles gesture input and creates/modifies elements
 */

class Tool {
    constructor(canvas) {
        this.canvas = canvas;
        this.name = 'tool';
        this.isActive = false;

        // Drawing state
        this.startPoint = null;
        this.currentPoint = null;
        this.previewElement = null;

        // Style options (set by app)
        this.strokeColor = '#1e1e1e';
        this.fillColor = 'transparent';
        this.strokeWidth = 4;
    }

    /**
     * Called when tool becomes active
     */
    activate() {
        this.isActive = true;
    }

    /**
     * Called when tool is deactivated
     */
    deactivate() {
        this.isActive = false;
        this.startPoint = null;
        this.currentPoint = null;
        this.previewElement = null;
    }

    /**
     * Called when gesture starts (pinch begins)
     */
    onStart(screenX, screenY) {
        this.startPoint = this.canvas.screenToCanvas(screenX, screenY);
        this.currentPoint = { ...this.startPoint };
    }

    /**
     * Called during gesture (pinch move)
     */
    onMove(screenX, screenY) {
        this.currentPoint = this.canvas.screenToCanvas(screenX, screenY);
    }

    /**
     * Called when gesture ends (pinch release)
     */
    onEnd(screenX, screenY) {
        this.startPoint = null;
        this.currentPoint = null;
        this.previewElement = null;
    }

    /**
     * Draw preview while drawing
     */
    drawPreview(ctx) {
        // Override in subclasses
    }

    /**
     * Get style options for new elements
     */
    getStyle() {
        return {
            strokeColor: this.strokeColor,
            fillColor: this.fillColor,
            strokeWidth: this.strokeWidth
        };
    }
}

/**
 * Select tool - select and move elements
 */
class SelectTool extends Tool {
    constructor(canvas) {
        super(canvas);
        this.name = 'select';
        this.draggedElement = null;
        this.dragOffset = { x: 0, y: 0 };
    }

    onStart(screenX, screenY) {
        super.onStart(screenX, screenY);

        // Check if clicking on an element
        const element = this.canvas.getElementAt(screenX, screenY);

        if (element) {
            this.canvas.selectElement(element);
            this.draggedElement = element;
            this.dragOffset = {
                x: this.startPoint.x - element.x,
                y: this.startPoint.y - element.y
            };
        } else {
            this.canvas.deselectAll();
            this.draggedElement = null;
        }
    }

    onMove(screenX, screenY) {
        super.onMove(screenX, screenY);

        if (this.draggedElement && this.startPoint) {
            // Move the element
            const dx = this.currentPoint.x - this.startPoint.x;
            const dy = this.currentPoint.y - this.startPoint.y;

            this.draggedElement.x = this.startPoint.x - this.dragOffset.x + dx;
            this.draggedElement.y = this.startPoint.y - this.dragOffset.y + dy;

            // Update start and end for Line/Arrow elements
            if (this.draggedElement.type === 'line' || this.draggedElement.type === 'arrow') {
                // The move is already handled by the element's move method
                // We need to track the original positions
            }

            this.canvas.requestRender();
        }
    }

    onEnd(screenX, screenY) {
        if (this.draggedElement) {
            // Save history after moving
            this.canvas.saveHistory();
        }
        this.draggedElement = null;
        super.onEnd(screenX, screenY);
    }
}

/**
 * Rectangle tool
 */
class RectangleTool extends Tool {
    constructor(canvas) {
        super(canvas);
        this.name = 'rectangle';
    }

    onStart(screenX, screenY) {
        super.onStart(screenX, screenY);

        this.previewElement = new Rectangle({
            ...this.getStyle(),
            x: this.startPoint.x,
            y: this.startPoint.y,
            width: 0,
            height: 0
        });
    }

    onMove(screenX, screenY) {
        super.onMove(screenX, screenY);

        if (this.previewElement && this.startPoint) {
            const bounds = Utils.getBounds(this.startPoint, this.currentPoint);
            this.previewElement.x = bounds.x;
            this.previewElement.y = bounds.y;
            this.previewElement.width = bounds.width;
            this.previewElement.height = bounds.height;
            this.canvas.requestRender();
        }
    }

    onEnd(screenX, screenY) {
        if (this.previewElement && this.previewElement.width > 5 && this.previewElement.height > 5) {
            this.canvas.addElement(this.previewElement);
        }
        super.onEnd(screenX, screenY);
    }

    drawPreview(ctx) {
        if (this.previewElement) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            this.previewElement.draw(ctx);
            ctx.restore();
        }
    }
}

/**
 * Circle tool
 */
class CircleTool extends Tool {
    constructor(canvas) {
        super(canvas);
        this.name = 'circle';
    }

    onStart(screenX, screenY) {
        super.onStart(screenX, screenY);

        this.previewElement = new Circle({
            ...this.getStyle(),
            x: this.startPoint.x,
            y: this.startPoint.y,
            width: 0,
            height: 0
        });
    }

    onMove(screenX, screenY) {
        super.onMove(screenX, screenY);

        if (this.previewElement && this.startPoint) {
            const bounds = Utils.getBounds(this.startPoint, this.currentPoint);
            this.previewElement.x = bounds.x;
            this.previewElement.y = bounds.y;
            this.previewElement.width = bounds.width;
            this.previewElement.height = bounds.height;
            this.canvas.requestRender();
        }
    }

    onEnd(screenX, screenY) {
        if (this.previewElement && this.previewElement.width > 5 && this.previewElement.height > 5) {
            this.canvas.addElement(this.previewElement);
        }
        super.onEnd(screenX, screenY);
    }

    drawPreview(ctx) {
        if (this.previewElement) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            this.previewElement.draw(ctx);
            ctx.restore();
        }
    }
}

/**
 * Line tool
 */
class LineTool extends Tool {
    constructor(canvas) {
        super(canvas);
        this.name = 'line';
    }

    onStart(screenX, screenY) {
        super.onStart(screenX, screenY);

        this.previewElement = new Line({
            ...this.getStyle(),
            startX: this.startPoint.x,
            startY: this.startPoint.y,
            endX: this.startPoint.x,
            endY: this.startPoint.y
        });
    }

    onMove(screenX, screenY) {
        super.onMove(screenX, screenY);

        if (this.previewElement) {
            this.previewElement.endX = this.currentPoint.x;
            this.previewElement.endY = this.currentPoint.y;
            this.previewElement.updateBounds();
            this.canvas.requestRender();
        }
    }

    onEnd(screenX, screenY) {
        if (this.previewElement) {
            const length = Utils.distance(
                { x: this.previewElement.startX, y: this.previewElement.startY },
                { x: this.previewElement.endX, y: this.previewElement.endY }
            );
            if (length > 10) {
                this.canvas.addElement(this.previewElement);
            }
        }
        super.onEnd(screenX, screenY);
    }

    drawPreview(ctx) {
        if (this.previewElement) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            this.previewElement.draw(ctx);
            ctx.restore();
        }
    }
}

/**
 * Arrow tool
 */
class ArrowTool extends Tool {
    constructor(canvas) {
        super(canvas);
        this.name = 'arrow';
    }

    onStart(screenX, screenY) {
        super.onStart(screenX, screenY);

        this.previewElement = new Arrow({
            ...this.getStyle(),
            startX: this.startPoint.x,
            startY: this.startPoint.y,
            endX: this.startPoint.x,
            endY: this.startPoint.y
        });
    }

    onMove(screenX, screenY) {
        super.onMove(screenX, screenY);

        if (this.previewElement) {
            this.previewElement.endX = this.currentPoint.x;
            this.previewElement.endY = this.currentPoint.y;
            this.previewElement.updateBounds();
            this.canvas.requestRender();
        }
    }

    onEnd(screenX, screenY) {
        if (this.previewElement) {
            const length = Utils.distance(
                { x: this.previewElement.startX, y: this.previewElement.startY },
                { x: this.previewElement.endX, y: this.previewElement.endY }
            );
            if (length > 10) {
                this.canvas.addElement(this.previewElement);
            }
        }
        super.onEnd(screenX, screenY);
    }

    drawPreview(ctx) {
        if (this.previewElement) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            this.previewElement.draw(ctx);
            ctx.restore();
        }
    }
}

/**
 * Freehand drawing tool
 */
class FreehandTool extends Tool {
    constructor(canvas) {
        super(canvas);
        this.name = 'freehand';
        this.minDistance = 3; // Minimum distance between points
        this.lastPoint = null;
    }

    onStart(screenX, screenY) {
        super.onStart(screenX, screenY);

        this.previewElement = new FreehandPath({
            ...this.getStyle(),
            points: [{ ...this.startPoint }]
        });
        this.lastPoint = { ...this.startPoint };
    }

    onMove(screenX, screenY) {
        super.onMove(screenX, screenY);

        if (this.previewElement && this.lastPoint) {
            const dist = Utils.distance(this.lastPoint, this.currentPoint);

            // Only add point if moved enough
            if (dist >= this.minDistance) {
                this.previewElement.addPoint(this.currentPoint.x, this.currentPoint.y);
                this.lastPoint = { ...this.currentPoint };
                this.canvas.requestRender();
            }
        }
    }

    onEnd(screenX, screenY) {
        if (this.previewElement && this.previewElement.points.length > 2) {
            // Simplify the path to reduce points
            this.previewElement.simplify();
            this.canvas.addElement(this.previewElement);
        }
        this.lastPoint = null;
        super.onEnd(screenX, screenY);
    }

    drawPreview(ctx) {
        if (this.previewElement) {
            this.previewElement.draw(ctx);
        }
    }
}

/**
 * Tool manager - handles tool switching and coordinates tools with gestures
 */
class ToolManager {
    constructor(canvas) {
        this.canvas = canvas;

        // Available tools
        this.tools = {
            select: new SelectTool(canvas),
            rectangle: new RectangleTool(canvas),
            circle: new CircleTool(canvas),
            line: new LineTool(canvas),
            arrow: new ArrowTool(canvas),
            freehand: new FreehandTool(canvas)
        };

        // Current tool
        this.currentTool = this.tools.select;
        this.currentTool.activate();

        // Style state
        this.strokeColor = '#1e1e1e';
        this.fillColor = 'transparent';
        this.strokeWidth = 4;

        // Panning state
        this.isPanning = false;
        this.panStartPoint = null;
        this.panStartTransform = null;

        // Drawing state
        this.isDrawing = false;

        // Event emitter
        const emitter = Utils.createEventEmitter();
        this.on = emitter.on.bind(emitter);
        this.off = emitter.off.bind(emitter);
        this.emit = emitter.emit.bind(emitter);
    }

    /**
     * Switch to a different tool
     */
    setTool(toolName) {
        if (this.tools[toolName] && this.currentTool.name !== toolName) {
            this.currentTool.deactivate();
            this.currentTool = this.tools[toolName];
            this.currentTool.activate();
            this.updateToolStyles();
            this.emit('toolChanged', { tool: toolName });
        }
    }

    /**
     * Get current tool name
     */
    getCurrentTool() {
        return this.currentTool.name;
    }

    /**
     * Update style settings
     */
    setStrokeColor(color) {
        this.strokeColor = color;
        this.updateToolStyles();
    }

    setFillColor(color) {
        this.fillColor = color;
        this.updateToolStyles();
    }

    setStrokeWidth(width) {
        this.strokeWidth = width;
        this.updateToolStyles();
    }

    /**
     * Apply styles to all tools
     */
    updateToolStyles() {
        for (const tool of Object.values(this.tools)) {
            tool.strokeColor = this.strokeColor;
            tool.fillColor = this.fillColor;
            tool.strokeWidth = this.strokeWidth;
        }
    }

    /**
     * Handle pinch start gesture
     */
    onPinchStart(screenX, screenY) {
        this.isDrawing = true;
        this.currentTool.onStart(screenX, screenY);
    }

    /**
     * Handle pinch move gesture
     */
    onPinchMove(screenX, screenY) {
        if (this.isDrawing) {
            this.currentTool.onMove(screenX, screenY);
        }
    }

    /**
     * Handle pinch end gesture
     */
    onPinchEnd(screenX, screenY) {
        if (this.isDrawing) {
            this.currentTool.onEnd(screenX, screenY);
            this.isDrawing = false;
        }
    }

    /**
     * Handle palm pan start
     */
    onPanStart(screenX, screenY) {
        this.isPanning = true;
        this.panStartPoint = { x: screenX, y: screenY };
        this.panStartTransform = {
            x: this.canvas.transform.x,
            y: this.canvas.transform.y
        };
    }

    /**
     * Handle palm pan move
     */
    onPanMove(screenX, screenY) {
        if (this.isPanning && this.panStartPoint) {
            const dx = screenX - this.panStartPoint.x;
            const dy = screenY - this.panStartPoint.y;

            this.canvas.transform.x = this.panStartTransform.x + dx;
            this.canvas.transform.y = this.panStartTransform.y + dy;
            this.canvas.requestRender();
        }
    }

    /**
     * Handle palm pan end
     */
    onPanEnd() {
        this.isPanning = false;
        this.panStartPoint = null;
        this.panStartTransform = null;
    }

    /**
     * Handle tap gesture (for tool selection via UI)
     */
    onTap(screenX, screenY) {
        // Check if tap is on an element (for selection)
        if (this.currentTool.name === 'select') {
            const element = this.canvas.getElementAt(screenX, screenY);
            if (element) {
                this.canvas.selectElement(element);
            } else {
                this.canvas.deselectAll();
            }
        }
    }

    /**
     * Handle fist gesture (deselect)
     */
    onFist() {
        this.canvas.deselectAll();
    }

    /**
     * Draw tool preview
     */
    drawPreview(ctx) {
        if (this.isDrawing && this.currentTool.previewElement) {
            this.currentTool.drawPreview(ctx);
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Tool, SelectTool, RectangleTool, CircleTool, LineTool, ArrowTool, FreehandTool, ToolManager };
}
