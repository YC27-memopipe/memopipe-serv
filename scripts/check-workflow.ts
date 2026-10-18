/** Real Next HTTP + actual local CLI + HTML forms. Synthetic data and in-memory DB only.
 * Run after bun run build, with the two sibling repositories present.
 */
import { resolve } from "node:path";
import { TEST_RESPONSE } from "../tests/fixtures/ai-response";

const root = resolve(import.meta.dir, "..");
const local = resolve(root, "../memopipe-local");
const socket = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
const port = socket.port!;
socket.stop(true);
const base = `http://127.0.0.1:${port}`;
const token = "synthetic-workflow-token";
let aiCalls = 0;
const mockAi = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
  if (request.method !== "POST" || new URL(request.url).pathname !== "/v1/chat/completions") return new Response(null, { status: 404 });
  aiCalls++;
  const payload = await request.json() as { response_format?: { type?: string } };
  if (payload.response_format?.type !== "json_schema") return new Response(null, { status: 400 });
  return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(TEST_RESPONSE) } }] });
} });
const server = Bun.spawn(["node", "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: root, env: { ...process.env, DATABASE_URL: "", PGLITE_DIR: "memory://", MEMOPIPE_TEAM_TOKEN: token, RENDER: "", VERCEL: "", NODE_ENV: "production",
    OPENAI_API_KEY: "test-key-not-real", AI_API_KEY: "", AI_MODEL: "simulated-model", AI_BASE_URL: `http://127.0.0.1:${mockAi.port}/v1` }, stdout: "pipe", stderr: "pipe",
});
const stdout = new Response(server.stdout).text(), stderr = new Response(server.stderr).text();
const assert = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
const decode = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");

async function page(path: string, user = "bob") {
  const r = await fetch(new URL(path, base), { headers: { Cookie: `memopipe_user=${user}` } });
  assert(r.ok, `${path}: HTTP ${r.status}`);
  return r.text();
}

