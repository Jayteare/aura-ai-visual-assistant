import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import next from 'next';
import { GoogleGenAI, Modality } from '@google/genai';
import { parse } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const port = parseInt(process.env.PORT || '8080', 10);

if (!process.env.GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is missing in environment variables.");
}

const LIVE_MODEL = "gemini-2.5-flash-native-audio-latest";

const SYSTEM_INSTRUCTION =
    "You are Fix-It, a friendly and knowledgeable DIY repair assistant. " +
    "The user is showing you a live camera feed of something they need help with. " +
    "Observe the video carefully and provide clear, step-by-step guidance. " +
    "Be concise but thorough. If you can identify the specific model or brand of what " +
    "you're looking at, mention it. If you can't see clearly, ask the user to adjust " +
    "the camera angle.";

nextApp.prepare().then(() => {
    const server = http.createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const { pathname } = parse(request.url!);

        if (pathname === '/api/stream') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        }
    });

    wss.on('connection', async (clientWs) => {
        console.log("Client connected to WebSocket");
        let session: any = null;
        let closed = false;

        const safeClose = () => {
            if (closed) return;
            closed = true;
            try { session?.close(); } catch (_) {}
            try {
                if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
                    clientWs.close(1000);
                }
            } catch (_) {}
        };

        const safeSend = (data: string) => {
            try {
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(data);
                }
            } catch (_) {}
        };

        clientWs.on('error', (err) => {
            console.warn("Client WebSocket error:", err.message);
            safeClose();
        });

        try {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error("No API key configured on server.");
            }
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            session = await ai.live.connect({
                model: LIVE_MODEL,
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Aoede",
                            }
                        }
                    },
                    systemInstruction: {
                        parts: [{ text: SYSTEM_INSTRUCTION }]
                    }
                },
                callbacks: {
                    onopen: () => {
                        console.log("Connected to Gemini Live API");
                        safeSend(JSON.stringify({ type: 'ready' }));
                    },
                    onmessage: (msg: any) => {
                        console.log("Gemini message received:", JSON.stringify(msg).substring(0, 200));
                        safeSend(JSON.stringify({ type: 'content', data: msg }));
                    },
                    onerror: (e: any) => {
                        console.error("Gemini session error:", JSON.stringify(e));
                        safeSend(JSON.stringify({ type: 'error', data: 'Gemini session error' }));
                    },
                    onclose: (e: any) => {
                        console.log("Gemini session closed. Event:", JSON.stringify(e));
                        safeSend(JSON.stringify({ type: 'closed' }));
                        safeClose();
                    }
                }
            });

            // Send audio: { audio: { data, mimeType } }
            // Send video: { video: { data, mimeType } }
            clientWs.on('message', async (msg) => {
                if (closed || !session) return;
                try {
                    const parsed = JSON.parse(msg.toString());
                    if (parsed.type === 'realtimeInput') {
                        for (const chunk of parsed.mediaChunks) {
                            if (chunk.mimeType.startsWith('audio/')) {
                                session.sendRealtimeInput({
                                    audio: { data: chunk.data, mimeType: chunk.mimeType }
                                });
                            } else if (chunk.mimeType.startsWith('image/')) {
                                session.sendRealtimeInput({
                                    video: { data: chunk.data, mimeType: chunk.mimeType }
                                });
                            }
                        }
                    } else if (parsed.type === 'text') {
                        session.sendClientContent({
                            turns: parsed.text,
                            turnComplete: true
                        });
                    }
                } catch (e: any) {
                    console.error("Error processing client message:", e.message);
                }
            });

            clientWs.on('close', () => {
                console.log("Client disconnected");
                safeClose();
            });

        } catch (error: any) {
            console.error("Failed to initialize Gemini session:", error.message);
            safeSend(JSON.stringify({ type: 'error', data: error.message || 'Failed to connect to AI server.' }));
            safeClose();
        }
    });

    server.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
