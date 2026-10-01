ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS aguarda_faturamento_excel boolean NOT NULL DEFAULT false;

UPDATE public.empresas
SET aguarda_faturamento_excel = true,
    exige_po_pc = false
WHERE codigo_contrato IN ('2477','2187','1270','1271');