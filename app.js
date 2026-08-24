"use strict";

const telegram = window.Telegram && window.Telegram.WebApp;
if (telegram) {
  document.body.classList.add("telegram-mini-app");
  telegram.ready();
  telegram.expand();
  if (telegram.setHeaderColor) telegram.setHeaderColor("#e95d3f");
  if (telegram.setBackgroundColor) telegram.setBackgroundColor("#e95d3f");
  if (telegram.disableVerticalSwipes) telegram.disableVerticalSwipes();
}

const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");
const form = document.querySelector("#controls");

const controls = {
  yaw: document.querySelector("#yaw"),
  pitch: document.querySelector("#pitch"),
  mood: document.querySelector("#mood"),
  weird: document.querySelector("#weird"),
  accessory: document.querySelector("#accessory"),
  seed: document.querySelector("#seed"),
};

const outputs = {
  yaw: document.querySelector("#yaw-output"),
  pitch: document.querySelector("#pitch-output"),
  mood: document.querySelector("#mood-output"),
  weird: document.querySelector("#weird-output"),
  name: document.querySelector("#face-name"),
  code: document.querySelector("#face-code"),
  diagnosis: document.querySelector("#diagnosis"),
  treatment: document.querySelector("#treatment"),
  status: document.querySelector("#status"),
};

const firstNames = ["Инспектор", "Барон", "Профессор", "Шеф", "Граф", "Тётя", "Капитан", "Доктор", "Маэстро", "Академик"];
const lastNames = ["Булочка", "Пельмень", "Понедельник", "Кабачок", "Шуршун", "Компот", "Печенька", "Мякиш", "Тапок", "Сюрприз"];
const accessories = ["none", "glasses", "moustache", "hat", "antenna", "eyepatch"];
const diagnoses = [
  "Синдром делового пельменя", "Острая нехватка пятницы", "Хроническое лицо совещания",
  "Смещение бровей по фазе луны", "Кабачковая задумчивость второй степени", "Повышенная концентрация важности",
  "Синдром случайного начальника", "Лёгкая тапочная интоксикация", "Компотная нестабильность профиля",
  "Вялотекущая гениальность", "Острое желание отменить всё", "Пельменный резонанс скул",
  "Синдром уверенного кивка", "Недостаточность драматической паузы", "Избыточная праздничность головы",
  "Метеозависимость левого уха", "Лицевой режим энергосбережения", "Спонтанная баронизация",
  "Утомление от собственной загадочности", "Синдром последней печеньки", "Временная несовместимость с утром",
  "Мякишная форма харизмы", "Переизбыток внутреннего эксперта", "Нарушение серьёзности неизвестного происхождения",
];
const treatments = [
  "дважды пожать плечами и отменить созвон", "приложить к голове тёплый пельмень на 15 минут",
  "три раза сказать «ну и ладно» перед зеркалом", "срочно выпить компот и не принимать решений",
  "лежать лицом вверх до появления пятницы", "назначить себе выходной без согласования",
  "носить колпак до нормализации самооценки", "избегать серьёзных людей и мелкого шрифта",
  "принимать по одной печеньке после каждого письма", "проветрить брови и повторить через неделю",
  "временно запретить себе быть молодцом", "сделать важное лицо, затем немедленно перестать",
];
const palettes = [
  { background: "#f5c84b", ink: "#193f40", face: "#fff1c8", accent: "#e6533a", cool: "#4ba8a2", shade: "#e6b071" },
  { background: "#6bc0b5", ink: "#22221d", face: "#ffe0b5", accent: "#e8513c", cool: "#345f73", shade: "#d89d73" },
  { background: "#ed765b", ink: "#183f46", face: "#fff0c9", accent: "#f2c647", cool: "#3f9e95", shade: "#e6a270" },
  { background: "#8f80be", ink: "#22201f", face: "#f8dfaa", accent: "#e9583d", cool: "#467c82", shade: "#d6a26e" },
];

