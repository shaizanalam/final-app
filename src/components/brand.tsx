import { useState } from "react";

export function BrandLogo({ className = "", showText = true }: { className?: string; showText?: boolean }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {!hasError ? (
        <img
          src="/logo.png"
          alt="Logo"
          onError={() => setHasError(true)}
          className="h-10 w-10 rounded-2xl object-cover bg-white"
        />
      ) : (
        <div className="h-10 w-10 rounded-2xl bg-white grid place-items-center text-foreground font-bold">L</div>
      )}
      {showText && <span className="font-display text-xl font-bold">LearnHub</span>}
    </div>
  );
}
