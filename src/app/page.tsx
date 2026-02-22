import LiveAgent from "@/components/LiveAgent";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 font-sans">
      <header className="w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              FI
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Fix-It</h1>
              <p className="text-xs text-zinc-500 leading-tight">AI Live Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="px-2 py-1 rounded-md bg-zinc-800/60 border border-zinc-700/50">
              Gemini 2.5 Flash
            </span>
            <span className="px-2 py-1 rounded-md bg-zinc-800/60 border border-zinc-700/50">
              Live API
            </span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-6 py-8 flex-1">
        <LiveAgent />
      </main>

      <footer className="w-full border-t border-zinc-800 py-4">
        <p className="text-center text-xs text-zinc-600">
          Built for the Gemini API Developer Challenge — Powered by Google Cloud
        </p>
      </footer>
    </div>
  );
}
