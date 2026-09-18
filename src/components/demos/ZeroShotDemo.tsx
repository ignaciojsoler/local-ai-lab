import { useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";
import { PendingResult } from "../demo-kit/PendingResult";
import { useAutoRun } from "../demo-kit/useAutoRun";

type ZeroShotOutput = { sequence: string; labels: string[]; scores: number[] };

/**
 * An ordinary sentence and three categories a person clearly invented on the
 * spot. The gap between them is the demonstration: no classifier was ever
 * trained on "revenge plot", and the model still ranks it.
 */
const DEFAULT_TEXT = "My neighbour's dog has been barking since four in the morning.";
const DEFAULT_LABELS = "noise complaint, dog appreciation, revenge plot";

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
    const output = await modelState.run<ZeroShotOutput>([text, labels]);
    if (!output) return;
    setResults(output.labels.map((label, index) => ({ label, score: output.scores[index] })));
  }

  // Weights already on the device mean there is nothing to consent to, so
  // the page answers its own default question instead of waiting.
  useAutoRun(modelState.status, () => void classify());

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="demo-columns">
        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Data input</span>
            <span className="eyebrow">{labels.length} labels</span>
          </div>

          <div className="flex flex-col gap-3">
            <label className="field-label">
              <span className="eyebrow">Text to classify</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={4}
                className="field"
              />
            </label>

            <label className="field-label">
              <span className="eyebrow">Candidate labels (comma separated)</span>
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
                text.trim() === "" || labels.length < 2 || modelState.status !== "ready"
              }
              className="btn btn-primary w-fit"
            >
              {modelState.status === "running" ? "Classifying…" : "Classify"}
            </button>
          </div>
        </div>

        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Probabilities</span>
            <span className="eyebrow">
              {results.length > 0 ? "Ranked" : "Awaiting input"}
            </span>
          </div>

          {results.length > 0 ? (
            <div>
              {results.map((result, rank) => (
                <ConfidenceBar
                  key={result.label}
                  label={result.label}
                  score={result.score}
                  rank={rank}
                />
              ))}
            </div>
          ) : (
            <PendingResult
              running={modelState.status === "running"}
              label="Scoring each label"
            />
          )}
        </div>
      </div>
    </DemoShell>
  );
}
