// Node-oriented editable pro deck builder.
// Run this after editing SLIDES, SOURCES, and layout functions.
// The init script installs a sibling node_modules/@oai/artifact-tool package link
// and package.json with type=module for shell-run eval builders. Run with the
// Node executable from Codex workspace dependencies or the platform-appropriate
// command emitted by the init script.
// Do not use pnpm exec from the repo root or any Node binary whose module
// lookup cannot resolve the builder's sibling node_modules/@oai/artifact-tool.

const fs = await import("node:fs/promises");
const path = await import("node:path");
const { Presentation, PresentationFile } = await import("@oai/artifact-tool");

const W = 1280;
const H = 720;

const DECK_ID = "sentinal-project-deck";
const OUT_DIR = "/Users/riteshkumar/Downloads/PROJECTS/Sentinal Platform/presentation/outputs/sentinal-project-deck";
const REF_DIR = "/Users/riteshkumar/Downloads/PROJECTS/Sentinal Platform/tmp/slides/sentinal-project-deck/reference";
const SCRATCH_DIR = path.resolve(process.env.PPTX_SCRATCH_DIR || path.join("tmp", "slides", DECK_ID));
const PREVIEW_DIR = path.join(SCRATCH_DIR, "preview");
const VERIFICATION_DIR = path.join(SCRATCH_DIR, "verification");
const INSPECT_PATH = path.join(SCRATCH_DIR, "inspect.ndjson");
const MAX_RENDER_VERIFY_LOOPS = 3;

const INK = "#EAF4F7";
const GRAPHITE = "#9CB7BE";
const MUTED = "#6D8790";
const PAPER = "#040A14";
const PAPER_96 = "#0A1423F2";
const WHITE = "#FFFFFF";
const ACCENT = "#25D58A";
const ACCENT_DARK = "#1AA8D8";
const GOLD = "#F4B547";
const CORAL = "#FF6B6B";
const SURFACE = "#0B1627";
const SURFACE_2 = "#101F35";
const SURFACE_3 = "#0E1A2D";
const CYAN = "#1DDCFF";
const INDIGO = "#7C6BFF";
const TRANSPARENT = "#00000000";

const TITLE_FACE = "Caladea";
const BODY_FACE = "Lato";
const MONO_FACE = "Aptos Mono";

const FALLBACK_PLATE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const SOURCES = {
  readme: "Sentinal Platform README.md - project overview, recovery flow, architecture, endpoints, and deployment model.",
  wizard: "frontend/src/components/ec2/InstanceRegistrationWizard.jsx - onboarding flow, role/stack guidance, Node Exporter, Prometheus, and Grafana installation steps.",
  dashboard: "frontend/src/pages/DashboardPage.jsx - current instances dashboard, chat workspace, snapshot selection, and embedded Grafana metrics UI.",
  aiService: "Sentinal AI/sentinel_ai_agent.py - lifecycle snapshot analysis prompt, SambaNova-backed AI flow, and analysis output contract.",
  apiService: "frontend/src/services/ec2Service.js - frontend API calls for incidents, metrics, and /ai/agenticai/analyse.",
};

