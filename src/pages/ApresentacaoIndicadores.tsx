import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gauge,
  Heart,
  LayoutDashboard,
  Network,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";

// ------------------------------------------------------------
// Design tokens (paleta azul-escuro / slate / teal / âmbar)
// ------------------------------------------------------------
const C = {
  bg: "#0B1220",
  panel: "#0F172A",
  panel2: "#111C33",
  border: "rgba(148,163,184,0.14)",
  borderStrong: "rgba(148,163,184,0.28)",
  text: "#E2E8F0",
  muted: "#94A3B8",
  teal: "#2DD4BF",
  tealSoft: "rgba(45,212,191,0.14)",
  green: "#10B981",
  amber: "#F59E0B",
  amberSoft: "rgba(245,158,11,0.14)",
  red: "#EF4444",
  redSoft: "rgba(239,68,68,0.14)",
  blue: "#3B82F6",
  blueSoft: "rgba(59,130,246,0.14)",
};

const SECTIONS = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { id: "desempenho", label: "Desempenho", icon: Gauge },
  { id: "setores", label: "Setores & Motivos", icon: BarChart3 },
  { id: "risco", label: "Matriz de Risco", icon: ShieldAlert },
  { id: "ranking", label: "Ranking Empresas", icon: Users },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

// ------------------------------------------------------------
// Página principal
// ------------------------------------------------------------
export default function ApresentacaoIndicadores() {
  const [active, setActive] = useState<SectionId>("overview");

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: `radial-gradient(1200px 600px at 10% -10%, ${C.blueSoft}, transparent 60%), radial-gradient(900px 500px at 90% 0%, ${C.tealSoft}, transparent 60%), ${C.bg}`,
        color: C.text,
      }}
    >
      {/* Top bar / navegação */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{ background: "rgba(11,18,32,0.75)", borderBottom: `1px solid ${C.border}` }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl"
              style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.blue})` }}
            >
              <Sparkles className="h-4 w-4 text-slate-900" />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] uppercase tracking-[0.25em]" style={{ color: C.muted }}>
                Painel Executivo
              </p>
              <p className="text-sm font-semibold">Indicadores de Desempenho</p>
            </div>
          </div>

          <nav className="hidden gap-1 md:flex">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className="group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all"
                  style={{
                    color: isActive ? C.text : C.muted,
                    background: isActive ? "rgba(45,212,191,0.10)" : "transparent",
                    border: `1px solid ${isActive ? "rgba(45,212,191,0.35)" : "transparent"}`,
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {s.label}
                </button>
              );
            })}
          </nav>

          {/* Mobile select */}
          <select
            aria-label="Selecionar seção"
            value={active}
            onChange={(e) => setActive(e.target.value as SectionId)}
            className="rounded-lg px-3 py-2 text-sm md:hidden"
            style={{ background: C.panel, color: C.text, border: `1px solid ${C.border}` }}
          >
            {SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <AnimatePresence mode="wait">
          <motion.section
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {active === "overview" && <OverviewSection />}
            {active === "desempenho" && <DesempenhoSection />}
            {active === "setores" && <SetoresSection />}
            {active === "risco" && <RiscoSection />}
            {active === "ranking" && <RankingSection />}
          </motion.section>
        </AnimatePresence>

        {/* Pager */}
        <div className="mt-10 flex items-center justify-between text-xs" style={{ color: C.muted }}>
          <span>
            Seção {SECTIONS.findIndex((s) => s.id === active) + 1} de {SECTIONS.length}
          </span>
          <button
            onClick={() => {
              const idx = SECTIONS.findIndex((s) => s.id === active);
              const next = SECTIONS[(idx + 1) % SECTIONS.length];
              setActive(next.id);
            }}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors hover:text-slate-100"
            style={{ border: `1px solid ${C.border}` }}
          >
            Próxima seção <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}

// ------------------------------------------------------------
// Componentes reutilizáveis
// ------------------------------------------------------------
function Panel({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl p-5 md:p-6 ${className}`}
      style={{
        background: `linear-gradient(180deg, ${C.panel} 0%, ${C.panel2} 100%)`,
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 40px -24px rgba(0,0,0,0.6)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.28em]" style={{ color: C.muted }}>
      {children}
    </p>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "atencao" | "recuando" | "ok" | "critico";
  children: React.ReactNode;
}) {
  const map = {
    atencao: { bg: C.amberSoft, fg: C.amber, dot: C.amber },
    recuando: { bg: C.tealSoft, fg: C.teal, dot: C.teal },
    ok: { bg: "rgba(16,185,129,0.14)", fg: C.green, dot: C.green },
    critico: { bg: C.redSoft, fg: C.red, dot: C.red },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: map.bg, color: map.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: map.dot }} />
      {children}
    </span>
  );
}

