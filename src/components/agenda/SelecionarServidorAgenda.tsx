import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ConfigServidorAgenda, SERVIDORES_AGENDA, ServidorAgenda, normalizarBaseAgenda, salvarServidorAgenda,
} from "@/lib/agendaCirurgicaApi";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atual: ConfigServidorAgenda;
  onSalvar: (c: ConfigServidorAgenda) => void;
}

const opcoes: { tipo: ServidorAgenda; titulo: string; url?: string }[] = [
  { tipo: "producao", titulo: "Produção", url: SERVIDORES_AGENDA.producao },
  { tipo: "localhost", titulo: "Localhost (dev)", url: SERVIDORES_AGENDA.localhost },
  { tipo: "personalizada", titulo: "URL personalizada" },
];

export function SelecionarServidorAgenda({ open, onOpenChange, atual, onSalvar }: Props) {
  const [tipo, setTipo] = useState<ServidorAgenda>(atual.tipo);
  const [url, setUrl] = useState(atual.tipo === "personalizada" ? atual.url : "");

  useEffect(() => {
    if (open) { setTipo(atual.tipo); setUrl(atual.tipo === "personalizada" ? atual.url : ""); }
  }, [open, atual]);

  const urlValida = /^https?:\/\/[^\s/]+/i.test(url.trim());
  const pode = tipo !== "personalizada" || urlValida;

  const salvar = () => {
    const final: ConfigServidorAgenda = {
      tipo,
      url: tipo === "personalizada" ? normalizarBaseAgenda(url) : SERVIDORES_AGENDA[tipo],
    };
    salvarServidorAgenda(final);
    onSalvar(final);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Selecionar servidor da API</DialogTitle>
          <DialogDescription>Escolha para qual endereço as consultas da agenda cirúrgica serão enviadas no modo direto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3" role="radiogroup">
          {opcoes.map((o) => {
            const ativo = tipo === o.tipo;
            return (
              <div key={o.tipo} role="radio" aria-checked={ativo} tabIndex={0}
                onClick={() => setTipo(o.tipo)} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setTipo(o.tipo)}
                className={`cursor-pointer rounded-md border p-3 transition-colors ${ativo ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                <div className="flex items-center gap-3">
                  <span className={`h-4 w-4 rounded-full border-2 ${ativo ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{o.titulo}</div>
                    {o.url && <div className="text-xs text-muted-foreground">{o.url}</div>}
                  </div>
                </div>
                {o.tipo === "personalizada" && ativo && (
                  <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                    <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://192.168.0.10:5000/api" />
                    {url && !urlValida && <p className="text-xs text-destructive">Informe um endereço começando com http:// ou https://</p>}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            As rotas usadas são <code>/integracao/health</code> e <code>/integracao/agendamentos</code>, a partir do endereço escolhido.
            Endereços de rede interna com <code>http://</code> (ex.: 192.168…) podem ser bloqueados pelo navegador neste site seguro; <code>localhost</code> funciona normalmente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!pode}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
