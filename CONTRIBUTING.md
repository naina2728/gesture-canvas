# Contributing to Gesture Canvas

Thanks for wanting to make this better. Here's how to get started.

## Getting Set Up

1. Fork the repo
2. Clone your fork
3. Open `index.html` in a browser or use any static server
4. Make sure your webcam works and browser allows camera access

That's it. No dependencies to install, no build process, no package.json. Just edit and refresh.

## Project Structure
```
gesture-canvas/
├── index.html           # Entry point
├── style.css            # All the styles
└── js/
    ├── app.js          # Main orchestration
    ├── handTracking.js # MediaPipe integration
    ├── gestures.js     # Gesture recognition logic
    ├── canvas.js       # Drawing canvas with pan/zoom
    ├── tools.js        # Drawing tools
    ├── elements.js     # Shape objects
    └── utils.js        # Helper functions
```

Everything loads in order via script tags. No bundler, no transpiler, no module system. Old school.

## Code Style

Keep it clean and simple:
- Use ES6+ features (classes, arrow functions, destructuring)
- Comment the tricky bits
- Name things clearly
- Keep functions focused
- Prefer readability over cleverness
- Use `const` by default, `let` when needed, never `var`

No linter configured. Just use your judgment.

## Adding a New Gesture

1. Open `js/gestures.js`
2. Add detection logic in `analyzeHand()` method
3. Check finger states with `getFingerStates()`
4. Return a new gesture type in the result object
5. Update `getGestureName()` to display it
6. Wire it up in `app.js` in `handleGestures()`

Example - detecting a peace sign:
```javascript
// In analyzeHand()
const isPeaceSign = fingerStates.index && fingerStates.middle && 
                   !fingerStates.ring && !fingerStates.pinky;

// Add to return object
return {
    type: isPeaceSign ? 'peace' : gestureType,
    isPeaceSign,
    // ... other properties
};
```

## Adding a New Tool

1. Open `js/tools.js`
2. Create a new class extending `Tool`
3. Implement `onStart()`, `onMove()`, `onEnd()`, and `drawPreview()`
4. Add it to `ToolManager.tools`
5. Add UI button in `index.html`
6. Add event listener in `app.js`

Example:
```javascript
class StarTool extends Tool {
    constructor(canvas) {
        super(canvas);
        this.name = 'star';
    }
    
    onStart(screenX, screenY) {
        super.onStart(screenX, screenY);
        this.previewElement = new Star({
            ...this.getStyle(),
            x: this.startPoint.x,
            y: this.startPoint.y
        });
    }
    
    // ... implement other methods
}
```

## Adding a New Shape

1. Open `js/elements.js`
2. Create a class extending `Element`
3. Implement `draw()`, `containsPoint()`, `getBounds()`, and `toJSON()`
4. Add a `fromJSON()` case in `Element.fromJSON()`

Check existing shapes for patterns.

## Testing

No formal test suite. Just:
1. Load the app
2. Try your feature with actual gestures
3. Check the browser console for errors
4. Test in different lighting conditions
5. Try both hands
6. Make sure undo/redo still works

If it works, it works.

## Performance Tips

- Hand tracking runs every frame (~30 FPS)
- Canvas renders when needed (dirty flag pattern)
- Smooth gesture data with moving averages
- Batch canvas operations
- Use `requestAnimationFrame()` for animations
- Profile with DevTools if something feels slow

## Debugging

Useful tricks:
- Check browser console for MediaPipe logs
- Watch the webcam preview (bottom right corner) to verify hand detection
- Check gesture indicator (top right) to see what gesture is detected
- Use `console.log()` in gesture recognition to debug finger states
- Draw debug info on canvas if needed

## Common Pitfalls

- **Forgetting to convert screen coords to canvas coords**: Use `canvas.screenToCanvas(x, y)`
- **Not requesting render after changes**: Call `canvas.requestRender()`
- **Breaking gesture smoothing**: Keep averaging/filtering in place
- **Coordinate space confusion**: Screen coords vs canvas coords vs normalized landmarks
- **Not handling missing hands**: Always check if hands array is empty

## Pull Request Guidelines

1. **Keep changes focused** - One feature or fix per PR
2. **Test it thoroughly** - Actually use it with gestures
3. **Explain what and why** - Good PR description helps
4. **Update README if needed** - Document new features
5. **Keep it working** - Don't break existing functionality

No need for:
- Adding dependencies (unless really necessary)
- Rewriting everything
- Changing code style of existing code
- Adding a build process

## Ideas for Contributions

### Easy
- Add more colors to palette
- New keyboard shortcuts
- Better touch device support
- Additional shapes
- Save/load drawings to localStorage
- Dark mode

### Medium
- Export to PNG/SVG
- Gesture calibration/tuning UI
- Smoothing parameter controls
- Grid snap toggle
- Layers system
- Copy/paste elements

### Hard
- Two-hand zoom/rotate gestures
- Real-time collaboration
- Gesture recording and playback
- Custom gesture training
- 3D hand visualization
- Mobile device support with motion sensors

## Questions?

Open an issue. Or just try stuff and see what happens.

## Code of Conduct

Be nice. Help others. Share knowledge. Don't be a jerk.

---

**Note**: This is a side project. Responses might be slow. PRs might sit for a while. That's okay. Take your time. Make cool stuff.

