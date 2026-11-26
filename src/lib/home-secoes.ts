/**
 * Regra de exibição das seções da tela inicial.
 *
 * Cada seção pode listar os perfis que a veem (`allow`) e logins que ficam de
 * fora mesmo com o perfil liberado (`negarUsuarios`). Admin sempre vê tudo.
 */
export type SecaoHome = {
  allow?: string[];
  negarUsuarios?: string[];
};

export type ContextoSecaoHome = {
  isAdmin: boolean;
  role: string | null | undefined;
  username: string | null | undefined;
};

export function podeVerSecaoHome(secao: SecaoHome, ctx: ContextoSecaoHome): boolean {
  if (secao.allow && !ctx.isAdmin && !secao.allow.includes(ctx.role as string)) return false;
  if (!ctx.isAdmin && secao.negarUsuarios?.includes(ctx.username ?? "")) return false;
  return true;
}
