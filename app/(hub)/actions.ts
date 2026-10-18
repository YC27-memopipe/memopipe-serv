"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import * as data from "@/lib/data";
import { currentUser, DEMO_COOKIE, SWITCH_COOKIE, USER_COOKIE } from "@/lib/session";

function message(e: unknown) {
  if (e instanceof data.UserError) return e.message;
  return e instanceof Error ? `Erreur inattendue : ${e.message}` : String(e);
}

function to(path: string, params: Record<string, string> = {}, hash = "") {
  const qs = new URLSearchParams(params).toString();
  return `${path}${qs ? `?${qs}` : ""}${hash}`;
}

function fail(path: string, e: unknown, hash = ""): never {
  redirect(to(path, { error: message(e) }, hash));
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const num = (fd: FormData, key: string) => Number(fd.get(key));

// ---------- Identité ----------

async function switchUser(user: data.UserId) {
  const jar = await cookies();
  if ((await currentUser()) !== user) jar.set(SWITCH_COOKIE, `${user}.${Date.now()}`, { path: "/", sameSite: "lax", maxAge: 60 });
  jar.set(USER_COOKIE, user, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
}

/** Change d'utilisateur, puis va à `next` (chemin interne) ou revient sur la page d'origine. */
export async function setUserAction(fd: FormData) {
  const user = str(fd, "user");
  if (data.isUser(user)) await switchUser(user);
  const next = str(fd, "next");
  if (next.startsWith("/") && !next.startsWith("//")) redirect(next);
  let back = "/";
  const ref = (await headers()).get("referer");
  if (ref) {
    try {
      const url = new URL(ref);
      url.searchParams.delete("ok");
      url.searchParams.delete("error");
      back = url.pathname + url.search;
    } catch {}
  }
  redirect(back);
}

/** Avant de monter sur scène : tout repart de la v1 d'Alice, on joue Bob, le fil de la démo s'affiche. */
export async function prepareDemoAction() {
  try {
    await data.reset("all");
  } catch (e) {
    fail("/equipe", e);
  }
  await switchUser("bob");
  (await cookies()).set(DEMO_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  revalidatePath("/", "layout");
  redirect("/a/attribuer-acces");
}

export async function toggleDemoAction(fd: FormData) {
  const jar = await cookies();
  if (str(fd, "on") === "1") jar.set(DEMO_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  else jar.delete(DEMO_COOKIE);
  redirect("/equipe");
}

// ---------- Catalogue et scénarios ----------

export type FormState = { error?: string; values?: Record<string, string> };

export async function publishAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = { title: str(fd, "title"), usage: str(fd, "usage"), dsl: str(fd, "dsl") };
  let slug: string;
  try {
    slug = (await data.publishAutomation(values, await currentUser())).slug;
  } catch (e) {
    return { error: message(e), values };
  }
  revalidatePath("/");
  redirect(to(`/a/${slug}`, { ok: "Automatisation publiée : v1." }));
}

export async function addScenarioAction(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const json = str(fd, "json");
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new data.UserError("Le JSON n'est pas valide.");
    }
    await data.addScenario(slug, parsed, await currentUser());
  } catch (e) {
    return { error: message(e), values: { json } };
  }
  revalidatePath(`/a/${slug}`);
  redirect(to(`/a/${slug}`, { ok: "Scénario ajouté à la suite de tests." }, "#scenarios"));
}

export async function deleteScenarioAction(fd: FormData) {
  const slug = str(fd, "slug");
  try {
    await data.deleteScenario(num(fd, "scenario"), await currentUser());
  } catch (e) {
    fail(`/a/${slug}`, e, "#scenarios");
  }
  revalidatePath(`/a/${slug}`);
  redirect(to(`/a/${slug}`, { ok: "Scénario retiré." }, "#scenarios"));
}

// ---------- Tests pas à pas ----------

export async function startRunAction(fd: FormData) {
  const slug = str(fd, "slug");
  const draftId = num(fd, "draft");
  const back = draftId ? `/d/${draftId}` : `/a/${slug}`;
  let runId: number;
  try {
    const user = await currentUser();
    const a = await data.getAutomation(slug);
    if (!a) throw new data.UserError("Automatisation introuvable.");
    let dsl = a.current.dsl;
    let source = `v${a.current.number}`;
    if (draftId) {
      const d = await data.getDraft(draftId);
      if (!d) throw new data.UserError("Copie introuvable.");
      dsl = d.draft.dsl;
      source = `copie #${draftId}`;
    }
    runId = (await data.startRun({ automationId: a.automation.id, scenarioId: num(fd, "scenario"), dsl, source, user })).id;
  } catch (e) {
    fail(back, e);
  }
  revalidatePath("/", "layout"); // le fil de la démo avance
  redirect(`/runs/${runId}`);
}

export async function stepRunAction(fd: FormData) {
  const id = num(fd, "run");
  try {
    await data.stepRun(id);
  } catch (e) {
    fail(`/runs/${id}`, e);
  }
  redirect(`/runs/${id}`);
}

export async function finishRunAction(fd: FormData) {
  const id = num(fd, "run");
  try {
    await data.finishRun(id);
  } catch (e) {
    fail(`/runs/${id}`, e);
  }
  redirect(`/runs/${id}`);
}

export async function rerunAction(fd: FormData) {
  const id = num(fd, "run");
  let next: number;
  try {
    const r = await data.getRun(id);
    if (!r) throw new data.UserError("Test introuvable.");
    next = (await data.startRun({
      automationId: r.run.automation_id,
      scenarioId: r.run.scenario_id,
      dsl: r.run.dsl,
      source: r.run.source,
      user: await currentUser(),
    })).id;
  } catch (e) {
    fail(`/runs/${id}`, e);
  }
  redirect(`/runs/${next}`);
}

export async function testVersionAction(fd: FormData) {
  const slug = str(fd, "slug");
  let batch: string;
  try {
    batch = await data.testCurrentVersion(slug, await currentUser());
  } catch (e) {
    fail(`/a/${slug}`, e);
  }
  revalidatePath("/", "layout");
  redirect(to(`/a/${slug}`, { batch }, "#resultats"));
}

// ---------- Copies de travail et contributions ----------

export async function createDraftAction(fd: FormData) {
  const slug = str(fd, "slug");
  let id: number;
  try {
    id = (await data.createDraft(slug, await currentUser())).id;
  } catch (e) {
    fail(`/a/${slug}`, e);
  }
  revalidatePath("/", "layout");
  redirect(`/d/${id}`);
}

export async function saveDraftAction(fd: FormData) {
  const id = num(fd, "draft");
  try {
    await data.saveDraft(id, str(fd, "dsl"), await currentUser());
  } catch (e) {
    fail(`/d/${id}`, e);
  }
  revalidatePath(`/d/${id}`);
  redirect(to(`/d/${id}`, { ok: "Copie enregistrée." }));
}

export async function testDraftAction(fd: FormData) {
  const id = num(fd, "draft");
  try {
    const user = await currentUser();
    await data.saveDraft(id, str(fd, "dsl"), user);
    await data.testDraft(id, user);
  } catch (e) {
    fail(`/d/${id}`, e);
  }
  revalidatePath(`/d/${id}`);
  redirect(to(`/d/${id}`, {}, "#tests"));
}

export async function proposeDraftAction(fd: FormData) {
  const id = num(fd, "draft");
  try {
    await data.proposeDraft(id, str(fd, "reason"), await currentUser());
  } catch (e) {
    fail(`/d/${id}`, e, "#proposer");
  }
  revalidatePath("/", "layout");
  redirect(to(`/c/${id}`, { ok: "Contribution envoyée." }));
}

export async function commentAction(fd: FormData) {
  const id = num(fd, "draft");
  try {
    await data.addComment(id, await currentUser(), str(fd, "body"));
  } catch (e) {
    fail(`/c/${id}`, e, "#discussion");
  }
  revalidatePath(`/c/${id}`);
  redirect(to(`/c/${id}`, {}, "#discussion"));
}

export async function approveAction(fd: FormData) {
  const id = num(fd, "draft");
  let version: number;
  try {
    version = (await data.approveDraft(id, await currentUser())).number;
  } catch (e) {
    fail(`/c/${id}`, e);
  }
  revalidatePath("/", "layout");
  redirect(to(`/c/${id}`, { ok: `Contribution approuvée : la v${version} est publiée pour toute l'équipe.` }));
}

export async function rejectAction(fd: FormData) {
  const id = num(fd, "draft");
  try {
    await data.rejectDraft(id, await currentUser());
  } catch (e) {
    fail(`/c/${id}`, e);
  }
  revalidatePath("/", "layout");
  redirect(to(`/c/${id}`, { ok: "Contribution refusée." }));
}

// ---------- Démo ----------

export async function resetAction(fd: FormData) {
  const scope = str(fd, "scope") === "all" ? "all" : "demo";
  try {
    await data.reset(scope);
  } catch (e) {
    fail("/equipe", e);
  }
  revalidatePath("/", "layout");
  redirect(to("/equipe", { ok: scope === "all" ? "Tout est réinitialisé : catalogue avec la v1 d'Alice." : "App de démo réinitialisée : tickets et accès de départ." }));
}
