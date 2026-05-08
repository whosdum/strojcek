import { ImageResponse } from "next/og";

export const alt =
  "Strojček Barbershop Bytča — pánsky strih, fade, úprava brady";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #1a0f08 50%, #2a1810 100%)",
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
            justifyContent: "center",
            width: 168,
            height: 168,
            background: "#dd5a3b",
            borderRadius: 36,
            color: "#0a0a0a",
            fontSize: 110,
            fontWeight: 800,
            marginBottom: 40,
            boxShadow: "0 12px 40px rgba(221, 90, 59, 0.3)",
          }}
        >
          S
        </div>

        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            letterSpacing: -3,
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          Strojček Barbershop
        </div>

        <div
          style={{
            fontSize: 44,
            color: "#dd5a3b",
            marginTop: 16,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          Bytča
        </div>

        <div
          style={{
            fontSize: 28,
            color: "#a0a0a0",
            marginTop: 36,
            fontWeight: 500,
            letterSpacing: 0.5,
          }}
        >
          Pánsky strih  ·  Fade  ·  Úprava brady
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 48,
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
    ),
    { ...size }
  );
}
