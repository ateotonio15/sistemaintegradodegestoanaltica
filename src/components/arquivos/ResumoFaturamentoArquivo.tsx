import type { AnalisePorCnpj } from "@/lib/excel-analysis-utils";
import { formatBRL } from "@/lib/excel-analysis-utils";

export function ResumoFaturamentoArquivo({ resultados }: { resultados: AnalisePorCnpj[] }) {
  return (
    <div className="space-y-5 p-4">
      {resultados.map((r, index) => {
        const planos = [
          { categoria: "Enfermaria", ...r.enfermaria },
          { categoria: "Apartamento", ...r.apartamento },
        ].filter((p) => p.beneficiarios > 0 || p.total !== 0);
        const outros = [
          { categoria: "Inclusões", quantidade: r.inclusoes.quantidade - (r.retroativas?.quantidade ?? 0), total: r.inclusoes.total - (r.retroativas?.total ?? 0) },
          { categoria: "Cobrança Retroativa", ...r.retroativas },
          { categoria: "Exclusões", ...r.exclusoes },
          { categoria: "Devolução", ...r.devolucoes },
          { categoria: "Permuta", ...r.permuta },
          { categoria: "Taxa de Adesão", ...r.taxaAdesao },
          { categoria: "Coparticipação", ...r.coparticipacao },
          { categoria: "Complemento", ...r.complemento },
        ].filter((item) => (item.quantidade ?? 0) !== 0 || (item.total ?? 0) !== 0);
        return (
          <section key={`${r.cnpj}-${index}`} className="space-y-2">
            <h3 className="text-sm font-semibold break-words">{r.nomeExibicao || r.nome}</h3>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full table-fixed text-[11px] [&_th]:break-words [&_td]:break-words [&_th]:px-1.5 [&_td]:px-1.5">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Categoria</th>
                    <th className="px-3 py-2 text-right font-medium">Beneficiários / Qtd.</th>
                    <th className="px-3 py-2 text-right font-medium">Mensalidade do plano</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {planos.map((p) => (
                    <tr key={p.categoria} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{p.categoria}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.beneficiarios.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(p.mensalidade)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(p.total)}</td>
                    </tr>
                  ))}
                  {outros.map((item) => (
                    <tr key={item.categoria} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{item.categoria}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{(item.quantidade ?? 0).toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(item.total ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-primary/10 font-semibold">
                  <tr><td colSpan={3} className="px-3 py-2">{r.totalDeclaradoExcel != null ? "Total informado na planilha" : "Total Geral"}</td><td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(r.totalDeclaradoExcel ?? planos.reduce((s, p) => s + p.total, 0) + outros.reduce((s, item) => s + (item.total ?? 0), 0))}</td></tr>
                </tfoot>
              </table>
            </div>
            {r.faixasEtarias && r.faixasEtarias.length > 0 && <p className="text-xs text-muted-foreground">Mensalidade média por beneficiário; valores variam por faixa etária.</p>}
            {r.avisos.length > 0 && <div className="text-xs text-warning space-y-1">{r.avisos.map((aviso, i) => <p key={i}>{aviso}</p>)}</div>}
          </section>
        );
      })}
    </div>
  );
}