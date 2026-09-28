/* ---------- Gradient Waves background (WebGL fallback: 2D canvas) ---------- */
class GradientWaves2D {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.o = Object.assign({
      horizonColor: "#5227FF",
      waveColor: "#FF9FFC",
      crestColor: "#FFFFFF",
      speed: 0.4,
      amplitude: 2.5,
      waveScale: 0.6,
      waveRatio: 0.9,
      swell: 35,
      turbulence: 20,
      tilt: 1.11,
      zoom: 1,
      height: 5.5,
      fogDepth: 15,
      detail: "medium",
      brightness: 1,
      opacity: 1,
      mouseInteraction: true,
      parallaxStrength: 0.5,
      grain: true,
      grainIntensity: 0.05,
    }, opts);

    this.layers = { low: 5, medium: 9, high: 14 }[this.o.detail] || 9;
    this.t = 0;
    this.mouse = { x: 0, y: 0 };
    this.reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    canvas.style.opacity = this.o.opacity;

    this._resize = this._resize.bind(this);
    this._onMove = this._onMove.bind(this);
    this._tick = this._tick.bind(this);

    this._resize();
    window.addEventListener("resize", this._resize);
    if (this.o.mouseInteraction) {
      window.addEventListener("pointermove", this._onMove, { passive: true });
    }

    this._buildGrain();
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.w = Math.max(1, Math.round(rect.width));
    this.h = Math.max(1, Math.round(rect.height));
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _onMove(e) {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }

  _buildGrain() {
    const size = 128;
    const g = document.createElement("canvas");
    g.width = size;
    g.height = size;
    const gctx = g.getContext("2d");
    const imgData = gctx.createImageData(size, size);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.random() * 255;
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
    gctx.putImageData(imgData, 0, 0);
    this.grainPattern = this.ctx.createPattern(g, "repeat");
  }

  _mix(hexA, hexB, k) {
    const a = this._toRgb(hexA), b = this._toRgb(hexB);
    const r = Math.round(a[0] + (b[0] - a[0]) * k);
    const gC = Math.round(a[1] + (b[1] - a[1]) * k);
    const bC = Math.round(a[2] + (b[2] - a[2]) * k);
    return `rgb(${r},${gC},${bC})`;
  }

  _toRgb(color) {
    if (color.startsWith("#")) {
      const c = color.replace("#", "");
      return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
    }
    const m = color.match(/[\d.]+/g).map(Number);
    return [m[0], m[1], m[2]];
  }

  _tick(now) {
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    if (!this.reduceMotion) this.t += dt * this.o.speed;
    this._draw();
    this._raf = requestAnimationFrame(this._tick);
  }

  _draw() {
    const { ctx, w, h, o, t, layers } = this;
    ctx.clearRect(0, 0, w, h);

    const horizonY = h * Math.max(0.18, Math.min(0.6, 1 - o.height / 12));
    const hf = horizonY / h;

    // Full-height backdrop gradient so there is never a hard seam behind the
    // waves — even where a crest fades out, there's always smooth colour.
    const backdrop = ctx.createLinearGradient(0, 0, 0, h);
    backdrop.addColorStop(0, "#05010a");
    backdrop.addColorStop(Math.max(0.04, hf - 0.14), this._mix(o.horizonColor, "#000000", 0.55));
    backdrop.addColorStop(Math.min(0.96, hf + 0.04), this._mix(o.horizonColor, "#000000", 0.12));
    backdrop.addColorStop(1, this._mix(o.waveColor, "#000000", 0.4));
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, w, h);

    ctx.filter = `brightness(${o.brightness})`;
    ctx.save();
    // Generous clip so nothing spills outside the canvas box — deliberately
    // not tight to the horizon, since a tight clip is what caused the hard
    // cutoff line before.
    ctx.beginPath();
    ctx.rect(0, -h, w, h * 3);
    ctx.clip();

    const mx = o.mouseInteraction ? this.mouse.x : 0;
    const step = Math.max(4, Math.round(w / 180));

