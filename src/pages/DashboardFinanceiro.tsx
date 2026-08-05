import { DashboardFinanceiro as DashboardFinanceiroContent } from "@/components/dashboard/DashboardFinanceiro";

export default function DashboardFinanceiroPage() {
  return (
    <>
      <div className="p-4 md:px-6 md:py-4 space-y-3 overflow-hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financeiro</h1>
        </div>

        <DashboardFinanceiroContent />
      </div>
    </>
  );
}
