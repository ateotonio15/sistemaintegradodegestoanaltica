import { useCompanyAlerts } from "@/hooks/useNewCompanyAlert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Bell, Building2, User, Calendar, FileText, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export function NewCompanyBanner() {
  const { alerts, dismissAlert, dismissAll } = useCompanyAlerts();
  const navigate = useNavigate();

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="h-4 w-4 text-primary animate-pulse" />
          </div>
          <span className="text-sm font-semibold">
            Novas Empresas Cadastradas
          </span>
          <Badge variant="destructive" className="rounded-full text-xs px-2">
            {alerts.length}
          </Badge>
        </div>
        {alerts.length > 1 && (
          <Button variant="ghost" size="sm" onClick={dismissAll} className="text-xs text-muted-foreground">
            Limpar todos
          </Button>
        )}
      </div>

      {/* Alert cards */}
      <AnimatePresence mode="popLayout">
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-primary/30 bg-primary/5 shadow-md rounded-xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Código</p>
                        <p className="text-sm font-semibold">{alert.codigo_contrato}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Empresa</p>
                        <p className="text-sm font-semibold">{alert.nome}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Responsável</p>
                        <p className="text-sm font-semibold">{alert.responsavel_contrato}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Implantação</p>
                        <p className="text-sm font-semibold">{alert.data_implantacao}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="default"
                      size="sm"
                      className="rounded-lg gap-1.5 text-xs"
                      onClick={() => {
                        navigate("/empresas");
                        dismissAlert(alert.id);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver empresa
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
