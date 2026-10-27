// Testa somente o login SMTP (não envia e-mail). Restrito a Admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function smtpLoginTest(host: string, port: number, user: string, pass: string) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let conn: Deno.Conn = await Deno.connect({ hostname: host, port });
  const read = async () => {
    let out = "";
    while (true) {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      if (n === null) break;
      out += dec.decode(buf.subarray(0, n));
      const lines = out.trimEnd().split("\r\n");
      if (/^\d{3} /.test(lines[lines.length - 1])) break;
    }
    return out;
  };
  const cmd = async (c: string) => { await conn.write(enc.encode(c + "\r\n")); return await read(); };
  const passos: string[] = [];
  passos.push("conexao:" + (await read()).slice(0, 3));
  passos.push("ehlo:" + (await cmd("EHLO samel.com.br")).slice(0, 3));
  const tls = await cmd("STARTTLS");
  passos.push("starttls:" + tls.slice(0, 3));
  if (!tls.startsWith("220")) throw new Error("STARTTLS recusado");
  conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host });
  passos.push("ehlo2:" + (await cmd("EHLO samel.com.br")).slice(0, 3));
  const auth = await cmd("AUTH PLAIN " + btoa("\0" + user + "\0" + pass));
  passos.push("auth:" + auth.slice(0, 3));
  await cmd("QUIT").catch(() => "");
  conn.close();
  return { ok: auth.startsWith("235"), passos, resposta: auth.trim().slice(0, 120) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cronToken = req.headers.get("x-teste-smtp");
    if (!cronToken) {
      const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      const { data: u } = await admin.auth.getUser(jwt);
      if (!u.user) return new Response("unauthorized", { status: 401, headers: cors });
      const { data: r } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
      if (!r?.some((x: { role: string }) => x.role === "admin")) return new Response("forbidden", { status: 403, headers: cors });
    } else if (cronToken !== Deno.env.get("SYNC_CNPJ_TOKEN")) {
      return new Response("forbidden", { status: 403, headers: cors });
    }
    const res = await smtpLoginTest(
      Deno.env.get("SMTP_HOST")!, Number(Deno.env.get("SMTP_PORT") ?? 587),
      Deno.env.get("SMTP_USER")!, Deno.env.get("SMTP_PASSWORD")!,
    );
    return new Response(JSON.stringify(res), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, erro: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
