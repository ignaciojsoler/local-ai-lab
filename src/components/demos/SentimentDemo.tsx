import { useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";

type Prediction = { label: string; score: number };

const SAMPLES = [
  "The battery lasts all day and the screen is gorgeous. Worth every penny.",
  "Arrived scratched, and support never replied. I want a refund.",
  "It does the job, though the app crashes more often than I would like.",
];

export default function SentimentDemo({
  model,
  sizeLabel,
}: {
  model: string;
  sizeLabel: string;
}) {
  const [text, setText] = useState(SAMPLES[0]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  const modelState = useModel({ task: "text-classification", model });

  async function analyze() {
    const output = await modelState.run<Prediction[]>(text);
    setPrediction(output?.[0] ?? null);
  }

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((sample, index) => (
            <button
              key={sample}
              type="button"
              onClick={() => setText(sample)}
              className="rounded border border-current/20 px-2 py-1 font-mono text-xs hover:bg-current/5"
            >
              Sample {index + 1}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          aria-label="Review text"
          className="w-full rounded border border-current/20 bg-transparent p-3 text-sm"
        />

        <button
          type="button"
          onClick={() => void analyze()}
          disabled={text.trim() === "" || modelState.status === "running"}
          className="w-fit rounded border border-current/30 px-3 py-2 font-mono text-sm disabled:opacity-40"
        >
          {modelState.status === "running" ? "Analyzing…" : "Analyze"}
        </button>

        {prediction && <ConfidenceBar label={prediction.label} score={prediction.score} />}
      </div>
    </DemoShell>
  );
}
