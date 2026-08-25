// @ts-nocheck
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createShader, playSweep, accentChain, ACCENTS } from "glimm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { rpc } from "../../../lib/rpc-client";
import {
  applyComposerInsertion,
  clampMentionMenuHeight,
  composerNeedsFullWidth,
  visiblePrompt,
  mentionedTabsContext,
  filterBrowserTabs,
  filterSlashCommands,
  normalizeBrowserTabs,
  parseComposerToken,
  SLASH_COMMANDS,
  tabHost,
  type BrowserTab,
  type MentionedTabSnapshot,
  type SlashCommand,
} from "../../../lib/composer";

/* The built-in "prism" palette is only cyan→indigo→magenta, so a sweep
 * reads as blue/purple. Build a true full-spectrum rainbow instead. */
const RAINBOW = accentChain([
  ACCENTS.red,
  ACCENTS.orange,
  ACCENTS.yellow,
  ACCENTS.green,
  ACCENTS.cyan,
  ACCENTS.blue,
  ACCENTS.purple,
]);

/* ─────────────────────────────────────────────────────────
 * PROMPT BAR
 * A composer with real controls: @ browser tabs,
 * / commands, a model picker, and send.
 * Type @ or / to open the menus; ↑↓ + Enter to pick.
 * Variants: Rounded (card radius) · Pill (full radius).
 * ───────────────────────────────────────────────────────── */

