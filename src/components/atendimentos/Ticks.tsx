import { Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "sending" | "sent" | "read";

export function Ticks({ status, className }: { status: Status; className?: string }) {
  if (status === "sending") {
    return <Clock className={cn("h-3 w-3 opacity-70", className)} />;
  }
  if (status === "read") {
    return <CheckCheck className={cn("h-3.5 w-3.5 text-sky-400", className)} />;
  }
  return <CheckCheck className={cn("h-3.5 w-3.5 opacity-80", className)} />;
}

export function statusFromMsg(m: { key?: string; lida_em?: string | null }): Status {
  if (m.key && m.key.startsWith("u-")) return "sending"; // otimista
  return m.lida_em ? "read" : "sent";
}
