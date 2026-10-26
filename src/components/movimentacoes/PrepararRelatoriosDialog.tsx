import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export interface ResultadoPreparacao {
  encontradas: number;
  prontas: number;
  semDestinatario: number;
  comErro: number;
}

export function PrepararRelatoriosDialog({ resultado, contexto, onClose }: {
  resultado: ResultadoPreparacao; contexto: string; onClose: () => void;
}) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-[440px]">
      <DialogHeader>
        <DialogTitle>Preparar Relatórios</DialogTitle>
        <DialogDescription>{contexto}</DialogDescription>
      </DialogHeader>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Empresas encontradas</dt><dd className="font-medium">{resultado.encontradas}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Prontas para envio</dt><dd className="font-medium text-success">{resultado.prontas}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Sem destinatário</dt><dd className="font-medium text-warning">{resultado.semDestinatario}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Com erro</dt><dd className="font-medium text-destructive">{resultado.comErro}</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">Nenhum relatório foi enviado. Use "Enviar Relatórios" para registrar o envio das empresas prontas.</p>
      <DialogFooter><Button onClick={onClose}>Fechar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
