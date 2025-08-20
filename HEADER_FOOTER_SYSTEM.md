# LAIKA PWA Header & Footer System

## Overview

The LAIKA PWA now features a unified narrow header and footer system that appears on every page, providing consistent navigation and real-time status information across the entire application.

## Components

### 1. Fixed Header (`css/header-footer.css` + `js/header-footer.js`)
- **Height**: 60px fixed at top of screen
- **Features**:
  - LAIKA branding with animated dog icon
  - Navigation menu with links to all major sections
  - Mobile-responsive hamburger menu
  - Active page highlighting
  - TRON-inspired cyberpunk styling

### 2. Fixed Footer (`css/header-footer.css` + `js/header-footer.js`)
- **Height**: 50px fixed at bottom of screen
- **Features**:
  - Real-time connection status with animated indicators
  - Battery level display with color-coded warnings
  - WiFi connection status
  - System health indicator
  - Current time display
  - Live status updates every 5 seconds

## Implementation

### Files Created
```
css/header-footer.css       # Shared styling for header/footer
js/header-footer.js         # JavaScript functionality
template.html               # Example implementation template
```

### Pages Updated
- `index.html` - Main homepage
- `chat.html` - Chat interface
- `dashboard.html` - Sensor dashboard
- `camera.html` - Camera view
- `control.html` - Robot control

## Usage

### Adding to New Pages

1. **Include CSS**: Add to `<head>` section:
```html
<link rel="stylesheet" href="css/header-footer.css">
```

2. **Include JavaScript**: Add before closing `</body>`:
```html
<script src="js/header-footer.js"></script>
```

3. **Adjust Page Content**: Add padding to avoid header/footer overlap:
```css
.your-main-content {
    padding-top: 70px;    /* Account for 60px header + margin */
    padding-bottom: 60px; /* Account for 50px footer + margin */
}
```

### Status Updates

The header/footer system listens for custom events to update status:

```javascript
// Connection status
window.dispatchEvent(new CustomEvent('laika-connection-changed', {
    detail: { status: 'connected', deviceName: 'LAIKA-Pro' }
}));

// Battery level
window.dispatchEvent(new CustomEvent('laika-battery-changed', {
    detail: { level: 85 }
}));

// WiFi status
window.dispatchEvent(new CustomEvent('laika-wifi-changed', {
    detail: { status: 'connected', ssid: 'MyNetwork' }
}));
```

Or use the direct methods:
```javascript
if (window.laikaHeaderFooter) {
    window.laikaHeaderFooter.showConnectionStatus('connected', 'LAIKA-Pro');
    window.laikaHeaderFooter.showBatteryLevel(85);
    window.laikaHeaderFooter.showWifiStatus('connected', 'MyNetwork');
    window.laikaHeaderFooter.showSystemMessage('online', 'All Systems OK');
}
```

## Features

### Navigation Menu
- **Home**: Main dashboard with feature cards
- **Chat**: Real-time AI conversation interface
- **Dashboard**: Live sensor monitoring and telemetry
- **Camera**: HD video stream with AI analysis
- **Control**: Direct robot control interface
- **Map**: SLAM mapping and navigation

### Status Indicators
- **Connection**: Shows LAIKA connection state with animated indicators
- **Battery**: Color-coded battery level (green/yellow/red with critical blinking)
- **WiFi**: Network connection status with SSID display
- **System**: Overall system health indicator
- **Time**: Real-time clock display

### Responsive Design
- **Desktop**: Full navigation menu visible
- **Mobile**: Collapsible hamburger menu
- **Tablet**: Adaptive layout with touch-friendly controls

## Styling

The header/footer uses the same TRON-inspired cyberpunk aesthetic as the rest of the LAIKA PWA:
- **Colors**: Atomic cyan (#00FFFF), electric blue, atomic orange
- **Fonts**: Orbitron (headers), Exo 2 (body text)
- **Effects**: Glowing borders, animated indicators, scan line animations
- **Background**: Semi-transparent with backdrop blur for modern glass effect

## Auto-Initialization

The header/footer system automatically initializes when the DOM loads. No manual setup required - just include the CSS and JavaScript files.

## Integration with Main App

The system integrates seamlessly with the existing LAIKA controller app (`js/app.js`) by:
- Listening for connection events from the main app
- Automatically updating status when LAIKA connects/disconnects
- Fetching real-time data from connected devices
- Providing navigation between all PWA features

## Browser Support

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

Requires modern CSS features:
- CSS Grid
- Flexbox
- CSS Custom Properties
- Backdrop Filter
- CSS Animations

## Performance

- Minimal overhead: ~10KB CSS + ~15KB JavaScript
- Efficient status updates using requestAnimationFrame
- Automatic cleanup on page unload
- Responsive design with CSS-only mobile menu toggle
