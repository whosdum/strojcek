"use client";

import { useState } from "react";

interface InstagramEmbedProps {
  src: string;
  title: string;
}

export function InstagramEmbed({ src, title }: InstagramEmbedProps) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
        <iframe
          src={src}
          title={title}
          loading="lazy"
          allow="encrypted-media"
          allowFullScreen
          className="block w-full"
          style={{ height: 720, border: 0 }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      className="group flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-border/40 bg-card/60 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-card"
      aria-label="Načítať Instagram video"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="size-6"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold text-foreground">
        Prehrať video
      </span>
      <span className="text-[12px] text-muted-foreground">
        Klikni pre načítanie z Instagramu
      </span>
    </button>
  );
}
