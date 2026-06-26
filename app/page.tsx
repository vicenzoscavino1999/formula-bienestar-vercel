"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type MoodKey =
  | "pleno"
  | "estable"
  | "preocupado"
  | "agotado"
  | "triste"
  | "serenoPasivo"
  | "intensoInestable";

type Entry = {
  id: string;
  date: string;
  tau: number;
  pi: number;
  rho: number;
  eps: number;
  alpha: number;
  eta: number;
  phi: number;
  memory: number;
  vital: number;
  x: number;
  y: number;
  mood: MoodKey;
};

type TrailPoint = {
  id: string;
  time: string;
  x: number;
  y: number;
  vital: number;
  mood: MoodKey;
};

type SavedState = {
  version: 2;
  tau: number;
  pi: number;
  rho: number;
  eps: number;
  alpha: number;
  eta: number;
  lambda: number;
  chi: number;
  memory: number;
  history: Entry[];
  trail: TrailPoint[];
  savedAt: string;
};

type ControlState = Pick<SavedState, "tau" | "pi" | "rho" | "eps" | "alpha" | "eta" | "lambda" | "chi" | "memory" | "history" | "trail">;

type AvatarStride = "walk" | "slowWalk" | "sadWalk" | "tiredWalk";

type AvatarMotion = {
  stride: AvatarStride;
  tempo: number;
  tilt: number;
  cue: string;
  reference: string;
  rhythm: number;
  load: number;
  pulse: number;
};

type SceneHandles = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  stage: THREE.Group;
  currentSphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  currentRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  trailGroup: THREE.Group;
  currentLine: THREE.Line | null;
  dotGroup: THREE.Group;
  savedGroup: THREE.Group;
  frameId: number;
};

const STORAGE_KEY = "formula-bienestar-v1";

const moodText: Record<MoodKey, string> = {
  pleno: "Pleno y en avance",
  estable: "Estable",
  preocupado: "Preocupado pero activo",
  agotado: "Agotado",
  triste: "Triste o apagado",
  serenoPasivo: "Sereno pero pasivo",
  intensoInestable: "Intenso pero inestable",
};

const moodExplanation: Record<MoodKey, string> = {
  pleno: "Alta calma, buena acción y alegría suficiente. El avatar camina firme.",
  estable: "Hay equilibrio aceptable. No está perfecto, pero sostiene bien el día.",
  preocupado: "Hay acción, responsabilidad o esfuerzo, pero falta calma interior.",
  agotado: "El esfuerzo pesa más que la paz. Hay movimiento, pero con desgaste.",
  triste: "Baja alegría presente y bajo valor vital. El avatar pierde energía.",
  serenoPasivo: "Hay calma, pero poca acción. Está tranquilo, aunque avanza lento.",
  intensoInestable: "Hay pasión o impulso, pero no suficiente paz para estabilizarlo.",
};

const moodProfiles: { key: MoodKey; label: string; signal: string }[] = [
  { key: "pleno", label: "Pleno", signal: "Calma alta, acción alta y alegría suficiente." },
  { key: "estable", label: "Estable", signal: "Equilibrio medio; sostiene el día sin extremos." },
  { key: "preocupado", label: "Preocupado", signal: "Mucha acción con poca calma interior." },
  { key: "agotado", label: "Agotado", signal: "Esfuerzo alto, paz baja y desgaste acumulado." },
  { key: "triste", label: "Triste", signal: "Alegría y valor vital por debajo del centro." },
  { key: "serenoPasivo", label: "Sereno pasivo", signal: "Calma alta, pero poca acción vital." },
  { key: "intensoInestable", label: "Intenso", signal: "Pasión alta sin suficiente paz para ordenar." },
];

const moodTraceColor: Record<MoodKey, number> = {
  pleno: 0xf2d68b,
  estable: 0x87d6b6,
  preocupado: 0xe46f6f,
  agotado: 0xf2efe7,
  triste: 0x74b4ff,
  serenoPasivo: 0x8fd8ff,
  intensoInestable: 0xff9364,
};

const moodTraceGlow: Record<MoodKey, number> = {
  pleno: 0x6f5520,
  estable: 0x173f35,
  preocupado: 0x5a1f25,
  agotado: 0x4a4742,
  triste: 0x1d3f68,
  serenoPasivo: 0x1d516c,
  intensoInestable: 0x5a2a1d,
};

const avatarMotion: Record<MoodKey, AvatarMotion> = {
  pleno: {
    stride: "walk",
    tempo: 0.95,
    tilt: -1,
    cue: "Paso abierto",
    reference: "energia alta",
    rhythm: 0.82,
    load: 0.22,
    pulse: 0.5,
  },
  estable: {
    stride: "walk",
    tempo: 1.55,
    tilt: 0,
    cue: "Ritmo estable",
    reference: "equilibrio medio",
    rhythm: 0.58,
    load: 0.38,
    pulse: 0.42,
  },
  preocupado: {
    stride: "walk",
    tempo: 1.12,
    tilt: -5,
    cue: "Pulso tenso",
    reference: "accion sin calma",
    rhythm: 0.7,
    load: 0.68,
    pulse: 0.78,
  },
  agotado: {
    stride: "tiredWalk",
    tempo: 3.75,
    tilt: -7,
    cue: "Ritmo lento",
    reference: "carga alta",
    rhythm: 0.24,
    load: 0.88,
    pulse: 0.32,
  },
  triste: {
    stride: "sadWalk",
    tempo: 3.2,
    tilt: 10,
    cue: "Energia baja",
    reference: "avance minimo",
    rhythm: 0.2,
    load: 0.52,
    pulse: 0.26,
  },
  serenoPasivo: {
    stride: "slowWalk",
    tempo: 2.75,
    tilt: 1,
    cue: "Calma quieta",
    reference: "poca accion",
    rhythm: 0.34,
    load: 0.22,
    pulse: 0.28,
  },
  intensoInestable: {
    stride: "walk",
    tempo: 0.72,
    tilt: -6,
    cue: "Pulso intenso",
    reference: "impulso alto",
    rhythm: 0.92,
    load: 0.66,
    pulse: 0.95,
  },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const percent = (value: number) => `${Math.round(value * 100)}%`;
const fmt = (value: number) => value.toFixed(3);
const signedPercent = (value: number) => `${value >= 0 ? "+" : ""}${Math.round(value * 100)}%`;
const hexColor = (value: number) => `#${value.toString(16).padStart(6, "0")}`;
const defaultControls = { tau: 0.68, pi: 0.62, rho: 0.72, eps: 0.74, alpha: 0.7, eta: 0.66, lambda: 0.2, chi: 0.35, memory: 0.65 };

function asUnit(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? clamp01(value) : fallback;
}

function asMood(value: unknown): MoodKey {
  return typeof value === "string" && value in moodText ? (value as MoodKey) : "estable";
}

function sanitizeHistory(input: unknown): Entry[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item): Entry | null => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Partial<Entry>;
      return {
        id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
        date: typeof entry.date === "string" ? entry.date : new Date().toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" }),
        tau: asUnit(entry.tau, defaultControls.tau),
        pi: asUnit(entry.pi, defaultControls.pi),
        rho: asUnit(entry.rho, defaultControls.rho),
        eps: asUnit(entry.eps, defaultControls.eps),
        alpha: asUnit(entry.alpha, defaultControls.alpha),
        eta: asUnit(entry.eta, defaultControls.eta),
        phi: asUnit(entry.phi, 0),
        memory: asUnit(entry.memory, defaultControls.memory),
        vital: asUnit(entry.vital, 0),
        x: asUnit(entry.x, 0.5),
        y: asUnit(entry.y, 0.5),
        mood: asMood(entry.mood),
      };
    })
    .filter((entry): entry is Entry => Boolean(entry))
    .slice(0, 60);
}

