import { useState, useEffect } from "react";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SESSION = {
  sessionHostName: "AVD-POOL-WE-007.contoso.local",
  location:        "West Europe",
  lastHeartbeat:   "2 min ago",
  status:          "Unavailable",
  userLoggedIn:    "james.thornton@contoso.com",
  hostPool:        "Personal-Desktop-WE",
  os:              "Windows 11 22H2",
  assigned:        "Yes",
};

const INITIAL_CHECKS = {
  machineName: { label: "Machine Name",  idle: "AVD-POOL-WE-007", scanning: "AVD-POOL-WE-007", fail: "AVD-POOL-WE-007", fixed: "AVD-POOL-WE-007" },
  powerState:  { label: "Power State",   idle: "—",               scanning: "Querying…",        fail: "Stopped",         fixed: "Running"          },
  healthState: { label: "Health State",  idle: "—",               scanning: "Querying…",        fail: "Unhealthy",       fixed: "Healthy"          },
  userState:   { label: "User State",    idle: "—",               scanning: "Querying…",        fail: "Disconnected",    fixed: "Available"        },
  rtt:         { label: "Round-Trip Time", idle: "—",             scanning: "Measuring…",       fail: "Timeout",         fixed: "18 ms"            },
  drainMode:   { label: "Drain Mode",    idle: "—",               scanning: "Querying…",        fail: "Enabled",         fixed: "Disabled"         },
};

const STATUS_COLOR = { idle: "#4b5563", scanning: "#60a5fa", fail: "#f87171", fixed: "#34d399", pass: "#34d399" };

const Dot = ({ color, pulse }) => (
  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0, animation: pulse ? "pulse 1.5s infinite" : "none" }} />
);

