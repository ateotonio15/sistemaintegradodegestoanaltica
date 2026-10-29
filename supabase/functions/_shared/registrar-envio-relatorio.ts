export async function concluirEnvioRelatorio(enviar: () => Promise<void>, registrar: () => Promise<void>): Promise<void> {
  await enviar();
  await registrar();
}