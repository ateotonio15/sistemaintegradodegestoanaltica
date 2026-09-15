import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Loader2, Printer, Upload, Download } from "lucide-react";
import {
  baixarCartaDoc,
  camposIniciais,
  cartaEstilo,
  extrairDadosCartaDoPdf,
  imprimirCarta,
  montarCartaHtml,
  type CartaCampos,
} from "@/lib/carta-cancelamento";

export default function Cartas() {
  const [campos, setCampos] = useState<CartaCampos | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const html = useMemo(() => (campos ? montarCartaHtml(campos) : ""), [campos]);

  const set = (k: keyof CartaCampos, v: string) =>
    setCampos((c) => (c ? { ...c, [k]: v } : c));

  async function onFile(file: File) {
    setLendo(true);
    try {
      const dados = await extrairDadosCartaDoPdf(await file.arrayBuffer());
      setCampos(camposIniciais(dados));
      setArquivo(file.name);
      const faltando = [
        !dados.numero && "número da nota",
        !dados.dataEmissao && "data de emissão",
        !dados.valor && "valor",
        !dados.tomadorNome && "tomador",
      ].filter(Boolean);
      if (faltando.length)
        toast.warning(`Confira manualmente: ${faltando.join(", ")}.`);
      else toast.success("Carta preenchida com os dados da nota.");
    } catch (e: any) {
      toast.error(`Não foi possível ler a nota: ${e?.message || e}`);
    } finally {
      setLendo(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cartas</h1>
        <p className="text-sm text-muted-foreground">
          Envie a nota fiscal e a carta de cancelamento é preenchida automaticamente.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nota fiscal (PDF)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={lendo}>
            {lendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {lendo ? "Lendo nota..." : "Selecionar nota fiscal"}
          </Button>
          {arquivo && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" /> {arquivo}
            </span>
          )}
        </CardContent>
      </Card>

      {campos && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados da carta</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Campo label="Data da carta" value={campos.dataCarta} onChange={(v) => set("dataCarta", v)} />
              <Campo label="NFS-e nº" value={campos.numero} onChange={(v) => set("numero", v)} />
              <Campo label="Emitida no dia" value={campos.dataEmissao} onChange={(v) => set("dataEmissao", v)} />
              <Campo label="Valor (R$)" value={campos.valor} onChange={(v) => set("valor", v)} />
              <Campo label="CNPJ do tomador" value={campos.tomadorCnpj} onChange={(v) => set("tomadorCnpj", v)} />
              <Campo
                label="Inscrição Municipal do tomador"
                value={campos.tomadorInscricaoMunicipal}
                onChange={(v) => set("tomadorInscricaoMunicipal", v)}
              />
              <div className="md:col-span-3">
                <Campo label="Tomador (nome na assinatura)" value={campos.tomadorNome} onChange={(v) => set("tomadorNome", v)} />
              </div>
              <div className="md:col-span-3 space-y-2">
                <Label>Complemento do motivo</Label>
                <Textarea
                  rows={2}
                  value={campos.motivoComplemento}
                  onChange={(e) => set("motivoComplemento", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Pré-visualização</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => imprimirCarta(campos)}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimir / PDF
                </Button>
                <Button size="sm" onClick={() => baixarCartaDoc(campos)}>
                  <Download className="mr-2 h-4 w-4" /> Baixar Word
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <style>{cartaEstilo()}</style>
              <div
                className="rounded-md border bg-white p-8 text-black shadow-sm"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
