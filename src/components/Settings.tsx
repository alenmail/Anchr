import type { Model } from "@opencode-ai/sdk/v2/client";
import { Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ProviderCheckPopover from "@/components/ProviderCheckPopover";
import CompatibleProviderPanel from "@/components/CompatibleProviderPanel";
import ProviderConnectDialog from "@/components/ProviderConnectDialog";
import ProviderLogo from "@/components/ProviderLogo";
import { THEME_OPTIONS, type Theme, useTheme } from "@/components/theme-provider";
import { useCheckProvider } from "@/hooks/mutations/useCheckProvider";
import { useDisconnectProvider } from "@/hooks/mutations/useSetApiKey";
import {
  useAllModels,
  useAllProviders,
  useAuthMethods,
  useConnectedProviders,
  useProviderList,
} from "@/hooks/useProviders";
import { analyticsDeviceId } from "@/lib/analytics";
import { desktop } from "@/lib/desktop";
import { connectHint, isFreeTier, providerDisplayName } from "@/lib/providerAuth";
import { checkModels, checkPreference, type ProviderCheckResult } from "@/lib/providerCheck";
import { usePreferences } from "@/providers/PreferencesProvider";
import type { ModelInfo, ProviderInfo } from "@/types";
import anchrMark from "@/assets/anchr-mark.svg";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";

// ── Popular providers (same order as OpenCode's web UI) ──────────────
const POPULAR_PROVIDERS = [
  "anchr-compatible",
  "anthropic",
  "github-copilot",
  "openai",
  "google",
  "openrouter",
  "vercel",
];

/** OpenCode Zen with only the built-in free models. */
const isFreeZen = isFreeTier;

/** OpenCode Zen with a key added in Anchr, which falls back to the free models when removed. */
function hasZenKey(provider: ProviderInfo): boolean {
  return provider.id === "opencode" && provider.source === "api";
}

/** OpenCode Zen with a key from the environment or config, which Anchr can't remove. */
function hasOutsideZenKey(provider: ProviderInfo): boolean {
  return provider.id === "opencode" && !isFreeZen(provider) && !hasZenKey(provider);
}

type SettingsTab = "providers" | "models" | "appearance" | "privacy" | "about";

interface SettingsProps {
  onClose: () => void;
}

function Settings({ onClose }: SettingsProps) {
  const [tab, setTab] = useState<SettingsTab>("providers");
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    desktop
      .getVersion()
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  return (
    <div className="@container flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center gap-3 border-b px-4">
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Back to chat"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h3 className="text-xs font-semibold">Settings</h3>
      </div>

      {/* Body: sidebar + content. When narrow (e.g. the sessions sidebar is
          open in a small window) the sidebar becomes a tab row on top. */}
      <div className="flex min-h-0 flex-1 flex-col @xl:flex-row">
        {/* Sidebar */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-1.5 py-2 @xl:w-40 @xl:flex-col @xl:gap-0 @xl:overflow-visible @xl:border-r @xl:border-b-0 @xl:px-0 @xl:py-3">
          <div className="hidden px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground @xl:block">
            Server
          </div>
          <button
            onClick={() => setTab("providers")}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-xs transition-colors @xl:mx-1.5 ${
              tab === "providers"
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Providers
          </button>
          <button
            onClick={() => setTab("models")}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-xs transition-colors @xl:mx-1.5 ${
              tab === "models"
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Models
          </button>

          <div className="mt-4 hidden px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground @xl:block">
            App
          </div>
          <button
            onClick={() => setTab("appearance")}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-xs transition-colors @xl:mx-1.5 ${
              tab === "appearance"
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            Appearance
          </button>
          <button
            onClick={() => setTab("about")}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-xs transition-colors @xl:mx-1.5 ${
              tab === "about"
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            About
          </button>
          <button
            type="button"
            onClick={() => setTab("privacy")}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-xs transition-colors @xl:mx-1.5 ${
              tab === "privacy"
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Privacy
          </button>
        </div>

        {/* Content area */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {tab === "providers" && <ProvidersTab />}
          {tab === "models" && <ModelsTab />}
          {tab === "appearance" && <AppearanceTab />}
          {tab === "privacy" && <PrivacyTab />}
          {tab === "about" && <AboutTab appVersion={appVersion} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Providers Tab — connected, popular, and every other provider, searchable
// ═══════════════════════════════════════════════════════════════════════

function ProvidersTab() {
  const allProviders = useAllProviders();
  const connectedProviders = useConnectedProviders();
  const authMethods = useAuthMethods();
  const disconnectMutation = useDisconnectProvider();

  const [connecting, setConnecting] = useState<ProviderInfo | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [checks, setChecks] = useState<Record<string, "checking" | ProviderCheckResult>>({});
  const checkMutation = useCheckProvider();
  const providerList = useProviderList();
  const { selectedModel } = usePreferences();

  // Bumped whenever a provider's credential changes, so a check that was
  // running for the old credential can't report onto the new one.
  const checkGeneration = useRef<Record<string, number>>({});
  const [checkPickerFor, setCheckPickerFor] = useState<string | null>(null);

  function forgetCheck(providerId: string) {
    checkGeneration.current[providerId] = (checkGeneration.current[providerId] ?? 0) + 1;
    setChecks((prev) => {
      const { [providerId]: _stale, ...rest } = prev;
      return rest;
    });
  }

  // A provider's chat models, the user's chat model or the provider's default
  // first. Kept in a ref so the toast's check, clicked later, sees the models
  // the new credential unlocked.
  const checkModelsFor = useRef<(providerId: string) => Model[]>(() => []);
  checkModelsFor.current = (providerId) => {
    const provider = providerList?.all.find((p) => p.id === providerId);
    return provider
      ? checkModels(provider, checkPreference(providerId, selectedModel, providerList?.default))
      : [];
  };

  async function runCheck(provider: ProviderInfo, model: Model | undefined) {
    const generation = (checkGeneration.current[provider.id] ?? 0) + 1;
    checkGeneration.current[provider.id] = generation;
    let result: ProviderCheckResult;
    if (!model) {
      result = {
        ok: false,
        message: "This provider has no chat models to test with.",
        keyRejected: false,
      };
    } else {
      setChecks((prev) => ({ ...prev, [provider.id]: "checking" }));
      try {
        result = await checkMutation.mutateAsync({ providerID: provider.id, modelID: model.id });
      } catch {
        result = {
          ok: false,
          message: "Anchr couldn't run the check. Try again.",
          keyRejected: false,
          modelName: model.name,
        };
      }
    }
    if (checkGeneration.current[provider.id] !== generation) return;
    setChecks((prev) => ({ ...prev, [provider.id]: result }));
  }

  function handleConnected(provider: ProviderInfo) {
    // A new credential makes any earlier or running check stale.
    forgetCheck(provider.id);
    toast.success(`${provider.name} connected`, {
      action: {
        label: "Check it works",
        // Opens the picker rather than checking a guessed model: only the
        // user knows which models their key or plan includes.
        onClick: () => setCheckPickerFor(provider.id),
      },
    });
  }

  async function handleDisconnect(provider: ProviderInfo) {
    setDisconnecting(provider.id);
    try {
      await disconnectMutation.mutateAsync(provider.id);
      forgetCheck(provider.id);
      toast.success(
        hasZenKey(provider)
          ? "OpenCode Zen key removed."
          : "Provider disconnected",
      );
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(null);
    }
  }

  const needle = query.trim().toLowerCase();
  const matches = useCallback(
    (p: ProviderInfo, label = p.name) =>
      !needle || label.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle),
    [needle],
  );

  const connected = allProviders.filter(
    (p) => connectedProviders.includes(p.id) && matches(p, providerDisplayName(p)),
  );

  // Popular first in OpenCode's order, then everything else alphabetically
  const { popular, others } = useMemo(() => {
    const pop: ProviderInfo[] = [];
    const oth: ProviderInfo[] = [];
    for (const p of allProviders) {
      // With only the free models connected, Zen is still offered as its own
      // provider: a key turns the same OpenCode provider into a Zen account.
      if ((connectedProviders.includes(p.id) && !isFreeZen(p)) || !matches(p)) continue;
      // The recommendation card already offers Go.
      if (p.id === "opencode" || p.id === "opencode-go") continue;
      if (POPULAR_PROVIDERS.includes(p.id)) {
        pop.push(p);
      } else {
        oth.push(p);
      }
    }
    pop.sort((a, b) => POPULAR_PROVIDERS.indexOf(a.id) - POPULAR_PROVIDERS.indexOf(b.id));
    oth.sort((a, b) => a.name.localeCompare(b.name));
    return { popular: pop, others: oth };
  }, [allProviders, connectedProviders, matches]);

  const nothingMatches =
    allProviders.length > 0 && connected.length + popular.length + others.length === 0;

  function renderAvailable(provider: ProviderInfo) {
    return (
      <div key={provider.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        <ProviderLogo providerId={provider.id} name={provider.name} />
        <div className="min-w-[7rem] flex-1">
          <div className="truncate text-sm font-medium">{provider.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {connectHint(provider.id, authMethods[provider.id])}
          </div>
        </div>
        <button
          onClick={() => setConnecting(provider)}
          className="shrink-0 whitespace-nowrap rounded-md border bg-background px-3 py-1 text-[11px] font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 @xl:px-6 @xl:py-8">
      <h4 className="font-serif text-lg italic text-foreground">Providers</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose an AI engine for scripting, debugging and Studio automation.
      </p>

      <CompatibleProviderPanel />

      {allProviders.length > 0 && (
        <div className="relative mt-5">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${allProviders.length} providers`}
            aria-label="Search providers"
            className="h-8 w-full rounded-md border bg-background pr-2 pl-8 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      {/* Connected providers */}
      {connected.length > 0 && (
        <div className="mt-6">
          <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Connected
          </div>
          <div className="divide-y rounded-lg border bg-card">
            {connected.map((provider) => {
              const check = checks[provider.id];
              return (
                <div key={provider.id} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {isFreeZen(provider) ? (
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-foreground"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <ProviderLogo providerId={provider.id} name={provider.name} />
                    )}
                    <div className="min-w-[7rem] flex-1">
                      <div className="truncate text-sm font-medium">
                        {providerDisplayName(provider)}
                      </div>
                      {isFreeZen(provider) && (
                        <div className="truncate text-[11px] text-muted-foreground">
                          Free OpenCode models
                        </div>
                      )}
                    </div>
                    {check && check !== "checking" && (
                      <span
                        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          check.ok
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${check.ok ? "bg-emerald-500" : "bg-red-500"}`}
                        />
                        {check.ok ? "Working" : "Not working"}
                      </span>
                    )}
                    <ProviderCheckPopover
                      providerName={providerDisplayName(provider)}
                      models={checkModelsFor.current(provider.id)}
                      checking={check === "checking"}
                      open={checkPickerFor === provider.id}
                      onOpenChange={(open) => setCheckPickerFor(open ? provider.id : null)}
                      onCheck={(model) => runCheck(provider, model)}
                    />
                    {/* The free models can't be disconnected, and Anchr can't
                        remove a Zen key it didn't store. */}
                    {isFreeZen(provider) || hasOutsideZenKey(provider) ? null : (
                      <button
                        onClick={() => handleDisconnect(provider)}
                        disabled={disconnecting === provider.id}
                        className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground transition-colors hover:text-red-600 disabled:opacity-50"
                      >
                        {disconnecting === provider.id
                          ? "..."
                          : hasZenKey(provider)
                            ? "Remove key"
                            : "Disconnect"}
                      </button>
                    )}
                  </div>
                  {check && check !== "checking" && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground @md:pl-10">
                      {check.ok ? (
                        `Works with ${check.modelName}.`
                      ) : (
                        <>
                          {check.modelName && `Didn't work with ${check.modelName}. `}
                          <span className="text-red-700 dark:text-red-400">{check.message}</span>
                          {check.keyRejected && !isFreeZen(provider) && (
                            <button
                              onClick={() => setConnecting(provider)}
                              className="ml-1.5 font-medium text-foreground underline-offset-2 hover:underline"
                            >
                              Reconnect
                            </button>
                          )}
                        </>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {popular.length > 0 && (
        <div className="mt-6">
          <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Popular
          </div>
          <div className="divide-y rounded-lg border bg-card">{popular.map(renderAvailable)}</div>
        </div>
      )}

      {others.length > 0 && (
        <div className="mt-6">
          <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {popular.length > 0 || connected.length > 0 ? "More providers" : "Providers"}
          </div>
          <div className="divide-y rounded-lg border bg-card">{others.map(renderAvailable)}</div>
        </div>
      )}

      {nothingMatches && (
        <div className="mt-8 text-center text-xs text-muted-foreground">
          No provider matches “{query.trim()}”.
          <button
            onClick={() => setQuery("")}
            className="ml-1 text-foreground underline-offset-2 hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      {allProviders.length === 0 && (
        <div className="mt-8 py-4 text-center text-xs text-muted-foreground">
          Loading providers...
        </div>
      )}

      {connecting && (
        <ProviderConnectDialog
          provider={connecting}
          onClose={() => setConnecting(null)}
          onConnected={handleConnected}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Models Tab
// ═══════════════════════════════════════════════════════════════════════

function ModelsTab() {
  const allModels = useAllModels();
  const connectedProviders = useConnectedProviders();
  const { hiddenModels, toggleModelVisibility } = usePreferences();

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Group models by provider (only connected providers), filtered by search
  const modelsByProvider = useMemo(() => {
    const query = search.toLowerCase().trim();
    const groups: Record<string, { providerName: string; models: ModelInfo[] }> = {};

    for (const model of allModels) {
      // Only show models from connected providers
      if (!connectedProviders.includes(model.providerId)) continue;

      // Filter by search
      if (query) {
        const haystack = `${model.name} ${model.id} ${model.providerName}`.toLowerCase();
        if (!haystack.includes(query)) continue;
      }

      if (!groups[model.providerId]) {
        groups[model.providerId] = {
          providerName: model.providerName,
          models: [],
        };
      }
      groups[model.providerId].models.push(model);
    }

    // Sort models within each group
    for (const group of Object.values(groups)) {
      group.models.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Sort provider groups: popular first, then alphabetical
    const entries = Object.entries(groups);
    entries.sort(([aId], [bId]) => {
      const aPopular = POPULAR_PROVIDERS.includes(aId);
      const bPopular = POPULAR_PROVIDERS.includes(bId);
      if (aPopular && !bPopular) return -1;
      if (!aPopular && bPopular) return 1;
      if (aPopular && bPopular) {
        return POPULAR_PROVIDERS.indexOf(aId) - POPULAR_PROVIDERS.indexOf(bId);
      }
      return groups[aId].providerName.localeCompare(groups[bId].providerName);
    });

    return entries;
  }, [allModels, connectedProviders, search]);

  const totalModels = allModels.filter((m) => connectedProviders.includes(m.providerId)).length;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 @xl:px-6 @xl:py-8">
      <h4 className="font-serif text-lg italic text-foreground">Models</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Keep only the models you actually use. Built-in free-model suggestions are hidden.
      </p>

      {/* Search */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted-foreground/50"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models..."
            className="h-8 flex-1 bg-transparent text-xs placeholder:text-muted-foreground/40 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                searchRef.current?.focus();
              }}
              className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Model groups */}
      <div className="mt-5 space-y-6">
        {modelsByProvider.map(([providerId, group]) => (
          <div key={providerId}>
            <div className="flex items-center gap-2 pb-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-[10px] font-semibold text-muted-foreground">
                {group.providerName.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-medium">{group.providerName}</span>
            </div>
            <div className="rounded-lg border bg-card">
              {group.models.map((model, idx) => {
                const modelKey = `${model.providerId}/${model.id}`;
                const isVisible = !hiddenModels.has(modelKey);
                return (
                  <div key={modelKey}>
                    {idx > 0 && <div className="mx-3.5 h-px bg-border" />}
                    <button
                      onClick={() => toggleModelVisibility(modelKey)}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
                    >
                      <span className="truncate text-xs">{model.name}</span>
                      {/* Toggle switch */}
                      <span
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          isVisible ? "bg-foreground" : "bg-border"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-background transition-transform ${
                            isVisible ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {modelsByProvider.length === 0 && totalModels > 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No models matching &quot;{search}&quot;
          </div>
        )}

        {totalModels === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Connect a provider to see available models.
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Appearance Tab
// ═══════════════════════════════════════════════════════════════════════

function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 @xl:px-6 @xl:py-8">
      <h4 className="font-serif text-lg italic text-foreground">Appearance</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose how Anchr looks. System follows your OS preference.
      </p>

      <div className="mt-6">
        <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Theme
        </div>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((option) => {
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={selected}
                className={`rounded-lg border px-3 py-3 text-center transition-colors ${
                  selected
                    ? "border-foreground bg-accent font-medium text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <ThemePreview swatch={option.value} />
                <span className="mt-2 block text-xs">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ThemePreview({ swatch }: { swatch: Theme }) {
  if (swatch === "light") {
    return (
      <div className="mx-auto flex h-10 w-full max-w-[72px] overflow-hidden rounded-md border border-stone-200">
        <div className="w-1/3 bg-stone-100" />
        <div className="flex-1 bg-stone-50" />
      </div>
    );
  }
  if (swatch === "dark") {
    return (
      <div className="mx-auto flex h-10 w-full max-w-[72px] overflow-hidden rounded-md border border-stone-700">
        <div className="w-1/3 bg-stone-800" />
        <div className="flex-1 bg-stone-950" />
      </div>
    );
  }
  return (
    <div className="mx-auto flex h-10 w-full max-w-[72px] overflow-hidden rounded-md border border-border">
      <div className="w-1/2 bg-stone-50" />
      <div className="w-1/2 bg-stone-950" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Privacy Tab
// ═══════════════════════════════════════════════════════════════════════

function PrivacyTab() {
  const { detailedAnalyticsEnabled, setDetailedAnalyticsEnabled } = usePreferences();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 @xl:px-6 @xl:py-8">
      <h4 className="font-serif text-lg italic text-foreground">Privacy</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Anchr does not send the original application's product analytics. The upstream
        PostHog token and telemetry endpoint are disabled in this build. AI requests
        still go to whichever model provider you connect and authorize.
      </p>

      <div className="mt-6 rounded-lg border bg-card p-3.5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Product telemetry (disabled)</div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Anchr product analytics are not configured. This control is intentionally disabled;
              your model provider may still process the prompts and files you choose to send.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={detailedAnalyticsEnabled}
            aria-label="Product telemetry disabled"
            disabled
            onClick={() => setDetailedAnalyticsEnabled(!detailedAnalyticsEnabled)}
            className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              detailedAnalyticsEnabled ? "bg-foreground" : "bg-border"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-background transition-transform ${
                detailedAnalyticsEnabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      <PrivacyDetails />
    </div>
  );
}


function PrivacyDetails() {
  const deviceId = analyticsDeviceId();

  const copyDeviceId = async () => {
    if (!deviceId) return;
    try {
      await navigator.clipboard.writeText(deviceId);
      toast.success("Device ID copied");
    } catch {
      toast.error("Couldn't copy the device ID");
    }
  };

  return (
    <div className="mt-4 space-y-3 px-1 text-[11px] leading-relaxed text-muted-foreground">
      {deviceId && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-foreground">Device ID</div>
            <div className="truncate font-mono">{deviceId}</div>
          </div>
          <button
            type="button"
            onClick={copyDeviceId}
            className="shrink-0 rounded-md border bg-card px-2.5 py-1 text-foreground transition-colors hover:bg-accent"
          >
            Copy
          </button>
        </div>
      )}
      <p>Stone has not published an Anchr privacy policy or support address. This build does not
        use Paralov's personal-data request service. Do not submit privacy requests for Anchr to
        the original BloxBot maintainers.</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// About Tab
// ═══════════════════════════════════════════════════════════════════════

function AboutTab({ appVersion }: { appVersion: string | null }) {
  const queryClient = useQueryClient();
  const features = [
    { name: "Explore", description: "Understand what's in your place and find objects quickly.", mark: "01" },
    { name: "Create", description: "Turn ideas into scripts and systems that live in Studio.", mark: "02" },
    { name: "Debug", description: "Inspect runtime errors and refine your game.", mark: "03" },
    { name: "Playtest", description: "Run tests and iterate with direct Studio tools.", mark: "04" },
  ];
  async function reopenGuide() {
    await desktop.patchConfig({ onboardingCompleted: false });
    await queryClient.invalidateQueries({ queryKey: qk.config });
  }
  return <div className="mx-auto w-full max-w-md px-5 py-8 @xl:px-7">
    <div className="flex items-center gap-4">
      <img src={anchrMark} alt="Anchr" className="h-[62px] w-[62px] object-contain" />
      <div>
        <h4 className="font-display text-[23px] font-semibold tracking-[-.035em]">Anchr</h4>
        <p className="mt-1 text-[11px] text-muted-foreground">Your workspace for building in Roblox Studio.</p>
      </div>
    </div>
    <div className="mt-7 rounded-xl border border-white/10 bg-white/[.025] px-4 py-4">
      <div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">Application version</span><span className="font-mono text-[11px] text-slate-200">{appVersion ? "v"+appVersion : "…"}</span></div>
      <div className="mt-3 h-px bg-white/10"/>
      <div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-muted-foreground">Platform</span><span className="text-[11px] font-medium">Roblox Studio companion</span></div>
    </div>
    <p className="mt-8 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">What you can do</p>
    <div className="mt-3 divide-y divide-white/[.07] rounded-xl border border-white/10 bg-white/[.025] px-4">
      {features.map(feature=><div key={feature.mark} className="flex items-start gap-3 py-3.5">
        <span className="pt-0.5 font-mono text-[11px] text-sky-300/70">{feature.mark}</span>
        <div><p className="text-xs font-semibold">{feature.name}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{feature.description}</p></div>
      </div>)}
    </div>
    <button type="button" onClick={() => void reopenGuide()} className="mt-5 w-full rounded-xl border border-white/15 px-4 py-2.5 text-[12px] font-semibold text-slate-200 transition-colors hover:bg-white/5">View getting started guide</button>
    <p className="mt-6 text-[10px] leading-5 text-muted-foreground">Anchr by Stone. Open-source license notices are retained with the software.</p>
  </div>;
}

export default Settings;