    for (let i = 0; i < layers; i++) {
      const d = i / (layers - 1);
      const yBase = horizonY + Math.pow(d, 1 / (1 + o.tilt * 0.3)) * (h - horizonY);
      const amp = o.amplitude * (2 + d * d * 16) * (h / 700);
      const freq = (0.006 + 0.016 * (1 - d)) * o.waveScale * o.zoom;
      const parallax = mx * o.parallaxStrength * (1 - d) * 40;
      const tiltShift = o.tilt * (d - 0.5) * 30;

      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + step; x += step) {
        const xs = x + tiltShift + parallax;
        const main = Math.sin(xs * freq + t * (1 + d) + i * 0.7) * amp;
        const detail2 = Math.sin(xs * freq * o.waveRatio * 1.7 - t * 1.3 + i) * amp * 0.35;
        const swellWave = Math.sin(xs * 0.0016 * o.zoom + t * 0.35 + i * 0.4) * (o.swell / 100) * amp * 1.6;
        const turb = Math.sin(xs * 0.045 + t * 2.1 + i * 3.1) * (o.turbulence / 100) * amp * 0.4;
        const y = yBase - main - detail2 - swellWave - turb;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();

      const fogAlpha = Math.max(0, Math.min(1, d + (1 - o.fogDepth / 100) * 0.4));
      const baseColor = this._mix(o.horizonColor, o.waveColor, d);
      // Fade the crest to fully transparent at its top instead of hard-
      // clipping it — that's what blends the wave into the backdrop with
      // no visible seam.
      const topY = yBase - amp * 2.4;
      const [cr, cg, cb] = this._toRgb(o.crestColor);
      const grad = ctx.createLinearGradient(0, topY, 0, h);
      grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      grad.addColorStop(0.28, this._mix(o.crestColor, baseColor, 0.4));
      grad.addColorStop(0.55, baseColor);
      grad.addColorStop(1, this._mix(baseColor, "#000000", 0.5));
      ctx.globalAlpha = 0.35 + fogAlpha * 0.65;
      ctx.fillStyle = grad;
      ctx.fill();

      // Crest highlight — only on the nearer layers, and it fades with them
      // rather than drawing a hard line across the horizon.
      if (d > 0.35) {
        ctx.globalAlpha = (0.2 + d * 0.3) * Math.min(1, (d - 0.35) / 0.25);
        ctx.strokeStyle = o.crestColor;
        ctx.lineWidth = 1 + d * 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.filter = "none";

    if (o.grain && this.grainPattern) {
      ctx.save();
      ctx.globalAlpha = o.grainIntensity;
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = this.grainPattern;
      ctx.translate((t * 12) % 128, (t * 7) % 128);
      ctx.fillRect(-128, -128, w + 256, h + 256);
      ctx.restore();
    }
  }
}

// Exposed for the WebGL loader (module script below) to fall back to
// if 'ogl' / WebGL2 can't be loaded in this browser.
window.__mountFallbackGradientWaves = function (container, opts) {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  container.appendChild(canvas);
  new GradientWaves2D(canvas, opts);
};
/* ---------- end background ---------- */

const ICONS = [
  { id: "water", label: "вода", svg: '<path d="M12 2.5C12 2.5 5.5 11 5.5 15.5a6.5 6.5 0 0 0 13 0C18.5 11 12 2.5 12 2.5z"/>' },
  { id: "book", label: "чтение", svg: '<path d="M3.5 5.5c0-.83.67-1.5 1.5-1.5h6v15H5c-.83 0-1.5-.67-1.5-1.5v-12z"/><path d="M20.5 5.5c0-.83-.67-1.5-1.5-1.5h-6v15h6c.83 0 1.5-.67 1.5-1.5v-12z"/>' },
  { id: "run", label: "бег", svg: '<circle cx="15" cy="5.5" r="2"/><path d="M12 21l1.5-6-3-2 1-4.5 4 1 1.5 3.5 3 1"/><path d="M8 12.5l3 1"/>' },
  { id: "meditate", label: "медитация", svg: '<circle cx="12" cy="12" r="2.1"/><path d="M12 9.7C10.1 8 10.1 4.2 12 2.3c1.9 1.9 1.9 5.7 0 7.4zM12 14.3c1.9 1.7 1.9 5.5 0 7.4-1.9-1.9-1.9-5.7 0-7.4zM9.7 12C8 10.1 4.2 10.1 2.3 12c1.9 1.9 5.7 1.9 7.4 0zM14.3 12c1.7-1.9 5.5-1.9 7.4 0-1.9 1.9-5.7 1.9-7.4 0z"/>' },
  { id: "salad", label: "еда", svg: '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M12 12c0-3 1.4-5 4-6-1 3-1 5 0 6"/>' },
  { id: "sleep", label: "сон", svg: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>' },
  { id: "write", label: "письмо", svg: '<path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z"/><path d="M13.5 6.5l4 4"/>' },
  { id: "clean", label: "уборка", svg: '<path d="M14 3l-3 3"/><path d="M9 8L4 21l4-2 3-6"/><path d="M9 8l6 6"/>' },
  { id: "guitar", label: "музыка", svg: '<circle cx="9" cy="16" r="4.3"/><path d="M11.5 12.7L18 4"/><path d="M16 6l2 2"/><path d="M17.5 4.5l2 2"/>' },
  { id: "plant", label: "растение", svg: '<path d="M12 21V11"/><path d="M12 11c0-3-2-5-5-5 0 3 2 5 5 5z"/><path d="M12 13c0-3 2-5 5-5 0 3-2 5-5 5z"/>' },
  { id: "coffee", label: "кофе", svg: '<path d="M5 9h11v5a5.5 5.5 0 0 1-11 0V9z"/><path d="M16 10.5h1.5a2 2 0 0 1 0 4H16"/><path d="M8 3.5c0 1 1 1 1 2s-1 1-1 2"/><path d="M12 3.5c0 1 1 1 1 2s-1 1-1 2"/>' },
  { id: "brain", label: "фокус", svg: '<path d="M9 3.5a3 3 0 0 0-3 3v.3A3 3 0 0 0 4.5 9.5 3 3 0 0 0 6 15a3.5 3.5 0 0 0 3 5.5h.5V3.5H9z"/><path d="M15 3.5a3 3 0 0 1 3 3v.3A3 3 0 0 1 19.5 9.5 3 3 0 0 1 18 15a3.5 3.5 0 0 1-3 5.5h-.5V3.5H15z"/>' },
];

const COLORS = ["#0a84ff", "#ff453a", "#ff9f0a", "#ffd60a", "#30d158", "#64d2ff", "#5e5ce6", "#bf5af2"];
const DAY_LABELS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const STORE_KEY = "trap-habits-v1";

const intro = document.getElementById("intro");
const introStars = document.getElementById("introStars");
const app = document.getElementById("app");
const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const addBtn = document.getElementById("addBtn");
const habitDialog = document.getElementById("habitDialog");
const detailDialog = document.getElementById("detailDialog");
const habitForm = document.getElementById("habitForm");
const habitName = document.getElementById("habitName");
const iconPick = document.getElementById("iconPick");
const colorPick = document.getElementById("colorPick");
const shapePick = document.getElementById("shapePick");
const daysPick = document.getElementById("daysPick");
const cancelHabit = document.getElementById("cancelHabit");
const calendar = document.getElementById("calendar");
const monthLabel = document.getElementById("monthLabel");
const detailName = document.getElementById("detailName");
const detailIcon = document.getElementById("detailIcon");
const detailDays = document.getElementById("detailDays");
const streakText = document.getElementById("streakText");
const achGrid = document.getElementById("achGrid");
const dailyTaskList = document.getElementById("dailyTaskList");
const weeklyTaskList = document.getElementById("weeklyTaskList");
const milestoneDialog = document.getElementById("milestoneDialog");
const milestoneEmbers = document.getElementById("milestoneEmbers");
const milestoneFlame = document.getElementById("milestoneFlame");
const milestoneNum = document.getElementById("milestoneNum");
const milestoneDays = document.getElementById("milestoneDays");
const milestoneTitle = document.getElementById("milestoneTitle");
const milestoneText = document.getElementById("milestoneText");
const milestoneHabit = document.getElementById("milestoneHabit");
const milestoneClose = document.getElementById("milestoneClose");
const flame = document.getElementById("flame");

let habits = load();
let selectedIcon = ICONS[0].id;
let selectedColor = COLORS[0];
let selectedShape = "rect";
let selectedDays = new Set([0, 1, 2, 3, 4, 5, 6]);
let openId = null;
let view = new Date();
view.setDate(1);

function finishIntro() {
  if (!intro.isConnected) return;
  intro.classList.add("fade");
  app.hidden = false;
  app.classList.remove("hidden");
  setTimeout(() => intro.remove(), 600);
}

function buildIntroStars() {
  if (!introStars) return;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = 70;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const star = document.createElement("span");
    const big = Math.random() < 0.16;
    const size = big ? 2 + Math.random() * 1.6 : 1 + Math.random() * 1.2;
    star.className = big ? "intro-star big" : "intro-star";
    star.style.setProperty("--x", `${Math.random() * 100}%`);
    star.style.setProperty("--y", `${Math.random() * 100}%`);
    star.style.setProperty("--size", `${size}px`);
    star.style.setProperty("--dur", `${2.2 + Math.random() * 3}s`);
    star.style.setProperty("--delay", `${(Math.random() * 4).toFixed(2)}s`);
    star.style.setProperty("--peak", `${big ? 0.85 : 0.45 + Math.random() * 0.35}`);
    if (reduceMotion) {
      star.style.animation = "none";
      star.style.opacity = String(0.25 + Math.random() * 0.4);
    }
    frag.appendChild(star);
  }
  if (!reduceMotion) {
    const shootCount = 9;
    for (let i = 0; i < shootCount; i += 1) {
      const shoot = document.createElement("span");
      shoot.className = "intro-shooting-star";
      const angle = -14 - Math.random() * 26; // -14deg..-40deg
      const rad = (angle * Math.PI) / 180;
      const dist = 160 + Math.random() * 140;
      shoot.style.setProperty("--x", `${Math.random() * 95}%`);
      shoot.style.setProperty("--y", `${Math.random() * 45}%`);
      shoot.style.setProperty("--angle", `${angle}deg`);
      shoot.style.setProperty("--len", `${60 + Math.random() * 70}px`);
      shoot.style.setProperty("--dx", `${-Math.cos(rad) * dist}px`);
      shoot.style.setProperty("--dy", `${Math.sin(-rad) * dist}px`);
      shoot.style.setProperty("--sdur", `${1.8 + Math.random() * 2.2}s`);
      shoot.style.setProperty("--delay", `${((i / shootCount) * 1.8 + Math.random() * 0.3).toFixed(2)}s`);
      frag.appendChild(shoot);
    }
  }
  introStars.appendChild(frag);
}
buildIntroStars();

intro.addEventListener("click", finishIntro);

// Start the 2.2s countdown only once the page is actually visible, so the
// splash isn't used up while the page loads in a background tab / preview.
function startIntroTimer() {
  if (document.visibilityState === "visible") {
    setTimeout(finishIntro, 2200);
    return;
  }
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    document.removeEventListener("visibilitychange", onVisible);
    setTimeout(finishIntro, 2200);
  };
  document.addEventListener("visibilitychange", onVisible);
}
startIntroTimer();

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || [];
    return parsed.map((h) => ({
      shape: "rect",
      repeatDays: [0, 1, 2, 3, 4, 5, 6],
      ...h,
    }));
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(habits));
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isScheduledOn(habit, date) {
  const day = (date.getDay() + 6) % 7;
  const repeatDays = habit.repeatDays && habit.repeatDays.length ? habit.repeatDays : [0, 1, 2, 3, 4, 5, 6];
  return repeatDays.includes(day);
}

