"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";

interface Message {
  role: "system" | "agent" | "user" | "error";
  text: string;
  timestamp: Date;
}

export default function LiveAgent() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
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
    setMessages((prev) => [...prev, { role, text, timestamp: new Date() }]);
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
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (playbackCtxRef.current) {
      playbackCtxRef.current.close().catch(() => {});
      playbackCtxRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const connect = async () => {
    setIsConnecting(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/stream`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ready") {
            setIsConnected(true);
            setIsConnecting(false);
            addMessage("system", "Connected to Gemini Live. Start talking or type a message.");
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
    } catch (e: any) {
      setIsConnecting(false);
      addMessage("error", "Could not access camera/microphone. Please allow permissions.");
    }
  };

  const handleGeminiMessage = (data: any) => {
    if (!data) return;
    const serverContent = data.serverContent;
    if (serverContent?.modelTurn?.parts) {
      for (const part of serverContent.modelTurn.parts) {
        if (part.text) addMessage("agent", part.text);
        if (part.inlineData?.data) enqueueAudio(part.inlineData.data);
      }
    }
    if (data.modelTurn?.parts) {
      for (const part of data.modelTurn.parts) {
        if (part.text) addMessage("agent", part.text);
        if (part.inlineData?.data) enqueueAudio(part.inlineData.data);
      }
    }
  };

  const startStreaming = (socket: WebSocket, mediaStream: MediaStream) => {
    videoIntervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current && socket.readyState === WebSocket.OPEN) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx && videoRef.current.videoWidth > 0) {
          canvasRef.current.width = 640;
          canvasRef.current.height = 480;
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.4);
          const base64 = dataUrl.split(",")[1];
          socket.send(
            JSON.stringify({
              type: "realtimeInput",
              mediaChunks: [{ mimeType: "image/jpeg", data: base64 }],
            })
          );
        }
      }
    }, 2000);

    audioContextRef.current = new AudioContext({ sampleRate: 16000 });
    sourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStream);
    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    processorRef.current.onaudioprocess = (e) => {
      if (socket.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16Buffer = floatTo16BitPCM(inputData);
        const base64Audio = bufferToBase64(pcm16Buffer);
        socket.send(
          JSON.stringify({
            type: "realtimeInput",
            mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: base64Audio }],
          })
        );
      }
    };

    sourceRef.current.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);
  };

  const stopEverything = useCallback(() => {
    cleanup();
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [cleanup]);

  const disconnect = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  const roleStyles: Record<Message["role"], string> = {
    agent: "bg-blue-500/10 border-blue-500/20 text-blue-100",
    user: "bg-emerald-500/10 border-emerald-500/20 text-emerald-100",
    system: "bg-zinc-500/10 border-zinc-500/20 text-zinc-400",
    error: "bg-red-500/10 border-red-500/20 text-red-300",
  };

  const roleLabels: Record<Message["role"], string> = {
    agent: "Fix-It",
    user: "You",
    system: "System",
    error: "Error",
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      {/* Left: Video Panel */}
      <div className="flex flex-col gap-4 lg:w-1/2">
        <div className="relative bg-zinc-900 rounded-xl overflow-hidden shadow-2xl ring-1 ring-zinc-800 aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {isConnected && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full ring-1 ring-white/10">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[11px] text-white font-semibold tracking-wide uppercase">Live</span>
            </div>
          )}

          {!isConnected && !isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm flex-col gap-5">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center ring-1 ring-blue-500/30">
                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div className="text-center px-6">
                <h2 className="text-xl font-bold text-white mb-2">Ready to Fix Something?</h2>
                <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">
                  Point your camera at what you need help with and have a natural conversation with the AI.
                </p>
              </div>
              <button
                onClick={connect}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30 cursor-pointer"
              >
                Start Live Session
              </button>
            </div>
          )}

          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm flex-col gap-4">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-300 text-sm">Connecting to Gemini...</p>
            </div>
          )}
        </div>

        {isConnected && (
          <button
            onClick={disconnect}
            className="w-full py-2.5 bg-zinc-800 hover:bg-red-600/80 text-zinc-300 hover:text-white text-sm font-medium rounded-xl transition-all ring-1 ring-zinc-700 hover:ring-red-500/50 cursor-pointer"
          >
            End Session
          </button>
        )}
      </div>

      {/* Right: Transcript + Text Input */}
      <div className="flex flex-col lg:w-1/2 gap-4">
        <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 flex flex-col h-[420px] lg:h-[calc(100%-52px)]">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300">Transcript</h3>
            <span className="text-[11px] text-zinc-600">{messages.filter(m => m.role !== "system").length} messages</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-zinc-600 text-sm text-center">
                  Start a session to see the conversation here.
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-sm border animate-fade-in ${roleStyles[m.role]}`}
                >
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
            <div className="px-4 py-3 border-t border-zinc-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 bg-zinc-800 text-white text-sm rounded-lg px-4 py-2.5 ring-1 ring-zinc-700 focus:ring-blue-500 focus:outline-none placeholder:text-zinc-500 transition-all"
                />
                <button
                  onClick={sendText}
                  disabled={!textInput.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
