import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Share2, Loader2 } from "lucide-react";
import { RatingScale } from "../components/RatingScale";
import { AvaliacoesRHDashboard } from "../components/AvaliacoesRHDashboard";
import { toast } from "sonner";

const db = supabase as any;

const TEMPLATE_RH = {
  tipo: "rh",
  titulo: "Avaliação RH",
  instrucoes: "Em uma escala de 1 a 5, sendo 1 = Insatisfatório e 5 = Excelente, como você avalia:",
  perguntas: [
    { id: "q1", tipo: "rating", obrigatoria: true, titulo: "Relacionamento e cordialidade", descricao: "A qualidade do relacionamento, cordialidade e profissionalismo demonstrados pela executiva durante os atendimentos." },
    { id: "q2", tipo: "rating", obrigatoria: true, titulo: "Proatividade e comprometimento", descricao: "A executiva demonstra iniciativa e presteza para auxiliá-los para as demandas apresentadas?" },
    { id: "q3", tipo: "rating", obrigatoria: true, titulo: "Agilidade e efetividade", descricao: "O tempo de resposta e a capacidade de conduzir as demandas de forma eficiente até sua resolução." },
    { id: "q4", tipo: "rating", obrigatoria: true, titulo: "Disponibilidade e suporte", descricao: "A facilidade de contato e o suporte prestado sempre que sua empresa necessita de auxílio." },
    { id: "q5", tipo: "rating", obrigatoria: true, titulo: "Satisfação geral", descricao: "Considerando sua experiência como um todo, qual sua avaliação sobre o atendimento prestado pela executiva?" },
  ],
};

export default function AvaliacoesRH() {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await db.from("cs_avaliacao_formularios").select("*").eq("tipo", "rh").order("created_at", { ascending: false }).limit(1).maybeSingle();
      let f = data;
      if (!f) {
        const { data: ins } = await db.from("cs_avaliacao_formularios").insert(TEMPLATE_RH).select().single();
        f = ins;
      } else {
        // sincroniza perguntas
        const { data: upd } = await db
          .from("cs_avaliacao_formularios")
          .update({ titulo: TEMPLATE_RH.titulo, instrucoes: TEMPLATE_RH.instrucoes, perguntas: TEMPLATE_RH.perguntas })
          .eq("id", f.id)
          .select()
          .single();
        f = upd || f;
      }
      setForm(f);
      setLoading(false);
    })();
  }, []);

  if (loading || !form) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando formulário...</div>;
  }

  const link = `${window.location.origin}/carteira-samel/avaliacoes/rh/responder/${form.id}`;

  const copiar = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  };
  const compartilhar = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Avaliação RH", url: link }); } catch {}
    } else {
      copiar();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">{form.titulo}</h2>
        <p className="text-sm text-muted-foreground">{form.instrucoes}</p>
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Link público para resposta</p>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={link} className="flex-1 min-w-[260px]" />
            <Button onClick={copiar} variant="outline"><Copy className="h-4 w-4 mr-1" /> Copiar</Button>
            <Button onClick={compartilhar}><Share2 className="h-4 w-4 mr-1" /> Compartilhar</Button>
          </div>
        </div>
      </Card>

      <AvaliacoesRHDashboard form={form} />

      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">Preview do formulário</h3>
        {form.perguntas && form.perguntas.length > 0 ? (
          form.perguntas.map((p: any, i: number) => (
            <div key={p.id} className="space-y-1">
              <p className="text-sm font-medium">{i + 1}. {p.titulo} {p.obrigatoria && <span className="text-red-500">*</span>}</p>
              <p className="text-xs text-muted-foreground">{p.descricao}</p>
              {p.tipo === "rating" ? <RatingScale value={null} readOnly /> : <textarea className="mt-1 w-full rounded-md border bg-muted/30 p-2 text-sm" rows={3} readOnly placeholder="Resposta..." />}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma pergunta cadastrada.</p>
        )}
      </Card>
    </div>
  );
}
