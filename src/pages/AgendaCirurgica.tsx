import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { ArrowLeft, Download, FileText, KeyRound, RefreshCw, Search, Server, Stethoscope } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SelecionarServidorAgenda } from "@/components/agenda/SelecionarServidorAgenda";
import { RelatorioPendentesEmpresa } from "@/components/agenda/RelatorioPendentesEmpresa";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AgendamentoCirurgico, ConfigServidorAgenda, FiltrosAgenda, ModoAcesso, lerModoAgenda, salvarModoAgenda,
  detalharAgendamento, detalharAgendamentoDireto, isoParaBr, lerServidorAgenda,
  lerChaveDireta, listarAgendamentos, listarAgendamentosDireto, salvarChaveDireta,
} from "@/lib/agendaCirurgicaApi";

const pad = (n: number) => String(n).padStart(2, "0");
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function Campo({ l, v }: { l: string; v?: string | number | null }) {
  return <div><div className="text-xs text-muted-foreground">{l}</div><div className="text-sm">{v === undefined || v === null || v === "" ? "—" : v}</div></div>;
}

export default function AgendaCirurgica() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") === "pendentes" ? "pendentes" : "agenda";
  const [form, setForm] = useState({ ini: hoje(), fim: hoje(), nm_paciente: "", nm_empresa: "", ie_status_agenda: "", cd_agenda: "", cd_medico: "", cd_convenio: "" });
  const [filtros, setFiltros] = useState<FiltrosAgenda>({ dt_inicio: isoParaBr(hoje()), dt_fim: isoParaBr(hoje()), page: 1, limit: 50 });
  const [sel, setSel] = useState<AgendamentoCirurgico | null>(null);
  const [exportando, setExportando] = useState(false);
  const [modo, setModo] = useState<ModoAcesso>(() => lerModoAgenda());
  const [chave, setChave] = useState<string>(() => lerChaveDireta());
  const [servidor, setServidor] = useState<ConfigServidorAgenda>(() => lerServidorAgenda());
  const [selServidor, setSelServidor] = useState(false);

  const direto = modo === "direto";
  const prontoDireto = !direto || !!chave.trim();
  const chaveModo = direto ? `direto:${servidor.url}` : "servidor";

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["agenda-cirurgica", chaveModo, filtros],
    queryFn: () => (direto ? listarAgendamentosDireto(filtros, chave.trim()) : listarAgendamentos(filtros)),
    enabled: !!user && prontoDireto && aba === "agenda", retry: false,
  });
  const det = useQuery({
    queryKey: ["agenda-cirurgica-det", chaveModo, sel?.nr_sequencia],
    queryFn: () => { if (!sel) throw new Error("Selecione um agendamento."); return direto ? detalharAgendamentoDireto(sel.nr_sequencia, chave.trim()) : detalharAgendamento(sel.nr_sequencia); },
    enabled: !!sel && prontoDireto, retry: false,
  });
  const item: AgendamentoCirurgico | null = sel ? ((det.data?.dados ?? det.data) as any)?.nr_sequencia ? (det.data?.dados ?? det.data) : sel : null;

  const aplicar = () => setFiltros({
    dt_inicio: isoParaBr(form.ini), dt_fim: isoParaBr(form.fim), nm_paciente: form.nm_paciente, nm_empresa: form.nm_empresa,
    ie_status_agenda: form.ie_status_agenda, cd_agenda: form.cd_agenda, cd_medico: form.cd_medico, cd_convenio: form.cd_convenio, page: 1, limit: 50,
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const trocarModo = (m: ModoAcesso) => { setModo(m); salvarModoAgenda(m); setSel(null); };
  const atualizarChave = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChave(e.target.value);
    salvarChaveDireta(e.target.value.trim());
  };

  const exportar = async () => {
    setExportando(true);
    try {
      const todos: AgendamentoCirurgico[] = [];
      let p = 1, tp = 1;
      do {
        const r = direto
          ? await listarAgendamentosDireto({ ...filtros, page: p, limit: 500 }, chave.trim())
          : await listarAgendamentos({ ...filtros, page: p, limit: 500 });
        todos.push(...(r.dados ?? [])); tp = r.total_paginas ?? 1; p++;
      } while (p <= tp && p <= 40);
      const rows = todos.map((a) => ({
        "Nº Sequência": a.nr_sequencia, Data: a.dt_agenda, Início: a.hr_inicio, Fim: a.hr_fim, Status: a.status?.descricao,
        Sala: a.sala?.ds_agenda, Paciente: a.paciente?.nm_paciente, Idade: a.paciente?.nr_idade, Sexo: a.paciente?.ie_sexo,
        Médico: a.medico?.nm_medico, CRM: a.medico?.nr_crm ? `${a.medico.nr_crm}/${a.medico.uf_crm ?? ""}` : "", Anestesista: a.medico?.nm_anestesista,
        Procedimento: a.procedimento_principal?.descricao, Convênio: a.convenio?.ds_convenio, Plano: a.convenio?.ds_plano,
        Atendimento: a.atendimento?.nr_atendimento, Acomodação: a.acomodacao?.ds_tipo_acomodacao,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Agenda");
      XLSX.writeFile(wb, `agenda-cirurgica_${form.ini}_${form.fim}.xlsx`);
    } finally { setExportando(false); }
  };

  const pagina = data?.pagina ?? 1, totalPag = data?.total_paginas ?? 1;

  return (
    <div className="min-h-screen bg-background p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <Stethoscope className="h-6 w-6 text-primary" />
          <div><h1 className="text-xl font-semibold">Agenda Cirúrgica</h1><p className="text-sm text-muted-foreground">Agendamentos cirúrgicos Samel</p></div>
        </div>
        {aba === "agenda" && <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />Atualizar</Button>
          <Button size="sm" onClick={exportar} disabled={exportando || !data?.total}><Download className="h-4 w-4 mr-1" />{exportando ? "Exportando..." : "Exportar Excel"}</Button>
        </div>}
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Modo de acesso:</span>
          <Button size="sm" variant={modo === "servidor" ? "default" : "outline"} onClick={() => trocarModo("servidor")}>Servidor (nuvem)</Button>
          <Button size="sm" variant={modo === "direto" ? "default" : "outline"} onClick={() => trocarModo("direto")}>Direto (rede interna/VPN)</Button>
          {direto && (
            <>
              <Badge variant="secondary">{servidor.tipo === "producao" ? "Produção" : servidor.tipo === "localhost" ? "Localhost" : "Personalizada"}: {servidor.url}</Badge>
              <Button size="sm" variant="outline" onClick={() => setSelServidor(true)}><Server className="h-4 w-4 mr-1" />Selecionar servidor da API</Button>
            </>
          )}
        </div>
        <SelecionarServidorAgenda open={selServidor} onOpenChange={setSelServidor} atual={servidor}
          onSalvar={(c) => { setServidor(c); setSel(null); }} />
        {direto && (
          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4 text-primary" />Chave da API (x-api-key)</div>
            <Input type="password" value={chave} onChange={atualizarChave} placeholder="Cole aqui a chave fornecida pela TI da Samel" autoComplete="off" />
            <p className="text-xs text-muted-foreground">
              Neste modo o navegador chama a API da Samel diretamente — funciona apenas na rede interna da Samel ou com a VPN ligada.
              A chave fica guardada somente nesta sessão do navegador e não vai para o código nem para o banco. Vale para as duas abas.
            </p>
            {!chave.trim() && <p className="text-xs text-destructive">Informe a chave para habilitar a busca.</p>}
          </div>
        )}
      </Card>

      <Tabs value={aba} onValueChange={v => {setSel(null);setParams(p => { const next = new URLSearchParams(p); next.set("aba",v);return next; });}}>
      <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="agenda" className="gap-2"><Stethoscope className="h-4 w-4" />Agendamentos</TabsTrigger><TabsTrigger value="pendentes" className="gap-2 whitespace-normal text-left"><FileText className="h-4 w-4 shrink-0" />Procedimentos Pendentes por Empresa</TabsTrigger></TabsList>
      <TabsContent value="pendentes"><RelatorioPendentesEmpresa direto={direto} chave={chave.trim()} servidorUrl={servidor.url} /></TabsContent>
      <TabsContent value="agenda" className="space-y-4">


      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs text-muted-foreground">Data início</label><Input type="date" value={form.ini} onChange={set("ini")} /></div>
          <div><label className="text-xs text-muted-foreground">Data fim</label><Input type="date" value={form.fim} onChange={set("fim")} /></div>
          <div><label className="text-xs text-muted-foreground">Paciente</label><Input value={form.nm_paciente} onChange={set("nm_paciente")} placeholder="Nome do paciente" /></div>
          <div><label className="text-xs text-muted-foreground">Empresa</label><Input value={form.nm_empresa} onChange={set("nm_empresa")} placeholder="Nome da empresa" /></div>
          <div><label className="text-xs text-muted-foreground">Status</label><Input value={form.ie_status_agenda} onChange={set("ie_status_agenda")} placeholder="Ex.: N" /></div>
          <div><label className="text-xs text-muted-foreground">Cód. agenda (sala)</label><Input value={form.cd_agenda} onChange={set("cd_agenda")} placeholder="Ex.: 10,12" /></div>
          <div><label className="text-xs text-muted-foreground">Cód. médico</label><Input value={form.cd_medico} onChange={set("cd_medico")} inputMode="numeric" /></div>
          <div><label className="text-xs text-muted-foreground">Cód. convênio</label><Input value={form.cd_convenio} onChange={set("cd_convenio")} inputMode="numeric" /></div>
        </div>
        <div className="flex justify-end mt-3"><Button onClick={aplicar}><Search className="h-4 w-4 mr-1" />Buscar</Button></div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-2 text-sm text-muted-foreground border-b">{data ? `${data.total.toLocaleString("pt-BR")} agendamentos` : " "}</div>
        {error ? <div className="p-6 text-destructive text-sm">{(error as Error).message}</div> : isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Horário</TableHead><TableHead>Sala</TableHead><TableHead>Paciente</TableHead>
              <TableHead>Médico</TableHead><TableHead>Procedimento</TableHead><TableHead>Convênio</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data?.dados ?? []).length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum agendamento encontrado.</TableCell></TableRow>}
              {(data?.dados ?? []).map((a) => (
                <TableRow key={a.nr_sequencia} className="cursor-pointer" onClick={() => setSel(a)}>
                  <TableCell>{a.dt_agenda}</TableCell>
                  <TableCell className="whitespace-nowrap">{a.hr_inicio}{a.hr_fim ? ` – ${a.hr_fim}` : ""}</TableCell>
                  <TableCell>{a.sala?.ds_agenda ?? "—"}</TableCell>
                  <TableCell>{a.paciente?.nm_paciente ?? "—"}</TableCell>
                  <TableCell>{a.medico?.nm_medico ?? "—"}</TableCell>
                  <TableCell className="max-w-[260px] truncate" title={a.procedimento_principal?.descricao}>{a.procedimento_principal?.descricao ?? "—"}</TableCell>
                  <TableCell>{a.convenio?.ds_convenio ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{a.status?.descricao ?? a.status?.codigo ?? "—"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="flex items-center justify-end gap-2 p-3 border-t text-sm">
          <span className="text-muted-foreground">Página {pagina} de {totalPag}</span>
          <Button variant="outline" size="sm" disabled={pagina <= 1 || isFetching} onClick={() => setFiltros((f) => ({ ...f, page: pagina - 1 }))}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={pagina >= totalPag || isFetching} onClick={() => setFiltros((f) => ({ ...f, page: pagina + 1 }))}>Próxima</Button>
        </div>
      </Card>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Agendamento nº {sel?.nr_sequencia}</DialogTitle></DialogHeader>
          {item && (
            <div className="space-y-4">
              {det.isFetching && <p className="text-xs text-muted-foreground">Carregando detalhes...</p>}
              <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Campo l="Data" v={item.dt_agenda} /><Campo l="Horário" v={`${item.hr_inicio ?? ""} – ${item.hr_fim ?? ""}`} />
                <Campo l="Sala" v={item.sala?.ds_agenda} /><Campo l="Status" v={item.status?.descricao} />
              </section>
              <h3 className="text-sm font-semibold">Paciente</h3>
              <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Campo l="Nome" v={item.paciente?.nm_paciente} /><Campo l="CPF" v={item.paciente?.nr_cpf} />
                <Campo l="Nascimento" v={item.paciente?.dt_nascimento} /><Campo l="Idade" v={item.paciente?.nr_idade} />
                <Campo l="Sexo" v={item.paciente?.ie_sexo} /><Campo l="Celular" v={item.paciente?.nr_celular} />
              </section>
              <h3 className="text-sm font-semibold">Equipe</h3>
              <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Campo l="Médico" v={item.medico?.nm_medico} /><Campo l="CRM" v={item.medico?.nr_crm ? `${item.medico.nr_crm}/${item.medico.uf_crm ?? ""}` : ""} />
                <Campo l="Anestesista" v={item.medico?.nm_anestesista} />
              </section>
              <h3 className="text-sm font-semibold">Procedimentos</h3>
              <ul className="text-sm space-y-1">
                <li><b>{item.procedimento_principal?.codigo}</b> {item.procedimento_principal?.descricao} <Badge variant="outline" className="ml-1">Principal</Badge></li>
                {(item.procedimentos ?? []).map((p, i) => <li key={i}><b>{p.codigo}</b> {p.descricao}</li>)}
              </ul>
              <h3 className="text-sm font-semibold">Convênio e atendimento</h3>
              <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Campo l="Convênio" v={item.convenio?.ds_convenio} /><Campo l="Plano" v={item.convenio?.ds_plano} />
                <Campo l="Senha autorização" v={item.convenio?.cd_senha_autorizacao} /><Campo l="Atendimento" v={item.atendimento?.nr_atendimento} />
                <Campo l="Acomodação" v={item.acomodacao?.ds_tipo_acomodacao} />
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </TabsContent>
      </Tabs>
    </div>
  );
}
