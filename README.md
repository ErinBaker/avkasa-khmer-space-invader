# Avkasa Khmer Zero Space

> **អវកាសខ្មែរ** - A Chrome extension that detects and processes zero-width spaces to improve Khmer text readability for language learners.

![Extension Status](https://img.shields.io/badge/status-active-brightgreen)
![Chrome Extension](https://img.shields.io/badge/platform-Chrome-blue)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🌟 Overview

**Avkasa Khmer Zero Space** is a Chrome extension designed to improve the reading and interaction experience with Khmer text on the web. It automatically detects zero-width space characters (U+200B) that can cause problems with text selection, copying, searching, and line breaking, and provides options to either replace them with regular spaces or remove them entirely.

### Problem It Solves

Zero-width spaces in Khmer text can cause:
- Improper text selection and copying
- Failed text searches 
- Broken line wrapping and formatting
- Difficulty for language learners to interact with text

## ✨ Features

### Core Functionality
- **Automatic Detection**: Scans all text content for zero-width space characters
- **Flexible Processing**: Choose to inject regular spaces or remove zero-width spaces entirely
- **Real-time Updates**: Processes dynamically loaded content using MutationObserver
- **Performance Optimized**: Uses TreeWalker for efficient DOM traversal with minimal impact

### User Controls
- **Extension Toggle**: Enable/disable the extension completely
- **Auto-run Control**: Toggle automatic processing on page load
- **Processing Mode**: Switch between "inject spaces" and "remove spaces" modes
- **Visual Feedback**: Badge counter shows number of spaces processed
- **Manual Processing**: Option to manually trigger processing

### Smart Processing
- **Reversible Operations**: Tracks original text to allow switching between processing modes
- **Protected Elements**: Skips processing in `<script>`, `<style>`, `<code>`, `<pre>`, and editable elements
- **Error Handling**: Comprehensive validation and error logging
- **Debounced Updates**: Prevents excessive processing during rapid content changes

## 🚀 Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Development)
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension will appear in your extensions list

## 📖 Usage

### Getting Started
1. Click the extension icon in your Chrome toolbar
2. The popup will show the current status and controls
3. By default, the extension is enabled with auto-run activated

### Understanding the Interface

#### Status Section
- **Active Indicator**: Cyan pulsing dot shows extension is running
- **Space Counter**: Displays "Spaces fixed: X" for current page

#### Settings Controls

**Enable Extension**
- Master switch to turn the extension on/off
- When disabled, no processing occurs and other controls are greyed out

**Auto-run on page load**
- Controls whether spaces are processed automatically when pages load
- When OFF: Extension only processes spaces when manually triggered
- When ON: Automatically processes all pages as they load

**Inject spaces (vs remove)**
- Controls how zero-width spaces are handled:
  - **ON (Inject)**: Replaces zero-width spaces with regular spaces (U+0020)
  - **OFF (Remove)**: Removes zero-width spaces entirely
- Can be toggled to switch between modes on the current page

### Usage Scenarios

**For Language Learners**
- Keep auto-run enabled and injection mode on for easier text selection and copying
- Use when reading Khmer news sites, social media, or educational content

**For Content Analysis**
- Toggle to removal mode to see the original text structure
- Use manual processing to analyze specific sections

**For Development/Testing**
- Disable auto-run to control when processing occurs
- Switch between inject/remove modes to compare text behavior

## 🔧 Technical Details

### Architecture
```
Avkasa Khmer Zero Space/
├── manifest.json          # Extension configuration
├── service-worker.js      # Background script and settings management  
├── content-script.js      # DOM processing and text manipulation
├── popup.html            # Extension popup interface
├── popup.js              # Popup logic and communication
├── popup.css             # Cosmic-themed styling
└── icon.png              # Extension icon
```

### Key Components

**Service Worker** (`service-worker.js`)
- Manages extension settings and storage
- Handles communication between components
- Updates badge counter with processing results
- Validates all incoming messages for security

**Content Script** (`content-script.js`)
- Performs actual text processing using TreeWalker
- Implements MutationObserver for dynamic content
- Tracks modified nodes for reversible operations
- Includes comprehensive error handling and validation

**Popup Interface** (`popup.js`, `popup.html`, `popup.css`)
- Provides user controls and status display
- Features cosmic/space-themed design
- Real-time settings synchronization
- Accessible keyboard navigation

### Processing Algorithm

1. **Initial Scan**: On page load (if auto-run enabled)
   - Create TreeWalker to traverse all text nodes
   - Skip protected elements (scripts, styles, code blocks)
   - Identify nodes containing zero-width spaces

2. **Text Processing**: For each node with zero-width spaces
   - Store original content for reversibility
   - Apply selected processing mode (inject/remove)
   - Update DOM with processed text
   - Track changes for future toggles

3. **Dynamic Monitoring**: MutationObserver watches for
   - New content added to page
   - Text modifications
   - Debounced processing to avoid performance issues

### Settings Storage
```javascript
{
  enabled: true,           // Extension on/off
  autoRun: true,          // Auto-process on page load  
  injectSpaces: true      // Inject spaces vs remove
}
```

### Permissions Used
- `activeTab`: Access current tab for processing
- `scripting`: Inject content script into pages
- `storage`: Persist user settings
- `webNavigation`: Monitor page navigation for cleanup

## 🛡️ Privacy & Security

### Privacy Protection
- **No Data Collection**: Extension does not collect or transmit any user data
- **Local Processing**: All text processing happens locally in the browser
- **No Network Requests**: Extension operates entirely offline
- **Minimal Permissions**: Only requests essential Chrome extension permissions

### Security Measures
- **Input Validation**: All messages and settings are validated
- **Sender Verification**: Messages are verified to come from extension context
- **Content Isolation**: Processing isolated from page scripts
- **Error Boundaries**: Comprehensive error handling prevents crashes

## 🎨 Design Philosophy

The extension features a **cosmic/space theme** reflecting the "space" concept in "zero-width space":
- Deep space color palette (navy, cyan, cosmic purple)
- Animated status indicators with pulsing effects
- Clean, minimal interface focused on functionality
- High contrast for accessibility

## 🔧 Development

### Project Structure
The extension follows Chrome Extension Manifest V3 architecture:
- Service worker handles background tasks and settings
- Content script performs DOM manipulation
- Popup provides user interface
- Local storage for settings persistence

### Performance Optimizations
- TreeWalker for efficient DOM traversal
- Debounced mutation observer (100ms delay)
- WeakMap for node tracking to prevent memory leaks
- Conditional processing based on content changes

### Error Handling
- Try-catch blocks around all major operations
- Chrome runtime error checking
- Graceful degradation when APIs unavailable
- Detailed logging for debugging

## 🤝 Contributing

### Bug Reports
If you encounter issues:
1. Check the browser console for error messages
2. Note the specific website and content where issues occur
3. Include your Chrome version and extension version
4. Create an issue with detailed reproduction steps

### Feature Requests
Suggestions for improvements are welcome! Consider:
- User experience enhancements
- Additional text processing options
- Performance improvements
- Accessibility features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this software for any purpose, including commercial applications. Attribution is appreciated but not required.

## 🙏 Acknowledgments

- Made with ❤️ in Phnom Penh, Cambodia
- Created to improve Khmer text accessibility for language learners
- Inspired by the need for better digital Khmer text processing tools

---

**Author**: Erin Baker
**Version**: 1.0.0  
**Compatibility**: Chrome 88+ (Manifest V3)