function streakOf(habit) {
  const set = new Set(habit.done || []);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (isScheduledOn(habit, cursor) && !set.has(todayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let n = 0;
  while (cursor <= new Date()) {
    if (isScheduledOn(habit, cursor)) {
      if (!set.has(todayKey(cursor))) break;
      n += 1;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

function isDoneToday(habit) {
  return (habit.done || []).includes(todayKey());
}

let flameIconUid = 0;
let ignitedHabitId = null;

function daysLabel(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} день подряд`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} дня подряд`;
  return `${n} дней подряд`;
}

function repeatSummary(repeatDays) {
  const arr = repeatDays && repeatDays.length ? [...repeatDays].sort() : [0, 1, 2, 3, 4, 5, 6];
  if (arr.length === 7) return "каждый день";
  return arr.map((d) => DAY_LABELS[d]).join(", ");
}

function iconSvg(id, size = 15) {
  const icon = ICONS.find((i) => i.id === id) || ICONS[0];
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon.svg}</svg>`;
}

function flameIcon(active, size = 14, ignite = false) {
  flameIconUid += 1;
  const uid = `fl${flameIconUid}`;
  if (!active) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="flame-icon flame-off" fill="none" stroke="var(--ash)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 2.4c1.3 2.6.2 4.3-1.2 6-1.8 2.2-3.3 4.1-3.3 6.5a4.5 4.5 0 0 0 9 0c0-1.3-.4-2.4-1-3.3.2 1.6-.6 2.5-1.4 2.9C15 10.7 13.7 8.6 13 5.7c-.3-1.2-.6-2.2-1-3.3z"/>
    </svg>`;
  }
  const cls = ignite ? "flame-icon flame-lit flame-ignite" : "flame-icon flame-lit";
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="${cls}" aria-hidden="true">
    <defs>
      <linearGradient id="flameOuter-${uid}" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#d6320c"/>
        <stop offset="45%" stop-color="#ff8a1f"/>
        <stop offset="100%" stop-color="#ffd76b"/>
      </linearGradient>
      <linearGradient id="flameInner-${uid}" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#ff9f0a"/>
        <stop offset="55%" stop-color="#ffcf5c"/>
        <stop offset="100%" stop-color="#fff6da"/>
      </linearGradient>
    </defs>
    <path fill="url(#flameOuter-${uid})" d="M12 2.1c1.4 2.6.3 4.3-1.2 6.1-1.9 2.2-3.5 4.2-3.5 6.7a4.7 4.7 0 0 0 9.4 0c0-1.4-.4-2.5-1-3.5.2 1.7-.7 2.6-1.5 3 .9-3.7-.5-5.8.3-8.8.4-1.5-1-2.5-1.8-3.7z"/>
    <path fill="url(#flameInner-${uid})" d="M12.4 9.7c.7 1.5-.1 2.4-1 3.3-.9 1-1.7 2-1.7 3.3a2.6 2.6 0 0 0 5.2 0c0-.8-.2-1.4-.6-1.9.1.8-.4 1.3-.8 1.5.5-1.9-.4-3-.5-4.5-.1-.6-.3-1.2-.6-1.7z"/>
  </svg>`;
}

function longestStreak(habit) {
  const done = new Set(habit.done || []);
  const days = [...done].sort();
  if (!days.length) return 0;

  let best = 0;
  let run = 0;
  const [firstYear, firstMonth, firstDay] = days[0].split("-").map(Number);
  const [lastYear, lastMonth, lastDay] = days[days.length - 1].split("-").map(Number);
  const cursor = new Date(firstYear, firstMonth - 1, firstDay);
  const last = new Date(lastYear, lastMonth - 1, lastDay);
  while (cursor <= last) {
    if (isScheduledOn(habit, cursor)) {
      if (done.has(todayKey(cursor))) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return best;
}

function hasPerfectWeek(habit) {
  const done = new Set(habit.done || []);
  const repeat = new Set(habit.repeatDays && habit.repeatDays.length ? habit.repeatDays : [0, 1, 2, 3, 4, 5, 6]);
  let anyScheduled = false;
  for (let i = 0; i < 7; i += 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const jsDay = d.getDay();
    const idx = jsDay === 0 ? 6 : jsDay - 1;
    if (repeat.has(idx)) {
      anyScheduled = true;
      if (!done.has(todayKey(d))) return false;
    }
  }
  return anyScheduled;
}

function computeStats() {
  const totalHabits = habits.length;
  const totalDone = habits.reduce((s, h) => s + (h.done || []).length, 0);
  const bestStreak = habits.reduce((m, h) => Math.max(m, longestStreak(h)), 0);
  const perfectWeek = habits.some(hasPerfectWeek);
  return { totalHabits, totalDone, bestStreak, perfectWeek };
}

function miniIcon(pathMarkup, size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${pathMarkup}</svg>`;
}

const ACH_ICONS = {
  seed: ICONS.find((i) => i.id === "plant").svg,
  checkCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.2 2.2 4.6-5"/>',
  flame: '<path d="M12 2.2c1.1 3-.9 4.4-2.2 6.3-1 1.5-1.6 3-1.6 4.6a3.8 3.8 0 0 0 7.6 0c0-1-.3-1.8-.8-2.6.1 1.4-.5 2.1-1 2.4.5-3.1-1-5.3-2-10.7zM8.6 14.6c-.1.5-.2 1-.2 1.5a4.6 4.6 0 0 0 9.2 0c0-.8-.2-1.6-.6-2.3-.7 2.5-2.6 3.5-4.1 3.5-1.8 0-3.5-1-4.3-2.7z"/>',
  trophy: '<path d="M7 4h10v3a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a3 3 0 0 0 3 5"/><path d="M17 5h3a3 3 0 0 1-3 5"/><path d="M12 12v3"/><path d="M9 19h6"/><path d="M10 16h4l.5 3h-5z"/>',
  layers: '<path d="M12 3l8 4-8 4-8-4 8-4z"/><path d="M4 11l8 4 8-4"/><path d="M4 15l8 4 8-4"/>',
  star: '<path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L12 16.9 6.4 20l1.4-6.2L3 9.5l6.4-.6L12 3z"/>',
  calendarCheck: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17"/><path d="M8 3v3M16 3v3"/><path d="M9 14.5l2 2 4-4.5"/>',
};

const ACHIEVEMENTS = [
  {
    id: "start",
    title: "Первый шаг",
    desc: "Создай свою первую привычку",
    icon: ACH_ICONS.seed,
    unlocked: (s) => s.totalHabits >= 1,
    progress: (s) => `${Math.min(s.totalHabits, 1)}/1`,
  },
  {
    id: "firstMark",
    title: "Лёд тронулся",
    desc: "Отметь первый выполненный день",
    icon: ACH_ICONS.checkCircle,
    unlocked: (s) => s.totalDone >= 1,
    progress: (s) => `${Math.min(s.totalDone, 1)}/1`,
  },
  {
    id: "streak7",
    title: "Неделя силы",
    desc: "Серия 7 дней подряд по одной привычке",
    icon: ACH_ICONS.flame,
    unlocked: (s) => s.bestStreak >= 7,
    progress: (s) => `${Math.min(s.bestStreak, 7)}/7`,
  },
  {
    id: "streak30",
    title: "Железная воля",
    desc: "30 дней подряд без единого пропуска",
    icon: ACH_ICONS.trophy,
    unlocked: (s) => s.bestStreak >= 30,
    progress: (s) => `${Math.min(s.bestStreak, 30)}/30`,
  },
  {
    id: "five",
    title: "Коллекционер",
    desc: "Веди 5 привычек одновременно",
    icon: ACH_ICONS.layers,
    unlocked: (s) => s.totalHabits >= 5,
    progress: (s) => `${Math.min(s.totalHabits, 5)}/5`,
  },
  {
    id: "hundred",
    title: "Сотня",
    desc: "100 отметок выполнения всего",
    icon: ACH_ICONS.star,
    unlocked: (s) => s.totalDone >= 100,
    progress: (s) => `${Math.min(s.totalDone, 100)}/100`,
  },
  {
    id: "perfectWeek",
    title: "Идеальная неделя",
    desc: "Выполни все запланированные дни за последние 7 дней",
    icon: ACH_ICONS.calendarCheck,
    unlocked: (s) => s.perfectWeek,
    progress: (s) => (s.perfectWeek ? "готово" : "в процессе"),
  },
  {
    id: "streak100",
    title: "Столетний огонь",
    desc: "100 дней подряд по одной привычке",
    icon: ACH_ICONS.flame,
    unlocked: (s) => s.bestStreak >= 100,
    progress: (s) => `${Math.min(s.bestStreak, 100)}/100`,
  },
  {
    id: "streak200",
    title: "Огонь не гаснет",
    desc: "200 дней подряд по одной привычке",
    icon: ACH_ICONS.trophy,
    unlocked: (s) => s.bestStreak >= 200,
    progress: (s) => `${Math.min(s.bestStreak, 200)}/200`,
  },
  {
    id: "streak500",
    title: "Полтысячи",
    desc: "500 дней подряд по одной привычке",
    icon: ACH_ICONS.star,
    unlocked: (s) => s.bestStreak >= 500,
    progress: (s) => `${Math.min(s.bestStreak, 500)}/500`,
  },
  {
    id: "streak1000",
    title: "Легенда",
    desc: "1000 дней подряд по одной привычке",
    icon: ACH_ICONS.flame,
    unlocked: (s) => s.bestStreak >= 1000,
    progress: (s) => `${Math.min(s.bestStreak, 1000)}/1000`,
  },
];

/* ---------- Milestones (flame celebration) ---------- */
const MILESTONES = [
  {
    days: 30,
    title: "Железная воля",
    text: "Целый месяц без единого пропуска.",
    outer: ["#d6320c", "#ff8a1f", "#ffd76b"],
    inner: ["#ff9f0a", "#ffcf5c", "#fff6da"],
    glow: "rgba(255, 140, 30, 0.6)",
    ember: "#ffb347",
    embers: 26,
  },
  {
    days: 100,
    title: "Сотня дней",
    text: "Сто дней подряд — это уже характер.",
    outer: ["#b3122f", "#ff4f1f", "#ffb02e"],
    inner: ["#ff7a1a", "#ffc94d", "#fff3cf"],
    glow: "rgba(255, 90, 40, 0.65)",
    ember: "#ff7a3d",
    embers: 34,
  },
  {
    days: 200,
    title: "Двести дней",
    text: "Больше полугода огонь не гаснет.",
    outer: ["#8a1fd1", "#ff3d81", "#ffb15c"],
    inner: ["#ff5fa0", "#ffc0a0", "#fff1e6"],
    glow: "rgba(255, 61, 129, 0.65)",
    ember: "#ff6fa6",
    embers: 42,
  },
  {
    days: 500,
    title: "Полтысячи",
    text: "Пятьсот дней. Это уже часть тебя.",
    outer: ["#0a52c9", "#2ba8ff", "#c9f3ff"],
    inner: ["#4cc3ff", "#b8ecff", "#ffffff"],
    glow: "rgba(60, 170, 255, 0.65)",
    ember: "#7fd3ff",
    embers: 52,
  },
  {
    days: 1000,
    title: "Тысяча дней",
    text: "Легенда. Такое доводят до конца единицы.",
    outer: ["#b8860b", "#ffd54a", "#fff7c2"],
    inner: ["#ffe27a", "#fff6c4", "#ffffff"],
    glow: "rgba(255, 215, 90, 0.7)",
    ember: "#ffe27a",
    embers: 64,
  },
];

let milestoneQueue = [];
let milestoneCountRaf = 0;

function bigFlameSvg(m) {
  return `<svg class="big-flame" viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="mfOuter" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="${m.outer[0]}"/>
        <stop offset="45%" stop-color="${m.outer[1]}"/>
        <stop offset="100%" stop-color="${m.outer[2]}"/>
      </linearGradient>
      <linearGradient id="mfInner" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="${m.inner[0]}"/>
        <stop offset="55%" stop-color="${m.inner[1]}"/>
        <stop offset="100%" stop-color="${m.inner[2]}"/>
      </linearGradient>
    </defs>
    <path fill="url(#mfOuter)" d="M12 2.1c1.4 2.6.3 4.3-1.2 6.1-1.9 2.2-3.5 4.2-3.5 6.7a4.7 4.7 0 0 0 9.4 0c0-1.4-.4-2.5-1-3.5.2 1.7-.7 2.6-1.5 3 .9-3.7-.5-5.8.3-8.8.4-1.5-1-2.5-1.8-3.7z"/>
    <path fill="url(#mfInner)" d="M12.4 9.7c.7 1.5-.1 2.4-1 3.3-.9 1-1.7 2-1.7 3.3a2.6 2.6 0 0 0 5.2 0c0-.8-.2-1.4-.6-1.9.1.8-.4 1.3-.8 1.5.5-1.9-.4-3-.5-4.5-.1-.6-.3-1.2-.6-1.7z"/>
  </svg>`;
}

function buildEmbers(m) {
  milestoneEmbers.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (let i = 0; i < m.embers; i += 1) {
    const e = document.createElement("span");
    e.className = "ember";
    e.style.setProperty("--x", `${Math.random() * 100}%`);
    e.style.setProperty("--size", `${2 + Math.random() * 4}px`);
    e.style.setProperty("--dur", `${3 + Math.random() * 3.5}s`);
    e.style.setProperty("--delay", `${(Math.random() * 3).toFixed(2)}s`);
    e.style.setProperty("--sway", `${(Math.random() - 0.5) * 120}px`);
    frag.appendChild(e);
  }
  milestoneEmbers.appendChild(frag);
}

function countUp(el, to, ms) {
  cancelAnimationFrame(milestoneCountRaf);
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = String(Math.round(to * eased));
    if (k < 1) milestoneCountRaf = requestAnimationFrame(step);
  };
  milestoneCountRaf = requestAnimationFrame(step);
}

function showMilestone(item) {
  const { milestone: m, habitName } = item;
  milestoneDialog.style.setProperty("--glow", m.glow);
  milestoneDialog.style.setProperty("--ember", m.ember);
  milestoneFlame.innerHTML = bigFlameSvg(m);
  milestoneTitle.textContent = m.title;
  milestoneText.textContent = m.text;
  milestoneHabit.textContent = habitName;
  milestoneDays.textContent = "дней подряд";
  milestoneNum.textContent = "0";
  buildEmbers(m);
  if (!milestoneDialog.open) milestoneDialog.showModal();
  setTimeout(() => countUp(milestoneNum, m.days, 1100), 500);
}

function nextMilestone() {
  const item = milestoneQueue.shift();
  if (item) showMilestone(item);
}

function closeMilestone() {
  cancelAnimationFrame(milestoneCountRaf);
  if (milestoneDialog.open) milestoneDialog.close();
  milestoneEmbers.innerHTML = "";
  if (milestoneQueue.length) setTimeout(nextMilestone, 250);
}

milestoneClose.addEventListener("click", closeMilestone);
milestoneDialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeMilestone();
});

