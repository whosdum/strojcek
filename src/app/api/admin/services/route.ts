import { NextResponse } from "next/server";
import { getSession } from "@/server/lib/auth";
import { getAllServices } from "@/server/queries/services";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const services = await getAllServices();
  return NextResponse.json(services);
}
