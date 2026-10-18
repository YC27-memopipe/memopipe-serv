import { RESPONSE_SCHEMA, SYSTEM_PROMPT, validateResponse, type AiContext } from "./ai-contract";

export type AiConfig = { endpoint: string; provider: string; model: string; key: string };

export function aiConfig(): AiConfig {
  const key = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const model = process.env.AI_MODEL?.trim();
  if (!key || !model) throw new Error("Configurez OPENAI_API_KEY et AI_MODEL dans le .env du serveur, puis redémarrez-le.");
  let url: URL;
  try { url = new URL(process.env.AI_BASE_URL || "https://api.openai.com/v1"); } catch { throw new Error("AI_BASE_URL invalide."); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(loopback && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) throw new Error("Le fournisseur IA doit utiliser HTTPS (HTTP autorisé seulement en loopback), sans identifiants dans l’URL.");
  return { endpoint: `${url.href.replace(/\/$/, "")}/chat/completions`, provider: url.origin + url.pathname.replace(/\/$/, ""), model, key };
}

export function aiSettings(): { configured: boolean; provider: string; model: string; error?: string } {
  try { const { provider, model } = aiConfig(); return { configured: true, provider, model }; }
  catch (e) { return { configured: false, provider: "OpenAI", model: "non configuré", error: (e as Error).message }; }
}

async function boundedJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Réponse IA vide.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 160000) throw new Error("Réponse IA trop volumineuse.");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const all = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(all)); } catch { throw new Error("Réponse IA non JSON."); }
}

export async function callAi(context: AiContext, config: AiConfig, transport: typeof fetch = fetch) {
  const content = JSON.stringify(context);
  if (Buffer.byteLength(content) > 60000) throw new Error("Contexte IA trop volumineux. Réduisez les cas ou les citations.");
  let response: Response;
  try {
    response = await transport(config.endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(45000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.key}` },
      body: JSON.stringify({ model: config.model, store: false, max_completion_tokens: 6000,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content }],
        response_format: { type: "json_schema", json_schema: { name: "memopipe_diagnosis", strict: true, schema: RESPONSE_SCHEMA } },
      }),
    });
  } catch { throw new Error("Fournisseur IA injoignable ou délai dépassé. Aucun nouvel essai automatique."); }
  if (!response.ok) { await response.body?.cancel(); throw new Error(`L’API IA a refusé la requête (HTTP ${response.status}). Vérifiez la clé, le modèle et le support JSON Schema.`); }
  const body = await boundedJson(response);
  const choice = body?.choices?.[0];
  if (choice?.message?.refusal || choice?.finish_reason !== "stop" || typeof choice?.message?.content !== "string") throw new Error("L’IA a refusé ou interrompu sa réponse. Aucune proposition appliquée.");
  let value: unknown;
  try { value = JSON.parse(choice.message.content); } catch { throw new Error("Réponse IA non JSON."); }
  try { return validateResponse(value, context); }
  catch { throw new Error("Réponse IA rejetée : format, références ou code non autorisés. Aucune proposition appliquée."); }
}
