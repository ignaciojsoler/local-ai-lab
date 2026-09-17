import { useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";

type ZeroShotOutput = { sequence: string; labels: string[]; scores: number[] };

const DEFAULT_TEXT = "My package never arrived and nobody answered my emails.";
const DEFAULT_LABELS = "shipping, billing, product quality";

function parseLabels(raw: string): string[] {
  return raw
    .split(",")
    .map((label) => label.trim())
    .filter((label) => label !== "");
}

export default function ZeroShotDemo({
  model,
  sizeLabel,
}: {
  model: string;
  sizeLabel: string;
}) {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [rawLabels, setRawLabels] = useState(DEFAULT_LABELS);
  const [results, setResults] = useState<Array<{ label: string; score: number }>>([]);

  const modelState = useModel({ task: "zero-shot-classification", model });
  const labels = parseLabels(rawLabels);

  async function classify() {
    setResults([]);
    const output = await modelState.run<ZeroShotOutput>(text, { candidate_labels: labels });
    if (!output) return;
    setResults(output.labels.map((label, index) => ({ label, score: output.scores[index] })));
  }

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="flex flex-col gap-4">
        <label className="field-label">
          <span>Text to classify</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            className="field"
          />
        </label>

        <label className="field-label">
          <span>Candidate labels (comma separated)</span>
          <input
            value={rawLabels}
            onChange={(event) => setRawLabels(event.target.value)}
            className="field"
          />
        </label>

        <button
          type="button"
          onClick={() => void classify()}
          disabled={
            text.trim() === "" || labels.length < 2 || modelState.status === "running"
          }
          className="btn btn-primary w-fit"
        >
          {modelState.status === "running" ? "Classifying…" : "Classify"}
        </button>

        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((result) => (
              <ConfidenceBar key={result.label} label={result.label} score={result.score} />
            ))}
          </div>
        )}
      </div>
    </DemoShell>
  );
}
