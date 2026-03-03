# Guardian Voice - AI-Powered Emergency Response System

Guardian Voice is a comprehensive women safety application that combines voice recognition, video/audio recording, real-time location tracking, and AI-powered emergency analysis to provide immediate assistance during emergencies.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Usage Guide](#usage-guide)
8. [API Endpoints](#api-endpoints)
9. [Data Models](#data-models)
10. [Components](#components)
11. [Offline Capabilities](#offline-capabilities)
12. [Security Considerations](#security-considerations)
13. [Future Enhancements](#future-enhancements)

---

## Project Overview

Guardian Voice is designed as a personal safety companion for women. It provides multiple ways to trigger emergency alerts:

- **Voice Activation**: Say "help me now" to automatically trigger an emergency
- **Manual SOS Button**: One-tap emergency button for immediate response
- **Evidence Capture**: Automatic recording of video and audio for proof
- **Real-time Location**: GPS tracking to pinpoint your exact location
- **Police Dashboard**: Real-time monitoring system for law enforcement

---

## Features

### User Features (Mobile App)

#### 1. Voice-Triggered Emergency
- Continuous background voice listening
- Activates on phrase "help me now"
- Records 10 seconds of audio after trigger
- Captures GPS location automatically

#### 2. Video & Audio Recording
- 30-second video recording capability
- Simultaneous audio capture
- Evidence stored locally and in cloud
- Auto-stop after 30 seconds

#### 3. Location Tracking
- Real-time GPS coordinates
- High accuracy mode enabled
- Google Maps integration
- Location saved with each emergency

#### 4. Offline Support
- 50MB local storage capacity
- Automatic sync when online
- Data preserved during network outages
- IndexedDB for persistent storage

#### 5. Media Library
- View all saved recordings
- Download recordings to device
- Gallery save functionality
- Organized by timestamp

### Police Dashboard Features

#### 1. Real-time Emergency Monitor
- Live map with emergency markers
- Color-coded priority levels
- Automatic refresh
- Active emergency count display

#### 2. Emergency Cards
- Detailed emergency information
- Video/audio playback
- Location with accuracy
- Device information
- AI analysis results

#### 3. Map Integration
- Interactive Leaflet maps
- Marker clustering by priority
- Click-to-view popup details
- Google Maps navigation link

#### 4. Emergency Management
- Mark as resolved
- Priority classification
- AI-generated analysis
- Historical data tracking

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14.2.0 (React 18.3.0)
- **Styling**: Tailwind CSS 3.4.0
- **Animations**: Framer Motion 11.2.0
- **Maps**: Leaflet 1.9.4 / React-Leaflet 4.2.1

### Backend & Services
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage
- **Authentication**: Firebase Auth
- **AI**: Google Gemini (Genkit)

### Utilities
- **UUID**: For unique identifiers
- **TypeScript**: Type safety
- **ESLint**: Code linting

---

## Project Structure

```
guardian-voice/
├── app/
│   ├── page.tsx                 # Main landing page
│   ├── layout.tsx               # Root layout
│   ├── globals.css              # Global styles
│   ├── dashboard/
│   │   └── page.tsx            # Police dashboard
│   └── api/
│       └── analyze/
│           └── route.ts        # AI analysis endpoint
├── components/
│   ├── MapView.tsx             # Interactive map component
│   ├── MediaCapture.tsx        # Video/audio capture
│   ├── VideoRecorder.tsx       # Video recording logic
│   ├── VoiceListener.tsx       # Voice activation
│   ├── EmergencyCard.tsx       # Emergency display card
│   ├── MediaLibrary.tsx        # Saved recordings
│   └── OfflineIndicator.tsx    # Network status
├── lib/
│   ├── ai.ts                   # AI analysis logic
│   ├── firebase.ts             # Firebase initialization
│   ├── firestore.ts            # Firestore operations
│   ├── storage.ts              # Firebase storage
│   ├── locationTracker.ts     # GPS tracking
│   ├── offlineStorage.ts       # IndexedDB storage
│   └── localStorage.ts         # Local recording storage
├── public/
├── .env.local                  # Environment variables
├── package.json                # Dependencies
├── next.config.js              # Next.js config
├── tailwind.config.js          # Tailwind config
├── tsconfig.json               # TypeScript config
└── README.md                   # This file
```

---

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase account
- Google AI API key

### Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd guardian-voice
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create `.env.local` with:
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google AI (Gemini) API
GOOGLE_GENAI_API_KEY=your_genai_key
```

4. **Run development server**
```bash
npm run dev
```

5. **Build for production**
```bash
npm run build
npm start
```

---

## Configuration

### Firebase Setup

1. Create a Firebase project at [firebase.google.com](https://firebase.google.com)
2. Enable Firestore and Storage
3. Create a collection named `emergencies`
4. Configure security rules for read/write

### Google AI Setup

1. Get API key from Google AI Studio
2. Enable Gemini API
3. Add key to environment variables

### Firestore Indexes

The application requires a compound index on the `emergencies` collection:
- Field: `status` (ascending)

---

## Usage Guide

### User Application

#### Starting Voice Protection
1. Open the application
2. Tap the shield/voice button
3. Grant microphone permissions
4. Say "help me now" in emergencies

#### Manual Emergency
1. Tap the large SOS button
2. Grant camera and microphone permissions
3. Recording starts automatically (30s max)
4. Review captured evidence
5. Tap "SEND EMERGENCY"

#### Viewing Recordings
1. Click "My Recordings" button
2. Browse saved media
3. Download or view details

### Police Dashboard

1. Navigate to `/dashboard`
2. View all active emergencies on map
3. Click markers for details
4. Play back audio/video evidence
5. Mark emergencies as resolved

---

## API Endpoints

### POST /api/analyze

AI-powered emergency priority analysis.

**Request Body:**
```json
{
  "emergencyId": "string",
  "transcript": "string"
}
```

**Response:**
```json
{
  "priority": "LOW" | "MEDIUM" | "HIGH",
  "reason": "string"
}
```

---

## Data Models

### Emergency (Firestore)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique document ID |
| status | string | "ACTIVE" or "RESOLVED" |
| createdAt | timestamp | Creation time |
| latitude | number | GPS latitude |
| longitude | number | GPS longitude |
| audioUrl | string | Firebase storage URL |
| videoUrl | string | Firebase storage URL |
| deviceInfo | string | User agent string |
| aiPriority | string | "LOW", "MEDIUM", "HIGH" |
| aiReason | string | AI analysis reason |
| locationAccuracy | number | GPS accuracy in meters |
| googleMapsUrl | string | Google Maps link |

### PendingUpload (Offline Storage)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| type | string | Upload type |
| data | string | JSON stringified data |
| timestamp | number | Unix timestamp |
| status | string | "pending", "completed" |
| retryCount | number | Upload attempts |
| location | object | GPS coordinates |

---

## Components

### MediaCapture.tsx
- Handles video/audio recording
- Manages location tracking
- Processes and uploads media
- Supports offline mode

### VoiceListener.tsx
- Web Speech API integration
- Continuous voice monitoring
- Trigger phrase detection
- Emergency processing

### MapView.tsx
- Leaflet map rendering
- Custom marker icons
- Priority-based coloring
- Popup information display

### EmergencyCard.tsx
- Emergency details display
- Media playback
- Resolution actions
- Priority styling

### VideoRecorder.tsx
- MediaRecorder API
- Video blob handling
- Recording lifecycle

### MediaLibrary.tsx
- Local storage browsing
- Recording management
- Download functionality

---

## Offline Capabilities

The application implements comprehensive offline support:

1. **IndexedDB Storage**: Uses `idb` pattern for persistent storage
2. **Auto-Sync**: Automatically uploads when network restored
3. **Local Recording**: Media saved to device storage
4. **Queue System**: Pending uploads tracked with retry logic

### Offline Flow
1. User triggers emergency while offline
2. Media saved to IndexedDB
3. Location captured and stored
4. When online, automatic sync initiates
5. Firebase updated with all data

---

## Security Considerations

1. **Permission Handling**: Graceful degradation when permissions denied
2. **Data Privacy**: Local data encrypted on device
3. **API Security**: Environment variables for all secrets
4. **CORS**: Firebase rules restrict unauthorized access
5. **Input Sanitization**: Transcript processed before storage

---

## Future Enhancements

### Planned Features
- [ ] Push notification integration
- [ ] SMS emergency alerts
- [ ] Emergency contact management
- [ ] Panic button hardware integration
- [ ] Multi-language support
- [ ] End-to-end encryption
- [ ] Battery optimization mode
- [ ] Background service workers

### Potential Improvements
- AI video analysis
- Real-time streaming to dashboard
- Community safety ratings
- Incident reporting system
- Integration with emergency services API

---

## License

This project is for educational and demonstration purposes.

---

## Credits

- Built with Next.js & React
- Firebase for backend services
- Google Gemini for AI analysis
- Leaflet for maps
- Framer Motion for animations
