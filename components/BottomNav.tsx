"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "./MaterialIcon";
import { useGame } from "@/app/play/GameProvider";

export function BottomNav() {
  const pathname = usePathname();
  const { session } = useGame();

  const tabs = [
    { href: `/play/${session.groupId}/brief`, icon: "campaign", label: "Challenge" },
    { href: `/play/${session.groupId}/compose`, icon: "storefront", label: "Market" },
    {
      href: `/play/${session.groupId}/dashboard#feed`,
      icon: "forum",
      label: "Social",
      match: `/play/${session.groupId}/dashboard`,
    },
    { href: `/play/${session.groupId}/dashboard`, icon: "analytics", label: "Results" },
  ];

  return (
    <nav className="bg-surface/80 backdrop-blur-md docked full-width bottom-0 fixed z-50 border-t border-outline-variant shadow-lg flex justify-around items-center px-4 pb-6 pt-2 w-full md:hidden">
      {tabs.map((tab) => {
        const active = pathname === (tab.match ?? tab.href);
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 scale-95 active:scale-90 transition-all ${
              active
                ? "bg-primary-container text-on-primary-container"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <MaterialIcon name={tab.icon} className="text-xl mb-1" />
            <span className="font-caption text-caption">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
