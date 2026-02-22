# Fix-It Live Agent — Devpost Submission

> Copy-paste the sections below into your Devpost submission form.

---

## Inspiration

We've all been there: staring at a mess of wires behind a thermostat, squinting at confusing IKEA instructions, or trying to figure out why that faucet won't stop dripping. You Google it, watch a 20-minute YouTube video, pause-play-pause, and still aren't sure if you're looking at the right thing. What if you could just *show* the problem to an AI and have a real-time conversation about it — like calling a friend who actually knows how to fix things?

## What It Does

**Fix-It** is a real-time AI assistant that can **see** what your camera sees and **talk** to you naturally about how to fix it. Point your webcam at a broken appliance, tangled wiring, or confusing furniture assembly, and Fix-It will:

- **Observe** your live video feed in real-time
- **Listen** to your questions via natural voice conversation
- **Respond** with spoken step-by-step guidance
- **Adapt** when you interrupt it or move the camera to show something new

It's like having an expert repair technician on a video call — except they never get tired, never judge you, and are available 24/7.

## How We Built It

**Frontend (Next.js + React + Tailwind CSS):**
The browser captures the user's webcam video and microphone audio using the MediaStream API. Video frames are captured every 2 seconds as JPEG images via a hidden canvas element. Audio is captured as continuous 16-bit PCM at 16kHz using an AudioContext and ScriptProcessor. Both streams are base64-encoded and sent over a WebSocket to the backend.

**Backend (Custom Node.js Server):**
We built a custom HTTP + WebSocket server (not Express) that serves the Next.js frontend and also handles WebSocket upgrade requests on `/api/stream`. For each client connection, the server establishes a separate Gemini Live API session via `ai.live.connect()` from the `@google/genai` SDK. The server acts as a bidirectional proxy — forwarding audio/video from the browser to Gemini, and streaming Gemini's audio responses back to the browser.

**AI Model (Gemini 2.5 Flash Native Audio):**
We use `gemini-2.5-flash-native-audio-latest` with the `bidiGenerateContent` Live API. This model natively understands interleaved audio and video input and generates spoken audio responses. It supports Voice Activity Detection (VAD), which means the user can interrupt the AI mid-sentence and it will stop and listen.

**Audio Playback:**
Gemini returns raw PCM audio at 24kHz. The frontend converts this to Float32 samples, creates AudioBuffers, and plays them sequentially through an AudioContext queue to ensure smooth, uninterrupted playback.

**Deployment:**
The entire application is containerized with Docker and deployable to Google Cloud Run via an automated `deploy.sh` script (infrastructure-as-code).

## Technologies Used

- **Google Gemini 2.5 Flash** (Native Audio Live API) — `gemini-2.5-flash-native-audio-latest`
- **Google GenAI SDK** (`@google/genai`) — `ai.live.connect()` for WebSocket-based Live API
- **Google Cloud Run** — serverless container hosting
- **Google Cloud Build** — automated Docker image builds
- **Next.js 16** — React framework for the frontend
- **React 19** — UI components
- **Tailwind CSS 4** — styling
- **Node.js 20** — custom WebSocket server runtime
- **WebSocket (ws library)** — real-time bidirectional communication

## Challenges We Ran Into

1. **Finding the right model:** The Gemini Live API is new, and documentation was sparse. We discovered that only 3 models (out of 30+) actually support `bidiGenerateContent`. We had to programmatically call `ListModels` and test each one to find `gemini-2.5-flash-native-audio-latest`.

2. **WebSocket close code conflicts:** The Gemini Live API sends non-standard WebSocket close codes that the Node.js `ws` library rejects. We initially tried Express + express-ws, but it intercepted Next.js's internal HMR WebSocket connections, causing cascading errors. We solved this by building a raw `http.createServer` with a `noServer` WebSocketServer that only handles our `/api/stream` endpoint.

3. **Audio playback in the browser:** Gemini returns raw PCM audio, which browsers can't play natively. We built a custom audio pipeline that converts base64 → ArrayBuffer → Float32 → AudioBuffer and plays chunks sequentially through a queue to avoid gaps.

## Accomplishments We're Proud Of

- The entire app works in real-time with sub-second latency between showing something on camera and getting a spoken response
- The interruption handling is seamless — you can cut the AI off mid-sentence and it immediately adapts
- We figured out the correct Gemini Live API model and configuration entirely through experimentation, since docs were limited
- The deployment is fully automated with a single `deploy.sh` script

## What We Learned

- The Gemini Live API is incredibly powerful but requires careful WebSocket management
- Native audio models behave very differently from text models — you need to think in terms of streams, not request/response
- Building real-time audio pipelines in the browser requires understanding PCM encoding, sample rates, and AudioContext scheduling
- Sometimes the best debugging tool is just calling `ListModels` and reading the close codes

## What's Next for Fix-It

- **AR overlay mode:** Annotate the live video feed with labels and arrows based on the AI's guidance
- **Session memory:** Save repair history so the AI remembers previous fixes
- **Multi-language support:** Real-time translation for non-English speakers
- **Mobile app:** A dedicated mobile experience optimized for phone cameras
- **Tool integration:** Let the AI look up part numbers, order replacement parts, or pull up relevant manuals