const TAU = Math.PI * 2;
const state = { dragging: false, lastX: 0, lastY: 0, blink: 0, blinkTimer: 0 };

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function radians(degrees) { return degrees * Math.PI / 180; }
function point(x, y, z = 0) { return { x, y, z }; }

function rotate(local, yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = local.x * cy + local.z * sy;
  const z1 = -local.x * sy + local.z * cy;
  return point(x1, local.y * cp - z1 * sp, local.y * sp + z1 * cp);
}

function project(local, view) {
  const turned = rotate(local, view.yaw, view.pitch);
  const focal = 4.4;
  const perspective = focal / (focal - turned.z);
  return {
    x: canvas.width * 0.5 + turned.x * view.scale * perspective,
    y: canvas.height * 0.49 + turned.y * view.scale * perspective,
    z: turned.z,
  };
}

function identityFrom(seed) {
  const random = mulberry32(seed ^ 0x51f15e);
  const paletteIndex = Math.floor(random() * palettes.length);
  const identity = {
    seed,
    paletteIndex,
    headWidth: 0.77 + random() * 0.22,
    headHeight: 0.98 + random() * 0.16,
    cheekBias: (random() - 0.5) * 0.09,
    eyeSpacing: 0.27 + random() * 0.08,
    eyeScaleL: 0.09 + random() * 0.07,
    eyeScaleR: 0.09 + random() * 0.07,
    eyeLift: (random() - 0.5) * 0.08,
    noseLength: 0.12 + random() * 0.2,
    noseLean: (random() - 0.5) * 0.09,
    mouthWidth: 0.28 + random() * 0.22,
    earScale: 0.1 + random() * 0.09,
    hairCount: 6 + Math.floor(random() * 9),
    hairLift: 0.12 + random() * 0.23,
    hairPart: (random() - 0.5) * 0.42,
    freckles: random() > 0.48,
    name: `${firstNames[Math.floor(random() * firstNames.length)]} ${lastNames[Math.floor(random() * lastNames.length)]}`,
  };
  identity.autoAccessory = accessories[Math.floor(random() * accessories.length)];
  return identity;
}

function diagnosisFrom(seed, weird, mood) {
  const random = mulberry32(seed ^ hashText(`doctor:${Math.round(weird * 100)}:${Math.round(mood * 100)}`));
  const label = diagnoses[Math.floor(random() * diagnoses.length)];
  const needsTreatment = random() < 0.24 + weird * 0.27;
  const prescription = treatments[Math.floor(random() * treatments.length)];
  return {
    label,
    treatment: needsTreatment ? `Требуется лечение: ${prescription}.` : "Лечение не требуется. Наблюдать и хихикать.",
  };
}

function getSettings() {
  const seed = clamp(Math.round(Number(controls.seed.value) || 1), 1, 999999);
  return {
    seed,
    yaw: radians(Number(controls.yaw.value)),
    pitch: radians(Number(controls.pitch.value)),
    yawDegrees: Number(controls.yaw.value),
    pitchDegrees: Number(controls.pitch.value),
    mood: Number(controls.mood.value) / 100,
    weird: Number(controls.weird.value) / 100,
    accessory: controls.accessory.value,
    scale: canvas.width * 0.315,
  };
}

function featurePoints(anchor, offsets, view) {
  return offsets.map(([x, y, z = 0]) => project(point(anchor.x + x, anchor.y + y, anchor.z + z), view));
}

function localArc(anchor, radiusX, radiusY, start, end, count, view, zWave = 0) {
  return Array.from({ length: count }, (_, index) => {
    const t = start + (end - start) * index / (count - 1);
    return project(point(anchor.x + Math.cos(t) * radiusX, anchor.y + Math.sin(t) * radiusY, anchor.z + Math.sin(t) * zWave), view);
  });
}

function pathFrom(points, close = false) {
  ctx.beginPath();
  points.forEach((screen, index) => {
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  });
  if (close) ctx.closePath();
}

