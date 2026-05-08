import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { getServiceBySlug, SERVICES } from "../_data";
import { loadJakartaFonts } from "@/app/_og-fonts";

export const alt = "Strojček Barbershop Bytča";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

async function loadLogoDataUrl() {
  const buf = await readFile(join(process.cwd(), "public/logo.jpg"));
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

export default async function ServiceOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) notFound();

  const position = SERVICES.findIndex((s) => s.slug === slug) + 1;
  const total = SERVICES.length;

  const [logoSrc, fonts] = await Promise.all([
    loadLogoDataUrl(),
    loadJakartaFonts(),
  ]);

  // First letter of service name, used as a giant low-opacity watermark
  // that fills the right half of the canvas — adds visual mass without
  // competing with the title.
  const initial = service.name.charAt(0).toUpperCase();

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
        {/* Decorative giant initial — pushed deep into the bottom-right
            corner so only the left/top edge of the glyph is visible. Reads
            as a brand corner mark, doesn't compete with the title text
            even on the longest service names ("Klasický pánsky strih"). */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: -240,
            bottom: -200,
            fontSize: 720,
            fontWeight: 800,
            color: "#dd5a3b",
            opacity: 0.08,
            letterSpacing: -24,
            lineHeight: 1,
          }}
        >
          {initial}
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            height: 12,
            background: "#dd5a3b",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            padding: "40px 72px 0 72px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="Strojček"
            width={220}
            height={119}
            style={{
              objectFit: "contain",
              borderRadius: 14,
              boxShadow: "0 10px 28px rgba(221, 90, 59, 0.25)",
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#7a4a30",
                fontWeight: 800,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              Strojček Barbershop
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: "#a07560",
                fontWeight: 500,
                marginTop: 4,
              }}
            >
              Bytča · Pánsky barber
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            padding: "0 72px",
          }}
        >
          {/* Orange accent bar — anchors the editorial title block visually
              and brings brand color into the body of the canvas. */}
          <div
            style={{
              display: "flex",
              width: 6,
              height: 280,
              background: "#dd5a3b",
              borderRadius: 3,
              marginRight: 32,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#dd5a3b",
                letterSpacing: 4,
                textTransform: "uppercase",
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              Služba {String(position).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 92,
                fontWeight: 800,
                letterSpacing: -3,
                lineHeight: 1.05,
                color: "#1a0f08",
                maxWidth: 980,
              }}
            >
              {service.name}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 36,
                color: "#3a2418",
                marginTop: 16,
                fontWeight: 700,
                letterSpacing: -0.5,
              }}
            >
              v Bytči
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 72px 36px 72px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#7a4a30",
              fontWeight: 700,
            }}
          >
            Trvanie {service.durationLabel}
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
