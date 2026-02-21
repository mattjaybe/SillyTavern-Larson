# 🌈 SillyTavern Larson

**A visually stunning animated status bar for SillyTavern that brings your AI interactions to life.**

Larson transforms the standard SillyTavern experience with smooth, customizable animations that respond to your AI's activity state. Whether your AI is generating a response, thinking through a complex problem, or idling between messages, Larson provides beautiful visual feedback with 8 unique animation styles and extensive customization options.

---

## ✨ Features

### 🎨 **8 Unique Animation Styles**
Choose from a diverse collection of professionally crafted animations, each designed to provide clear visual feedback while maintaining aesthetic appeal:

- **Gradient** - Smooth color transitions that flow across the bar
- **Breathe** - Gentle pulsing glow effect
- **Pulse** - Traveling wave that showcases your theme colors
- **Cylon** - Classic scanning beam effect (inspired by Battlestar Galactica)
- **Segment** - Animated segments with dynamic gaps
- **Glitch** - Digital corruption effect with rapid color shifts
- **Liquid** - Organic flowing blobs
- **Convergence** - Beams sliding from both sides to meet in the center

### 🎭 **Three Independent Animation States**
Configure different animations for each interaction state:

- **Generating** - Active animation while AI is responding
- **Thinking** - Distinct animation during reasoning/thinking phases (supports Claude, GPT-4, Gemini, GLM5, and more)
- **Idle** - Optional animation when waiting for input (can be disabled or hidden)

### ⚡ **Speed Controls**
Fine-tune animation speed for each state independently:
- Slow - Relaxed, contemplative pace
- Normal - Balanced speed for most use cases
- Fast - Energetic, responsive feel

### 🎨 **Extensive Theming**
**9 Built-in Themes:**
- SillyTavern (matches your ST theme)
- Default (Purple gradient)
- Ocean (Blue depths)
- Sunset (Warm oranges)
- Forest (Natural greens)
- Mono (Grayscale elegance)
- Synthwave (Retro-futuristic)
- Rose (Soft pinks)
- Metal (Gold, Silver, Copper)

**Custom Theme Creator:**
- 4-color gradient system (Background, Primary, Secondary, Accent)
- Live preview with real-time animation
- Advanced mode for precise color control
- Randomize button for instant inspiration
- Save unlimited custom themes

### 📐 **Flexible Display Options**
- **3 Bar Heights**: Compact, Default, Tall
- **Hide When Idle**: Option to make bar completely transparent when not in use
- **Mobile Optimized**: Full touch support with responsive layouts

### 🧠 **Smart Thinking Detection**
Automatically detects and responds to thinking/reasoning phases across multiple LLM providers:
- Supports `<thinking>`, `<think>`, `<reasoning>`, `<reason>`, `<thought>` tags
- Works with Claude, GPT-4, Gemini, GLM5, and other compatible models
- Seamlessly transitions between thinking and generating animations

### 🎯 **Professional UI**
- Compact settings panel that integrates seamlessly with SillyTavern
- Popup modal for quick access from the status bar
- Touch-friendly controls for mobile devices
- iOS-style toggle switches
- Organized layout with clear visual hierarchy

---

## 🎬 Animation Showcase

### Gradient
*Smooth flowing color transitions*

![Gradient Animation](./screenshots/gradient.gif)

---

### Breathe
*Gentle pulsing with varying intensity*

![Breathe Animation](./screenshots/breathe.gif)

---

### Pulse
*Traveling wave that displays all theme colors*

![Pulse Animation](./screenshots/pulse.gif)

---

### Cylon
*Classic scanning beam inspired by sci-fi*

![Cylon Animation](./screenshots/cylon.gif)

---

### Segment
*Dynamic segments with animated gaps*

![Segment Animation](./screenshots/segment.gif)

---

### Glitch
*Digital corruption with rapid color changes*

![Glitch Animation](./screenshots/glitch.gif)

