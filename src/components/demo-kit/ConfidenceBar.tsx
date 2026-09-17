export function ConfidenceBar({ label, score }: { label: string; score: number }) {
  const percent = score * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between font-mono text-xs">
        <span>{label}</span>
        <span className="text-[var(--color-muted)]">{percent.toFixed(1)}%</span>
      </div>
      <div className="meter">
        <span className="meter-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