function roughStroke(points, style, random, roughness, passes = 2, close = false) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = style.color;
  const jitter = 0.5 + roughness * 4.4;
  for (let pass = 0; pass < passes; pass += 1) {
    const noisy = points.map((screen) => ({
      x: screen.x + (random() - 0.5) * jitter,
      y: screen.y + (random() - 0.5) * jitter,
    }));
    pathFrom(noisy, close);
    ctx.globalAlpha = pass === 0 ? 0.94 : 0.34;
    ctx.lineWidth = style.width + (random() - 0.5) * (0.8 + roughness * 1.8);
    ctx.stroke();
  }
  ctx.restore();
}

function fillShape(points, color) {
  pathFrom(points, true);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawPaper(view, identity, palette, random) {
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.strokeStyle = palette.ink;
  ctx.globalAlpha = 0.1;
  ctx.lineWidth = 2;
  for (let x = -canvas.height; x < canvas.width * 1.5; x += 38) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + canvas.height, canvas.height);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(94, 104);
  ctx.rotate(-0.08);
  ctx.fillStyle = palette.ink;
  ctx.font = "900 22px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillText("ЛИЦО № " + String(identity.seed).padStart(6, "0"), 0, 0);
  ctx.font = "700 12px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillText("эмоционально сертифицировано", 0, 24);
  ctx.restore();

  ctx.save();
  ctx.translate(canvas.width - 92, 110);
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 8;
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * TAU;
    const from = 28 + random() * 5;
    const to = 54 + random() * 12;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * from, Math.sin(angle) * from);
    ctx.lineTo(Math.cos(angle) * to, Math.sin(angle) * to);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = palette.ink;
  ctx.globalAlpha = 0.7;
  for (let index = 0; index < 80; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 0.4 + random() * 1.15, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function headOutline(identity, view) {
  const points = [];
  const count = 70;
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + index / count * TAU;
    const lower = Math.max(0, Math.sin(angle));
    const xScale = identity.headWidth * (1 - lower * 0.13);
    const cheek = lower * identity.cheekBias;
    points.push(project(point(Math.cos(angle) * xScale + cheek, Math.sin(angle) * identity.headHeight, -0.03 + lower * 0.04), view));
  }
  return points;
}

function drawEar(side, identity, view, palette, random) {
  const anchor = point(side * (identity.headWidth * 0.94), 0.04, -0.02);
  const ear = localArc(anchor, identity.earScale * 0.7, identity.earScale * 1.22, -Math.PI / 2, Math.PI * 1.5, 24, view);
  fillShape(ear, palette.face);
  roughStroke(ear, { color: palette.ink, width: 5 }, random, view.weird, 2, true);
  const curl = featurePoints(anchor, [[side * -0.02, -0.05, 0.02], [side * 0.035, -0.01, 0.04], [side * -0.005, 0.055, 0.02]], view);
  roughStroke(curl, { color: palette.accent, width: 4 }, random, view.weird, 2);
}

function drawEyes(identity, view, palette, random) {
  const eyeY = -0.17 + identity.eyeLift;
  const eyes = [{ side: -1, radius: identity.eyeScaleL }, { side: 1, radius: identity.eyeScaleR }];
  for (const eye of eyes) {
    const weirdScale = 1 + view.weird * (eye.side === -1 ? 0.2 : -0.08);
    const anchor = point(eye.side * identity.eyeSpacing, eyeY, 0.7);
    const blinkScale = 1 - state.blink * 0.92;
    const outline = localArc(anchor, eye.radius * 1.08 * weirdScale, eye.radius * 0.77 * blinkScale, 0, TAU, 28, view, 0.02);
    fillShape(outline, "#fffdf4");
    roughStroke(outline, { color: palette.ink, width: 5.2 }, random, view.weird, 2, true);

    const pupilCenter = point(anchor.x + Math.sin(view.yaw) * 0.025 + eye.side * view.weird * 0.004, anchor.y + view.mood * -0.012, anchor.z + 0.055);
    const pupil = localArc(pupilCenter, eye.radius * 0.28, eye.radius * 0.33 * blinkScale, 0, TAU, 18, view);
    fillShape(pupil, palette.ink);

    const browTilt = -view.mood * eye.side * 0.065 + view.weird * eye.side * 0.02;
    const brow = featurePoints(point(anchor.x, anchor.y - eye.radius * 1.45, 0.72), [[-eye.radius * 0.9, -browTilt, 0], [0, browTilt * 0.35 - 0.018, 0.02], [eye.radius * 0.9, browTilt, 0]], view);
    roughStroke(brow, { color: palette.ink, width: 7.2 }, random, view.weird, 2);
  }
}

