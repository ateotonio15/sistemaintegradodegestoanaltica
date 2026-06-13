import { forwardRef, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type InputProps = React.ComponentPropsWithoutRef<typeof Input>;

interface DecimalInputProps extends Omit<InputProps, "value" | "onChange" | "type"> {
  /** Numeric value (e.g. 305.2). Use null/0/undefined for empty. */
  value: number | null | undefined;
  /** Called with the parsed numeric value (NaN -> 0). */
  onChange: (n: number) => void;
  /** Decimals shown when formatting on blur. Default 2. */
  decimals?: number;
  /** If true, formats to fixed decimals on blur. Default true. */
  formatOnBlur?: boolean;
}

function toDisplay(n: number | null | undefined): string {
  if (n == null || n === 0 || Number.isNaN(n)) return "";
  return String(n).replace(".", ",");
}

function parse(text: string): number {
  if (!text) return 0;
  const clean = text.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(clean);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Input decimal "amigável" pt-BR.
 * Mantém o texto digitado intacto enquanto o campo está focado
 * (permite digitar vírgula, zero final, etc. sem reformatação intermediária).
 */
export const DecimalInput = forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ value, onChange, decimals = 2, formatOnBlur = true, onFocus, onBlur, ...rest }, ref) => {
    const [text, setText] = useState<string>(() => toDisplay(value));
    const focusedRef = useRef(false);

    // Sincroniza com valor externo apenas quando não está focado (evita clobberar digitação)
    useEffect(() => {
      if (!focusedRef.current) {
        const ext = toDisplay(value);
        // Se o número parseado do texto atual já corresponde ao externo, mantém o texto
        // (preserva "305," ou "305,20" enquanto não houver mudança real)
        if (parse(text) !== (value ?? 0)) {
          setText(ext);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
      <Input
        {...rest}
        ref={ref}
        inputMode="decimal"
        type="text"
        value={text}
        onFocus={(e) => {
          focusedRef.current = true;
          onFocus?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          // Aceita apenas dígitos, vírgula, ponto e sinal
          const sanitized = raw.replace(/[^\d.,-]/g, "");
          setText(sanitized);
          onChange(parse(sanitized));
        }}
        onBlur={(e) => {
          focusedRef.current = false;
          const n = parse(text);
          if (formatOnBlur && n !== 0) {
            setText(n.toFixed(decimals).replace(".", ","));
          } else if (n === 0) {
            setText("");
          }
          onBlur?.(e);
        }}
      />
    );
  },
);
DecimalInput.displayName = "DecimalInput";
