UPDATE public.financeiro_movimentacoes
   SET tipo_cobranca = 'NÃO-PRORATA'
 WHERE periodo IN ('10-15','15-20')
   AND tipo_cobranca = 'Fechada';