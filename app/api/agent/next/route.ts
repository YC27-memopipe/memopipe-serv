import { claimNextJob, isUser } from "@/lib/data";
import { tokenError } from "@/lib/token";

export const dynamic = "force-dynamic";

/** L'agent local signale sa présence et récupère la prochaine action réelle à exécuter (ou null). */
export async function GET(request: Request) {
  const denied = tokenError(request);
  if (denied) return denied;
  const label = request.headers.get("x-memopipe-agent") ?? "agent local";
  const author = request.headers.get("x-memopipe-user") ?? "bob";
  if (!isUser(author)) return Response.json({ error: "Identité de l’agent inconnue." }, { status: 400 });
  const job = await claimNextJob(label, author);
  return Response.json({ job: job ? { id: job.id, action: job.action, args: job.args } : null });
}
