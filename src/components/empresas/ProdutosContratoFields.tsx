import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import type { ProdutoPlano, VinculosProdutos, AcomodacaoProduto } from "@/lib/empresa-produtos";

type ProdutosForm = VinculosProdutos & {
  plano?: string | null;
  contrato_faixa_etaria?: boolean | null;
  valor_enfermaria_centavos?: number | null;
  valor_apartamento_centavos?: number | null;
};

function ProdutoCombobox({ acomodacao, codigo, produtos, loading, error, onChange }: {
  acomodacao: AcomodacaoProduto; codigo?: number | null; produtos: ProdutoPlano[];
  loading: boolean; error: boolean; onChange: (codigo: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selecionado = produtos.find(p => p.codigo_produto === codigo);
  const label = acomodacao === "Não definida" ? "Plano / Produto — Não definida" : `Plano ${acomodacao}`;
  return <div className="space-y-2 min-w-0">
    <Label>{label}</Label>
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} disabled={loading || error}
          className="w-full justify-between h-auto min-h-10 text-left font-normal gap-2">
          <span className="break-words whitespace-normal">{selecionado ? `${selecionado.codigo_produto} - ${selecionado.nome_produto}${selecionado.ativo ? "" : " (Inativo)"}` : codigo ? `Produto ${codigo}` : loading ? "Carregando produtos…" : error ? "Catálogo indisponível" : "Selecionar plano"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Pesquisar código ou nome…" />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandItem value="Sem produto selecionado" onSelect={() => { onChange(null); setOpen(false); }}>Sem produto selecionado</CommandItem>
            {produtos.filter(p => p.ativo && p.acomodacao === acomodacao).map(p => <CommandItem key={p.codigo_produto}
              value={`${p.codigo_produto} ${p.nome_produto}`} onSelect={() => { onChange(p.codigo_produto); setOpen(false); }}>
              <span className="flex-1">{p.codigo_produto} - {p.nome_produto}</span>
              {codigo === p.codigo_produto && <Check className="h-4 w-4 shrink-0" />}
            </CommandItem>)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    {selecionado && <Badge variant="secondary" className="text-xs font-normal">Acomodação: {selecionado.acomodacao}</Badge>}
  </div>;
}

export function ProdutosContratoFields({ form, produtos, loading, error, administradorContrato, onChange }: {
  form: ProdutosForm; produtos: ProdutoPlano[]; loading: boolean; error: boolean;
  administradorContrato: boolean; onChange: (patch: Partial<ProdutosForm>) => void;
}) {
  return <div className="sm:col-span-2 space-y-4">
    {form.plano?.trim() && <div className="border-l-2 border-border pl-3 text-sm">
      <span className="text-muted-foreground">Plano anteriormente cadastrado: </span><span className="font-medium break-words">{form.plano}</span>
    </div>}
    <div className="grid sm:grid-cols-2 gap-4">
      {(["Enfermaria", "Apartamento"] as const).map(acomodacao => {
        const campo = acomodacao === "Enfermaria" ? "produto_enfermaria_codigo" : "produto_apartamento_codigo";
        const valorCampo = acomodacao === "Enfermaria" ? "valor_enfermaria_centavos" : "valor_apartamento_centavos";
        const cents = form[valorCampo];
        return <div key={acomodacao} className="space-y-3 min-w-0">
          <ProdutoCombobox acomodacao={acomodacao} codigo={form[campo]} produtos={produtos} loading={loading} error={error}
            onChange={codigo => onChange({ [campo]: codigo })} />
          {!administradorContrato && !form.contrato_faixa_etaria && <div className="space-y-2">
            <Label>Valor {acomodacao} (R$)</Label>
            <DecimalInput placeholder="0,00" value={cents != null ? cents / 100 : null}
              onChange={n => { const valor = Math.round(n * 100); onChange({ [valorCampo]: Number.isFinite(valor) ? valor : null }); }} />
          </div>}
        </div>;
      })}
    </div>
    <div className="max-w-lg">
      <ProdutoCombobox acomodacao="Não definida" codigo={form.produto_nao_definido_codigo} produtos={produtos} loading={loading} error={error}
        onChange={codigo => onChange({ produto_nao_definido_codigo: codigo })} />
    </div>
  </div>;
}