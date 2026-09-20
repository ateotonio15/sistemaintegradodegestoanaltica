# Alerta global de risco de margem — Dependentes UEA

## Objetivo
Adicionar uma faixa global, compacta e não bloqueante, logo abaixo do cabeçalho principal. Ela aparecerá somente para usuários com permissão de visualizar Dependentes UEA e somente quando houver casos críticos reais.

## Implementação
- Criar um componente específico para o alerta global, separado do sistema de notificações e do sino.
- Reutilizar `useTitularesUea` e `proximasMudancasFaixa(..., 90)`, a mesma fonte e regra da seção “Próximas mudanças de faixa”.
- Considerar somente mudanças futuras de dependentes ativos com aumento de mensalidade (`diferença > 0`) e margem projetada negativa (`margem_apos < 0`).
- Contar titulares únicos, evitando duplicidade quando um mesmo titular tiver mais de um dependente crítico.
- Não renderizar nada, nem reservar espaço, quando a contagem for zero, enquanto os dados carregam ou quando o usuário não tiver acesso ao módulo.
- Inserir a faixa no conteúdo global do sistema, abaixo do cabeçalho e antes da página atual, preservando a navegação e sem sobreposição.
- Exibir texto singular/plural dinâmico e botão “Ver casos”.
- Fazer “Ver casos” abrir Dependentes UEA diretamente na seção de próximas mudanças, com o filtro “Ficará sem margem”.
- Ajustar a página Dependentes UEA para reconhecer esse destino sem mudar cálculos, filtros existentes ou permissões.

## Visual
- Fundo e borda usando os tokens de alerta destrutivo do tema atual.
- Ícone de alerta, título curto, contagem em alto contraste e ação compacta.
- Layout horizontal no desktop e empilhado no mobile, com pouca altura e sem animações chamativas.

## Validação
- Confirmar que o alerta aparece em outras páginas permitidas e persiste ao navegar.
- Confirmar singular, plural e ausência total quando não há casos.
- Confirmar que “Ver casos” leva ao filtro correto e à seção correta.
- Validar desktop e mobile, além de conferir erros de execução e compilação.