const SLIDES = [
  {
    kicker: "Sentinal Platform",
    title: "AI-powered EC2 monitoring, recovery, and incident analysis",
    subtitle: "A cloud operations platform that monitors live instances, performs deterministic self-healing, captures full incident lifecycles, and explains failures through an integrated AI workspace.",
    expectedVisual: "Executive title slide with bold framing and product positioning.",
    moment: "Monitor. Recover. Explain.",
    notes: "Open by positioning Sentinal as a single control center for cloud reliability teams managing EC2 fleets.",
    sources: ["readme", "dashboard"],
  },
  {
    kicker: "Problem",
    title: "Cloud incidents are still too manual, fragmented, and slow to explain",
    subtitle: "Operators often jump between cloud consoles, metrics dashboards, logs, and notes before they even understand what failed first.",
    expectedVisual: "Three problem cards with operational pain points.",
    cards: [
      ["Reactive troubleshooting", "Teams usually discover issues after service degradation, then spend valuable time reconstructing the incident from scattered tools and timestamps."],
      ["Disconnected telemetry", "Instance state, health checks, infrastructure metrics, and remediation actions often live in separate systems with no unified operator workflow."],
      ["Weak post-incident insight", "Even after recovery or termination, many teams keep only fragments of evidence instead of one complete timeline that can be analysed later."],
    ],
    notes: "Frame the pain in terms of MTTR, cognitive overload, and poor institutional memory after incidents.",
    sources: ["readme"],
  },
  {
    kicker: "Solution",
    title: "Sentinal turns EC2 monitoring into an operational control center",
    subtitle: "The platform combines monitoring, recovery orchestration, observability, and AI incident explanation in one product experience.",
    expectedVisual: "Metric summary cards that communicate the shape of the solution.",
    metrics: [
      ["15 s", "Polling cadence", "README: Sentinal continuously polls registered EC2 instances every 15 seconds."],
      ["1", "Lifecycle snapshot per incident", "Closed incidents are sealed into one record covering the full path from SUSPECT to UP or TERMINATED."],
      ["3", "Core operator surfaces", "Instances dashboard, Grafana metrics workspace, and AI chat analysis screen."],
    ],
    notes: "This slide should make the product feel cohesive: not just monitoring, but action plus explanation.",
    sources: ["readme", "dashboard"],
  },
  {
    kicker: "Onboarding",
    title: "The onboarding flow mirrors the real backend contract",
    subtitle: "Users register ownership and location first, then grant cross-account access, then install the monitoring stack the platform depends on.",
    expectedVisual: "Three cards describing the onboarding sequence.",
    cards: [
      ["Instance registration", "The flow starts with AWS account ID, EC2 instance ID, region, and a friendly nickname so the backend can identify and track the target."],
      ["Role or stack setup", "Sentinal uses cross-account IAM. Users create a role or CloudFormation stack in their own AWS account instead of sharing credentials directly."],
      ["Monitoring stack guidance", "After permissions are ready, the platform guides users through installing Node Exporter, Prometheus, and Grafana so metrics can be scraped and embedded."],
    ],
    notes: "Call out that this is already reflected in the frontend wizard and designed to reduce onboarding friction.",
    sources: ["wizard", "readme"],
  },
  {
    kicker: "Recovery Engine",
    title: "A deterministic state machine drives self-healing decisions",
    subtitle: "Sentinal does not rely on vague heuristics alone. It follows explicit state transitions and records each step of the recovery attempt.",
    expectedVisual: "Three cards describing the lifecycle phases.",
    cards: [
      ["UP → SUSPECT", "When health checks begin to fail, the instance first enters SUSPECT and the platform starts an incident timeline instead of making an immediate irreversible decision."],
      ["SUSPECT → QUARANTINED", "Repeated degradation escalates the incident into quarantine, where recovery policies, strike counts, and automated actions are applied in a controlled way."],
      ["Resolved or terminated", "The incident ends either in recovery back to UP or final termination. That final outcome seals the lifecycle snapshot for later review and AI analysis."],
    ],
    notes: "Emphasize reliability and auditability: the flow is deterministic, explainable, and backed by stored state transitions.",
    sources: ["readme"],
  },
  {
    kicker: "Architecture",
    title: "The architecture separates product UX, control logic, telemetry, and AI reasoning",
    subtitle: "Sentinal is designed as a layered system so each concern remains independently understandable and maintainable.",
    expectedVisual: "Three architecture metric cards showing the main platform layers.",
    metrics: [
      ["React", "Operator frontend", "Instances dashboard, registration wizard, snapshot-aware chat workspace, and embedded Grafana metrics."],
      ["Spring Boot", "Registry backend", "Owns users, instances, incidents, lifecycle state, metrics access, and secure API endpoints."],
      ["FastAPI + SambaNova", "AI analysis service", "Consumes selected lifecycle snapshots and returns root cause, remediation, and combined analysis text."],
    ],
    notes: "Walk left to right from user-facing UI to control plane to external integrations and AI reasoning.",
    sources: ["readme", "dashboard", "aiService"],
  },
  {
    kicker: "Backend Flow",
    title: "The backend control plane owns lifecycle state, incidents, and operator-safe actions",
    subtitle: "The Spring Boot registry is more than CRUD. It coordinates polling, recovery transitions, metrics access, and persistence for every monitored instance.",
    expectedVisual: "Three technical cards describing the backend flow.",
    cards: [
      ["Polling and state evaluation", "Every 15 seconds the backend checks instance health through AWS APIs, evaluates monitor state, and decides whether the instance remains UP or enters incident handling."],
      ["Incident orchestration", "When degradation starts, the backend opens an incident, tracks suspect strikes and quarantine cycles, and records each transition until the lifecycle resolves."],
      ["Operator and system actions", "The same control plane exposes reset, stop, start, metrics, incident history, and manual AI analysis endpoints so the UI stays aligned with backend truth."],
    ],
    notes: "This slide should make it clear that the backend is a stateful control plane, not only a data API.",
    sources: ["readme", "apiService"],
  },
  {
    kicker: "Incident Intelligence",
    title: "Every incident becomes one analysable lifecycle snapshot",
    subtitle: "The newer backend model stores one snapshot per incident from the first SUSPECT signal until the instance recovers or terminates.",
    expectedVisual: "Three cards describing the AI-ready incident model.",
    cards: [
      ["Single source of truth", "Instead of scattering evidence across many partial records, one snapshot contains the incident start, incident end, resolution, and embedded metrics timeline."],
      ["State-transition evidence", "Metrics are captured at each transition interval, so the AI can reason about what changed first and how the incident evolved over time."],
      ["Manual analysis trigger", "In the chat screen, the operator first selects an instance, then selects a snapshot, edits the task if needed, and only then sends it for AI analysis."],
    ],
    notes: "This is one of the strongest differentiators. It moves from telemetry collection to explainable incident narratives.",
    sources: ["readme", "dashboard", "apiService", "aiService"],
  },
  {
    kicker: "AI Contract",
    title: "The AI service reasons over structured infrastructure evidence, not free-form chat alone",
    subtitle: "The frontend sends a selected snapshot, the backend assembles the payload, and the Python service returns actionable diagnosis that can be stored back against the incident.",
    expectedVisual: "Three cards explaining the payload contract.",
    cards: [
      ["Input contract", "The analysis request includes instance metadata, the selected lifecycle incident snapshot, the embedded metrics timeline, and any legacy metrics rows still supplied by the backend."],
      ["Prompting model", "SentinelAI is instructed to identify the first degraded signal, explain state transitions, infer root cause, and separate immediate, short-term, and long-term remediation."],
      ["Output contract", "The service returns structured narrative fields such as root cause, remediation, and combined analysis so the UI can display them and the database can persist them for later review."],
    ],
    notes: "Mention the move to SambaNova-backed analysis and the importance of grounding every answer in timestamps and metrics from the selected incident.",
    sources: ["aiService", "apiService", "dashboard"],
  },
  {
    kicker: "Frontend Experience",
    title: "The UI is built for operators, not just for screenshots",
    subtitle: "The product now presents registration, monitoring, chat analysis, and Grafana telemetry inside one modern workflow.",
    expectedVisual: "Metric cards summarizing the operator experience.",
    metrics: [
      ["2", "Primary workspaces", "Instances view for fleet control and chat view for snapshot analysis."],
      ["4", "Embedded Grafana panels", "CPU, memory, disk, and network are displayed directly inside the dashboard with refresh controls."],
      ["0 routing", "State-driven shell", "Sidebar navigation switches screens through React state instead of a routing dependency."],
    ],
    notes: "This is a good moment to talk through the fixed sidebar, richer metrics UI, and snapshot-driven AI chat.",
    sources: ["dashboard", "wizard"],
  },
  {
    kicker: "Value",
    title: "Why Sentinal matters",
    subtitle: "The platform combines reliability automation with operator understanding, which is where many monitoring products still fall short.",
    expectedVisual: "Three cards for value and trust.",
    cards: [
      ["Lower mean time to recovery", "Sentinal detects failure, triggers defined recovery logic, and exposes current telemetry in one place so action starts earlier."],
      ["Safer cloud access", "Cross-account IAM roles avoid direct credential sharing and align with patterns used by established monitoring vendors."],
      ["Explainable operations", "The AI layer is grounded in stored incident evidence, making recommendations more reviewable than a generic chatbot disconnected from system history."],
    ],
    notes: "Present this as the combination of operational speed, security posture, and post-incident learning.",
    sources: ["readme", "wizard", "aiService"],
  },
  {
    kicker: "Roadmap",
    title: "Next steps to take Sentinal further",
    subtitle: "The current build already works as a strong capstone or product demo, and it also creates a clear path for deeper platform maturity.",
    expectedVisual: "Closing roadmap cards.",
    cards: [
      ["Broader observability", "Add richer dashboards, log correlation, and deeper workload-specific metrics beyond core host telemetry."],
      ["Smarter automation", "Evolve from analysis and recommendation into policy-driven runbooks and safer automated remediation workflows."],
      ["Enterprise readiness", "Add audit trails, multi-team roles, advanced alert routing, and richer reporting to support larger environments."],
    ],
    notes: "Close by reinforcing that the project already demonstrates product thinking, backend systems design, cloud security, and AI integration together.",
    sources: ["readme", "dashboard", "aiService"],
  },
];

