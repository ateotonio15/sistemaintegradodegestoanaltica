import ReactMarkdown from "react-markdown";

export function MensagemBody({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <div
      className={
        "prose prose-sm max-w-none prose-p:my-1 prose-img:my-1 prose-img:rounded-lg" +
        (dark ? " dark:prose-invert prose-invert" : " dark:prose-invert")
      }
    >
      <ReactMarkdown
        components={{
          p: ({ node, ...props }) => <p className="whitespace-pre-wrap" {...props} />,
          img: ({ node, ...props }) => (
            <a href={props.src as string} target="_blank" rel="noreferrer">
              <img
                {...props}
                className="rounded-lg max-h-64 border border-border/40 cursor-zoom-in"
              />
            </a>
          ),
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" className="underline" />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
