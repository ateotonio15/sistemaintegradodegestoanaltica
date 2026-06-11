import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface HeaderTabItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const STORAGE_KEY = "header-tabs:open";

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Barra de abas internas (in-app), exibida no header para usuários sem sidebar.
 * - Mantém em localStorage as rotas abertas.
 * - A rota atual é sempre considerada aberta (auto-adicionada se ainda não estiver).
 * - Botão "+" abre popover com os módulos permitidos para o perfil.
 * - Navegação dentro do SPA (sem abrir nova guia do navegador).
 */
export function HeaderTabs({ available }: { available: HeaderTabItem[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const current = location.pathname;

  const [openTabs, setOpenTabs] = useState<string[]>(() => readStored());

  // Mapa rota -> item permitido
  const byPath = useMemo(() => {
    const m = new Map<string, HeaderTabItem>();
    available.forEach((it) => m.set(it.to, it));
    return m;
  }, [available]);

  // Persiste
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openTabs));
    } catch {}
  }, [openTabs]);

  const closeTab = (path: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((p) => p !== path);
      if (path === current) {
        const idx = prev.indexOf(path);
        const fallback = next[Math.max(0, idx - 1)] ?? next[0] ?? "/";
        setTimeout(() => navigate(fallback), 0);
      }
      return next;
    });
  };

  const addTab = (path: string) => {
    setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
    navigate(path);
  };

  const visibleTabs = openTabs.filter((p) => byPath.has(p) && p !== "/");
  const notOpen = available.filter(
    (it) => it.to !== "/" && !visibleTabs.includes(it.to),
  );

  return (
    <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar">

      {visibleTabs.map((path) => {
        const item = byPath.get(path);
        if (!item) return null;
        const Icon = item.icon;
        const active = current === path;
        return (
          <div
            key={path}
            className={cn(
              "shrink-0 group inline-flex items-center gap-1 pl-2.5 pr-1 h-8 rounded-lg text-sm font-medium transition-colors border",
              active
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-foreground/80 hover:text-foreground hover:bg-accent border-transparent",
            )}
          >
            <Link
              to={path}
              className="flex items-center gap-1.5 min-w-0"
              title={item.label}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[140px]">{item.label}</span>
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeTab(path);
              }}
              className="ml-0.5 p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Fechar ${item.label}`}
              title="Fechar aba"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-dashed border-border/60"
            aria-label="Adicionar aba"
            title="Adicionar aba"
          >
            <Plus className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-1 rounded-xl shadow-lg" align="start">
          <div className="px-2.5 py-2 border-b mb-1">
            <p className="text-xs font-semibold text-foreground">Adicionar aba</p>
            <p className="text-[11px] text-muted-foreground">
              Abra outro módulo sem sair desta tela
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notOpen.length === 0 ? (
              <div className="px-2.5 py-3 text-xs text-muted-foreground text-center">
                Todos os módulos já estão abertos
              </div>
            ) : (
              notOpen.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.to}
                    type="button"
                    onClick={() => addTab(it.to)}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/85 hover:bg-accent transition-colors text-left"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate flex-1">{it.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
