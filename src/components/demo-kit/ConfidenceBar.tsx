export function ConfidenceBar({ label, score }: { label: string; score: number }) {
  const percent = score * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between font-mono text-xs">
        <span>{label}</span>
        <span className="opacity-70">{percent.toFixed(1)}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded bg-current/10">
        <div className="h-full bg-current" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
