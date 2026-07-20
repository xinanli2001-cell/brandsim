"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";

export default function StudentLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/student");
    } catch {
      setError("Network error, please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-surface-bg text-on-surface min-h-screen flex items-center justify-center font-body-main relative overflow-hidden">
      <div className="relative z-10 w-full max-w-md px-gutter-mobile">
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E2E8F0] p-stack-lg flex flex-col items-center">
          <div className="mb-stack-lg text-center">
            <MaterialIcon name="person" className="text-[48px] text-primary" />
            <h1 className="font-display-lg text-headline-lg-mobile font-extrabold text-primary mt-base">
              {mode === "login" ? "Student Login" : "Create Student Account"}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-stack-md">
            <div className="w-full">
              <label className="block font-label-mono text-label-mono text-on-surface-variant mb-base">
                Email
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 bg-surface-bg border border-outline-variant rounded-xl font-body-main text-body-main focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 outline-none"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="w-full">
              <label className="block font-label-mono text-label-mono text-on-surface-variant mb-base">
                Password
              </label>
              <input
                type="password"
                className="w-full px-4 py-3 bg-surface-bg border border-outline-variant rounded-xl font-body-main text-body-main focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 outline-none"
                placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-error text-caption font-caption text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-stack-sm w-full bg-primary text-on-primary font-title-md text-title-md py-4 rounded-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all duration-200 shadow-[0_4px_14px_rgba(0,110,47,0.2)] hover:bg-surface-tint disabled:opacity-60"
            >
              <span>{loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}</span>
              {!loading && <MaterialIcon name="arrow_forward" />}
            </button>
          </form>

          <div className="mt-stack-md text-center">
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
              }}
              className="font-caption text-caption text-secondary hover:underline transition-all"
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
          <div className="mt-stack-sm text-center">
            <Link href="/" className="font-caption text-caption text-on-surface-variant hover:underline">
              Teacher Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