async function submit(path: string, formMatches: (html: string) => boolean, fields: Record<string, string>, user = "bob", submitter?: string) {
  const html = await page(path, user);
  const form = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(m => m[1]).find(formMatches);
  assert(form, `Form not found on ${path}`);
  const body = new FormData();
  for (const input of form!.matchAll(/<input\b[^>]*>/g)) {
    const name = /\bname="([^"]*)"/.exec(input[0])?.[1];
    const value = /\bvalue="([^"]*)"/.exec(input[0])?.[1] ?? "";
    if (name && !/type="checkbox"/.test(input[0])) body.set(decode(name), decode(value));
  }
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  if (submitter) {
    const button = [...form!.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(m => m[2].includes(submitter));
    assert(button, "Submit button missing: " + submitter);
    const actionName = /\bname="([^"]*)"/.exec(button![1])?.[1];
    if (actionName?.startsWith("$ACTION_ID_")) {
      for (const key of [...body.keys()]) if (key.startsWith("$ACTION_ID_")) body.delete(key);
      body.set(decode(actionName), "");
    }
  }
  const response = await fetch(new URL(path, base), { method: "POST", redirect: "manual", headers: { Cookie: `memopipe_user=${user}`, Origin: base }, body });
  const location = response.headers.get("location");
  assert(response.status === 303 && location, `Form on ${path}: HTTP ${response.status}`);
  assert(!location!.includes("error="), `Action failed: ${decodeURIComponent(location!)}`);
  return location!;
}

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await Bun.sleep(200);
  }
  assert(ready, "Next server did not start");
  assert((await page("/decouvrir")).includes("Trouver mes procédures"), "Missing consent screen");
  for (const path of ["/", "/equipe", "/decouvrir", "/a/new", "/a/attribuer-acces?tab=procedure", "/nimbus/tickets"]) {
    const html = (await page(path)).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
    assert(!/Préparer la démo|DÉMO|démonstration|canary:|Scénario \(JSON\)|DO iam\.grant|name="dsl"/i.test(html), `Technical or demonstration UI on ${path}`);
  }
  const legacy = await fetch(new URL("/demo/tickets", base), { redirect: "manual" });
  assert(legacy.status === 307 && legacy.headers.get("location") === "/nimbus/tickets", "Legacy links must redirect to Nimbus");
  const cli = Bun.spawn(["bun", "run", "canary:discover", "--fixtures", "fixtures/bob.json", "--hub", base, "--author", "Bob"], {
    cwd: local, env: { ...process.env, CANARY_TEAM_TOKEN: token }, stdin: "pipe", stdout: "pipe", stderr: "pipe",
  });
  cli.stdin.write("o\no\n"); cli.stdin.end();
  const [out, err, code] = await Promise.all([new Response(cli.stdout).text(), new Response(cli.stderr).text(), cli.exited]);
  assert(code === 0, `Discovery CLI failed: ${err}`);
  const match = /Recommandations : (http[^\s]+)/.exec(out);
  assert(match, "CLI receipt missing");
  const discoveryPath = new URL(match![1]).pathname;
  const html = await page(discoveryPath);
  assert(html.includes("Données d’exemple") && html.includes("procédure(s) à essayer"), "Missing recommendation or provenance");
  assert(!html.includes('href="screenpipe://'), "Synthetic frames must not pretend to link to real captures");
  const runPath = await submit(discoveryPath, f => f.includes('name="case" value="1"'), { confirmed: "yes" });
  assert(runPath.startsWith("/runs/"), "Expected an isolated Nimbus run");
  const runHtml = await page(runPath);
  assert(runHtml.includes("Comprendre et adapter") && runHtml.includes("Quelles informations seront utilisées"), "Missing explicit AI consent");
  assert(aiCalls === 0, "Rendering a page must never call the provider");
  const diagnosisPath = await submit(runPath, f => f.includes('name="context_hash"'), { consent: "yes" });
  assert(aiCalls === 1, "Exactly one explicit provider call expected");
  assert((await page(diagnosisPath)).includes("Réponse simulée"), "Missing provider-generated explanation");
  const draftPath = await submit(runPath, f => f.includes("Vérifier cette adaptation"), { reviewed: "yes" });
  assert(draftPath.startsWith("/d/"), "Missing editable correction");
  const draftHtml = (await page(draftPath)).replace(/<!--[\s\S]*?-->/g, "");
  assert(draftHtml.includes("2 / 2 cas conformes"), "Alice and Bob regression tests must pass");
  assert(!/name="dsl"|<pre class="code"/.test(draftHtml), "Business editing must not require code");
  // Editing and testing from the business form must keep all conditions and pass the suite.
  const levels = Object.fromEntries([...draftHtml.matchAll(/<select name="((?:level|expiry)_\d+)"[^>]*>([\s\S]*?)<\/select>/g)].map(m => {
    const option = [...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].find(o => /\bselected/.test(o[1]));
    return [m[1], /\bvalue="([^"]*)"/.exec(option?.[1] ?? "")?.[1] ?? ""];
  }));
  const checkedPath = await submit(draftPath, f => f.includes("Enregistrer et vérifier"), levels, "bob", "Enregistrer et vérifier");
  assert((await page(checkedPath)).replace(/<!--[\s\S]*?-->/g, "").includes("2 / 2 cas conformes"), "Business form changed the procedure behavior");
  const contributionPath = await submit(draftPath, f => f.includes("Envoyer pour validation"), { reason: "Généralisation par contrat et date de fin, vérifiée sur les cas d’Alice et de Bob." });
  const publishedPath = await submit(contributionPath, f => f.includes("Approuver et publier"), {}, "alice");
  const published = decode((await page(publishedPath, "alice")).replace(/<!--[\s\S]*?-->/g, ""));
  assert(published.includes("la v2 est la version de toute l'équipe"), "Shared v2 not published");
  const newProcedure = await submit("/a/new", f => f.includes('name="title"'), { title: "Accès support métier", usage: "Demandes approuvées du support", github: "read", "vpn-prod": "none", slack: "guest" });
  assert(newProcedure.startsWith("/a/"), "Business procedure creation failed");
  const newCase = await submit(newProcedure, f => f.includes('name="contract"'), { title: "Nouvelle demande support", name: "Nora Test", email: "nora@example.com", contract: "cdi", team: "support", github: "read", "vpn-prod": "none", slack: "guest" });
  const checkedCase = await submit(newCase, f => f.includes("Essayer sur ce cas"), {});
  assert((await page(checkedCase)).includes("La procédure convient à cette situation"), "Structured reference form or one-click rehearsal failed");
  console.log("Verified: actual CLI → HTTP discovery → human validation → differences → explicit AI consent → simulated HTTP provider → reviewed copy → Alice + Bob tests → Alice publishes v2.");
  console.log("Synthetic fixtures and simulated AI only. No real OpenAI, Screenpipe history, Gmail, or persistent DB accessed.");
} catch (e) {
  process.exitCode = 1;
  console.error(e);
} finally {
  server.kill();
  mockAi.stop(true);
  await server.exited;
  const logs = (await stdout) + (await stderr);
  if (process.exitCode) console.error(logs.slice(-12000));
}
