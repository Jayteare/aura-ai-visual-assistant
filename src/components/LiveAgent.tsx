"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { MODES, type Mode } from "@/lib/modes";

interface Message {
  role: "system" | "agent" | "user" | "error";
  text: string;
}

// SVG icons as components to avoid emoji
function ModeIcon({ mode, className }: { mode: string; className?: string }) {
  const cn = className || "w-5 h-5";
  switch (mode) {
    case "sparkles":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
      );
    case "wrench":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.633 5.633a2.25 2.25 0 01-3.182-3.182l5.633-5.633m3.182 3.182L21.17 5.56a2.25 2.25 0 00-3.182-3.182L11.42 8.945m0 6.225a3 3 0 105.304-5.304" />
        </svg>
      );
    case "gamepad":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
        </svg>
      );
    case "compass":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      );
    case "book":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      );
    default:
      return null;
  }
}

const colorMap: Record<string, { ring: string; bg: string; text: string; selected: string }> = {
  violet: { ring: "ring-violet-500/50", bg: "bg-violet-500/10", text: "text-violet-400", selected: "bg-violet-600/20 ring-violet-500" },
  amber: { ring: "ring-amber-500/50", bg: "bg-amber-500/10", text: "text-amber-400", selected: "bg-amber-600/20 ring-amber-500" },
  emerald: { ring: "ring-emerald-500/50", bg: "bg-emerald-500/10", text: "text-emerald-400", selected: "bg-emerald-600/20 ring-emerald-500" },
  sky: { ring: "ring-sky-500/50", bg: "bg-sky-500/10", text: "text-sky-400", selected: "bg-sky-600/20 ring-sky-500" },
  rose: { ring: "ring-rose-500/50", bg: "bg-rose-500/10", text: "text-rose-400", selected: "bg-rose-600/20 ring-rose-500" },
};

