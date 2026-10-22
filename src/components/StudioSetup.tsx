import type { StudioMcpProblem } from "@/hooks/useStudioConnection";

interface StudioSetupProps {
  connected: boolean;
  checking: boolean;
  problem?: StudioMcpProblem | null;
  onCheck: () => void;
  onContinue: () => void;
}

export default function StudioSetup({ connected, checking, problem, onCheck, onContinue }: StudioSetupProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-blue-500/20 bg-card p-8 shadow-xl">
        <div className="flex items-center gap-4">
          <img src="/anchr-logo.svg" alt="Anchr" className="h-16 w-16 rounded-2xl" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-400">Anchr Studio • by Stone</div>
            <h1 className="mt-1 text-2xl font-semibold">{connected ? "Studio connected" : "Connect Roblox Studio"}</h1>
          </div>
        </div>
        {connected ? (
          <>
            <p className="mt-6 text-sm text-muted-foreground">The Anchr Studio plugin is connected. You're ready to create, debug, and playtest.</p>
            <button className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500" onClick={onContinue} type="button">Start building</button>
          </>
        ) : (
          <>
            <div className="mt-6 space-y-3 text-sm text-muted-foreground">
              <p><strong className="text-foreground">1.</strong> Open your place in Roblox Studio.</p>
              <p><strong className="text-foreground">2.</strong> Restart Studio if Anchr just installed the Studio plugin.</p>
              <p><strong className="text-foreground">3.</strong> Select <strong className="text-foreground">Anchr</strong> in the Studio Plugins toolbar, and connect if needed.</p>
              <p className="text-xs">Anchr uses its bundled Studio plugin. Do not enable Studio's built-in MCP server.</p>
            </div>
            {problem && (
              <p className="mt-5 rounded-xl border border-amber-500/30 p-3 text-xs text-amber-200">
                {problem === "not_installed"
                  ? "Anchr could not find its bundled MCP server. Reinstall Anchr and restart the desktop app."
                  : "No connected Anchr Studio plugin was found. Open a Studio place and check that its Anchr plugin is enabled."}
              </p>
            )}
            <button className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60" onClick={onCheck} disabled={checking} type="button">{checking ? "Checking connection…" : "Check connection"}</button>
          </>
        )}
      </section>
    </div>
  );
}