function sanitizeTrail(input: unknown): TrailPoint[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item): TrailPoint | null => {
      if (!item || typeof item !== "object") return null;
      const point = item as Partial<TrailPoint>;
      return {
        id: typeof point.id === "string" ? point.id : crypto.randomUUID(),
        time: typeof point.time === "string" ? point.time : new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        x: asUnit(point.x, 0.5),
        y: asUnit(point.y, 0.5),
        vital: asUnit(point.vital, 0),
        mood: asMood(point.mood),
      };
    })
    .filter((point): point is TrailPoint => Boolean(point))
    .slice(-90);
}

function toScenePoint(point: { x: number; y: number; vital: number }) {
  return new THREE.Vector3((point.x - 0.5) * 8, 0.28 + point.vital * 3.8, (point.y - 0.5) * 8);
}

function toPlaneProjection(point: { x: number; y: number }) {
  return new THREE.Vector3((point.x - 0.5) * 8, 0.04, (point.y - 0.5) * 8);
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }
  material.dispose();
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const disposable = child as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    disposable.geometry?.dispose();
    if (disposable.material) disposeMaterial(disposable.material);
  });
}

function clearGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    disposeObject(child);
  }
}

function blendedMoodColor(from: MoodKey, to: MoodKey, amount = 0.65) {
  return new THREE.Color(moodTraceColor[from]).lerp(new THREE.Color(moodTraceColor[to]), amount);
}

function calculatePhi(tau: number, pi: number, rho: number, eps: number, alpha: number) {
  const calmPeace = Math.sqrt(tau * pi);
  const action = Math.sqrt(rho * eps);
  const normalizer = Math.log(1 + Math.sqrt(2));
  const guidedPassion = alpha * (Math.log(1 + Math.sqrt(tau * tau + pi * pi)) / normalizer);
  return clamp01((calmPeace + action + guidedPassion) / 3);
}

function updateMemory(previousMemory: number, phi: number, lambda: number) {
  const k = 1 - Math.exp(-lambda);
  return clamp01((1 - k) * previousMemory + k * phi);
}

function classifyMood(input: {
  tau: number;
  pi: number;
  rho: number;
  eps: number;
  alpha: number;
  eta: number;
  phi: number;
  memory: number;
  vital: number;
  x: number;
  y: number;
}): MoodKey {
  const { tau, pi, rho, eps, alpha, eta, phi, memory, vital, x, y } = input;
  const calm = x;
  const action = y;
  const strain = Math.max(0, (rho + eps) / 2 - (tau + pi) / 2);

  if (vital >= 0.75 && phi >= 0.68 && eta >= 0.62) return "pleno";
  if (eta < 0.35 && vital < 0.5) return "triste";
  if (strain > 0.35 && calm < 0.45 && action > 0.62) return "agotado";
  if (calm < 0.45 && action >= 0.55) return "preocupado";
  if (calm >= 0.6 && action < 0.42) return "serenoPasivo";
  if (alpha >= 0.72 && calm < 0.52 && memory < 0.62) return "intensoInestable";
  return "estable";
}

