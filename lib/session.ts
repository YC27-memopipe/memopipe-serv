// « Je suis Alice / Bob / Chloé » : un simple cookie, pas d'authentification dans le MVP.
import { cookies, headers } from "next/headers";
import { isUser, type UserId } from "./data";

export const USER_COOKIE = "memopipe_user";
/** Posé au changement d'utilisateur, effacé par le navigateur dès que l'annonce s'affiche. */
export const SWITCH_COOKIE = "memopipe_switched";
/** Fil de la démo affiché sous la barre du haut. */
export const DEMO_COOKIE = "memopipe_demo";

export async function currentUser(): Promise<UserId> {
  const value = (await cookies()).get(USER_COOKIE)?.value;
  return value && isUser(value) ? value : "alice";
}

export async function demoMode() {
  return (await cookies()).get(DEMO_COOKIE)?.value === "1";
}

/** Adresse publique du hub, pour la commande à copier dans le terminal. */
export async function hubOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
