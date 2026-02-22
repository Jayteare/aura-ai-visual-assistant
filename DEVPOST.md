# Aura — Devpost Submission

> Copy-paste the sections below into your Devpost submission form.

---

## Inspiration

We've all been there: staring at a mess of wires behind a thermostat, stuck on a boss fight in a video game, squinting at a menu in a foreign language, or trying to understand a complex diagram in a textbook. In each case, the answer would be obvious — if only you had an expert looking over your shoulder.

What if you could just *show* the problem to an AI and have a real-time conversation about it? Not a chatbot you type to. An assistant that sees what you see, hears what you say, and responds instantly with its voice.

## What It Does

**Aura** is a real-time AI visual assistant powered by the Gemini Live API. It connects to your webcam and microphone, streams what you see and hear to Gemini, and carries a natural voice conversation with you — adapting to whatever context you need:

- **General** — Open-ended visual Q&A about anything on camera
- **Fix-It** — Step-by-step DIY repair guidance for appliances, wiring, plumbing
- **Game Coach** — Real-time tips while watching your gameplay
- **Explorer** — Describes surroundings, translates foreign text, identifies landmarks
- **Study Buddy** — Explains homework, diagrams, and equations shown on camera

Each mode tailors the AI's personality and expertise via a different system instruction, while the underlying real-time audio/video pipeline stays the same.

## How We Built It

**Frontend (Next.js + React + Tailwind CSS):**
The browser captures webcam video and microphone audio via the MediaStream API. Video frames are captured every 2 seconds as JPEG via a hidden canvas. Audio is streamed as continuous 16-bit PCM at 16kHz using AudioContext + ScriptProcessor. A mode selector lets users choose their context before connecting.

**Backend (Custom Node.js Server):**
A raw `http.createServer` with a `ws.WebSocketServer` in `noServer` mode. The server only intercepts WebSocket upgrades on `/api/stream?mode=<mode>`, letting Next.js handle all other traffic (including HMR). For each client, it establishes a Gemini Live session with the mode-specific system instruction and acts as a bidirectional proxy.

**AI Model (Gemini 2.5 Flash Native Audio):**
We use `gemini-2.5-flash-native-audio-latest` via the `@google/genai` SDK's `ai.live.connect()`. This model supports `bidiGenerateContent` — a WebSocket-based protocol for real-time bidirectional audio/video streaming with voice activity detection and interruption support.

**Audio Playback:**
Gemini returns raw 24kHz PCM audio. The frontend decodes base64 to ArrayBuffer, converts to Float32, creates AudioBuffers, and plays them through a sequential queue for smooth, gap-free output.

## Technologies Used

- **Google Gemini 2.5 Flash** (Native Audio, Live API)
- **Google GenAI SDK** (`@google/genai`)
- **Google Cloud Run** + **Cloud Build**
- **Next.js 16** + **React 19** + **Tailwind CSS 4**
- **Node.js 20** with raw HTTP + WebSocket server
- **ws library** for WebSocket handling

## Challenges We Ran Into

1. **Model discovery:** Only 3 out of 30+ Gemini models support the Live API's `bidiGenerateContent`. We had to programmatically call `ListModels` and test each to find `gemini-2.5-flash-native-audio-latest`.

2. **WebSocket conflicts:** Express-ws intercepted Next.js HMR WebSockets, causing cascading frame parsing errors. We rebuilt the server from scratch using raw `http.createServer` with `noServer` WebSocket handling.

3. **Non-standard close codes:** Gemini sends WebSocket close codes outside the RFC-allowed range, which the `ws` library rejects. We resolved this by carefully isolating our WebSocket handling.

4. **Browser audio pipeline:** Raw PCM audio from Gemini can't be played natively. We built a custom decode-and-queue pipeline using AudioContext and BufferSource nodes.

## Accomplishments We're Proud Of

- Sub-second latency between showing something and getting a spoken response
- Seamless interruption handling — cut the AI off mid-sentence and it adapts
- 5 distinct modes that showcase the versatility of a single multimodal pipeline
- Fully automated Cloud Run deployment via `deploy.sh`

## What We Learned

- The Gemini Live API is incredibly powerful but requires careful WebSocket management
- Native audio models need `Modality.AUDIO` — they refuse text-only response modes
- Real-time audio in the browser requires understanding PCM encoding, sample rates, and AudioContext scheduling
- A mode-based architecture makes a single AI pipeline feel like five different products

## What's Next for Aura

- **AR overlay mode** — Annotate the live feed with visual labels based on AI guidance
- **Session memory** — Remember context across sessions
- **Mobile app** — Optimized for phone cameras with a tap-to-talk interface
- **Custom modes** — Let users define their own system instructions
- **Multi-language** — Real-time translation mode for travelers
