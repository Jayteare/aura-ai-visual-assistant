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

const SYSTEM_INSTRUCTIONS: Record<string, string> = {
    general:
        "You are Aura, a friendly and intelligent AI visual assistant. " +
        "The user is showing you a live camera feed. Observe carefully and help them with whatever they need. " +
        "Be conversational, concise, and helpful. Describe what you see when relevant. " +
        "If you can't see something clearly, ask the user to adjust the camera.",

    fixit:
        "You are Aura in Fix-It mode — a knowledgeable DIY repair assistant. " +
        "The user is showing you a live camera feed of something they need help fixing. " +
        "Observe the video carefully and provide clear, step-by-step repair guidance. " +
        "If you can identify the specific model or brand, mention it. " +
        "Warn about safety hazards (electricity, sharp edges, etc.) when relevant. " +
        "If you can't see clearly, ask the user to adjust the camera angle.",

    gaming:
        "You are Aura in Game Coach mode — an expert gaming advisor. " +
        "The user is showing you their live gameplay or game screen. " +
        "Provide real-time tips, strategy suggestions, and observations about what you see. " +
        "If you recognize the game, tailor your advice to that specific game's mechanics. " +
        "Be encouraging but honest. Point out opportunities and mistakes alike. " +
        "Keep your responses quick and snappy so you don't distract from gameplay.",

    explorer:
        "You are Aura in Explorer mode — a real-time visual guide for the world around the user. " +
        "The user may be walking down a street, visiting a new place, or exploring outdoors. " +
        "Describe interesting things you see in the camera feed. " +
        "If you see text in a foreign language, translate it. " +
        "If you see landmarks, identify them and share a brief fun fact. " +
        "If the user asks for directions or navigation help, do your best based on visual context. " +
        "Be enthusiastic and curious — make exploration fun.",

    study:
        "You are Aura in Study Buddy mode — a patient and clear educational tutor. " +
        "The user is showing you homework, textbook pages, diagrams, or equations on camera. " +
        "Read what you see and explain concepts step by step. " +
        "Don't just give answers — help the user understand the underlying reasoning. " +
        "If you see a math problem, walk through the solution. " +
        "If you see a diagram, explain what each part represents. " +
        "Adapt your explanation level to what the user seems to need.",
};

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

    wss.on('connection', async (clientWs, request) => {
        const { query } = parse(request.url!, true);
        const mode = (query.mode as string) || 'general';
        const systemInstruction = SYSTEM_INSTRUCTIONS[mode] || SYSTEM_INSTRUCTIONS.general;

        console.log(`Client connected [mode: ${mode}]`);
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
                if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
            } catch (_) {}
        };

        clientWs.on('error', (err) => {
            console.warn("Client WebSocket error:", err.message);
            safeClose();
        });

        try {
            if (!process.env.GEMINI_API_KEY) throw new Error("No API key configured on server.");
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            session = await ai.live.connect({
                model: LIVE_MODEL,
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: "Aoede" }
                        }
                    },
                    systemInstruction: {
                        parts: [{ text: systemInstruction }]
                    }
                },
                callbacks: {
                    onopen: () => {
                        console.log(`Gemini Live connected [mode: ${mode}]`);
                        safeSend(JSON.stringify({ type: 'ready' }));
                    },
                    onmessage: (msg: any) => {
                        safeSend(JSON.stringify({ type: 'content', data: msg }));
                    },
                    onerror: (e: any) => {
                        console.error("Gemini session error:", e?.message || e);
                        safeSend(JSON.stringify({ type: 'error', data: 'Gemini session error' }));
                    },
                    onclose: (_e: any) => {
                        console.log("Gemini session closed");
                        safeSend(JSON.stringify({ type: 'closed' }));
                        safeClose();
                    }
                }
            });

            clientWs.on('message', async (msg) => {
                if (closed || !session) return;
                try {
                    const parsed = JSON.parse(msg.toString());
                    if (parsed.type === 'realtimeInput') {
                        for (const chunk of parsed.mediaChunks) {
                            if (chunk.mimeType.startsWith('audio/')) {
                                session.sendRealtimeInput({ audio: { data: chunk.data, mimeType: chunk.mimeType } });
                            } else if (chunk.mimeType.startsWith('image/')) {
                                session.sendRealtimeInput({ video: { data: chunk.data, mimeType: chunk.mimeType } });
                            }
                        }
                    } else if (parsed.type === 'text') {
                        session.sendClientContent({ turns: parsed.text, turnComplete: true });
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
        console.log(`> Aura ready on http://localhost:${port}`);
    });
});