---

### Liquid
*Organic flowing blob patterns*

![Liquid Animation](./screenshots/liquid.gif)

---

### Convergence
*Beams sliding inward from both sides*

![Convergence Animation](./screenshots/convergence.gif)

---

### Combined States Example
*Thinking (Cylon) → Generating (Gradient)*

![Combined Animation Example](./screenshots/combined-thinking-generating.gif)

---

## 📸 Interface Screenshots

### Settings Panel
*Compact settings integrated into SillyTavern's extension panel*

![Settings Panel](./screenshots/settings-panel.png)

---

### Quick Access Modal
*Popup modal accessible directly from the status bar*

![Quick Access Modal](./screenshots/modal.png)

---

### Custom Theme Editor
*Intuitive theme creator with live preview*

![Custom Theme Editor](./screenshots/theme-editor.png)

---

## 🚀 Installation

### Method 1: Install via SillyTavern Extension Installer (Recommended)

1. Open SillyTavern
2. Navigate to **Extensions** (puzzle piece icon)
3. Click **Install Extension**
4. Search for `Larson` or enter the repository URL:
   ```
   https://github.com/YOUR-USERNAME/SillyTavern-Larson
   ```
5. Click **Install**
6. Refresh the page

### Method 2: Manual Installation

1. Navigate to your SillyTavern installation folder
2. Open the `public/scripts/extensions/third-party` directory
3. Clone this repository:
   ```bash
   git clone https://github.com/YOUR-USERNAME/SillyTavern-Larson.git
   ```
4. Refresh SillyTavern

---

## 🎮 Quick Start Guide

### Basic Setup

1. After installation, find the **Larson** section in your Extensions panel
2. Toggle **Enable Larson** to activate the status bar
3. Choose your preferred **Animation Style** (default: Gradient)
4. Select an **Animation Speed** (default: Normal)
5. Pick a **Theme** from the dropdown

**That's it!** You're ready to go with sensible defaults.

### Customizing States

**To configure Idle animations:**
1. Enable the **Idle** toggle
2. Choose your preferred idle animation style
3. Set the idle animation speed
4. Optionally, enable **Hide When Idle** to make the bar transparent when not active

**To configure Thinking animations:**
1. Enable the **Thinking** toggle
2. Choose your preferred thinking animation style  
3. Set the thinking animation speed
4. ⚠️ **Note**: Thinking detection only works with streaming enabled

### Creating Custom Themes

1. Scroll to the **Custom Themes** section
2. Click **Add custom theme**
3. Enter a theme name
4. Adjust the 4 color sliders:
   - **Background** - Base color (usually dark)
   - **Primary** - Main accent color
   - **Secondary** - Complementary accent
   - **Accent** - Additional highlight color
5. Watch the live preview update in real-time
6. Click **Save** when satisfied
7. Toggle **Advanced Mode** for precise hex color input

### Tips & Tricks

- 💡 **Combination Tip**: Try pairing **Cylon** for Thinking with **Gradient** for Generating
- 🎨 **Theme Tip**: Use the Randomize button in the theme editor for inspiration
- 📱 **Mobile Tip**: Tap the bar itself to quickly access settings
- ⚡ **Performance Tip**: Use Compact height for minimal visual footprint
- 🖼️ **UI Tip**: Enable "Hide When Idle" for a cleaner interface when not chatting

---

## 🛠️ Configuration

All settings are saved automatically and persist across sessions.