// Called after a day is marked. Celebrates every not-yet-celebrated
// milestone the current streak has reached (once per habit per milestone).
function checkMilestones(habit) {
  const streak = streakOf(habit);
  habit.celebrated = habit.celebrated || [];
  const hit = MILESTONES.filter((m) => streak >= m.days && !habit.celebrated.includes(m.days));
  if (!hit.length) return;
  hit.forEach((m) => habit.celebrated.push(m.days));
  save();
  const top = hit[hit.length - 1];
  milestoneQueue.push({ milestone: top, habitName: habit.name });
  // let the small flame ignite first, then show the big one
  setTimeout(() => {
    if (!milestoneDialog.open) nextMilestone();
  }, 700);
}

/* ---------- Tasks ---------- */
function scheduledToday(habit) {
  const idx = (new Date().getDay() + 6) % 7;
  const rd = habit.repeatDays && habit.repeatDays.length ? habit.repeatDays : [0, 1, 2, 3, 4, 5, 6];
  return rd.includes(idx);
}

function datesThisWeek() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const dates = [];
  for (const date = new Date(monday); date <= today; date.setDate(date.getDate() + 1)) {
    dates.push(new Date(date));
  }
  return dates;
}

function taskRotationIndex(date, size) {
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return ((dayNumber % size) + size) % size;
}

