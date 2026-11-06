export function SigaLoading({ label = "Carregando..." }: { label?: string }) {
  return (
    <span role="status" className="siga-loading">
      <span className="siga-loading-track" aria-hidden="true"><span /></span>
      <span>{label}</span>
    </span>
  );
}