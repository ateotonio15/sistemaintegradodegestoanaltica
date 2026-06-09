DELETE FROM public.honda_exclusoes a
USING public.honda_exclusoes b
WHERE a.cpf = b.cpf
  AND a.data_demissao = b.data_demissao
  AND a.ctid < b.ctid;