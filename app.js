/* Biscuit landing — live dog rendering + interactions. Vanilla, no build step. */
(() => {
  "use strict";

  // Lemon Squeezy hosted checkout. Swap this for the real product/variant URL
  // once the store exists; the overlay + Apple Pay then work automatically.
  const BUY_URL = "https://biscuit-dog.lemonsqueezy.com/checkout/buy/65e7e272-692e-43a6-a4c6-3242d63c04b4";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Per-swatch recolor. The cat body reads --cat-color; pupils --eye-color;
  // the 1px edge --cat-outline (light colorways need a visible edge). Mouth
  // stays Biscuit pink (baked into the art).
  const COLORS = {
    c1: {},                                                     // Midnight (theme default so it reads in dark mode too)
    c2: { color: "#E08A3E", eye: "#5A3310" },                   // Marmalade
    c3: { color: "#9A938B" },                                   // Pebble
    c4: { color: "#8FA86B", eye: "#3F502A" },                   // Matcha
    c5: { color: "#F2ECE3", outline: "#C9BAA9", eye: "#9A9088" } // Snow
  };

  const followCats = [];
  const POSE_URL = {
    idle: "assets/cat/idle.svg",
    playbow: "assets/cat/playbow.svg",
    scroll: "assets/cat/scroll.svg",
    jump: "assets/cat/jump.svg"
  };
  const templates = {};

  async function getPose(pose) {
    const key = POSE_URL[pose] ? pose : "idle";
    if (!templates[key]) {
      const res = await fetch(POSE_URL[key]);
      templates[key] = await res.text();
    }
    return templates[key];
  }

  function mountInto(node, tpl, idx) {
    node.innerHTML = tpl;
    const svg = node.querySelector("svg");
    if (!svg) return;
    svg.classList.add("cat-svg");
    svg.setAttribute("focusable", "false");
    // Namespace internal ids so N inlined copies don't collide on url(#...) refs.
    svg.querySelectorAll("[id]").forEach((el) => {
      const old = el.id;
      const next = `${old}-${idx}`;
      el.id = next;
      svg.querySelectorAll(`[filter="url(#${old})"]`).forEach((u) => u.setAttribute("filter", `url(#${next})`));
      svg.querySelectorAll(`[clip-path="url(#${old})"]`).forEach((u) => u.setAttribute("clip-path", `url(#${next})`));
      svg.querySelectorAll(`[fill="url(#${old})"]`).forEach((u) => u.setAttribute("fill", `url(#${next})`));
    });

    const key = node.getAttribute("data-cat");
    const c = COLORS[key];
    if (c) {
      svg.style.setProperty("--cat-color", c.color);
      if (c.eye) svg.style.setProperty("--eye-color", c.eye);
      if (c.outline) svg.style.setProperty("--cat-outline", c.outline);
    }

    // Desync the idle loops so a wall of cats does not blink in lockstep.
    if (!reduceMotion) {
      const delay = (-Math.random() * 4).toFixed(2) + "s";
      svg.querySelectorAll(".breathe-anim,.eye-l-blink,.eye-r-blink,.tail-sway,.ear-twitch-l,.ear-twitch-r")
        .forEach((e) => { e.style.animationDelay = delay; });
    }

    if (node.getAttribute("data-follow") === "true" && !reduceMotion) {
      followCats.push(svg);
      enablePetting(svg);
    }
  }

  // Pet a live dog: hovering him makes him pant — open mouth, pink tongue, happy
  // squint — just like the desktop app. Scoped per-svg via .is-petting so only
  // the dog under the cursor reacts. The pant lingers ~700ms after you leave,
  // matching the app's purr-clear feel.
  const petClearTimers = new WeakMap();
  function enablePetting(svg) {
    const start = () => {
      clearTimeout(petClearTimers.get(svg));
      svg.classList.add("is-petting");
    };
    const end = () => {
      petClearTimers.set(svg, setTimeout(() => svg.classList.remove("is-petting"), 700));
    };
    // pointerenter/move cover desktop hover; pointerdown/up cover touch taps so
    // the dog also pants when tapped on a phone. The pant lingers after release.
    svg.addEventListener("pointerenter", start);
    svg.addEventListener("pointermove", start);
    svg.addEventListener("pointerdown", start);
    svg.addEventListener("pointerleave", end);
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  }

  async function mountCats() {
    const nodes = Array.from(document.querySelectorAll("[data-cat]"));
    await Promise.all(nodes.map(async (node, i) => {
      const pose = node.getAttribute("data-pose") || "idle";
      const tpl = await getPose(pose);
      mountInto(node, tpl, i);
    }));
    if (!reduceMotion) document.documentElement.classList.add("idle-animated");
  }

  // Pupils ease toward the visitor's cursor — a live demo of "he watches your cursor".
  const FOLLOW_MAX = 1.5; // svg user units
  function trackCursor(clientX, clientY) {
    for (const svg of followCats) {
      const r = svg.getBoundingClientRect();
      if (!r.width) continue;
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.44;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 320);
      dx = (dx / dist) * FOLLOW_MAX * k;
      dy = (dy / dist) * FOLLOW_MAX * k;
      const t = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
      const pl = svg.querySelector(".pupil-left");
      const pr = svg.querySelector(".pupil-right");
      if (pl) pl.style.transform = t;
      if (pr) pr.style.transform = t;
    }
  }

  function initReveals() {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      }
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  function openCheckout(e) {
    if (e) e.preventDefault();
    try {
      if (window.LemonSqueezy && window.LemonSqueezy.Url && window.LemonSqueezy.Url.Open) {
        window.LemonSqueezy.Url.Open(BUY_URL);
        return;
      }
    } catch (_) { /* fall through to new tab */ }
    window.open(BUY_URL, "_blank", "noopener");
  }

  function initBuy() {
    document.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", openCheckout));
  }

  function start() {
    mountCats().then(() => {
      if (followCats.length) {
        window.addEventListener("mousemove", (e) => trackCursor(e.clientX, e.clientY), { passive: true });
      }
    });
    initReveals();
    initBuy();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();


/* Autoplay nudge. The clips carry `autoplay`, but browsers will not start a
   video that has never been on screen, and some (Safari in Low Power Mode)
   will not resume one that scrolled away. Play only while visible, which is
   also the polite thing to do for battery. */
(function () {
  const clips = document.querySelectorAll("video[autoplay]");
  if (!clips.length) return;
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { const p = v.play(); if (p) p.catch(() => {}); }
      else if (!v.paused) { v.pause(); }
    });
  }, { threshold: 0.2 });
  clips.forEach((v) => io.observe(v));
})();
