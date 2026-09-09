import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Loader2, Stethoscope, Upload } from "lucide-react";
import { PaBadge } from "./PaBadge";
import { BioimpedanciaDialog } from "./BioimpedanciaDialog";
import { ImportarTriagensDialog } from "./ImportarTriagensDialog";
import { classificarPa, maskCpf, PA_GRAVE } from "../lib/saude-rules";
import { useSaudeMutations, useTriagens, type Triagem } from "../hooks/useSaudeEmpresas";
import PessoaFisicaAutocomplete from "@/components/demandas/PessoaFisicaAutocomplete";
import { buscarPessoaFisica, isCpfValido, type PessoaFisicaResult } from "@/lib/pessoa-fisica-lookup";

interface Props {
  acaoId: string;
  empresaId: string;
  temPa: boolean;
  temGlicemia: boolean;
  temBio: boolean;
}

/** Converte DD/MM/AAAA (ou variações ISO) em AAAA-MM-DD. */
function toIsoDate(v?: string | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function normalizarSexo(v?: string | null): string | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  if (s.startsWith("M")) return "M";
  if (s.startsWith("F")) return "F";
  return null;
}

export function TriagemInlineForm({ acaoId, empresaId, temPa, temGlicemia, temBio }: Props) {
  const { upsertTriagem } = useSaudeMutations();
  const { data: triagensExistentes } = useTriagens(acaoId);
  const [bioOpen, setBioOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bioBase, setBioBase] = useState<Partial<Triagem> | null>(null);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [pas, setPas] = useState("");
  const [pad, setPad] = useState("");
  const [jejum, setJejum] = useState<"sim" | "nao" | "">("");
  const [glicemia, setGlicemia] = useState("");
  const [realizouBio, setRealizouBio] = useState(false);
  const [cpfLookupLoading, setCpfLookupLoading] = useState(false);
  const [dadosBeneficiario, setDadosBeneficiario] = useState<{
    data_nascimento: string | null;
    sexo: string | null;
    email: string | null;
    telefone: string | null;
  } | null>(null);

  const aplicarPessoa = (p: PessoaFisicaResult) => {
    const nomeApi = String(p.NM_PESSOA_FISICA || p.NAME || "").trim();
    if (nomeApi) setNome(nomeApi);
    if (isCpfValido(p.NR_CPF)) setCpf(maskCpf(String(p.NR_CPF)));
    setDadosBeneficiario({
      data_nascimento: toIsoDate(p.DT_NASCIMENTO),
      sexo: normalizarSexo(p.SEXO),
      email: String(p.DS_EMAIL || "").trim() || null,
      telefone: String(p.NR_TELEFONE_CELULAR || p.TELEFONE_APP || "").trim() || null,
    });
    toast.success("Dados do beneficiário carregados");
  };

  // Busca automática pelo CPF (11 dígitos) usando a API de pessoa física.
  useEffect(() => {
    const digits = String(cpf || "").replace(/\D/g, "");
    if (digits.length !== 11) return;

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setCpfLookupLoading(true);
        const res = await buscarPessoaFisica(digits, ctrl.signal);
        const match =
          res.find((p) => String(p.NR_CPF ?? "").replace(/\D/g, "") === digits) ??
          (res.length === 1 ? res[0] : null);
        // Não localizado → descarta, mantém o que foi digitado.
        if (!match) return;
        aplicarPessoa(match);
      } catch {
        // Busca silenciosa para não interromper a triagem.
      } finally {
        setCpfLookupLoading(false);
      }
    }, 400);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpf]);

  const reset = () => {
    setNome(""); setCpf(""); setPas(""); setPad("");
    setJejum(""); setGlicemia(""); setRealizouBio(false);
    setDadosBeneficiario(null);
  };

  const paCat = classificarPa(pas ? Number(pas) : null, pad ? Number(pad) : null);
  const paGrave = PA_GRAVE.includes(paCat);

  const validate = (): string | null => {
    if (!nome.trim()) return "Informe o nome.";
    if (cpf && cpf.replace(/\D/g, "").length !== 11) return "CPF inválido (11 dígitos).";
    if (temGlicemia && glicemia && jejum === "") return "Informe se a glicemia foi coletada em jejum.";
    return null;
  };

  const buildPayload = (): Partial<Triagem> & { acao_id: string; empresa_id: string; nome: string } => ({
    acao_id: acaoId,
    empresa_id: empresaId,
    nome: nome.trim(),
    cpf: cpf || null,
    data_nascimento: dadosBeneficiario?.data_nascimento ?? null,
    sexo: dadosBeneficiario?.sexo ?? null,
    email: dadosBeneficiario?.email ?? null,
    telefone: dadosBeneficiario?.telefone ?? null,
    pas_mmhg: temPa && pas ? Number(pas) : null,
    pad_mmhg: temPa && pad ? Number(pad) : null,
    jejum: jejum === "sim",
    glicemia_mg_dl: temGlicemia && glicemia ? Number(glicemia) : null,
    tem_bio: temBio && realizouBio,
  });

  const salvarRapido = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    await upsertTriagem.mutateAsync(buildPayload());
    reset();
  };

  const abrirBio = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setBioBase(buildPayload());
    setBioOpen(true);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Nova triagem</h3>
        {paGrave && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 animate-pulse">
            <AlertTriangle className="h-4 w-4" /> Encaminhar imediatamente
          </span>
        )}
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4" /> Importar planilha
        </Button>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 grid gap-1.5">
          <Label>Nome *</Label>
          <PessoaFisicaAutocomplete
            value={nome}
            onChange={setNome}
            onSelect={aplicarPessoa}
            placeholder="Buscar por nome ou CPF"
          />
        </div>
        <div className="md:col-span-3 grid gap-1.5">
          <Label>CPF *</Label>
          <div className="relative">
            <Input
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              className={cpfLookupLoading ? "pr-8" : undefined}
            />
            {cpfLookupLoading && (
              <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {dadosBeneficiario && (
            <span className="text-xs text-muted-foreground truncate">
              {[
                dadosBeneficiario.data_nascimento &&
                  `Nasc.: ${dadosBeneficiario.data_nascimento.split("-").reverse().join("/")}`,
                dadosBeneficiario.sexo && `Sexo: ${dadosBeneficiario.sexo}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>


        {temPa && (
          <>
            <div className="md:col-span-1 grid gap-1.5">
              <Label>PAS</Label>
              <Input inputMode="numeric" value={pas} onChange={(e) => setPas(e.target.value.replace(/\D/g, ""))} placeholder="120" />
            </div>
            <div className="md:col-span-1 grid gap-1.5">
              <Label>PAD</Label>
              <Input inputMode="numeric" value={pad} onChange={(e) => setPad(e.target.value.replace(/\D/g, ""))} placeholder="80" />
            </div>
            <div className="md:col-span-3 grid gap-1.5">
              <Label>Classificação PA</Label>
              <div className="h-9 flex items-center">
                <PaBadge pas={pas ? Number(pas) : null} pad={pad ? Number(pad) : null} />
              </div>
            </div>
          </>
        )}

        {temGlicemia && (
          <>
            <div className="md:col-span-4 grid gap-1.5">
              <Label>Em jejum? {glicemia && <span className="text-red-500">*</span>}</Label>
              <RadioGroup
                value={jejum}
                onValueChange={(v) => setJejum(v as "sim" | "nao")}
                className="flex items-center gap-4 h-9"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="sim" id="jejum-sim" /> Sim
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="nao" id="jejum-nao" /> Não
                </label>
              </RadioGroup>
            </div>
            <div className="md:col-span-3 grid gap-1.5">
              <Label>Glicemia (mg/dL)</Label>
              <Input inputMode="decimal" value={glicemia} onChange={(e) => setGlicemia(e.target.value.replace(/[^\d.]/g, ""))} placeholder="92" />
            </div>
          </>
        )}

        {temBio && (
          <div className="md:col-span-4 flex items-end gap-2 pb-1">
            <Switch checked={realizouBio} onCheckedChange={setRealizouBio} id="tem-bio" />
            <Label htmlFor="tem-bio" className="cursor-pointer">Realizou bioimpedância</Label>
          </div>
        )}

        <div className="md:col-span-12 flex items-end gap-2 justify-end">
          {temBio && realizouBio && (
            <Button variant="outline" onClick={abrirBio}>Preencher Ficha Bio…</Button>
          )}
          <Button onClick={salvarRapido} disabled={upsertTriagem.isPending}>
            {upsertTriagem.isPending ? "Salvando..." : "Salvar triagem"}
          </Button>
        </div>
      </div>

      <BioimpedanciaDialog
        open={bioOpen}
        onOpenChange={(v) => { setBioOpen(v); if (!v) reset(); }}
        triagemBase={bioBase}
      />

      <ImportarTriagensDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        acaoId={acaoId}
        empresaId={empresaId}
      />
    </Card>
  );
}
