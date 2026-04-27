create or replace function public.guard_movimentacoes_comum()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_role(auth.uid(), 'comum'::app_role) then
    -- impede que o cadastro reabra/reescreva o envio ao financeiro já registrado
    if old.data_envio_financeiro is not null
       and new.data_envio_financeiro is distinct from old.data_envio_financeiro then
      raise exception 'Cadastro não pode alterar envio ao financeiro já registrado';
    end if;
    -- mantém o flag de prazo somente sob controle do financeiro/admin
    new.dentro_prazo := old.dentro_prazo;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_mov_comum on public.movimentacoes;
create trigger trg_guard_mov_comum
  before update on public.movimentacoes
  for each row
  execute function public.guard_movimentacoes_comum();