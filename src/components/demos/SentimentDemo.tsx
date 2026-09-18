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
    const output = await modelState.run<Prediction[]>([text]);
    setPrediction(output?.[0] ?? null);
  }

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="demo-columns">
        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Data input</span>
            <span className="eyebrow">Review text</span>
          </div>

          <div className="flex flex-col gap-3">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={5}
              aria-label="Review text"
              className="field"
            />

            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((sample, index) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setText(sample)}
                  className={sample === text ? "chip is-active" : "chip"}
                >
                  sample_{index + 1}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void analyze()}
              disabled={text.trim() === "" || modelState.status !== "ready"}
              className="btn btn-primary w-fit"
            >
              {modelState.status === "running" ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </div>

        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Probabilities</span>
            <span className="eyebrow">{prediction ? "Top label" : "Awaiting input"}</span>
          </div>

          {prediction ? (
            <ConfidenceBar label={prediction.label} score={prediction.score} />
          ) : (
            <p className="eyebrow">No run yet</p>
          )}
        </div>
      </div>
    </DemoShell>
  );
}
