"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export default function AdvisoryTicker({ text }: { text: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <section aria-labelledby="advisory-title" className="glass rounded-lg p-4">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-lime" aria-hidden />
        <p id="advisory-title" className="font-data text-[10px] uppercase tracking-[0.2em] text-muted">
          AI Advisory
        </p>
      </div>
      <p
        className="font-data text-xs leading-relaxed text-lime transition-opacity duration-700"
        style={{ opacity: visible ? 1 : 0.45 }}
      >
        {text}
      </p>
    </section>
  );
}
