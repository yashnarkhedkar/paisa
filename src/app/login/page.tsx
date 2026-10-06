"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const r = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (res.ok) r.push("/");
    else setErr("Wrong password");
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="h1">Paisa</h1>
          <p className="muted">Your money, one place.</p>
        </div>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          autoFocus
          className="input"
        />
        {err && <p className="text-sm text-neg">{err}</p>}
        <button disabled={busy || !pw} className="btn-primary w-full">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
