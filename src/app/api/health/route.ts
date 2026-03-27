import { NextResponse } from "next/server";

export async function GET() {
  const hasKey = !!process.env.OG_PRIVATE_KEY;
  return NextResponse.json({
    status: "ok",
    og_configured: hasKey,
  });
}
