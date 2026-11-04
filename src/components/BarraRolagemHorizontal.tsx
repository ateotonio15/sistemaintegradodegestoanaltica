import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

/**
 * Barra de rolagem horizontal fixa na base da janela enquanto uma tabela longa
 * está sendo lida.
 *
 * O scrollbar nativo de uma tabela com muitas linhas só aparece depois da
 * última linha, o que obriga a descer até o fim para trocar de coluna. Esta
 * barra desenha um polegar próprio, sempre visível, que move a tabela real.
 * Ela fica invisível quando o scrollbar nativo já está alcançável na tela.
 *
 * `alvo` é a caixa que rola ou um invólucro que a contenha (caso do <Table>
 * do shadcn, cuja caixa interna é marcada com [data-rolagem-horizontal]).
 */
const caixaQueRola = (elemento: HTMLElement) =>
  elemento.querySelector<HTMLElement>("[data-rolagem-horizontal]") ?? elemento;

type Medida = {
  largura: number;
  trilha: number;
  proporcao: number;
  posicao: number;
  nativoForaDaTela: boolean;
};

const SEM_MEDIDA: Medida = { largura: 0, trilha: 0, proporcao: 1, posicao: 0, nativoForaDaTela: false };

export function BarraRolagemHorizontal({
  alvo,
  className,
}: {
  alvo: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const trilha = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Medida>(SEM_MEDIDA);

  useEffect(() => {
    const invólucro = alvo.current;
    if (!invólucro) return;
    const tabela = caixaQueRola(invólucro);

    const medir = () => {
      const precisa = tabela.scrollWidth > tabela.clientWidth + 1;
      const faixa = tabela.scrollWidth - tabela.clientWidth;
      const r = tabela.getBoundingClientRect();
      const nova: Medida = {
        largura: precisa ? tabela.scrollWidth : 0,
        trilha: trilha.current?.clientWidth ?? 0,
        proporcao: precisa ? tabela.clientWidth / tabela.scrollWidth : 1,
        posicao: precisa && faixa > 0 ? tabela.scrollLeft / faixa : 0,
        nativoForaDaTela: precisa && r.top < window.innerHeight - 40 && r.bottom > window.innerHeight + 4,
      };
      setM((atual) =>
        atual.largura === nova.largura &&
        atual.trilha === nova.trilha &&
        atual.proporcao === nova.proporcao &&
        atual.posicao === nova.posicao &&
        atual.nativoForaDaTela === nova.nativoForaDaTela
          ? atual
          : nova,
      );
    };

    medir();
    const redimensionar = new ResizeObserver(medir);
    redimensionar.observe(tabela);
    if (tabela.firstElementChild) redimensionar.observe(tabela.firstElementChild);
    if (trilha.current) redimensionar.observe(trilha.current);
    tabela.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, { passive: true });

    return () => {
      redimensionar.disconnect();
      tabela.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir);
    };
  }, [alvo]);

  const rolarAte = (x: number) => {
    const invólucro = alvo.current;
    const caixa = trilha.current;
    if (!invólucro || !caixa) return;
    const tabela = caixaQueRola(invólucro);
    const faixa = tabela.scrollWidth - tabela.clientWidth;
    if (faixa <= 0) return;
    const polegar = Math.max(40, caixa.clientWidth * (tabela.clientWidth / tabela.scrollWidth));
    const alcance = Math.max(1, caixa.clientWidth - polegar);
    tabela.scrollLeft = Math.min(1, Math.max(0, (x - polegar / 2) / alcance)) * faixa;
  };

  const polegar = Math.max(40, m.trilha * m.proporcao);
  const alcance = Math.max(0, m.trilha - polegar);
  const visivel = m.largura > 0 && m.nativoForaDaTela;

  return (
    <div
      ref={trilha}
      aria-hidden
      onPointerDown={(e) => {
        trilha.current?.setPointerCapture(e.pointerId);
        rolarAte(e.clientX - e.currentTarget.getBoundingClientRect().left);
      }}
      onPointerMove={(e) => {
        if (trilha.current?.hasPointerCapture(e.pointerId)) {
          rolarAte(e.clientX - e.currentTarget.getBoundingClientRect().left);
        }
      }}
      onWheel={(e) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        const invólucro = alvo.current;
        if (!invólucro) return;
        caixaQueRola(invólucro).scrollLeft += e.deltaX;
      }}
      className={cn(
        "sticky bottom-0 z-20 h-3 shrink-0 touch-none border-t border-border/60 bg-card",
        // Permanece montada para não deslocar a página ao aparecer.
        !visivel && "invisible",
        className,
      )}
    >
      <div
        className="absolute inset-y-[3px] rounded-full bg-primary/70 hover:bg-primary"
        style={{ width: `${polegar}px`, left: `${m.posicao * alcance}px` }}
      />
    </div>
  );
}