function drawNose(identity, view, palette, random) {
  const anchor = point(identity.noseLean * view.weird, 0.02, 0.82);
  const nose = featurePoints(anchor, [[-0.02, -identity.noseLength * 0.45, 0], [identity.noseLean, identity.noseLength * 0.45, 0.06], [identity.noseLean - 0.045, identity.noseLength * 0.58, 0.02], [identity.noseLean + 0.075, identity.noseLength * 0.58, 0.01]], view);
  roughStroke(nose, { color: palette.accent, width: 5.5 }, random, view.weird, 2);
}

function drawMouth(identity, view, palette, random) {
  const anchor = point(0, 0.38, 0.7);
  const width = identity.mouthWidth * (1 + view.weird * 0.12);
  const smile = view.mood * 0.12;
  const offsets = [[-width, -smile * 0.38, 0], [-width * 0.52, smile * 0.36, 0.025], [0, smile * 0.72, 0.045], [width * 0.52, smile * 0.36, 0.025], [width, -smile * 0.38, 0]];
  const mouth = featurePoints(anchor, offsets, view);

  if (Math.abs(view.mood) > 0.58) {
    const lower = featurePoints(anchor, offsets.map(([x, y, z]) => [x * 0.83, y + 0.07 + Math.abs(view.mood) * 0.02, z]), view);
    fillShape([...mouth, ...[...lower].reverse()], view.mood > 0 ? palette.accent : palette.cool);
    roughStroke(lower, { color: palette.ink, width: 4 }, random, view.weird, 2);
  }
  roughStroke(mouth, { color: palette.ink, width: 7 }, random, view.weird, 3);
}

function drawCheeks(identity, view, palette, random) {
  for (const side of [-1, 1]) {
    const center = point(side * (identity.headWidth * 0.47), 0.22, 0.5);
    const dashCount = 3 + Math.round(view.weird * 2);
    for (let index = 0; index < dashCount; index += 1) {
      const y = (index - (dashCount - 1) / 2) * 0.035;
      const dash = featurePoints(center, [[-0.035, y, 0], [0.035, y - side * 0.01, 0]], view);
      roughStroke(dash, { color: palette.accent, width: 3 }, random, view.weird, 1);
    }
  }
}

