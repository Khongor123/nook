"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    const supabase = createClient();
    const result = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (result.error) {
      setError("Could not sign in. Check your email and password.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6 py-10">
      <div>
        <p className="text-sm">Nook</p>
        <h1 className="text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm">
          Use the private presenter account you created in Supabase.
        </p>
      </div>
      <form onSubmit={signIn} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Email</span>
          <input
            className="rounded-lg border px-3 py-2"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Password</span>
          <input
            className="rounded-lg border px-3 py-2"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button
          className="rounded-lg bg-amber-200 px-4 py-3 font-semibold disabled:opacity-50"
          type="submit"
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
