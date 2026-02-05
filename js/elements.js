/**
 * Drawing element classes for the canvas
 * Each element type extends the base Element class
 */

class Element {
    constructor(options = {}) {
        this.id = Utils.generateId();
        this.type = 'element';
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.width = options.width || 0;
        this.height = options.height || 0;
        this.rotation = options.rotation || 0;

        // Styling
        this.strokeColor = options.strokeColor || '#1e1e1e';
        this.fillColor = options.fillColor || 'transparent';
        this.strokeWidth = options.strokeWidth || 4;
        this.opacity = options.opacity || 1;

        // State
        this.selected = false;
        this.locked = false;
    }

    /**
     * Get bounding box
     */
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    /**
     * Get center point
     */
    getCenter() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    /**
     * Check if point is inside element
     */
    containsPoint(point) {
        const bounds = this.getBounds();
        return Utils.pointInRect(point, bounds);
    }

    /**
     * Move element by delta
     */
    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    /**
     * Resize element
     */
    resize(width, height) {
        this.width = Math.abs(width);
        this.height = Math.abs(height);
    }

    /**
     * Draw the element (to be overridden)
     */
    draw(ctx) {
        // Override in subclasses
    }

    /**
     * Draw selection handles
     */
    drawSelection(ctx) {
        if (!this.selected) return;

        const bounds = this.getBounds();
        const handleSize = 8;

        ctx.save();
        ctx.strokeStyle = '#1971c2';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        // Draw bounding box
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

        ctx.setLineDash([]);
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#1971c2';

        // Draw corner handles
        const handles = [
            { x: bounds.x, y: bounds.y }, // Top-left
            { x: bounds.x + bounds.width, y: bounds.y }, // Top-right
            { x: bounds.x, y: bounds.y + bounds.height }, // Bottom-left
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height } // Bottom-right
        ];

        handles.forEach(handle => {
            ctx.fillRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
            ctx.strokeRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
        });

        ctx.restore();
    }

    /**
     * Clone the element
     */
    clone() {
        const data = this.toJSON();
        data.id = Utils.generateId();
        return Element.fromJSON(data);
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rotation: this.rotation,
            strokeColor: this.strokeColor,
            fillColor: this.fillColor,
            strokeWidth: this.strokeWidth,
            opacity: this.opacity
        };
    }

    /**
     * Create element from JSON
     */
    static fromJSON(data) {
        switch (data.type) {
            case 'rectangle':
                return new Rectangle(data);
            case 'circle':
                return new Circle(data);
            case 'line':
                return new Line(data);
            case 'arrow':
                return new Arrow(data);
            case 'freehand':
                return new FreehandPath(data);
            default:
                return new Element(data);
        }
    }
}

/**
 * Rectangle element
 */
class Rectangle extends Element {
    constructor(options = {}) {
        super(options);
        this.type = 'rectangle';
        this.cornerRadius = options.cornerRadius || 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;

        const { x, y, width, height, cornerRadius } = this;

        ctx.beginPath();

        if (cornerRadius > 0) {
            // Rounded rectangle
            const r = Math.min(cornerRadius, Math.min(width, height) / 2);
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + width - r, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + r);
            ctx.lineTo(x + width, y + height - r);
            ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
            ctx.lineTo(x + r, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
        } else {
            ctx.rect(x, y, width, height);
        }

        ctx.closePath();

        if (this.fillColor && this.fillColor !== 'transparent') {
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        }

        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.restore();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            cornerRadius: this.cornerRadius
        };
    }
}

/**
 * Circle/Ellipse element
 */
class Circle extends Element {
    constructor(options = {}) {
        super(options);
        this.type = 'circle';
    }

    getCenter() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    containsPoint(point) {
        const center = this.getCenter();
        const rx = this.width / 2;
        const ry = this.height / 2;

        // Ellipse containment check
        const dx = (point.x - center.x) / rx;
        const dy = (point.y - center.y) / ry;
        return (dx * dx + dy * dy) <= 1;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;

        const center = this.getCenter();
        const rx = this.width / 2;
        const ry = this.height / 2;

        ctx.beginPath();
        ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);

        if (this.fillColor && this.fillColor !== 'transparent') {
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        }

        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();

        ctx.restore();
    }
}

/**
 * Line element
 */
