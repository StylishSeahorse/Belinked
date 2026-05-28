import QRCode from "qrcode";
import { requireOwner } from "@/lib/auth";

export async function GET(request: Request) {
  await requireOwner();
  const url = new URL(request.url);
  const appUrl = process.env.APP_URL || `${url.protocol}//${url.host}`;
  const png = await QRCode.toBuffer(appUrl, {
    width: 1024,
    color: { dark: "#151515", light: "#fbfaf7" },
    margin: 2
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="public-page-qr.png"`
    }
  });
}
