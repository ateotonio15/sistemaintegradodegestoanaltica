import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, FileDown, FileType, X } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LabelList } from "recharts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AcaoSaude, Triagem } from "../../hooks/useSaudeEmpresas";
import {
  contarTriagens, resumoApresentacao, pctDe, opcoesGrupo, filtrarGrupo, GRUPO_MINIMO, type DimensaoGrupo,
} from "../../lib/apresentacao-saude";
import { exportRelatorioPptx } from "../../lib/saude-export";
import bgCapaAsset from "@/assets/saude_bg_capa.png.asset.json";
import bgConteudoAsset from "@/assets/saude_bg_conteudo.png.asset.json";

const COR = {
  verde: "var(--ap-verde)", petroleo: "var(--ap-petroleo)", cinza: "var(--ap-cinza)",
  ok: "var(--ap-ok)", okEscuro: "var(--ap-ok-escuro)", atencao: "var(--ap-atencao)", alerta: "var(--ap-alerta)", prioridade: "var(--ap-prioridade)",
};
const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const pl = (n: number, s: string, p: string) => (n === 1 ? s : p);

// ---------------- utilidades visuais ----------------
function useCountUp(alvo: number, ativo: boolean, ms = 900) {
  const [v, setV] = useState(ativo ? 0 : alvo);
  useEffect(() => {
    if (!ativo) { setV(alvo); return; }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(alvo); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(alvo * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ativo, ms]);
  return v;
}

const Cartao = ({ children, className = "", onClick, ativo }: { children: ReactNode; className?: string; onClick?: () => void; ativo?: boolean }) => (
  <div
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    className={`ap-cartao rounded-2xl p-5 transition-shadow ${onClick ? "cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ap-verde)]" : ""} ${ativo ? "ring-2 ring-[color:var(--ap-verde)]" : ""} ${className}`}
  >
    {children}
  </div>
);

const entrada = (i: number, estatico?: boolean) => (estatico ? {} : {
  initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay: 0.08 * i },
});

function Pagina({ titulo, n, children, nota, filtro }: { titulo: string; n: number; children: ReactNode; nota?: ReactNode; filtro?: ReactNode }) {
  return (
    <div className="ap-pagina flex min-h-full w-full flex-col px-5 lg:h-full pb-3 pt-5 sm:px-10 sm:pt-8" style={{ backgroundImage: `url(${bgConteudoAsset.url})` }}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <h2 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-[34px]" style={{ color: COR.petroleo }}>{titulo}</h2>
        {filtro}
      </div>
      <div className="mt-5 min-h-0 flex-1">{children}</div>
      {nota && <p className="mt-3 text-xs sm:text-[13px]" style={{ color: COR.cinza }}>{nota}</p>}
      <div className="mt-2 flex justify-between text-xs" style={{ color: COR.cinza }}>
        <span>Samel · Programa Saúde nas Empresas</span><span>{n}</span>
      </div>
    </div>
  );
}

function SeletorNumPct({ modo, onChange }: { modo: "n" | "p"; onChange: (m: "n" | "p") => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border bg-white/80 text-sm" style={{ borderColor: "var(--ap-borda)" }}>
      {(["n", "p"] as const).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)} className="px-3 py-1 font-semibold transition-colors"
          style={modo === m ? { background: COR.verde, color: "white" } : { color: COR.petroleo }}>
          {m === "n" ? "Nº" : "%"}
        </button>
      ))}
    </div>
  );
}

function BalaoTooltip({ active, payload, base }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-lg" style={{ color: COR.petroleo }}>
      <div className="font-semibold">{d.l}</div>
      <div>{d.v} {pl(d.v, "colaborador", "colaboradores")} · {pctDe(d.v, base)}%</div>
    </div>
  );
}

// ---------------- filtro por grupo ----------------
interface FiltroEstado { dim: DimensaoGrupo | null; valor: string | null }
const DIM_LABEL: Record<DimensaoGrupo, string> = { setor: "Setor", sexo: "Sexo", faixa: "Faixa etária" };