function pluralForm(number, forms) {
  const lastTwo = number % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  const last = number % 10;
  return forms[last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2];
}

function rotatingTasks(pool, count, date) {
  const start = taskRotationIndex(date, pool.length);
  return Array.from({ length: count }, (_, i) => pool[(start + i) % pool.length]);
}

function computeDailyTasks() {
  const scheduled = habits.filter(scheduledToday);
  const doneScheduled = scheduled.filter(isDoneToday).length;
  const anyDone = habits.some(isDoneToday) ? 1 : 0;
  const restDay = scheduled.length === 0;
  const targetForToday = (count) => Math.min(count, Math.max(1, scheduled.length));

  const pool = [
    {
      title: "Первый шаг",
      desc: "Отметь хотя бы одну привычку сегодня",
      icon: ACH_ICONS.flame,
      value: anyDone,
      target: 1,
    },
    {
      title: restDay ? "День отдыха" : "Закрой план",
      desc: restDay ? "Сегодня по расписанию нет привычек" : "Выполни все привычки, запланированные на сегодня",
      icon: ACH_ICONS.calendarCheck,
      value: restDay ? 1 : doneScheduled,
      target: restDay ? 1 : scheduled.length,
    },
    {
      title: targetForToday(2) === 1 ? "Отметка дня" : "Две отметки",
      desc: restDay ? "Сегодня по расписанию можно отдохнуть" : targetForToday(2) === 1 ? "Выполни привычку сегодня" : "Выполни 2 привычки сегодня",
      icon: ACH_ICONS.layers,
      value: restDay ? 1 : doneScheduled,
      target: targetForToday(2),
    },
    {
      title: "Поддержи огонёк",
      desc: "Выполни сегодня привычку с активной серией",
      icon: ACH_ICONS.flame,
      value: scheduled.filter((habit) => isDoneToday(habit) && streakOf(habit) > 1).length,
      target: 1,
    },
    {
      title: "Все привычки в деле",
      desc: restDay ? "Сегодня по расписанию можно отдохнуть" : "Выполни привычки, запланированные на сегодня",
      icon: ACH_ICONS.star,
      value: restDay ? 1 : doneScheduled,
      target: targetForToday(3),
    },
  ];
  return rotatingTasks(pool, 3, new Date());
}

