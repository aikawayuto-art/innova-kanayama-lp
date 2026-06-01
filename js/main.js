/* ===========================================================
   GOLDEN GRIT — interactions + Three.js 3D gym interior
   =========================================================== */
(function () {
  "use strict";

  /* ---------- capability detection ---------- */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let hasWebGL = false;
  try {
    const c = document.createElement("canvas");
    hasWebGL = !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch (e) {}
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 2;
  const isMobile = matchMedia("(max-width:980px)").matches;
  const ENABLE_3D = hasWebGL && !reduce && !lowMem && typeof THREE !== "undefined";
  if (!ENABLE_3D) document.body.classList.add("no-3d");

  /* ---------- helpers ---------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const sectionProgress = (el) => {
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
  };
  const inView = (el, m) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    m = m || 0;
    return r.top < innerHeight + m && r.bottom > -m;
  };
  const now = () => (window.performance && performance.now ? performance.now() : new Date().getTime());

  /* shared pointer (eased) */
  const pointer = { x: 0, y: 0, ex: 0, ey: 0 };
  addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  });

  /* ---------- loader (always dismiss quickly; never wait on heavy media) ---------- */
  const hideLoader = () => { const l = document.getElementById("loader"); if (l) l.classList.add("done"); };
  if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(hideLoader, 1200);
  else addEventListener("DOMContentLoaded", () => setTimeout(hideLoader, 1200));
  setTimeout(hideLoader, 2600); // hard fallback regardless of network

  /* ---------- header / nav ---------- */
  const header = document.getElementById("header");
  const navToggle = document.getElementById("navToggle");
  navToggle.addEventListener("click", () => header.classList.toggle("nav-open"));
  document.querySelectorAll(".nav a").forEach((a) => a.addEventListener("click", () => header.classList.remove("nav-open")));

  /* ---------- reveal ---------- */
  const io = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
    { threshold: 0.14 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  // QA helper: ?qa force-reveals everything and instant-jumps to hash for headless screenshots
  if (location.search.indexOf("qa") >= 0) {
    document.documentElement.style.scrollBehavior = "auto";
    document.querySelectorAll(".reveal, .split").forEach((el) => el.classList.add("in"));
    if (location.hash) { const jump = () => { const t = document.querySelector(location.hash); if (t) window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 70); }; setTimeout(jump, 120); setTimeout(jump, 800); setTimeout(jump, 2000); }
  }

  /* ---------- count-up ---------- */
  const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const runCount = (el) => {
    const to = parseFloat(el.dataset.to); const dur = 1500; let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const t = clamp((ts - start) / dur, 0, 1);
      el.textContent = Math.max(0, Math.round(to * easeOutBack(t))).toLocaleString("en-US");
      if (t < 1) requestAnimationFrame(step); else el.textContent = to.toLocaleString("en-US");
    };
    requestAnimationFrame(step);
  };
  const cIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { runCount(e.target); cIO.unobserve(e.target); } }), { threshold: 0.6 });
  document.querySelectorAll(".count").forEach((el) => cIO.observe(el));

  /* ---------- before/after slider ---------- */
  (function () {
    const slider = document.getElementById("baSlider");
    if (!slider) return;
    const before = document.getElementById("baBefore"), handle = document.getElementById("baHandle");
    let drag = false;
    const set = (cx) => { const r = slider.getBoundingClientRect(); const p = clamp((cx - r.left) / r.width, 0, 1); before.style.width = p * 100 + "%"; handle.style.left = p * 100 + "%"; };
    const dn = () => (drag = true), up = () => (drag = false);
    const mv = (e) => { if (drag) set(e.touches ? e.touches[0].clientX : e.clientX); };
    handle.addEventListener("mousedown", dn); handle.addEventListener("touchstart", dn, { passive: true });
    addEventListener("mouseup", up); addEventListener("touchend", up);
    addEventListener("mousemove", mv); addEventListener("touchmove", mv, { passive: true });
    slider.addEventListener("click", (e) => set(e.clientX));
  })();

  /* ---------- CSS 3D card tilt (method cards) ---------- */
  if (!reduce && !isMobile) {
    document.querySelectorAll(".card-3d").forEach((card) => {
      const inner = card.querySelector(".m-card__inner") || card.firstElementChild;
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const rx = (((e.clientY - r.top) / r.height) - 0.5) * -8;
        const ry = (((e.clientX - r.left) / r.width) - 0.5) * 8;
        if (inner) inner.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(8px)`;
      });
      card.addEventListener("pointerleave", () => { if (inner) inner.style.transform = ""; });
    });
  }

  /* ---------- photo-cutout scroll animation ---------- */
  const cutouts = [...document.querySelectorAll(".cutout")];
  function updateCutouts() {
    for (const el of cutouts) {
      const sec = el.closest("section");
      if (!inView(sec, 120)) { el.style.opacity = 0; continue; }
      const p = sectionProgress(sec);
      const type = el.dataset.cut;
      if (type === "roll") {
        const w = el.offsetWidth || 180;
        const x = lerp(-w - 40, innerWidth + 40, p);
        const R = w / 2;
        const deg = (-(x + w / 2) / R) * (180 / Math.PI);
        el.style.transform = `translate(${x}px,-50%) rotate(${deg}deg)`;
        el.style.opacity = p > 0.03 && p < 0.97 ? 1 : 0;
      } else if (type === "fall") {
        // bold full-height fall across the section
        let t, yvh, rot, xsw;
        if (p < 0.62) { t = p / 0.62; yvh = lerp(-60, 78, t * t); rot = Math.sin(t * 7) * 30; xsw = Math.sin(t * 4) * 5.5; }
        else { t = (p - 0.62) / 0.38; const b = Math.abs(Math.sin(t * 7)) * Math.exp(-t * 3.6) * 30; yvh = 78 - b; rot = Math.sin(t * 15) * Math.exp(-t * 2.6) * 22; xsw = Math.sin(t * 6) * Math.exp(-t * 2.8) * 2.2; }
        el.style.transform = `translate(${xsw}vw, ${(yvh * innerHeight) / 100}px) rotate(${rot}deg)`;
        el.style.opacity = p > 0.02 && p < 0.99 ? 1 : 0;
      } else if (type === "float") {
        const off = (p - 0.5) * -90;
        el.style.transform = `translateY(${off}px) translateX(${pointer.ex * 16}px) rotate(${-6 + pointer.ex * 5}deg)`;
        el.style.opacity = p > 0.05 && p < 0.95 ? 0.9 : 0;
      }
    }
  }

  /* ===========================================================
     THREE.JS — gym interior + intro flythrough
     =========================================================== */
  let renderGym = () => {};
  let canvas = document.getElementById("gl");
  const heroSection = document.getElementById("hero");

  if (ENABLE_3D) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isMobile, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07080b, 0.026);
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 120);

    /* ---- photographic billboards (real bg-removed cutouts placed in 3D) ---- */
    const texLoader = new THREE.TextureLoader(); texLoader.setCrossOrigin("anonymous");
    const billboards = [];
    function billboard(url, w, x, y, z, op) {
      const target = op == null ? 1 : op;
      const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0, fog: true }); // invisible until texture loads
      const sp = new THREE.Sprite(mat); sp.position.set(x, y, z); sp.scale.set(w, w * 1.4, 1);
      sp.userData = { baseY: y };
      texLoader.load(url, (tex) => { tex.encoding = THREE.sRGBEncoding; mat.map = tex; mat.needsUpdate = true; mat.opacity = target; const ar = (tex.image.height / tex.image.width) || 1.4; sp.scale.set(w, w * ar, 1); });
      scene.add(sp); billboards.push(sp); return sp;
    }
    const bbDumbbell = billboard("https://files.catbox.moe/e19zgb.png", 2.4, -3.9, -1.3, 2.6, 1);                   // foreground left (black iron, strong parallax)
    const bbPlate    = billboard("https://files.catbox.moe/dt943d.png", 2.5, 4.0, -0.5, 2.0, 1);                    // foreground right

    /* ---- dust particles ---- */
    const dustN = isMobile ? 110 : 230;
    const dpos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) { dpos[i * 3] = (Math.random() - 0.5) * 20; dpos[i * 3 + 1] = Math.random() * 9 - 3; dpos[i * 3 + 2] = (Math.random() - 0.5) * 12; }
    const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
    const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xffe9a8, size: 0.04, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(dust);

    /* ---- gold glow sprites (atmosphere over the footage) ---- */
    function glowTex() {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const x = c.getContext("2d"); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,214,92,0.95)"); g.addColorStop(0.28, "rgba(245,196,0,0.42)"); g.addColorStop(1, "rgba(245,196,0,0)");
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
    }
    const gTex = glowTex();
    function addGlow(x, y, z, s, op) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op == null ? 0.8 : op }));
      sp.position.set(x, y, z); sp.scale.setScalar(s); scene.add(sp); return sp;
    }
    addGlow(-3.9, -1.0, 2.8, 3.0, 0.5);   // around foreground dumbbell
    addGlow(4.0, -0.3, 2.2, 3.0, 0.5);    // around foreground plate
    addGlow(0, 4.3, -3.5, 6, 0.26);       // upper haze

    /* ---- volumetric light shafts ---- */
    const shaftMat = new THREE.MeshBasicMaterial({ color: 0xffcf4d, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    [[-2.4, -2], [2.4, -2.5]].forEach(([x, z]) => { const cone = new THREE.Mesh(new THREE.ConeGeometry(2.0, 9, 24, 1, true), shaftMat); cone.position.set(x, 3, z); scene.add(cone); });

    /* ---- camera: gentle parallax arc settling front-center ---- */
    const V3 = (a, b, c) => new THREE.Vector3(a, b, c);
    const KEYS = [
      { p: V3(3.6, 0.2, 9.8), l: V3(0, 0.2, -2) },
      { p: V3(-2.0, 0.7, 7.7), l: V3(0, 0.3, -2) },
      { p: V3(0, 0.7, 6.3), l: V3(0, 0.3, -2) },
    ];
    const SETTLE = KEYS[KEYS.length - 1];
    const INTRO_MS = isMobile ? 3800 : 4800;
    let introStart = now();
    const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();

    function camIntro(t) {
      const segn = (KEYS.length - 1), f = clamp(t, 0, 1) * segn, i = Math.min(segn - 1, Math.floor(f)), k = smooth(f - i);
      tmpP.lerpVectors(KEYS[i].p, KEYS[i + 1].p, k);
      tmpL.lerpVectors(KEYS[i].l, KEYS[i + 1].l, k);
      camera.position.copy(tmpP); camera.lookAt(tmpL);
    }

    let frame = 0;
    renderGym = function (heroIn) {
      frame++;
      const t = (now() - introStart) / INTRO_MS;
      if (t < 1) {
        camIntro(t);
      } else {
        const hp = sectionProgress(heroSection);
        const bob = Math.sin(frame * 0.012) * 0.1;
        camera.position.set(
          lerp(camera.position.x, SETTLE.p.x + pointer.ex * 1.1, 0.05),
          lerp(camera.position.y, SETTLE.p.y + bob - hp * 1.0 - pointer.ey * 0.5, 0.05),
          lerp(camera.position.z, SETTLE.p.z + hp * 3.0, 0.05) // pull back as you scroll out
        );
        camera.lookAt(SETTLE.l.x + pointer.ex * 0.5, SETTLE.l.y - pointer.ey * 0.25, SETTLE.l.z);
      }
      // idle drift on foreground objects for life
      bbDumbbell.position.y = bbDumbbell.userData.baseY + Math.sin(frame * 0.015) * 0.13;
      bbPlate.position.y = bbPlate.userData.baseY + Math.sin(frame * 0.015 + 1.6) * 0.13;
      dust.rotation.y += 0.0004;
      renderer.render(scene, camera);
      return t < 1;
    };

    addEventListener("resize", (() => { let r; return () => { clearTimeout(r); r = setTimeout(() => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }, 150); }; })());
  }

  /* ---------- master loop ---------- */
  let raf, introActive = true;
  function tick() {
    pointer.ex = lerp(pointer.ex, pointer.x, 0.06);
    pointer.ey = lerp(pointer.ey, pointer.y, 0.06);
    updateCutouts();
    if (ENABLE_3D) {
      const heroIn = inView(heroSection, 120);
      if (heroIn || introActive) {
        canvas.style.opacity = heroIn ? 1 : 0;
        introActive = renderGym(heroIn); // true while intro plays, false once settled
      } else {
        canvas.style.opacity = 0;
      }
    }
    raf = requestAnimationFrame(tick);
  }
  tick();
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else { raf = requestAnimationFrame(tick); } });
})();

/* header scrolled / fab visibility */
(function () {
  const header = document.getElementById("header"), fab = document.getElementById("fab"), heroVid = document.getElementById("heroVid"), bar = document.getElementById("scrollBar");
  const onScroll = () => {
    const y = scrollY;
    header.classList.toggle("scrolled", y > 40);
    fab.classList.toggle("show", y > innerHeight * 0.9);
    if (heroVid) heroVid.style.opacity = y < innerHeight * 0.92 ? 1 : 0;
    if (bar) { const max = document.documentElement.scrollHeight - innerHeight; bar.style.width = (max > 0 ? (y / max) * 100 : 0) + "%"; }
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

/* custom cursor (desktop fine-pointer only) */
(function () {
  if (!matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  const cur = document.getElementById("cursor"); if (!cur) return;
  document.body.classList.add("custom-cursor");
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; cur.classList.add("on"); });
  const hot = (v) => () => cur.classList.toggle("hot", v);
  document.querySelectorAll("a,button,.btn,.card-3d,input,textarea,.ba-slider__handle").forEach((el) => { el.addEventListener("pointerenter", hot(true)); el.addEventListener("pointerleave", hot(false)); });
  (function loop() { cx += (x - cx) * 0.22; cy += (y - cy) * 0.22; cur.style.transform = "translate(" + cx + "px," + cy + "px) translate(-50%,-50%)"; requestAnimationFrame(loop); })();
})();

/* limited-campaign countdown to end of month */
(function () {
  const el = document.getElementById("cdown"); if (!el) return;
  const p = (n) => String(n).padStart(2, "0");
  const tick = () => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    let d = Math.max(0, end - now);
    const days = Math.floor(d / 86400000); d -= days * 86400000;
    const h = Math.floor(d / 3600000); d -= h * 3600000;
    const m = Math.floor(d / 60000); d -= m * 60000;
    const s = Math.floor(d / 1000);
    el.textContent = days + "日 " + p(h) + ":" + p(m) + ":" + p(s);
  };
  tick(); setInterval(tick, 1000);
})();

/* ===== spatial 3D scroll — panels rise from Z-depth as you scroll (desktop, motion-safe) ===== */
(function () {
  if (!matchMedia("(min-width:981px) and (pointer:fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  var sels = [".concept__media", ".ba-slider", ".ba-grid", ".method__cards", ".facility__grid", ".facility__dumbbell", ".trainer__pair", ".voice__grid", ".price__grid", ".flow__steps", ".media__logos"];
  var els = [];
  sels.forEach(function (s) { document.querySelectorAll(s).forEach(function (e) { e.classList.add("depth"); els.push(e); }); });
  if (!els.length) return;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var eo = function (t) { return 1 - Math.pow(1 - t, 3); };
  function update() {
    var vh = innerHeight;
    for (var i = 0; i < els.length; i++) {
      var el = els[i], r = el.getBoundingClientRect();
      if (r.bottom < -150 || r.top > vh + 150) continue;
      var p = clamp((vh - r.top) / (vh * 0.8), 0, 1), e = eo(p);
      var z = lerp(-180, 0, e), rx = lerp(7, 0, e), ty = lerp(40, 0, e);
      el.style.transform = "perspective(1200px) translate3d(0," + ty.toFixed(1) + "px," + z.toFixed(1) + "px) rotateX(" + rx.toFixed(2) + "deg)";
    }
  }
  var ticking = false;
  addEventListener("scroll", function () { if (!ticking) { requestAnimationFrame(function () { update(); ticking = false; }); ticking = true; } }, { passive: true });
  addEventListener("resize", update);
  update();
})();

/* ===== ambient BGM (generative warm pad · royalty-free · Web Audio, no file) ===== */
(function () {
  "use strict";
  var btn = document.getElementById("audioBtn");
  if (!btn || !(window.AudioContext || window.webkitAudioContext)) { if (btn) btn.style.display = "none"; return; }
  var ctx = null, master = null, voices = [], lfos = [], playing = false, built = false;
  var CHORD = [130.81, 196.00, 261.63, 329.63, 392.00]; // C3 G3 C4 E4 G4 — warm major-9 pad

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    var delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42;
    var fb = ctx.createGain(); fb.gain.value = 0.33;
    var wet = ctx.createGain(); wet.gain.value = 0.26;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);

    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 760; lp.Q.value = 0.6;
    lp.connect(master); lp.connect(delay);

    var flfo = ctx.createOscillator(); flfo.frequency.value = 0.05;
    var flfoGain = ctx.createGain(); flfoGain.gain.value = 230;
    flfo.connect(flfoGain); flfoGain.connect(lp.frequency); flfo.start();
    lfos.push(flfo);

    CHORD.forEach(function (f, i) {
      var o1 = ctx.createOscillator(); o1.type = "sine";     o1.frequency.value = f; o1.detune.value = -4;
      var o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = f; o2.detune.value = 5;
      var g = ctx.createGain(); g.gain.value = (i === 0 ? 0.16 : 0.085);
      var tl = ctx.createOscillator(); tl.frequency.value = 0.06 + i * 0.017;
      var tg = ctx.createGain(); tg.gain.value = 0.03;
      tl.connect(tg); tg.connect(g.gain); tl.start();
      o1.connect(g); o2.connect(g); g.connect(lp);
      o1.start(); o2.start();
      voices.push(o1, o2); lfos.push(tl);
    });
    built = true;
  }

  function fade(to, sec) {
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(Math.max(to, 0.0001), now + sec);
  }
  function start() {
    if (!built) build();
    if (ctx.state === "suspended") ctx.resume();
    fade(0.075, 2.4); playing = true;
    btn.setAttribute("aria-pressed", "true"); btn.setAttribute("a-playing", "true");
  }
  function stop() {
    fade(0.0001, 1.0); playing = false;
    btn.setAttribute("aria-pressed", "false"); btn.setAttribute("a-playing", "false");
    setTimeout(function () { if (!playing && ctx) { try { ctx.suspend(); } catch (e) {} } }, 1100);
  }
  btn.addEventListener("click", function () { if (playing) { stop(); } else { start(); } });
  document.addEventListener("visibilitychange", function () {
    if (!ctx || !playing) return;
    try { document.hidden ? ctx.suspend() : ctx.resume(); } catch (e) {}
  });
})();

