# PawSafe - Glass Hazard Alert App

A Progressive Web App (PWA) that helps dog walkers report and avoid broken glass hazards in their neighbourhood. Built with Next.js, Google Maps, and Firebase.

## Overview

PawSafe allows users to:
- Report broken glass hazards with photos and descriptions
- View hazards on an interactive map
- Receive proximity alerts when approaching a reported hazard
- Confirm whether hazards are still present or cleared
- Access a council/admin view for hazard management

## Features

### Public Features

#### Interactive Map
- Google Maps integration with custom hazard markers
- Yellow warning triangle markers for active hazards
- Green markers for cleared hazards
- Marker clustering for areas with multiple reports
- Real-time location tracking with blue pulsing user marker
- Recentre button to return to user's location
- Map position persists across sessions (localStorage)

#### Report Submission
- Tap map to place a draggable pin at hazard location
- Optional photo attachment with automatic compression
- Description field for additional details
- Customise location mode for precise pin placement
- Swipe-to-dismiss report form

#### Hazard Confirmation System
- "Still There" button to confirm hazard is present
- "It's Cleared" button to mark hazard as resolved
- 3 confirmations required to mark a hazard as cleared
- 24-hour cooldown on "Still There" confirmations per device
- Device ID tracking prevents duplicate votes
- Confirmation counter displayed on each hazard

#### Proximity Alerts
- Real-time GPS tracking (~3 metre entry radius)
- Hysteresis buffer (~6 metre exit radius) prevents alert flicker
- Vibration alert when approaching hazard
- Browser notification support
- Toggle on/off via header menu
- Self-reported hazards suppressed for 10 minutes

### Admin/Council Features

Access via hamburger menu > "Council View"

#### List View
- All reports with status badges
- Photo thumbnails
- Date and description
- Quick action buttons:
  - **Cleared** - Mark hazard as resolved
  - **No Glass Found** - Mark as false positive
  - **Flag** - Flag for review

#### Map View
- Same interactive map as public view
- Admin-specific popup cards with action buttons
- Status indicators:
  - Red (Active Hazard)
  - Green (Cleared)
  - Purple (No Glass Found)
  - Amber (Flagged)

#### Filtering
- All Reports
- Active Only
- Cleared
- Flagged
- No Glass Found

#### Statistics Dashboard
- Total reports count
- Active hazards count
- Cleared count
- Flagged count
- No Glass Found count

### Technical Features

#### Offline Support
- IndexedDB local storage (Dexie.js)
- Works offline with local data
- Automatic sync when back online

#### Cloud Sync
- Firebase Realtime Database integration
- Real-time updates across devices
- Conflict resolution (newest wins)
- Background sync for pending changes

#### PWA Capabilities
- Installable on mobile devices
- Service worker for caching
- App-like experience
- Safe area support for notched devices

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **Animations**: Framer Motion
- **Maps**: Google Maps API (@react-google-maps/api)
- **Database**:
  - Local: Dexie.js (IndexedDB)
  - Cloud: Firebase Realtime Database
- **Notifications**: react-hot-toast
- **Icons**: Lucide React
- **Deployment**: Firebase Hosting

## Project Structure

```
glass-alert-app/
├── app/
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Main public page
│   ├── globals.css         # Global styles
│   └── admin/
│       └── page.tsx        # Council admin page
├── components/
│   ├── Map.tsx             # Google Maps with markers
│   ├── Header.tsx          # App header with menu
│   ├── ReportForm.tsx      # Hazard report form
│   ├── ProximityAlert.tsx  # Alert popup component
│   ├── WelcomeSplash.tsx   # First-visit welcome screen
│   ├── InstallPrompt.tsx   # PWA install prompt
│   └── ServiceWorkerRegistration.tsx
├── lib/
│   ├── db.ts               # Dexie database schema
│   ├── sync.ts             # Firebase sync logic
│   ├── useProximityAlerts.ts # Proximity detection hook
│   ├── utils.ts            # Helper functions
│   └── firebase-config.ts  # Firebase configuration
└── public/
    ├── icons/              # PWA icons
    ├── fonts/              # Custom fonts
    └── manifest.json       # PWA manifest
```

## Database Schema

### Report

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| lat | number | Latitude |
| lng | number | Longitude |
| desc | string | Description |
| photoBase64 | string? | Compressed photo data |
| photoUrl | string? | Firebase Storage URL |
| date | string | ISO date string |
| clearedCount | number | Confirmation count |
| resolved | boolean | Is hazard cleared |
| stillThereCount | number | Still-there confirmations |
| stillThereConfirmations | array | Device confirmations |
| clearedConfirmations | array | Cleared confirmations |
| syncStatus | string | 'synced' \| 'pending' \| 'conflict' |
| lastModified | number | Timestamp |
| archived | boolean | Is archived |
| flagged | boolean | Flagged for review |
| noGlassFound | boolean | False positive marker |

## Setup

### Prerequisites

- Node.js 18+
- Google Maps API key
- Firebase project

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd glass-alert-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Development

```bash
npm run dev
```

### Build & Deploy

```bash
# Build static export
npm run build

# Deploy to Firebase Hosting
firebase deploy
```

## Firebase Setup

### Realtime Database Rules

```json
{
  "rules": {
    "reports": {
      ".read": true,
      ".write": true
    }
  }
}
```

### Hosting Configuration

See `firebase.json` for hosting configuration including:
- Static file serving from `out/` directory
- Clean URLs
- Trailing slashes
- Cache headers for assets
- SPA fallback routing

## Usage

### Reporting a Hazard

1. Tap the **+** button at the bottom of the screen
2. Tap the map to place a pin (or use your current location)
3. Drag the pin to adjust the exact location
4. Add a description and optional photo
5. Submit the report

### Confirming Hazards

- Tap a hazard marker to view details
- Tap **"Still There"** if the hazard still exists
- Tap **"It's Cleared"** if the hazard has been removed
- After 3 "Cleared" confirmations, the hazard is marked as resolved

### Council Admin Access

1. Tap the hamburger menu in the header
2. Select "Council View"
3. Use List View or Map View to manage reports
4. Filter by status (Active, Cleared, Flagged, No Glass Found)
5. Take action on reports using the quick buttons

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

---

**MVP v1** - Built with Claude
