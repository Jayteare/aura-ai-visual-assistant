# Aura — AI Visual Assistant

A next-generation real-time AI assistant that can **see** through your camera and **talk** with you naturally. Select a mode, point your webcam at anything, and have a live voice conversation with an AI that adapts to your context.

Built for the **Gemini API Developer Challenge** (Category: **Live Agents**)

## Modes

| Mode | What it does |
|---|---|
| **General** | Open-ended assistant — ask about anything you show it |
| **Fix-It** | DIY repair guidance for appliances, wiring, plumbing, and more |
| **Game Coach** | Real-time tips and strategies while you play video games |
| **Explorer** | Describes surroundings, translates signs, identifies landmarks |
| **Study Buddy** | Explains homework, textbook pages, diagrams, and equations |

## Features

- **Real-Time Vision:** Streams live video frames to Gemini so the AI sees what you see
- **Natural Voice Conversation:** Fluid, real-time spoken dialogue via Gemini Live API
- **Interrupt Anytime:** Voice activity detection lets you cut the AI off mid-sentence
- **Text Input:** Type messages when you prefer text-based interaction
- **Mode Selection:** Switch context with a single click before each session
- **Live Transcript:** All conversation logged in a scrollable, color-coded panel
- **Google Cloud Ready:** Dockerized and deployable to Cloud Run with a single script

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 |
| **Backend** | Node.js, custom HTTP + WebSocket server |
| **AI Model** | `gemini-2.5-flash-native-audio-latest` (Gemini Live API) |
| **SDK** | `@google/genai` (Google Gen AI SDK) |
| **Cloud** | Google Cloud Run, Cloud Build |

## Architecture

See `public/architecture-diagram.png` for the full visual diagram.

```
Browser                          Node.js Server                    Google Cloud
┌──────────────┐   WebSocket    ┌──────────────────┐  WebSocket   ┌──────────────┐
│ Webcam + Mic │──────────────▶│ HTTP + WS Server │────────────▶│ Gemini 2.5   │
│ Mode Select  │               │ Session Manager  │             │ Flash Live   │
│ Text Input   │◀──────────────│ Media Proxy      │◀────────────│ Native Audio │
│ Audio Player │  JSON / PCM   │                  │  Audio/Text │              │
└──────────────┘               └──────────────────┘             └──────────────┘
                                       │
                                  Cloud Run
```

## Local Setup

### Prerequisites
- Node.js 20+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Steps

```bash
git clone <YOUR_REPO_URL>
cd gemini_challenge_devpost
npm install
cp .env.example .env   # Add your GEMINI_API_KEY
npm run dev
```

Open [http://localhost:8080](http://localhost:8080), select a mode, click **Start Live Session**, and start talking.

## Google Cloud Deployment

```bash
chmod +x deploy.sh
./deploy.sh
```

Then add your API key:
```bash
gcloud run services update fixit-live-agent \
  --set-env-vars="GEMINI_API_KEY=your_key_here" \
  --region=us-central1
```

## Project Structure

```
├── server/
│   └── index.ts           # Custom HTTP + WebSocket server with mode-aware system instructions
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout with metadata
│   │   ├── page.tsx        # Main page
│   │   └── globals.css     # Global styles (dark theme)
│   ├── components/
│   │   └── LiveAgent.tsx   # Core component (video, audio, transcript, modes, text input)
│   └── lib/
│       └── modes.ts        # Mode definitions and system instructions
├── public/
│   └── architecture-diagram.png
├── Dockerfile              # Production container
├── deploy.sh               # Automated Cloud Run deployment
├── DEVPOST.md              # Devpost submission text (copy-paste ready)
└── .env.example            # Environment variable template
```
