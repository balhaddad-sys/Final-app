/* monitor.js — MedWard Pro System Monitor (drop-in)
   Purpose: capture errors, network timing, perf signals, and app-emitted events.
*/
(() => {
  "use strict";

  // ---------- Helpers ----------
  const nowISO = () => new Date().toISOString();
  const uid = () => Math.random().toString(16).slice(2) + "-" + Math.random().toString(16).slice(2);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const safeJson = (x) => {
    try { return JSON.stringify(x, null, 2); }
    catch { return JSON.stringify({ error: "unserializable" }, null, 2); }
  };
  const lsBytesApprox = () => {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || "";
        total += (k.length + v.length) * 2; // UTF-16 rough
      }
      return total;
    } catch { return null; }
  };

  // ---------- State ----------
  const sessionId = uid();
  const MAX = 2500;
  const events = [];
  let paused = false;

  const netStats = {
    count: 0,
    totalMs: 0,
    slow: 0,
    lastMs: null,
    slowThresholdMs: 1500
  };

  const perfStats = {
    longTasks: 0,
    lastLongTaskAt: null
  };

  const errStats = {
    count: 0,
    lastAt: null,
    lastMsg: null
  };

  // ---------- UI bindings (if monitor.html loaded) ----------
  const $ = (id) => document.getElementById(id);
  const ui = {
    log: $("log"),
    logMeta: $("logMeta"),
    healthDot: $("healthDot"),
    healthText: $("healthText"),
    sessionId: $("sessionId"),
    subtitle: $("subtitle"),
    snapshot: $("snapshot"),
    mini: $("mini"),

    filterLevel: $("filterLevel"),
    filterType: $("filterType"),
    search: $("search"),

    btnPause: $("btnPause"),
    btnClear: $("btnClear"),
    btnExport: $("btnExport"),
    btnCopy: $("btnCopy"),
    btnCopySession: $("btnCopySession"),

    netAvg: $("netAvg"),
    netSlow: $("netSlow"),
    errCount: $("errCount"),
    errLast: $("errLast"),
    longTasks: $("longTasks"),

    online: $("online"),
    netType: $("netType"),
    rtt: $("rtt"),
    mem: $("mem"),
    ls: $("ls"),
    build: $("build"),

    btnHeartbeat: $("btnHeartbeat"),
    btnFetchTest: $("btnFetchTest"),
    btnSyncTest: $("btnSyncTest"),
    btnSaveTest: $("btnSaveTest"),
    btnDeleteTest: $("btnDeleteTest"),
    btnThrow: $("btnThrow")
  };

  // ---------- Emit ----------
  function emit(type, level, message, meta = {}) {
    const ev = {
      t: nowISO(),
      type: String(type || "APP").toUpperCase(),
      level: String(level || "INFO").toUpperCase(),
      msg: String(message || ""),
      meta: meta && typeof meta === "object" ? meta : { value: meta },
      sessionId
    };

    events.push(ev);
    if (events.length > MAX) events.shift();

    // health tracking
    if (ev.level === "ERROR") {
      errStats.count++;
      errStats.lastAt = ev.t;
      errStats.lastMsg = ev.msg;
      setHealth("bad", "Error detected");
    } else if (ev.level === "WARN") {
      setHealth("warn", "Warning");
    }

    if (!paused) renderOne(ev);
    renderVitals();
    renderSnapshot(ev);
    return ev;
  }

  // ---------- Rendering ----------
  function tagClass(level){
    if (level === "ERROR") return "bad";
    if (level === "WARN") return "warn";
    if (level === "SUCCESS") return "good";
    return "";
  }

  function passesFilters(ev){
    const L = ui.filterLevel ? ui.filterLevel.value : "ALL";
    const T = ui.filterType ? ui.filterType.value : "ALL";
    const q = (ui.search ? ui.search.value : "").trim().toLowerCase();

    if (L !== "ALL" && ev.level !== L) return false;
    if (T !== "ALL" && ev.type !== T) return false;

    if (q) {
      const blob = (ev.msg + " " + ev.type + " " + ev.level + " " + safeJson(ev.meta)).toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }

  function renderOne(ev){
    if (!ui.log) return;
    if (!passesFilters(ev)) return;

    const div = document.createElement("div");
    div.className = "item";

    const top = document.createElement("div");
    top.className = "top";

    const tag1 = document.createElement("span");
    tag1.className = "tag " + tagClass(ev.level);
    tag1.textContent = ev.level;

    const tag2 = document.createElement("span");
    tag2.className = "tag";
    tag2.textContent = ev.type;

    const t = document.createElement("span");
    t.className = "t";
    t.textContent = ev.t;

    top.append(tag1, tag2, t);

    const msg = document.createElement("div");
    msg.className = "msg";
    msg.textContent = ev.msg;

    const kv = document.createElement("div");
    kv.className = "kv";

    // show a few high-value meta keys compactly
    const keys = Object.keys(ev.meta || {});
    const shown = keys.slice(0, 8);
    for (const k of shown) {
      const c = document.createElement("code");
      const v = ev.meta[k];
      const vStr = typeof v === "string" ? v : (typeof v === "number" ? String(v) : (Array.isArray(v) ? `arr(${v.length})` : (v && typeof v === "object" ? "obj" : String(v))));
      c.textContent = `${k}:${vStr}`;
      kv.appendChild(c);
    }

    div.append(top, msg);
    if (shown.length) div.append(kv);

    ui.log.appendChild(div);

    // autoscroll
    ui.log.scrollTop = ui.log.scrollHeight;

    if (ui.logMeta) ui.logMeta.textContent = `${events.length} events`;
  }

  function rerenderAll(){
    if (!ui.log) return;
    ui.log.innerHTML = "";
    for (const ev of events) renderOne(ev);
  }

  function setHealth(state, text){
    if (!ui.healthDot || !ui.healthText) return;
    ui.healthDot.className = "dot " + (state || "");
    ui.healthText.textContent = text || "OK";
  }

  function renderVitals(){
    // Network
    if (ui.netAvg) {
      const avg = netStats.count ? (netStats.totalMs / netStats.count) : null;
      ui.netAvg.textContent = avg ? Math.round(avg) : "—";
      ui.netSlow.textContent = String(netStats.slow || 0);
    }
    // Errors
    if (ui.errCount) {
      ui.errCount.textContent = String(errStats.count || 0);
      ui.errLast.textContent = errStats.lastAt ? `last: ${errStats.lastAt.split("T")[1].replace("Z","")}` : "last: —";
    }
    // Perf
    if (ui.longTasks) ui.longTasks.textContent = String(perfStats.longTasks || 0);

    // Connection info
    const online = navigator.onLine;
    if (ui.online) ui.online.textContent = online ? "true" : "false";

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (ui.netType) ui.netType.textContent = conn?.effectiveType || "n/a";
    if (ui.rtt) ui.rtt.textContent = conn ? `${conn.rtt || "?"}ms / ${conn.downlink || "?"}Mb` : "n/a";

    // Memory (Chrome)
    const mem = performance && performance.memory ? performance.memory : null;
    if (ui.mem) ui.mem.textContent = mem ? `${Math.round(mem.usedJSHeapSize/1024/1024)}MB` : "n/a";

    // LocalStorage
    const bytes = lsBytesApprox();
    if (ui.ls) ui.ls.textContent = bytes != null ? `${Math.round(bytes/1024)}KB` : "n/a";
  }

  function renderSnapshot(ev){
    if (!ui.snapshot) return;
    ui.snapshot.textContent = safeJson(ev || {});
  }

  // ---------- Global error capture ----------
  window.addEventListener("error", (e) => {
    // Resource load error vs JS error
    const isResource = e?.target && (e.target.src || e.target.href);
    if (isResource) {
      emit("APP", "ERROR", "Resource failed to load", {
        src: e.target.src || e.target.href,
        tag: e.target.tagName
      });
      return;
    }
    emit("APP", "ERROR", e.message || "Window error", {
      file: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error?.stack || null
    });
  }, true);

  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    emit("APP", "ERROR", "Unhandled promise rejection", {
      reason: (r && r.message) ? r.message : String(r),
      stack: r?.stack || null
    });
  });

  // ---------- Network instrumentation ----------
  function instrumentFetch(){
    if (!window.fetch) return;
    const orig = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const id = uid();
      const method = (init && init.method) ? String(init.method).toUpperCase() : "GET";
      const url = (typeof input === "string") ? input : (input && input.url ? input.url : "unknown");

      const t0 = performance.now();
      emit("NET","INFO","fetch:start", { id, method, url });

      try{
        const res = await orig(input, init);
        const ms = performance.now() - t0;

        netStats.count++; netStats.totalMs += ms; netStats.lastMs = ms;
        const slow = ms > netStats.slowThresholdMs;
        if (slow) netStats.slow++;

        emit("NET", slow ? "WARN" : "SUCCESS", "fetch:end", {
          id, method, url,
          status: res.status,
          ok: res.ok,
          ms: Math.round(ms)
        });

        return res;
      } catch(err){
        const ms = performance.now() - t0;
        netStats.count++; netStats.totalMs += ms; netStats.lastMs = ms;
        emit("NET","ERROR","fetch:fail", {
          id, method, url,
          ms: Math.round(ms),
          message: err?.message || String(err),
          stack: err?.stack || null
        });
        throw err;
      }
    };
  }

  function instrumentXHR(){
    const XHR = window.XMLHttpRequest;
    if (!XHR) return;

    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;

    XHR.prototype.open = function(method, url){
      this.__m = { id: uid(), method: String(method).toUpperCase(), url: String(url), t0: null };
      return origOpen.apply(this, arguments);
    };

    XHR.prototype.send = function(){
      const m = this.__m || { id: uid(), method: "GET", url: "unknown" };
      m.t0 = performance.now();
      emit("NET","INFO","xhr:start", { id:m.id, method:m.method, url:m.url });

      const onDone = () => {
        this.removeEventListener("loadend", onDone);
        const ms = performance.now() - m.t0;
        netStats.count++; netStats.totalMs += ms; netStats.lastMs = ms;
        const slow = ms > netStats.slowThresholdMs;
        if (slow) netStats.slow++;

        const status = this.status;
        const ok = status >= 200 && status < 400;

        emit("NET", ok ? (slow ? "WARN" : "SUCCESS") : "ERROR", "xhr:end", {
          id:m.id, method:m.method, url:m.url,
          status, ok,
          ms: Math.round(ms)
        });
      };

      this.addEventListener("loadend", onDone);
      return origSend.apply(this, arguments);
    };
  }

  // ---------- Performance signals ----------
  function instrumentLongTasks(){
    if (!("PerformanceObserver" in window)) return;
    try {
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          // longtask entry durations are ms
          if (e.duration > 200) {
            perfStats.longTasks++;
            perfStats.lastLongTaskAt = nowISO();
            emit("PERF","WARN","Long task detected", {
              ms: Math.round(e.duration),
              name: e.name || "longtask"
            });
          }
        }
      });
      obs.observe({ entryTypes: ["longtask"] });
    } catch {
      // ignore
    }
  }

  function instrumentNavTiming(){
    try {
      const nav = performance.getEntriesByType("navigation")[0];
      if (!nav) return;
      emit("PERF","INFO","Navigation timing", {
        dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
        tcp: Math.round(nav.connectEnd - nav.connectStart),
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        dom: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        load: Math.round(nav.loadEventEnd - nav.startTime)
      });
    } catch {}
  }

  // ---------- Health / heartbeat ----------
  let lastHeartbeatAt = null;
  function heartbeat(reason="manual"){
    lastHeartbeatAt = nowISO();
    const online = navigator.onLine;
    setHealth(online ? "good" : "warn", online ? "Online" : "Offline");
    emit("SYNC","INFO","heartbeat", { reason, online, at:lastHeartbeatAt });
  }

  // ---------- Test runner (hooks to your app) ----------
  async function runFetchTest(){
    const url = location.origin + location.pathname.replace(/\/[^/]*$/, "/") + "monitor.html";
    // A small self-fetch (same origin) to validate network instrumentation
    const id = uid();
    emit("TEST","INFO","Fetch test started", { id, url });
    try{
      const t0 = performance.now();
      const r = await fetch(url, { cache: "no-store" });
      const ms = performance.now() - t0;
      emit("TEST", r.ok ? "SUCCESS" : "ERROR", "Fetch test complete", { id, status:r.status, ms:Math.round(ms) });
    } catch (e){
      emit("TEST","ERROR","Fetch test failed", { id, message:e?.message || String(e) });
    }
  }

  // These call your real app functions if you expose them (recommended).
  async function runSyncTest(){
    const id = uid();
    emit("TEST","INFO","Sync test started", { id });
    try{
      if (window.MedWard?.syncNow) {
        const t0 = performance.now();
        await window.MedWard.syncNow({ correlationId: id, source: "monitor" });
        emit("TEST","SUCCESS","Sync test completed", { id, ms: Math.round(performance.now()-t0) });
      } else {
        emit("TEST","WARN","No window.MedWard.syncNow found (expose it to enable real sync tests)", { id });
      }
    } catch (e){
      emit("TEST","ERROR","Sync test failed", { id, message:e?.message || String(e), stack:e?.stack || null });
    }
  }

  async function runSaveTest(){
    const id = uid();
    emit("TEST","INFO","Save test started", { id });
    try{
      if (window.MedWard?.savePatient) {
        const dummy = {
          name: "TEST PATIENT " + id.slice(0,6),
          location: "MONITOR",
          assignedDoctor: "SYSTEM",
          status: "TEST",
          diagnosis: "Instrumentation verification",
          _monitor: true
        };
        const t0 = performance.now();
        await window.MedWard.savePatient(dummy, { correlationId: id, source: "monitor" });
        emit("TEST","SUCCESS","Save test completed", { id, ms: Math.round(performance.now()-t0) });
      } else {
        emit("TEST","WARN","No window.MedWard.savePatient found (expose it to enable real save tests)", { id });
      }
    } catch (e){
      emit("TEST","ERROR","Save test failed", { id, message:e?.message || String(e), stack:e?.stack || null });
    }
  }

  async function runDeleteTest(){
    const id = uid();
    emit("TEST","INFO","Delete test started", { id });
    try{
      if (window.MedWard?.deleteTestPatient) {
        const t0 = performance.now();
        await window.MedWard.deleteTestPatient({ correlationId: id, source: "monitor" });
        emit("TEST","SUCCESS","Delete test completed", { id, ms: Math.round(performance.now()-t0) });
      } else {
        emit("TEST","WARN","No window.MedWard.deleteTestPatient found", { id });
      }
    } catch (e){
      emit("TEST","ERROR","Delete test failed", { id, message:e?.message || String(e), stack:e?.stack || null });
    }
  }

  // ---------- Controls ----------
  function bindUI(){
    if (ui.sessionId) ui.sessionId.textContent = sessionId;

    const rerender = () => rerenderAll();
    ui.filterLevel?.addEventListener("change", rerender);
    ui.filterType?.addEventListener("change", rerender);
    ui.search?.addEventListener("input", () => {
      // small debounce
      clearTimeout(ui.search.__t);
      ui.search.__t = setTimeout(rerender, 140);
    });

    ui.btnPause?.addEventListener("click", () => {
      paused = !paused;
      ui.btnPause.textContent = paused ? "Resume" : "Pause";
      if (!paused) rerenderAll();
      emit("APP","INFO", paused ? "Stream paused" : "Stream resumed");
    });

    ui.btnClear?.addEventListener("click", () => {
      events.length = 0;
      if (ui.log) ui.log.innerHTML = "";
      renderVitals();
      if (ui.logMeta) ui.logMeta.textContent = "0 events";
      emit("APP","INFO","Cleared logs");
    });

    ui.btnExport?.addEventListener("click", () => {
      const blob = new Blob([safeJson({ sessionId, exportedAt: nowISO(), events })], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `medward-monitor-${sessionId}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      emit("APP","SUCCESS","Exported logs");
    });

    ui.btnCopy?.addEventListener("click", async () => {
      const text = safeJson({ sessionId, copiedAt: nowISO(), events });
      try{
        await navigator.clipboard.writeText(text);
        emit("APP","SUCCESS","Copied logs to clipboard");
      } catch {
        emit("APP","WARN","Clipboard not available");
      }
    });

    ui.btnCopySession?.addEventListener("click", async () => {
      try{
        await navigator.clipboard.writeText(sessionId);
        emit("APP","SUCCESS","Copied session ID");
      } catch {
        emit("APP","WARN","Clipboard not available");
      }
    });

    ui.btnHeartbeat?.addEventListener("click", () => heartbeat("button"));
    ui.btnFetchTest?.addEventListener("click", runFetchTest);
    ui.btnSyncTest?.addEventListener("click", runSyncTest);
    ui.btnSaveTest?.addEventListener("click", runSaveTest);
    ui.btnDeleteTest?.addEventListener("click", runDeleteTest);

    ui.btnThrow?.addEventListener("click", () => {
      emit("TEST","WARN","Simulating thrown error");
      throw new Error("Simulated error from monitor");
    });
  }

  // ---------- Startup ----------
  function boot(){
    instrumentFetch();
    instrumentXHR();
    instrumentLongTasks();
    instrumentNavTiming();

    setHealth("info", "Running");
    bindUI();
    renderVitals();

    // Online/offline signals
    window.addEventListener("online", () => { setHealth("good","Online"); emit("NET","SUCCESS","Went online"); });
    window.addEventListener("offline", () => { setHealth("warn","Offline"); emit("NET","WARN","Went offline"); });

    // Heartbeat every 15s
    setInterval(() => heartbeat("timer"), 15000);
    heartbeat("boot");

    emit("SEC","INFO","Session started", {
      userAgent: navigator.userAgent,
      lang: navigator.language,
      platform: navigator.platform
    });

    // Expose global API for your app to use
    window.monitor = {
      sessionId,
      emit,
      heartbeat,
      getEvents: () => events.slice(),
      setSlowThreshold: (ms) => { netStats.slowThresholdMs = clamp(Number(ms)||1500, 200, 20000); emit("APP","INFO","Slow threshold updated", { ms: netStats.slowThresholdMs }); }
    };
  }

  boot();
})();
