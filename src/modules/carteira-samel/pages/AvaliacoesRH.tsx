import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Share2, Loader2, Pencil, Mail, Building2, CalendarClock, Settings, BarChart3, Send } from "lucide-react";
import { RatingScale } from "../components/RatingScale";
import { AvaliacoesRHDashboard } from "../components/AvaliacoesRHDashboard";
import { EditarFormularioRHDialog } from "../components/EditarFormularioRHDialog";
import { EnviosAvaliacaoTab } from "../components/EnviosAvaliacaoTab";
import { ConfigAvaliacoesDialog } from "../components/ConfigAvaliacoesDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const db = supabase as any;

const TEMPLATE_RH = {
  tipo: "rh",
  titulo: "Avaliação RH",
  instrucoes: "Em uma escala de 1 a 5, sendo 1 = Insatisfatório e 5 = Excelente, como você avalia:",
  perguntas: [
    { id: "q1", tipo: "rating", obrigatoria: true, titulo: "Relacionamento e cordialidade", descricao: "" },
    { id: "q2", tipo: "rating", obrigatoria: true, titulo: "Proatividade e comprometimento", descricao: "" },
    { id: "q3", tipo: "rating", obrigatoria: true, titulo: "Agilidade e efetividade", descricao: "" },
    { id: "q4", tipo: "rating", obrigatoria: true, titulo: "Disponibilidade e suporte", descricao: "" },
    { id: "q5", tipo: "rating", obrigatoria: true, titulo: "Satisfação geral", descricao: "" },
  ],
};

export default function AvaliacoesRH() {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const { isAdmin, isExecutivo, isDiretora } = useAuth();
  const podeEditar = isAdmin || isExecutivo || isDiretora;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await db.from("cs_avaliacao_formularios").select("*").eq("tipo", "rh").order("created_at", { ascending: false }).limit(1).maybeSingle();
      let f = data;
      if (!f) {
        const { data: ins } = await db.from("cs_avaliacao_formularios").insert(TEMPLATE_RH).select().single();
        f = ins;
      }
      setForm(f);
      setLoading(false);
    })();
  }, []);

  if (loading || !form) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando formulário...</div>;
  }

  const link = `${window.location.origin}/carteira-samel/avaliacoes/rh/responder/${form.id}`;
  const copiar = async () => { await navigator.clipboard.writeText(link); toast.success("Link copiado"); };
  const compartilhar = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Avaliação RH", url: link }); } catch {} }
    else copiar();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold">{form.titulo}</h2>
          <div className="flex flex-wrap gap-2">
            {podeEditar && (
              <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
                <Settings className="h-4 w-4 mr-1" /> Configurações
              </Button>
            )}
            {podeEditar && (
              <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Editar perguntas
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{form.instrucoes}</p>

        <div className="rounded-lg bg-muted/40 p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => toast.info("Em breve: envio por e-mail")}>
              <Mail className="h-4 w-4 mr-1" /> Enviar por E-mail
            </Button>
            <Button variant="outline" onClick={() => toast.info("Use a aba Envios para gerar links por empresa")}>
              <Building2 className="h-4 w-4 mr-1" /> Enviar para Empresas Selecionadas
            </Button>
            <Button variant="outline" onClick={() => setConfigOpen(true)}>
              <CalendarClock className="h-4 w-4 mr-1" /> Agendar Envio Mensal
            </Button>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Link público de teste (genérico)</p>
            <div className="flex flex-wrap gap-2">
              <Input readOnly value={link} className="flex-1 min-w-[260px]" />
              <Button onClick={copiar} variant="outline"><Copy className="h-4 w-4 mr-1" /> Copiar</Button>
              <Button onClick={compartilhar}><Share2 className="h-4 w-4 mr-1" /> Compartilhar</Button>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="envios" className="w-full">
        <TabsList>
          <TabsTrigger value="envios"><Send className="h-4 w-4 mr-1" /> Envios por empresa</TabsTrigger>
          <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
          <TabsTrigger value="preview">Preview do formulário</TabsTrigger>
        </TabsList>

        <TabsContent value="envios" className="mt-4">
          <EnviosAvaliacaoTab form={form} />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <AvaliacoesRHDashboard form={form} />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card className="p-4 space-y-4">
            {form.perguntas && form.perguntas.length > 0 ? (
              form.perguntas.map((p: any, i: number) => (
                <div key={p.id} className="space-y-2">
                  <p className="text-sm font-medium">{i + 1}. {p.titulo} {p.obrigatoria && <span className="text-red-500">*</span>}</p>
                  {p.tipo === "rating" ? <RatingScale value={null} readOnly /> : <textarea className="mt-1 w-full rounded-md border bg-muted/30 p-2 text-sm" rows={3} readOnly placeholder="Resposta..." />}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma pergunta cadastrada.</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {podeEditar && (
        <EditarFormularioRHDialog open={editorOpen} onOpenChange={setEditorOpen} form={form} onSaved={(f) => setForm(f)} />
      )}
      {podeEditar && (
        <ConfigAvaliacoesDialog open={configOpen} onOpenChange={setConfigOpen} />
      )}
    </div>
  );
}
