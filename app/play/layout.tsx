import { GameProvider } from "./GameProvider";
import { PlayShell } from "./PlayShell";

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <GameProvider>
      <PlayShell>{children}</PlayShell>
    </GameProvider>
  );
}
