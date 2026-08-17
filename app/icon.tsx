import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const logo = await readFile(path.join(process.cwd(), "public", "logo small no bg.png"));
  const source = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    <div style={{ width: "32px", height: "32px", position: "relative", display: "flex", overflow: "hidden", background: "transparent" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt="" width="56" height="56" style={{ width: "56px", height: "56px", position: "absolute", left: "-12px", top: "-12px" }} />
    </div>,
    size,
  );
}
