/**
 * Utility functions for the gesture canvas application
 */

const Utils = {
    /**
     * Calculate distance between two points
     */
    distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Linear interpolation between two values
     */
    lerp(start, end, t) {
        return start + (end - start) * t;
    },

    /**
     * Lerp between two points
     */
    lerpPoint(p1, p2, t) {
        return {
            x: this.lerp(p1.x, p2.x, t),
            y: this.lerp(p1.y, p2.y, t)
        };
    },

    /**
     * Clamp a value between min and max
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    /**
     * Map a value from one range to another
     */
    map(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    },

    /**
     * Calculate angle between two points (in radians)
     */
    angle(p1, p2) {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    },

    /**
     * Calculate midpoint between two points
     */
    midpoint(p1, p2) {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };
    },

    /**
     * Generate a unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Check if a point is inside a rectangle
     */
    pointInRect(point, rect) {
        return point.x >= rect.x &&
               point.x <= rect.x + rect.width &&
               point.y >= rect.y &&
               point.y <= rect.y + rect.height;
    },

    /**
     * Check if a point is inside a circle
     */
    pointInCircle(point, center, radius) {
        return this.distance(point, center) <= radius;
    },

    /**
     * Get bounding box from two points
     */
    getBounds(p1, p2) {
        return {
            x: Math.min(p1.x, p2.x),
            y: Math.min(p1.y, p2.y),
            width: Math.abs(p2.x - p1.x),
            height: Math.abs(p2.y - p1.y)
        };
    },

    /**
     * Expand bounds by a padding amount
     */
    expandBounds(bounds, padding) {
        return {
            x: bounds.x - padding,
            y: bounds.y - padding,
            width: bounds.width + padding * 2,
            height: bounds.height + padding * 2
        };
    },

    /**
     * Smooth a series of points using Catmull-Rom spline
     */
    smoothPoints(points, tension = 0.5) {
        if (points.length < 3) return points;

        const smoothed = [];

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];

            for (let t = 0; t < 1; t += 0.1) {
                const t2 = t * t;
                const t3 = t2 * t;

                const x = 0.5 * (
                    (2 * p1.x) +
                    (-p0.x + p2.x) * t +
                    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
                );

                const y = 0.5 * (
                    (2 * p1.y) +
                    (-p0.y + p2.y) * t +
                    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
                );

                smoothed.push({ x, y });
            }
        }

        smoothed.push(points[points.length - 1]);
        return smoothed;
    },

    /**
     * Simplify points using Ramer-Douglas-Peucker algorithm
     */
    simplifyPoints(points, epsilon = 2) {
        if (points.length < 3) return points;

        const sqDist = (p1, p2) => {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            return dx * dx + dy * dy;
        };

        const sqDistToSegment = (p, v, w) => {
            const l2 = sqDist(v, w);
            if (l2 === 0) return sqDist(p, v);
            let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            return sqDist(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
        };

        const simplify = (start, end) => {
            let maxDist = 0;
            let maxIndex = 0;

            for (let i = start + 1; i < end; i++) {
                const d = sqDistToSegment(points[i], points[start], points[end]);
                if (d > maxDist) {
                    maxDist = d;
                    maxIndex = i;
                }
            }

            if (Math.sqrt(maxDist) > epsilon) {
                const left = simplify(start, maxIndex);
                const right = simplify(maxIndex, end);
                return left.slice(0, -1).concat(right);
            }

            return [points[start], points[end]];
        };

        return simplify(0, points.length - 1);
    },

    /**
     * Deep clone an object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Event emitter mixin
     */
    createEventEmitter() {
        const listeners = {};

        return {
            on(event, callback) {
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(callback);
                return () => this.off(event, callback);
            },

            off(event, callback) {
                if (!listeners[event]) return;
                listeners[event] = listeners[event].filter(cb => cb !== callback);
            },

            emit(event, data) {
                if (!listeners[event]) return;
                listeners[event].forEach(callback => callback(data));
            }
        };
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
