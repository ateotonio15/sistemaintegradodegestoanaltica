import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  buscarPessoaFisica,
  isCpfValido,
  type PessoaFisicaResult,
} from "@/lib/pessoa-fisica-lookup";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect: (pessoa: PessoaFisicaResult) => void;
  placeholder?: string;
};

export default function PessoaFisicaAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
}: Props) {
  const [results, setResults] = useState<PessoaFisicaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [suppress, setSuppress] = useState(false);
  // Só busca depois que a usuária digitar no campo (nome já salvo não abre a lista).
  const [typed, setTyped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (suppress || !typed) return;
    const term = value.trim();
    if (term.length < 3) {
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const data = await buscarPessoaFisica(term, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setResults(data);
        setOpen(true);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("buscarPessoaFisica error", err);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value, suppress]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleSelect = (p: PessoaFisicaResult) => {
    setSuppress(true);
    setOpen(false);
    setResults([]);
    onSelect(p);
    // libera o auto-search após próximo tick para permitir nova digitação
    setTimeout(() => setSuppress(false), 50);
  };

  return (
    <div className="relative" ref={containerRef}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          {results.map((p, i) => {
            const cpf = isCpfValido(p.NR_CPF) ? p.NR_CPF : null;
            return (
              <button
                key={`${p.ID ?? i}-${i}`}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground border-b border-border last:border-b-0"
              >
                <div className="font-medium text-sm">
                  {p.NM_PESSOA_FISICA || "(sem nome)"}
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                  {cpf && <span>CPF: {cpf}</span>}
                  {p.CARTEIRINHA && <span>Carteirinha: {p.CARTEIRINHA}</span>}
                  {p.DT_NASCIMENTO && <span>DN: {p.DT_NASCIMENTO}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
