import { MaterialIcon } from "./MaterialIcon";

export function TopBar({ tokenBalance }: { tokenBalance: number }) {
  return (
    <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm flex justify-between items-center px-gutter-mobile py-base w-full">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
          <MaterialIcon name="storefront" className="text-on-primary-container text-lg" />
        </div>
        <span className="font-headline-lg-mobile text-headline-lg-mobile font-extrabold text-primary">
          MarketingSim
        </span>
      </div>
      <div className="flex items-center gap-1 bg-surface-container-high px-3 py-1 rounded-full shadow-sm">
        <MaterialIcon name="monetization_on" fill className="text-token-gold text-lg" />
        <span className="font-label-mono text-label-mono font-bold text-on-surface">
          {tokenBalance.toLocaleString()} Tokens
        </span>
      </div>
    </header>
  );
}
