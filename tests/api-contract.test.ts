import { expect, test } from "bun:test";

test("scenario route accepts CANARY envelope and existing flat format, refuses malformed input and bad auth", async () => {
  const code = `
    const {POST}=await import('./app/api/scenarios/route.ts');
    const {SCENARIO_EXAMPLE}=await import('./lib/seed.ts');
    const send=async body=>POST(new Request('http://localhost/api/scenarios',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
    const nested=await send({automation_id:'attribuer-acces',author:'Bob',scenario:{...SCENARIO_EXAMPLE,origin:'Manuel · Démo fictive · Test API'}});
    const receipt=await nested.json();
    if(nested.status!==201||typeof receipt.id!=='string')throw new Error('CANARY envelope failed');
    const flat=await send({automation:'attribuer-acces',added_by:'bob',...SCENARIO_EXAMPLE});
    if(flat.status!==201)throw new Error('Flat format regression');
    if((await send(null)).status!==400)throw new Error('Null payload not rejected');
    if((await send({automation_id:'attribuer-acces'})).status!==400)throw new Error('Missing scenario not rejected');
    process.env.MEMOPIPE_TEAM_TOKEN='synthetic-test-token';
    if((await send({automation:'attribuer-acces',...SCENARIO_EXAMPLE})).status!==401)throw new Error('Auth regression');
    console.log('API contracts verified in isolated in-memory database');
    process.exit(0);
  `;
  const child = Bun.spawn(["bun", "-e", code], { cwd: process.cwd(), env: { ...process.env, PGLITE_DIR: "memory://", DATABASE_URL: "", MEMOPIPE_TEAM_TOKEN: "" }, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, status] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  expect(stderr).toBe(""); expect(status).toBe(0); expect(stdout).toContain("API contracts verified");
}, 15000);
