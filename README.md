# Fix-It — AI DIY Live Assistant

A next-generation real-time AI agent that helps you fix things by **seeing** through your camera and **talking** with you naturally. Point your webcam at a broken appliance, tangled wires, or confusing furniture instructions — and get step-by-step guidance through a live voice conversation.

Built for the **Gemini API Developer Challenge** (Category: **Live Agents**)

## Features

- **Real-Time Vision:** Streams live video frames to Gemini so the AI can see exactly what you see.
- **Natural Voice Conversation:** Uses the Gemini Live API for fluid, real-time spoken dialogue.
- **Interrupt Anytime:** The Live API supports voice activity detection — interrupt the AI mid-sentence and it adapts instantly.
- **Text Input:** Can also type messages if you prefer text-based interaction.
- **Live Transcript:** All conversation is logged in a real-time transcript panel.
- **Google Cloud Ready:** Dockerized and deployable to Cloud Run with a single script.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 |
| **Backend** | Node.js, custom HTTP + WebSocket server |
| **AI Model** | `gemini-2.5-flash-native-audio-latest` (Gemini Live API) |
| **SDK** | `@google/genai` (Google Gen AI SDK) |
| **Cloud** | Google Cloud Run, Cloud Build |

## Architecture

```
Browser (Next.js)                    Server (Node.js)                 Google Cloud
┌─────────────────┐    WebSocket    ┌──────────────────┐   WebSocket   ┌─────────────┐
│  Webcam + Mic   │───────────────▶│  Custom Server   │─────────────▶│  Gemini     │
│  (MediaStream)  │                │  (HTTP + WS)     │              │  Live API   │
│                 │◀───────────────│                  │◀─────────────│             │
│  Audio Playback │    JSON/PCM    │  Proxy + Next.js │   Audio/Text │             │
└─────────────────┘                └──────────────────┘              └─────────────┘
                                          │
                                          │ Deployed on
                                          ▼
                                   Google Cloud Run
```

## Local Setup

### Prerequisites
- Node.js 20+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Steps

1. **Clone the repository:**
   ```bash
   git clone <YOUR_REPO_URL>
   cd gemini_challenge_devpost
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure your API key:**
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open the app:**
   Navigate to [http://localhost:8080](http://localhost:8080), click **Start Live Session**, allow camera/mic permissions, and start talking.

## Google Cloud Deployment

This project includes automated deployment via `deploy.sh`:

```bash
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Enable Cloud Run, Cloud Build, and Container Registry APIs
2. Build the Docker image via Cloud Build
3. Deploy to Cloud Run with public access on port 8080

After deployment, add your API key as a secret:
```bash
gcloud run services update fixit-live-agent \
  --set-env-vars="GEMINI_API_KEY=your_key_here" \
  --region=us-central1
```

## Project Structure

```
├── server/
│   └── index.ts          # Custom HTTP + WebSocket server (Gemini Live proxy)
├── src/
│   ├── app/
│   │   ├── layout.tsx     # Root layout with metadata
│   │   ├── page.tsx       # Main page
│   │   └── globals.css    # Global styles
│   └── components/
│       └── LiveAgent.tsx   # Core component (video, audio, transcript, text input)
├── Dockerfile             # Production container
├── deploy.sh              # Automated Cloud Run deployment
└── .env.example           # Environment variable template
```