function loadState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeSessionInput(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveState(state: ControlState) {
  if (typeof window === "undefined") return;
  const payload: SavedState = {
    version: 2,
    tau: clamp01(state.tau),
    pi: clamp01(state.pi),
    rho: clamp01(state.rho),
    eps: clamp01(state.eps),
    alpha: clamp01(state.alpha),
    eta: clamp01(state.eta),
    lambda: clamp01(state.lambda),
    chi: clamp01(state.chi),
    memory: clamp01(state.memory),
    history: sanitizeHistory(state.history),
    trail: sanitizeTrail(state.trail),
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function summarizeSession({
  history,
  trail,
  current,
}: {
  history: Entry[];
  trail: TrailPoint[];
  current: { phi: number; memory: number; vital: number; mood: MoodKey; x: number; y: number };
}) {
  const entries = history.length > 0 ? history : [{ ...current, id: "current", date: "actual", tau: 0, pi: 0, rho: 0, eps: 0, alpha: 0, eta: 0 }];
  const average = (key: "phi" | "memory" | "vital") => entries.reduce((sum, entry) => sum + entry[key], 0) / entries.length;
  const moodCounts = [...history.map((entry) => entry.mood), current.mood].reduce<Record<MoodKey, number>>(
    (counts, mood) => ({ ...counts, [mood]: counts[mood] + 1 }),
    { pleno: 0, estable: 0, preocupado: 0, agotado: 0, triste: 0, serenoPasivo: 0, intensoInestable: 0 }
  );
  const best = entries.reduce((winner, entry) => (entry.vital > winner.vital ? entry : winner), entries[0]);
  const lowest = entries.reduce((winner, entry) => (entry.vital < winner.vital ? entry : winner), entries[0]);
  const trailDistance = trail.reduce((distance, point, index) => {
    const previous = trail[index - 1];
    if (!previous) return distance;
    return distance + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
  const moodSwitches = trail.reduce((count, point, index) => {
    const previous = trail[index - 1];
    return previous && previous.mood !== point.mood ? count + 1 : count;
  }, 0);

  return {
    averages: {
      phi: Number(average("phi").toFixed(4)),
      memory: Number(average("memory").toFixed(4)),
      vital: Number(average("vital").toFixed(4)),
    },
    current,
    bestVital: { date: best.date, value: Number(best.vital.toFixed(4)), mood: best.mood },
    lowestVital: { date: lowest.date, value: Number(lowest.vital.toFixed(4)), mood: lowest.mood },
    moodCounts,
    trail: {
      points: trail.length,
      distance: Number(trailDistance.toFixed(4)),
      moodSwitches,
    },
  };
}

function normalizeSessionInput(input: unknown): Partial<SavedState> | null {
  if (!input || typeof input !== "object") return null;
  const root = input as Record<string, unknown>;
  const controls = root.controls && typeof root.controls === "object" ? (root.controls as Record<string, unknown>) : root;
  const derived = root.derived && typeof root.derived === "object" ? (root.derived as Record<string, unknown>) : root;

  return {
    version: 2,
    tau: asUnit(controls.tau, defaultControls.tau),
    pi: asUnit(controls.pi, defaultControls.pi),
    rho: asUnit(controls.rho, defaultControls.rho),
    eps: asUnit(controls.eps, defaultControls.eps),
    alpha: asUnit(controls.alpha, defaultControls.alpha),
    eta: asUnit(controls.eta, defaultControls.eta),
    lambda: asUnit(controls.lambda, defaultControls.lambda),
    chi: asUnit(controls.chi, defaultControls.chi),
    memory: asUnit(root.memory ?? derived.memory, defaultControls.memory),
    history: sanitizeHistory(root.history),
    trail: sanitizeTrail(root.trail),
    savedAt: typeof root.savedAt === "string" ? root.savedAt : new Date().toISOString(),
  };
}

function buildSmoothPath(points: { cx: number; cy: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].cx} ${points[0].cy}`;
  if (points.length === 2) return `M ${points[0].cx} ${points[0].cy} L ${points[1].cx} ${points[1].cy}`;

  let path = `M ${points[0].cx} ${points[0].cy}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.cx + next.cx) / 2;
    const midY = (current.cy + next.cy) / 2;
    path += ` Q ${current.cx} ${current.cy} ${midX} ${midY}`;
  }

  const last = points[points.length - 1];
  return `${path} L ${last.cx} ${last.cy}`;
}

function Slider({
  label,
  symbol,
  value,
  onChange,
  helper,
  impact,
  tone = "neutral",
}: {
  label: string;
  symbol: string;
  value: number;
  helper: string;
  onChange: (value: number) => void;
  impact: string[];
  tone?: "calm" | "action" | "emotion" | "memory" | "value" | "neutral";
}) {
  return (
    <label className={`sliderCard slider-${tone}`} style={{ ["--control-value" as string]: percent(value) }}>
      <div className="sliderTop">
        <span className="sliderTitle">
          <strong>{label}</strong> <em>{symbol}</em>
        </span>
        <b>{percent(value)}</b>
      </div>
      <span className="controlMap" aria-label="Representación visual">
        {impact.map((item) => (
          <i key={item}>{item}</i>
        ))}
      </span>
      <span className="sliderRailPreview" aria-hidden="true">
        <em />
      </span>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(value * 100)}
        aria-label={`${label} ${symbol}`}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
      <small>{helper}</small>
    </label>
  );
}

function MetricCard({
  title,
  symbol,
  value,
  description,
  signal,
  tone = "neutral",
}: {
  title: string;
  symbol: string;
  value: number;
  description: string;
  signal: string;
  tone?: "calm" | "action" | "emotion" | "memory" | "value" | "neutral";
}) {
  return (
    <article className={`metricCard metric-${tone}`} style={{ ["--metric-value" as string]: percent(value) }}>
      <div>
        <span>{title}</span>
        <strong>{symbol}</strong>
      </div>
      <b>{percent(value)}</b>
      <progress value={value} max={1} />
      <small>{description}</small>
      <i>{signal}</i>
    </article>
  );
}

function CartesianPlane({
  x,
  y,
  vital,
  mood,
  history,
  trail,
}: {
  x: number;
  y: number;
  vital: number;
  mood: MoodKey;
  history: Entry[];
  trail: TrailPoint[];
}) {
  const width = 640;
  const height = 430;
  const padding = 54;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  const toCanvas = (point: { x: number; y: number }) => ({
    cx: padding + point.x * plotW,
    cy: padding + (1 - point.y) * plotH,
  });

  const current = toCanvas({ x, y });
  const trailWindow = trail.slice(-80);
  const lastTrail = trailWindow[trailWindow.length - 1];
  const needsCurrentPoint =
    !lastTrail || Math.hypot(lastTrail.x - x, lastTrail.y - y) > 0.002 || Math.abs(lastTrail.vital - vital) > 0.002;
  const liveTrail: TrailPoint[] = needsCurrentPoint
    ? [
        ...trailWindow.slice(-79),
        {
          id: "current-preview",
          time: "Ahora",
          x,
          y,
          vital,
          mood,
        },
      ]
    : trailWindow;
  const trailPath = buildSmoothPath(liveTrail.map(toCanvas));
  const savedPoints = history.slice(0, 10).reverse();
  const firstTrail = liveTrail[0] ?? { x, y };
  const labelX = Math.max(padding + 72, Math.min(width - padding - 72, current.cx));
  const labelY = Math.max(padding + 28, current.cy - 34);
  const visibleDotStep = Math.max(1, Math.ceil(liveTrail.length / 26));

  return (
    <section className="panel planePanel">
      <div className="panelHeader">
        <div>
          <h2>Plano cartesiano continuo</h2>
          <p>X = calma interior · Y = acción vital · color = valor vital</p>
        </div>
        <span className="pill">V(t): {percent(vital)}</span>
      </div>

      <svg className="plane" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Plano cartesiano de bienestar">
        <defs>
          <linearGradient id="zone" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0%" stopColor="#4d1f2d" />
            <stop offset="45%" stopColor="#735b2c" />
            <stop offset="100%" stopColor="#1d5c49" />
          </linearGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="trajectoryStroke" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0%" stopColor="#d5b36a" />
            <stop offset="55%" stopColor="#f2d68b" />
            <stop offset="100%" stopColor="#87d6b6" />
          </linearGradient>
          <marker id="arrowHead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 7 3.5 L 0 7 z" className="arrowHead" />
          </marker>
        </defs>

        <rect x={padding} y={padding} width={plotW} height={plotH} rx="26" fill="url(#zone)" opacity="0.18" />
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={padding + tick * plotW}
              x2={padding + tick * plotW}
              y1={padding}
              y2={height - padding}
              className="gridLine"
            />
            <line
              x1={padding}
              x2={width - padding}
              y1={padding + tick * plotH}
              y2={padding + tick * plotH}
              className="gridLine"
            />
            <text x={padding + tick * plotW} y={height - padding + 22} className="tickLabel" textAnchor="middle">
              {tick.toFixed(tick === 0 || tick === 1 ? 0 : 2)}
            </text>
            <text x={padding - 12} y={padding + (1 - tick) * plotH + 4} className="tickLabel" textAnchor="end">
              {tick.toFixed(tick === 0 || tick === 1 ? 0 : 2)}
            </text>
          </g>
        ))}

        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} className="axisLine" />
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} className="axisLine" />
        <line x1={padding + plotW / 2} x2={padding + plotW / 2} y1={padding} y2={height - padding} className="centerLine" />
        <line x1={padding} x2={width - padding} y1={padding + plotH / 2} y2={padding + plotH / 2} className="centerLine" />

        <text x={width / 2} y={height - 13} className="axisLabel" textAnchor="middle">
          Calma interior: (tranquilidad + paz) / 2
        </text>
        <text x="18" y={height / 2} className="axisLabel" transform={`rotate(-90 18 ${height / 2})`} textAnchor="middle">
          Acción vital: (responsabilidad + esfuerzo) / 2
        </text>

        <text x={padding + 12} y={height - padding - 14} className="zoneLabel">
          Bajo general
        </text>
        <text x={width - padding - 12} y={height - padding - 14} className="zoneLabel" textAnchor="end">
          Sereno pasivo
        </text>
        <text x={padding + 12} y={padding + 24} className="zoneLabel">
          Activo tenso
        </text>
        <text x={width - padding - 12} y={padding + 24} className="zoneLabel" textAnchor="end">
          Equilibrio alto
        </text>

        <line x1={current.cx} x2={current.cx} y1={current.cy} y2={height - padding} className="currentGuide" />
        <line x1={padding} x2={current.cx} y1={current.cy} y2={current.cy} className="currentGuide" />

        {savedPoints.map((entry, index) => {
          const saved = toCanvas(entry);
          return (
            <g key={entry.id} className="savedPoint">
              <circle cx={saved.cx} cy={saved.cy} r="10" />
              <text x={saved.cx} y={saved.cy + 4} textAnchor="middle">
                {index + 1}
              </text>
            </g>
          );
        })}

        {trailPath && liveTrail.length > 1 && (
          <>
            <path d={trailPath} className="trajectoryGlow" />
            <path d={trailPath} className="trajectoryLine" markerEnd="url(#arrowHead)" />
          </>
        )}

        {liveTrail.map((point, index) => {
          if (index !== liveTrail.length - 1 && index % visibleDotStep !== 0) return null;
          const dot = toCanvas(point);
          const opacity = 0.2 + ((index + 1) / liveTrail.length) * 0.62;
          return <circle key={point.id} cx={dot.cx} cy={dot.cy} r={2.8 + point.vital * 3.8} className="trailDot" opacity={opacity} />;
        })}

        <circle cx={current.cx} cy={current.cy} r={30 + vital * 14} className="pulse" />
        <circle cx={current.cx} cy={current.cy} r={13 + vital * 10} className="mainDot" filter="url(#softGlow)" />
        <text x={labelX} y={labelY} className="dotLabel" textAnchor="middle">
          Estado actual
        </text>
      </svg>

      <div className="planeReadout">
        <div>
          <span>Trazo vivo</span>
          <strong>{liveTrail.length} puntos</strong>
        </div>
        <div>
          <span>Calma X</span>
          <strong>{percent(x)}</strong>
        </div>
        <div>
          <span>Acción Y</span>
          <strong>{percent(y)}</strong>
        </div>
        <div>
          <span>Variación</span>
          <strong>
            {signedPercent(x - firstTrail.x)} X · {signedPercent(y - firstTrail.y)} Y
          </strong>
        </div>
      </div>
    </section>
  );
}

