import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, FileImage, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logo from "@/assets/samel-logo.png.asset.json";
import { calcularRelatorio, gerarDestaques, nomeArquivo, variacao, type AtendRel } from "@/lib/relatorio-atendimentos";

const VERDE = "hsl(var(--rel-verde))";
const VERDE_CLARO = "hsl(var(--rel-verde-claro))";
const fmtData = (d: string) => d.split("-").reverse().join("/");
const fmtN = (n: number) => n.toLocaleString("pt-BR");

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: AtendRel[];
  anteriores: AtendRel[];
  empresa: string;
  de: string;
  ate: string;
  avisoIA: string | null;
}

function Cartao({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className="rel-card">
      <div className="text-[11px] uppercase tracking-wide rel-muted">{titulo}</div>
      <div className="text-2xl font-bold rel-verde mt-1">{valor}</div>
      {sub && <div className="text-xs rel-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function Barras({ dados, altura }: { dados: { nome: string; qtd: number }[]; altura?: number }) {
  const h = altura ?? Math.max(120, dados.length * 26 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={dados} layout="vertical" margin={{ left: 0, right: 30, top: 4, bottom: 4 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="nome" width={170} tick={{ fontSize: 11, fill: "hsl(var(--rel-text))" }} />
        <Bar dataKey="qtd" fill={VERDE} radius={[0, 6, 6, 0]} isAnimationActive={false}>
          <LabelList dataKey="qtd" position="right" style={{ fontSize: 11, fill: "hsl(var(--rel-text))" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RelatorioVisualAtendimentos({ open, onOpenChange, rows, anteriores, empresa, de, ate, avisoIA }: Props) {
  const r = useMemo(() => calcularRelatorio(rows), [rows]);
  const ant = useMemo(() => (anteriores.length ? calcularRelatorio(anteriores) : null), [anteriores]);
  const destaques = useMemo(() => gerarDestaques(r, ant), [r, ant]);
  const p1 = useRef<HTMLDivElement>(null);
  const p2 = useRef<HTMLDivElement>(null);
  const doc = useRef<HTMLDivElement>(null);
  const [exportando, setExportando] = useState<string | null>(null);
  const arquivo = nomeArquivo(empresa, de, ate);
  const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Manaus" });

  const capturar = (el: HTMLElement) => toPng(el, { pixelRatio: 2, cacheBust: true, backgroundColor: "#f5f8f5" });

  const baixarPng = async () => {
    if (!doc.current) return;
    setExportando("png");
    try {
      const url = await capturar(doc.current);
      const a = document.createElement("a"); a.href = url; a.download = `${arquivo}.png`; a.click();
    } catch { toast.error("Não foi possível gerar a imagem."); } finally { setExportando(null); }
  };

  const baixarPdf = async () => {
    setExportando("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      pdf.setProperties({ title: "Relatório de Atendimentos", author: "SIGA", subject: "", keywords: "", creator: "SIGA" });
      const paginas = [p1.current, p2.current].filter(Boolean) as HTMLElement[];
      for (let i = 0; i < paginas.length; i++) {
        const el = paginas[i];
        const url = await capturar(el);
        const larg = 200, alt = (el.offsetHeight / el.offsetWidth) * larg;
        const escala = Math.min(1, 287 / alt);
        if (i > 0) pdf.addPage();
        pdf.addImage(url, "PNG", 5 + (larg - larg * escala) / 2, 5, larg * escala, alt * escala);
      }
      pdf.save(`${arquivo}.pdf`);
    } catch { toast.error("Não foi possível gerar o PDF."); } finally { setExportando(null); }
  };

  const baixarExcel = () => {
    const linhas = [...rows].sort((a, b) => (a.data + (a.hora ?? "")).localeCompare(b.data + (b.hora ?? ""))).map((x) => ({
      Data: fmtData(x.data), Hora: x.hora ?? "", Tipo: x.tipo, Canal: x.canal,
      Status: x.resolvido ? "Resolvido" : "Em aberto", Motivo: x.motivo ?? "Outros", Especialidade: x.especialidade ?? "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Atendimentos");
    wb.Props = { Title: "Relatório de Atendimentos", Author: "SIGA" };
    XLSX.writeFile(wb, `${arquivo}.xlsx`);
  };

  const vTotal = ant ? variacao(r.total, ant.total) : null;
  const vRes = ant ? Math.round((r.pctResolvidos - ant.pctResolvidos) * 10) / 10 : null;
  const Seta = ({ v }: { v: number | null }) => v === null ? null : v >= 0
    ? <ArrowUp className="inline h-4 w-4 rel-verde" /> : <ArrowDown className="inline h-4 w-4 rel-negativo" />;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[880px] max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Relatório de Atendimentos</DialogTitle></DialogHeader>
        {avisoIA && <div className="rounded-md border border-border bg-muted p-2 text-xs">{avisoIA}</div>}
        {r.total === 0 ? (
          <div className="p-10 text-center text-muted-foreground">Nenhum atendimento encontrado no período e empresa selecionados. Ajuste os filtros para gerar o relatório.</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={baixarExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Baixar Excel anonimizado</Button>
              <Button variant="outline" size="sm" onClick={baixarPng} disabled={!!exportando}>{exportando === "png" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileImage className="h-4 w-4 mr-1" />} Baixar PNG</Button>
              <Button size="sm" onClick={baixarPdf} disabled={!!exportando}>{exportando === "pdf" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />} Baixar PDF</Button>
            </div>
            {r.total < 5 && <div className="rounded-md border border-border bg-muted p-2 text-xs">Amostra pequena: menos de 5 atendimentos no período. Interprete os percentuais com cautela.</div>}

            <div ref={doc} className="relatorio-doc rounded-lg" style={{ width: 800 }}>
              <div ref={p1} className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "hsl(var(--rel-border))" }}>
                  <img src={logo.url} alt="Samel" className="h-10" crossOrigin="anonymous" />
                  <div className="text-right">
                    <div className="text-xl font-bold rel-verde">Relatório de Atendimentos</div>
                    <div className="text-sm font-semibold">{empresa || "Todas as empresas"}</div>
                    <div className="text-xs rel-muted">Período: {fmtData(de)} a {fmtData(ate)} · Gerado em {geradoEm}</div>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  <Cartao titulo="Atendimentos" valor={fmtN(r.total)} />
                  <Cartao titulo="Clientes únicos" valor={fmtN(r.clientesUnicos)} />
                  <Cartao titulo="Resolvidos" valor={`${fmtN(r.pctResolvidos)}%`} sub={`${r.resolvidos} de ${r.total}`} />
                  <Cartao titulo="Média por dia" valor={fmtN(r.mediaPorDia)} sub={`${r.diasComRegistro} dia(s) com registro`} />
                  <Cartao titulo="Dúvidas app Samel" valor={fmtN(r.app)} sub={`${fmtN(r.pctApp)}% do total`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rel-card">
                    <div className="text-sm font-semibold mb-2">Atendimentos por dia</div>
                    <ResponsiveContainer width="100%" height={170}>
                      <LineChart data={r.porDia.map((d) => ({ dia: fmtData(d.nome).slice(0, 5), qtd: d.qtd }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--rel-border))" />
                        <XAxis dataKey="dia" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
                        <Line dataKey="qtd" stroke={VERDE} strokeWidth={2} dot={{ r: 3, fill: VERDE }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rel-card">
                    <div className="text-sm font-semibold mb-2">Horário de pico</div>
                    {r.porHora.length ? (
                      <>
                        <ResponsiveContainer width="100%" height={145}>
                          <BarChart data={r.porHora.map((h) => ({ h: `${h.hora}h`, qtd: h.qtd }))}>
                            <XAxis dataKey="h" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
                            <Bar dataKey="qtd" fill={VERDE_CLARO} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                        {r.pico && <div className="text-xs rel-muted">Maior concentração: {r.pico.inicio}h às {r.pico.fim}h ({r.pico.qtd} atendimentos)</div>}
                      </>
                    ) : <div className="text-xs rel-muted">Sem horário registrado.</div>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rel-card"><div className="text-sm font-semibold mb-2">Motivo do atendimento</div><Barras dados={r.motivos} /></div>
                  <div className="rel-card">
                    <div className="text-sm font-semibold mb-2">Consultas por especialidade ({r.totalConsultas})</div>
                    {r.especialidades.length ? <Barras dados={r.especialidades} /> : <div className="text-xs rel-muted">Nenhuma consulta com especialista no período.</div>}
                  </div>
                </div>
              </div>

              <div ref={p2} className="p-6 pt-2 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rel-card">
                    <div className="text-sm font-semibold mb-2">Canal de atendimento</div>
                    <div className="flex h-7 rounded-full overflow-hidden text-[11px] font-semibold">
                      {r.canais.map((c, i) => (
                        <div key={c.nome} className={`${i === 0 ? "rel-bg-verde" : "rel-bg-verde-claro"} flex items-center justify-center`} style={{ width: `${Math.max(c.pct, 8)}%` }}>{fmtN(c.pct)}%</div>
                      ))}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs">{r.canais.map((c) => <span key={c.nome}>{c.nome}: <b>{c.qtd}</b></span>)}</div>
                  </div>
                  <div className="rel-card">
                    <div className="text-sm font-semibold mb-2">Tipo e status</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">{r.tipos.map((t) => <div key={t.nome} className="flex justify-between"><span>{t.nome}</span><b>{t.qtd}</b></div>)}</div>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>Resolvidos</span><b className="rel-verde">{r.resolvidos}</b></div>
                        <div className="flex justify-between"><span>Em aberto</span><b className="rel-alerta">{r.abertos}</b></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rel-card">
                    <div className="text-sm font-semibold mb-2">Em aberto</div>
                    {r.abertos === 0 ? <div className="text-xs rel-verde font-medium">Nenhuma pendência em aberto.</div> : (
                      <div className="space-y-1 text-xs">
                        <div className="rel-muted">{r.abertos} atendimento(s) em acompanhamento:</div>
                        {r.abertosPorMotivo.map((m) => <div key={m.nome} className="flex justify-between"><span>{m.nome}</span><b>{m.qtd}</b></div>)}
                      </div>
                    )}
                  </div>
                  {ant && (
                    <div className="rel-card">
                      <div className="text-sm font-semibold mb-2">Comparativo com o período anterior</div>
                      <div className="text-xs space-y-1.5">
                        <div className="flex justify-between"><span>Atendimentos</span><span><b>{ant.total} → {r.total}</b> <Seta v={vTotal} /> {vTotal !== null && `${fmtN(Math.abs(vTotal))}%`}</span></div>
                        <div className="flex justify-between"><span>% resolvidos</span><span><b>{fmtN(ant.pctResolvidos)}% → {fmtN(r.pctResolvidos)}%</b> <Seta v={vRes} /> {vRes !== null && `${fmtN(Math.abs(vRes))} p.p.`}</span></div>
                      </div>
                    </div>
                  )}
                </div>
                {destaques.length > 0 && (
                  <div className="rel-card">
                    <div className="text-sm font-semibold mb-2">Destaques e pontos de atenção</div>
                    <ul className="list-disc pl-5 text-xs space-y-1">{destaques.map((d) => <li key={d}>{d}</li>)}</ul>
                  </div>
                )}
                <div className="text-[10px] rel-muted text-center pt-1">Fonte: SIGA. Dados pessoais omitidos conforme a LGPD.</div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
