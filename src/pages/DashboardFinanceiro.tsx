import { DashboardFinanceiro as DashboardFinanceiroContent } from "@/components/dashboard/DashboardFinanceiro";
import { ContratosAVigenciarCard } from "@/components/dashboard/ContratosAVigenciarCard";

export default function DashboardFinanceiroPage() {
  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard Financeiro</h1>
          <p className="text-sm text-muted-foreground">Visão geral de cobranças, vencimentos e inadimplência</p>
        </div>
        <ContratosAVigenciarCard />
        <DashboardFinanceiroContent />
      </div>
    </>
  );
}