function computeWeeklyTasks() {
  const dates = datesThisWeek();
  const dateKeys = new Set(dates.map(todayKey));
  const weekMarks = habits.reduce((sum, habit) => sum + (habit.done || []).filter((key) => dateKeys.has(key)).length, 0);
  const scheduledWeekMarks = habits.reduce(
    (sum, habit) => sum + dates.filter((date) => isScheduledOn(habit, date) && (habit.done || []).includes(todayKey(date))).length,
    0
  );
  const markedHabits = habits.filter((habit) => (habit.done || []).some((key) => dateKeys.has(key))).length;
  const maxHabitMarks = habits.reduce((max, habit) => {
    const count = (habit.done || []).filter((key) => dateKeys.has(key)).length;
    return Math.max(max, count);
  }, 0);
  const scheduledDates = dates.filter((date) => habits.some((habit) => isScheduledOn(habit, date)));
  const perfectDays = scheduledDates.filter((date) => {
    const scheduled = habits.filter((habit) => isScheduledOn(habit, date));
    return scheduled.every((habit) => (habit.done || []).includes(todayKey(date)));
  }).length;
  const fullWeek = dates.length ? Array.from({ length: 7 }, (_, i) => {
    const date = new Date(dates[0]);
    date.setDate(date.getDate() + i);
    return date;
  }) : [];
  const completedHabitPlans = habits.filter((habit) => {
    const planned = fullWeek.filter((date) => isScheduledOn(habit, date));
    return planned.length > 0 && planned.every((date) => (habit.done || []).includes(todayKey(date)));
  }).length;
  const weeklyOpportunities = habits.reduce(
    (sum, habit) => sum + fullWeek.filter((date) => isScheduledOn(habit, date)).length,
    0
  );
  const activeDayOpportunities = fullWeek.filter((date) => habits.some((habit) => isScheduledOn(habit, date))).length;
  const fiveMarksTarget = Math.min(5, Math.max(1, weeklyOpportunities));
  const tenMarksTarget = Math.min(10, Math.max(1, weeklyOpportunities));
  const activeDaysTarget = Math.min(4, Math.max(1, activeDayOpportunities));
  const repeatsTarget = Math.min(3, Math.max(1, habits.reduce(
    (max, habit) => Math.max(max, fullWeek.filter((date) => isScheduledOn(habit, date)).length),
    0
  )));
  const perfectDaysTarget = Math.min(3, Math.max(1, scheduledDates.length));
  const pool = [
    {
      title: fiveMarksTarget === 5 ? "Неделя в ритме" : "Отметки недели",
      desc: `Собери ${fiveMarksTarget} ${pluralForm(fiveMarksTarget, ["отметку", "отметки", "отметок"])} за эту неделю`,
      icon: ACH_ICONS.layers,
      value: weekMarks,
      target: fiveMarksTarget,
    },
    {
      title: tenMarksTarget === 10 ? "Десять шагов" : "Недельная цель",
      desc: `Набери ${tenMarksTarget} ${pluralForm(tenMarksTarget, ["выполнение", "выполнения", "выполнений"])} за эту неделю`,
      icon: ACH_ICONS.calendarCheck,
      value: weekMarks,
      target: tenMarksTarget,
    },
    {
      title: "Разнообразие",
      desc: "Отметь разные привычки в течение недели",
      icon: ACH_ICONS.star,
      value: markedHabits,
      target: Math.min(3, Math.max(1, habits.length)),
    },
    {
      title: repeatsTarget === 3 ? "Три повтора" : "Повторы по плану",
      desc: `Выполни одну привычку ${repeatsTarget} ${repeatsTarget === 1 ? "раз" : "раза"} за неделю`,
      icon: ACH_ICONS.flame,
      value: maxHabitMarks,
      target: repeatsTarget,
    },
    {
      title: "Идеальные дни",
      desc: perfectDaysTarget === 1 ? "Закрой весь план в запланированный день" : `Закрой весь план в ${perfectDaysTarget} запланированных дня`,
      icon: ACH_ICONS.checkCircle,
      value: perfectDays,
      target: perfectDaysTarget,
    },
    {
      title: "Ритм на неделе",
      desc: "Выполняй привычки в разные дни недели",
      icon: ACH_ICONS.star,
      value: dates.filter((date) => habits.some((habit) => isScheduledOn(habit, date) && (habit.done || []).includes(todayKey(date)))).length,
      target: activeDaysTarget,
    },
    {
      title: "Одна привычка — весь план",
      desc: "Выполни все запланированные дни одной привычки на этой неделе",
      icon: ACH_ICONS.trophy,
      value: completedHabitPlans,
      target: 1,
    },
    {
      title: "По расписанию",
      desc: `Выполни ${fiveMarksTarget} ${pluralForm(fiveMarksTarget, ["привычку", "привычки", "привычек"])} по плану`,
      icon: ACH_ICONS.calendarCheck,
      value: scheduledWeekMarks,
      target: fiveMarksTarget,
    },
  ];
  return rotatingTasks(pool, 4, dates[0] || new Date());
}

