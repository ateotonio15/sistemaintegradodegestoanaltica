import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Pencil, BarChart3, QrCode } from "lucide-react";
import { RatingScale } from "../components/RatingScale";
import { AvaliacoesRHDashboard } from "../components/AvaliacoesRHDashboard";
import { EditarFormularioRHDialog } from "../components/EditarFormularioRHDialog";
import { EnviosAvaliacaoTab } from "../components/EnviosAvaliacaoTab";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

const db = supabase as any;

const TEMPLATE_PLANTAO = {
  tipo: "plantao",
  titulo: "Avaliação do Plantão",
  instrucoes: "Em uma escala de 1 a 5, sendo 1 = Insatisfatório e 5 = Excelente, como você avalia o atendimento:",
  perguntas: [
    { id: "p1", tipo: "rating", obrigatoria: true, titulo: "Tempo de espera", descricao: "" },
    { id: "p2", tipo: "rating", obrigatoria: true, titulo: "Cordialidade da equipe", descricao: "" },
    { id: "p3", tipo: "rating", obrigatoria: true, titulo: "Resolução do problema", descricao: "" },
    { id: "p4", tipo: "rating", obrigatoria: true, titulo: "Nota geral do atendimento", descricao: "" },
    { id: "p5", tipo: "texto", obrigatoria: false, titulo: "Comentário", descricao: "" },
  ],
};

export default function AvaliacoesPlantao() {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const { isAdmin, isExecutivo, isDiretora } = useAuth();
  const podeEditar = isAdmin || isExecutivo || isDiretora;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await db.from("cs_avaliacao_formularios").select("*").eq("tipo", "plantao").order("created_at", { ascending: false }).limit(1).maybeSingle();
      let f = data;
      if (!f) {
        const { data: ins } = await db.from("cs_avaliacao_formularios").insert(TEMPLATE_PLANTAO).select().single();
        f = ins;
      }
      setForm(f);
      setLoading(false);
    })();
  }, []);

  if (loading || !form) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando formulário...</div>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold">{form.titulo}</h2>
          {podeEditar && (
            <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar perguntas
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{form.instrucoes}</p>
        <p className="text-xs text-muted-foreground">Gere o link e o QR Code por empresa, igual à Avaliação RH.</p>
      </Card>

      <Tabs defaultValue="envios" className="w-full">
        <TabsList>
          <TabsTrigger value="envios"><QrCode className="h-4 w-4 mr-1" /> Envios</TabsTrigger>
          <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
          <TabsTrigger value="preview">Preview do formulário</TabsTrigger>
        </TabsList>
        <TabsContent value="envios" className="mt-4"><EnviosAvaliacaoTab form={form} tipo="plantao" /></TabsContent>
        <TabsContent value="dashboard" className="mt-4"><AvaliacoesRHDashboard form={form} tipo="plantao" /></TabsContent>
        <TabsContent value="preview" className="mt-4">
          <Card className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><p className="text-sm font-medium">Data do atendimento *</p><Input type="date" readOnly className="mt-1" /></div>
              <div><p className="text-sm font-medium">Unidade / plantão</p><Input readOnly placeholder="Preenchido pelo QR Code" className="mt-1" /></div>
            </div>
            {(form.perguntas || []).map((p: any, i: number) => (
              <div key={p.id} className="space-y-2">
                <p className="text-sm font-medium">{i + 1}. {p.titulo} {p.obrigatoria && <span className="text-destructive">*</span>}</p>
                {p.tipo === "rating" ? <RatingScale value={null} readOnly /> : <textarea className="w-full rounded-md border bg-muted/30 p-2 text-sm" rows={3} readOnly placeholder="Resposta..." />}
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>

      {podeEditar && (
        <EditarFormularioRHDialog open={editorOpen} onOpenChange={setEditorOpen} form={form} onSaved={setForm} tituloDialog="Editar formulário de Avaliação do Plantão" />
      )}
    </div>
  );
}