function CartesianPlane3D({
  x,
  y,
  vital,
  mood,
  history,
  trail,
  isPlaying,
  onTogglePlay,
  onClearTrail,
}: {
  x: number;
  y: number;
  vital: number;
  mood: MoodKey;
  history: Entry[];
  trail: TrailPoint[];
  isPlaying: boolean;
  onTogglePlay: () => void;
  onClearTrail: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<SceneHandles | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const trailWindow = trail.slice(-80);
  const lastTrail = trailWindow[trailWindow.length - 1];
  const needsCurrentPoint =
    !lastTrail || Math.hypot(lastTrail.x - x, lastTrail.y - y) > 0.002 || Math.abs(lastTrail.vital - vital) > 0.002;
  const liveTrail: TrailPoint[] = needsCurrentPoint
    ? [
        ...trailWindow.slice(-79),
        {
          id: "current-preview",
          time: "Ahora",
          x,
          y,
          vital,
          mood,
        },
      ]
    : trailWindow;
  const firstTrail = liveTrail[0] ?? { x, y };
  const visibleDotStep = Math.max(2, Math.ceil(liveTrail.length / 14));

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(6.7, 6.1, 8.2);
    camera.lookAt(0, 1.65, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Plano cartesiano 3D de bienestar");
    mount.appendChild(renderer.domElement);

    const stage = new THREE.Group();
    scene.add(stage);

    scene.add(new THREE.AmbientLight(0xe9eef5, 0.82));
    const keyLight = new THREE.DirectionalLight(0x8fb7ff, 1.45);
    keyLight.position.set(4, 7, 6);
    scene.add(keyLight);
    const warmLight = new THREE.PointLight(0x9bd7ff, 0.72, 18);
    warmLight.position.set(-4, 4, -5);
    scene.add(warmLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6, 8.6),
      new THREE.MeshStandardMaterial({
        color: 0x050608,
        transparent: true,
        opacity: 0.96,
        roughness: 0.9,
        metalness: 0.04,
        side: THREE.DoubleSide,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    stage.add(floor);

    const grid = new THREE.GridHelper(8.6, 8, 0x33565e, 0x1b2229);
    grid.position.y = 0.045;
    stage.add(grid);

    const xAxis = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-4.3, 0.08, 0), new THREE.Vector3(4.3, 0.08, 0)]),
      new THREE.LineBasicMaterial({ color: 0xd5b36a, transparent: true, opacity: 0.45 })
    );
    const yAxis = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.08, -4.3), new THREE.Vector3(0, 0.08, 4.3)]),
      new THREE.LineBasicMaterial({ color: 0x87d6b6, transparent: true, opacity: 0.46 })
    );
    const zAxis = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-4.35, 0, -4.35), new THREE.Vector3(-4.35, 4.25, -4.35)]),
      new THREE.LineBasicMaterial({ color: 0xe8edf4, transparent: true, opacity: 0.36 })
    );
    stage.add(xAxis, yAxis, zAxis);

    const currentSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 32, 18),
      new THREE.MeshStandardMaterial({
        color: 0x87d6b6,
        emissive: 0x123e34,
        emissiveIntensity: 0.48,
        roughness: 0.42,
        metalness: 0.12,
      })
    );
    stage.add(currentSphere);

    const currentRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.01, 8, 72),
      new THREE.MeshBasicMaterial({ color: 0xf2d68b, transparent: true, opacity: 0.58 })
    );
    currentRing.rotation.x = Math.PI / 2;
    stage.add(currentRing);

    const trailGroup = new THREE.Group();
    const dotGroup = new THREE.Group();
    const savedGroup = new THREE.Group();
    stage.add(trailGroup, dotGroup, savedGroup);

    const resize = () => {
      const width = Math.max(320, mount.clientWidth);
      const height = Math.max(360, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const handles: SceneHandles = {
      renderer,
      camera,
      scene,
      stage,
      currentSphere,
      currentRing,
      trailGroup,
      currentLine: null,
      dotGroup,
      savedGroup,
      frameId: 0,
    };
    handlesRef.current = handles;

    const animate = () => {
      stage.rotation.y += isPlayingRef.current ? 0.0042 : 0.0012;
      currentSphere.rotation.y += 0.028;
      currentRing.rotation.z += 0.018;
      renderer.render(scene, camera);
      handles.frameId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(handles.frameId);
      handlesRef.current = null;
      mount.removeChild(renderer.domElement);
      disposeObject(scene);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;

    const currentPosition = toScenePoint({ x, y, vital });
    const currentProjection = toPlaneProjection({ x, y });
    const activeColor = moodTraceColor[mood];
    const activeGlow = moodTraceGlow[mood];
    handles.currentSphere.position.copy(currentPosition);
    handles.currentSphere.scale.setScalar(0.72 + vital * 0.38);
    handles.currentSphere.material.color.setHex(activeColor);
    handles.currentSphere.material.emissive.setHex(activeGlow);
    handles.currentSphere.material.emissiveIntensity = 0.34 + vital * 0.18;
    handles.currentRing.position.copy(currentProjection);
    handles.currentRing.material.color.setHex(activeColor);
    handles.currentRing.material.opacity = 0.36 + vital * 0.2;

    if (handles.currentLine) {
      handles.stage.remove(handles.currentLine);
      disposeObject(handles.currentLine);
      handles.currentLine = null;
    }
    const currentLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([currentProjection, currentPosition]),
      new THREE.LineBasicMaterial({ color: activeColor, transparent: true, opacity: 0.2 })
    );
    handles.stage.add(currentLine);
    handles.currentLine = currentLine;

    clearGroup(handles.trailGroup);

    const linePoints = liveTrail.map(toScenePoint);
    if (linePoints.length > 1) {
      const faintBackbone = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(linePoints, false, "catmullrom", 0.18).getPoints(220)),
        new THREE.LineBasicMaterial({ color: 0xe8edf4, transparent: true, opacity: 0.08 })
      );
      handles.trailGroup.add(faintBackbone);

      for (let index = 1; index < linePoints.length; index += 1) {
        const start = linePoints[index - 1];
        const end = linePoints[index];
        const before = linePoints[Math.max(0, index - 2)];
        const after = linePoints[Math.min(linePoints.length - 1, index + 1)];
        const tangent = after.clone().sub(before).multiplyScalar(0.16);
        const curve = new THREE.CubicBezierCurve3(start, start.clone().add(tangent), end.clone().sub(tangent), end);
        const previousMood = liveTrail[index - 1].mood;
        const pointMood = liveTrail[index].mood;
        const segmentVital = liveTrail[index].vital;
        const blendedColor = blendedMoodColor(previousMood, pointMood);
        const glowGeometry = new THREE.TubeGeometry(curve, 10, 0.038 + segmentVital * 0.012, 8, false);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: blendedColor,
          transparent: true,
          opacity: 0.065 + segmentVital * 0.035,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const glowSegment = new THREE.Mesh(glowGeometry, glowMaterial);
        const geometry = new THREE.TubeGeometry(curve, 10, 0.011 + segmentVital * 0.006, 8, false);
        const material = new THREE.MeshBasicMaterial({
          color: blendedColor,
          transparent: true,
          opacity: 0.72 + segmentVital * 0.08,
          depthWrite: false,
        });
        const segment = new THREE.Mesh(geometry, material);
        handles.trailGroup.add(glowSegment, segment);
      }

      const lastPoint = liveTrail[liveTrail.length - 1];
      const lastColor = moodTraceColor[lastPoint.mood];
      const material = new THREE.MeshBasicMaterial({
        color: lastColor,
        transparent: true,
        opacity: 0.72,
      });
      const endMarker = new THREE.Mesh(new THREE.SphereGeometry(0.055 + lastPoint.vital * 0.025, 20, 12), material);
      endMarker.position.copy(toScenePoint(lastPoint));
      handles.trailGroup.add(endMarker);
    }

    clearGroup(handles.dotGroup);
    liveTrail.forEach((point, index) => {
      if (index !== liveTrail.length - 1 && index % visibleDotStep !== 0) return;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.022 + point.vital * 0.013, 12, 8),
        new THREE.MeshBasicMaterial({
          color: moodTraceColor[point.mood],
          transparent: true,
          opacity: index === liveTrail.length - 1 ? 0.64 : 0.36,
        })
      );
      dot.position.copy(toScenePoint(point));
      handles.dotGroup.add(dot);
    });

    clearGroup(handles.savedGroup);
    history
      .slice(0, 10)
      .reverse()
      .forEach((entry) => {
        const top = toScenePoint(entry);
        const height = Math.max(0.18, top.y);
        const column = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, height, 10),
          new THREE.MeshBasicMaterial({ color: 0xd5b36a, transparent: true, opacity: 0.54 })
        );
        column.position.set(top.x, height / 2, top.z);
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 18, 10),
          new THREE.MeshStandardMaterial({ color: 0xd5b36a, emissive: 0x3a2f16, emissiveIntensity: 0.42 })
        );
        marker.position.copy(top);
        handles.savedGroup.add(column, marker);
      });
  }, [history, liveTrail, mood, visibleDotStep, vital, x, y]);

  return (
    <section className={`panel planePanel planePanel3D ${isPlaying ? "isPlaying" : ""}`}>
      <div className="panelHeader">
        <div>
          <h2>Plano cartesiano 3D continuo</h2>
          <p>X = calma interior · Y = acción vital · altura = valor vital</p>
        </div>
        <div className="planeActions">
          <span className="pill">V(t): {percent(vital)}</span>
          <button type="button" className="playControl" onClick={onTogglePlay} aria-pressed={isPlaying}>
            {isPlaying ? "Pausa" : "Play"}
          </button>
          <button type="button" className="ghost compactButton" onClick={onClearTrail}>
            Limpiar trazo
          </button>
        </div>
      </div>

      <div className="plane3DStage" ref={mountRef}>
        <div className="plane3DOverlay" aria-hidden="true">
          <span className="axisTag xAxisTag">Calma X</span>
          <span className="axisTag yAxisTag">Acción Y</span>
          <span className="axisTag zAxisTag">Valor vital Z</span>
          <span className="playState">{isPlaying ? "Generando recorrido" : "Pausado"}</span>
        </div>
      </div>

      <div className="traceLegend" aria-label="Colores de la traza emocional">
        {moodProfiles.map((profile) => (
          <span key={profile.key} className={profile.key === mood ? "activeTraceChip" : undefined}>
            <i style={{ backgroundColor: hexColor(moodTraceColor[profile.key]), color: hexColor(moodTraceColor[profile.key]) }} />
            {profile.label}
          </span>
        ))}
      </div>

      <div className="planeReadout">
        <div>
          <span>Trazo vivo</span>
          <strong>{liveTrail.length} puntos</strong>
        </div>
        <div>
          <span>Calma X</span>
          <strong>{percent(x)}</strong>
        </div>
        <div>
          <span>Acción Y</span>
          <strong>{percent(y)}</strong>
        </div>
        <div>
          <span>Variación</span>
          <strong>
            {signedPercent(x - firstTrail.x)} X · {signedPercent(y - firstTrail.y)} Y
          </strong>
        </div>
      </div>
    </section>
  );
}

