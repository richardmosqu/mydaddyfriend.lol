/* mydaddyfriend.lol
   Todo pasa en el navegador: la foto nunca se sube a ningún servidor. */
(() => {
  'use strict';

  const S = 560;                                   // lado de la textura de la cara (px)
  const TARGET = { x: 0.50, y: 0.45, dist: 0.30 }; // dónde caen los ojos dentro de la máscara de cara
  const KEY = 'mdf.v2';
  const MODELS = 'vendor/face-api/models';

  const PHRASES = [
    'YES DADDY', "YOU'RE MY DADDY", 'I LOVE THIS', 'OH MY GOD DADDY',
    'MORE DADDY MORE', 'THANK YOU DADDY', 'AAAAH DADDY', 'HARDER DADDY',
    'DADDY DADDY DADDY', 'I LIVE FOR THIS', 'YES YES YES', 'MMMM DADDY',
    'YOU ARE THE BEST DADDY', 'PLEASE DADDY', "DON'T STOP DADDY", 'ONE MORE TIME DADDY'
  ];
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
    panelX: $('#panelX'), panelReset: $('#panelReset')
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
    el.name.value = state.name;
    paintCount();
    paintSound();
    paintBody();

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
    const body = state.skinEdge || state.skin;
    if (body) {
      const c = body.match(/\d+/g).map(Number);
      el.stage.style.setProperty('--skin-body', body);
      el.stage.style.setProperty('--skin-shade', css([c[0] * 0.78, c[1] * 0.66, c[2] * 0.6]));
    }
    if (state.hair) {
      let c = state.hair.match(/\d+/g).map(Number);
      // el pelo tiene que quedar más oscuro que la piel, si no el personaje sale de un solo color
      if (body) {
        const sk = body.match(/\d+/g).map(Number);
        const top = lum(sk) * 0.7, L = lum(c) || 1;
        if (L > top) c = c.map(v => v * top / L);
      }
      el.stage.style.setProperty('--hair', css(c));
      el.stage.style.setProperty('--hair-hi', css([c[0] * 1.55 + 18, c[1] * 1.55 + 15, c[2] * 1.55 + 13]));
    }
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

    const phrase = pick(PHRASES);
    el.bubble.textContent = phrase;
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
    burst();
    whipCrack();
    speak(phrase);
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

  function speak(text) {
    if (!state.sound || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text.toLowerCase());
      u.lang = 'en-US';
      u.pitch = rand(0.5, 1.6);
      u.rate = rand(0.85, 1.15);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* sin voz, no pasa nada */ }
  }

  let audio = null, noiseBuf = null;
  function ac() {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    return audio;
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

  // látigo: silbido que sube + chasquido + un golpe grave
  function whipCrack() {
    if (!state.sound) return;
    try {
      const a = ac(), t0 = a.currentTime, buf = noise(a);

      const s1 = a.createBufferSource(); s1.buffer = buf;
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(420, t0);
      bp.frequency.exponentialRampToValueAtTime(3800, t0 + 0.13);
      const g1 = a.createGain();
      g1.gain.setValueAtTime(0.0001, t0);
      g1.gain.exponentialRampToValueAtTime(0.2, t0 + 0.11);
      g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
      s1.connect(bp).connect(g1).connect(a.destination);
      s1.start(t0); s1.stop(t0 + 0.28);

      const tc = t0 + 0.125;
      const s2 = a.createBufferSource(); s2.buffer = buf;
      const hp = a.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 2400;
      const g2 = a.createGain();
      g2.gain.setValueAtTime(0.0001, tc);
      g2.gain.exponentialRampToValueAtTime(0.55, tc + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0001, tc + 0.1);
      s2.connect(hp).connect(g2).connect(a.destination);
      s2.start(tc); s2.stop(tc + 0.16);

      const osc = a.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(170, tc);
      osc.frequency.exponentialRampToValueAtTime(55, tc + 0.11);
      const g3 = a.createGain();
      g3.gain.setValueAtTime(0.0001, tc);
      g3.gain.exponentialRampToValueAtTime(0.3, tc + 0.006);
      g3.gain.exponentialRampToValueAtTime(0.0001, tc + 0.16);
      osc.connect(g3).connect(a.destination);
      osc.start(tc); osc.stop(tc + 0.2);
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
    el.stage.classList.remove('has-face', 'is-moan');
    el.bubble.classList.remove('show');
    openPanel(false);
    el.file.value = '';
    save();
    status('face cleared. the doll is at peace.');
  }

  /* -------------------------------------------------------------- eventos */

  el.guy.addEventListener('click', moan);

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
