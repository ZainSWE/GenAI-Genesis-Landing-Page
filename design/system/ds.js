/* GenAI Genesis — design system behaviours (ds.js) v1.3
 * Small, dependency-free helpers for the interactive components in ds.css.
 * Load once per page:  <script src="ds.js" defer></script>
 * Every behaviour is opt-in through markup (data-* attributes / ARIA), so a page only pays for what it uses.
 * Native elements first: <dialog> for dialogs and drawers, popover for menus, <details> for accordions.
 */
(function () {
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* theme: shared with every page via localStorage "gag-theme" (read early by the inline <head> script) */
  function applyTheme(dark) {
    if (dark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    $$(".theme-toggle").forEach((b) => { b.setAttribute("aria-pressed", String(dark)); b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode"); });
  }
  applyTheme(root.dataset.theme === "dark");
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".theme-toggle")) return;
    const dark = root.dataset.theme !== "dark";
    applyTheme(dark);
    try { localStorage.setItem("gag-theme", dark ? "dark" : "light"); } catch (err) {}
  });

  /* dialogs + drawers: <button data-open="id">, <button data-close> inside, click on backdrop closes */
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open]");
    if (opener) { const d = document.getElementById(opener.dataset.open); if (d && d.showModal) d.showModal(); return; }
    const closer = e.target.closest("[data-close]");
    if (closer) { closer.closest("dialog")?.close(); return; }
    if (e.target.matches("dialog.dialog, dialog.drawer")) e.target.close();   // backdrop click
  });

  /* menus: native popover, placed under the button that opened it (flips up / left near the edges) */
  $$(".menu[popover]").forEach((m) => {
    m.addEventListener("toggle", (e) => {
      if (e.newState !== "open") return;
      const btn = document.querySelector(`[popovertarget="${m.id}"]`);
      if (!btn) return;
      const r = btn.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
      const left = Math.min(Math.max(8, r.left), innerWidth - mw - 8);
      const top = r.bottom + 8 + mh > innerHeight ? r.top - mh - 8 : r.bottom + 8;
      m.style.left = left + "px"; m.style.top = top + "px";
    });
  });
  addEventListener("scroll", () => $$(".menu[popover]").forEach((m) => { try { m.hidePopover(); } catch (e) {} }), { passive: true });

  /* toasts: DS.toast("Saved") or <button data-toast="Saved"> */
  let region;
  function toast(msg, { timeout = 4000 } = {}) {
    if (!region) { region = document.createElement("div"); region.className = "toast-region"; region.setAttribute("role", "status"); region.setAttribute("aria-live", "polite"); document.body.appendChild(region); }
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><span></span><button type="button">OK</button>';
    t.querySelector("span").textContent = msg;
    const close = () => { t.classList.add("leaving"); setTimeout(() => t.remove(), reduced ? 0 : 300); };
    t.querySelector("button").addEventListener("click", close);
    region.appendChild(t);
    setTimeout(close, timeout);
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-toast]"); if (b) toast(b.dataset.toast); });

  /* dismissible alerts */
  document.addEventListener("click", (e) => { const b = e.target.closest(".alert .close"); if (b) b.closest(".alert").remove(); });

  /* toggle buttons: chips, segmented buttons (single choice inside .segmented / [data-single]) */
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".chip[aria-pressed], .segmented > button");
    if (!b) return;
    const group = b.closest(".segmented, [data-single]");
    if (group) group.querySelectorAll("[aria-pressed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    else b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
  });

  /* tabs: role="tablist" > role="tab"[aria-controls] ; arrow keys move between tabs */
  $$('[role="tablist"]').forEach((list) => {
    const tabs = $$('[role="tab"]', list);
    const select = (tab, focus) => {
      tabs.forEach((t) => { const on = t === tab; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; const p = document.getElementById(t.getAttribute("aria-controls")); if (p) p.hidden = !on; });
      if (focus) tab.focus();
    };
    tabs.forEach((t) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const i = tabs.indexOf(t), n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (n) { e.preventDefault(); select(tabs[(i + n + tabs.length) % tabs.length], true); }
      });
    });
  });

  /* character counter: <textarea data-max="500" aria-describedby="x-count"> + <span class="counter" id="x-count"> */
  $$("[data-max]").forEach((el) => {
    const out = document.getElementById(el.getAttribute("aria-describedby")?.split(" ").find((id) => document.getElementById(id)?.classList.contains("counter")));
    if (!out) return;
    const max = +el.dataset.max;
    const upd = () => { const n = el.value.length; out.textContent = `${n} / ${max}`; out.classList.toggle("over", n > max); el.setAttribute("aria-invalid", String(n > max)); };
    el.addEventListener("input", upd); upd();
  });

  /* range: paints the filled part (--p) and mirrors the value into [data-range-out] */
  $$(".range").forEach((r) => {
    const out = r.id && document.querySelector(`[data-range-out="${r.id}"]`);
    const upd = () => { const p = ((r.value - r.min) / (r.max - r.min)) * 100; r.style.setProperty("--p", p + "%"); if (out) out.textContent = r.value; };
    r.addEventListener("input", upd); upd();
  });

  /* dropzone: lists chosen files; drag-over highlight */
  $$(".dropzone").forEach((z) => {
    const input = z.querySelector('input[type="file"]');
    const list = document.getElementById(z.dataset.list);
    const show = (files) => { if (!list) return; list.innerHTML = ""; [...files].forEach((f) => { const li = document.createElement("li"); li.innerHTML = "<span></span><small></small>"; li.querySelector("span").textContent = f.name; li.querySelector("small").textContent = Math.max(1, Math.round(f.size / 1024)) + " KB"; list.appendChild(li); }); };
    input?.addEventListener("change", () => show(input.files));
    ["dragenter", "dragover"].forEach((ev) => z.addEventListener(ev, (e) => { e.preventDefault(); z.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((ev) => z.addEventListener(ev, (e) => { e.preventDefault(); z.classList.remove("is-over"); }));
    z.addEventListener("drop", (e) => { if (input && e.dataTransfer?.files.length) { input.files = e.dataTransfer.files; show(input.files); } });
  });

  /* countdown: <div class="countdown" data-countdown="2027-03-12T18:00:00-05:00"> with 4 <b data-unit="d|h|m|s"> */
  $$("[data-countdown]").forEach((c) => {
    const end = new Date(c.dataset.countdown).getTime();
    const tick = () => {
      let s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const v = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
      $$("[data-unit]", c).forEach((b) => { b.textContent = String(v[b.dataset.unit]).padStart(2, "0"); });
    };
    tick(); if (!reduced) setInterval(tick, 1000); else setInterval(tick, 60000);
  });

  /* sub-nav scroll spy: <nav class="subnav"> links to #ids on the page */
  $$(".subnav").forEach((nav) => {
    const links = $$('a[href^="#"]', nav);
    const map = new Map(links.map((a) => [document.querySelector(a.getAttribute("href")), a]).filter(([s]) => s));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { links.forEach((a) => a.removeAttribute("aria-current")); map.get(en.target)?.setAttribute("aria-current", "true"); } });
    }, { rootMargin: "-30% 0px -60% 0px" });
    map.forEach((_, s) => io.observe(s));
  });

  /* scroll reveals: [data-reveal="up|left|right"] */
  if (!reduced && "IntersectionObserver" in window) {
    root.classList.add("ds-reveal");
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.15 });
    $$("[data-reveal]").forEach((el) => io.observe(el));
  }

  window.DS = { toast, applyTheme };
})();
