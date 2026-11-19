/** Torna o fundo claro transparente e recorta rente à tinta, sem alterar proporção. */
export async function fundoTransparente(src: string, limiar = 215): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; });
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height); const p = d.data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let i = 0; i < p.length; i += 4) {
    const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    // Transição suave nas bordas: quanto mais claro, mais transparente.
    const alfa = lum >= limiar ? 0 : Math.min(255, Math.round(((limiar - lum) / (limiar - 90)) * 255));
    p[i + 3] = Math.min(p[i + 3], alfa);
    if (p[i + 3] > 30) { const k = i / 4, x = k % c.width, y = (k / c.width) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  ctx.putImageData(d, 0, 0);
  if (x1 < 0) throw new Error("Nenhum traço encontrado");
  const m = Math.round(Math.max(c.width, c.height) * 0.02);
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(c.width - 1, x1 + m); y1 = Math.min(c.height - 1, y1 + m);
  const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext("2d")!.drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return await new Promise<Blob>((ok, err) => o.toBlob((b) => b ? ok(b) : err(new Error("png")), "image/png"));
}
