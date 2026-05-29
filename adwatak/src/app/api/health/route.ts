import { ok } from "@/lib/api/responses";

export async function GET() {
  return ok({ status: "ok", service: "adwatak-api" });
}
