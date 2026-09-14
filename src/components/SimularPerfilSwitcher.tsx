import { Eye, EyeOff } from "lucide-react";
import { PERFIS_SIMULAVEIS, useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function SimularPerfilSwitcher() {
  const { canSimulate, simulatedRole, setSimulatedRole } = useAuth();

  if (!canSimulate) return null;

  const label = PERFIS_SIMULAVEIS.find((p) => p.value === simulatedRole)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 text-xs font-semibold",
            simulatedRole && "border-amber-500/60 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
          )}
        >
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">{simulatedRole ? `Vendo como: ${label}` : "Ver como"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Ver o sistema como</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PERFIS_SIMULAVEIS.map((p) => (
          <DropdownMenuItem
            key={p.value}
            onClick={() => setSimulatedRole(p.value)}
            className={cn("text-sm", simulatedRole === p.value && "font-semibold text-primary")}
          >
            {p.label}
          </DropdownMenuItem>
        ))}
        {simulatedRole && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSimulatedRole(null)} className="text-sm gap-2">
              <EyeOff className="h-4 w-4" />
              Voltar ao meu perfil (Admin)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SimularPerfilBanner() {
  const { canSimulate, simulatedRole, setSimulatedRole } = useAuth();
  if (!canSimulate || !simulatedRole) return null;
  const label = PERFIS_SIMULAVEIS.find((p) => p.value === simulatedRole)?.label ?? simulatedRole;

  return (
    <div className="flex items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      <span>
        Modo de teste: você está vendo o sistema como <strong>{label}</strong>. As permissões de dados continuam as de
        administrador.
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 border-amber-500/50 px-2 text-[11px]"
        onClick={() => setSimulatedRole(null)}
      >
        Sair do modo de teste
      </Button>
    </div>
  );
}
