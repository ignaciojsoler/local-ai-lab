import { useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";

type Prediction = { label: string; score: number };

/**
 * Restaurant reviews, because the task has to be legible before the result
 * is: everyone knows what a review is and what a good one sounds like.
 *
 * Each sample is named after what it demonstrates rather than its position,
 * and each is one this model reads correctly — `mixed` in particular, where
 * the complaint about the wait does not drag the verdict negative.
 */
const SAMPLES = [
  {
    name: "glowing",
    text: "Best carbonara I've had outside Rome. I went back the next day.",
  },
  {
    name: "fly_in_soup",
    text: "There was a fly in my soup. An actual fly. In my actual soup.",
  },
  {
    name: "mixed",
    text: "Took forty minutes to arrive, but honestly it was worth the wait.",
  },
];

export default function SentimentDemo({
  model,
  sizeLabel,
}: {
  model: string;
  sizeLabel: string;
}) {
  const [text, setText] = useState(SAMPLES[0].text);
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
              {SAMPLES.map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => setText(sample.text)}
                  className={sample.text === text ? "chip is-active" : "chip"}
                >
                  {sample.name}
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
