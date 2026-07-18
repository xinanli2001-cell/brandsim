"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";

const NAV = [
  { href: "/teacher", icon: "dashboard", label: "Dashboard", enabled: true },
  { href: "/teacher/students", icon: "group", label: "Student Progress", enabled: true },
  { href: "/teacher/new", icon: "settings_input_component", label: "Campaign Controls", enabled: true },
  { href: "/teacher/token-economy", icon: "database", label: "Token Economy", enabled: true },
  { href: "/teacher/reports", icon: "description", label: "Reports", enabled: true },
];

export function TeacherShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "authed" | "unauthed">("loading");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          setStatus("unauthed");
          return;
        }
        const data = await res.json();
        if (data.user.role !== "teacher") {
          setStatus("unauthed");
          return;
        }
        setEmail(data.user.email);
        setStatus("authed");
      })
      .catch(() => setStatus("unauthed"));
  }, []);

  useEffect(() => {
    if (status === "unauthed") router.replace("/");
  }, [status, router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  if (status === "loading" || status === "unauthed") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:flex font-body-main text-on-surface">
      <nav className="hidden md:flex flex-col py-stack-lg w-72 border-r border-outline-variant bg-surface-container-low sticky top-0 h-screen shrink-0">
        <div className="px-6 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center shrink-0">
            <MaterialIcon name="school" className="text-on-primary-container" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-title-md text-title-md text-primary truncate">{email}</span>
            <span className="font-caption text-caption text-on-surface-variant">Admin Console</span>
          </div>
        </div>
        <ul className="flex-1 flex flex-col gap-2">
          {NAV.map((item) => {
            const active = item.enabled && (pathname === item.href || pathname.startsWith(item.href + "/"));
            return (
              <li key={item.label}>
                {item.enabled ? (
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all ${
                      active
                        ? "bg-secondary-container text-on-secondary-container font-bold"
                        : "text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    <MaterialIcon name={item.icon} />
                    <span className="font-body-main text-body-main">{item.label}</span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-3 px-4 py-3 mx-2 rounded-lg text-outline-variant cursor-not-allowed">
                    <MaterialIcon name={item.icon} />
                    <span className="font-body-main text-body-main">{item.label}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="px-6 mt-auto flex flex-col gap-3">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors"
          >
            <MaterialIcon name="logout" className="text-lg" />
            <span className="font-body-main text-sm">Log out</span>
          </button>
          <span className="font-caption text-caption text-on-surface-variant">V1.0</span>
        </div>
      </nav>

      <header className="md:hidden flex justify-between items-center px-gutter-mobile py-base w-full bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <MaterialIcon name="school" className="text-primary" />
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-extrabold text-primary">
            MarketingSim
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/teacher/new" className="font-label-mono text-label-mono text-primary">
            + New
          </Link>
          <button onClick={logout} className="text-on-surface-variant">
            <MaterialIcon name="logout" className="text-lg" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-gutter-mobile md:px-gutter-desktop py-stack-lg max-w-container-max mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
