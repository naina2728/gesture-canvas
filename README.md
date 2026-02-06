# Gesture Canvas

Draw in the air. No mouse. No keyboard. Just your hands.

![gesture-canvas-demo](https://img.shields.io/badge/status-active-success)
![license](https://img.shields.io/badge/license-MIT-blue)

## What is this?

Point your finger at the screen. Watch a cursor appear. Start drawing. Raise your palm to pan around. Make a fist to stop. This is drawing with hand gestures, powered by your webcam and some computer vision magic.

No special hardware needed. Just a webcam and a browser.

## Quick Start

Clone it:
```bash
git clone https://github.com/yourusername/gesture-canvas.git
cd gesture-canvas
```

Serve it (any static server works):
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js
npx serve

# Or just open index.html in your browser
```

Visit `http://localhost:8000` and allow camera access when prompted.

## Gestures

- **Point (index finger)** → Draw shapes, freehand lines, or interact with the canvas
- **Open palm** → Pan around the canvas (smooth as butter)
- **Tap (quick point)** → Select tools or elements
- **Fist** → Deselect everything / stop what you're doing
- **Hover over toolbar for 3 seconds** → Auto-select that tool

## Tools

- **Select** - Move stuff around
- **Freehand** - Sketch freely 
- **Rectangle** - Draw boxes
- **Circle** - Draw circles
- **Line** - Draw straight lines
- **Arrow** - Point at things

Plus colors, stroke widths, fills, undo/redo, and all the usual suspects.

## Tech Stack

Pure vanilla JavaScript. No frameworks. No build step. Just:

- **MediaPipe Hands** - Hand tracking ML model
- **Canvas API** - For rendering
- **WebRTC** - Webcam access
- A whole lot of coordinate transforms

The architecture is pretty straightforward:
```
app.js          → Main app orchestration
handTracking.js → Webcam + MediaPipe integration
gestures.js     → Gesture recognition (point, palm, fist, etc.)
canvas.js       → Drawing canvas with pan/zoom
tools.js        → Drawing tools (rectangle, circle, freehand, etc.)
elements.js     → Shape objects
utils.js        → Helper functions
```

## How it Works

1. Your webcam captures video frames
2. MediaPipe Hands detects 21 hand landmarks in 3D space
3. Custom gesture recognition analyzes finger positions to classify gestures
4. Gestures control tools: pointing = drawing, palm = panning
5. Everything gets smoothed and filtered for stable interaction
6. Canvas rendering with transforms handles pan/zoom/scale

The gesture recognition uses fingertip positions relative to knuckles. Index finger extended = point. All fingers extended = palm. All fingers curled = fist. Simple but effective.

## Browser Compatibility

Works in any modern browser with WebRTC support:
- Chrome 90+ ✓
- Edge 90+ ✓
- Firefox 88+ ✓
- Safari 14+ ✓

Needs HTTPS or localhost for camera access (browser security requirement).

## Performance

Runs at ~30 FPS with hand tracking. The gesture recognition and rendering are both optimized with smoothing filters and efficient canvas updates. Hand tracking is the bottleneck, but MediaPipe is already pretty optimized.

If it's laggy, try:
- Closing other tabs
- Using better lighting
- Reducing browser zoom
- Using a faster machine (hand tracking is ML-heavy)

## Known Quirks

- Sometimes gestures need to be exaggerated for reliable detection
- Lighting matters (bright, even lighting works best)
- Hand must be clearly visible (don't cover fingers)
- Small movements can be jittery (smoothing helps but isn't perfect)
- Only tracks up to 2 hands (MediaPipe limitation)

## Keyboard Shortcuts

Because sometimes you just want to use a keyboard:

- `V` - Select tool
- `P` - Freehand (pen)
- `R` - Rectangle
- `C` - Circle  
- `L` - Line
- `A` - Arrow
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` - Redo
- `Escape` - Deselect
- `Delete/Backspace` - Delete selected element

## Contributing

Want to add features? Fix bugs? Make it better? Check out [CONTRIBUTING.md](CONTRIBUTING.md).

## Future Ideas

Some things that could be cool:
- Text tool with gesture typing
- Multi-user collaboration
- Export to SVG/PNG
- More gesture types (pinch to zoom with two fingers)
- Mobile support (why not)
- Custom gesture training
- Recording and playback
- 3D hand pose visualization

## Why?

Because mouse + keyboard is boring. Gestures are more fun. And it's a neat demo of what you can do with browser APIs and ML models.

Also because drawing in the air feels like magic.

## License

MIT - do whatever you want with it.

## Credits

Built with:
- [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands) by Google
- Canvas API
- Caffeine
- The belief that interfaces should be more intuitive

---

*Made with ✋ instead of 🖱️*

