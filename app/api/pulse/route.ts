import { pulse } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Lu toutes les 2 s par les pages ouvertes : elles se mettent à jour quand le hub change. */
export async function GET() {
  return Response.json({ v: await pulse() }, { headers: { "cache-control": "no-store" } });
}
