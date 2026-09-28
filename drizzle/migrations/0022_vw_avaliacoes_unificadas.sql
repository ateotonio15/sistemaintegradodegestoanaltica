CREATE OR REPLACE VIEW public.vw_avaliacoes_unificadas WITH (security_invoker = true) AS
SELECT
  coalesce(r.id, e.id) AS id,
  e.id AS envio_id,
  r.id AS resposta_id,
  e.tipo,
  e.empresa_id,
  coalesce(e.empresa_nome, r.nome_empresa) AS empresa_nome,
  coalesce(nullif(r.nome_executiva,''), e.executiva_nome) AS executiva_nome,
  coalesce(emp.sem_executiva_vinculada, false) AS sem_executiva_vinculada,
  CASE WHEN r.id IS NOT NULL THEN 'respondido' ELSE coalesce(e.status,'enviado') END AS status,
  coalesce(e.data_envio, e.created_at) AS data_envio,
  coalesce(r.created_at, e.data_resposta) AS data_resposta,
  e.lembrete_enviado_em,
  r.nota_media,
  r.respostas,
  r.comentario,
  e.unidade
FROM public.avaliacoes_envios e
LEFT JOIN public.cs_avaliacao_respostas r ON r.envio_id = e.id
LEFT JOIN public.empresas emp ON emp.id = e.empresa_id
UNION ALL
SELECT r.id, NULL, r.id, r.tipo, NULL, r.nome_empresa, r.nome_executiva, false,
  'respondido', r.created_at, r.created_at, NULL, r.nota_media, r.respostas, r.comentario, r.unidade
FROM public.cs_avaliacao_respostas r
WHERE r.envio_id IS NULL;

GRANT SELECT ON public.vw_avaliacoes_unificadas TO authenticated;
GRANT SELECT ON public.vw_avaliacoes_unificadas TO service_role;