class Line extends Element {
    constructor(options = {}) {
        super(options);
        this.type = 'line';
        this.startX = options.startX || options.x || 0;
        this.startY = options.startY || options.y || 0;
        this.endX = options.endX || this.startX;
        this.endY = options.endY || this.startY;

        this.updateBounds();
    }

    updateBounds() {
        this.x = Math.min(this.startX, this.endX);
        this.y = Math.min(this.startY, this.endY);
        this.width = Math.abs(this.endX - this.startX);
        this.height = Math.abs(this.endY - this.startY);
    }

    containsPoint(point, tolerance = 10) {
        // Check distance to line segment
        const dist = this.distanceToLine(point);
        return dist <= tolerance;
    }

    distanceToLine(point) {
        const { startX, startY, endX, endY } = this;
        const dx = endX - startX;
        const dy = endY - startY;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            return Utils.distance(point, { x: startX, y: startY });
        }

        let t = ((point.x - startX) * dx + (point.y - startY) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));

        const nearestX = startX + t * dx;
        const nearestY = startY + t * dy;

        return Utils.distance(point, { x: nearestX, y: nearestY });
    }

    move(dx, dy) {
        this.startX += dx;
        this.startY += dy;
        this.endX += dx;
        this.endY += dy;
        this.updateBounds();
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;

        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        ctx.lineTo(this.endX, this.endY);

        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.restore();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            startX: this.startX,
            startY: this.startY,
            endX: this.endX,
            endY: this.endY
        };
    }
}

/**
 * Arrow element (line with arrowhead)
 */
class Arrow extends Line {
    constructor(options = {}) {
        super(options);
        this.type = 'arrow';
        this.headLength = options.headLength || 15;
        this.headAngle = options.headAngle || Math.PI / 6;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        ctx.lineTo(this.endX, this.endY);

        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(this.endY - this.startY, this.endX - this.startX);

        ctx.beginPath();
        ctx.moveTo(this.endX, this.endY);
        ctx.lineTo(
            this.endX - this.headLength * Math.cos(angle - this.headAngle),
            this.endY - this.headLength * Math.sin(angle - this.headAngle)
        );
        ctx.moveTo(this.endX, this.endY);
        ctx.lineTo(
            this.endX - this.headLength * Math.cos(angle + this.headAngle),
            this.endY - this.headLength * Math.sin(angle + this.headAngle)
        );
        ctx.stroke();

        ctx.restore();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            headLength: this.headLength,
            headAngle: this.headAngle
        };
    }
}

/**
 * Freehand drawing path
 */
class FreehandPath extends Element {
    constructor(options = {}) {
        super(options);
        this.type = 'freehand';
        this.points = options.points || [];

        if (this.points.length > 0) {
            this.updateBounds();
        }
    }

    addPoint(x, y) {
        this.points.push({ x, y });
        this.updateBounds();
    }

    updateBounds() {
        if (this.points.length === 0) return;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const point of this.points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }

        this.x = minX;
        this.y = minY;
        this.width = maxX - minX;
        this.height = maxY - minY;
    }

    containsPoint(point, tolerance = 10) {
        // Check if point is near any segment of the path
        for (let i = 1; i < this.points.length; i++) {
            const p1 = this.points[i - 1];
            const p2 = this.points[i];

            const dist = this.distanceToSegment(point, p1, p2);
            if (dist <= tolerance) return true;
        }
        return false;
    }

    distanceToSegment(point, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            return Utils.distance(point, p1);
        }

        let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));

        return Utils.distance(point, {
            x: p1.x + t * dx,
            y: p1.y + t * dy
        });
    }

    move(dx, dy) {
        for (const point of this.points) {
            point.x += dx;
            point.y += dy;
        }
        this.updateBounds();
    }

    simplify() {
        if (this.points.length > 3) {
            this.points = Utils.simplifyPoints(this.points, 2);
        }
    }

    draw(ctx) {
        if (this.points.length < 2) return;

        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);

        // Use quadratic curves for smoother lines
        for (let i = 1; i < this.points.length - 1; i++) {
            const midX = (this.points[i].x + this.points[i + 1].x) / 2;
            const midY = (this.points[i].y + this.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(this.points[i].x, this.points[i].y, midX, midY);
        }

        // Last point
        const last = this.points[this.points.length - 1];
        ctx.lineTo(last.x, last.y);

        ctx.stroke();
        ctx.restore();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            points: this.points.map(p => ({ x: p.x, y: p.y }))
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Element, Rectangle, Circle, Line, Arrow, FreehandPath };
}