export default function LiveAgent() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [selectedMode, setSelectedMode] = useState<Mode>(MODES[0]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const videoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const playbackCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (role: Message["role"], text: string) => {
    setMessages((prev) => [...prev, { role, text }]);
  };

  const floatTo16BitPCM = (input: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  const bufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const pcmToFloat32 = (pcmBuffer: ArrayBuffer): Float32Array => {
    const view = new DataView(pcmBuffer);
    const numSamples = pcmBuffer.byteLength / 2;
    const float32 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const int16 = view.getInt16(i * 2, true);
      float32[i] = int16 / 32768;
    }
    return float32;
  };

  const playNextChunk = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = playbackCtxRef.current;
    const chunk = audioQueueRef.current.shift()!;
    const float32 = pcmToFloat32(chunk);
    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      playNextChunk();
    };
    source.start();
  }, []);

  const enqueueAudio = useCallback(
    (base64: string) => {
      const pcm = base64ToArrayBuffer(base64);
      audioQueueRef.current.push(pcm);
      playNextChunk();
    },
    [playNextChunk]
  );

  const cleanup = useCallback(() => {
    if (videoIntervalRef.current) { clearInterval(videoIntervalRef.current); videoIntervalRef.current = null; }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
    if (playbackCtxRef.current) { playbackCtxRef.current.close().catch(() => {}); playbackCtxRef.current = null; }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const connect = async () => {
    setIsConnecting(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, autoGainControl: true, noiseSuppression: true },
      });
      streamRef.current = mediaStream;
      if (videoRef.current) videoRef.current.srcObject = mediaStream;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/stream?mode=${selectedMode.id}`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ready") {
            setIsConnected(true);
            setIsConnecting(false);
            addMessage("system", `Connected in ${selectedMode.name} mode. Start talking or type a message.`);
            startStreaming(socket, mediaStream);
          } else if (msg.type === "content") {
            handleGeminiMessage(msg.data);
          } else if (msg.type === "error") {
            addMessage("error", msg.data);
          } else if (msg.type === "closed") {
            addMessage("system", "Session ended.");
            stopEverything();
          }
        } catch (e) {
          console.error("Failed to parse message:", e);
        }
      };

      socket.onclose = () => {
        if (!isConnected) setIsConnecting(false);
        addMessage("system", "Disconnected.");
        setIsConnected(false);
        cleanup();
      };

      socket.onerror = () => {
        setIsConnecting(false);
        addMessage("error", "Connection failed. Is the server running?");
      };
    } catch {
      setIsConnecting(false);
      addMessage("error", "Could not access camera/microphone. Please allow permissions.");
    }
  };

  const handleGeminiMessage = (data: any) => {
    if (!data) return;
    const extract = (parts: any[]) => {
      for (const part of parts) {
        if (part.text) addMessage("agent", part.text);
        if (part.inlineData?.data) enqueueAudio(part.inlineData.data);
      }
    };
    if (data.serverContent?.modelTurn?.parts) extract(data.serverContent.modelTurn.parts);
    if (data.modelTurn?.parts) extract(data.modelTurn.parts);
  };

  const startStreaming = (socket: WebSocket, mediaStream: MediaStream) => {
    videoIntervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current && socket.readyState === WebSocket.OPEN) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx && videoRef.current.videoWidth > 0) {
          canvasRef.current.width = 640;
          canvasRef.current.height = 480;
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const base64 = canvasRef.current.toDataURL("image/jpeg", 0.4).split(",")[1];
          socket.send(JSON.stringify({ type: "realtimeInput", mediaChunks: [{ mimeType: "image/jpeg", data: base64 }] }));
        }
      }
    }, 2000);

    audioContextRef.current = new AudioContext({ sampleRate: 16000 });
    sourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStream);
    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    processorRef.current.onaudioprocess = (e) => {
      if (socket.readyState === WebSocket.OPEN) {
        const pcm = floatTo16BitPCM(e.inputBuffer.getChannelData(0));
        socket.send(JSON.stringify({ type: "realtimeInput", mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: bufferToBase64(pcm) }] }));
      }
    };
    sourceRef.current.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);
  };

  const stopEverything = useCallback(() => {
    cleanup();
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [cleanup]);

  const disconnect = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    stopEverything();
  };

  const sendText = () => {
    const text = textInput.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    addMessage("user", text);
    wsRef.current.send(JSON.stringify({ type: "text", text }));
    setTextInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); }
  };

  const roleStyles: Record<Message["role"], string> = {
    agent: "bg-blue-500/10 border-blue-500/20 text-blue-100",
    user: "bg-emerald-500/10 border-emerald-500/20 text-emerald-100",
    system: "bg-zinc-500/10 border-zinc-500/20 text-zinc-400",
    error: "bg-red-500/10 border-red-500/20 text-red-300",
  };

  const roleLabels: Record<Message["role"], string> = {
    agent: "Aura",
    user: "You",
    system: "System",
    error: "Error",
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Mode Selector — only visible when not connected */}
      {!isConnected && !isConnecting && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {MODES.map((mode) => {
            const colors = colorMap[mode.color];
            const isSelected = selectedMode.id === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setSelectedMode(mode)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl ring-1 transition-all cursor-pointer ${
                  isSelected
                    ? `${colors.selected} ring-2`
                    : `bg-zinc-900 ring-zinc-800 hover:ring-zinc-700`
                }`}
              >
                <div className={`${isSelected ? colors.text : "text-zinc-400"} transition-colors`}>
                  <ModeIcon mode={mode.icon} className="w-6 h-6" />
                </div>
                <span className={`text-sm font-semibold ${isSelected ? "text-white" : "text-zinc-300"}`}>
                  {mode.name}
                </span>
                <span className="text-[11px] text-zinc-500 text-center leading-tight hidden sm:block">
                  {mode.description}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active mode badge when connected */}
      {isConnected && (
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 ${colorMap[selectedMode.color].selected}`}>
            <div className={colorMap[selectedMode.color].text}>
              <ModeIcon mode={selectedMode.icon} className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-white">{selectedMode.name}</span>
          </div>
          <button
            onClick={disconnect}
            className="ml-auto px-4 py-1.5 bg-zinc-800 hover:bg-red-600/80 text-zinc-400 hover:text-white text-sm font-medium rounded-lg transition-all ring-1 ring-zinc-700 hover:ring-red-500/50 cursor-pointer"
          >
            End Session
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Video */}
        <div className="flex flex-col gap-4 lg:w-1/2">
          <div className="relative bg-zinc-900 rounded-xl overflow-hidden shadow-2xl ring-1 ring-zinc-800 aspect-video">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            {isConnected && (
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full ring-1 ring-white/10">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-[11px] text-white font-semibold tracking-wide uppercase">Live</span>
              </div>
            )}

            {!isConnected && !isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm flex-col gap-5">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ring-1 ${colorMap[selectedMode.color].bg} ${colorMap[selectedMode.color].ring}`}>
                  <div className={colorMap[selectedMode.color].text}>
                    <ModeIcon mode={selectedMode.icon} className="w-8 h-8" />
                  </div>
                </div>
                <div className="text-center px-6">
                  <h2 className="text-xl font-bold text-white mb-2">{selectedMode.name} Mode</h2>
                  <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">{selectedMode.description}</p>
                </div>
                <button
                  onClick={connect}
                  className="px-8 py-3 bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-600/25 cursor-pointer"
                >
                  Start Live Session
                </button>
              </div>
            )}

            {isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm flex-col gap-4">
                <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-300 text-sm">Connecting to Gemini...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Transcript + Input */}
        <div className="flex flex-col lg:w-1/2">
          <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 flex flex-col h-[420px] lg:h-full">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-zinc-300">Transcript</h3>
              <span className="text-[11px] text-zinc-600">
                {messages.filter((m) => m.role !== "system").length} messages
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-zinc-600 text-sm text-center">
                    Select a mode and start a session to begin.
                  </p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`p-3 rounded-lg text-sm border animate-fade-in ${roleStyles[m.role]}`}>
                    <span className="font-semibold text-[11px] uppercase tracking-wider opacity-70 block mb-1">
                      {roleLabels[m.role]}
                    </span>
                    {m.text}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {isConnected && (
              <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 bg-zinc-800 text-white text-sm rounded-lg px-4 py-2.5 ring-1 ring-zinc-700 focus:ring-violet-500 focus:outline-none placeholder:text-zinc-500 transition-all"
                  />
                  <button
                    onClick={sendText}
                    disabled={!textInput.trim()}
                    className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
