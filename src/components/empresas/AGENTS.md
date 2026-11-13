# Empresas components
- Contract history (`empresa_historico`) is append-only and written only by SECURITY DEFINER triggers on empresas/grupos_financeiros_contratos/reajustes (one event per UPDATE, real diffs only); reads inherit empresas RLS, and update/delete are blocked by trigger. Optional `siga.origem` session setting overrides the inferred origin.
