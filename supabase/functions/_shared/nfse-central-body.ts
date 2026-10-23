import { z } from "npm:zod@3";
/** Entrada aceita do navegador: somente o ID. Valores e resultados são recusados. */
export const BodyUsuario = z.object({ recebimento_id: z.string().uuid() }).strict();
