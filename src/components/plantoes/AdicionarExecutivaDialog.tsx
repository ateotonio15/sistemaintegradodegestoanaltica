import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlantaoMutations } from "@/hooks/usePlantoes";

const TIPOS = ["Presencial", "WhatsApp"] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string;
  data: string;
}

function useExecutivasProfiles() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["executivas_profiles"],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "executivo");
      if (rolesErr) throw rolesErr;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [] as { user_id: string; nome: string }[];
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      if (pErr) throw pErr;
      return (profs ?? [])
        .map((p: any) => ({ user_id: p.user_id, nome: p.display_name || "" }))
        .filter((p) => p.nome)
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });
}

export function AdicionarExecutivaDialog({ open, onOpenChange, empresaId, data }: Props) {
  const { data: opcoes = [] } = useExecutivasProfiles();
  const { upsertPlantao } = usePlantaoMutations();


  const [executiva, setExecutiva] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("Presencial");

  const reset = () => {
    setExecutiva("");
    setTipo("Presencial");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar executiva ao plantão</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Executiva</Label>
            <Select value={executiva} onValueChange={setExecutiva}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a executiva" />
              </SelectTrigger>
              <SelectContent>
                {opcoes.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    Nenhuma executiva cadastrada.
                  </div>
                ) : (
                  opcoes.map((p) => (
                    <SelectItem key={p.user_id} value={p.nome}>
                      {p.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>


          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as (typeof TIPOS)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!executiva.trim() || upsertPlantao.isPending}
            onClick={async () => {
              await upsertPlantao.mutateAsync({
                empresa_id: empresaId,
                data,
                turno: "integral",
                plantonista: executiva.trim(),
                observacao: `Tipo: ${tipo}`,
              });
              reset();
              onOpenChange(false);
            }}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
