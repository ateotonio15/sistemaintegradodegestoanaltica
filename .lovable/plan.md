## Remover módulo "Saúde nas Empresas"

### O que será removido

1. **Rota `/saude`** em `src/App.tsx` (import de `SaudeEmpresas` + `<Route path="/saude">`).
2. **Link de navegação** "Saúde nas Empresas" no menu lateral (`src/components/AppLayout.tsx`).
3. **Página** `src/pages/SaudeEmpresas.tsx` e componentes exclusivos do módulo (se houver subpasta `src/components/saude/`, será apagada).
4. Qualquer redirecionamento ou referência residual ao caminho `/saude`.

### O que NÃO será alterado

- Tabelas do banco de dados (saúde/enfermeira) permanecerão intactas, podendo ser removidas depois caso confirme.
- Perfil "Enfermeira" e suas permissões continuam existindo (apenas perde acesso à tela).
- Demais módulos (Dashboard, Empresas, Movimentações, Financeiro, Reajustes, Executivas, Usuários) ficam inalterados.

### Observação

Se quiser também remover as tabelas do banco e o perfil "Enfermeira", me avise — faço em seguida com migration separada.
