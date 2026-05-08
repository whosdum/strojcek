import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getServiceBySlug } from "../_data";

export const alt = "Strojček Barbershop Bytča";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ServiceOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) notFound();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #1a0f08 60%, #2a1810 100%)",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          padding: 80,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: "#dd5a3b",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              background: "#dd5a3b",
              borderRadius: 14,
              color: "#0a0a0a",
              fontSize: 42,
              fontWeight: 800,
            }}
          >
            S
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
              Strojček Barbershop
            </div>
            <div style={{ fontSize: 16, color: "#a0a0a0", letterSpacing: 0.5 }}>
              Bytča · Pánsky barber
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            marginBottom: "auto",
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: "#dd5a3b",
              letterSpacing: 4,
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Služba
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            {service.name}
          </div>
          <div
            style={{
              fontSize: 36,
              color: "#fafafa",
              marginTop: 24,
              fontWeight: 600,
              letterSpacing: -0.5,
            }}
          >
            v Bytči
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: "#a0a0a0",
              fontWeight: 500,
            }}
          >
            Trvanie {service.durationLabel}
          </div>
          <div
            style={{
              fontSize: 20,
              color: "#707070",
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            strojcekbarbershop.sk
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