function FiltroGrupo({ opcoes, f, onChange }: { opcoes: ReturnType<typeof opcoesGrupo>; f: FiltroEstado; onChange: (f: FiltroEstado) => void }) {
  const dims = Object.keys(opcoes) as DimensaoGrupo[];
  if (!dims.length) return null;
  return (
    <div className="ap-sem-print flex flex-wrap items-center gap-2">
      <Select value={f.dim ?? "todos"} onValueChange={(v) => onChange({ dim: v === "todos" ? null : (v as DimensaoGrupo), valor: null })}>
        <SelectTrigger className="h-9 w-[150px] bg-white/90"><SelectValue placeholder="Todos" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os grupos</SelectItem>
          {dims.map((d) => <SelectItem key={d} value={d}>{DIM_LABEL[d]}</SelectItem>)}
        </SelectContent>
      </Select>
      {f.dim && (
        <Select value={f.valor ?? undefined} onValueChange={(v) => onChange({ ...f, valor: v })}>
          <SelectTrigger className="h-9 w-[190px] bg-white/90"><SelectValue placeholder={`Escolha o ${DIM_LABEL[f.dim].toLowerCase()}`} /></SelectTrigger>
          <SelectContent>
            {(opcoes[f.dim] ?? []).map((o) => <SelectItem key={o.valor} value={o.valor}>{o.valor}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

const GrupoPequeno = () => (
  <div className="flex h-full min-h-[200px] items-center justify-center">
    <Cartao className="max-w-md text-center">
      <p className="text-lg font-semibold" style={{ color: COR.petroleo }}>Grupo pequeno demais para exibir</p>
      <p className="mt-1 text-sm" style={{ color: COR.cinza }}>Para proteger a privacidade, só mostramos grupos com {GRUPO_MINIMO} ou mais colaboradores.</p>
    </Cartao>
  </div>
);

// ---------------- dados derivados ----------------
function useDados(triagens: Triagem[]) {
  return useMemo(() => {
    const c = contarTriagens(triagens);
    return { c, r: resumoApresentacao(c) };
  }, [triagens]);
}
type Dados = ReturnType<typeof useDados>;

// ---------------- slides ----------------
function SlideCapa({ acao, total }: { acao: AcaoSaude; total: number }) {
  return (
    <div className="ap-pagina flex h-full w-full items-center px-6 sm:px-14" style={{ backgroundImage: `url(${bgCapaAsset.url})` }}>
      <motion.div {...entrada(0)} className="max-w-[60%] space-y-3 pt-10 max-sm:max-w-full max-sm:rounded-2xl max-sm:bg-white/85 max-sm:p-4">
        <h1 className="text-3xl font-bold leading-tight sm:text-[40px]" style={{ color: COR.petroleo }}>Resultados da Campanha de Saúde</h1>
        <p className="text-xl font-bold sm:text-[22px]" style={{ color: COR.verde }}>{(acao.empresa?.nome ?? "Empresa").toUpperCase()}</p>
        <p className="text-base" style={{ color: COR.petroleo }}>Apresentação à diretoria · Ação realizada em {dataBR(acao.data_acao)}</p>
        <p className="text-sm" style={{ color: COR.cinza }}>
          Enfermeira responsável: {acao.enfermeira_nome ?? "Lorenn Brandão — COREN-AM 977.099"} · {total} {pl(total, "colaborador triado", "colaboradores triados")}
        </p>
      </motion.div>
    </div>
  );
}

function KpiNumero({ valor, sufixo = "", ativo, cor }: { valor: number; sufixo?: string; ativo: boolean; cor: string }) {
  const v = useCountUp(valor, ativo);
  return <div className="whitespace-nowrap text-5xl font-bold sm:text-6xl" style={{ color: cor }}>{v}{sufixo}</div>;
}

function SlideNumeros({ d, n, ativo, estatico }: { d: Dados; n: number; ativo: boolean; estatico?: boolean }) {
  const { c, r } = d;
  const [aberto, setAberto] = useState<number | null>(null);
  const kpis = [
    { v: c.total, s: "", cor: COR.petroleo, l: "Colaboradores triados", sub: "Participação na ação",
      exp: "Quantidade de colaboradores que passaram pela triagem nesta ação.", base: `Base: ${c.total} triados.` },
    { v: r.pctPaAlt, s: "%", cor: COR.prioridade, l: "Com PA alterada", sub: `${r.paAlt} de ${r.basePa} aferidos`,
      exp: "Colaboradores com pressão elevada ou em faixa de hipertensão identificada na triagem. Sugere acompanhamento.", base: `Base: ${r.basePa} aferições de PA. ${r.paNR} sem aferição ficaram fora do cálculo.` },
    { v: r.pctGliAlt, s: "%", cor: COR.prioridade, l: "Com glicemia alterada", sub: `${r.gliAlt} de ${r.baseGli} avaliados`,
      exp: "Colaboradores com glicemia em faixa de pré-diabetes, alterada pós-prandial ou diabetes identificada na triagem.", base: `Base: ${r.baseGli} avaliações de glicemia. ${r.gliNR} sem aferição ficaram fora do cálculo.` },
    { v: c.encaminhamentos, s: "", cor: COR.atencao, l: "Encaminhamentos", sub: `${r.pctEnc}% do total triado`,
      exp: "Colaboradores com ao menos uma alteração (PA ou glicemia) encaminhados para acompanhamento.", base: `Base: ${c.total} triados. Cada colaborador conta uma vez.` },
  ];
  return (
    <Pagina titulo={r.tituloNumeros} n={n} nota={<>Base de cálculo: {r.basePa} aferições de PA e {r.baseGli} de glicemia. Resultados referem-se exclusivamente aos colaboradores avaliados nesta ação. <strong>Triagem não substitui avaliação médica.</strong></>}>
      <div className="grid h-full grid-cols-1 content-center gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div key={k.l} {...entrada(i, estatico)}>
            <Cartao onClick={estatico ? undefined : () => setAberto(i)} className="flex min-h-[180px] flex-col items-center justify-center text-center lg:min-h-[260px]">
              <KpiNumero valor={k.v} sufixo={k.s} ativo={ativo && !estatico} cor={k.cor} />
              <div className="mt-3 text-base font-bold sm:text-lg" style={{ color: COR.petroleo }}>{k.l}</div>
              <div className="text-sm" style={{ color: COR.cinza }}>{k.sub}</div>
            </Cartao>
          </motion.div>
        ))}
      </div>
      {!estatico && (
        <Sheet open={aberto !== null} onOpenChange={(o) => !o && setAberto(null)}>
          <SheetContent className="z-[120]">
            {aberto !== null && (
              <SheetHeader>
                <SheetTitle>{kpis[aberto].l}</SheetTitle>
                <SheetDescription className="space-y-3 text-left">
                  <span className="block text-base">{kpis[aberto].exp}</span>
                  <span className="block">{kpis[aberto].base}</span>
                  <span className="block italic">Triagem não substitui avaliação médica.</span>
                </SheetDescription>
              </SheetHeader>
            )}
          </SheetContent>
        </Sheet>
      )}
    </Pagina>
  );
}

const TEXTO_GLI: Record<string, { cor: string; sig: string; rec: string }> = {
  Normal: { cor: COR.ok, sig: "Glicemia dentro do esperado na triagem.", rec: "Manter hábitos saudáveis e o monitoramento periódico." },
  "Pré-diabetes": { cor: COR.atencao, sig: "Fase ainda reversível com mudança de hábitos.", rec: "Sugere intervenção de estilo de vida: alimentação, atividade física e reavaliação." },
  "Alterada pós-prandial": { cor: COR.alerta, sig: "Valor acima do esperado após refeição.", rec: "Sugere nova aferição em jejum para confirmar o resultado." },
  Diabetes: { cor: COR.prioridade, sig: "Valor na faixa de diabetes identificado na triagem.", rec: "Sugere avaliação clínica prioritária e acompanhamento formal." },
};

function SlideGlicemia({ d, n, filtro, pequeno, estatico }: { d: Dados; n: number; filtro?: ReactNode; pequeno: boolean; estatico?: boolean }) {
  const { c, r } = d;
  const [modo, setModo] = useState<"n" | "p">("n");
  const [sel, setSel] = useState<string | null>(null);
  const g = c.gliCounts;
  const dados = [
    { l: "Normal", v: g["Normal"] ?? 0, cor: COR.ok },
    { l: "Pré-diabetes", v: g["Pré-Diabetes"] ?? 0, cor: COR.atencao },
    { l: "Alterada pós-prandial", v: g["Alterada pós-prandial"] ?? 0, cor: COR.alerta },
    { l: "Diabetes", v: g["Diabetes"] ?? 0, cor: COR.prioridade },
  ].filter((x) => x.v > 0);
  const pre = g["Pré-Diabetes"] ?? 0, dia = g["Diabetes"] ?? 0;
  return (
    <Pagina titulo={pequeno ? "Glicemia" : r.tituloGlicemia} n={n} filtro={filtro}
      nota={!pequeno && <>Base: {r.baseGli} avaliados. {r.gliNR} {pl(r.gliNR, "colaborador sem aferição de glicemia ficou", "colaboradores sem aferição de glicemia ficaram")} fora do cálculo.</>}>
      {pequeno ? <GrupoPequeno /> : (
        <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Cartao className="flex min-h-[300px] flex-col">
            {!estatico && <div className="ap-sem-print flex justify-end"><SeletorNumPct modo={modo} onChange={setModo} /></div>}
            <div className="min-h-0 flex-1">
              {dados.length ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                  <PieChart>
                    <Pie data={dados} dataKey="v" nameKey="l" innerRadius="55%" outerRadius="88%" paddingAngle={1} isAnimationActive={!estatico}
                      labelLine={false}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, v }: any) => {
                        const rad = Math.PI / 180, rr = (innerRadius + outerRadius) / 2;
                        return (
                          <text x={cx + rr * Math.cos(-midAngle * rad)} y={cy + rr * Math.sin(-midAngle * rad)} fill="white" fontWeight={700} fontSize={16} textAnchor="middle" dominantBaseline="central">
                            {modo === "n" ? v : `${pctDe(v, r.baseGli)}%`}
                          </text>
                        );
                      }}
                      onClick={(x: any) => setSel((s) => (s === x.l ? null : x.l))}>
                      {dados.map((x) => <Cell key={x.l} fill={x.cor} stroke="white" strokeWidth={2} opacity={sel && sel !== x.l ? 0.35 : 1} className="cursor-pointer" />)}
                    </Pie>
                    <Tooltip content={<BalaoTooltip base={r.baseGli} />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="flex h-full items-center justify-center" style={{ color: COR.cinza }}>Sem aferições de glicemia neste grupo</p>}
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm" style={{ color: COR.petroleo }}>
              {dados.map((x) => (
                <button key={x.l} type="button" onClick={() => setSel((s) => (s === x.l ? null : x.l))} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: x.cor }} />{x.l}
                </button>
              ))}
            </div>
          </Cartao>
          <div className="grid grid-cols-1 gap-4">
            {sel ? (
              <motion.div key={sel} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                <Cartao className="h-full">
                  <div className="text-5xl font-bold" style={{ color: TEXTO_GLI[sel].cor }}>{pctDe(dados.find((x) => x.l === sel)?.v ?? 0, r.baseGli)}%</div>
                  <div className="mt-2 text-lg font-bold" style={{ color: COR.petroleo }}>{dados.find((x) => x.l === sel)?.v ?? 0} · {sel}</div>
                  <p className="mt-2" style={{ color: COR.petroleo }}><strong>O que significa:</strong> {TEXTO_GLI[sel].sig}</p>
                  <p className="mt-1" style={{ color: COR.petroleo }}><strong>O que recomendar:</strong> {TEXTO_GLI[sel].rec}</p>
                  <button type="button" onClick={() => setSel(null)} className="ap-sem-print mt-3 text-sm underline" style={{ color: COR.cinza }}>Voltar ao resumo</button>
                </Cartao>
              </motion.div>
            ) : (
              [
                { p: pctDe(pre, r.baseGli), cor: COR.atencao, a: `${pre} ${pl(pre, "colaborador com pré-diabetes", "colaboradores com pré-diabetes")}`, b: "Fase ainda reversível com mudança de hábitos" },
                { p: pctDe(dia, r.baseGli), cor: COR.prioridade, a: `${dia} ${pl(dia, "colaborador na faixa de diabetes", "colaboradores na faixa de diabetes")}`, b: "Sugere avaliação clínica prioritária" },
              ].map((k, i) => (
                <motion.div key={k.a} {...entrada(i + 1, estatico)}>
                  <Cartao className="h-full">
                    <div className="text-5xl font-bold" style={{ color: k.cor }}>{k.p}%</div>
                    <div className="mt-2 text-lg font-bold" style={{ color: COR.petroleo }}>{k.a}</div>
                    <div style={{ color: COR.cinza }}>{k.b}</div>
                  </Cartao>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}
    </Pagina>
  );
}

const TEXTO_PA: Record<string, { grupo: string; txt: string }> = {
  "Ótima": { grupo: "Dentro do esperado", txt: "Manter o monitoramento periódico." },
  Normal: { grupo: "Dentro do esperado", txt: "Manter o monitoramento periódico." },
  "PA elevada": { grupo: "Acompanhamento preventivo", txt: "Sugere mudança de hábitos e nova aferição." },
  "Estágio 1": { grupo: "Acompanhamento preventivo", txt: "Sugere acompanhamento e reavaliação da pressão." },
  "Estágio 2": { grupo: "Prioridade clínica", txt: "Sugere avaliação clínica e acompanhamento formal pela Medicina do Trabalho." },
  "Estágio 3": { grupo: "Prioridade clínica", txt: "Sugere avaliação clínica imediata e acompanhamento formal." },
};

function SlidePa({ d, n, filtro, pequeno, estatico }: { d: Dados; n: number; filtro?: ReactNode; pequeno: boolean; estatico?: boolean }) {
  const { c, r } = d;
  const [modo, setModo] = useState<"n" | "p">("n");
  const [sel, setSel] = useState<string | null>(null);
  const p = c.paCounts;
  const dados = [
    { l: "Ótima", v: p["Ótima"] ?? 0, cor: COR.okEscuro },
    { l: "Normal", v: p["Normal"] ?? 0, cor: COR.ok },
    { l: "PA elevada", v: p["PA Elevada"] ?? 0, cor: COR.atencao },
    { l: "Estágio 1", v: p["Hipertensão Estágio 1"] ?? 0, cor: COR.alerta },
    { l: "Estágio 2", v: p["Hipertensão Estágio 2"] ?? 0, cor: COR.prioridade },
    { l: "Estágio 3", v: p["Hipertensão Estágio 3"] ?? 0, cor: COR.prioridade },
  ].map((x) => ({ ...x, rot: modo === "n" ? String(x.v) : `${pctDe(x.v, r.basePa)}%` }));
  const cards = [
    { n: r.paOk, cor: COR.ok, a: `dentro do esperado (${pctDe(r.paOk, r.basePa)}%)`, b: "Ótima ou normal", g: "Dentro do esperado" },
    { n: r.paAtencao, cor: COR.atencao, a: "com PA elevada ou hipertensão estágio 1", b: "Acompanhamento preventivo", g: "Acompanhamento preventivo" },
    { n: r.paGrave, cor: COR.prioridade, a: "com hipertensão estágio 2 ou 3", b: "Prioridade clínica", g: "Prioridade clínica" },
  ];
  const grupoSel = sel ? TEXTO_PA[sel].grupo : null;
  return (
    <Pagina titulo={pequeno ? "Pressão arterial" : r.tituloPa} n={n} filtro={filtro}
      nota={!pequeno && <>Base: {r.basePa} aferidos. {r.paNR} {pl(r.paNR, "colaborador", "colaboradores")} sem aferição de PA.</>}>
      {pequeno ? <GrupoPequeno /> : (
        <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[1.25fr_1fr]">
          <Cartao className="flex min-h-[300px] flex-col">
            {!estatico && <div className="ap-sem-print flex justify-end"><SeletorNumPct modo={modo} onChange={setModo} /></div>}
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 48, top: 6, bottom: 6 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="l" width={92} axisLine={false} tickLine={false} tick={{ fill: "var(--ap-petroleo)", fontSize: 14 }} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<BalaoTooltip base={r.basePa} />} />
                  <Bar dataKey="v" radius={[0, 6, 6, 0]} isAnimationActive={!estatico} onClick={(x: any) => setSel((s) => (s === x.l ? null : x.l))}>
                    {dados.map((x) => <Cell key={x.l} fill={x.cor} opacity={sel && sel !== x.l ? 0.35 : 1} className="cursor-pointer" />)}
                    <LabelList dataKey="rot" position="right" style={{ fill: "var(--ap-petroleo)", fontWeight: 700, fontSize: 14 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {sel && (
              <motion.p key={sel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-white/70 p-3 text-sm" style={{ color: COR.petroleo }}>
                <strong>{sel} · {TEXTO_PA[sel].grupo}:</strong> {dados.find((x) => x.l === sel)?.v} {pl(dados.find((x) => x.l === sel)?.v ?? 0, "colaborador", "colaboradores")} ({pctDe(dados.find((x) => x.l === sel)?.v ?? 0, r.basePa)}%). {TEXTO_PA[sel].txt}
              </motion.p>
            )}
          </Cartao>
          <div className="grid grid-cols-1 gap-3">
            {cards.map((k, i) => (
              <motion.div key={k.b} {...entrada(i + 1, estatico)}>
                <Cartao ativo={grupoSel === k.g} className="flex h-full items-center gap-4">
                  <div className="w-20 shrink-0 whitespace-nowrap text-center text-4xl font-bold" style={{ color: k.cor }}>{k.n}</div>
                  <div><div className="font-bold" style={{ color: COR.petroleo }}>{k.a}</div><div className="text-sm" style={{ color: COR.cinza }}>{k.b}</div></div>
                </Cartao>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Pagina>
  );
}

function SlideAgir({ d, n, filtro, pequeno, estatico }: { d: Dados; n: number; filtro?: ReactNode; pequeno: boolean; estatico?: boolean }) {
  const { c, r } = d;
  const [aberto, setAberto] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const g = c.gliCounts, p = c.paCounts;
  const naoEnc = Math.max(0, c.total - c.encaminhamentos);
  const rosca = [{ l: "Encaminhados", v: c.encaminhamentos, cor: COR.atencao }, { l: "Não encaminhados", v: naoEnc, cor: COR.ok }].filter((x) => x.v > 0);
  const faixas = [
    { cor: COR.prioridade, t: "PRIORIDADE CLÍNICA", a: `${g["Diabetes"] ?? 0} na faixa de diabetes · ${r.paGrave} com hipertensão estágio 2 ou 3`,
      acao: "Sugere avaliação clínica e acompanhamento formal pela Medicina do Trabalho",
      quebra: [["Glicemia na faixa de diabetes", g["Diabetes"] ?? 0], ["Hipertensão estágio 2", p["Hipertensão Estágio 2"] ?? 0], ["Hipertensão estágio 3", p["Hipertensão Estágio 3"] ?? 0]] },
    { cor: COR.atencao, t: "ATENÇÃO", a: `${g["Pré-Diabetes"] ?? 0} com pré-diabetes · ${r.paAtencao} com PA elevada ou estágio 1`,
      acao: "Intervenção de estilo de vida: ainda é possível reverter o quadro",
      quebra: [["Pré-diabetes", g["Pré-Diabetes"] ?? 0], ["Glicemia alterada pós-prandial", g["Alterada pós-prandial"] ?? 0], ["PA elevada", p["PA Elevada"] ?? 0], ["Hipertensão estágio 1", p["Hipertensão Estágio 1"] ?? 0]] },
    { cor: COR.ok, t: "DENTRO DO ESPERADO", a: `${g["Normal"] ?? 0} com glicemia normal · ${r.paOk} com PA ótima ou normal`,
      acao: "Manter o monitoramento periódico",
      quebra: [["Glicemia normal", g["Normal"] ?? 0], ["PA ótima", p["Ótima"] ?? 0], ["PA normal", p["Normal"] ?? 0]] },
  ] as const;
  const titulo = `Onde agir primeiro: ${c.encaminhamentos} ${pl(c.encaminhamentos, "colaborador foi encaminhado", "colaboradores foram encaminhados")}`;
  return (
    <Pagina titulo={pequeno ? "Onde agir primeiro" : titulo} n={n} filtro={filtro}
      nota={!pequeno && "Contagens por indicador; um mesmo colaborador pode aparecer em mais de uma linha."}>
      {pequeno ? <GrupoPequeno /> : (
        <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[0.8fr_1.4fr]">
          <Cartao className="flex min-h-[280px] flex-col items-center justify-center">
            <div className="relative h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rosca} dataKey="v" nameKey="l" innerRadius="68%" outerRadius="92%" isAnimationActive={!estatico}
                    onMouseEnter={(_: any, i: number) => setHover(i)} onMouseLeave={() => setHover(null)}>
                    {rosca.map((x, i) => <Cell key={x.l} fill={x.cor} stroke="white" strokeWidth={2} opacity={hover !== null && hover !== i ? 0.4 : 1} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-bold" style={{ color: COR.petroleo }}>{hover !== null && rosca[hover] ? pctDe(rosca[hover].v, c.total) : r.pctEnc}%</span>
                <span className="text-xs" style={{ color: COR.cinza }}>{hover !== null && rosca[hover] ? `${rosca[hover].v} ${rosca[hover].l.toLowerCase()}` : "encaminhados"}</span>
              </div>
            </div>
            <p className="mt-2 text-center text-sm" style={{ color: COR.cinza }}>do total triado foi encaminhado para acompanhamento</p>
          </Cartao>
          <div className="grid grid-cols-1 gap-3">
            {faixas.map((k, i) => (
              <motion.div key={k.t} {...entrada(i + 1, estatico)} layout={!estatico}>
                <Cartao onClick={estatico ? undefined : () => setAberto((a) => (a === i ? null : i))} ativo={aberto === i}>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: k.cor }} />
                    <span className="text-sm font-bold tracking-wide" style={{ color: k.cor }}>{k.t}</span>
                  </div>
                  <div className="mt-1 font-bold" style={{ color: COR.petroleo }}>{k.a}</div>
                  <div className="text-sm" style={{ color: COR.cinza }}>{k.acao}</div>
                  <AnimatePresence>
                    {aberto === i && (
                      <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 overflow-hidden border-t pt-2 text-sm" style={{ color: COR.petroleo, borderColor: "var(--ap-borda)" }}>
                        {k.quebra.map(([l, v]) => <li key={l} className="flex justify-between py-0.5"><span>{l}</span><strong>{v}</strong></li>)}
                        <li className="pt-2"><strong>Ação recomendada:</strong> {k.acao}.</li>
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </Cartao>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Pagina>
  );
}

const IMPACTO = [
  { t: "Afastamentos", d: "Diabetes e hipertensão sem acompanhamento são causas frequentes de afastamento e de complicações agudas.",
    mais: ["Esses quadros costumam evoluir sem sintomas por muito tempo.", "Identificar cedo permite acompanhar antes que surja uma complicação."] },
  { t: "Produtividade", d: "Quadros metabólicos não controlados reduzem a disposição e aumentam o absenteísmo e as paradas na operação.",
    mais: ["Cansaço e mal-estar frequentes afetam o ritmo das equipes.", "O acompanhamento ajuda o colaborador a manter a rotina de trabalho."] },
  { t: "Custo assistencial", d: "Intervir na fase de pré-diabetes e de PA elevada é simples e de baixo custo, e evita tratamentos complexos depois.",
    mais: ["Orientação, mudança de hábitos e reavaliação são medidas simples.", "Tratar complicações já instaladas é bem mais complexo."] },
];

function SlideImpacto({ n, estatico }: { n: number; estatico?: boolean }) {
  const [aberto, setAberto] = useState<number | null>(null);
  return (
    <Pagina titulo="Achados silenciosos hoje viram afastamentos amanhã" n={n}>
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {IMPACTO.map((k, i) => (
            <motion.div key={k.t} {...entrada(i, estatico)} layout={!estatico}>
              <Cartao onClick={estatico ? undefined : () => setAberto((a) => (a === i ? null : i))} ativo={aberto === i} className="h-full">
                <div className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: COR.verde }}>{i + 1}</div>
                <div className="mt-3 text-xl font-bold" style={{ color: COR.petroleo }}>{k.t}</div>
                <p className="mt-1" style={{ color: COR.petroleo }}>{k.d}</p>
                <AnimatePresence>
                  {aberto === i && (
                    <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 list-disc overflow-hidden pl-5 text-sm" style={{ color: COR.cinza }}>
                      {k.mais.map((m) => <li key={m}>{m}</li>)}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </Cartao>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-lg italic" style={{ color: COR.verde }}>A atuação preventiva sobre esse perfil tende a reduzir afastamentos e custos assistenciais no médio prazo.</p>
      </div>
    </Pagina>
  );
}

// ---------------- apresentação ----------------
export function ApresentacaoCampanha({ acao, triagens, onClose }: { acao: AcaoSaude; triagens: Triagem[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [filtro, setFiltro] = useState<{ dim: DimensaoGrupo | null; valor: string | null }>({ dim: null, valor: null });
  const raiz = useRef<HTMLDivElement>(null);
  const toque = useRef<{ x: number; y: number } | null>(null);

  const geral = useDados(triagens);
  const opcoes = useMemo(() => opcoesGrupo(triagens), [triagens]);
  const filtrado = useMemo(() => filtrarGrupo(triagens, filtro.dim, filtro.valor), [triagens, filtro]);
  const grupo = useDados(filtrado.triagens);
  const paPrimeiro = geral.r.paPrimeiro;
  const filtroUi = <FiltroGrupo opcoes={opcoes} f={filtro} onChange={setFiltro} />;

  const montar = (estatico: boolean) => {
    const dg = estatico ? geral : grupo;
    const peq = estatico ? false : filtrado.pequeno;
    const fu = estatico ? undefined : filtroUi;
    const gli = (n: number) => <SlideGlicemia key="g" d={dg} n={n} filtro={fu} pequeno={peq} estatico={estatico} />;
    const pa = (n: number) => <SlidePa key="p" d={dg} n={n} filtro={fu} pequeno={peq} estatico={estatico} />;
    return [
      <SlideCapa key="c" acao={acao} total={geral.c.total} />,
      <SlideNumeros key="n" d={geral} n={2} ativo={!estatico && idx === 1} estatico={estatico} />,
      paPrimeiro ? pa(3) : gli(3),
      paPrimeiro ? gli(4) : pa(4),
      <SlideAgir key="a" d={dg} n={5} filtro={fu} pequeno={peq} estatico={estatico} />,
      <SlideImpacto key="i" n={6} estatico={estatico} />,
    ];
  };
  const slides = montar(false);
  const total = slides.length;

  const ir = useCallback((n: number) => {
    setIdx((i) => { const alvo = Math.max(0, Math.min(total - 1, n)); setDir(alvo >= i ? 1 : -1); return alvo; });
  }, [total]);

  const sair = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  }, [onClose]);

  useEffect(() => {
    raiz.current?.requestFullscreen?.().catch(() => {});
    const onFs = () => { if (!document.fullscreenElement) { /* saiu da tela cheia: mantém a apresentação aberta */ } };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo?.closest?.("[role=listbox],[role=dialog]:not(.ap-raiz)")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && alvo?.tagName !== "BUTTON")) { e.preventDefault(); ir(idx + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); ir(idx - 1); }
      else if (e.key === "Escape" && !document.fullscreenElement) sair();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, ir, sair]);

  const exportarPdf = () => { window.print(); };

  useEffect(() => {
    document.body.classList.add("ap-imprimindo");
    return () => document.body.classList.remove("ap-imprimindo");
  }, []);

  return createPortal(
    <div className="ap-portal">
      <div ref={raiz} role="dialog" aria-modal="true" aria-label="Apresentação da campanha"
        className="ap-raiz ap-sem-print fixed inset-0 z-[100] flex flex-col bg-[color:var(--ap-fundo)]"
        onTouchStart={(e) => { toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const t = toque.current; toque.current = null; if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(idx + (dx < 0 ? 1 : -1));
        }}>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-1.5" aria-label={`Slide ${idx + 1} de ${total}`}>
            {slides.map((_, i) => (
              <button key={i} type="button" aria-label={`Ir para o slide ${i + 1}`} onClick={() => ir(i)}
                className="h-2.5 rounded-full transition-all" style={{ width: i === idx ? 22 : 10, background: i === idx ? COR.verde : "var(--ap-borda)" }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportarPdf}><FileDown className="mr-1 h-4 w-4" />Exportar PDF</Button>
            <Button size="sm" variant="ghost" className="max-sm:hidden" onClick={() => exportRelatorioPptx(acao, triagens)}><FileType className="mr-1 h-4 w-4" />PowerPoint</Button>
            <Button size="icon" variant="ghost" aria-label="Sair da apresentação" onClick={sair}><X className="h-5 w-5" /></Button>
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-3 sm:px-6">
          <div className="relative h-full w-full max-w-[1600px] overflow-hidden rounded-xl shadow-xl max-lg:overflow-y-auto lg:aspect-video lg:h-auto lg:max-h-full">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div key={idx} custom={dir} className="h-full min-h-full"
                initial={{ opacity: 0, x: 40 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 * dir }} transition={{ duration: 0.25 }}>
                {slides[idx]}
              </motion.div>
            </AnimatePresence>
          </div>
          {idx > 0 && (
            <button type="button" aria-label="Slide anterior" onClick={() => ir(idx - 1)}
              className="absolute left-0 top-1/2 hidden h-24 w-10 -translate-y-1/2 items-center justify-center rounded-r-xl bg-white/60 opacity-60 transition-opacity hover:opacity-100 sm:flex">
              <ChevronLeft className="h-6 w-6" style={{ color: COR.petroleo }} />
            </button>
          )}
          {idx < total - 1 && (
            <button type="button" aria-label="Próximo slide" onClick={() => ir(idx + 1)}
              className="absolute right-0 top-1/2 hidden h-24 w-10 -translate-y-1/2 items-center justify-center rounded-l-xl bg-white/60 opacity-60 transition-opacity hover:opacity-100 sm:flex">
              <ChevronRight className="h-6 w-6" style={{ color: COR.petroleo }} />
            </button>
          )}
        </div>
      </div>
      {/* Versão estática de 6 páginas usada só para o PDF */}
      <div className="ap-print" aria-hidden="true">
        {montar(true).map((s, i) => <div key={i} className="ap-print-pagina">{s}</div>)}
      </div>
    </div>,
    document.body,
  );
}