function Icon({ children, size = 15, strokeWidth = 1.8 }: { children: React.ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const GLYPHS: Record<string, React.ReactNode> = {
  tab: <g><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18" /></g>,
  command: <g><path d="M4 7h16M4 12h10M4 17h13" /></g>,
};

const DEMO_TABS: BrowserTab[] = [
  { id: 1, title: "当前页面", url: "https://example.com/app", active: true },
  { id: 2, title: "GitHub", url: "https://github.com/pagent" },
  { id: 3, title: "文档", url: "https://docs.example.com" },
];

type MenuRow = {
  key: string;
  name: string;
  desc: string;
  badge?: string;
  tab?: BrowserTab;
  command?: SlashCommand;
};

type PromptModel = { key: string; name: string; tag: string };

/* self-running demo: walk the @ menu, then the / menu, and repeat.
 * Any pointer or key interaction hands control to the user. */
const AUTO_STEPS: {
  draft: string;
  active?: number;
  modelOpen?: boolean;
  model?: string;
  hold: number;
}[] = [
  { draft: "", model: "vanilla-1", hold: 1100 },
  { draft: "@", active: 0, hold: 900 },
  { draft: "@", active: 1, hold: 620 },
  { draft: "@", active: 2, hold: 700 },
  { draft: "", hold: 700 },
  { draft: "/", active: 0, hold: 900 },
  { draft: "/", active: 1, hold: 620 },
  { draft: "/", active: 3, hold: 1000 },
  { draft: "", hold: 800 },
  { draft: "", modelOpen: true, hold: 1200 },
  { draft: "", model: "sprinkles-5", hold: 2400 },
  { draft: "", hold: 900 },
];

export default function PromptBar({
  variant = "Rounded",
  demo = true,
  tall = false,
  placeholder,
  onSend,
  models = [],
  modelKey,
  onModelChange,
}: {
  variant?: string;
  /** the self-running walkthrough; turn off when embedding in a real surface */
  demo?: boolean;
  /** hero sizing: a multi-line input with controls on their own row */
  tall?: boolean;
  placeholder?: string;
  onSend?: (text: string, context?: string) => void;
  models?: PromptModel[];
  modelKey?: string;
  onModelChange?: (key: string) => void;
}) {
  const pill = variant === "Pill";
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const catalog = models;
  const selectedModel = catalog.find((item) => item.key === modelKey) ?? catalog[0];
  const [mentions, setMentions] = useState<BrowserTab[]>([]);
  const [tabs, setTabs] = useState<BrowserTab[]>(demo ? DEMO_TABS : []);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [tabsError, setTabsError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(demo);
  const [autoStep, setAutoStep] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const wide = tall || (draft.length > 0 && expanded);
  const [rowBox, setRowBox] = useState<{ top: number; height: number } | null>(null);
  const [menuMaxHeight, setMenuMaxHeight] = useState<number>();
  const [engaged, setEngaged] = useState(false);
  const composerAnchorRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const glimmRef = useRef<HTMLCanvasElement>(null);
  const shaderRef = useRef<ReturnType<typeof createShader> | null>(null);
  const sweepingRef = useRef(false);

  /* hand control to the user: stop the demo loop, and when they aim at
   * the input itself, clear the demo's leftover draft for a clean start */
  const takeOver = (event: { target: EventTarget | null }) => {
    setAuto(false);
    if (auto && event.target === inputRef.current) setDraft("");
  };

  const token = dismissed ? null : parseComposerToken(draft);
  const menu: "at" | "slash" | null = plusOpen ? "at" : token?.kind ?? null;
  const query = plusOpen ? "" : token?.query ?? "";

  const rows: MenuRow[] =
    menu === "at"
      ? filterBrowserTabs(tabs, query).map((tab) => ({
          key: `tab-${tab.id}`,
          name: tab.title,
          desc: tabHost(tab.url),
          badge: tab.active ? "当前" : mentions.some((item) => item.id === tab.id) ? "已选" : undefined,
          tab,
        }))
      : menu === "slash"
        ? filterSlashCommands(SLASH_COMMANDS, query).map((command) => ({
            key: command.key,
            name: command.name,
            desc: command.desc,
            command,
          }))
        : [];

  useEffect(() => {
    setActive(0);
    setEngaged(false);
  }, [menu, query]);

  useEffect(() => {
    if (menu !== "at" || demo) return;
    let cancelled = false;
    setTabsLoading(true);
    setTabsError("");
    void rpc("tabs.query", {})
      .then((result) => {
        if (cancelled) return;
        setTabs(normalizeBrowserTabs(result));
      })
      .catch(() => {
        if (cancelled) return;
        setTabsError("无法列出标签页");
      })
      .finally(() => {
        if (!cancelled) setTabsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [menu, demo]);

  /* a single highlight glides to the active row instead of each row
   * toggling its own background — matches the gliding pill in the nav */
  useLayoutEffect(() => {
    const target = rowRefs.current[active];
    if (target) setRowBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [menu, query, active, rows.length]);

  useLayoutEffect(() => {
    if (!menu) {
      setMenuMaxHeight(undefined);
      return;
    }
    const anchor = composerAnchorRef.current;
    const frame = anchor?.closest(".pagent-window") ?? anchor?.getRootNode();
    const topEdge =
      frame instanceof Element ? frame.getBoundingClientRect().top : 8;
    if (!anchor) return;
    const available = Math.floor(anchor.getBoundingClientRect().top - topEdge - 10);
    setMenuMaxHeight(clampMentionMenuHeight(available));
  }, [menu, query, rows.length, draft, wide, mentions.length]);

  /* Build the shader with a pinned hue phase. createShader seeds its
   * internal hueShift from Math.random(), which made the sweep a different
   * colour on every reload — pin it so the rainbow is identical each time. */
  const makeShader = () => {
    const canvas = glimmRef.current;
    if (!canvas) return null;
    const random = Math.random;
    Math.random = () => 0;
    try {
      return createShader({
        canvas,
        palette: RAINBOW,
        direction: "ltr",
        bandTight: 10,
        swellAmount: 0.85,
      });
    } finally {
      Math.random = random;
    }
  };

  /* Glimm shader lives inside the composer, invisible at rest. Selecting
   * the flagship model fires a one-shot rainbow sweep across the interior. */
  useEffect(() => {
    shaderRef.current = makeShader();
    return () => {
      shaderRef.current?.destroy();
      shaderRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const celebrate = () => {
    if (sweepingRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Recreate the shader per sweep so uTime restarts at 0 — the hue phase
    // (which drifts with time) is then identical on every trigger.
    shaderRef.current?.destroy();
    const shader = makeShader();
    shaderRef.current = shader;
    if (!shader) return;
    sweepingRef.current = true;
    const sweep = playSweep(shader, {
      palette: RAINBOW,
      direction: "ltr",
      sweepMs: 570,
      outroMs: 80,
      peakAlpha: 1.3,
      bandTight: 10,
      brightness: 1.4,
      swellAmount: 1,
      waveSpeed: 1.8,
      easing: "easeOutExpo",
    });
    sweep.done.finally(() => {
      sweepingRef.current = false;
    });
  };

  /* autoplay: apply the current step, then advance after its hold */
  useEffect(() => {
    if (!auto) return;
    const step = AUTO_STEPS[autoStep % AUTO_STEPS.length];
    setDraft(step.draft);
    if (step.active !== undefined) setActive(step.active);
    const t = setTimeout(() => setAutoStep((s) => s + 1), step.hold);
    return () => clearTimeout(t);
  }, [auto, autoStep]);

  /* Move wrapped text above the controls, then grow to a compact maximum. */
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const minHeight = 28;
    const maxHeight = 100;
    if (!draft) {
      if (expanded) setExpanded(false);
      input.style.height = `${minHeight}px`;
      input.style.overflowY = "hidden";
      return;
    }

    const controls = controlsRef.current;
    const measure = measureRef.current;
    const modelButton = modelRef.current;
    if (!controls || !measure || !modelButton) return;

    const needsFullWidth = composerNeedsFullWidth(
      draft,
      measure.offsetWidth,
      controls.clientWidth,
      modelButton.offsetWidth,
    );
    if (needsFullWidth !== expanded) {
      setExpanded(needsFullWidth);
    }

    input.style.height = "0px";
    const contentHeight = input.scrollHeight;
    input.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
    input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [draft, expanded]);

  useEffect(() => {
    if (!plusOpen) return;
    const close = (event: PointerEvent) => {
      const inside = event.composedPath().some(
        (node) => node instanceof HTMLElement && node.dataset.promptbar !== undefined,
      );
      if (!inside) setPlusOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [plusOpen]);

  const closeMenus = () => {
    setPlusOpen(false);
  };

  const pick = (row: MenuRow) => {
    if (row.tab) {
      setMentions((current) => (current.some((item) => item.id === row.tab!.id) ? current : [...current, row.tab!]));
      setDraft(applyComposerInsertion(draft, token, ""));
    } else if (row.command) {
      setDraft(applyComposerInsertion(draft, token, row.command.prompt));
    }
    setPlusOpen(false);
    setDismissed(false);
    inputRef.current?.focus();
  };

  const canSend = !preparing && (draft.trim().length > 0 || mentions.length > 0);
  const send = async () => {
    if (!canSend) return;
    const selectedMentions = [...mentions];
    const text = visiblePrompt(draft, selectedMentions);
    if (!text) return;
    setPreparing(true);
    setExpanded(false);
    setDraft("");
    setMentions([]);
    if (inputRef.current) {
      inputRef.current.style.height = "28px";
      inputRef.current.style.overflowY = "hidden";
    }
    closeMenus();
    try {
      let context = mentionedTabsContext(selectedMentions) || undefined;
      if (!demo && selectedMentions.length > 0) {
        try {
          const snapshots = (await rpc("tabs.snapshot", {
            tabIds: selectedMentions.map((tab) => tab.id),
          })) as MentionedTabSnapshot[];
          context = mentionedTabsContext(selectedMentions, snapshots) || undefined;
        } catch {
          // Keep the metadata-only context when one or more pages cannot be read.
        }
      }
      onSend?.(text, context);
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div
      data-promptbar
      className={demo ? "flex min-h-[384px] w-full max-w-105 flex-col justify-end pb-8" : "w-full"}
      onPointerDownCapture={takeOver}
      onKeyDownCapture={takeOver}
    >
      {/* composer is the anchor — menus grow up from its top edge */}
      <div ref={composerAnchorRef} className="relative">
      {/* ── @ / slash menu ─────────────────────────────── */}
      {menu && (
        <div
          onMouseLeave={() => setEngaged(false)}
          className="pagent-mention-menu absolute inset-x-0 bottom-full z-30 mb-2 rounded-[10px] bg-surface p-1 shadow-raised"
          style={{ maxHeight: menuMaxHeight }}
        >
          <div className="relative min-h-0 flex-1 overflow-y-auto">
            {/* single gliding highlight — appears once a row is hovered */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
              style={{
                top: rowBox?.top ?? 0,
                height: rowBox?.height ?? 0,
                opacity: rowBox && engaged && rows.length > 0 ? 1 : 0,
                transition:
                  "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
              }}
            />
            {rows.map((row, i) => (
                <button
                  key={row.key}
                  type="button"
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => {
                    setActive(i);
                    setEngaged(true);
                  }}
                  onClick={() => pick(row)}
                  className="relative z-10 flex h-9 w-full min-w-0 items-center gap-2.5 rounded-[6px] px-2 text-left"
                >
                  <span className="flex size-5.5 shrink-0 items-center justify-center text-ink-2">
                    <Icon size={15}>{GLYPHS[row.tab ? "tab" : "command"]}</Icon>
                  </span>
                  <span className="min-w-0 shrink truncate text-[12.5px] font-medium text-ink">
                    {row.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{row.desc}</span>
                  {row.badge && (
                    <span className={`shrink-0 text-[11px] font-medium ${row.badge === "当前" ? "text-accent-ink" : "text-ink-3"}`}>
                      {row.badge}
                    </span>
                  )}
                </button>
            ))}
            {rows.length === 0 && (
              <div className="flex h-9 items-center px-2 text-[12px] text-ink-3">
                {menu === "at"
                  ? tabsLoading
                    ? "正在读取标签页…"
                    : tabsError || (query ? `没有匹配「${query}」的标签页` : "当前窗口没有可列出的标签页")
                  : query
                    ? `没有匹配「${query}」的命令`
                    : "没有可用命令"}
              </div>
            )}
          </div>
          <div className="mt-1 shrink-0 border-t border-line px-2 pt-1.5 pb-1 text-[11px] text-ink-3">
            {menu === "at" ? "输入 @ 搜索浏览器标签页" : "输入 / 搜索命令"}
          </div>
        </div>
      )}

      {/* ── composer ───────────────────────────────────── */}
      <div
        className={`relative isolate flex flex-col overflow-hidden border border-line bg-surface shadow-card transition-[border-color,border-radius] duration-150 focus-within:border-line-strong ${
          tall ? "gap-2.5 p-3.5" : "gap-1.5 p-1.5"
        } ${
          pill ? (mentions.length > 0 || wide ? "rounded-[24px]" : "rounded-full") : tall ? "rounded-[22px]" : "rounded-[14px]"
        }`}
      >
        {/* rainbow glimm sweep — plays across the interior on model change.
            explicit w/h: a <canvas> is a replaced element and won't stretch
            to inset-0 alone, which feeds back into the shader's ResizeObserver. */}
        <canvas
          ref={glimmRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
          style={{ borderRadius: "inherit" }}
        />
        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none absolute invisible whitespace-pre text-[13px] leading-[18px]"
        >
          {draft}
        </span>

        {mentions.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 pt-0.5 ${pill ? "px-1" : "px-0.5"}`}>
            {mentions.map((tab) => (
              <span
                key={tab.id}
                className={`flex h-6.5 items-center gap-1.5 bg-field py-1 pr-1 pl-1.5 text-[11.5px] text-ink-2 shadow-hairline ${
                  pill ? "rounded-full" : "rounded-chip"
                }`}
                style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}
              >
                <Icon size={12}>{GLYPHS.tab}</Icon>
                <span className="max-w-36 truncate">{tab.title}</span>
                <button
                  type="button"
                  aria-label={`移除 ${tab.title}`}
                  onClick={() => setMentions((current) => current.filter((item) => item.id !== tab.id))}
                  className={`-my-1 flex size-6 items-center justify-center text-ink-3 transition-colors duration-100 hover:bg-line/70 hover:text-ink ${
                    pill ? "rounded-full" : "rounded-[5px]"
                  }`}
                >
                  <Icon size={10} strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></Icon>
                </button>
              </span>
            ))}
          </div>
        )}

        <div
          ref={controlsRef}
          className={`grid items-end gap-x-1 gap-y-1.5 ${
            wide
              ? "grid-cols-[28px_auto_minmax(0,1fr)_28px]"
              : "grid-cols-[28px_minmax(0,1fr)_auto_28px]"
          }`}
        >
          <button
            type="button"
            aria-label="附加标签页"
            aria-expanded={plusOpen}
            onClick={() => {
              setPlusOpen((current) => !current);
              inputRef.current?.focus();
            }}
            className={`flex size-7 shrink-0 items-center justify-center justify-self-start text-ink-3 transition-[background-color,color,transform] duration-150 hover:bg-hover hover:text-ink active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${plusOpen ? "bg-hover text-ink" : ""} ${wide ? "col-start-1 row-start-2" : "col-start-1 row-start-1"}`}
          >
            <Icon size={16} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Icon>
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            disabled={preparing}
            onChange={(event) => {
              setDraft(event.target.value);
              setDismissed(false);
              setPlusOpen(false);
            }}
            onKeyDown={(event) => {
              if (menu && rows.length > 0) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setEngaged(true);
                  setActive((current) => (current + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
                  return;
                }
                if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
                  event.preventDefault();
                  pick(rows[active]);
                  return;
                }
              }
              if (event.key === "Escape") {
                setDismissed(true);
                closeMenus();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={preparing ? "正在读取附加页面…" : (placeholder ?? "Write a message…")}
            aria-label="Prompt"
            className={`${tall ? "min-h-[68px] px-2 py-2 text-[14px] leading-5" : "min-h-7 px-1 py-[5px] text-[13px] leading-[18px]"} min-w-0 w-full resize-none bg-transparent text-ink outline-none [overflow-wrap:anywhere] placeholder:text-ink-3 ${
              wide ? "col-span-full col-start-1 row-start-1" : "col-start-2 row-start-1"
            }`}
          />

          <div
            ref={modelRef}
            className={`min-w-0 ${wide ? "col-start-2 row-start-2 justify-self-start" : "col-start-3 row-start-1"}`}
          >
            {catalog.length > 0 && selectedModel && (
              <Select
                value={selectedModel.key}
                onValueChange={(value) => {
                  onModelChange?.(value);
                  setPlusOpen(false);
                  celebrate();
                }}
              >
                <SelectTrigger
                  aria-label="选择模型"
                  className={`h-7 w-auto max-w-40 gap-1 border-0 bg-transparent px-1.5 text-[12px] font-medium text-ink-2 shadow-none hover:bg-hover hover:text-ink focus-visible:ring-0 ${
                    pill ? "rounded-full" : "rounded-[8px]"
                  }`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {catalog.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* send — tactile square (round in the pill variant) */}
          <button
            type="button"
            aria-label={preparing ? "正在读取附加页面" : "Send"}
            disabled={!canSend}
            onClick={send}
            className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${wide ? "col-start-4 row-start-2" : "col-start-4 row-start-1"}`}
            style={{
              background: canSend ? "var(--primary)" : "var(--line-strong)",
              color: canSend ? "var(--primary-foreground)" : "var(--ink-2)",
            }}
          >
            <Icon size={16} strokeWidth={2.4}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
