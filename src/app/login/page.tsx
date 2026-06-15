"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error || "Could not unlock app.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not unlock app.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="loginPage">
      <div className="loginCard">
        <p className="loginEyebrow">Private Workspace</p>
        <h1>Enter app password</h1>
        <p className="helper" style={{ marginTop: ".55rem" }}>
          This lock is for your personal app access. Shared pitch pages can stay separate.
        </p>
        <form onSubmit={onSubmit} className="loginForm">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="App password"
            autoFocus
          />
          <button className="button primary" type="submit" disabled={submitting}>
            {submitting ? "Unlocking..." : "Unlock App"}
          </button>
        </form>
        {error ? <p className="helper" style={{ color: "#8a3d3d", marginTop: ".7rem" }}>{error}</p> : null}
      </div>
    </div>
  );
}
