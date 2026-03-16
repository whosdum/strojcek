import { NextResponse } from "next/server";
import { getAllServices } from "@/server/queries/services";

export async function GET() {
  const services = await getAllServices();
  return NextResponse.json(services);
}
