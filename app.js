/* mydaddyfriend.lol
   Todo pasa en el navegador: la foto nunca se sube a ningún servidor. */
(() => {
  'use strict';

  const S = 560;                                  // lado de la textura de la cara (px)
  const TARGET = { x: 0.50, y: 0.42, dist: 0.34 }; // dónde queremos los ojos dentro de la textura
  const KEY = 'mdf.v1';
  const MODELS = 'vendor/face-api/models';

  const PHRASES = [
    'YES DADDY', "YOU'RE MY DADDY", 'I LOVE THIS', 'OH MY GOD DADDY',
    'MORE DADDY MORE', 'SÍ PAPI', 'THANK YOU DADDY', 'AAAAH DADDY',
    'DADDY DADDY DADDY', 'I LIVE FOR THIS', 'YES YES YES', 'MMMM DADDY',
    'YOU ARE THE BEST DADDY', 'PLEASE DADDY', 'AY PAPI', "DON'T STOP DADDY"
  ];
  const EMOJI = ['💗', '✨', '💦', '😩', '⭐', '💫', '🔥', '💕', '🫠'];
  const FLOATERS = ['🍌', '👁️', '🧀', '🐛', '🫧', '🦷', '🍕', '👽', '🧦', '🪱', '🥑', '🛸', '🦶', '💅'];

  const $ = (sel, root = document) => root.querySelector(sel);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const rand = (a, b) => a + Math.random() * (b - a);

  const el = {
    stage: $('#stage'), guy: $('#guy'), canvas: $('#faceCanvas'), fx: $('#fx'),
    eyeL: $('#eyeL'), eyeR: $('#eyeR'), mouth: $('#mouth'),
    bubble: $('#bubble'), name: $('#nameInput'), file: $('#fileInput'),
    count: $('#count'), status: $('#status'), panel: $('#panel'),
    particles: $('#particles'), floaters: $('#floaters'),
    pick: $('#pickBtn'), adjust: $('#adjustBtn'), sound: $('#soundBtn'),
    reset: $('#resetBtn'), panelX: $('#panelX'), panelReset: $('#panelReset')
  };

  const ctx = el.canvas.getContext('2d', { willReadFrequently: true });

  const DEFAULT_ADJ = { zoom: 1, dx: 0, dy: 0, rot: 0, eyeY: 0, eyeGap: 1, mouthY: 0, mouthS: 1 };

  const state = {
    img: null,          // HTMLImageElement con la foto original (reducida)
    src: null,          // dataURL de esa foto
    det: null,          // ojos/boca en coordenadas de la foto
    geom: null,         // dónde quedó cada rasgo dentro de la textura
    adj: { ...DEFAULT_ADJ },
    skin: null,
    name: '',
    count: 0,
    sound: true
  };

  const sliders = {
    zoom: $('#a_zoom'), dx: $('#a_dx'), dy: $('#a_dy'), rot: $('#a_rot'),
    eyeY: $('#a_eyeY'), eyeGap: $('#a_eyeGap'), mouthY: $('#a_mouthY'), mouthS: $('#a_mouthS')
  };

  /* ---------------------------------------------------------------- estado */

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        src: state.src, det: state.det, adj: state.adj, skin: state.skin,
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
    el.name.value = state.name;
    paintCount();
    paintSound();

    if (data.src && data.det) {
      state.det = data.det;
      state.adj = { ...DEFAULT_ADJ, ...(data.adj || {}) };
      syncSliders();
      loadImage(data.src).then(img => {
        state.img = img;
        state.src = data.src;
        render();
        el.stage.classList.add('has-face');
        flash('bienvenido de vuelta 🫡');
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
    const m = Math.min(w, h), cx = w / 2, cy = h / 2, gap = m * 0.165;
    return {
      eyeL: { x: cx - gap, y: cy - m * 0.02, w: m * 0.12, h: m * 0.05 },
      eyeR: { x: cx + gap, y: cy - m * 0.02, w: m * 0.12, h: m * 0.05 },
      mouth: { x: cx, y: cy + m * 0.26, w: m * 0.22, h: m * 0.10 },
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

    state.geom = {
      eyeL: { x: parseFloat(el.eyeL.style.left) / 100, y: parseFloat(el.eyeL.style.top) / 100, w: eyeW, h: eyeH },
      eyeR: { x: parseFloat(el.eyeR.style.left) / 100, y: parseFloat(el.eyeR.style.top) / 100, w: eyeW, h: eyeH },
      mouth: { x: M.x, y: M.y + a.mouthY, w: mw, h: mw * 1.06 }
    };
  }

  // Color de piel: se prueban varios puntos alrededor de cada rasgo y se elige uno
  // "de piel" y más bien claro, para no terminar copiando pelo, sombras o delineador.
  function sampleAt(nx, ny) {
    const R = 6;
    const x = clamp(Math.round(nx * S) - R, 0, S - 2 * R);
    const y = clamp(Math.round(ny * S) - R, 0, S - 2 * R);
    let data;
    try { data = ctx.getImageData(x, y, 2 * R, 2 * R).data; } catch (e) { return null; }
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    return n ? [r / n, g / n, b / n] : null;
  }

  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const skinish = (c) => c[0] > c[2] + 6 && c[0] > 45 && c[0] < 248;
  const css = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

  // de los candidatos, el que está en el percentil 70 de luminosidad:
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
      [0.50, 0.30], [0.38, 0.45], [0.62, 0.45], [0.50, 0.52],
      [0.33, 0.62], [0.67, 0.62], [0.50, 0.86]
    ]);
    const base = all || l || r || mo;
    if (!base) return;

    state.skin = css(base);
    el.fx.style.setProperty('--skin', css(base));
    el.fx.style.setProperty('--skin-l', css(l || base));
    el.fx.style.setProperty('--skin-r', css(r || base));
    el.fx.style.setProperty('--skin-m', css(mo || base));
    el.fx.style.setProperty('--skin-dark', css([base[0] * 0.72, base[1] * 0.64, base[2] * 0.6]));
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
      status('eso no es una foto 🤨', 'err');
      return;
    }
    status('leyendo la foto…', 'busy');

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
      status('no pude abrir esa imagen 😵 probá con un JPG o PNG', 'err');
      return;
    }

    status('buscando ojos y boca…', 'busy');
    let det = null;
    try {
      det = await detect(state.img);
    } catch (e) {
      console.warn('[mydaddyfriend] detección no disponible:', e);
    }

    state.det = det || guess(state.img);
    state.adj = { ...DEFAULT_ADJ };
    state.skin = null;
    syncSliders();

    render();   // primera pasada: mide los colores de la piel
    render();   // segunda: ya pinta el fondo con ese color

    el.stage.classList.add('has-face');
    save();

    if (state.det.ok) {
      status('¡listo! ahora apretalo 👆');
    } else {
      status('no le encontré la cara — acomodala vos con los sliders', 'err');
      openPanel(true);
    }
  }

  /* ------------------------------------------------------------ expresión */

  let moanTimer = null;

  function moan() {
    if (!el.stage.classList.contains('has-face')) { el.file.click(); return; }

    const phrase = pick(PHRASES);
    el.bubble.textContent = phrase;
    el.bubble.style.setProperty('--rot', rand(-8, 8).toFixed(1) + 'deg');
    el.bubble.classList.add('show');
    el.stage.style.setProperty('--open', rand(0.82, 1.25).toFixed(2));
    el.stage.style.setProperty('--tilt', rand(-4, 4).toFixed(1) + 'deg');

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
    burst();
    speak(phrase);
    squeak();
  }

  function burst() {
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.textContent = pick(EMOJI);
      s.style.left = rand(4, 92) + '%';
      s.style.top = rand(18, 50) + '%';
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

  function speak(text) {
    if (!state.sound || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text.toLowerCase());
      u.lang = /papi/i.test(text) ? 'es-ES' : 'en-US';
      u.pitch = rand(0.5, 1.6);
      u.rate = rand(0.8, 1.15);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* sin voz, no pasa nada */ }
  }

  let audio = null;
  function squeak() {
    if (!state.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      const base = rand(200, 320);
      osc.frequency.setValueAtTime(base, t0);
      osc.frequency.exponentialRampToValueAtTime(base * 2.1, t0 + 0.09);
      osc.frequency.exponentialRampToValueAtTime(base * 1.3, t0 + 0.28);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      osc.connect(gain).connect(audio.destination);
      osc.start(t0);
      osc.stop(t0 + 0.34);
    } catch (e) { /* sin audio, no pasa nada */ }
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
    statusTimer = setTimeout(() => status('arrastrá una foto acá, o pegala con Ctrl+V'), 2500);
  }

  function paintCount() {
    el.count.textContent = String(state.count).padStart(6, '0');
  }

  function paintSound() {
    el.sound.textContent = state.sound ? '🔊 sonido' : '🔇 mute';
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
    state.img = null; state.src = null; state.det = null; state.skin = null;
    state.adj = { ...DEFAULT_ADJ };
    syncSliders();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, S, S);
    el.stage.classList.remove('has-face', 'is-moan');
    el.bubble.classList.remove('show');
    openPanel(false);
    el.file.value = '';
    save();
    status('cara borrada. el muñeco está en paz.');
  }

  /* ---------------------------------------------------------------- eventos */

  el.guy.addEventListener('click', moan);

  el.pick.addEventListener('click', () => el.file.click());
  el.file.addEventListener('change', (e) => useFile(e.target.files[0]));

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

  // barra espaciadora / enter cuando el muñeco tiene foco ya funciona por ser <button>

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

  /* ---------------------------------------------------------------- arranque */

  sprinkle();
  restore();

  // cuando el navegador está tranquilo, se va bajando la librería en segundo plano
  // así elegir la foto no tiene que esperar 1.3 MB (una sola descarga, no dos)
  const warm = () => {
    if (navigator.connection && navigator.connection.saveData) return;
    loadModels().catch(() => { /* ya se reintenta al elegir la foto */ });
  };
  if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 6000 });
  else setTimeout(warm, 2500);

  const hits = $('#hits');
  if (hits) hits.textContent = String(1 + ((Date.now() / 8.64e7) | 0) % 89);
})();
