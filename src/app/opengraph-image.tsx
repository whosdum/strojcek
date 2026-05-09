import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadJakartaFonts } from "./_og-fonts";

export const alt =
  "Strojček Barbershop Bytča — pánsky strih, fade, úprava brady";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

async function loadLogoDataUrl() {
  const buf = await readFile(join(process.cwd(), "public/logo.jpg"));
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

export default async function OpengraphImage() {
  const [logoSrc, fonts] = await Promise.all([
    loadLogoDataUrl(),
    loadJakartaFonts(),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #fff7f2 0%, #fdebe0 50%, #fbd9c5 100%)",
          fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Decorative giant "S" — anchors the right edge so logo doesn't
            float in empty space, low opacity reads as texture. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: -60,
            bottom: -160,
            fontSize: 720,
            fontWeight: 800,
            color: "#fc873a",
            opacity: 0.08,
            letterSpacing: -24,
            lineHeight: 1,
          }}
        >
          S
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            height: 12,
            background: "#fc873a",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 80px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="Strojček"
            width={760}
            height={412}
            style={{
              objectFit: "contain",
              borderRadius: 32,
              boxShadow: "0 28px 70px rgba(252, 135, 58, 0.35)",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 60px 36px 60px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#7a4a30",
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            Pánsky barbershop · Bytča
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 18,
              color: "#b87858",
              letterSpacing: 3,
              textTransform: "uppercase",
              fontWeight: 800,
            }}
          >
            strojcekbarbershop.sk
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    }
  );
}
