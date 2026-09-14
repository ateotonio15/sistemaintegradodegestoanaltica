/**
 * Base URL pública do sistema (site publicado).
 * Links compartilhados externamente (QR Code, avaliações, pesquisas) nunca devem
 * apontar para o ambiente de preview, que exige login.
 */
export const PUBLISHED_BASE_URL = "https://sistemaintegradodegestoanaltica.lovable.app";

export function getPublicBaseUrl(): string {
  if (typeof window === "undefined") return PUBLISHED_BASE_URL;
  const host = window.location.hostname;
  const isInterno =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith("lovableproject.com") ||
    host.includes("id-preview") ||
    host.includes("-preview--");
  return isInterno ? PUBLISHED_BASE_URL : window.location.origin;
}
