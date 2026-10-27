// Cliente SMTP mínimo (STARTTLS + AUTH PLAIN) para o servidor da Samel.
export interface Anexo { nome: string; mime: string; conteudo: Uint8Array }
export interface ImagemInline { cid: string; nome: string; mime: string; conteudo: Uint8Array }
export interface Mensagem {
  fromNome: string; fromEmail: string; replyTo?: string | null;
  para: string[]; cc?: string[]; bcc?: string[]; assunto: string; html: string; texto: string; anexos: Anexo[];
  inline?: ImagemInline[];
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/.{1,76}/g, "$&\r\n");
}
const b64txt = (t: string) => b64(enc.encode(t));
const cabecalho = (t: string) => `=?UTF-8?B?${btoa(String.fromCharCode(...enc.encode(t)))}?=`;

export function montarMime(m: Mensagem): string {
  const b = "samel_" + crypto.randomUUID().replace(/-/g, "");
  const alt = "alt_" + crypto.randomUUID().replace(/-/g, "");
  const rel = "rel_" + crypto.randomUUID().replace(/-/g, "");
  const temInline = (m.inline?.length ?? 0) > 0;
  const linhas = [
    `From: ${cabecalho(m.fromNome)} <${m.fromEmail}>`,
    `To: ${m.para.join(", ")}`,
    ...(m.cc?.length ? [`Cc: ${m.cc.join(", ")}`] : []),
    ...(m.replyTo ? [`Reply-To: ${m.replyTo}`] : []),
    `Subject: ${cabecalho(m.assunto)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${m.fromEmail.split("@")[1]}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${b}"`, "",
  ];
  if (temInline) {
    linhas.push(`--${b}`, `Content-Type: multipart/related; boundary="${rel}"`, "",
      `--${rel}`, `Content-Type: multipart/alternative; boundary="${alt}"`, "");
  } else {
    linhas.push(`--${b}`, `Content-Type: multipart/alternative; boundary="${alt}"`, "");
  }
  linhas.push(
    `--${alt}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64txt(m.texto),
    `--${alt}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64txt(m.html),
    `--${alt}--`,
  );
  for (const img of m.inline ?? []) {
    linhas.push(`--${rel}`, `Content-Type: ${img.mime}; name="${img.nome}"`, "Content-Transfer-Encoding: base64",
      `Content-ID: <${img.cid}>`, `Content-Disposition: inline; filename="${img.nome}"`, "", b64(img.conteudo));
  }
  if (temInline) linhas.push(`--${rel}--`);
  for (const a of m.anexos) {
    linhas.push(`--${b}`, `Content-Type: ${a.mime}; name="${cabecalho(a.nome)}"`, "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${cabecalho(a.nome)}"`, "", b64(a.conteudo));
  }
  linhas.push(`--${b}--`, "");
  return linhas.join("\r\n");
}

export async function enviarSmtp(m: Mensagem): Promise<void> {
  const host = Deno.env.get("SMTP_HOST")!, port = Number(Deno.env.get("SMTP_PORT") ?? 587);
  const user = Deno.env.get("SMTP_USER")!, pass = Deno.env.get("SMTP_PASSWORD")!;
  let conn: Deno.Conn = await Deno.connect({ hostname: host, port });
  const ler = async () => {
    let out = "";
    while (true) {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      if (n === null) break;
      out += dec.decode(buf.subarray(0, n));
      const l = out.trimEnd().split("\r\n");
      if (/^\d{3} /.test(l[l.length - 1])) break;
    }
    return out;
  };
  const cmd = async (c: string, esperado: string) => {
    await conn.write(enc.encode(c + "\r\n"));
    const r = await ler();
    if (!r.startsWith(esperado)) throw new Error(`Servidor de e-mail recusou (${c.split(" ")[0]}): ${r.trim().slice(0, 150)}`);
    return r;
  };
  try {
    await ler();
    await cmd("EHLO samel.com.br", "250");
    await cmd("STARTTLS", "220");
    conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host });
    await cmd("EHLO samel.com.br", "250");
    await cmd("AUTH PLAIN " + btoa("\0" + user + "\0" + pass), "235");
    await cmd(`MAIL FROM:<${user}>`, "250");
    for (const r of [...new Set([...m.para, ...(m.cc ?? []), ...(m.bcc ?? [])])]) await cmd(`RCPT TO:<${r}>`, "25");
    await cmd("DATA", "354");
    const corpo = montarMime(m).replace(/\r\n\./g, "\r\n..");
    const bytes = enc.encode(corpo + "\r\n.\r\n");
    for (let i = 0; i < bytes.length; i += 32768) await conn.write(bytes.subarray(i, i + 32768));
    const fim = await ler();
    if (!fim.startsWith("250")) throw new Error("Servidor de e-mail não aceitou a mensagem: " + fim.trim().slice(0, 150));
    await conn.write(enc.encode("QUIT\r\n")).catch(() => 0);
  } finally {
    try { conn.close(); } catch { /* já fechada */ }
  }
}
