export function identificarAnexoImportado(nome: string) {
  const extensao = (nome.split(".").pop() ?? "").toLowerCase();
  const contrato = nome.match(/_Contrato_(\d+)_/i)?.[1] ?? null;
  const tipo = /vidas.*ativas|relatorio.*vidas/i.test(nome) && extensao === "pdf"
    ? "Relatório de Vidas"
    : /mensalidades/i.test(nome) && ["xlsx", "xls", "csv"].includes(extensao)
      ? "OPS Mensalidades" : "Outros";
  const data = nome.match(/_Contrato_\d+_(\d{4})(\d{2})(\d{2})(?:_(\d{2})(\d{2}))?\./);
  let geradoEm: string | null = null;
  if (data) {
    const [, ano, mes, dia, hora, minuto] = data;
    const date = new Date(Number(ano), Number(mes) - 1, Number(dia));
    if (date.getFullYear() === Number(ano) && date.getMonth() + 1 === Number(mes) && date.getDate() === Number(dia)
      && (!hora || (Number(hora) < 24 && Number(minuto) < 60))) {
      geradoEm = `${dia}/${mes}/${ano}${hora ? ` ${hora}:${minuto}` : ""}`;
    }
  }
  return { extensao, contrato, tipo, geradoEm,
    aceito: ["pdf", "xls", "xlsx", "csv", "png", "jpg", "jpeg", "webp", "gif"].includes(extensao) };
}

export function mesmoAnexoImportado(
  existente: { nome_arquivo: string; empresa_id: string; movimentacao_id: string },
  novo: { nome: string; contrato: number; empresaId: string; movimentacaoId: string },
) {
  const atual = identificarAnexoImportado(existente.nome_arquivo);
  const recebido = identificarAnexoImportado(novo.nome);
  // A movimentação identifica a competência/período; não usa a data de geração como competência.
  return existente.movimentacao_id === novo.movimentacaoId && existente.empresa_id === novo.empresaId
    && existente.nome_arquivo === novo.nome && atual.contrato === String(novo.contrato)
    && atual.tipo === recebido.tipo;
}