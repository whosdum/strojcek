import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/lib/auth";
import { getAllServices } from "@/server/queries/services";

export async function GET(request: NextRequest) {
  // Auth check — only logged-in admin users
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const services = await getAllServices();
  return NextResponse.json(services);
}
