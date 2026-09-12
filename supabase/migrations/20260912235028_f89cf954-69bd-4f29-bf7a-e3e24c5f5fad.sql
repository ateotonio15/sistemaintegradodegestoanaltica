-- O fluxo de setores é automático: ninguém altera o processo diretamente pela tabela.
-- Leitura continua liberada para todos os usuários autenticados.
DROP POLICY "contrato_processos_write" ON public.contrato_processos;