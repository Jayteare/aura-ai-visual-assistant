"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";

interface Message {
  role: "system" | "agent" | "user" | "error";
  text: string;
}

export default function LiveAgent() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>("");
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

  const refreshVideoDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vids = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(vids);
      return vids;
    } catch {
      return [];
    }
  }, []);

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

  const getVideoConstraints = useCallback((): MediaTrackConstraints => {
    if (selectedVideoDeviceId) {
      return {
        deviceId: { exact: selectedVideoDeviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };
    }
    return {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };
  }, [facingMode, selectedVideoDeviceId]);

  const swapVideoTrack = useCallback(async (newTrack: MediaStreamTrack) => {
    const currentStream = streamRef.current;
    if (!currentStream) {
      newTrack.stop();
      return;
    }
    try {
      const [oldTrack] = currentStream.getVideoTracks();
      if (oldTrack) {
        currentStream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      currentStream.addTrack(newTrack);
      if (videoRef.current) {
        videoRef.current.srcObject = currentStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      newTrack.stop();
      addMessage("error", "Could not switch cameras on this device/browser. Try ending the session and starting again.");
    }
  }, []);

  const switchCamera = useCallback(async () => {
    if (!streamRef.current) return;
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);

    try {
      const devices = videoDevices.length ? videoDevices : await refreshVideoDevices();
      if (devices.length >= 2) {
        const currentId = selectedVideoDeviceId || streamRef.current.getVideoTracks()[0]?.getSettings()?.deviceId || "";
        const idx = devices.findIndex((d) => d.deviceId === currentId);
        const next = devices[(idx + 1 + devices.length) % devices.length];
        setSelectedVideoDeviceId(next.deviceId);
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: next.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        const [newTrack] = newStream.getVideoTracks();
        if (newTrack) await swapVideoTrack(newTrack);
        newStream.getTracks().forEach((t) => t.kind !== "video" && t.stop());
        setIsSwitchingCamera(false);
        return;
      }

      const nextFacing = facingMode === "user" ? "environment" : "user";
      setFacingMode(nextFacing);
      setSelectedVideoDeviceId("");
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      const [newTrack] = newStream.getVideoTracks();
      if (newTrack) await swapVideoTrack(newTrack);
      newStream.getTracks().forEach((t) => t.kind !== "video" && t.stop());
    } catch (e: any) {
      addMessage("error", e?.message || "Failed to switch camera.");
    } finally {
      setIsSwitchingCamera(false);
    }
  }, [facingMode, refreshVideoDevices, selectedVideoDeviceId, swapVideoTrack, videoDevices, isSwitchingCamera]);

  const connect = async () => {
    setIsConnecting(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: getVideoConstraints(),
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, autoGainControl: true, noiseSuppression: true },
      });
      streamRef.current = mediaStream;
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      const vids = await refreshVideoDevices();
      const currentDeviceId = mediaStream.getVideoTracks()[0]?.getSettings()?.deviceId || "";
      if (currentDeviceId) setSelectedVideoDeviceId(currentDeviceId);
      if (!vids.length) setSelectedVideoDeviceId(currentDeviceId);

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
            addMessage("system", "Connected — start talking or show me something.");
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

  const TranscriptMessages = () => (
    <>
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-zinc-600 text-sm text-center">
            Start a session to begin.
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
    </>
  );

  const TranscriptInput = () =>
    isConnected ? (
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
    ) : null;

  return (
    <div className="flex flex-col gap-2 sm:gap-6 w-full h-full">
      {/* Desktop toolbar — hidden on mobile */}
      {isConnected && (
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={switchCamera}
            disabled={isSwitchingCamera}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-all ring-1 ring-zinc-700 cursor-pointer disabled:cursor-not-allowed"
            title="Switch camera"
          >
            {isSwitchingCamera ? "Switching..." : "Switch Camera"}
          </button>
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ring-1 cursor-pointer ${
              showTranscript
                ? "bg-violet-600/20 text-violet-300 ring-violet-500/50 hover:bg-violet-600/30"
                : "bg-zinc-800 text-zinc-300 ring-zinc-700 hover:bg-zinc-700"
            }`}
          >
            {showTranscript ? "Hide Transcript" : "Show Transcript"}
          </button>
          <button
            onClick={disconnect}
            className="ml-auto px-4 py-1.5 bg-zinc-800 hover:bg-red-600/80 text-zinc-400 hover:text-white text-sm font-medium rounded-lg transition-all ring-1 ring-zinc-700 hover:ring-red-500/50 cursor-pointer"
          >
            End Session
          </button>
        </div>
      )}

      <div className="relative flex flex-col lg:flex-row gap-2 sm:gap-6 flex-1 lg:h-[calc(100dvh-11rem)] min-h-0">
        {/* Left: Video */}
        <div className={`flex flex-col gap-2 sm:gap-4 min-h-0 flex-1 ${showTranscript ? "lg:w-3/5" : "w-full"}`}>
          <div className={`relative bg-zinc-900 overflow-hidden shadow-2xl ${
            isConnected
              ? "rounded-none sm:rounded-xl ring-0 sm:ring-1 sm:ring-zinc-800 flex-1 sm:aspect-video sm:flex-none"
              : "rounded-xl ring-1 ring-zinc-800 aspect-video"
          }`}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            {isConnected && (
              <>
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full ring-1 ring-white/10 z-10">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-[11px] text-white font-semibold tracking-wide uppercase">Live</span>
                </div>

                {/* Mobile floating controls */}
                <div className="absolute bottom-4 left-0 right-0 flex sm:hidden items-center justify-center gap-4 safe-bottom z-10">
                  <button
                    onClick={switchCamera}
                    disabled={isSwitchingCamera}
                    className="w-12 h-12 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-white ring-1 ring-white/20 active:bg-white/20 disabled:opacity-40 transition-all"
                    title="Switch camera"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowTranscript((v) => !v)}
                    className={`w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md ring-1 active:bg-white/20 transition-all ${
                      showTranscript
                        ? "bg-violet-600/40 text-violet-200 ring-violet-400/50"
                        : "bg-black/60 text-white ring-white/20"
                    }`}
                    title="Toggle transcript"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                    </svg>
                  </button>
                  <button
                    onClick={disconnect}
                    className="w-12 h-12 flex items-center justify-center rounded-full bg-red-600/80 backdrop-blur-md text-white ring-1 ring-red-400/30 active:bg-red-500 transition-all"
                    title="End session"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                    </svg>
                  </button>
                </div>
              </>
            )}

            {!isConnected && !isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm flex-col gap-5">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center ring-1 bg-violet-500/10 ring-violet-500/50">
                  <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                </div>
                <div className="text-center px-6">
                  <h2 className="text-xl font-bold text-white mb-2">Aura</h2>
                  <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">
                    Point your camera at anything — homework, a broken appliance, a game, a sign in another language — and just ask.
                  </p>
                </div>

                {/* Camera toggle */}
                <div className="flex items-center gap-1 bg-zinc-900 ring-1 ring-zinc-800 rounded-lg p-1.5">
                  <button
                    onClick={() => { setFacingMode("user"); setSelectedVideoDeviceId(""); }}
                    className={`px-4 py-2.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      facingMode === "user" && !selectedVideoDeviceId ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Front Camera
                  </button>
                  <button
                    onClick={() => { setFacingMode("environment"); setSelectedVideoDeviceId(""); }}
                    className={`px-4 py-2.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      facingMode === "environment" && !selectedVideoDeviceId ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Back Camera
                  </button>
                </div>

                <button
                  onClick={connect}
                  className="px-8 py-3.5 sm:py-3 bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-600/25 cursor-pointer text-base sm:text-sm"
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

        {/* Transcript panel */}
        {showTranscript && (
          <>
            {/* Mobile: slide-up overlay */}
            <div className="sm:hidden absolute inset-0 z-20 flex flex-col justify-end animate-slide-up">
              <div
                className="flex-1 transcript-overlay-backdrop"
                onClick={() => setShowTranscript(false)}
              />
              <div className="bg-zinc-900 rounded-t-2xl ring-1 ring-zinc-800 flex flex-col h-[60vh] min-h-0 safe-bottom">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-semibold text-zinc-300">Transcript</h3>
                  <button
                    onClick={() => setShowTranscript(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
                  <TranscriptMessages />
                </div>
                <TranscriptInput />
              </div>
            </div>

            {/* Desktop: sidebar */}
            <div className="hidden sm:flex flex-col lg:w-2/5 min-h-0">
              <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 flex flex-col h-[360px] lg:h-full min-h-0">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-semibold text-zinc-300">Transcript</h3>
                  <span className="text-[11px] text-zinc-600">
                    {messages.filter((m) => m.role !== "system").length} messages
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
                  <TranscriptMessages />
                </div>
                <TranscriptInput />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