function renderTaskList(container, tasks, badge) {
  container.innerHTML = "";
  tasks.forEach((t) => {
    const done = t.value >= t.target;
    const pct = Math.min(100, Math.round((t.value / t.target) * 100));
    const card = document.createElement("div");
    card.className = `task-card${done ? " done" : ""}`;
    card.innerHTML = `
      <div class="task-icon">${miniIcon(done ? ACH_ICONS.checkCircle : t.icon, 20)}</div>
      <div class="task-text"><h4>${t.title}</h4><p>${t.desc}</p></div>
      <span class="task-badge">${badge}</span>
      <div class="task-bar">
        <div class="task-track"><div class="task-fill" style="width:${pct}%"></div></div>
        <span class="task-count">${Math.min(t.value, t.target)}/${t.target}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderTasks() {
  renderTaskList(dailyTaskList, computeDailyTasks(), "сегодня");
  renderTaskList(weeklyTaskList, computeWeeklyTasks(), "неделя");
}

function renderAchievements() {
  const stats = computeStats();
  achGrid.innerHTML = "";
  ACHIEVEMENTS.forEach((a) => {
    const unlocked = a.unlocked(stats);
    const card = document.createElement("div");
    card.className = `ach-card ${unlocked ? "unlocked" : "locked"}`;
    card.innerHTML = `
      <div class="ach-icon">${miniIcon(a.icon, 20)}</div>
      ${unlocked ? `<div class="ach-check">${miniIcon(ACH_ICONS.checkCircle, 12)}</div>` : ""}
      <h4>${a.title}</h4>
      <p>${a.desc}</p>
      <span class="ach-progress">${a.progress(stats)}</span>
    `;
    achGrid.appendChild(card);
  });
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function render() {
  grid.innerHTML = "";
  empty.hidden = habits.length > 0;
  habits.forEach((habit) => {
    const streak = streakOf(habit);
    const shape = habit.shape || "rect";
    const card = document.createElement("button");
    card.className = `card shape-${shape}`;
    card.type = "button";
    card.style.background = `linear-gradient(160deg, ${hexToRgba(habit.color, 0.32)}, var(--panel) 72%)`;
    card.innerHTML = `
      <div class="card-icon" style="background:${habit.color}">${iconSvg(habit.icon, 18)}</div>
      <h3>${escapeHtml(habit.name)}</h3>
      <div class="flame">${flameIcon(streak > 0, 14, ignitedHabitId === habit.id)} <strong>${daysLabel(streak)}</strong></div>
      <p class="days-summary">${repeatSummary(habit.repeatDays)}</p>
    `;
    card.addEventListener("click", () => openDetail(habit.id));
    grid.appendChild(card);
  });
  renderTasks();
  renderAchievements();
}

function scheduleTaskRefresh() {
  const nextDay = new Date();
  nextDay.setHours(24, 0, 1, 0);
  setTimeout(() => {
    render();
    scheduleTaskRefresh();
  }, nextDay.getTime() - Date.now());
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function fillPickers() {
  iconPick.innerHTML = "";
  colorPick.innerHTML = "";

  ICONS.forEach((icon) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = iconSvg(icon.id, 18);
    b.title = icon.label;
    b.className = icon.id === selectedIcon ? "selected" : "";
    b.addEventListener("click", () => {
      selectedIcon = icon.id;
      fillPickers();
    });
    iconPick.appendChild(b);
  });

  COLORS.forEach((color) => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.background = color;
    b.className = color === selectedColor ? "selected" : "";
    b.addEventListener("click", () => {
      selectedColor = color;
      fillPickers();
    });
    colorPick.appendChild(b);
  });

  shapePick.querySelectorAll(".shape-btn").forEach((b) => {
    b.classList.toggle("selected", b.dataset.shape === selectedShape);
  });

  daysPick.querySelectorAll(".day-btn").forEach((b) => {
    const d = Number(b.dataset.day);
    b.classList.toggle("selected", selectedDays.has(d));
  });
}

shapePick.querySelectorAll(".shape-btn").forEach((b) => {
  b.addEventListener("click", () => {
    selectedShape = b.dataset.shape;
    fillPickers();
  });
});

daysPick.querySelectorAll(".day-btn").forEach((b) => {
  b.addEventListener("click", () => {
    const d = Number(b.dataset.day);
    if (selectedDays.has(d)) {
      if (selectedDays.size > 1) selectedDays.delete(d);
    } else {
      selectedDays.add(d);
    }
    fillPickers();
  });
});

addBtn.addEventListener("click", () => {
  selectedIcon = ICONS[0].id;
  selectedColor = COLORS[0];
  selectedShape = "rect";
  selectedDays = new Set([0, 1, 2, 3, 4, 5, 6]);
  habitName.value = "";
  fillPickers();
  habitDialog.showModal();
});

cancelHabit.addEventListener("click", () => habitDialog.close());

habitForm.addEventListener("submit", (e) => {
  e.preventDefault();
  habits.push({
    id: crypto.randomUUID(),
    name: habitName.value.trim(),
    icon: selectedIcon,
    color: selectedColor,
    shape: selectedShape,
    repeatDays: [...selectedDays].sort(),
    done: [],
  });
  save();
  render();
  habitDialog.close();
});

function openDetail(id) {
  openId = id;
  view = new Date();
  view.setDate(1);
  paintDetail();
  detailDialog.showModal();
}

function paintDetail() {
  const habit = habits.find((h) => h.id === openId);
  if (!habit) return;
  const streak = streakOf(habit);
  detailName.textContent = habit.name;
  detailIcon.innerHTML = iconSvg(habit.icon, 22);
  detailIcon.style.background = habit.color;
  streakText.textContent = daysLabel(streak);
  flame.innerHTML = flameIcon(streak > 0, 18, ignitedHabitId === habit.id);
  detailDays.textContent = repeatSummary(habit.repeatDays);
  monthLabel.textContent = view.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  drawCalendar(habit);
}

function drawCalendar(habit) {
  calendar.innerHTML = "";
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  let start = first.getDay();
  start = start === 0 ? 6 : start - 1;
  const done = new Set(habit.done || []);
  const now = todayKey();
  const repeatDays = new Set(habit.repeatDays && habit.repeatDays.length ? habit.repeatDays : [0, 1, 2, 3, 4, 5, 6]);

  for (let i = 0; i < start; i += 1) {
    const spacer = document.createElement("div");
    spacer.className = "cal-spacer";
    calendar.appendChild(spacer);
  }

  for (let d = 1; d <= last.getDate(); d += 1) {
    const date = new Date(year, month, d);
    const key = todayKey(date);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    btn.textContent = String(d);
    const scheduled = repeatDays.has((date.getDay() + 6) % 7);
    if (scheduled) {
      btn.classList.add("scheduled");
      btn.title = "Запланированный день";
    }
    if (key === now) btn.classList.add("today");
    if (done.has(key)) {
      btn.classList.add("done");
      btn.style.background = habit.color;
    }
    btn.addEventListener("click", () => {
      const set = new Set(habit.done || []);
      const wasDone = set.has(key);
      if (wasDone) set.delete(key);
      else set.add(key);
      habit.done = [...set];
      save();
      ignitedHabitId = !wasDone && key === now ? habit.id : null;
      paintDetail();
      render();
      ignitedHabitId = null;
      if (!wasDone) checkMilestones(habit);
    });
    calendar.appendChild(btn);
  }
}

document.getElementById("prevMonth").addEventListener("click", () => {
  view.setMonth(view.getMonth() - 1);
  paintDetail();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  view.setMonth(view.getMonth() + 1);
  paintDetail();
});

document.getElementById("closeDetail").addEventListener("click", () => detailDialog.close());

document.getElementById("deleteHabit").addEventListener("click", () => {
  habits = habits.filter((h) => h.id !== openId);
  save();
  render();
  detailDialog.close();
});

fillPickers();
render();
scheduleTaskRefresh();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});