const Spinner = ({ size = 14, color = "#60a5fa" }) => (
  <span style={{ display: "inline-block", width: size, height: size, border: `2px solid ${color}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite", flexShrink: 0 }} />
);

export default function App() {
  const [phase, setPhase]                     = useState("ready");
  const [outcome, setOutcome]                 = useState(null);
  const [machineStarting, setMachineStarting] = useState(false);
  const [machineOnline, setMachineOnline]     = useState(false);
  const [progress, setProgress]               = useState(0);
  const [sessionStatus, setSessionStatus]     = useState(SESSION.status);
  const [incidentRef]                         = useState(() => "INC-" + Math.floor(100000 + Math.random() * 900000));
  const [viewportWidth, setViewportWidth]     = useState(typeof window !== "undefined" ? window.innerWidth : 1280);

  const initFields = () => Object.fromEntries(Object.keys(INITIAL_CHECKS).map(k => [k, "idle"]));
  const [fieldStates, setFieldStates] = useState(initFields());
  const setField = (key, st) => setFieldStates(p => ({ ...p, [key]: st }));

  const doneFields = Object.values(fieldStates).filter(s => ["fail","fixed","pass"].includes(s)).length;

  useEffect(() => {
    if (phase === "scanning") setProgress(Math.round((doneFields / Object.keys(INITIAL_CHECKS).length) * 100));
    if (phase === "ready")    setProgress(0);
    if (phase === "done")     setProgress(100);
  }, [doneFields, phase]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function resetAll() {
    setPhase("ready"); setOutcome(null);
    setMachineStarting(false); setMachineOnline(false);
    setProgress(0); setFieldStates(initFields());
    setSessionStatus(SESSION.status);
  }

  async function runDiagnostics(fixMode) {
    setPhase("scanning"); setOutcome(null);
    setFieldStates(initFields()); setMachineStarting(false); setMachineOnline(false);

    for (const key of Object.keys(INITIAL_CHECKS)) {
      setField(key, "scanning");
      await sleep(550 + Math.random() * 350);
      setField(key, key === "machineName" ? "pass" : "fail");
      await sleep(80);
    }

    if (!fixMode) { setOutcome("escalated"); setPhase("done"); return; }

    await sleep(400);

    setField("powerState", "scanning"); setField("healthState", "scanning");
    setMachineStarting(true);
    await sleep(2400);
    setMachineOnline(true);
    setField("powerState", "fixed"); setField("healthState", "fixed");
    setSessionStatus("Available");
    await sleep(300);

    for (const key of ["userState", "rtt", "drainMode"]) {
      setField(key, "scanning");
      await sleep(700 + Math.random() * 400);
      setField(key, "fixed");
      await sleep(150);
    }

    setOutcome("resolved"); setPhase("done");
  }

  const dotColor  = machineOnline ? "#34d399" : machineStarting ? "#fbbf24" : "#f87171";
  const isCompact = viewportWidth < 1200;
  const isStacked = viewportWidth < 980;

  const outcomeMap = {
    resolved:  { border: "#059669", bg: "rgba(5,150,105,.08)",  text: "#34d399", icon: "✓", title: "Desktop recovered — relaunch your session",         sub: "All issues automatically remediated. Session host is online and ready." },
    escalated: { border: "#1d4ed8", bg: "rgba(29,78,216,.08)",  text: "#60a5fa", icon: "↑", title: `Incident ${incidentRef} raised — IT team notified`, sub: "Priority P2. Est. response within 1 hour. Full diagnostics attached to ticket." },
  };

  function fieldDisplay(key) {
    const s = fieldStates[key]; const def = INITIAL_CHECKS[key];
    return { value: def[s] ?? def.idle, color: STATUS_COLOR[s] ?? STATUS_COLOR.idle, state: s };
  }

  function actionTag(state) {
    if (state === "fixed")    return { label: "Fixed",    color: "#34d399", bg: "rgba(52,211,153,.12)" };
    if (state === "scanning") return { label: "Working…", color: "#fbbf24", bg: "rgba(251,191,36,.12)" };
    if (state === "fail")     return { label: "Auto-Fix", color: "#60a5fa", bg: "rgba(96,165,250,.12)" };
    return                           { label: "Auto-Fix", color: "#1e3a5f", bg: "transparent" };
  }

  const InfoRow = ({ label, value, valueColor }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #0f172a" }}>
      <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: valueColor || "#94a3b8", textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ width: "min(1024px, 100vw)", height: "min(760px, 100vh)", margin: "0 auto", overflow: "hidden", background: "#070c18", display: "flex", flexDirection: "column", fontFamily: "'DM Mono','Fira Code',monospace", color: "#e2e8f0" }}>

      {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{ background: "#0d1424", borderBottom: "1px solid #1e3a5f", height: 56, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: "100%", minWidth: 0, display: "flex", alignItems: "center", gap: 16, padding: isCompact ? "0 16px" : "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Dot color={dotColor} pulse={phase === "scanning"} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: "#f1f5f9" }}>AVD Recovery Console</span>
        </div>
        {!isCompact && <div style={{ width: 1, height: 20, background: "#1e3a5f" }} />}
        {!isCompact && <span style={{ fontSize: 11, color: "#374151" }}>Personal Desktop Remediation</span>}
        <div style={{ flex: 1 }} />
        {/* progress in nav */}
        {phase === "scanning" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 140, height: 3, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg,#3b82f6,#06b6d4)", width: `${progress}%`, borderRadius: 99, transition: "width .35s ease" }} />
            </div>
            <span style={{ fontSize: 10, color: "#3b82f6" }}>{progress}%</span>
            <Spinner size={12} />
          </div>
        )}
        {phase === "done" && outcome && (
          <span style={{ fontSize: 10, color: outcomeMap[outcome]?.text, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {outcome === "resolved" ? "✓ Resolved" : `↑ ${incidentRef}`}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0f172a", borderRadius: 8, padding: "6px 14px" }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#60a5fa", fontWeight: 700 }}>JT</div>
          <span style={{ fontSize: 11, color: "#4b5563" }}>james.thornton</span>
        </div>
        {!isCompact && <span style={{ fontSize: 11, color: "#1e293b" }}>Contoso IT</span>}
        </div>
      </nav>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <div style={{ width: "100%", minWidth: 0, minHeight: 0, display: "flex", flexDirection: isStacked ? "column" : "row" }}>

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <aside style={{ width: isStacked ? "100%" : 280, background: "#0d1424", borderRight: isStacked ? "none" : "1px solid #0f172a", borderBottom: isStacked ? "1px solid #0f172a" : "none", padding: isCompact ? "20px 16px" : "28px 20px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>

          {/* Session status pill */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#374151" }}>Session Status</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#070c18", borderRadius: 20, padding: "4px 12px" }}>
              <Dot color={sessionStatus === "Available" ? "#34d399" : "#f87171"} />
              <span style={{ fontSize: 10, fontWeight: 700, color: sessionStatus === "Available" ? "#34d399" : "#f87171", transition: "color .4s" }}>{sessionStatus}</span>
            </div>
          </div>

          {/* Machine name hero */}
          <div style={{ background: "#070c18", borderRadius: 10, padding: "16px", border: "1px solid #1e3a5f" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#3b82f6", textTransform: "uppercase", marginBottom: 8 }}>Personal Desktop</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.01em", marginBottom: 4, wordBreak: "break-all" }}>AVD-POOL-WE-007</div>
            <div style={{ fontSize: 10, color: "#374151" }}>{SESSION.hostPool}</div>
          </div>

          {/* Session details */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#1e3a5f", marginBottom: 10 }}>Session Details</div>
            <InfoRow label="Host FQDN"      value={SESSION.sessionHostName} />
            <InfoRow label="Location"       value={SESSION.location} />
            <InfoRow label="OS"             value={SESSION.os} />
            <InfoRow label="Last Heartbeat" value={SESSION.lastHeartbeat} valueColor={phase === "done" && machineOnline ? "#34d399" : "#f87171"} />
            <InfoRow label="User"           value={SESSION.userLoggedIn} />
            <InfoRow label="Assigned"       value={SESSION.assigned} valueColor="#34d399" />
          </div>

          {/* Machine start indicator */}
          {machineStarting && (
            <div style={{ background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>&#9889;</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.06em" }}>
                  {machineOnline ? "HOST ONLINE" : "STARTING HOST"}
                </span>
                {!machineOnline
                  ? <Spinner size={10} color="#fbbf24" />
                  : <Dot color="#34d399" />
                }
              </div>
              <div style={{ fontSize: 10, color: "#4b5563", lineHeight: 1.5 }}>
                {machineOnline
                  ? "Session host ready to accept connections."
                  : "Azure Automation runbook triggered. VM is powering on…"}
              </div>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Runbook badge */}
          <div style={{ borderTop: "1px solid #0f172a", paddingTop: 16, fontSize: 9, color: "#1e293b", letterSpacing: "0.06em", lineHeight: 1.8 }}>
            <div>Engine: AVD Recovery v1.0</div>
            <div>Runbook: Start-AVDSessionHost</div>
            <div>Log: Log Analytics Workspace</div>
          </div>
        </aside>

        {/* ── RIGHT MAIN PANEL ─────────────────────────────────────────────── */}
        <main style={{ flex: 1, padding: isCompact ? "20px 16px" : "28px 32px", display: "flex", flexDirection: "column", gap: 20, minWidth: 0, minHeight: 0, overflowY: "auto" }}>

          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>Diagnostic Checks</div>
              <div style={{ fontSize: 11, color: "#374151" }}>Run diagnostics to inspect host state and auto-remediate detected issues</div>
            </div>
            {phase !== "ready" && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#374151", marginBottom: 4 }}>Scan Progress</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6" }}>{progress}%</div>
              </div>
            )}
          </div>

          {/* Progress bar — full width */}
          <div style={{ height: 3, background: "#0f172a", borderRadius: 99, overflow: "hidden", opacity: phase === "ready" ? 0 : 1, transition: "opacity .3s" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg,#3b82f6,#06b6d4)", width: `${progress}%`, borderRadius: 99, transition: "width .35s ease" }} />
          </div>

          {/* Checks table */}
          <div style={{ background: "#0d1424", border: "1px solid #0f172a", borderRadius: 12, overflow: "hidden", flex: 1 }}>
            {/* thead */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) minmax(120px,1fr) minmax(92px,120px)", padding: isCompact ? "10px 14px" : "10px 24px", borderBottom: "1px solid #0f172a", background: "#070c18" }}>
              {[["Check", "left"], ["Value", "left"], ["Action", "right"]].map(([h, a]) => (
                <div key={h} style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#1e3a5f", textAlign: a }}>{h}</div>
              ))}
            </div>

            {/* rows */}
            {Object.entries(INITIAL_CHECKS).map(([key, def], i, arr) => {
              const { value, color, state } = fieldDisplay(key);
              const tag = actionTag(state);
              const rowBg =
                state === "fail"    ? "rgba(248,113,113,.04)" :
                state === "fixed"   ? "rgba(52,211,153,.03)"  :
                state === "scanning"? "rgba(96,165,250,.03)"  : "transparent";

              return (
                <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) minmax(120px,1fr) minmax(92px,120px)", alignItems: "center", padding: isCompact ? "13px 14px" : "15px 24px", borderBottom: i < arr.length - 1 ? "1px solid #0a1020" : "none", background: rowBg, transition: "background .4s" }}>
                  {/* label */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 3, height: 28, borderRadius: 2, background: state === "fail" ? "#f87171" : state === "fixed" ? "#34d399" : state === "scanning" ? "#60a5fa" : "#1e293b", transition: "background .4s", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{def.label}</span>
                  </div>

                  {/* value */}
                  <div style={{ fontSize: 12, fontWeight: 600, color, transition: "color .4s" }}>
                    {state === "scanning"
                      ? <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          {[0,1,2].map(n => <span key={n} style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#60a5fa", animation: `bounce .9s ${n*.2}s infinite` }} />)}
                        </span>
                      : value
                    }
                  </div>

                  {/* action */}
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: tag.color, background: tag.bg, padding: "4px 10px", borderRadius: 6, transition: "all .4s", display: "inline-block" }}>
                      {tag.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Outcome banner */}
          {outcome && (() => {
            const oc = outcomeMap[outcome];
            return (
              <div style={{ background: oc.bg, border: `1px solid ${oc.border}55`, borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${oc.border}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: oc.text, flexShrink: 0 }}>
                  {oc.icon}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: oc.text, marginBottom: 3 }}>{oc.title}</div>
                  <div style={{ fontSize: 11, color: "#4b5563" }}>{oc.sub}</div>
                </div>
              </div>
            );
          })()}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {phase === "ready" && (
              <>
                <button onClick={() => runDiagnostics(true)}
                  style={{ flex: "1 1 220px", padding: "13px 24px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", background: "linear-gradient(135deg,#1d4ed8,#0369a1)", color: "#fff", boxShadow: "0 0 24px rgba(59,130,246,.25)" }}>
                  Run Diagnostics &amp; Auto-Fix
                </button>
                <button onClick={() => runDiagnostics(false)}
                  style={{ padding: "13px 22px", borderRadius: 9, border: "1px solid #1e3a5f", cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: "transparent", color: "#4b5563" }}>
                  Raise Incident Only
                </button>
              </>
            )}

            {phase === "scanning" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderRadius: 9, background: "#0d1424", border: "1px solid #1e3a5f" }}>
                <Spinner size={14} />
                <span style={{ fontSize: 12, color: "#3b82f6" }}>Running diagnostics…</span>
              </div>
            )}

            {phase === "done" && (
              <>
                {outcome === "resolved" && (
                  <button style={{ flex: "1 1 220px", padding: "13px 24px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", background: "linear-gradient(135deg,#065f46,#1e3a8a)", color: "#fff" }}>
                    Relaunch Desktop
                  </button>
                )}
                <button onClick={resetAll}
                  style={{ padding: "13px 22px", borderRadius: 9, border: "1px solid #1e3a5f", cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: "transparent", color: "#4b5563" }}>
                  Run Again
                </button>
                {outcome === "escalated" && (
                  <button onClick={() => runDiagnostics(false)}
                    style={{ padding: "13px 22px", borderRadius: 9, border: "1px solid #1e3a5f", cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: "transparent", color: "#4b5563" }}>
                    Raise Incident
                  </button>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      </div>
      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ background: "#0d1424", borderTop: "1px solid #0f172a", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", padding: isCompact ? "10px 16px" : "10px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "#1e293b", letterSpacing: "0.08em" }}>AVD Recovery Engine v1.0 · Contoso IT Operations</span>
        {!isCompact && <span style={{ fontSize: 9, color: "#1e293b", letterSpacing: "0.08em" }}>All actions logged to Log Analytics Workspace</span>}
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { transition: opacity .15s; }
        button:hover { opacity: .82; cursor: pointer; }
      `}</style>
    </div>
  );
}
