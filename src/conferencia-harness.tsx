// TEMPORÁRIO — conferência visual local com dados fictícios. Removido após a captura.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import "./index.css";
import { Table, TableBody } from "@/components/ui/table";
import { AnaliseExcelRow } from "@/components/financeiro/AnaliseExcelRow";
import { compararExcelComPdfSimplificado } from "@/lib/excel-analysis-utils";
import { somarTotalPrevistoComAvisos, type ItemTotalPrevisto } from "@/lib/previsao-total";
import { formatBRL } from "@/lib/excel-analysis-utils";

const excel: any = {
  pagador: "TESTE PAGADOR FICTÍCIO",
  enfermaria: { beneficiarios: 10, mensalidade: 100, total: 1000 },
  apartamento: { beneficiarios: 0, mensalidade: 0, total: 0 },
  inclusoes: { quantidade: 2, total: 300 },
  exclusoes: { quantidade: 0, total: 0 },
};
const pdfBase = { beneficiarios: 10, valorLiquido: 1300, nfNumero: "999", falhaLeitura: false, avisos: [], arquivo: "nf-ficticia.pdf" };
const cmpAusente = compararExcelComPdfSimplificado(excel, { ...pdfBase, inclusoes: { quantidade: null, total: null }, exclusoes: { quantidade: null, total: 0 } } as any);
const cmpZero = compararExcelComPdfSimplificado({ ...excel, inclusoes: { quantidade: 0, total: 0 } }, { ...pdfBase, inclusoes: { quantidade: 0, total: 0 }, exclusoes: { quantidade: 0, total: 0 } } as any);

type Linha = { id: string; empresa: string; pagador: string; item: ItemTotalPrevisto; sem: boolean };
const AGG = "fict/sem-pagador.xlsx", SEP = "fict/com-pagador.xlsx";

function Previsao({ comSeparavel }: { comSeparavel: boolean }) {
  const [filtro, setFiltro] = useState<string>("todos");
  const linhas: Linha[] = comSeparavel
    ? [
        { id: "1", empresa: "TESTE MISTO", pagador: "Pagador Alfa (11.111.111/0001-11)", sem: true, item: { documentos: [{ path: AGG, total: 1000, semSeparacao: true }, { path: SEP, total: 600, semSeparacao: false }], cnpjFiltro: "11111111000111", nomeFiltro: "Pagador Alfa" } },
        { id: "2", empresa: "TESTE MISTO", pagador: "Pagador Beta (22.222.222/0001-22)", sem: true, item: { documentos: [{ path: AGG, total: 1000, semSeparacao: true }, { path: SEP, total: 400, semSeparacao: false }], cnpjFiltro: "22222222000122", nomeFiltro: "Pagador Beta" } },
      ]
    : [
        { id: "1", empresa: "TESTE AGREGADO", pagador: "Pagador Alfa (11.111.111/0001-11)", sem: true, item: { documentos: [{ path: AGG, total: 1000, semSeparacao: true }], cnpjFiltro: "11111111000111", nomeFiltro: "Pagador Alfa" } },
        { id: "2", empresa: "TESTE AGREGADO", pagador: "Pagador Beta (22.222.222/0001-22)", sem: true, item: { documentos: [{ path: AGG, total: 1000, semSeparacao: true }], cnpjFiltro: "22222222000122", nomeFiltro: "Pagador Beta" } },
      ];
  const vis = linhas.filter((l) => filtro === "todos" || l.id === filtro);
  const { total } = somarTotalPrevistoComAvisos(vis.map((l) => l.item));
  return (
    <div className="rounded-lg border p-4 space-y-3 bg-card" data-cenario={comSeparavel ? "5b" : "5a"}>
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold">{comSeparavel ? "5b — não separável R$ 1.000 + separável 600/400" : "5a — planilha sem pagador R$ 1.000"}</span>
        <select aria-label={`filtro-${comSeparavel ? "b" : "a"}`} className="border rounded px-2 py-1 bg-background" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todos os pagadores</option><option value="1">Pagador Alfa</option><option value="2">Pagador Beta</option>
        </select>
      </div>
      <table className="w-full text-sm"><tbody>
        {vis.map((l) => (
          <tr key={l.id} className="border-t"><td className="py-1">{l.empresa}</td><td>{l.pagador}</td>
            <td>{l.item.documentos.map((d) => <div key={d.path} className="text-xs">{d.path}: {formatBRL(d.total)} {d.semSeparacao && <span className="ml-1 rounded bg-warning/15 text-warning px-1">Não foi possível separar por pagador</span>}</div>)}</td></tr>
        ))}
      </tbody></table>
      <div className="font-bold">Total previsto: {formatBRL(total)}</div>
    </div>
  );
}

function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground p-6 space-y-6">
      <h1 className="text-lg font-bold">Conferência local — dados fictícios (sem backend)</h1>
      <Previsao comSeparavel={false} />
      <Previsao comSeparavel />
      <div data-cenario="6a"><h2 className="font-semibold mb-2">6a — PDF sem o valor de inclusões</h2>
        <Table><TableBody><AnaliseExcelRow colSpan={1} isLoading={false} resultados={[excel]} comparacoes={[cmpAusente] as any} /></TableBody></Table></div>
      <div data-cenario="6b"><h2 className="font-semibold mb-2">6b — PDF com zero explícito</h2>
        <Table><TableBody><AnaliseExcelRow colSpan={1} isLoading={false} resultados={[{ ...excel, inclusoes: { quantidade: 0, total: 0 } }]} comparacoes={[cmpZero] as any} /></TableBody></Table></div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
