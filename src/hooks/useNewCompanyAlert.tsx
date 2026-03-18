import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export function useNewCompanyAlert() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !role) return;
    if (role !== "executivo" && role !== "visualizacao") return;

    const channel = supabase
      .channel("new-empresa-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "empresas" },
        (payload) => {
          const emp = payload.new as {
            codigo_contrato?: string;
            nome?: string;
            responsavel_contrato?: string;
            data_implantacao?: string;
          };

          // Play notification sound
          try {
            const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Nk4x/cWBTTUlLTlRdaHV+hoyQkI2IgHZqXlRMR0VIS1FaZG94gYqQlJWTj4d+dGleVExHREZJT1hibnmCi5GVl5WRi4N6cGVbUkxIRkhMU11oc4CMlJmcm5iUjoZ8cWZcU01KSUxRWWRwfIiSmJ2fnpqWj4d9c2hfV1FOS01SWmRwfIiSmJ2fn5yYko2Ee3FoX1dRTk1OVFxndIGMlZufoJ+cmJKNhXxya2NcV1NRUlZcZXF9iZOanqCgn5yYk46Ge3JrY1xXU1FSVl1mdIGMlZufoKCfnJiTjoZ8c2tjXFdTUVJWXGVxfYmTmp6goJ+cmJOOhntya2NcV1NRUlZcZXF9iZOanqCgn5yYk46GfHNrY1xXU1FSVl1mcX2Jk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXGZxfYmTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Jk5qeoKCfnJiTjoZ8c2tjXFdTUVJWXGZxfYmTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ8c2tjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUVZXZ3F9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcH2Kk5qeoKCfnJiTjoZ7cmtiXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NSUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY11XU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7c2tjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXWZxfYqTmp6goJ+cmA==");
            audio.volume = 0.3;
            audio.play().catch(() => {});
          } catch {}

          const implantacao = emp.data_implantacao
            ? format(new Date(emp.data_implantacao + "T00:00:00"), "dd/MM/yyyy")
            : "—";

          toast("Nova empresa cadastrada!", {
            description: `Código: ${emp.codigo_contrato || "—"}\nEmpresa: ${emp.nome || "—"}\nResponsável: ${emp.responsavel_contrato || "—"}\nImplantação: ${implantacao}`,
            duration: 8000,
            action: {
              label: "Ver empresa",
              onClick: () => navigate("/empresas"),
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role, navigate]);
}
