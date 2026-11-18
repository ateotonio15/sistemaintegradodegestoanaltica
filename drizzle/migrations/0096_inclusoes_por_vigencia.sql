CREATE TABLE public.inclusoes_vigencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  contrato_id text NOT NULL,
  fechamento_id uuid NOT NULL REFERENCES public.movimentacoes(id),
  cpf text NOT NULL CHECK (cpf ~ '^[0-9]{11}$'),
  beneficiario_nome text,
  data_adesao date NOT NULL,
  data_identificacao date NOT NULL DEFAULT CURRENT_DATE,
  origem text NOT NULL DEFAULT 'Relatório atualizado SIGA',
  status text NOT NULL DEFAULT 'identificada',
  criado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inclusoes_vigencia_unica UNIQUE (empresa_id, contrato_id, cpf, data_adesao, fechamento_id)
);
CREATE INDEX inclusoes_vigencia_fechamento_idx ON public.inclusoes_vigencia (fechamento_id);
CREATE INDEX inclusoes_vigencia_empresa_idx ON public.inclusoes_vigencia (empresa_id, data_adesao);

GRANT SELECT, INSERT ON public.inclusoes_vigencia TO authenticated;
GRANT ALL ON public.inclusoes_vigencia TO service_role;

ALTER TABLE public.inclusoes_vigencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inclusoes vigencia leitura" ON public.inclusoes_vigencia FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum') OR public.has_role(auth.uid(),'financeiro'));

CREATE POLICY "Inclusoes vigencia registro" ON public.inclusoes_vigencia FOR INSERT TO authenticated
WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum') OR public.has_role(auth.uid(),'financeiro')) AND criado_por = auth.uid());

COMMENT ON TABLE public.inclusoes_vigencia IS 'Append-only: inclusões por vigência identificadas após o fechamento; não alimenta ainda cards/totais.';