function drawFreckles(identity, view, palette, random) {
  if (!identity.freckles) return;
  ctx.save();
  ctx.fillStyle = palette.shade;
  for (const side of [-1, 1]) {
    for (let index = 0; index < 5; index += 1) {
      const screen = project(point(side * (0.26 + random() * 0.18), 0.12 + random() * 0.16, 0.58), view);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 2.5 + random() * 2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawHair(identity, view, palette, random) {
  const start = -0.64;
  const span = 1.28;
  for (let index = 0; index < identity.hairCount; index += 1) {
    const t = identity.hairCount === 1 ? 0.5 : index / (identity.hairCount - 1);
    const x = start + span * t;
    const partPush = Math.sign(x - identity.hairPart) * identity.hairLift * (0.4 + random() * 0.55);
    const strand = featurePoints(point(0, -identity.headHeight * 0.78, 0.1), [[x, 0.1 + Math.abs(x) * 0.14, 0], [x + partPush * 0.22, -identity.hairLift, 0.05], [x + partPush, -identity.hairLift * (0.5 + view.weird * 0.65), 0.08]], view);
    roughStroke(strand, { color: index % 3 === 0 ? palette.accent : palette.ink, width: 8 }, random, view.weird, 2);
  }
}

function drawGlasses(identity, view, palette, random) {
  const eyeY = -0.17 + identity.eyeLift;
  const radius = Math.max(identity.eyeScaleL, identity.eyeScaleR) * 1.58;
  for (const side of [-1, 1]) {
    const frame = localArc(point(side * identity.eyeSpacing, eyeY, 0.77), radius, radius * 0.8, 0, TAU, 30, view);
    roughStroke(frame, { color: palette.cool, width: 7 }, random, view.weird, 2, true);
  }
  const bridge = featurePoints(point(0, eyeY, 0.78), [[-0.08, 0, 0], [0, -0.025, 0.03], [0.08, 0, 0]], view);
  roughStroke(bridge, { color: palette.cool, width: 6 }, random, view.weird, 2);
}

function drawMoustache(view, palette, random) {
  const center = point(0, 0.3, 0.79);
  for (const side of [-1, 1]) {
    const moustache = featurePoints(center, [[0, 0, 0], [side * 0.1, -0.035, 0.02], [side * 0.23, 0.035 + view.weird * 0.03, 0], [side * 0.34, -0.015 - view.weird * 0.06, -0.02]], view);
    roughStroke(moustache, { color: palette.ink, width: 15 }, random, view.weird, 3);
  }
}

function drawHat(identity, view, palette, random) {
  const brim = featurePoints(point(0, -identity.headHeight * 0.8, 0.12), [[-0.55, 0.06, 0], [0, 0, 0.05], [0.55, 0.06, 0]], view);
  roughStroke(brim, { color: palette.ink, width: 12 }, random, view.weird, 3);
  const hatHeight = 0.5 + view.weird * 0.08;
  const hat = featurePoints(point(0, -identity.headHeight * 0.86, 0.1), [[-0.38, 0, 0], [-0.08, -hatHeight, 0.04], [0.23, -0.14, 0.02], [0.38, 0, 0]], view);
  fillShape(hat, palette.accent);
  roughStroke(hat, { color: palette.ink, width: 6 }, random, view.weird, 2, true);
  const pom = project(point(-0.08, -identity.headHeight * 0.86 - hatHeight, 0.16), view);
  ctx.fillStyle = palette.face;
  ctx.beginPath();
  ctx.arc(pom.x, pom.y, 22 + view.weird * 8, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 5;
  ctx.stroke();
}

function drawAntenna(identity, view, palette, random) {
  const base = point(0, -identity.headHeight * 0.9, 0.18);
  const stalk = featurePoints(base, [[0, 0, 0], [0.05, -0.37, 0.02], [-0.06, -0.64, 0.04]], view);
  roughStroke(stalk, { color: palette.ink, width: 7 }, random, view.weird, 2);
  const bulb = project(point(-0.06, base.y - 0.66, 0.23), view);
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.arc(bulb.x, bulb.y, 18 + view.weird * 9, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 5;
  ctx.stroke();
}

function drawEyepatch(identity, view, palette, random) {
  const side = identity.seed % 2 ? -1 : 1;
  const eyeY = -0.17 + identity.eyeLift;
  const patch = localArc(point(side * identity.eyeSpacing, eyeY, 0.8), 0.17, 0.13, 0, TAU, 24, view);
  fillShape(patch, palette.ink);
  const strap = featurePoints(point(0, eyeY - 0.02, 0.74), [[-0.72, side * -0.08, -0.05], [0, 0, 0.04], [0.72, side * 0.08, -0.05]], view);
  roughStroke(strap, { color: palette.ink, width: 6 }, random, view.weird, 2);
}

function drawAccessory(kind, identity, view, palette, random) {
  if (kind === "glasses") drawGlasses(identity, view, palette, random);
  if (kind === "moustache") drawMoustache(view, palette, random);
  if (kind === "hat") drawHat(identity, view, palette, random);
  if (kind === "antenna") drawAntenna(identity, view, palette, random);
  if (kind === "eyepatch") drawEyepatch(identity, view, palette, random);
}

function drawSignature(identity, view, palette, diagnosis) {
  ctx.save();
  ctx.fillStyle = palette.face;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 3;
  ctx.fillRect(34, 824, canvas.width - 68, 102);
  ctx.strokeRect(34, 824, canvas.width - 68, 102);

  ctx.fillStyle = palette.ink;
  ctx.textAlign = "left";
  ctx.font = "900 18px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillText(`${identity.name.toUpperCase()} · АБСУРД ${Math.round(view.weird * 100)}%`, 52, 853, 600);
  ctx.font = "800 14px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillText(`ДИАГНОЗ: ${diagnosis.label}`, 52, 881, 850);
  ctx.font = "700 12px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillText(diagnosis.treatment, 52, 906, 640);

  ctx.textAlign = "right";
  ctx.font = "900 15px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillStyle = palette.accent;
  ctx.fillText("@litsasmeh_bot", canvas.width - 52, 906);
  ctx.restore();
}

function moodLabel(mood) {
  if (mood < -0.7) return "эпическая драма";
  if (mood < -0.25) return "что-то не так";
  if (mood < 0.25) return "слегка норм";
  if (mood < 0.7) return "довольно бодр";
  return "тотальный восторг";
}

function render() {
  const view = getSettings();
  const identity = identityFrom(view.seed);
  const palette = palettes[identity.paletteIndex];
  const random = mulberry32(view.seed ^ hashText(`${Math.round(view.weird * 100)}:${view.accessory}`));
  const chosenAccessory = view.accessory === "auto" ? identity.autoAccessory : view.accessory;
  const diagnosis = diagnosisFrom(view.seed, view.weird, view.mood);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPaper(view, identity, palette, random);
  drawEar(-1, identity, view, palette, random);
  drawEar(1, identity, view, palette, random);

  const outline = headOutline(identity, view);
  fillShape(outline, palette.face);
  roughStroke(outline, { color: palette.ink, width: 8 }, random, view.weird, 3, true);
  drawFreckles(identity, view, palette, random);
  drawCheeks(identity, view, palette, random);
  drawEyes(identity, view, palette, random);
  drawNose(identity, view, palette, random);
  drawMouth(identity, view, palette, random);
  drawHair(identity, view, palette, random);
  drawAccessory(chosenAccessory, identity, view, palette, random);
  drawSignature(identity, view, palette, diagnosis);

  outputs.yaw.value = `${view.yawDegrees}°`;
  outputs.pitch.value = `${view.pitchDegrees}°`;
  outputs.mood.value = moodLabel(view.mood);
  outputs.weird.value = `${Math.round(view.weird * 100)}%`;
  outputs.name.textContent = identity.name;
  outputs.code.textContent = `ДНК ${String(view.seed).padStart(6, "0")}`;
  outputs.diagnosis.textContent = diagnosis.label;
  outputs.treatment.textContent = diagnosis.treatment;

  const signature = [view.seed, view.yawDegrees, view.pitchDegrees, Math.round(view.mood * 100), Math.round(view.weird * 100), chosenAccessory, identity.paletteIndex].join("-");
  canvas.dataset.renderSignature = signature;
  canvas.dataset.faceName = identity.name;
}

function announce(message) { outputs.status.textContent = message; }
function haptic(style = "light") {
  if (telegram && telegram.HapticFeedback && telegram.HapticFeedback.impactOccurred) {
    telegram.HapticFeedback.impactOccurred(style);
  }
}
function setSeed(seed) { controls.seed.value = String(clamp(Math.round(seed), 1, 999999)); }

function randomSeed() {
  if (window.crypto && window.crypto.getRandomValues) {
    const number = new Uint32Array(1);
    window.crypto.getRandomValues(number);
    return number[0] % 999999 + 1;
  }
  return Math.floor(Math.random() * 999999) + 1;
}

function shuffleFace() {
  haptic("light");
  setSeed(randomSeed());
  render();
  announce(`${outputs.diagnosis.textContent}. ${outputs.treatment.textContent}`);
}

function surpriseMe() {
  haptic("medium");
  setSeed(randomSeed());
  controls.mood.value = String(Math.floor(Math.random() * 201) - 100);
  controls.weird.value = String(35 + Math.floor(Math.random() * 66));
  controls.accessory.value = "auto";
  controls.yaw.value = String(Math.floor(Math.random() * 49) - 24);
  controls.pitch.value = String(Math.floor(Math.random() * 25) - 12);
  render();
  announce(`${outputs.name.textContent}: ${outputs.diagnosis.textContent}. ${outputs.treatment.textContent}`);
}

function exportPortrait() {
  haptic("light");
  render();
  canvas.toBlob((blob) => {
    if (!blob) {
      announce("PNG не сложился. Лицо сопротивляется.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `лицесмешиватель-${controls.seed.value}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    announce(`Портрет ${outputs.name.textContent} сохранён: 960 × 960 PNG.`);
  }, "image/png");
}

for (const control of Object.values(controls)) {
  control.addEventListener("input", render);
  control.addEventListener("change", render);
}

document.querySelector("#shuffle").addEventListener("click", shuffleFace);
document.querySelector("#surprise").addEventListener("click", surpriseMe);
document.querySelector("#export").addEventListener("click", exportPortrait);

canvas.addEventListener("pointerdown", (event) => {
  state.dragging = true;
  state.lastX = event.clientX;
  state.lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.dragging) return;
  const dx = event.clientX - state.lastX;
  const dy = event.clientY - state.lastY;
  state.lastX = event.clientX;
  state.lastY = event.clientY;
  controls.yaw.value = String(clamp(Number(controls.yaw.value) + dx * 0.34, -58, 58));
  controls.pitch.value = String(clamp(Number(controls.pitch.value) + dy * 0.28, -26, 26));
  render();
});

function endDrag(event) {
  if (!state.dragging) return;
  state.dragging = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

window.addEventListener("keydown", (event) => {
  const tagName = document.activeElement && document.activeElement.tagName;
  const typing = tagName === "INPUT" || tagName === "SELECT";
  if (typing && event.key !== "Escape") return;

  if (event.code === "Space") {
    event.preventDefault();
    shuffleFace();
  } else if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    exportPortrait();
  } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    if (event.key === "ArrowLeft") controls.yaw.value = String(clamp(Number(controls.yaw.value) - 4, -58, 58));
    if (event.key === "ArrowRight") controls.yaw.value = String(clamp(Number(controls.yaw.value) + 4, -58, 58));
    if (event.key === "ArrowUp") controls.pitch.value = String(clamp(Number(controls.pitch.value) - 3, -26, 26));
    if (event.key === "ArrowDown") controls.pitch.value = String(clamp(Number(controls.pitch.value) + 3, -26, 26));
    render();
  }
});

let nextBlinkAt = performance.now() + 2200;
function animateBlink(now) {
  if (now > nextBlinkAt && !state.dragging) {
    state.blinkTimer += 0.16;
    state.blink = Math.sin(Math.min(1, state.blinkTimer) * Math.PI);
    render();
    if (state.blinkTimer >= 1) {
      state.blink = 0;
      state.blinkTimer = 0;
      nextBlinkAt = now + 2300 + (identityFrom(getSettings().seed).seed % 2400);
      render();
    }
  }
  requestAnimationFrame(animateBlink);
}

form.addEventListener("reset", () => window.setTimeout(render, 0));
render();
requestAnimationFrame(animateBlink);
