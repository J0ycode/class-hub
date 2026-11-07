import { NextResponse } from "next/server";
import { appVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

/** The version of the deployment currently serving requests. Public, no secrets. */
export async function GET() {
  return NextResponse.json({ version: appVersion() }, { headers: { "Cache-Control": "no-store" } });
}
