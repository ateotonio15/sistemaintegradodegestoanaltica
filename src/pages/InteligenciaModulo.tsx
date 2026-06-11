import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction, Sparkles, type LucideIcon } from "lucide-react";
import {
  MessageSquareWarning,
  Phone,
  CalendarDays,
  Car,
  Stethoscope,
  Mic,
  ShieldPlus,
  Gift,
  BarChart3,
} from "lucide-react";

type ModuloInfo = {
  label: string;
  description: string;
  section: string;
  icon: LucideIcon;
};

export const INTELIGENCIA_MODULOS: Record<string, ModuloInfo> = {
  "registro-reclamacoes": {
    label: "Registro de Reclamações",
    description: "Abertura e acompanhamento de demandas com SLA",
    section: "Demandas",
    icon: MessageSquareWarning,
  },
  "plantoes-atendimentos": {
    label: "Plantões de atendimentos",
    description: "Registro de atendimentos do plantão 24h",
    section: "Plantões",
    icon: Phone,
  },
  "calendario-plantoes": {
    label: "Calendário de plantões",
    description: "Escala visual de plantões por executiva",
    section: "Plantões",
    icon: CalendarDays,
  },
  "uber-corporativo": {
    label: "Uber Corporativo",
    description: "Corridas, colaboradores e centro de custo",
    section: "Uber Corporativo",
    icon: Car,
  },
  "acoes-saude": {
    label: "Ações saúde nas empresas",
    description: "Triagens, PA, IMC e fichas biométricas",
    section: "Saúde nas Empresas",
    icon: Stethoscope,
  },
  "calendario-palestras": {
    label: "Calendário de palestras",
    description: "Agenda de palestras nas empresas",
    section: "Saúde nas Empresas",
    icon: Mic,
  },
  "calendario-preventivas": {
    label: "Calendário de ações preventivas",
    description: "Programação de ações preventivas",
    section: "Saúde nas Empresas",
    icon: ShieldPlus,
  },
  "mailing-brindes": {
    label: "Mailing de Brindes",
    description: "Cestas natalinas e brindes corporativos",
    section: "Mailing de Brindes",
    icon: Gift,
  },
  "central-avaliacoes": {
    label: "Central de Avaliações",
    description: "NPS, CSAT, executiva, RH e palestras",
    section: "Central de Avaliações",
    icon: BarChart3,
  },
};

export default function InteligenciaModulo() {
  const { slug } = useParams<{ slug: string }>();
  const modulo = slug ? INTELIGENCIA_MODULOS[slug] : undefined;

  if (!modulo) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-16 text-center">
        <Card className="p-8 max-w-md flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
            <Construction className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">Módulo não encontrado</div>
            <p className="text-sm text-muted-foreground mt-1">
              O módulo solicitado não existe ou foi removido.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const Icon = modulo.icon;

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10 md:py-16">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <div>
          <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao início
            </Link>
          </Button>
        </div>

        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/15 shrink-0">
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              Inteligência · {modulo.section}
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mt-1">
              {modulo.label}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{modulo.description}</p>
          </div>
        </div>

        <Card className="p-8 flex flex-col items-center text-center gap-3 border-dashed">
          <div className="h-12 w-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
            <Construction className="h-6 w-6" />
          </div>
          <div className="text-base font-semibold text-foreground">Módulo em construção</div>
          <p className="text-sm text-muted-foreground max-w-md">
            Esta área faz parte da plataforma de Inteligência de Relacionamento e será disponibilizada em breve.
            A estrutura, ícone e categoria já estão reservados — quando você quiser, construímos as telas reais
            mantendo a identidade visual do SIGA.
          </p>
        </Card>
      </div>
    </div>
  );
}