function Avatar({ mood, vital, phi, memory, eta, alpha }: { mood: MoodKey; vital: number; phi: number; memory: number; eta: number; alpha: number }) {
  const motion = avatarMotion[mood];
  const speed = Math.max(0.62, motion.tempo - vital * 0.18);
  const tilt = motion.tilt;
  const sad = mood === "triste" || mood === "agotado";
  const worried = mood === "preocupado" || mood === "intensoInestable";
  const happy = mood === "pleno" || (eta > 0.6 && vital > 0.55);
  const stride = motion.stride;
  const activeProfile = moodProfiles.find((profile) => profile.key === mood) ?? moodProfiles[1];
  const tired = mood === "agotado";
  const lowMood = mood === "triste";
  const intense = mood === "intensoInestable";
  const stageBars = [
    { label: "ritmo", value: clamp01(motion.rhythm * 0.7 + vital * 0.3) },
    { label: "carga", value: clamp01(motion.load * 0.7 + (1 - phi) * 0.3) },
    { label: "pulso", value: clamp01(motion.pulse * 0.7 + alpha * 0.3) },
  ];
  const waveBars = Array.from({ length: 16 }, (_, index) => {
    const pulseCurve = Math.abs(Math.sin(index * 0.72 + alpha * 2.6));
    const rhythmBase = stageBars[0].value * 0.42;
    const pulseLift = stageBars[2].value * pulseCurve * 0.44;
    const loadWeight = stageBars[1].value * 0.18;
    return clamp01(0.12 + rhythmBase + pulseLift - loadWeight);
  });
  const factorBars = [
    { label: "Alegría", value: eta, detail: "gesto" },
    { label: "Armonía", value: phi, detail: "postura" },
    { label: "Memoria", value: memory, detail: "estabilidad" },
    { label: "Pasión", value: alpha, detail: "impulso" },
  ];

  return (
    <section className={`panel avatarPanel mood-${mood}`}>
      <div className="panelHeader">
        <div>
          <h2>Avatar emocional</h2>
          <p>Traducción visual de la ecuación</p>
        </div>
        <span className="pill">{moodText[mood]}</span>
      </div>

      <div
        className="avatarStage"
        style={{
          ["--emotion-color" as string]: hexColor(moodTraceColor[mood]),
          ["--stage-tempo" as string]: `${speed}s`,
          ["--emotion-rhythm" as string]: stageBars[0].value.toFixed(2),
          ["--emotion-load" as string]: stageBars[1].value.toFixed(2),
          ["--emotion-pulse" as string]: stageBars[2].value.toFixed(2),
        }}
      >
        <div className="emotionAura" aria-hidden="true" />
        <div className="emotionWeather" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
        <div className="emotionWave" aria-hidden="true">
          {waveBars.map((height, index) => (
            <span key={index} style={{ height: percent(height), animationDelay: `${index * -0.08}s` }} />
          ))}
        </div>
        <div className="emotionCue" aria-live="polite">
          <b>{motion.cue}</b>
          <span>{motion.reference}</span>
        </div>
        <div className="emotionStageGraph" aria-label="Lectura corporal del estado emocional">
          {stageBars.map((bar, index) => (
            <span key={bar.label}>
              <i>
                <em style={{ height: percent(bar.value), animationDelay: `${index * -0.18}s` }} />
              </i>
              <b>{bar.label}</b>
            </span>
          ))}
        </div>
        <div className="emotionFootsteps" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
        <div className="path">
          <span />
          <span />
          <span />
        </div>
        <svg
          className={`avatar ${stride}`}
          style={{ ["--speed" as string]: `${speed}s`, ["--tilt" as string]: `${tilt}deg` }}
          viewBox="0 0 260 260"
          role="img"
          aria-label="Avatar caminando según el estado de ánimo"
        >
          <g className="bodyGroup" transform="translate(0 0)">
            <ellipse cx="130" cy="235" rx="45" ry="8" className="shadow" />
            <g className="torso" transform={`rotate(${tilt} 130 126)`}>
              <path d="M107 105 Q130 92 153 105 L147 157 Q130 173 113 157 Z" className="loadShape" />
              <circle cx="130" cy="127" r="31" className="breathRing" />
              <path d="M96 47 Q130 25 164 47" className="calmHalo" />
              <path d="M106 133 L119 133 L124 123 L131 145 L138 130 L153 130" className="chestPulse" />
              <line x1="130" y1="92" x2="130" y2="158" className="avatarStroke torsoLine" />
              <line x1="130" y1="114" x2="92" y2="143" className="avatarStroke arm leftArm" />
              <line x1="130" y1="114" x2="168" y2="143" className="avatarStroke arm rightArm" />
              <line x1="130" y1="158" x2="98" y2="210" className="avatarStroke leg leftLeg" />
              <line x1="130" y1="158" x2="162" y2="210" className="avatarStroke leg rightLeg" />
              <circle cx="130" cy="65" r="31" className="head" />
              {tired ? (
                <>
                  <path d="M114 60 Q119 58 124 60" className="eyeLine" />
                  <path d="M136 60 Q141 58 146 60" className="eyeLine" />
                </>
              ) : (
                <>
                  <circle cx="119" cy="59" r={intense ? 3 : 3.5} className="eye" />
                  <circle cx="141" cy="59" r={intense ? 3 : 3.5} className="eye" />
                </>
              )}
              {happy && <path d="M116 73 Q130 84 145 73" className="mouth" />}
              {sad && <path d="M116 80 Q130 68 145 80" className="mouth" />}
              {worried && <path d="M116 76 Q130 72 145 76" className="mouth" />}
              {!happy && !sad && !worried && <path d="M117 75 L144 75" className="mouth" />}
              <path d="M154 58 C164 69 163 77 155 80 C148 76 149 67 154 58 Z" className="sweatDrop" />
              <path d="M148 73 C154 82 152 89 145 91 C140 86 142 80 148 73 Z" className="tearDrop" />
              <g className="tensionMarks">
                <path d="M95 43 L84 35" />
                <path d="M165 43 L176 35" />
                <path d="M130 26 L130 14" />
              </g>
              {worried && (
                <>
                  <path d="M112 50 L124 47" className="brow" />
                  <path d="M136 47 L148 50" className="brow" />
                </>
              )}
              {tired && (
                <>
                  <path d="M111 51 Q118 55 125 53" className="brow" />
                  <path d="M135 53 Q142 55 149 51" className="brow" />
                </>
              )}
              {lowMood && (
                <>
                  <path d="M111 49 L124 52" className="brow" />
                  <path d="M136 52 L149 49" className="brow" />
                </>
              )}
            </g>
          </g>
        </svg>
      </div>

      <div className="avatarReadout">
        <article className="currentEmotion">
          <span>Estado detectado</span>
          <h3>{moodText[mood]}</h3>
          <p>{moodExplanation[mood]}</p>
          <small>{activeProfile.signal}</small>
        </article>

        <div className="emotionFactors">
          {factorBars.map((factor) => (
            <span key={factor.label}>
              <b>{factor.label}</b>
              <i>
                <em style={{ width: percent(factor.value) }} />
              </i>
              <small>
                {percent(factor.value)} · {factor.detail}
              </small>
            </span>
          ))}
        </div>

        <div className="emotionLegend" aria-label="Guía de emociones">
          {moodProfiles.map((profile) => (
            <article key={profile.key} className={profile.key === mood ? "activeEmotion" : undefined}>
              <strong>{profile.label}</strong>
              <small>{profile.signal}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FormulaBlock({
  lambda,
  chi,
  k,
  phi,
  memory,
  vital,
  mood,
}: {
  lambda: number;
  chi: number;
  k: number;
  phi: number;
  memory: number;
  vital: number;
  mood: MoodKey;
}) {
  const steps = [
    {
      index: "01",
      title: "Armonía presente",
      symbol: "Φ(t)",
      value: phi,
      formula: "⅓[√(τπ) + √(ρε) + α · log(1 + √(τ² + π²)) / log(1 + √2)]",
      role: "Calcula el clima del instante.",
      output: "avatar + color",
    },
    {
      index: "02",
      title: "Memoria interior",
      symbol: "Mₜ",
      value: memory,
      formula: "(1 − k)Mₜ₋₁ + kΦₜ",
      role: "Suaviza lo vivido con lo reciente.",
      output: "trazo + estabilidad",
    },
    {
      index: "03",
      title: "Valor vital",
      symbol: "V(t)",
      value: vital,
      formula: "(1 − χ)M(t) + χη(t)",
      role: "Une memoria interior y alegría presente.",
      output: "altura 3D",
    },
  ];

  return (
    <section className="panel formulaPanel">
      <div className="panelHeader formulaHeader">
        <div>
          <h2>Modelo usado por la app</h2>
          <p>Cadena visual de la ecuación que mueve el plano y el avatar.</p>
        </div>
        <span className="pill">{moodText[mood]}</span>
      </div>

      <div className="formulaFlow">
        {steps.map((step) => (
          <article key={step.symbol} className="formulaStep">
            <div className="formulaStepTop">
              <span>{step.index}</span>
              <strong>{step.title}</strong>
              <b>{step.symbol}</b>
            </div>
            <code>{step.symbol} = {step.formula}</code>
            <div className="formulaStepBottom">
              <small>{step.role}</small>
              <i>{step.output}</i>
            </div>
            <div className="formulaLive">
              <span>
                <em style={{ width: percent(step.value) }} />
              </span>
              <b>{percent(step.value)}</b>
            </div>
          </article>
        ))}
      </div>

      <div className="formulaChain" aria-label="Flujo del modelo">
        <span>Φ(t)</span>
        <i />
        <span>M(t)</span>
        <i />
        <span>V(t)</span>
      </div>

      <div className="formulaConstants">
        <span>
          <b>λ</b>
          actualización {percent(lambda)}
        </span>
        <span>
          <b>k</b>
          memoria nueva {k.toFixed(3)}
        </span>
        <span>
          <b>χ</b>
          peso alegría {percent(chi)}
        </span>
      </div>
    </section>
  );
}

export default function Home() {
  const [tau, setTau] = useState(0.68);
  const [pi, setPi] = useState(0.62);
  const [rho, setRho] = useState(0.72);
  const [eps, setEps] = useState(0.74);
  const [alpha, setAlpha] = useState(0.7);
  const [eta, setEta] = useState(0.66);
  const [lambda, setLambda] = useState(0.2);
  const [chi, setChi] = useState(0.35);
  const [memory, setMemory] = useState(0.65);
  const [history, setHistory] = useState<Entry[]>([]);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);
  const autoPhaseRef = useRef(0);
  const autoCenterRef = useRef({ tau: 0.68, pi: 0.62, rho: 0.72, eps: 0.74, alpha: 0.7, eta: 0.66 });
  const currentValuesRef = useRef({ tau: 0.68, pi: 0.62, rho: 0.72, eps: 0.74, alpha: 0.7, eta: 0.66 });

  function applySessionState(input: unknown, stopPlayback = true) {
    const saved = normalizeSessionInput(input);
    if (!saved) return false;
    const next = {
      tau: asUnit(saved.tau, defaultControls.tau),
      pi: asUnit(saved.pi, defaultControls.pi),
      rho: asUnit(saved.rho, defaultControls.rho),
      eps: asUnit(saved.eps, defaultControls.eps),
      alpha: asUnit(saved.alpha, defaultControls.alpha),
      eta: asUnit(saved.eta, defaultControls.eta),
      lambda: asUnit(saved.lambda, defaultControls.lambda),
      chi: asUnit(saved.chi, defaultControls.chi),
      memory: asUnit(saved.memory, defaultControls.memory),
      history: sanitizeHistory(saved.history),
      trail: sanitizeTrail(saved.trail),
    };
    setTau(next.tau);
    setPi(next.pi);
    setRho(next.rho);
    setEps(next.eps);
    setAlpha(next.alpha);
    setEta(next.eta);
    setLambda(next.lambda);
    setChi(next.chi);
    setMemory(next.memory);
    setHistory(next.history);
    setTrail(next.trail);
    autoCenterRef.current = { tau: next.tau, pi: next.pi, rho: next.rho, eps: next.eps, alpha: next.alpha, eta: next.eta };
    currentValuesRef.current = { tau: next.tau, pi: next.pi, rho: next.rho, eps: next.eps, alpha: next.alpha, eta: next.eta };
    if (stopPlayback) setIsPlaying(false);
    return true;
  }

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      applySessionState(saved, false);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timeoutId = window.setTimeout(() => {
      saveState({ tau, pi, rho, eps, alpha, eta, lambda, chi, memory, history, trail });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [tau, pi, rho, eps, alpha, eta, lambda, chi, memory, history, trail, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const flushState = () => saveState({ tau, pi, rho, eps, alpha, eta, lambda, chi, memory, history, trail });
    window.addEventListener("pagehide", flushState);
    return () => window.removeEventListener("pagehide", flushState);
  }, [tau, pi, rho, eps, alpha, eta, lambda, chi, memory, history, trail, mounted]);

  useEffect(() => {
    currentValuesRef.current = { tau, pi, rho, eps, alpha, eta };
  }, [tau, pi, rho, eps, alpha, eta]);

  useEffect(() => {
    if (!mounted) return;
    const handleDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    const handleDrop = async (event: DragEvent) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      event.preventDefault();
      if (!file.name.toLowerCase().endsWith(".json")) return;
      try {
        const parsed = JSON.parse(await file.text());
        applySessionState(parsed);
      } catch {
        // Invalid imports are ignored so the current session is not damaged.
      }
    };
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [mounted]);

  const phi = useMemo(() => calculatePhi(tau, pi, rho, eps, alpha), [tau, pi, rho, eps, alpha]);
  const k = useMemo(() => 1 - Math.exp(-lambda), [lambda]);
  const previewMemory = useMemo(() => updateMemory(memory, phi, lambda), [memory, phi, lambda]);
  const vital = useMemo(() => clamp01((1 - chi) * previewMemory + chi * eta), [chi, previewMemory, eta]);
  const x = useMemo(() => clamp01((tau + pi) / 2), [tau, pi]);
  const y = useMemo(() => clamp01((rho + eps) / 2), [rho, eps]);
  const mood = useMemo(
    () => classifyMood({ tau, pi, rho, eps, alpha, eta, phi, memory: previewMemory, vital, x, y }),
    [tau, pi, rho, eps, alpha, eta, phi, previewMemory, vital, x, y]
  );

  useEffect(() => {
    if (!mounted) return;

    setTrail((prev) => {
      const last = prev[prev.length - 1];
      const samePosition = last && Math.hypot(last.x - x, last.y - y) < 0.006;
      const sameVital = last && Math.abs(last.vital - vital) < 0.006;
      if (samePosition && sameVital && last.mood === mood) return prev;

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          time: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          x,
          y,
          vital,
          mood,
        },
      ].slice(-90);
    });
  }, [x, y, vital, mood, mounted]);

  useEffect(() => {
    if (!mounted || !isPlaying) return;

    const interval = window.setInterval(() => {
      autoPhaseRef.current += 0.18;
      const t = autoPhaseRef.current;
      const center = autoCenterRef.current;
      const current = currentValuesRef.current;
      const smooth = 0.28;
      const targetTau = clamp01(center.tau + 0.22 * Math.sin(t * 0.72) + 0.08 * Math.sin(t * 1.73 + 0.8));
      const targetPi = clamp01(center.pi + 0.22 * Math.sin(t * 0.61 + 1.4) + 0.07 * Math.sin(t * 1.31));
      const targetRho = clamp01(center.rho + 0.24 * Math.sin(t * 0.83 + 2.1) + 0.06 * Math.sin(t * 2.04 + 1.2));
      const targetEps = clamp01(center.eps + 0.24 * Math.sin(t * 0.97 + 0.2) + 0.08 * Math.sin(t * 1.53 + 2.3));
      const targetAlpha = clamp01(center.alpha + 0.2 * Math.sin(t * 0.54 + 2.8) + 0.13 * Math.sin(t * 1.17 + 0.4));
      const targetEta = clamp01(center.eta + 0.22 * Math.sin(t * 0.68 + 0.7) + 0.08 * Math.sin(t * 1.91 + 0.6));
      const nextTau = clamp01(current.tau + (targetTau - current.tau) * smooth);
      const nextPi = clamp01(current.pi + (targetPi - current.pi) * smooth);
      const nextRho = clamp01(current.rho + (targetRho - current.rho) * smooth);
      const nextEps = clamp01(current.eps + (targetEps - current.eps) * smooth);
      const nextAlpha = clamp01(current.alpha + (targetAlpha - current.alpha) * smooth);
      const nextEta = clamp01(current.eta + (targetEta - current.eta) * smooth);
      const nextPhi = calculatePhi(nextTau, nextPi, nextRho, nextEps, nextAlpha);

      setTau(nextTau);
      setPi(nextPi);
      setRho(nextRho);
      setEps(nextEps);
      setAlpha(nextAlpha);
      setEta(nextEta);
      setMemory((prev) => updateMemory(prev, nextPhi, lambda));
    }, 140);

    return () => window.clearInterval(interval);
  }, [isPlaying, lambda, mounted]);

  function togglePlay() {
    setIsPlaying((prev) => {
      if (!prev) {
        autoCenterRef.current = { tau, pi, rho, eps, alpha, eta };
      }
      return !prev;
    });
  }

  function clearTrail() {
    setTrail([]);
  }

  function saveDay() {
    const entry: Entry = {
      id: crypto.randomUUID(),
      date: new Date().toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" }),
      tau,
      pi,
      rho,
      eps,
      alpha,
      eta,
      phi,
      memory: previewMemory,
      vital,
      x,
      y,
      mood,
    };
    setMemory(previewMemory);
    setHistory((prev) => [entry, ...prev].slice(0, 60));
  }

  function resetAll() {
    setTau(0.68);
    setPi(0.62);
    setRho(0.72);
    setEps(0.74);
    setAlpha(0.7);
    setEta(0.66);
    setLambda(0.2);
    setChi(0.35);
    setMemory(0.65);
    setHistory([]);
    setTrail([]);
    setIsPlaying(false);
    autoPhaseRef.current = 0;
    autoCenterRef.current = { tau: 0.68, pi: 0.62, rho: 0.72, eps: 0.74, alpha: 0.7, eta: 0.66 };
    currentValuesRef.current = { tau: 0.68, pi: 0.62, rho: 0.72, eps: 0.74, alpha: 0.7, eta: 0.66 };
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  }

  function downloadJson() {
    const current = { phi, memory: previewMemory, vital, mood, x, y };
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      controls: { tau, pi, rho, eps, alpha, eta, lambda, chi },
      derived: current,
      summary: summarizeSession({ history, trail, current }),
      trail,
      history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `formula-bienestar-sesion-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!mounted) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        Boolean(target?.isContentEditable);
      if (isEditing) return;

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveDay();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        downloadJson();
        return;
      }

      if (event.key === "Escape") setIsPlaying(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [alpha, chi, eps, eta, history, lambda, memory, mounted, phi, pi, previewMemory, rho, tau, trail, vital, x, y, mood]);

  const parametersPanel = (
    <section className="panel parametersPanel">
      <h2>Parámetros</h2>
      <Slider
        label="Memoria / actualización"
        symbol="λ"
        value={lambda}
        onChange={setLambda}
        helper="Alto = lo reciente pesa más."
        impact={["M(t)", "Trazo", "Suavidad"]}
        tone="memory"
      />
      <Slider
        label="Peso de alegría presente"
        symbol="χ"
        value={chi}
        onChange={setChi}
        helper="Alto = domina el estado inmediato."
        impact={["η(t)", "V(t)", "Avatar"]}
        tone="value"
      />
      <div className="buttonRow">
        <button onClick={saveDay}>Guardar día</button>
        <button className="secondary" onClick={downloadJson}>
          Exportar
        </button>
        <button className="ghost" onClick={resetAll}>
          Reiniciar
        </button>
      </div>
    </section>
  );

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Simulador visual interactivo</p>
          <h1>Fórmula del Bienestar</h1>
          <p>
            Mueve las variables, observa el punto en el plano cartesiano y mira cómo cambia el avatar: más firme, sereno,
            preocupado, triste o agotado según la ecuación.
          </p>
        </div>
        <div className="heroScore">
          <span>Valor vital total</span>
          <strong>{percent(vital)}</strong>
          <small>V(t) = {fmt(vital)}</small>
        </div>
      </section>

      <section className="dashboard">
        <div className="leftColumn">
          <CartesianPlane3D
            x={x}
            y={y}
            vital={vital}
            mood={mood}
            history={history}
            trail={trail}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onClearTrail={clearTrail}
          />
          <Avatar mood={mood} vital={vital} phi={phi} memory={previewMemory} eta={eta} alpha={alpha} />
          {parametersPanel}
        </div>

        <aside className="rightColumn">
          <section className="panel controlsPanel">
            <div className="panelHeader">
              <div>
                <h2>Variables</h2>
                <p>Escala de 0 a 1</p>
              </div>
            </div>

            <Slider
              label="Tranquilidad"
              symbol="τ(t)"
              value={tau}
              onChange={setTau}
              helper="Calma mental del momento."
              impact={["Plano X", "Avatar calma", "Φ(t)"]}
              tone="calm"
            />
            <Slider
              label="Paz"
              symbol="π(t)"
              value={pi}
              onChange={setPi}
              helper="Ausencia de conflicto interno."
              impact={["Plano X", "Avatar calma", "Φ(t)"]}
              tone="calm"
            />
            <Slider
              label="Responsabilidad"
              symbol="ρ(t)"
              value={rho}
              onChange={setRho}
              helper="Orden, compromiso y dirección."
              impact={["Plano Y", "Avatar ritmo", "Φ(t)"]}
              tone="action"
            />
            <Slider
              label="Esfuerzo"
              symbol="ε(t)"
              value={eps}
              onChange={setEps}
              helper="Energía aplicada a la acción."
              impact={["Plano Y", "Avatar carga", "Φ(t)"]}
              tone="action"
            />
            <Slider
              label="Pasión"
              symbol="α(t)"
              value={alpha}
              onChange={setAlpha}
              helper="Impulso vital guiado por calma."
              impact={["Avatar pulso", "Brillo", "Φ(t)"]}
              tone="emotion"
            />
            <Slider
              label="Alegría presente"
              symbol="η(t)"
              value={eta}
              onChange={setEta}
              helper="Estado emocional inmediato."
              impact={["Avatar gesto", "Estado", "V(t)"]}
              tone="emotion"
            />
          </section>

          <section className="metricsGrid">
            <MetricCard
              title="Armonía presente"
              symbol="Φ(t)"
              value={phi}
              description="Calma, acción y pasión guiada."
              signal="Forma postura y color"
              tone="calm"
            />
            <MetricCard
              title="Memoria interior"
              symbol="M(t)"
              value={previewMemory}
              description="Acumulación ponderada de lo vivido."
              signal="Suaviza el recorrido"
              tone="memory"
            />
            <MetricCard
              title="Valor vital"
              symbol="V(t)"
              value={vital}
              description="Memoria interior + alegría presente."
              signal="Altura del plano 3D"
              tone="value"
            />
          </section>

        </aside>
      </section>

      <FormulaBlock lambda={lambda} chi={chi} k={k} phi={phi} memory={previewMemory} vital={vital} mood={mood} />

      <section className="panel historyPanel">
        <div className="panelHeader">
          <div>
            <h2>Historial</h2>
            <p>Los últimos registros guardados quedan en el navegador.</p>
          </div>
          <span className="pill">{history.length} registros</span>
        </div>

        {history.length === 0 ? (
          <p className="empty">Todavía no hay registros. Mueve las variables y presiona “Guardar día”.</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Φ(t)</th>
                  <th>M(t)</th>
                  <th>V(t)</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>{moodText[entry.mood]}</td>
                    <td>{fmt(entry.phi)}</td>
                    <td>{fmt(entry.memory)}</td>
                    <td>{fmt(entry.vital)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
