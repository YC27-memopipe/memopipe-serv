"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as data from "@/lib/data";
import { SYSTEM_IDS } from "@/lib/labels";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const ticketPath = (id: string) => `/nimbus/tickets/${encodeURIComponent(id)}`;

export async function approveTicketAction(fd: FormData) {
  const id = str(fd, "id");
  await data.setTicketStatus(id, "approved");
  revalidatePath(ticketPath(id));
  redirect(ticketPath(id));
}

export async function closeTicketAction(fd: FormData) {
  const id = str(fd, "id");
  await data.setTicketStatus(id, "done");
  revalidatePath(ticketPath(id));
  redirect(ticketPath(id));
}

export async function commentTicketAction(fd: FormData) {
  const id = str(fd, "id");
  await data.addTicketComment(id, str(fd, "author"), str(fd, "text"));
  revalidatePath(ticketPath(id));
  redirect(`${ticketPath(id)}#commentaires`);
}

export async function saveConsoleAction(fd: FormData) {
  const email = str(fd, "email");
  const path = `/nimbus/console/${encodeURIComponent(email)}`;
  const levels = Object.fromEntries(SYSTEM_IDS.map((s) => [s, str(fd, s) || "none"]));
  try {
    await data.saveConsole(email, levels, str(fd, "expires") || null);
  } catch (e) {
    redirect(`${path}?error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`);
  }
  revalidatePath(path);
  redirect(path);
}