// ------------------------------------------------------------
// 1) Visão Geral
// ------------------------------------------------------------
function OverviewSection() {
  return (
    <div className="grid gap-6">
      <Panel className="relative overflow-hidden">
        {/* Background abstrato */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full"
          style={{ background: `radial-gradient(closest-side, ${C.tealSoft}, transparent)` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full"
          style={{ background: `radial-gradient(closest-side, ${C.blueSoft}, transparent)` }}
        />

        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: C.tealSoft, color: C.teal, border: `1px solid rgba(45,212,191,0.35)` }}
            >
              <Activity className="h-3.5 w-3.5" />
              Período analítico · Julho / 2026
            </span>
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
              style={{ background: "rgba(148,163,184,0.10)", color: C.muted, border: `1px solid ${C.border}` }}
            >
              Governança de dados · fonte única auditável
            </span>
          </div>

          <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
            Apresentação de{" "}
            <span
              style={{
                background: `linear-gradient(90deg, ${C.teal}, ${C.blue})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Indicadores de Desempenho
            </span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: C.muted }}>
            Análise consolidada da performance operacional, SLA de atendimento, distribuição de demandas por
            setor e matriz de riscos corporativos. Dados extraídos do painel operacional e validados pela
            camada de governança.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Gauge, label: "SLA Executivo", value: "92%" },
              { icon: Clock, label: "Backlog Crítico", value: "49" },
              { icon: Target, label: "Pontuação Operacional", value: "84" },
            ].map((it) => {
              const Icon = it.icon;
              return (
                <div
                  key={it.label}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: "rgba(15,23,42,0.6)", border: `1px solid ${C.border}` }}
                >
                  <div
                    className="grid h-9 w-9 place-items-center rounded-lg"
                    style={{ background: C.tealSoft, color: C.teal }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider" style={{ color: C.muted }}>
                      {it.label}
                    </p>
                    <p className="text-lg font-semibold">{it.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------
// 2) Desempenho Geral
// ------------------------------------------------------------
function DesempenhoSection() {
  const mesAnterior = 220;
  const mesAtual = 181;
  const variacao = ((mesAtual - mesAnterior) / mesAnterior) * 100;
  const volumeData = [
    { mes: "JUNHO", valor: mesAnterior, fill: C.muted },
    { mes: "JULHO", valor: mesAtual, fill: C.teal },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <Kicker>Desempenho geral</Kicker>
        <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Comparativo com o mês anterior</h2>
      </div>

      {/* Volume de Reclamações Recebidas — bloco no padrão referência */}
      <Panel className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute left-0 top-6 h-8 w-1 rounded-r"
          style={{ background: C.teal }}
        />
        <div className="pl-4">
          <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Volume de Reclamações Recebidas
          </h3>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Coluna esquerda: cards + pill */}
          <div className="space-y-4">
            <div
              className="rounded-2xl px-6 py-5"
              style={{ background: "rgba(15,23,42,0.6)", border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em]" style={{ color: C.muted }}>
                    Mês anterior
                  </p>
                  <p className="mt-1 text-sm" style={{ color: C.muted }}>
                    Junho 2026
                  </p>
                </div>
                <p className="text-5xl font-bold tracking-tight" style={{ color: C.text }}>
                  {mesAnterior}
                </p>
              </div>
            </div>

            <div
              className="relative overflow-hidden rounded-2xl px-6 py-5"
              style={{ background: C.tealSoft, border: `1px solid rgba(45,212,191,0.35)` }}
            >
              <div className="absolute left-0 top-0 h-full w-1" style={{ background: C.teal }} />
              <div className="flex items-center justify-between pl-2">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em]" style={{ color: C.teal }}>
                    Mês atual
                  </p>
                  <p className="mt-1 text-sm" style={{ color: C.muted }}>
                    Julho 2026
                  </p>
                </div>
                <p className="text-5xl font-bold tracking-tight" style={{ color: C.teal }}>
                  {mesAtual}
                </p>
              </div>
            </div>

            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
              style={{ background: "rgba(16,185,129,0.14)", color: C.green }}
            >
              <TrendingDown className="h-4 w-4" />
              {variacao.toFixed(1)}% Redução no Volume de Reclamações
            </div>
          </div>

          {/* Coluna direita: gráfico visível */}
          <div
            className="rounded-2xl p-4"
            style={{ background: "rgba(15,23,42,0.6)", border: `1px solid ${C.border}` }}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={volumeData} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis
                  dataKey="mes"
                  tick={{ fill: C.muted, fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: C.border }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: C.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <ReTooltip
                  cursor={{ fill: "rgba(148,163,184,0.08)" }}
                  contentStyle={{
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    color: C.text,
                  }}
                  labelStyle={{ color: C.muted, fontSize: 11 }}
                />
                <Bar dataKey="valor" radius={[8, 8, 0, 0]} label={{ position: "top", fill: C.text, fontWeight: 700, fontSize: 16 }}>
                  {volumeData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>


      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Card 1 — SLA */}
        <Panel>
          <div className="flex items-center justify-between">
            <div
              className="grid h-10 w-10 place-items-center rounded-lg"
              style={{ background: C.amberSoft, color: C.amber }}
            >
              <Gauge className="h-5 w-5" />
            </div>
            <StatusPill tone="atencao">Atenção</StatusPill>
          </div>
          <p className="mt-4 text-sm" style={{ color: C.muted }}>
            SLA Executivo Geral
          </p>
          <p className="mt-1 text-5xl font-semibold tracking-tight">92%</p>
          <div className="mt-3 flex items-center gap-1 text-xs" style={{ color: C.teal }}>
            <TrendingDown className="h-3.5 w-3.5" /> 100% de recuo de backlog
          </div>
          <p className="mt-2 text-xs" style={{ color: C.muted }}>
            132 de 181 dentro do prazo
          </p>
        </Panel>

        {/* Card 2 — Backlog */}
        <Panel>
          <div className="flex items-center justify-between">
            <div
              className="grid h-10 w-10 place-items-center rounded-lg"
              style={{ background: C.redSoft, color: C.red }}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <StatusPill tone="recuando">Recuando</StatusPill>
          </div>
          <p className="mt-4 text-sm" style={{ color: C.muted }}>
            Backlog Crítico
          </p>
          <p className="mt-1 text-5xl font-semibold tracking-tight">49</p>
          <div className="mt-3 flex items-center gap-1 text-xs" style={{ color: C.teal }}>
            <ArrowDown className="h-3.5 w-3.5" /> 100% no período
          </div>
          <p className="mt-2 text-xs" style={{ color: C.muted }}>
            27% do total ainda em aberto
          </p>
        </Panel>

        {/* Card 3 — Tempo Médio */}
        <Panel>
          <div className="flex items-center justify-between">
            <div
              className="grid h-10 w-10 place-items-center rounded-lg"
              style={{ background: C.blueSoft, color: C.blue }}
            >
              <Clock className="h-5 w-5" />
            </div>
            <StatusPill tone="ok">No SLA</StatusPill>
          </div>
          <p className="mt-4 text-sm" style={{ color: C.muted }}>
            Tempo Médio de Resposta
          </p>

          <div className="mt-3 space-y-3">
            <div className="rounded-lg px-3 py-2" style={{ background: "rgba(15,23,42,0.6)" }}>
              <p className="text-[11px] uppercase tracking-wider" style={{ color: C.muted }}>
                Agenda Cirúrgica
              </p>
              <div className="flex items-baseline justify-between">
                <p className="text-xl font-semibold">74h</p>
                <span className="text-[11px]" style={{ color: C.muted }}>
                  SLA 168h
                </span>
              </div>
              <p className="text-[11px]" style={{ color: C.green }}>
                4% sem SLA
              </p>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: "rgba(15,23,42,0.6)" }}>
              <p className="text-[11px] uppercase tracking-wider" style={{ color: C.muted }}>
                Demais Setores
              </p>
              <div className="flex items-baseline justify-between">
                <p className="text-xl font-semibold">13h</p>
                <span className="text-[11px]" style={{ color: C.muted }}>
                  SLA 72h
                </span>
              </div>
              <p className="text-[11px]" style={{ color: C.green }}>
                5% sem SLA
              </p>
            </div>
          </div>
        </Panel>

        {/* Card 4 — Pontuação */}
        <Panel>
          <div className="flex items-center justify-between">
            <div
              className="grid h-10 w-10 place-items-center rounded-lg"
              style={{ background: C.tealSoft, color: C.teal }}
            >
              <Target className="h-5 w-5" />
            </div>
            <StatusPill tone="atencao">Atenção</StatusPill>
          </div>
          <p className="mt-4 text-sm" style={{ color: C.muted }}>
            Pontuação Operacional
          </p>
          <p className="mt-1 text-5xl font-semibold tracking-tight">84</p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(148,163,184,0.15)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "84%" }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${C.amber}, ${C.teal})` }}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: C.muted }}>
            Eficiência ponderada de SLA, resolução e backlog.
          </p>
        </Panel>
      </div>

      {/* Insights */}
      <Panel>
        <div className="flex items-center gap-2">
          <div
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ background: C.blueSoft, color: C.blue }}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold">Insights — Análise Automática</h3>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            {
              icon: Heart,
              tone: C.amber,
              text: "Direção Clínica concentra 57% das demandas do período.",
            },
            {
              icon: TrendingDown,
              tone: C.teal,
              text: "Backlog recuando: -100% no período. Boa execução.",
            },
          ].map((it, i) => {
            const Icon = it.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl p-4"
                style={{ background: "rgba(15,23,42,0.6)", border: `1px solid ${C.border}` }}
              >
                <div
                  className="grid h-9 w-9 place-items-center rounded-lg"
                  style={{ background: "rgba(148,163,184,0.10)", color: it.tone }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm leading-relaxed" style={{ color: C.text }}>
                  {it.text}
                </p>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------
// 3) Setores e Motivos
// ------------------------------------------------------------
function SetoresSection() {
  const data = [
    { name: "Direção Clínica", value: 57, color: C.teal },
    { name: "Outros Setores", value: 43, color: "#CBD5E1" },
  ];

  const fatores = [
    {
      icon: Users,
      title: "Direção Clínica:",
      desc: (
        <>
          Concentra <strong style={{ color: C.text }}>57% das demandas</strong> totais do
          período, sendo o principal ofensor operacional.
        </>
      ),
    },
    {
      icon: Clock,
      title: "Agenda Cirúrgica:",
      desc: (
        <>
          Tempo médio de resposta de <strong style={{ color: C.text }}>74h</strong> (SLA de 168h),
          com apenas 4% sem SLA definido.
        </>
      ),
    },
    {
      icon: Network,
      title: "Demais Setores:",
      desc: (
        <>
          Desempenho ágil com média de <strong style={{ color: C.text }}>13h</strong> (SLA de 72h)
          e 5% sem SLA.
        </>
      ),
    },
  ];

  return (
    <div className="grid gap-6">
      <Panel className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute left-0 top-6 h-8 w-1 rounded-r"
          style={{ background: C.teal }}
        />
        <div className="pl-4">
          <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Distribuição de Setores &amp; Motivos
          </h3>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-center">
          {/* Coluna esquerda: fatores de concentração */}
          <div>
            <h4 className="text-xl font-semibold tracking-tight md:text-2xl">
              Fatores de Concentração
            </h4>
            <ul className="mt-5 space-y-4">
              {fatores.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.title} className="flex items-start gap-3">
                    <div
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md"
                      style={{ color: C.teal }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm leading-relaxed md:text-base" style={{ color: C.muted }}>
                      <span className="font-semibold" style={{ color: C.text }}>
                        {f.title}
                      </span>{" "}
                      {f.desc}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Coluna direita: donut */}
          <div
            className="rounded-2xl p-4"
            style={{ background: "rgba(15,23,42,0.6)", border: `1px solid ${C.border}` }}
          >
            <div className="relative h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={80}
                    outerRadius={115}
                    paddingAngle={2}
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {data.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <ReTooltip
                    contentStyle={{
                      background: C.panel,
                      border: `1px solid ${C.borderStrong}`,
                      borderRadius: 12,
                      color: C.text,
                    }}
                    formatter={(v: number, n: string) => [`${v}%`, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centro do donut */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight" style={{ color: C.teal }}>
                    57%
                  </span>
                  <span className="text-xs font-medium" style={{ color: C.muted }}>
                    D. CLÍNICA
                  </span>
                </div>
              </div>
            </div>
            {/* Legenda */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-xs" style={{ color: C.muted }}>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.teal }} />
                Direção Clínica (57%)
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#CBD5E1" }} />
                Outros Setores (43%)
              </span>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}


// ------------------------------------------------------------
// 4) Matriz de Risco
// ------------------------------------------------------------
function RiscoSection() {
  const items = [
    {
      title: "Volume de Backlog Ativo",
      desc: "49 demandas em aberto. Congestionamento de canais pode impactar parcerias corporativas.",
      tone: "critico" as const,
      icon: AlertTriangle,
      color: C.red,
      bg: C.redSoft,
      label: "Risco Crítico",
    },
    {
      title: "Tempo de Resposta — Agenda Cirúrgica",
      desc: "74h no prazo regulamentar, porém gera fricção na experiência do usuário final.",
      tone: "atencao" as const,
      icon: Clock,
      color: C.amber,
      bg: C.amberSoft,
      label: "Risco Moderado",
    },
    {
      title: "Performance dos Demais Setores",
      desc: "Resolução em 13h e evolução consistente dos prazos.",
      tone: "ok" as const,
      icon: CheckCircle2,
      color: C.green,
      bg: "rgba(16,185,129,0.14)",
      label: "Risco Controlado",
    },
    {
      title: "Conformidade Técnica",
      desc: "0% de devolutivas fora do prazo — conformidade regulatória total.",
      tone: "ok" as const,
      icon: ShieldCheck,
      color: C.green,
      bg: "rgba(16,185,129,0.14)",
      label: "Conformidade",
    },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <Kicker>Riscos corporativos</Kicker>
        <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Matriz de Risco Operacional</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <motion.div
              key={it.title}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl p-5 md:p-6"
              style={{
                background: `linear-gradient(180deg, ${C.panel} 0%, ${C.panel2} 100%)`,
                border: `1px solid ${C.border}`,
                borderLeft: `4px solid ${it.color}`,
                boxShadow: "0 20px 40px -24px rgba(0,0,0,0.6)",
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="grid h-10 w-10 place-items-center rounded-lg"
                  style={{ background: it.bg, color: it.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <StatusPill tone={it.tone}>{it.label}</StatusPill>
              </div>
              <h3 className="mt-4 text-base font-semibold">{it.title}</h3>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: C.muted }}>
                {it.desc}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// 5) Ranking de Empresas
// ------------------------------------------------------------
type Empresa = {
  nome: string;
  vidas: number;
  reclamacoes: number;
};
const EMPRESAS: Empresa[] = [
  { nome: "Delta Tecnologia S.A.", vidas: 15800, reclamacoes: 45 },
  { nome: "Alpha Logística Ltda.", vidas: 12450, reclamacoes: 142 },
  { nome: "Indústrias Metalúrgicas Beta", vidas: 8120, reclamacoes: 210 },
  { nome: "Gama Serviços Médicos", vidas: 4300, reclamacoes: 185 },
  { nome: "Ômega Varejo S.A.", vidas: 6900, reclamacoes: 62 },
  { nome: "Sigma Educação", vidas: 3200, reclamacoes: 24 },
];

function statusFrom(indice: number) {
  if (indice < 0.5) return { label: "Excelente", color: C.green, bg: "rgba(16,185,129,0.14)" };
  if (indice < 1.5) return { label: "Estável", color: C.blue, bg: C.blueSoft };
  if (indice < 3) return { label: "Atenção", color: C.amber, bg: C.amberSoft };
  return { label: "Crítico", color: C.red, bg: C.redSoft };
}

type SortKey = "vidas" | "reclamacoes" | "indice";

function RankingSection() {
  const [sortKey, setSortKey] = useState<SortKey>("indice");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const [empRes, demRes] = await Promise.all([
        supabase.from("empresas").select("nome, vidas").gt("vidas", 0),
        supabase.from("demandas").select("empresa"),
      ]);
      if (cancel) return;
      const contagem = new Map<string, number>();
      (demRes.data ?? []).forEach((d: any) => {
        const k = (d.empresa ?? "").toString().trim().toLowerCase();
        if (!k) return;
        contagem.set(k, (contagem.get(k) ?? 0) + 1);
      });
      const lista: Empresa[] = (empRes.data ?? [])
        .map((e: any) => ({
          nome: (e.nome ?? "").toString().trim(),
          vidas: Number(e.vidas) || 0,
          reclamacoes: contagem.get((e.nome ?? "").toString().trim().toLowerCase()) ?? 0,
        }))
        .filter((e) => e.vidas > 0 && e.reclamacoes > 0);
      setEmpresas(lista);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const rows = useMemo(() => {
    const enriched = empresas.map((e) => ({
      ...e,
      indice: +((e.reclamacoes / e.vidas) * 100).toFixed(2),
    }));
    return enriched
      .sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        return sortDir === "asc" ? va - vb : vb - va;
      })
      .slice(0, 15);
  }, [empresas, sortKey, sortDir]);

  function toggle(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  return (
    <div className="grid gap-6">
      <Panel className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute left-0 top-6 h-8 w-1 rounded-r"
          style={{ background: C.teal }}
        />
        <div className="pl-4">
          <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Ranking Empresas: Vidas vs. Reclamações
          </h3>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>
            {loading
              ? "Carregando dados..."
              : `Top ${rows.length} empresas do banco — ordenado por ${
                  sortKey === "indice"
                    ? "índice de sinistralidade"
                    : sortKey === "vidas"
                      ? "vidas"
                      : "reclamações"
                }.`}
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ color: C.muted }} className="text-left text-xs uppercase tracking-wider">
                <th className="py-3 pr-4">Empresa Cliente</th>
                <SortableTh label="Quantidade de Vidas" active={sortKey === "vidas"} dir={sortDir} onClick={() => toggle("vidas")} />
                <SortableTh
                  label="Quantidade de Reclamações"
                  active={sortKey === "reclamacoes"}
                  dir={sortDir}
                  onClick={() => toggle("reclamacoes")}
                />
                <SortableTh
                  label="Índice de Sinistralidade (Reclamações/Vidas)"
                  active={sortKey === "indice"}
                  dir={sortDir}
                  onClick={() => toggle("indice")}
                />
                <th className="py-3 pl-4">Status de Alerta</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm" style={{ color: C.muted }}>
                    Carregando ranking...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm" style={{ color: C.muted }}>
                    Nenhuma empresa com reclamações registradas.
                  </td>
                </tr>
              )}
              <AnimatePresence initial={false}>
                {rows.map((r, i) => {
                  const st = statusFrom(r.indice);
                  return (
                    <motion.tr
                      key={r.nome}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.02 }}
                      style={{ borderTop: `1px solid ${C.border}` }}
                    >
                      <td className="py-3 pr-4 font-medium">{r.nome}</td>
                      <td className="py-3 pr-4 tabular-nums">{r.vidas.toLocaleString("pt-BR")}</td>
                      <td className="py-3 pr-4 tabular-nums">{r.reclamacoes.toLocaleString("pt-BR")}</td>
                      <td className="py-3 pr-4 tabular-nums">{r.indice.toLocaleString("pt-BR")}%</td>
                      <td className="py-3 pl-4">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{ background: st.bg, color: st.color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                          {st.label}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}


function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="py-3 pr-4">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 uppercase tracking-wider transition-colors"
        style={{ color: active ? C.teal : C.muted }}
      >
        {label}
        <span className="text-[10px]">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