### Settings Reference

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| **Enable Larson** | On/Off | On | Master toggle for the extension |
| **Bar Height** | Compact, Default, Tall | Default | Visual size of the status bar |
| **Generating Animation** | 8 styles | Gradient | Animation during AI response |
| **Generating Speed** | Slow, Normal, Fast | Normal | Speed of generating animation |
| **Idle Toggle** | On/Off | Off | Enable idle state animation |
| **Idle Animation** | 8 styles | Breathe | Animation when waiting |
| **Idle Speed** | Slow, Normal, Fast | Normal | Speed of idle animation |
| **Thinking Toggle** | On/Off | Off | Enable thinking state animation |
| **Thinking Animation** | 8 styles | Gradient | Animation during reasoning |
| **Thinking Speed** | Slow, Normal, Fast | Normal | Speed of thinking animation |
| **Theme** | 9 built-in + custom | SillyTavern | Color scheme |
| **Hide When Idle** | On/Off | Off | Make bar transparent when idle |

---

## 🔧 Technical Details

### Browser Compatibility
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

### Performance
- Optimized CSS animations using GPU acceleration
- Minimal JavaScript overhead
- No impact on AI generation speed
- Efficient DOM manipulation

### Cross-LLM Support
Thinking detection works with any LLM that outputs thinking tags in streaming mode:
- Claude (Anthropic) - `<thinking>`
- GPT-4 (OpenAI) - `<thinking>`
- Gemini (Google) - Native event + `<thinking>`
- GLM5 (Zhipu AI) - `<think>`
- Any model using `<reasoning>`, `<reason>`, or `<thought>` tags

---

## 🐛 Troubleshooting

### Bar not appearing
- Ensure **Enable Larson** toggle is ON
- Check that you're in a chat (not on the settings page)
- Try refreshing the page
- Verify the extension is properly installed in `public/scripts/extensions/third-party/`

### Thinking animation not working
- Verify **Thinking** toggle is enabled
- Ensure you're using **Streaming** mode (not Instruct/Complete)
- Check that your LLM outputs thinking tags
- Look for the warning message: "Note: Only functions with Streaming presets"

### Animations feel choppy
- Try a different animation style
- Reduce animation speed to Slow
- Check browser performance (close unnecessary tabs)
- Update your browser to the latest version

### Custom theme not saving
- Ensure theme name is not empty
- Check browser console for errors
- Try a different theme name
- Verify localStorage is enabled in your browser

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

- 🐛 **Report bugs** - Open an issue with reproduction steps
- 💡 **Suggest features** - Share your ideas in discussions
- 🎨 **Create themes** - Share your custom color schemes
- 📝 **Improve docs** - Help clarify instructions
- 🧪 **Test** - Try it with different LLMs and report results

### Development Setup

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/SillyTavern-Larson.git
cd SillyTavern-Larson

# Make your changes to:
# - index.js (main logic)
# - style.css (animations & styling)
# - settings.html (UI structure)

# Test in SillyTavern
# (refresh page after changes)
```

---

## 📋 Roadmap

Future enhancements being considered:

- [ ] Additional animation styles (suggestions welcome!)
- [ ] Animation intensity controls
- [ ] Per-character animation settings
- [ ] Export/import theme collections
- [ ] Animation preview mode
- [ ] Sound effect integration
- [ ] Accessibility options (reduced motion)

---

## 💖 Credits

**Inspired by:**
- The iconic Cylon eye scanner from Battlestar Galactica
- Classic sci-fi UI aesthetics
- The SillyTavern community's love for customization

**Built with:**
- Vanilla JavaScript (no dependencies!)
- CSS3 animations with GPU acceleration
- Modern web standards

---

## 📜 License

MIT License - feel free to use, modify, and distribute.

---

## 🙏 Acknowledgments

Special thanks to:
- The SillyTavern team for creating an amazing platform
- All beta testers who provided valuable feedback
- The community for feature suggestions and bug reports

---

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/YOUR-USERNAME/SillyTavern-Larson/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/YOUR-USERNAME/SillyTavern-Larson/discussions)
- 📖 **Documentation**: [Wiki](https://github.com/YOUR-USERNAME/SillyTavern-Larson/wiki)

---

<div align="center">

**If you enjoy this extension, consider ⭐ starring the repository!**

Made with ❤️ for the SillyTavern community

</div>
