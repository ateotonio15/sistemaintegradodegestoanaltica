import { Badge } from "@/components/ui/badge";
import { classificarPa, corPa } from "../lib/saude-rules";

export function PaBadge({ pas, pad }: { pas?: number | null; pad?: number | null }) {
  const cat = classificarPa(pas, pad);
  if (!cat) return <span className="text-xs text-muted-foreground">—</span>;
  return <Badge variant="outline" className={corPa(cat)}>{cat}</Badge>;
}
