// "Sadece göster" sonucu: panelin kuracağı adımların özeti (Z6 kurulum kartı ve Z4 penceresi ortak kullanır).

export function SetupResultNote({ summary, message, title = "Panel şunu kuracaktı:" }: { summary: string[]; message?: string; title?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted p-3 text-sm text-foreground">
      {message && <p className="font-semibold text-muted-foreground">{message}</p>}
      <p className={message ? "mt-2 font-semibold" : "font-semibold"}>{title}</p>
      {summary.length > 0 ? (
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {summary.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted-foreground">Kurulacak adım yok.</p>
      )}
    </div>
  );
}
