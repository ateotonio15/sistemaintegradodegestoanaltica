# Painel lateral “Ver casos”

## Objetivo
Abrir os casos críticos do alerta global em um painel lateral compacto, sem mudar de página e sem bloquear toda a tela.

## Implementação
- Trocar o redirecionamento do botão **Ver casos** pela abertura de um painel lateral.
- Reutilizar os cálculos atuais de mudanças previstas em 90 dias, aumento e margem projetada negativa.
- Ordenar os casos pela mudança mais próxima e, em empate, pela margem projetada mais negativa.
- Exibir titular, dependente, dias restantes, data, faixa, valores, aumento, margens e status.
- Fazer **Ver titular** abrir a aba Dependentes UEA já focada diretamente no titular correspondente.
- Manter a lista automaticamente sincronizada com os dados atuais; casos resolvidos desaparecem e novos casos entram sem ação manual.

## Validação
- Conferir abertura e fechamento do painel em desktop e celular.
- Conferir ordenação, pluralização e abertura direta do titular.
- Confirmar que o alerta some quando não houver casos críticos e que nenhuma regra de cálculo foi alterada.