const inspectRecords = [];

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readImageBlob(imagePath) {
  const bytes = await fs.readFile(imagePath);
  if (!bytes.byteLength) {
    throw new Error(`Image file is empty: ${imagePath}`);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function normalizeImageConfig(config) {
  if (!config.path) {
    return config;
  }
  const { path: imagePath, ...rest } = config;
  return {
    ...rest,
    blob: await readImageBlob(imagePath),
  };
}

async function ensureDirs() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const obsoleteFinalArtifacts = [
    "preview",
    "verification",
    "inspect.ndjson",
    ["presentation", "proto.json"].join("_"),
    ["quality", "report.json"].join("_"),
  ];
  for (const obsolete of obsoleteFinalArtifacts) {
    await fs.rm(path.join(OUT_DIR, obsolete), { recursive: true, force: true });
  }
  await fs.mkdir(SCRATCH_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  await fs.mkdir(VERIFICATION_DIR, { recursive: true });
}

function lineConfig(fill = TRANSPARENT, width = 0) {
  return { style: "solid", fill, width };
}

function recordShape(slideNo, shape, role, shapeType, x, y, w, h) {
  if (!slideNo) return;
  inspectRecords.push({
    kind: "shape",
    slide: slideNo,
    id: shape?.id || `slide-${slideNo}-${role}-${inspectRecords.length + 1}`,
    role,
    shapeType,
    bbox: [x, y, w, h],
  });
}

function addShape(slide, geometry, x, y, w, h, fill = TRANSPARENT, line = TRANSPARENT, lineWidth = 0, meta = {}) {
  const shape = slide.shapes.add({
    geometry,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: lineConfig(line, lineWidth),
  });
  recordShape(meta.slideNo, shape, meta.role || geometry, geometry, x, y, w, h);
  return shape;
}

function normalizeText(text) {
  if (Array.isArray(text)) {
    return text.map((item) => String(item ?? "")).join("\n");
  }
  return String(text ?? "");
}

function textLineCount(text) {
  const value = normalizeText(text);
  if (!value.trim()) {
    return 0;
  }
  return Math.max(1, value.split(/\n/).length);
}

function requiredTextHeight(text, fontSize, lineHeight = 1.18, minHeight = 8) {
  const lines = textLineCount(text);
  if (lines === 0) {
    return minHeight;
  }
  return Math.max(minHeight, lines * fontSize * lineHeight);
}

function assertTextFits(text, boxHeight, fontSize, role = "text") {
  const required = requiredTextHeight(text, fontSize);
  const tolerance = Math.max(2, fontSize * 0.08);
  if (normalizeText(text).trim() && boxHeight + tolerance < required) {
    throw new Error(
      `${role} text box is too short: height=${boxHeight.toFixed(1)}, required>=${required.toFixed(1)}, ` +
        `lines=${textLineCount(text)}, fontSize=${fontSize}, text=${JSON.stringify(normalizeText(text).slice(0, 90))}`,
    );
  }
}

function wrapText(text, widthChars) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > widthChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.join("\n");
}

function recordText(slideNo, shape, role, text, x, y, w, h) {
  const value = normalizeText(text);
  inspectRecords.push({
    kind: "textbox",
    slide: slideNo,
    id: shape?.id || `slide-${slideNo}-${role}-${inspectRecords.length + 1}`,
    role,
    text: value,
    textPreview: value.replace(/\n/g, " | ").slice(0, 180),
    textChars: value.length,
    textLines: textLineCount(value),
    bbox: [x, y, w, h],
  });
}

function recordImage(slideNo, image, role, imagePath, x, y, w, h) {
  inspectRecords.push({
    kind: "image",
    slide: slideNo,
    id: image?.id || `slide-${slideNo}-${role}-${inspectRecords.length + 1}`,
    role,
    path: imagePath,
    bbox: [x, y, w, h],
  });
}

function applyTextStyle(box, text, size, color, bold, face, align, valign, autoFit, listStyle) {
  box.text = text;
  box.text.fontSize = size;
  box.text.color = color;
  box.text.bold = Boolean(bold);
  box.text.alignment = align;
  box.text.verticalAlignment = valign;
  box.text.typeface = face;
  box.text.insets = { left: 0, right: 0, top: 0, bottom: 0 };
  if (autoFit) {
    box.text.autoFit = autoFit;
  }
  if (listStyle) {
    box.text.style = "list";
  }
}

function addText(
  slide,
  slideNo,
  text,
  x,
  y,
  w,
  h,
  {
    size = 22,
    color = INK,
    bold = false,
    face = BODY_FACE,
    align = "left",
    valign = "top",
    fill = TRANSPARENT,
    line = TRANSPARENT,
    lineWidth = 0,
    autoFit = null,
    listStyle = false,
    checkFit = true,
    role = "text",
  } = {},
) {
  if (!checkFit && textLineCount(text) > 1) {
    throw new Error("checkFit=false is only allowed for single-line headers, footers, and captions.");
  }
  if (checkFit) {
    assertTextFits(text, h, size, role);
  }
  const box = addShape(slide, "rect", x, y, w, h, fill, line, lineWidth);
  applyTextStyle(box, text, size, color, bold, face, align, valign, autoFit, listStyle);
  recordText(slideNo, box, role, text, x, y, w, h);
  return box;
}

async function addImage(slide, slideNo, config, position, role, sourcePath = null) {
  const image = slide.images.add(await normalizeImageConfig(config));
  image.position = position;
  recordImage(slideNo, image, role, sourcePath || config.path || config.uri || "inline-data-url", position.left, position.top, position.width, position.height);
  return image;
}

async function addPlate(slide, slideNo, opacityPanel = false) {
  slide.background.fill = PAPER;
  const platePath = path.join(REF_DIR, `slide-${String(slideNo).padStart(2, "0")}.png`);
  if (await pathExists(platePath)) {
    await addImage(
      slide,
      slideNo,
      { path: platePath, fit: "cover", alt: `Text-free art-direction plate for slide ${slideNo}` },
      { left: 0, top: 0, width: W, height: H },
      "art plate",
      platePath,
    );
  } else {
    await addImage(
      slide,
      slideNo,
      { dataUrl: FALLBACK_PLATE_DATA_URL, fit: "cover", alt: `Fallback blank art plate for slide ${slideNo}` },
      { left: 0, top: 0, width: W, height: H },
      "fallback art plate",
      "fallback-data-url",
    );
  }
  addShape(slide, "rect", 0, 0, W, H, "#040A14", TRANSPARENT, 0, { slideNo, role: "base backdrop" });
  addShape(slide, "rect", 0, 0, W, H, "#07111FCC", TRANSPARENT, 0, { slideNo, role: "backdrop veil" });
  addShape(slide, "ellipse", 884, -120, 420, 420, "#1DDCFF18", TRANSPARENT, 0, { slideNo, role: "cyan glow" });
  addShape(slide, "ellipse", -120, 460, 380, 380, "#25D58A18", TRANSPARENT, 0, { slideNo, role: "green glow" });
  addShape(slide, "ellipse", 920, 480, 300, 300, "#7C6BFF12", TRANSPARENT, 0, { slideNo, role: "violet glow" });
  addShape(slide, "roundRect", 36, 28, W - 72, H - 56, "#07111F99", "#17314A", 1, { slideNo, role: "main shell" });
  addShape(slide, "rect", 36, 92, W - 72, 1, "#16314A", TRANSPARENT, 0, { slideNo, role: "shell divider" });
  for (let x = 88; x <= 1180; x += 96) {
    addShape(slide, "rect", x, 108, 1, 540, "#0F2236", TRANSPARENT, 0, { slideNo, role: "grid line" });
  }
  for (let y = 148; y <= 612; y += 88) {
    addShape(slide, "rect", 64, y, 1120, 1, "#0C2030", TRANSPARENT, 0, { slideNo, role: "grid line" });
  }
  if (opacityPanel) {
    addShape(slide, "rect", 0, 0, W, H, "#FFFFFFB8", TRANSPARENT, 0, { slideNo, role: "plate readability overlay" });
  }
}

function addHeader(slide, slideNo, kicker, idx, total) {
  addText(slide, slideNo, String(kicker || "").toUpperCase(), 64, 34, 430, 24, {
    size: 13,
    color: ACCENT_DARK,
    bold: true,
    face: MONO_FACE,
    checkFit: false,
    role: "header",
  });
  addText(slide, slideNo, `${String(idx).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, 1114, 34, 104, 24, {
    size: 13,
    color: ACCENT_DARK,
    bold: true,
    face: MONO_FACE,
    align: "right",
    checkFit: false,
    role: "header",
  });
  addShape(slide, "rect", 64, 64, 1152, 2, INK, TRANSPARENT, 0, { slideNo, role: "header rule" });
  addShape(slide, "ellipse", 57, 57, 16, 16, ACCENT, "#092022", 1.2, { slideNo, role: "header marker" });
  addShape(slide, "roundRect", 1020, 112, 168, 34, "#0C1B2C", "#193851", 1, { slideNo, role: "status chip" });
  addText(slide, slideNo, "live registry session", 1040, 121, 136, 16, {
    size: 11,
    color: GRAPHITE,
    face: MONO_FACE,
    checkFit: false,
    role: "status chip text",
  });
}

function addTitleBlock(slide, slideNo, title, subtitle = null, x = 64, y = 86, w = 780, dark = false) {
  const titleColor = dark ? PAPER : INK;
  const bodyColor = dark ? PAPER : GRAPHITE;
  addText(slide, slideNo, title, x, y, w, 142, {
    size: 40,
    color: titleColor,
    bold: true,
    face: TITLE_FACE,
    role: "title",
  });
  if (subtitle) {
    addText(slide, slideNo, subtitle, x + 2, y + 148, Math.min(w, 720), 70, {
      size: 19,
      color: bodyColor,
      face: BODY_FACE,
      role: "subtitle",
    });
  }
}

function addIconBadge(slide, slideNo, x, y, accent = ACCENT, kind = "signal") {
  addShape(slide, "ellipse", x, y, 54, 54, "#0A1628", "#18314A", 1.2, { slideNo, role: "icon badge" });
  if (kind === "flow") {
    addShape(slide, "ellipse", x + 13, y + 18, 10, 10, accent, INK, 1, { slideNo, role: "icon glyph" });
    addShape(slide, "ellipse", x + 31, y + 27, 10, 10, accent, INK, 1, { slideNo, role: "icon glyph" });
    addShape(slide, "rect", x + 22, y + 25, 19, 3, INK, TRANSPARENT, 0, { slideNo, role: "icon glyph" });
  } else if (kind === "layers") {
    addShape(slide, "roundRect", x + 13, y + 15, 26, 13, accent, INK, 1, { slideNo, role: "icon glyph" });
    addShape(slide, "roundRect", x + 18, y + 24, 26, 13, GOLD, INK, 1, { slideNo, role: "icon glyph" });
    addShape(slide, "roundRect", x + 23, y + 33, 20, 10, CORAL, INK, 1, { slideNo, role: "icon glyph" });
  } else {
    addShape(slide, "rect", x + 16, y + 29, 6, 12, accent, TRANSPARENT, 0, { slideNo, role: "icon glyph" });
    addShape(slide, "rect", x + 25, y + 21, 6, 20, accent, TRANSPARENT, 0, { slideNo, role: "icon glyph" });
    addShape(slide, "rect", x + 34, y + 14, 6, 27, accent, TRANSPARENT, 0, { slideNo, role: "icon glyph" });
  }
}

function addCard(slide, slideNo, x, y, w, h, label, body, { accent = ACCENT, fill = PAPER_96, line = INK, iconKind = "signal" } = {}) {
  if (h < 156) {
    throw new Error(`Card is too short for editable pro-deck copy: height=${h.toFixed(1)}, minimum=156.`);
  }
  addShape(slide, "roundRect", x, y, w, h, fill === PAPER_96 ? SURFACE : fill, line === INK ? "#18314A" : line, 1.2, { slideNo, role: `card panel: ${label}` });
  addShape(slide, "rect", x, y, 8, h, accent, TRANSPARENT, 0, { slideNo, role: `card accent: ${label}` });
  addShape(slide, "rect", x + 16, y + 16, w - 32, 1, `${accent}33`, TRANSPARENT, 0, { slideNo, role: `card top rule: ${label}` });
  addIconBadge(slide, slideNo, x + 22, y + 24, accent, iconKind);
  addText(slide, slideNo, label, x + 88, y + 22, w - 108, 28, {
    size: 15,
    color: accent === GOLD ? GOLD : accent === CORAL ? CORAL : CYAN,
    bold: true,
    face: MONO_FACE,
    role: "card label",
  });
  const wrapped = wrapText(body, Math.max(28, Math.floor(w / 13)));
  const bodyY = y + 86;
  const bodyH = h - (bodyY - y) - 22;
  if (bodyH < 54) {
    throw new Error(`Card body area is too short: height=${bodyH.toFixed(1)}, cardHeight=${h.toFixed(1)}, label=${JSON.stringify(label)}.`);
  }
  addText(slide, slideNo, wrapped, x + 24, bodyY, w - 48, bodyH, {
    size: 17,
    color: INK,
    face: BODY_FACE,
    role: `card body: ${label}`,
  });
}

function addMetricCard(slide, slideNo, x, y, w, h, metric, label, note = null, accent = ACCENT) {
  if (h < 132) {
    throw new Error(`Metric card is too short for editable pro-deck copy: height=${h.toFixed(1)}, minimum=132.`);
  }
  addShape(slide, "roundRect", x, y, w, h, SURFACE, "#18314A", 1.2, { slideNo, role: `metric panel: ${label}` });
  addShape(slide, "rect", x, y, w, 7, accent, TRANSPARENT, 0, { slideNo, role: `metric accent: ${label}` });
  addText(slide, slideNo, metric, x + 22, y + 24, w - 44, 54, {
    size: 34,
    color: WHITE,
    bold: true,
    face: TITLE_FACE,
    role: "metric value",
  });
  addText(slide, slideNo, label, x + 24, y + 82, w - 48, 38, {
    size: 16,
    color: GRAPHITE,
    face: BODY_FACE,
    role: "metric label",
  });
  if (note) {
    addText(slide, slideNo, note, x + 24, y + h - 42, w - 48, 22, {
      size: 10,
      color: MUTED,
      face: BODY_FACE,
      role: "metric note",
    });
  }
}

function addNotes(slide, body, sourceKeys) {
  const sourceLines = (sourceKeys || []).map((key) => `- ${SOURCES[key] || key}`).join("\n");
  slide.speakerNotes.setText(`${body || ""}\n\n[Sources]\n${sourceLines}`);
}

function addReferenceCaption(slide, slideNo) {
  addText(
    slide,
    slideNo,
    "Slide content is based on the current Sentinal repository implementation; all visible copy and structure remain editable in PowerPoint.",
    64,
    674,
    1120,
    22,
    {
      size: 10,
      color: MUTED,
      face: BODY_FACE,
      checkFit: false,
      role: "caption",
    },
  );
}

async function slideCover(presentation) {
  const slideNo = 1;
  const data = SLIDES[0];
  const slide = presentation.slides.add();
  await addPlate(slide, slideNo);
  addShape(slide, "roundRect", 64, 110, 650, 510, "#07111FE8", "#17314A", 1.2, { slideNo, role: "cover content shell" });
  addShape(slide, "rect", 64, 110, 10, 510, ACCENT, TRANSPARENT, 0, { slideNo, role: "cover accent rule" });
  addShape(slide, "roundRect", 772, 110, 444, 240, SURFACE, "#18314A", 1.2, { slideNo, role: "cover telemetry shell" });
  addShape(slide, "roundRect", 772, 378, 444, 242, SURFACE_2, "#18314A", 1.2, { slideNo, role: "cover telemetry shell" });
  addMetricCard(slide, slideNo, 802, 148, 180, 150, "15 s", "health polling", "backend evaluation loop", CYAN);
  addMetricCard(slide, slideNo, 996, 148, 180, 150, "1", "snapshot per incident", "full lifecycle sealed", ACCENT);
  addMetricCard(slide, slideNo, 802, 416, 180, 150, "4", "grafana panels", "CPU, memory, disk, network", GOLD);
  addMetricCard(slide, slideNo, 996, 416, 180, 150, "AI", "root cause analysis", "SambaNova-backed service", INDIGO);
  addText(slide, slideNo, data.kicker, 86, 88, 520, 26, {
    size: 13,
    color: CYAN,
    bold: true,
    face: MONO_FACE,
    role: "kicker",
  });
  addText(slide, slideNo, data.title, 82, 130, 785, 184, {
    size: 48,
    color: WHITE,
    bold: true,
    face: TITLE_FACE,
    role: "cover title",
  });
  addText(slide, slideNo, data.subtitle, 86, 326, 610, 86, {
    size: 20,
    color: GRAPHITE,
    face: BODY_FACE,
    role: "cover subtitle",
  });
  addShape(slide, "roundRect", 86, 456, 390, 92, SURFACE, "#17314A", 1.2, { slideNo, role: "cover moment panel" });
  addText(slide, slideNo, data.moment || "Replace with core idea", 112, 478, 336, 40, {
    size: 23,
    color: WHITE,
    bold: true,
    face: TITLE_FACE,
    role: "cover moment",
  });
  addReferenceCaption(slide, slideNo);
  addNotes(slide, data.notes, data.sources);
}

async function slideCards(presentation, idx) {
  const data = SLIDES[idx - 1];
  const slide = presentation.slides.add();
  await addPlate(slide, idx);
  addHeader(slide, idx, data.kicker, idx, SLIDES.length);
  addShape(slide, "roundRect", 64, 110, 1152, 530, "#06101DEB", "#17314A", 1.2, { slideNo: idx, role: "content shell" });
  addShape(slide, "roundRect", 920, 128, 248, 72, SURFACE, "#17314A", 1, { slideNo: idx, role: "tech badge" });
  addText(slide, idx, "registry aligned\noperator workflow", 948, 144, 184, 34, {
    size: 12,
    color: CYAN,
    face: MONO_FACE,
    role: "tech badge text",
  });
  addTitleBlock(slide, idx, data.title, data.subtitle, 84, 134, 760, true);
  const cards = data.cards?.length
    ? data.cards
    : [
        ["Replace", "Add a specific, sourced point for this slide."],
        ["Author", "Use native PowerPoint chart objects for charts; use deterministic geometry for cards and callouts."],
        ["Verify", "Render previews, inspect them at readable size, and fix actionable layout issues within 3 total render loops."],
      ];
  const cols = Math.min(3, cards.length);
  const cardW = (1114 - (cols - 1) * 24) / cols;
  const cardY = 312;
  const cardH = 286;
  const iconKinds = ["signal", "flow", "layers"];
  const accents = [CYAN, ACCENT, INDIGO];
  for (let cardIdx = 0; cardIdx < cols; cardIdx += 1) {
    const [label, body] = cards[cardIdx];
    const x = 84 + cardIdx * (cardW + 24);
    addCard(slide, idx, x, cardY, cardW, cardH, label, body, {
      iconKind: iconKinds[cardIdx % iconKinds.length],
      accent: accents[cardIdx % accents.length],
    });
  }
  addReferenceCaption(slide, idx);
  addNotes(slide, data.notes, data.sources);
}

async function slideMetrics(presentation, idx) {
  const data = SLIDES[idx - 1];
  const slide = presentation.slides.add();
  await addPlate(slide, idx);
  addHeader(slide, idx, data.kicker, idx, SLIDES.length);
  addShape(slide, "roundRect", 64, 110, 1152, 530, "#06101DEB", "#17314A", 1.2, { slideNo: idx, role: "metrics shell" });
  addTitleBlock(slide, idx, data.title, data.subtitle, 84, 134, 700, true);
  const metrics = data.metrics || [
    ["00", "Replace metric", "Source"],
    ["00", "Replace metric", "Source"],
    ["00", "Replace metric", "Source"],
  ];
  const accents = [CYAN, ACCENT, GOLD];
  for (let metricIdx = 0; metricIdx < Math.min(3, metrics.length); metricIdx += 1) {
    const [metric, label, note] = metrics[metricIdx];
    addMetricCard(slide, idx, 92 + metricIdx * 370, 386, 330, 194, metric, label, note, accents[metricIdx % accents.length]);
  }
  addReferenceCaption(slide, idx);
  addNotes(slide, data.notes, data.sources);
}

async function createDeck() {
  await ensureDirs();
  if (!SLIDES.length) {
    throw new Error("SLIDES must contain at least one slide.");
  }
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  await slideCover(presentation);
  for (let idx = 2; idx <= SLIDES.length; idx += 1) {
    const data = SLIDES[idx - 1];
    if (data.metrics) {
      await slideMetrics(presentation, idx);
    } else {
      await slideCards(presentation, idx);
    }
  }
  return presentation;
}

async function saveBlobToFile(blob, filePath) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await fs.writeFile(filePath, bytes);
}

async function writeInspectArtifact(presentation) {
  inspectRecords.unshift({
    kind: "deck",
    id: DECK_ID,
    slideCount: presentation.slides.count,
    slideSize: { width: W, height: H },
  });
  presentation.slides.items.forEach((slide, index) => {
    inspectRecords.splice(index + 1, 0, {
      kind: "slide",
      slide: index + 1,
      id: slide?.id || `slide-${index + 1}`,
    });
  });
  const lines = inspectRecords.map((record) => JSON.stringify(record)).join("\n") + "\n";
  await fs.writeFile(INSPECT_PATH, lines, "utf8");
}

async function currentRenderLoopCount() {
  const logPath = path.join(VERIFICATION_DIR, "render_verify_loops.ndjson");
  if (!(await pathExists(logPath))) return 0;
  const previous = await fs.readFile(logPath, "utf8");
  return previous.split(/\r?\n/).filter((line) => line.trim()).length;
}

async function nextRenderLoopNumber() {
  return (await currentRenderLoopCount()) + 1;
}

async function appendRenderVerifyLoop(presentation, previewPaths, pptxPath) {
  const logPath = path.join(VERIFICATION_DIR, "render_verify_loops.ndjson");
  const priorCount = await currentRenderLoopCount();
  const record = {
    kind: "render_verify_loop",
    deckId: DECK_ID,
    loop: priorCount + 1,
    maxLoops: MAX_RENDER_VERIFY_LOOPS,
    capReached: priorCount + 1 >= MAX_RENDER_VERIFY_LOOPS,
    timestamp: new Date().toISOString(),
    slideCount: presentation.slides.count,
    previewCount: previewPaths.length,
    previewDir: PREVIEW_DIR,
    inspectPath: INSPECT_PATH,
    pptxPath,
  };
  await fs.appendFile(logPath, JSON.stringify(record) + "\n", "utf8");
  return record;
}

async function verifyAndExport(presentation) {
  await ensureDirs();
  const nextLoop = await nextRenderLoopNumber();
  if (nextLoop > MAX_RENDER_VERIFY_LOOPS) {
    throw new Error(
      `Render/verify/fix loop cap reached: ${MAX_RENDER_VERIFY_LOOPS} total renders are allowed. ` +
        "Do not rerender; note any remaining visual issues in the final response.",
    );
  }
  await writeInspectArtifact(presentation);
  const previewPaths = [];
  for (let idx = 0; idx < presentation.slides.items.length; idx += 1) {
    const slide = presentation.slides.items[idx];
    const preview = await presentation.export({ slide, format: "png", scale: 1 });
    const previewPath = path.join(PREVIEW_DIR, `slide-${String(idx + 1).padStart(2, "0")}.png`);
    await saveBlobToFile(preview, previewPath);
    previewPaths.push(previewPath);
  }
  const pptxBlob = await PresentationFile.exportPptx(presentation);
  const pptxPath = path.join(OUT_DIR, "output.pptx");
  await pptxBlob.save(pptxPath);
  const loopRecord = await appendRenderVerifyLoop(presentation, previewPaths, pptxPath);
  return { pptxPath, loopRecord };
}

const presentation = await createDeck();
const result = await verifyAndExport(presentation);
console.log(result.pptxPath);
