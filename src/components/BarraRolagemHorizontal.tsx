import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

/**
 * Barra de rolagem horizontal que fica fixa na base da janela enquanto a
 * tabela longa está sendo lida.
 *
 * O scrollbar nativo de uma tabela com muitas linhas só aparece depois da
 * última linha, obrigando a descer até o fim para trocar de coluna. Esta barra
 * espelha a posição de rolagem da tabela real nos dois sentidos e fica
 * invisível quando o scrollbar nativo já está alcançável na tela.
 *
 * `alvo` é a própria caixa que rola ou um invólucro que contenha a caixa
 * marcada com [data-rolagem-horizontal] (caso do <Table> do shadcn).
 */
const caixaQueRola = (elemento: HTMLElement) =>
  elemento.querySelector<HTMLElement>("[data-rolagem-horizontal]") ?? elemento;

const alinhar = (de: HTMLElement, para: HTMLElement | null) => {
  if (para && Math.abs(para.scrollLeft - de.scrollLeft) > 1) para.scrollLeft = de.scrollLeft;
};

export function BarraRolagemHorizontal({
  alvo,
  className,
}: {
  alvo: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const barra = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [nativoForaDaTela, setNativoForaDaTela] = useState(false);

  useEffect(() => {
    const invólucro = alvo.current;
    if (!invólucro) return;
    const tabela = caixaQueRola(invólucro);

    const medir = () => setLargura(tabela.scrollWidth > tabela.clientWidth + 1 ? tabela.scrollWidth : 0);
    // Só vale mostrar a barra enquanto a tabela está sendo lida: ela já começou
    // a aparecer e o scrollbar nativo ainda está abaixo da dobra.
    const vigiar = () => {
      const r = tabela.getBoundingClientRect();
      setNativoForaDaTela(r.top < window.innerHeight - 40 && r.bottom > window.innerHeight + 4);
    };
    const rever = () => {
      medir();
      vigiar();
    };

    rever();

    const redimensionar = new ResizeObserver(rever);
    redimensionar.observe(tabela);
    if (tabela.firstElementChild) redimensionar.observe(tabela.firstElementChild);

    const aoRolarTabela = () => alinhar(tabela, barra.current);
    tabela.addEventListener("scroll", aoRolarTabela, { passive: true });
    window.addEventListener("resize", medir);
    window.addEventListener("resize", vigiar);
    window.addEventListener("scroll", vigiar, { passive: true });

    return () => {
      redimensionar.disconnect();
      tabela.removeEventListener("scroll", aoRolarTabela);
      window.removeEventListener("resize", medir);
      window.removeEventListener("resize", vigiar);
      window.removeEventListener("scroll", vigiar);
    };
  }, [alvo]);

  const visivel = largura > 0 && nativoForaDaTela;

  // Sincroniza ao voltar a aparecer: a barra pode ter ficado parada enquanto
  // a tabela era rolada pelo mouse ou pelo teclado.
  useEffect(() => {
    if (!visivel) return;
    const invólucro = alvo.current;
    if (invólucro) alinhar(caixaQueRola(invólucro), barra.current);
  }, [visivel, alvo]);

  return (
    <div
      ref={barra}
      aria-hidden
      onScroll={() => {
        const invólucro = alvo.current;
        if (invólucro) alinhar(barra.current!, caixaQueRola(invólucro));
      }}
      className={cn(
        // Permanece montada para não deslocar a página ao aparecer.
        "sticky bottom-0 z-20 h-3 shrink-0 overflow-x-auto border-t border-border/60 bg-card scrollbar-fixa",
        !visivel && "invisible",
        className,
      )}
    >
      <div style={{ width: largura, height: 1 }} />
    </div>
  );
}
