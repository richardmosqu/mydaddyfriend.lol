/* mydaddyfriend.lol
   Todo pasa en el navegador: la foto nunca se sube a ningún servidor. */
(() => {
  'use strict';

  const S = 560;                                   // lado de la textura de la cara (px)
  const TARGET = { x: 0.50, y: 0.45, dist: 0.30 }; // dónde caen los ojos dentro de la máscara de cara
  const KEY = 'mdf.v2';
  const MODELS = 'vendor/face-api/models';

  // t = lo que se lee en el globo, s = cómo se pronuncia.
  // Las comas y los puntos suspensivos son lo que hace que no suene a lector de PDF.
  const PHRASES = [
    { t: 'YES DADDY',              s: 'yesss... daddy' },
    { t: "YOU'RE MY DADDY",        s: "mmh, you're my daddy" },
    { t: 'I LOVE THIS',            s: 'ahh, I love this' },
    { t: 'OH MY GOD DADDY',        s: 'oh my god... daddy' },
    { t: 'MORE DADDY MORE',        s: 'more, daddy... more' },
    { t: 'THANK YOU DADDY',        s: 'thank you, daddy' },
    { t: 'AAAAH DADDY',            s: 'aaah... daddy' },
    { t: 'HARDER DADDY',           s: 'harder, daddy' },
    { t: 'DADDY DADDY DADDY',      s: 'daddy, daddy, daddy' },
    { t: 'I LIVE FOR THIS',        s: 'mmh, I live for this' },
    { t: 'YES YES YES',            s: 'yes, yes, yesss' },
    { t: 'MMMM DADDY',             s: 'mmmm... daddy' },
    { t: 'YOU ARE THE BEST DADDY', s: "you're the best, daddy" },
    { t: 'PLEASE DADDY',           s: 'please... daddy' },
    { t: "DON'T STOP DADDY",       s: "don't stop, daddy" },
    { t: 'ONE MORE TIME DADDY',    s: 'one more time, daddy' }
  ];

  // paletas del creador de personaje
  const SKINS = ['#ffe1cc', '#f8d2ae', '#eeb98e', '#dda173', '#c98a5c',
                 '#ab6d43', '#8b5433', '#6d3d24', '#502b1a', '#361d12'];
  const HAIRS = ['#0d0a09', '#2b1b12', '#4a2f1d', '#7b4a24', '#a9713a',
                 '#d9a441', '#efdcae', '#9b9b9b', '#a8331f', '#ff2e88'];

  const EMOJI = ['💗', '✨', '💦', '😩', '⭐', '💫', '🔥', '💕', '🫠'];
  const FLOATERS = ['🍌', '👁️', '🧀', '🐛', '🫧', '🦷', '🍕', '👽', '🧦', '🪱', '🥑', '🛸', '🦶', '💅'];
  const IDLE_HINT = 'drop a photo here, or paste one with Ctrl+V';

  const $ = (sel, root = document) => root.querySelector(sel);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const rand = (a, b) => a + Math.random() * (b - a);

  const el = {
    stage: $('#stage'), guy: $('#guy'), canvas: $('#faceCanvas'), fx: $('#fx'),
    eyeL: $('#eyeL'), eyeR: $('#eyeR'), mouth: $('#mouth'),
    bubble: $('#bubble'), name: $('#nameInput'), nametag: $('#nametag'),
    lvl: $('#lvl'), xp: $('#xpbar'), file: $('#fileInput'),
    count: $('#count'), status: $('#status'), panel: $('#panel'),
    particles: $('#particles'), floaters: $('#floaters'),
    pick: $('#pickBtn'), nameBtn: $('#nameBtn'), adjust: $('#adjustBtn'),
    sound: $('#soundBtn'), reset: $('#resetBtn'),
    panelX: $('#panelX'), panelReset: $('#panelReset'),
    skinSw: $('#skinSwatches'), hairSw: $('#hairSwatches'),
    skinCustom: $('#skinCustom'), hairCustom: $('#hairCustom'), autoColors: $('#autoColors'),
    voiceSel: $('#voiceSel'), voiceTest: $('#voiceTest'),
    whipCursor: $('#whipCursor'), dress: $('#dressBtn'), wardrobe: $('#wardrobe'),
    money: $('#money'), rain: $('#rainBtn'),
    poseChips: $('#poseChips'), itemChips: $('#itemChips'), gearChips: $('#gearChips'),
    accBlind: $('#accBlind'), accGag: $('#accGag')
  };

  const ctx = el.canvas.getContext('2d', { willReadFrequently: true });

  const DEFAULT_ADJ = { zoom: 1, dx: 0, dy: 0, rot: 0, eyeY: 0, eyeGap: 1, mouthY: 0, mouthS: 1 };

  const state = {
    img: null,          // la foto original (ya reducida)
    src: null,          // dataURL de esa foto
    det: null,          // ojos/boca en coordenadas de la foto
    geom: null,         // dónde quedó cada rasgo dentro de la textura
    adj: { ...DEFAULT_ADJ },
    skin: null,         // color de piel del centro de la cara
    skinEdge: null,     // color del borde de la cara -> pinta el cuerpo del avatar
    hair: null,         // color de pelo muestreado -> pinta el pelo del avatar
    skinPick: null,     // color elegido a mano (null = el de la foto)
    hairPick: null,
    voice: '',          // voiceURI elegido a mano ('' = la que elige solo)
    pose: 'stand',
    item: 'whip',
    gear: [],           // accesorios puestos
    wardrobe: matchMedia('(min-width: 521px)').matches,  // en celular arranca cerrado
    name: '', count: 0, sound: true
  };

  const sliders = {
    zoom: $('#a_zoom'), dx: $('#a_dx'), dy: $('#a_dy'), rot: $('#a_rot'),
    eyeY: $('#a_eyeY'), eyeGap: $('#a_eyeGap'), mouthY: $('#a_mouthY'), mouthS: $('#a_mouthS')
  };

  /* ---------------------------------------------------------------- estado */

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        src: state.src, det: state.det, adj: state.adj,
        skin: state.skin, skinEdge: state.skinEdge, hair: state.hair,
        skinPick: state.skinPick, hairPick: state.hairPick, voice: state.voice,
        pose: state.pose, item: state.item, gear: state.gear, wardrobe: state.wardrobe,
        name: state.name, count: state.count, sound: state.sound
      }));
    } catch (e) { /* sin espacio o modo privado: no pasa nada */ }
  }

  function restore() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* nada */ }
    if (!data) return;

    state.name = data.name || '';
    state.count = data.count || 0;
    state.sound = data.sound !== false;
    state.skin = data.skin || null;
    state.skinEdge = data.skinEdge || null;
    state.hair = data.hair || null;
    state.skinPick = data.skinPick || null;
    state.hairPick = data.hairPick || null;
    state.voice = data.voice || '';
    state.pose = data.pose || 'stand';
    state.item = data.item || 'whip';
    state.gear = Array.isArray(data.gear) ? data.gear : [];
    if (typeof data.wardrobe === 'boolean') state.wardrobe = data.wardrobe;
    el.name.value = state.name;
    paintCount();
    paintSound();
    paintBody();
    paintLook();

    if (data.src && data.det) {
      state.det = data.det;
      state.adj = { ...DEFAULT_ADJ, ...(data.adj || {}) };
      syncSliders();
      loadImage(data.src).then(img => {
        state.img = img;
        state.src = data.src;
        render();
        el.stage.classList.add('has-face');
        flash('welcome back 🫡');
      }).catch(() => { /* la foto guardada se rompió */ });
    }
  }

  /* ------------------------------------------------------------ detección */

  // la librería son 1.3 MB: se baja recién cuando hace falta, no al abrir la página
  let libPromise = null;
  function loadLib() {
    if (window.faceapi) return Promise.resolve();
    if (!libPromise) {
      libPromise = new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = 'vendor/face-api/face-api.js';
        sc.onload = res;
        sc.onerror = () => rej(new Error('no se pudo cargar face-api'));
        document.head.appendChild(sc);
      });
    }
    return libPromise;
  }

  let modelsPromise = null;
  async function loadModels() {
    await loadLib();
    if (!modelsPromise) {
      modelsPromise = Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODELS),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS)
      ]);
    }
    return modelsPromise;
  }

  // centroide + tamaño de un grupo de puntos
  function boxOf(points) {
    let sx = 0, sy = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      sx += p.x; sy += p.y;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: sx / points.length, y: sy / points.length, w: maxX - minX, h: maxY - minY };
  }

  async function detect(img) {
    await loadModels();
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 });
    const res = await faceapi.detectSingleFace(img, opts).withFaceLandmarks(true);
    if (!res) return null;

    const lm = res.landmarks;
    const a = boxOf(lm.getLeftEye());
    const b = boxOf(lm.getRightEye());
    const mouth = boxOf(lm.getMouth());
    const [L, R] = a.x <= b.x ? [a, b] : [b, a];   // L = el de la izquierda en la imagen

    return {
      eyeL: L, eyeR: R, mouth,
      angle: Math.atan2(R.y - L.y, R.x - L.x),
      eyeDist: Math.hypot(R.x - L.x, R.y - L.y),
      ok: true
    };
  }

  // si no se encontró cara: recorte centrado y posiciones "de manual"
  function guess(img) {
    const w = img.naturalWidth, h = img.naturalHeight;
    const m = Math.min(w, h), cx = w / 2, cy = h / 2, gap = m * 0.155;
    return {
      eyeL: { x: cx - gap, y: cy - m * 0.02, w: m * 0.11, h: m * 0.05 },
      eyeR: { x: cx + gap, y: cy - m * 0.02, w: m * 0.11, h: m * 0.05 },
      mouth: { x: cx, y: cy + m * 0.25, w: m * 0.2, h: m * 0.09 },
      angle: 0, eyeDist: gap * 2, ok: false
    };
  }

  /* ------------------------------------------------------------ transform */

  function xform() {
    const d = state.det, a = state.adj;
    return {
      scale: (S * TARGET.dist / d.eyeDist) * a.zoom,
      rot: -d.angle + a.rot * Math.PI / 180,
      cx: S * (TARGET.x + a.dx),
      cy: S * (TARGET.y + a.dy),
      ox: (d.eyeL.x + d.eyeR.x) / 2,
      oy: (d.eyeL.y + d.eyeR.y) / 2
    };
  }

  // punto de la foto -> coordenadas normalizadas (0..1) de la textura
  function mapPoint(p, t) {
    const dx = p.x - t.ox, dy = p.y - t.oy;
    const c = Math.cos(t.rot), s = Math.sin(t.rot);
    return {
      x: (t.cx + (dx * c - dy * s) * t.scale) / S,
      y: (t.cy + (dx * s + dy * c) * t.scale) / S
    };
  }

  function render() {
    if (!state.img || !state.det) return;
    const t = xform();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = state.skin || '#f0cba8';
    ctx.fillRect(0, 0, S, S);

    ctx.save();
    ctx.translate(t.cx, t.cy);
    ctx.rotate(t.rot);
    ctx.scale(t.scale, t.scale);
    ctx.translate(-t.ox, -t.oy);
    ctx.drawImage(state.img, 0, 0);
    ctx.restore();

    layout(t);
    sampleSkin();
  }

  // coloca párpados, boca y cachetes encima de la foto
  function layout(t) {
    const d = state.det, a = state.adj;
    const L = mapPoint(d.eyeL, t), R = mapPoint(d.eyeR, t);
    const mid = { x: (L.x + R.x) / 2, y: (L.y + R.y) / 2 };
    const k = t.scale / S;   // px de la foto -> fracción de la textura

    const place = (node, x, y, w, h) => {
      node.style.left = (x * 100) + '%';
      node.style.top = (y * 100) + '%';
      node.style.width = (w * 100) + '%';
      node.style.height = (h * 100) + '%';
    };

    const eyeW = clamp(d.eyeL.w * k * 1.55, 0.1, 0.5);
    const eyeH = eyeW * 0.72;
    for (const [node, p] of [[el.eyeL, L], [el.eyeR, R]]) {
      const x = mid.x + (p.x - mid.x) * a.eyeGap;
      const y = mid.y + (p.y - mid.y) * a.eyeGap + a.eyeY;
      place(node, x, y, eyeW, eyeH);
    }

    const M = mapPoint(d.mouth, t);
    const mw = clamp(d.mouth.w * k * 1.5 * a.mouthS, 0.12, 0.66);
    place(el.mouth, M.x, M.y + a.mouthY, mw, mw * 1.06);

    // el antifaz y la mordaza usan los ojos y la boca detectados, así calzan en cualquier cara
    const span = Math.abs((mid.x - L.x) * 2 * a.eyeGap) || eyeW;
    const bw = clamp(span * 2.5, 0.3, 0.98);
    place(el.accBlind, mid.x, mid.y + a.eyeY, bw, bw * 0.34);
    place(el.accGag, M.x, M.y + a.mouthY, mw * 1.12, mw * 1.12);

    state.geom = {
      eyeL: { x: parseFloat(el.eyeL.style.left) / 100, y: parseFloat(el.eyeL.style.top) / 100, w: eyeW, h: eyeH },
      eyeR: { x: parseFloat(el.eyeR.style.left) / 100, y: parseFloat(el.eyeR.style.top) / 100, w: eyeW, h: eyeH },
      mouth: { x: M.x, y: M.y + a.mouthY, w: mw, h: mw * 1.06 }
    };
  }

  /* ------------------------------------------------------- color de piel */

  // Se prueban varios puntos alrededor de cada rasgo y se elige uno "de piel" y
  // más bien claro, para no terminar copiando pelo, sombras o delineador.
  function sampleAt(nx, ny, source, w, h) {
    const g = source || ctx;
    const W = w || S, H = h || S, R = 6;
    const x = clamp(Math.round(nx * W) - R, 0, W - 2 * R);
    const y = clamp(Math.round(ny * H) - R, 0, H - 2 * R);
    let data;
    try { data = g.getImageData(x, y, 2 * R, 2 * R).data; } catch (e) { return null; }
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      r += data[i]; gg += data[i + 1]; b += data[i + 2]; n++;
    }
    return n ? [r / n, gg / n, b / n] : null;
  }

  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const skinish = (c) => c[0] > c[2] + 6 && c[0] > 45 && c[0] < 248;
  const css = (c) => `rgb(${Math.round(clamp(c[0], 0, 255))},${Math.round(clamp(c[1], 0, 255))},${Math.round(clamp(c[2], 0, 255))})`;

  // de los candidatos, el del percentil 70 de luminosidad:
  // ni el más oscuro (pelo/sombra) ni el más brillante (brillo especular)
  function pickSkin(spots) {
    const vals = spots.map(p => sampleAt(p[0], p[1])).filter(Boolean);
    if (!vals.length) return null;
    const good = vals.filter(skinish);
    const pool = (good.length ? good : vals).sort((a, b) => lum(a) - lum(b));
    return pool[Math.min(pool.length - 1, Math.floor(pool.length * 0.7))];
  }

  function sampleSkin() {
    const g = state.geom;
    if (!g) return;

    const eye = (e) => pickSkin([
      [e.x, e.y + e.h * 0.85], [e.x, e.y + e.h * 1.2],
      [e.x - e.w * 0.55, e.y + e.h * 0.5], [e.x + e.w * 0.55, e.y + e.h * 0.5],
      [e.x, e.y - e.h * 1.15]
    ]);
    const m = g.mouth;
    const l = eye(g.eyeL);
    const r = eye(g.eyeR);
    const mo = pickSkin([
      [m.x - m.w * 0.42, m.y], [m.x + m.w * 0.42, m.y],
      [m.x, m.y + m.h * 0.42], [m.x, m.y - m.h * 0.46],
      [m.x - m.w * 0.5, m.y - m.h * 0.35], [m.x + m.w * 0.5, m.y - m.h * 0.35]
    ]);
    const all = pickSkin([
      [0.50, 0.32], [0.38, 0.47], [0.62, 0.47], [0.50, 0.54],
      [0.34, 0.64], [0.66, 0.64], [0.50, 0.86]
    ]);
    // color del borde de la cara: es el que se le pasa al cuerpo del avatar,
    // así el cuello y la cabeza empalman con la foto y no queda un halo alrededor
    const edge = pickSkin([
      [0.50, 0.12], [0.24, 0.42], [0.76, 0.42],
      [0.30, 0.72], [0.70, 0.72], [0.50, 0.88]
    ]);
    const base = all || l || r || mo;
    if (!base) return;
    // mitad borde, mitad centro: si la foto tiene una sombra fuerte en el borde,
    // el cuerpo no sale mucho más oscuro que la cara
    state.skinEdge = css(edge ? edge.map((v, i) => v * 0.5 + base[i] * 0.5) : base);

    state.skin = css(base);
    el.fx.style.setProperty('--skin', css(base));
    el.fx.style.setProperty('--skin-l', css(l || base));
    el.fx.style.setProperty('--skin-r', css(r || base));
    el.fx.style.setProperty('--skin-m', css(mo || base));
    el.fx.style.setProperty('--skin-dark', css([base[0] * 0.72, base[1] * 0.64, base[2] * 0.6]));
    paintBody();
  }

  // el cuerpo del avatar se pinta con el tono de piel de la foto, así no parece un casco
  function paintBody() {
    const body = state.skinPick || state.skinEdge || state.skin;
    if (body) {
      const c = body.match(/[\d.]+/g).map(Number);
      el.stage.style.setProperty('--skin-body', body);
      el.stage.style.setProperty('--skin-shade', css([c[0] * 0.78, c[1] * 0.66, c[2] * 0.6]));
    }
    const hair = state.hairPick || state.hair;
    if (hair) {
      let c = hair.match(/[\d.]+/g).map(Number);
      // si el pelo lo sacamos de la foto puede salir casi igual a la piel; se lo oscurece.
      // Si lo eligió el usuario se respeta tal cual (si quiere rubio platino, rubio platino).
      if (!state.hairPick && body) {
        const sk = body.match(/[\d.]+/g).map(Number);
        const top = lum(sk) * 0.7, L = lum(c) || 1;
        if (L > top) c = c.map(v => v * top / L);
      }
      el.stage.style.setProperty('--hair', css(c));
      el.stage.style.setProperty('--hair-hi', css([c[0] * 1.55 + 18, c[1] * 1.55 + 15, c[2] * 1.55 + 13]));
    }
    paintSwatches();
  }

  const rgb2hex = (rgb) => '#' + rgb.match(/[\d.]+/g).slice(0, 3)
    .map(v => Math.round(+v).toString(16).padStart(2, '0')).join('');

  const hex2rgb = (h) => {
    const n = parseInt(h.slice(1), 16);
    return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
  };

  function buildSwatches() {
    const make = (host, list, kind) => {
      for (const hex of list) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch';
        b.style.background = hex;
        b.dataset.hex = hex;
        b.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-label', kind + ' ' + hex);
        b.addEventListener('click', () => setColour(kind, hex));
        host.appendChild(b);
      }
    };
    make(el.skinSw, SKINS, 'skin');
    make(el.hairSw, HAIRS, 'hair');
  }

  function setColour(kind, hex) {
    if (kind === 'skin') state.skinPick = hex2rgb(hex);
    else state.hairPick = hex2rgb(hex);
    paintBody();
    save();
  }

  function paintSwatches() {
    const mark = (host, picked) => {
      for (const b of host.children) {
        b.setAttribute('aria-pressed', String(picked === hex2rgb(b.dataset.hex)));
      }
    };
    mark(el.skinSw, state.skinPick);
    mark(el.hairSw, state.hairPick);
    const cur = (pickv, fallback) => pickv || fallback;
    const sk = cur(state.skinPick, state.skinEdge || state.skin);
    const ha = cur(state.hairPick, state.hair);
    if (sk) el.skinCustom.value = rgb2hex(sk);
    if (ha) el.hairCustom.value = rgb2hex(ha);
  }

  function autoColours() {
    state.skinPick = null;
    state.hairPick = null;
    if (!state.skinEdge && !state.skin) {
      el.stage.style.removeProperty('--skin-body');
      el.stage.style.removeProperty('--skin-shade');
    }
    if (!state.hair) {
      el.stage.style.removeProperty('--hair');
      el.stage.style.removeProperty('--hair-hi');
    }
    paintBody();
    save();
  }

  // el pelo se muestrea en un arco por encima de los ojos, sobre la foto original
  function sampleHair(img, det) {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);

    const mid = { x: (det.eyeL.x + det.eyeR.x) / 2, y: (det.eyeL.y + det.eyeR.y) / 2 };
    const grab = (deg, rad) => {
      const a = deg * Math.PI / 180 + det.angle;
      const nx = (mid.x + Math.cos(a) * det.eyeDist * rad) / w;
      const ny = (mid.y + Math.sin(a) * det.eyeDist * rad) / h;
      if (nx < 0.02 || nx > 0.98 || ny < 0.02 || ny > 0.98) return null;
      return sampleAt(nx, ny, g, w, h);
    };
    const vals = [grab(-90, 1.6), grab(-62, 1.55), grab(-118, 1.55), grab(-45, 1.5), grab(-135, 1.5)]
      .filter(Boolean).sort((a, b) => lum(a) - lum(b));
    if (!vals.length) return null;

    // mediana, mezclada con un castaño oscuro y con la luminosidad acotada,
    // para que un fondo blanco no lo deje con pelo fluorescente
    const mid5 = vals[Math.floor(vals.length / 2)];
    const mixed = mid5.map((v, i) => v * 0.72 + [46, 30, 22][i] * 0.28);
    const L = lum(mixed) || 1;
    const k = L > 215 ? 215 / L : (L < 28 ? 28 / L : 1);
    return css(mixed.map(v => v * k));
  }

  /* ---------------------------------------------------------------- fotos */

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('imagen ilegible'));
      img.src = src;
    });
  }

  // achica la foto para que entre cómoda en localStorage
  function shrink(img, max = 1200) {
    const w = img.naturalWidth, h = img.naturalHeight;
    const f = Math.min(1, max / Math.max(w, h));
    if (f === 1) return null;
    const c = document.createElement('canvas');
    c.width = Math.round(w * f);
    c.height = Math.round(h * f);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  }

  async function useFile(file) {
    if (!file || !/^image\//.test(file.type)) {
      status("that's not a photo 🤨", 'err');
      return;
    }
    status('reading the photo…', 'busy');

    let img;
    try {
      const raw = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(new Error('no se pudo leer'));
        fr.readAsDataURL(file);
      });
      img = await loadImage(raw);
      const small = shrink(img);
      if (small) img = await loadImage(small);
      state.src = small || raw;
      state.img = img;
    } catch (e) {
      status("couldn't open that image 😵 try a JPG or PNG", 'err');
      return;
    }

    status('looking for eyes and mouth…', 'busy');
    let det = null;
    try {
      det = await detect(state.img);
    } catch (e) {
      console.warn('[mydaddyfriend] detección no disponible:', e);
    }

    state.det = det || guess(state.img);
    state.adj = { ...DEFAULT_ADJ };
    state.skin = null;
    state.skinEdge = null;
    state.hair = det ? sampleHair(state.img, det) : null;
    syncSliders();
    paintBody();

    render();   // primera pasada: mide los colores de la piel
    render();   // segunda: ya pinta el fondo con ese color

    el.stage.classList.add('has-face');
    save();

    if (state.det.ok) {
      status(state.name ? 'done! now smack it 👆' : 'done! now give it a name 👆');
    } else {
      status("couldn't find a face — line it up yourself with the sliders", 'err');
      openPanel(true);
    }
  }

  /* ------------------------------------------------------------ expresión */

  let moanTimer = null;

  function moan() {
    if (!el.stage.classList.contains('has-face')) { el.file.click(); return; }

    const clip = useClips() ? pick(voiceClips) : null;
    const phrase = clip ? null : pick(PHRASES);
    el.bubble.textContent = clip ? clip.text : phrase.t;
    el.bubble.style.setProperty('--rot', rand(-8, 8).toFixed(1) + 'deg');
    el.bubble.classList.add('show');
    el.stage.style.setProperty('--open', rand(0.82, 1.25).toFixed(2));
    el.stage.style.setProperty('--tilt', rand(-3, 3).toFixed(1) + 'deg');

    el.stage.classList.remove('is-moan');
    void el.stage.offsetWidth;                 // reinicia la animación
    el.stage.classList.add('is-moan');

    clearTimeout(moanTimer);
    moanTimer = setTimeout(() => {
      el.stage.classList.remove('is-moan');
      el.bubble.classList.remove('show');
    }, 950);

    state.count++;
    paintCount();
    save();
    if (clip) {
      playVoice(clip);    // los clips ya son gemidos de verdad: el sintetizado sobra
    } else {
      speak(phrase);      // respaldo: el motor del navegador es lo que más tarda
      gasp();
    }
    whipCrack();
    burst();
  }

  function burst() {
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.textContent = pick(EMOJI);
      s.style.left = rand(4, 92) + '%';
      s.style.top = rand(12, 34) + '%';
      s.style.setProperty('--px', rand(-60, 60).toFixed(0) + 'px');
      s.style.setProperty('--py', rand(-120, -60).toFixed(0) + 'px');
      s.style.setProperty('--pr', rand(-90, 90).toFixed(0) + 'deg');
      s.style.animationDelay = (i * 40) + 'ms';
      s.addEventListener('animationend', () => s.remove());
      el.particles.appendChild(s);
    }
    while (el.particles.childElementCount > 40) el.particles.firstElementChild.remove();
  }

  /* --------------------------------------------------------------- sonido */

  // Las voces del navegador varían muchísimo por sistema. Se busca una femenina en
  // inglés en vez de usar la de por defecto, que suele ser la masculina genérica.
  const FEMALE = [
    'samantha', 'ava', 'allison', 'susan', 'joanna', 'zoe', 'serena', 'karen',
    'moira', 'tessa', 'fiona', 'catherine', 'nicky', 'kate', 'martha',
    'zira', 'hazel', 'eva', 'aria', 'jenny', 'michelle', 'sonia',
    'google us english', 'google uk english female', 'female'
  ];
  const MALE = [
    'alex', 'daniel', 'fred', 'tom', 'david', 'mark', 'rishi', 'oliver', 'arthur',
    'aaron', 'junior', 'ralph', 'bruce', 'guy', 'eric', 'roger', 'ryan', 'male'
  ];

  let voices = [], autoVoice = null;

  function scoreVoice(v) {
    const n = (v.name || '').toLowerCase();
    let sc = 0;
    const fi = FEMALE.findIndex(f => n.includes(f));
    if (fi >= 0) sc += 100 - fi;
    if (MALE.some(m => n.includes(m))) sc -= 200;
    if (/^en[-_]us/i.test(v.lang)) sc += 10;
    else if (/^en[-_]gb/i.test(v.lang)) sc += 6;
    if (v.localService === false) sc += 3;   // las de red suelen sonar bastante mejor
    return sc;
  }

  function refreshVoices() {
    try { voices = (speechSynthesis.getVoices() || []).filter(v => /^en/i.test(v.lang || '')); }
    catch (e) { voices = []; }
    autoVoice = voices.length ? voices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] : null;
    fillVoiceSelect();
  }

  function fillVoiceSelect() {
    if (!el.voiceSel) return;
    el.voiceSel.textContent = '';
    const add = (value, label) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      el.voiceSel.appendChild(o);
    };
    add('', voiceClips.length
      ? `recorded voice (${voiceClips.length} clips)`
      : (voices.length ? 'auto — ' + (autoVoice ? autoVoice.name : 'default') : 'no voices on this device'));
    if (voiceClips.length) {
      add('tts', 'browser voice — ' + (autoVoice ? autoVoice.name : (voices.length ? 'default' : 'none here')));
    }
    for (const v of voices) {
      const o = document.createElement('option');
      o.value = v.voiceURI;
      o.textContent = v.name + ' (' + v.lang + ')';
      el.voiceSel.appendChild(o);
    }
    el.voiceSel.value = state.voice && voices.some(v => v.voiceURI === state.voice) ? state.voice : '';
  }

  function currentVoice() {
    if (state.voice) {
      const v = voices.find(x => x.voiceURI === state.voice);
      if (v) return v;
    }
    return autoVoice;
  }

  let speakStartedAt = 0;

  function speak(phrase) {
    if (!state.sound || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(phrase.s || phrase.t.toLowerCase());
      u.lang = 'en-US';
      // aislado: si el navegador rechaza la voz, igual tiene que hablar con la de por defecto
      try {
        const v = currentVoice();
        if (v) { u.voice = v; u.lang = v.lang || u.lang; }
      } catch (e) { /* seguimos con la voz de por defecto */ }
      // rango angosto a propósito: estirar mucho el pitch es lo que la hacía sonar a robot
      u.pitch = rand(1.05, 1.35);
      u.rate = rand(0.88, 1.02);
      // Nunca cancel() y speak() en el mismo tick: Chrome deja el motor colgado para
      // el resto de la sesión y no vuelve a hablar. Si ya hay una frase sonando se la
      // deja terminar; el latigazo y el gemido igual suenan en cada click.
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        // válvula de escape por si el motor quedó trabado con una frase fantasma
        if (Date.now() - speakStartedAt > 5000) {
          try { speechSynthesis.cancel(); } catch (e) { /* nada */ }
        }
        return;
      }
      if (speechSynthesis.paused) speechSynthesis.resume();
      speakStartedAt = Date.now();
      speechSynthesis.speak(u);
    } catch (e) { /* sin voz, no pasa nada */ }
  }

  let audio = null, noiseBuf = null;
  function ac() {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    return audio;
  }

  // En celular el AudioContext arranca suspendido y resume() es asíncrono. Si se
  // programan los sonidos antes de que arranque, quedan agendados en un currentTime
  // que ya pasó y no suenan nunca. Por eso se espera a que esté corriendo.
  function withAudio(fn) {
    let a;
    try { a = ac(); } catch (e) { return; }
    if (a.state === 'running') { try { fn(a); } catch (e) { /* nada */ } return; }
    a.resume().then(() => { try { fn(a); } catch (e) { /* nada */ } }).catch(() => { /* nada */ });
  }
  function noise(a) {
    if (!noiseBuf) {
      const len = Math.floor(a.sampleRate * 0.4);
      noiseBuf = a.createBuffer(1, len, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // Látigo: el golpe tiene que caer casi encima del click. Antes el silbido tardaba
  // 125 ms en llegar al chasquido y para cuando sonaba ya había arrancado el gemido,
  // así que el golpe quedaba tapado y parecía que no sonaba.
  const CRACK_AT = 0.055;

  function whipCrack() {
    if (!state.sound) return;
    if (whipBuffer) {                       // grabación real: se usa esa
      withAudio((a) => {
        const src = a.createBufferSource();
        src.buffer = whipBuffer;
        const g = a.createGain();
        g.gain.value = 0.9;
        src.connect(g).connect(a.destination);
        src.start();
      });
      return;
    }
    withAudio((a) => {
      const t0 = a.currentTime, buf = noise(a);
      const tc = t0 + CRACK_AT;

      // silbido: corto, solo para anunciar el golpe
      const s1 = a.createBufferSource(); s1.buffer = buf;
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(600, t0);
      bp.frequency.exponentialRampToValueAtTime(4200, tc);
      const g1 = a.createGain();
      g1.gain.setValueAtTime(0.0001, t0);
      g1.gain.exponentialRampToValueAtTime(0.18, t0 + 0.045);
      g1.gain.exponentialRampToValueAtTime(0.0001, tc + 0.02);
      s1.connect(bp).connect(g1).connect(a.destination);
      s1.start(t0); s1.stop(tc + 0.06);

      // chasquido: ataque de 2 ms y caída rápida, para que se oiga como un golpe seco
      const s2 = a.createBufferSource(); s2.buffer = buf;
      const hp = a.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 3000;
      const g2 = a.createGain();
      g2.gain.setValueAtTime(0.0001, tc);
      g2.gain.exponentialRampToValueAtTime(0.85, tc + 0.002);
      g2.gain.exponentialRampToValueAtTime(0.0001, tc + 0.07);
      s2.connect(hp).connect(g2).connect(a.destination);
      s2.start(tc); s2.stop(tc + 0.12);

      // el cuerpo del impacto
      const osc = a.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, tc);
      osc.frequency.exponentialRampToValueAtTime(50, tc + 0.09);
      const g3 = a.createGain();
      g3.gain.setValueAtTime(0.0001, tc);
      g3.gain.exponentialRampToValueAtTime(0.34, tc + 0.004);
      g3.gain.exponentialRampToValueAtTime(0.0001, tc + 0.13);
      osc.connect(g3).connect(a.destination);
      osc.start(tc); osc.stop(tc + 0.16);
    });
  }

  // Un gemido sintetizado con formantes, por debajo de la voz del navegador.
  // Es lo que le saca el aire de "asistente de GPS": un oscilador diente de sierra
  // con vibrato pasado por tres pasa-banda que se abren de "mm" a "ah".
  function gasp() {
    if (!state.sound) return;
    withAudio((a) => {
      // arranca recién pasado el chasquido: si se pisan, no se oye ninguno de los dos
      const t0 = a.currentTime + CRACK_AT + 0.05, dur = rand(0.18, 0.24);
      const f0 = rand(196, 248);   // rango de voz femenina

      const osc = a.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0 * 0.9, t0);
      osc.frequency.linearRampToValueAtTime(f0 * 1.14, t0 + dur * 0.45);
      osc.frequency.linearRampToValueAtTime(f0 * 0.86, t0 + dur);

      const lfo = a.createOscillator();          // sin vibrato suena a sirena
      lfo.frequency.value = rand(4.8, 6.4);
      const lfoGain = a.createGain();
      lfoGain.gain.value = f0 * 0.03;
      lfo.connect(lfoGain).connect(osc.frequency);

      const out = a.createGain();
      out.gain.setValueAtTime(0.0001, t0);
      out.gain.exponentialRampToValueAtTime(0.12, t0 + 0.06);
      out.gain.setValueAtTime(0.12, t0 + dur * 0.55);
      out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      out.connect(a.destination);

      // [de, hacia, Q, volumen] por formante: la boca se abre mientras suena
      for (const [from, to, q, g] of [[380, 800, 3.4, 0.9], [1080, 1180, 2.6, 0.5], [2700, 2850, 2.2, 0.22]]) {
        const bp = a.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = q;
        bp.frequency.setValueAtTime(from, t0);
        bp.frequency.linearRampToValueAtTime(to, t0 + dur * 0.5);
        const gain = a.createGain(); gain.gain.value = g;
        osc.connect(bp).connect(gain).connect(out);
      }

      const air = a.createBufferSource();        // un poco de aire encima
      air.buffer = noise(a); air.loop = true;
      const hp = a.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 2600;
      const ag = a.createGain();
      ag.gain.setValueAtTime(0.0001, t0);
      ag.gain.exponentialRampToValueAtTime(0.02, t0 + 0.12);
      ag.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      air.connect(hp).connect(ag).connect(a.destination);

      air.start(t0); osc.start(t0); lfo.start(t0);
      air.stop(t0 + dur + 0.05); osc.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
    });
  }

  // speechSynthesis resultó imposible de verificar: en varios navegadores emite la
  // locución y no suena nada, sin disparar start ni error. Las frases ahora son
  // archivos que van por el mismo AudioContext que el látigo, que sí suena en todos
  // lados. La voz del navegador queda sólo como respaldo.
  let voiceClips = [];
  let whipBuffer = null;
  let clipsPromise = null;
  let voiceNode = null;

  function loadVoiceClips() {
    if (clipsPromise) return clipsPromise;
    clipsPromise = (async () => {
      let man;
      try {
        const r = await fetch('sounds/voice.json');
        if (!r.ok) return;
        man = await r.json();
      } catch (e) { return; }          // sin carpeta o abierto como file://

      let a;
      try { a = ac(); } catch (e) { return; }

      const grab = async (file) => {
        const res = await fetch('sounds/' + encodeURIComponent(file));
        if (!res.ok) throw new Error(file);
        return a.decodeAudioData(await res.arrayBuffer());
      };

      if (man && man.whip) {
        try { whipBuffer = await grab(man.whip); }
        catch (e) { /* se sigue con el látigo sintetizado */ }
      }

      const list = (man && man.clips) || [];
      const loaded = await Promise.all(list.map(async (c) => {
        try {
          return { text: String(c.text || c.file).toUpperCase(), buffer: await grab(c.file) };
        } catch (e) { return null; }
      }));
      voiceClips = loaded.filter(Boolean);
      if (voiceClips.length) fillVoiceSelect();
    })();
    return clipsPromise;
  }

  const useClips = () => voiceClips.length > 0 && state.voice !== 'tts';

  function playVoice(clip) {
    if (!state.sound) return;
    withAudio((a) => {
      if (voiceNode) { try { voiceNode.stop(); } catch (e) { /* ya terminó */ } }
      const src = a.createBufferSource();
      src.buffer = clip.buffer;
      const g = a.createGain();
      g.gain.value = 0.95;
      src.connect(g).connect(a.destination);
      src.start(a.currentTime + CRACK_AT + 0.13);   // entra después del chasquido
      voiceNode = src;
    });
  }

  /* ------------------------------------------------------------------- ui */

  let statusTimer = null;
  function status(msg, kind) {
    clearTimeout(statusTimer);
    el.status.textContent = msg;
    el.status.className = 'status' + (kind ? ' ' + kind : '');
  }
  function flash(msg) {
    status(msg);
    statusTimer = setTimeout(() => status(IDLE_HINT), 2500);
  }

  function paintCount() {
    el.count.textContent = String(state.count).padStart(6, '0');
    el.lvl.textContent = 'LV.' + (Math.floor(state.count / 10) + 1);
    el.xp.style.width = ((state.count % 10) * 10) + '%';
  }

  function paintSound() {
    el.sound.textContent = state.sound ? '🔊 sound' : '🔇 muted';
    el.sound.setAttribute('aria-pressed', String(state.sound));
  }

  function syncSliders() {
    for (const k in sliders) if (sliders[k]) sliders[k].value = state.adj[k];
  }

  function openPanel(open) {
    el.panel.hidden = !open;
    el.adjust.setAttribute('aria-expanded', String(open));
    el.stage.classList.toggle('is-preview', open);
    if (open) el.panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function resetAll() {
    state.img = null; state.src = null; state.det = null;
    state.skin = null; state.skinEdge = null; state.hair = null; state.geom = null;
    state.adj = { ...DEFAULT_ADJ };
    syncSliders();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, S, S);
    for (const p of ['--skin-body', '--skin-shade', '--hair', '--hair-hi']) {
      el.stage.style.removeProperty(p);
    }
    paintBody();   // si eligió colores a mano, se vuelven a aplicar
    el.stage.classList.remove('has-face', 'is-moan');
    el.bubble.classList.remove('show');
    openPanel(false);
    el.file.value = '';
    save();
    status('face cleared. the doll is at peace.');
  }

  /* -------------------------------------------------------------- eventos */

  let lastHit = 0;
  function hit(e) {
    const now = Date.now();
    if (now - lastHit < 350) return;      // pointerdown ya lo disparó, el click es el eco
    lastHit = now;
    const byPointer = e.clientX || e.clientY;
    crackWhip(byPointer ? e.clientX : null, byPointer ? e.clientY : null);
    moan();
  }
  el.guy.addEventListener('pointerdown', hit);
  el.guy.addEventListener('click', hit);   // teclado, y navegadores sin pointer events

  // primer gesto: se destraba el audio
  addEventListener('pointerdown', () => {
    try { ac().resume(); } catch (e) { /* nada */ }
    loadVoiceClips();
    loadSong();
  }, { once: true, capture: true });

  el.pick.addEventListener('click', () => el.file.click());
  el.file.addEventListener('change', (e) => useFile(e.target.files[0]));

  const focusName = () => { el.name.focus(); el.name.select(); };
  el.nameBtn.addEventListener('click', focusName);
  el.nametag.addEventListener('click', () => el.name.focus());

  el.adjust.addEventListener('click', () => openPanel(el.panel.hidden));
  el.panelX.addEventListener('click', () => openPanel(false));
  el.panelReset.addEventListener('click', () => {
    state.adj = { ...DEFAULT_ADJ };
    syncSliders();
    render();
    save();
  });

  el.sound.addEventListener('click', () => {
    state.sound = !state.sound;
    paintSound();
    save();
    if (!state.sound && 'speechSynthesis' in window) speechSynthesis.cancel();
  });

  el.reset.addEventListener('click', resetAll);

  function openWardrobe(open) {
    el.wardrobe.hidden = !open;
    el.dress.setAttribute('aria-expanded', String(open));
    state.wardrobe = open;
    save();
  }
  el.dress.addEventListener('click', () => openWardrobe(el.wardrobe.hidden));
  el.rain.addEventListener('click', moneyRain);

  el.skinCustom.addEventListener('input', () => setColour('skin', el.skinCustom.value));
  el.hairCustom.addEventListener('input', () => setColour('hair', el.hairCustom.value));
  el.autoColors.addEventListener('click', autoColours);

  el.voiceSel.addEventListener('change', () => {
    state.voice = el.voiceSel.value;
    save();
  });
  el.voiceTest.addEventListener('click', () => {
    const muted = !state.sound;
    state.sound = true;              // la prueba se escucha aunque esté en mute
    gasp();
    speak(pick(PHRASES));
    if (muted) state.sound = false;
  });

  for (const k in sliders) {
    if (!sliders[k]) continue;
    sliders[k].addEventListener('input', () => {
      state.adj[k] = parseFloat(sliders[k].value);
      render();
    });
    sliders[k].addEventListener('change', save);
  }

  el.name.addEventListener('input', () => {
    state.name = el.name.value;
    save();
  });
  el.name.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.name.blur(); });

  // arrastrar y soltar
  ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, (e) => {
    e.preventDefault();
    document.body.style.filter = 'saturate(1.6)';
  }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, (e) => {
    e.preventDefault();
    document.body.style.filter = '';
  }));
  document.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) useFile(f);
  });

  // pegar con Ctrl+V
  document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || {}).items || [];
    for (const it of items) {
      if (it.type && it.type.startsWith('image/')) { useFile(it.getAsFile()); break; }
    }
  });

  /* -------------------------------------------------- poses y accesorios */

  const POSES = [
    { id: 'stand', label: '🧍 stand' },
    { id: 'kneel', label: '🧎 kneel' },
    { id: 'lying', label: '🛋 lie down' },
    { id: 'back',  label: '🍑 from behind' }
  ];
  const ITEMS = [
    { id: 'whip',    label: '🪢 whip' },
    { id: 'paddle',  label: '🏓 paddle' },
    { id: 'flogger', label: '🧹 flogger' },
    { id: 'none',    label: '✋ nothing' }
  ];
  const GEAR = [
    { id: 'blind',  label: '😶‍🌫️ blindfold' },
    { id: 'gag',    label: '⚫ ball gag' },
    { id: 'collar', label: '🐕 collar + leash' },
    { id: 'cuffs',  label: '⛓ cuffs' },
    { id: 'rope',   label: '🪢 rope' }
  ];

  function buildChips() {
    const chip = (host, id, label, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.id = id;
      b.textContent = label;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', onClick);
      host.appendChild(b);
      return b;
    };
    for (const p of POSES) chip(el.poseChips, p.id, p.label, () => { state.pose = p.id; paintLook(); save(); });
    for (const i of ITEMS) chip(el.itemChips, i.id, i.label, () => { state.item = i.id; paintLook(); save(); });
    for (const g of GEAR) chip(el.gearChips, g.id, g.label, () => {
      const at = state.gear.indexOf(g.id);
      if (at >= 0) state.gear.splice(at, 1); else state.gear.push(g.id);
      paintLook();
      save();
    });
  }

  function paintLook() {
    el.stage.dataset.pose = state.pose;
    el.stage.dataset.item = state.item;
    for (const g of GEAR) el.stage.classList.toggle('gear-' + g.id, state.gear.includes(g.id));
    const mark = (host, on) => {
      for (const b of host.children) b.setAttribute('aria-pressed', String(on(b.dataset.id)));
    };
    mark(el.poseChips, id => id === state.pose);
    mark(el.itemChips, id => id === state.item);
    mark(el.gearChips, id => state.gear.includes(id));
  }

  /* ---------------------------------------------------------- money rain */

  let songBuffer = null, songPromise = null, songNode = null;
  let dripId = null, cutId = null, stopId = null;

  function loadSong() {
    if (songPromise) return songPromise;            // una sola descarga
    songPromise = (async () => {
      try {
        const res = await fetch('sounds/money-rain.mp3');
        if (!res.ok) return;
        songBuffer = await ac().decodeAudioData(await res.arrayBuffer());
      } catch (e) { /* sin canción, igual llueve */ }
    })();
    return songPromise;
  }

  // Un billete lanzado de frente: aparece cerca tuyo (z alto, o sea grande) y se
  // aleja hacia el personaje (z negativo, chico). El x/y queda fijo: la perspectiva
  // sola lo hace converger hacia el punto de fuga a medida que se va.
  function tossBill() {
    const b = document.createElement('i');
    b.style.setProperty('--x', rand(-115, 115).toFixed(0) + 'px');
    b.style.setProperty('--y', rand(-95, 85).toFixed(0) + 'px');
    b.style.setProperty('--drop', rand(30, 150).toFixed(0) + 'px');
    b.style.setProperty('--r0', rand(-22, 22).toFixed(0) + 'deg');
    b.style.setProperty('--r1', rand(-780, 780).toFixed(0) + 'deg');
    b.style.animationDuration = rand(1.3, 2.0).toFixed(2) + 's';
    b.addEventListener('animationend', () => b.remove());
    el.money.appendChild(b);
    while (el.money.childElementCount > 80) el.money.firstElementChild.remove();
  }

  // se tiran de a puñados, no de a goteo: así se lee como que los estás lanzando
  function throwHandful() {
    const n = 4 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) setTimeout(tossBill, i * rand(45, 130));
  }

  function stopRain() {
    clearInterval(dripId); clearTimeout(cutId); clearTimeout(stopId);
    dripId = cutId = stopId = null;
    el.stage.classList.remove('is-dancing');
    el.rain.disabled = false;
    el.rain.textContent = '💸 MONEY RAIN';
    if (songNode) { try { songNode.stop(); } catch (e) { /* ya terminó */ } songNode = null; }
  }

  async function moneyRain() {
    if (el.rain.disabled) return;
    el.rain.disabled = true;
    el.rain.textContent = '🤑 MAKING IT RAIN…';
    el.stage.classList.add('is-dancing');

    // los billetes arrancan ya, sin esperar a que baje la canción
    throwHandful();
    dripId = setInterval(throwHandful, 620);

    await loadSong();
    const secs = songBuffer ? songBuffer.duration : 8.4;

    if (songBuffer) {
      withAudio((a) => {
        if (songNode) { try { songNode.stop(); } catch (e) { /* nada */ } }
        const src = a.createBufferSource();
        src.buffer = songBuffer;
        const g = a.createGain();
        g.gain.value = 0.75;
        src.connect(g).connect(a.destination);
        src.start();
        songNode = src;
      });
    }

    // se deja de tirar antes del final, así los últimos billetes terminan su vuelo
    cutId = setTimeout(() => { clearInterval(dripId); dripId = null; }, Math.max(500, (secs - 1.4) * 1000));
    stopId = setTimeout(stopRain, secs * 1000);
  }

  /* --------------------------------------------------------- cursor látigo */

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let crackTimer = null;

  function moveWhip(x, y) {
    el.whipCursor.style.transform = `translate3d(${x - 12}px, ${y - 11}px, 0)`;
  }

  // en desktop late siguiendo al mouse; en celular aparece en el punto del toque
  function crackWhip(x, y) {
    if (x != null) moveWhip(x, y);
    el.whipCursor.classList.add('on');
    el.whipCursor.classList.remove('is-crack');
    void el.whipCursor.offsetWidth;              // reinicia la animación
    el.whipCursor.classList.add('is-crack');
    clearTimeout(crackTimer);
    crackTimer = setTimeout(() => {
      el.whipCursor.classList.remove('is-crack');
      if (!finePointer.matches) el.whipCursor.classList.remove('on');
    }, 430);
  }

  function initWhipCursor() {
    if (!finePointer.matches) return;
    document.body.classList.add('has-whip');
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      moveWhip(e.clientX, e.clientY);
      el.whipCursor.classList.add('on');
    }, { passive: true });
    document.addEventListener('pointerleave', () => el.whipCursor.classList.remove('on'));
  }

  /* -------------------------------------------------------------- adornos */

  function sprinkle() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const n = reduce ? 0 : 14;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.textContent = pick(FLOATERS);
      s.style.left = rand(0, 96) + '%';
      s.style.fontSize = rand(18, 44).toFixed(0) + 'px';
      s.style.animationDuration = rand(14, 34).toFixed(1) + 's';
      s.style.animationDelay = (-rand(0, 30)).toFixed(1) + 's';
      el.floaters.appendChild(s);
    }
  }

  /* ------------------------------------------------------------- arranque */

  sprinkle();
  initWhipCursor();
  buildSwatches();
  buildChips();
  paintLook();
  el.wardrobe.hidden = !state.wardrobe;
  el.dress.setAttribute('aria-expanded', String(state.wardrobe));
  restore();

  // en Chrome la lista de voces llega después de cargar la página
  if ('speechSynthesis' in window) {
    refreshVoices();
    try { speechSynthesis.addEventListener('voiceschanged', refreshVoices); }
    catch (e) { speechSynthesis.onvoiceschanged = refreshVoices; }
  }

  // cuando el navegador está tranquilo, se va bajando la librería en segundo plano
  // así elegir la foto no tiene que esperar 1.3 MB (una sola descarga, no dos)
  const warm = () => {
    if (navigator.connection && navigator.connection.saveData) return;
    loadModels().catch(() => { /* ya se reintenta al elegir la foto */ });
  };
  if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 6000 });
  else setTimeout(warm, 2500);
  loadVoiceClips();

  const hits = $('#hits');
  if (hits) hits.textContent = String(1 + ((Date.now() / 8.64e7) | 0) % 89);
})();
