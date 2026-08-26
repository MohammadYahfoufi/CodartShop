import { ImageResponse } from "next/og";
import { getStorefrontSettings } from "@/lib/storefront-settings";

export const alt = "Codart — Better tech. Less noise.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const settings = await getStorefrontSettings();
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", background: "linear-gradient(125deg, #08102f 0%, #101747 56%, #22145c 100%)", color: "white", fontFamily: "Arial, sans-serif" }}>
      <div style={{ width: 580, marginLeft: 68, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 64, fontSize: 40, fontWeight: 800, letterSpacing: -2 }}><span style={{ color: "#168bff" }}>Cod</span><span style={{ color: "#7650f5" }}>Art</span></div>
        <div style={{ color: "#8ca5ff", fontSize: 15, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase" }}>{settings.hero_eyebrow}</div>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", fontSize: 68, lineHeight: .93, fontWeight: 800, letterSpacing: -4 }}><span>Better tech.</span><span>Less noise.</span></div>
        <div style={{ width: 530, marginTop: 28, color: "#c1c8e5", fontSize: 21, lineHeight: 1.45 }}>{settings.fallback_hero_subtitle}</div>
        <div style={{ width: 225, height: 54, marginTop: 32, borderRadius: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "white", color: "#111638", fontSize: 16, fontWeight: 800 }}>Explore the collection</div>
      </div>
      <div style={{ width: 505, height: 505, position: "absolute", right: 22, top: 62, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 490, height: 490, position: "absolute", border: "2px solid rgba(57,101,226,.32)", borderRadius: "50%", display: "flex" }} />
        <div style={{ width: 330, height: 330, position: "absolute", border: "2px solid rgba(104,77,225,.4)", borderRadius: "50%", display: "flex" }} />
        <div style={{ width: 215, height: 215, position: "absolute", border: "3px dashed rgba(94,107,235,.35)", borderRadius: "50%", display: "flex" }} />
        <div style={{ width: 150, height: 150, border: "8px solid #5364ff", borderRadius: 48, transform: "rotate(45deg)", display: "flex", alignItems: "center", justifyContent: "center", background: "#111846", boxShadow: "0 0 70px rgba(83,96,255,.58)" }}><div style={{ width: 65, height: 65, border: "7px solid #704ef8", borderRadius: "50%", transform: "rotate(-45deg)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2e86ff", fontSize: 36, fontWeight: 900 }}>+</div></div>
        <div style={{ width: 112, height: 46, position: "absolute", top: 18, left: 200, border: "3px solid rgba(62,126,255,.62)", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13,23,70,.8)", color: "#72a1ff", fontSize: 15, fontWeight: 800 }}>AUDIO</div>
        <div style={{ width: 112, height: 46, position: "absolute", right: 12, top: 230, border: "3px solid rgba(124,75,243,.65)", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,21,77,.82)", color: "#ae82ff", fontSize: 15, fontWeight: 800 }}>POWER</div>
        <div style={{ width: 112, height: 46, position: "absolute", bottom: 25, left: 195, border: "3px solid rgba(48,132,255,.62)", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13,23,70,.8)", color: "#72a1ff", fontSize: 15, fontWeight: 800 }}>CABLES</div>
        <div style={{ width: 112, height: 46, position: "absolute", left: 5, top: 230, border: "3px solid rgba(106,83,240,.65)", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,21,77,.82)", color: "#a98aff", fontSize: 15, fontWeight: 800 }}>CHARGE</div>
      </div>
      <div style={{ width: 520, height: 520, position: "absolute", right: 20, top: 35, borderRadius: "50%", background: "radial-gradient(circle, rgba(78,58,228,.22), transparent 68%)", display: "flex" }} />
    </div>,
    size,
  );
}
