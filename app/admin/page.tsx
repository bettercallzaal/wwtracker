"use client";

import { useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { PUBLICATIONS } from "@/lib/publications";

// The newsletter composer. Publishes to Paragraph, which is what the public
// blog section reads back - so a post written here shows up on the site by the
// same path as one written on paragraph.com. There is no second copy.

const box: React.CSSProperties = {
  width: "100%", background: C.void, color: C.text,
  border: `1px solid ${C.grid}`, borderRadius: 8,
  padding: "10px 12px", fontSize: 14, fontFamily: "inherit",
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [blast, setBlast] = useState(false);
  const [confirmBlast, setConfirmBlast] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [angle, setAngle] = useState("");
  const [facts, setFacts] = useState<string[] | null>(null);
  const [unsourced, setUnsourced] = useState<string[]>([]);
  const [lastPostId, setLastPostId] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const pubSlug = PUBLICATIONS[0].slug;

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const d = await r.json();
    setBusy(false);
    // Clear the password from state either way; there is no reason to keep it.
    setPassword("");
    if (d.ok) { setAuthed(true); setMsg(null); }
    else setMsg({ ok: false, text: d.error ?? "Login failed" });
  }

  async function pullFacts() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/facts");
    const d = await r.json();
    setBusy(false);
    if (d.ok) { setFacts(d.facts); setMsg(null); }
    else setMsg({ ok: false, text: d.error ?? "Could not fetch the numbers" });
  }

  async function draftWithAI() {
    setBusy(true); setMsg(null); setUnsourced([]);
    const r = await fetch("/api/admin/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ angle, publication: pubSlug }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.ok) {
      setMarkdown(d.draft);
      setFacts(d.facts);
      setUnsourced(d.unsourced ?? []);
      if (!title) setTitle("WaveWarZ update");
      setMsg({ ok: true, text: "Draft written from live figures. Read it before publishing." });
    } else {
      setMsg({ ok: false, text: d.error ?? "Generation failed" });
    }
  }

  async function sendTest() {
    if (!lastPostId || !testTo) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testEmailFor: lastPostId, email: testTo }),
    });
    const d = await r.json();
    setBusy(false);
    setMsg(d.ok ? { ok: true, text: `Test sent to ${testTo}.` }
                : { ok: false, text: d.error ?? "Test send failed" });
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, subtitle, markdown, sendNewsletter: blast, publication: pubSlug }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.ok) {
      setLastPostId(d.result?.id ?? null);
      setMsg({ ok: true, text: blast
        ? "Published and sent to subscribers."
        : "Published. It will appear in the newsletter section within 30 minutes." });
      setTitle(""); setSubtitle(""); setMarkdown(""); setBlast(false); setConfirmBlast(""); setUnsourced([]);
    } else {
      setMsg({ ok: false, text: d.error ?? "Publish failed" });
    }
  }

  // A blast is irreversible: you cannot unsend an email. So it needs a
  // deliberate second action, not just a ticked box next to the submit button.
  const blastReady = !blast || confirmBlast.trim().toUpperCase() === "SEND";
  const canPublish = title.trim() !== "" && markdown.trim() !== "" && blastReady && !busy;

  if (!authed) {
    return (
      <main style={{ maxWidth: 380, margin: "80px auto", padding: 20, fontFamily: "inherit" }}>
        <h1 style={{ fontFamily: C.disp, color: C.text, fontSize: 24, margin: "0 0 4px" }}>
          Newsletter composer
        </h1>
        <p style={{ ...metaLabel, color: C.dim, marginBottom: 20 }}>WaveWarZ</p>
        <form onSubmit={login}>
          <input
            type="password" value={password} autoFocus
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" style={box} aria-label="Admin password"
          />
          <button type="submit" disabled={busy || !password} style={{
            ...box, marginTop: 10, cursor: "pointer",
            background: C.accentDim, color: C.accent, borderColor: C.accent,
          }}>
            {busy ? "Checking..." : "Enter"}
          </button>
        </form>
        {msg && <p style={{ color: C.danger, fontSize: 13, marginTop: 12 }}>{msg.text}</p>}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 20, fontFamily: "inherit" }}>
      <h1 style={{ fontFamily: C.disp, color: C.text, fontSize: 26, margin: "0 0 4px" }}>
        Newsletter composer
      </h1>
      <p style={{ ...metaLabel, color: C.dim, marginBottom: 22 }}>
        Publishes to paragraph.com/@wavewarz
      </p>

      {/* Draft from the site's own live numbers. The model never sources a
          figure itself - it is handed these and writes prose around them. */}
      <div style={{ border: `1px solid ${C.grid}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
        <div style={{ ...metaLabel, color: C.dim, marginBottom: 10 }}>Start from tonight's numbers</div>
        <input value={angle} onChange={(e) => setAngle(e.target.value)}
          placeholder="Angle, optional. e.g. focus on the artists who won this week"
          style={{ ...box, marginBottom: 10 }} aria-label="Angle" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={pullFacts} disabled={busy} style={{
            ...box, width: "auto", cursor: "pointer", padding: "8px 12px",
            fontSize: 12.5, fontFamily: C.mono, color: C.blue, borderColor: C.grid,
          }}>SHOW THE NUMBERS</button>
          <button type="button" onClick={draftWithAI} disabled={busy} style={{
            ...box, width: "auto", cursor: "pointer", padding: "8px 12px",
            fontSize: 12.5, fontFamily: C.mono,
            color: C.accent, borderColor: C.accent, background: C.accentDim,
          }}>{busy ? "WORKING..." : "DRAFT WITH AI"}</button>
        </div>

        {facts && (
          <pre style={{
            marginTop: 12, marginBottom: 0, padding: 10, background: C.void,
            border: `1px solid ${C.grid}`, borderRadius: 6, color: C.dim,
            fontSize: 12, fontFamily: C.mono, whiteSpace: "pre-wrap", overflowX: "auto",
          }}>{facts.join("\n")}</pre>
        )}

        {unsourced.length > 0 && (
          <div style={{ marginTop: 12, border: `1px solid ${C.danger}`, borderRadius: 6, padding: 10 }}>
            <p style={{ color: C.danger, fontSize: 13, margin: "0 0 4px", fontFamily: C.mono }}>
              CHECK THESE FIGURES
            </p>
            <p style={{ color: C.text, fontSize: 13, margin: 0 }}>
              The draft states {unsourced.join(", ")}, which is not in the fact sheet above.
              Verify or remove before publishing.
            </p>
          </div>
        )}
      </div>

      <form onSubmit={publish} style={{ display: "grid", gap: 12 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Title" style={box} aria-label="Title" />
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Subtitle (optional)" style={box} aria-label="Subtitle" />
        <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)}
          placeholder="Write in markdown..." rows={18}
          style={{ ...box, resize: "vertical", lineHeight: 1.6 }} aria-label="Post body" />

        <label style={{ display: "flex", gap: 8, alignItems: "center", color: C.text, fontSize: 13.5 }}>
          <input type="checkbox" checked={blast} onChange={(e) => { setBlast(e.target.checked); setConfirmBlast(""); }} />
          Email this to every subscriber
        </label>

        {blast && (
          <div style={{ border: `1px solid ${C.danger}`, borderRadius: 8, padding: 12 }}>
            <p style={{ color: C.text, fontSize: 13.5, margin: "0 0 8px" }}>
              This sends to the whole list and cannot be undone. Type SEND to confirm.
            </p>
            <input value={confirmBlast} onChange={(e) => setConfirmBlast(e.target.value)}
              placeholder="SEND" style={box} aria-label="Type SEND to confirm" />
          </div>
        )}

        <button type="submit" disabled={!canPublish} style={{
          ...box, cursor: canPublish ? "pointer" : "not-allowed",
          background: canPublish ? C.accentDim : "transparent",
          color: canPublish ? C.accent : C.dim,
          borderColor: canPublish ? C.accent : C.grid,
        }}>
          {busy ? "Publishing..." : blast ? "Publish and send" : "Publish"}
        </button>
      </form>

      {msg && (
        <p style={{ color: msg.ok ? C.accent : C.danger, fontSize: 13.5, marginTop: 14 }}>
          {msg.text}
        </p>
      )}

      {/* Only after something is published - a test email needs a real post. */}
      {lastPostId && (
        <div style={{ marginTop: 20, border: `1px solid ${C.grid}`, borderRadius: 10, padding: 14 }}>
          <div style={{ ...metaLabel, color: C.dim, marginBottom: 8 }}>
            Send yourself a test before blasting the list
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={testTo} onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com" style={box} aria-label="Test email address" />
            <button type="button" onClick={sendTest} disabled={busy || !testTo} style={{
              ...box, width: "auto", cursor: "pointer", padding: "8px 14px",
              fontSize: 12.5, fontFamily: C.mono, color: C.blue, borderColor: C.grid,
            }}>SEND TEST</button>
          </div>
        </div>
      )}
    </main>
  );
}
