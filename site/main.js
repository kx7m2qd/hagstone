/* Hagstone — site motion. GSAP + ScrollTrigger + SplitText + Lenis (vendored, pinned). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('static');
  const DEBUG_Y = params.get('y');
  const mobile = () => innerWidth <= 720;

  /* ---------- always-on behaviour ---------- */
  $$('[data-copy]').forEach((el) => {
    el.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(el.dataset.copy); } catch { return; }
      el.classList.add('done');
      const cp = $('.cp', el); const was = cp.textContent; cp.textContent = 'Copied';
      setTimeout(() => { el.classList.remove('done'); cp.textContent = was; }, 1600);
    });
  });

  /* ---------- theme ---------- */
  const themeBtn = $('#theme-btn');
  const syncThemeBtn = () => {
    const light = document.documentElement.dataset.theme === 'light';
    themeBtn.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    $('meta[name=theme-color]').content = light ? '#f3efe7' : '#0b0b0a';
  };
  syncThemeBtn();
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('starlight-theme', next); } catch {}
    syncThemeBtn();
    dispatchEvent(new Event('themechange'));
  });

  if (RM || !window.gsap) {
    document.documentElement.classList.add('rm');
    document.body.classList.remove('is-loading');
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);

  /* ---------- smooth scroll ---------- */
  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  /* ---------- nav ---------- */
  const nav = $('#nav');
  let lastY = 0, stageEnd = Infinity;
  lenis.on('scroll', ({ scroll }) => {
    const down = scroll > lastY;
    nav.classList.toggle('hide', down && scroll > 240 && !nav.matches(':focus-within'));
    nav.classList.toggle('solid', scroll > stageEnd - 40);
    lastY = scroll;
  });

  /* ---------- magnetic buttons ---------- */
  $$('.magnetic').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.22);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });

  /* ---------- spotlight on cards ---------- */
  $$('.check').forEach((c) => c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));

  /* The stone's texture is a heavy SVG filter (noise + lighting). Render it once into a bitmap the size of
     its biggest on-screen moment, so the zoom only moves pixels and never re-runs the filter. */
  const bakeStone = (svg, scaleUp) => new Promise((resolve) => {
    const defs = $('svg defs');
    if (!svg || !defs) return resolve();
    const px = Math.min(4096, Math.round(svg.getBoundingClientRect().width * Math.min(devicePixelRatio || 1, 2) * scaleUp));
    if (!px) return resolve();
    const src = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="${px}" height="${px}">${defs.outerHTML}<use href="#stone"/></svg>`;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = px;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, px, px);
      // keep only the stone itself: the hole must stay truly empty (clip paths don't survive SVG-as-image)
      const shape = $('#stoneShape');
      if (shape && window.Path2D) {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.setTransform(px / 400, 0, 0, px / 400, 0, 0);
        ctx.fill(new Path2D(shape.getAttribute('d')), 'evenodd');
      }
      c.setAttribute('class', svg.getAttribute('class') || ''); c.setAttribute('aria-hidden', 'true');
      svg.replaceWith(c);
      URL.revokeObjectURL(img.src);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
  });

  Promise.all([document.fonts.ready, bakeStone($('.stone-wrap .stone'), 2.2), bakeStone($('.final-stone svg'), 1.2)]).then(init);

  function init() {
    const stageST = buildStage();
    const syncEnd = () => { stageEnd = stageST.end; };
    ScrollTrigger.addEventListener('refresh', syncEnd);
    buildIntro();
    buildStatement();
    buildNoise();
    buildChecks();
    buildReveals();
    buildFaq();

    // anchor links through Lenis (the code story lives inside the pinned stage)
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id === '#main' ) return;
      e.preventDefault();
      if (id === '#top') return lenis.scrollTo(0, { duration: 1.6 });
      if (id === '#story') return lenis.scrollTo(stageST.start + (stageST.end - stageST.start) * 0.24, { duration: 2 });
      const el = $(id); if (el) lenis.scrollTo(el, { duration: 1.8 });
    }));

    ScrollTrigger.refresh();
    if (DEBUG_Y !== null) {
      const y = DEBUG_Y.endsWith('p') ? stageST.start + (stageST.end - stageST.start) * parseFloat(DEBUG_Y) : parseFloat(DEBUG_Y);
      lenis.scrollTo(y, { immediate: true, force: true });
      ScrollTrigger.update();
    }
  }

  /* ---------- intro ---------- */
  function buildIntro() {
    const split = SplitText.create('.hero-title', { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    document.body.classList.remove('is-loading');
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.stone-float', { scale: 0.78, opacity: 0, filter: 'blur(24px)', duration: 2.2, clearProps: 'filter' }, 0)
      .from(split.lines, { yPercent: 115, duration: 1.5, stagger: 0.12 }, 0.25)
      .from('.kicker', { opacity: 0, y: 14, duration: 1.2 }, 0.5)
      .from('.hero-foot', { opacity: 0, y: 24, duration: 1.4 }, 0.7)
      .from('.nav', { opacity: 0, y: -20, duration: 1.2, clearProps: 'transform,opacity' }, 0.8)
      .from('.scroll-hint', { opacity: 0, duration: 1.2 }, 1.2)
      .add(() => gsap.to('.stone-float', { y: -7, rotation: 1.2, duration: 4.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    if (DEBUG_Y !== null) tl.progress(1);
  }

  /* ---------- stage: zoom through the hole, then the code story ---------- */
  function buildStage() {
    const stage = $('.stage'), veil = $('.veil'), vc = $('.veil-canvas'), flare = $('.flare'), wrap = $('.stone-wrap'), world = $('.world'), files = $('.files');
    const G = { cx: 0, cy: 0, r0: 60, rEnd: 2000 };

    const geom = () => {
      const cs = getComputedStyle(wrap);
      G.cx = parseFloat(cs.left); G.cy = parseFloat(cs.top);
      const holeR = wrap.offsetWidth * 0.112;
      G.r0 = holeR * 1.3;
      const far = Math.hypot(Math.max(G.cx, innerWidth - G.cx), Math.max(G.cy, innerHeight - G.cy));
      G.rEnd = far * 1.25;
      for (const el of [veil, flare]) { el.style.setProperty('--cx', `${G.cx}px`); el.style.setProperty('--cy', `${G.cy}px`); }
      const dpr = Math.min(devicePixelRatio || 1, 2);
      vc.width = Math.round(innerWidth * dpr); vc.height = Math.round(innerHeight * dpr);
      G.dpr = dpr;
      gsap.set(world, { transformOrigin: `${G.cx}px ${G.cy}px` });
    };
    geom();
    // the veil: ink everywhere except a circle of radius V.r around the hole, with a feathered edge of V.f
    const V = { r: G.r0, f: 1 };
    const vctx = vc.getContext('2d');
    let ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    addEventListener('themechange', () => { ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(); drawVeil(); });
    const drawVeil = () => {
      const d = G.dpr || 1, w = vc.width, h = vc.height, cx = G.cx * d, cy = G.cy * d;
      const outer = (V.r + 1) * d, inner = Math.max(0, (V.r - V.f) * d);
      vctx.globalCompositeOperation = 'source-over';
      vctx.clearRect(0, 0, w, h);
      vctx.fillStyle = ink; vctx.fillRect(0, 0, w, h);
      vctx.globalCompositeOperation = 'destination-out';
      vctx.fillStyle = '#000';
      vctx.beginPath(); vctx.arc(cx, cy, inner, 0, Math.PI * 2); vctx.fill();
      const g = vctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      vctx.fillStyle = g;
      vctx.beginPath(); vctx.arc(cx, cy, outer, 0, Math.PI * 2); vctx.fill();
    };
    drawVeil();
    ScrollTrigger.addEventListener('refresh', drawVeil);

    // trace: a rail in the left gutter. Each step is a node on a card's edge, joined by rounded elbows,
    // so the line never crosses code. A glowing head rides the stroke as it draws.
    const lineY = (mark) => {
      const line = mark.closest('.l'); let y = 0, n = line;
      while (n && n !== files) { y += n.offsetTop; n = n.offsetParent; }
      return y + line.offsetHeight / 2;
    };
    const P = {};
    const paths = () => {
      const pad = parseFloat(getComputedStyle(files).paddingLeft);
      const rx = pad * 0.34, r = Math.min(12, pad * 0.25);
      const pts = ['.m-src', '.m-pass', '.m-sink'].map((sel) => { const m = $(sel); return { x: m.closest('.file').offsetLeft, y: lineY(m) }; });
      const [a, b, c] = pts;
      const d1 = `M${a.x} ${a.y} H${rx + r} Q${rx} ${a.y} ${rx} ${a.y + r} V${b.y - r} Q${rx} ${b.y} ${rx + r} ${b.y} H${b.x}`;
      const d2 = `M${rx} ${b.y} V${c.y - r} Q${rx} ${c.y} ${rx + r} ${c.y} H${c.x}`;
      $('.seg.s1').setAttribute('d', d1); $('.seg.s2').setAttribute('d', d2);
      $('.rail-bg').setAttribute('d', `${d1} ${d2}`);
      $$('.seg').forEach((p) => p.setAttribute('pathLength', '1'));
      pts.forEach((p, i) => { const n = $(`.node.n${i + 1}`); n.setAttribute('cx', p.x); n.setAttribute('cy', p.y); });
      P.s1 = $('.seg.s1'); P.s2 = $('.seg.s2'); P.l1 = P.s1.getTotalLength(); P.l2 = P.s2.getTotalLength();
    };
    paths();
    const head = $('.head');
    const moveHead = () => {
      const o1 = +gsap.getProperty(P.s1, 'strokeDashoffset'), o2 = +gsap.getProperty(P.s2, 'strokeDashoffset');
      const onS2 = o2 < 1, seg = onS2 ? P.s2 : P.s1, len = onS2 ? P.l2 : P.l1, o = onS2 ? o2 : o1;
      const pt = seg.getPointAtLength(len * (1 - o));
      head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y);
    };
    ScrollTrigger.addEventListener('refreshInit', geom);
    ScrollTrigger.addEventListener('refresh', paths);

    const caps = $$('.cap');
    const lineH = () => $('.f3 .l:not(.bad):not(.good)').offsetHeight || 24;

    gsap.set(['.f2', '.f3'], { opacity: 0.32 });
    gsap.set('.rail-bg', { opacity: 0 });
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: stage, start: 'top top', end: () => `+=${innerHeight * 5.9}`, pin: true, scrub: 0.45, invalidateOnRefresh: true },
      onUpdate: moveHead,
    });

    // 0 → 1.3 : through the hole
    // A: stone grows 3.4x while the veil's hole stays hidden under the stone's rim (same ease, same length)
    // B: the stone dissolves, the hole opens like an iris with a feathered edge, light floods in
    const SA = 3.4;
    tl.to(wrap, { scale: SA, duration: 1.0, ease: 'power3.in' }, 0)
      .to(V, { r: () => G.r0 * SA, duration: 1.0, ease: 'power3.in', onUpdate: drawVeil }, 0)
      .to(wrap, { opacity: 0, duration: 0.3, ease: 'power1.in' }, 0.78)
      .to(V, { r: () => G.rEnd, f: () => G.r0 * 3, duration: 0.45, ease: 'power2.out', onUpdate: drawVeil }, 1.0)
      .set(veil, { visibility: 'hidden' }, 1.46)
      .fromTo(flare, { opacity: 0 }, { opacity: 0.55, duration: 0.25, ease: 'power2.in' }, 0.82)
      .to(flare, { opacity: 0, duration: 0.45, ease: 'power2.out' }, 1.07)
      .fromTo(world, { scale: 1.7, opacity: 0.45 }, { scale: 1, opacity: 1, duration: 1.35, ease: 'power3.out' }, 0.15)
      .fromTo('.file', { y: 60 }, { y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, 0.85)
      .to('.hero-title', { y: -170, duration: 0.7, ease: 'power2.in' }, 0)
      .to('.hero-copy', { opacity: 0, duration: 0.5, ease: 'power1.in' }, 0.1)
      .to('.scroll-hint', { opacity: 0, duration: 0.15 }, 0)
      .fromTo('.cap-eyebrow', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3 }, 1.1);

    const capIn = (i, at) => tl.fromTo(caps[i], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, at);
    const capOut = (i, at) => tl.to(caps[i], { opacity: 0, y: -40, duration: 0.3, ease: 'power2.in' }, at);
    const lit = (sel, at) => tl.fromTo(sel, { '--lit': 0 }, { '--lit': 1, duration: 0.3 }, at);

    // 1 : source
    capIn(0, 1.2); lit('.hl-src', 1.3);
    tl.to('.rail-bg', { opacity: 1, duration: 0.3 }, 1.2).fromTo('.n1', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 1.35)
      .fromTo(head, { opacity: 0 }, { opacity: 1, duration: 0.15 }, 2.15);
    tl.fromTo('.t-src', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 1.4);
    // 2 : crosses files
    capOut(0, 2.1); capIn(1, 2.3);
    tl.to('.seg.s1', { strokeDashoffset: 0, duration: 0.5 }, 2.2)
      .fromTo('.n2', { opacity: 0 }, { opacity: 1, duration: 0.15 }, 2.68)
      .to('.f2', { opacity: 1, duration: 0.3 }, 2.3);
    lit('.hl-pass', 2.55);
    tl.fromTo('.t-pass', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 2.6);
    // 3 : sink
    capOut(1, 3.1); capIn(2, 3.3);
    tl.to('.seg.s2', { strokeDashoffset: 0, duration: 0.5 }, 3.2)
      .fromTo('.n3', { opacity: 0 }, { opacity: 1, duration: 0.15 }, 3.68)
      .to(head, { opacity: 0, duration: 0.2 }, 3.75)
      .to('.f3', { opacity: 1, duration: 0.3 }, 3.3);
    lit('.hl-sink', 3.55);
    tl.fromTo('.t-sink', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 3.6)
      .to('.f3', { x: 6, duration: 0.04, yoyo: true, repeat: 3 }, 3.7);
    // 4 : the fix
    capOut(2, 4.1); capIn(3, 4.3);
    tl.to('.l.bad', { height: 0, opacity: 0, duration: 0.35, ease: 'power2.inOut' }, 4.2)
      .to('.l.good', { height: () => lineH(), opacity: 1, duration: 0.35, ease: 'power2.inOut' }, 4.4)
      .to(['.seg', '.node', '.rail-bg', '.t-src', '.t-pass', '.t-sink'], { opacity: 0.18, duration: 0.3 }, 4.3)
      .to(['.hl-src', '.hl-pass'], { '--lit': 0.35, duration: 0.3 }, 4.3)
      .fromTo('.fcard', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 4.6)
      // exit: the code world steps back into the dark
      .set(world, { transformOrigin: '50% 50%' }, 5.14)
      .to(world, { scale: 0.8, borderRadius: 32, boxShadow: () => document.documentElement.dataset.theme === 'light' ? '0 0 0 1px rgba(25,23,19,.12), 0 60px 120px -40px rgba(60,45,30,.35)' : '0 0 0 1px rgba(236,230,220,.14), 0 60px 120px -40px rgba(0,0,0,.9)', duration: 0.7, ease: 'power3.inOut' }, 5.15)
      .to(world, { opacity: 0, y: -40, duration: 0.45, ease: 'power2.in' }, 5.5);
    return tl.scrollTrigger;
  }

  /* ---------- statement: words light up with scroll ---------- */
  function buildStatement() {
    const el = $('[data-words]');
    const split = SplitText.create(el, { type: 'words', wordsClass: 'w' });
    gsap.to(split.words, {
      opacity: 1, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 45%', scrub: 0.6 },
    });
  }

  /* ---------- noise: hundreds of findings collapse to the few that matter ---------- */
  function buildNoise() {
    const sec = $('.noise'), canvas = $('.noise-canvas'), ctx = canvas.getContext('2d');
    const num = $('#noiseNum'), filters = $$('.filters li'), real = $$('.real li'), realHead = $('.real-head');
    const counts = [5, 260, 180, 150, 45]; // [real, unreachable, test/dev, baselined, hardening]
    const stages = [[0.1, 0.27], [0.29, 0.46], [0.48, 0.64], [0.66, 0.78]];
    let W = 0, H = 0, dpr = 1, P = [], target = 0, p = 0, active = false;

    const rand = (a, b) => a + Math.random() * (b - a);
    const build = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      const x0 = mobile() ? 0.04 : 0.42, scale = mobile() ? 0.5 : 1;
      P = [];
      counts.forEach((n, cat) => {
        for (let i = 0; i < Math.round(n * (cat === 0 ? 1 : scale)); i++) {
          P.push({ cat, hx: rand(x0, 0.97) * W, hy: rand(0.08, 0.94) * H, ph: rand(0, Math.PI * 2), sp: rand(0.3, 1), jit: rand(-0.06, 0.06), r: rand(1, 2.1), k: P.filter((q) => q.cat === 0).length });
        }
      });
    };
    build();
    addEventListener('resize', build);

    ScrollTrigger.create({
      trigger: sec, start: 'top top', end: () => `+=${innerHeight * 3}`, pin: true, scrub: true,
      onUpdate: (s) => { target = s.progress; },
    });
    // draw only while the pinned section (via its pin-spacer) is on screen
    new IntersectionObserver(([e]) => { active = e.isIntersecting; }).observe(sec.parentElement);

    let dotColor = getComputedStyle(document.documentElement).getPropertyValue('--bone').trim();
    addEventListener('themechange', () => { dotColor = getComputedStyle(document.documentElement).getPropertyValue('--bone').trim(); });
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const ease = (t) => t * t * (3 - 2 * t);
    gsap.ticker.add((time) => {
      if (!active) return;
      p += (target - p) * 0.12;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      const col = clamp((p - 0.8) / 0.14);
      for (const q of P) {
        const t = time * q.sp;
        let x = q.hx + Math.sin(t + q.ph) * 6, y = q.hy + Math.cos(t * 0.8 + q.ph) * 6;
        if (q.cat === 0) {
          const li = real[q.k];
          if (li && col > 0) {
            const r = li.getBoundingClientRect(), c = canvas.getBoundingClientRect();
            const tx = r.left - c.left + 1.5, ty = r.top - c.top + r.height / 2, e = ease(col);
            x += (tx - x) * e; y += (ty - y) * e;
          }
          ctx.globalAlpha = 1 - col * 0.9;
          ctx.fillStyle = '#ff5b2e';
          ctx.beginPath(); ctx.arc(x, y, 3.2 + Math.sin(time * 3 + q.ph) * 0.4, 0, 7); ctx.fill();
          continue;
        }
        const [a, b] = stages[q.cat - 1];
        const f = ease(clamp((p - a - q.jit * (b - a)) / (b - a)));
        if (f >= 1) continue;
        alive += 1 - f;
        ctx.globalAlpha = (1 - f) * 0.5;
        ctx.fillStyle = dotColor;
        ctx.beginPath(); ctx.arc(x, y + f * 40, q.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const scale = mobile() ? 2 : 1;
      num.textContent = Math.round(alive * scale + 5);
      filters.forEach((li, i) => li.classList.toggle('on', p > (stages[i][0] + stages[i][1]) / 2));
      realHead.style.opacity = clamp((p - 0.8) / 0.06);
      real.forEach((li, i) => {
        const v = clamp((p - 0.82 - i * 0.016) / 0.06);
        li.style.opacity = v; li.style.transform = `translateX(${(1 - v) * 30}px)`;
      });
    });
  }

  /* ---------- horizontal checks ---------- */
  function buildChecks() {
    const track = $('.checks-track');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '.checks', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 1, invalidateOnRefresh: true },
    });
    tl.to(track, { x: () => -dist() }, 0).to('.checks-progress i', { scaleX: 1 }, 0);
    $$('.check:not(.intro)').forEach((card) => {
      gsap.from($$('h3, p, .rows', card), {
        y: 40, opacity: 0, stagger: 0.06, ease: 'power3.out',
        scrollTrigger: { trigger: card, containerAnimation: tl, start: 'left 85%', end: 'left 45%', scrub: 1 },
      });
    });
  }

  /* ---------- headings, stats, cards, dashboard, final, footer ---------- */
  function buildReveals() {
    $$('[data-split]').forEach((el) => {
      const s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
      gsap.from(s.lines, { yPercent: 115, duration: 1.4, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: el, start: 'top 86%' } });
    });
    $$('.eyebrow:not(.check .eyebrow)').forEach((el) => gsap.from(el, { opacity: 0, x: -16, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));

    // stats: count up
    $$('.stat').forEach((st, i) => {
      const b = $('b', st), to = parseFloat(b.dataset.count), dec = +(b.dataset.dec || 0), suf = b.dataset.suffix || '';
      const o = { v: 0 };
      gsap.from(st, { opacity: 0, y: 50, duration: 1.2, delay: i * 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.stats', start: 'top 85%' } });
      gsap.to(o, {
        v: to, duration: 2.2, delay: i * 0.08, ease: 'expo.out',
        onUpdate: () => { b.textContent = o.v.toFixed(dec) + suf; },
        scrollTrigger: { trigger: '.stats', start: 'top 85%' },
      });
    });
    gsap.from('.proof-note', { opacity: 0, y: 20, duration: 1, scrollTrigger: { trigger: '.proof-note', start: 'top 92%' } });

    gsap.from('.flowcard', { y: 80, opacity: 0, duration: 1.3, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.flows', start: 'top 82%' } });
    gsap.from('.sec-lead', { opacity: 0, y: 20, duration: 1.2, scrollTrigger: { trigger: '.sec-lead', start: 'top 90%' } });

    // dashboard tilts up to face you
    gsap.fromTo('.dash', { rotateX: 34, scale: 0.86, y: 80, opacity: 0.4 }, {
      rotateX: 0, scale: 1, y: 0, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: '.dash-persp', start: 'top 95%', end: 'top 18%', scrub: 1 },
    });
    const line = $('.chart .line'), len = line.getTotalLength();
    gsap.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut', scrollTrigger: { trigger: '.chart', start: 'top 80%' } });
    gsap.from('.chart .area', { opacity: 0, duration: 2, delay: 0.8, scrollTrigger: { trigger: '.chart', start: 'top 80%' } });
    gsap.fromTo('.owners i', { '--p': 0 }, { '--p': 1, duration: 1.8, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.owners', start: 'top 90%' } });

    // final: the stone rises and the hole glows
    gsap.fromTo('.final-stone', { y: 120, scale: 0.8, rotation: -8 }, { y: 0, scale: 1, rotation: 0, ease: 'none', scrollTrigger: { trigger: '.final', start: 'top bottom', end: 'top 20%', scrub: 1 } });
    gsap.to('.final-stone :is(svg, canvas)', { y: -8, duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.to('.glowhole', { scale: 1.25, opacity: 0.75, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.from(['.final-sub', '.final-cta', '.final-fine'], { opacity: 0, y: 30, duration: 1.2, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.final-sub', start: 'top 90%' } });

    // footer wordmark rises letter by letter
    const wm = SplitText.create('.wordmark', { type: 'chars', mask: 'chars' });
    gsap.from(wm.chars, { yPercent: 100, ease: 'none', stagger: 0.05, scrollTrigger: { trigger: '.wordmark', start: 'top bottom', end: 'bottom bottom', scrub: 1 } });
  }

  /* ---------- FAQ with eased height ---------- */
  function buildFaq() {
    $$('.faq details').forEach((d) => {
      const s = $('summary', d), a = $('.ans', d);
      s.addEventListener('click', (e) => {
        e.preventDefault();
        if (d.open) {
          gsap.to(a, { height: 0, opacity: 0, duration: 0.5, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(a, { clearProps: 'all' }); } });
        } else {
          d.open = true;
          gsap.fromTo(a, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.7, ease: 'expo.out' });
        }
      });
    });
  }
})();
