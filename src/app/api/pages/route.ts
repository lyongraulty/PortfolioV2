import { NextResponse } from "next/server";
import { getPages } from "../../../../fetch/getPages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const pages = await getPages();
  return NextResponse.json(
    { pages },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  );
}
