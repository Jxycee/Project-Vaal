export interface DetailRow {
  label: string;
  value: string | number;
}

export function DetailInfoPanel({
  title,
  accentColor,
  rows,
}: {
  title: string;
  accentColor: string;
  rows: DetailRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <aside className="overflow-hidden rounded-xl border border-border bg-card md:sticky md:top-6">
      <div
        className="border-b border-border px-4 py-3"
        style={{ backgroundColor: `color-mix(in oklab, ${accentColor} 14%, transparent)` }}
      >
        <p className="text-center font-heading text-sm font-semibold">{title}</p>
      </div>
      <div>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2 text-sm last:border-b-0"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="text-right font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
