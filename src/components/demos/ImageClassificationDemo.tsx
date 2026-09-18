import { useEffect, useRef, useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";
import { PendingResult } from "../demo-kit/PendingResult";
import { useAutoRun } from "../demo-kit/useAutoRun";

type Prediction = { label: string; score: number };

const SAMPLES = [
  "/samples/dog.jpg",
  "/samples/espresso.jpg",
  "/samples/bicycle.jpg",
];

export default function ImageClassificationDemo({
  model,
  sizeLabel,
}: {
  model: string;
  sizeLabel: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  // `imageUrl` holds either a static sample path (never revoked, nothing to
  // clean up) or an object URL created from an uploaded file. Only the
  // latter needs revoking, and only once it is no longer the one on screen,
  // so we track it separately rather than revoking whatever `imageUrl` last
  // held.
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const modelState = useModel({ task: "image-classification", model });

  async function classify(url: string) {
    setImageUrl(url);
    setPredictions([]);
    const output = await modelState.run<Prediction[]>([url], { top_k: 5 });
    setPredictions(output ?? []);
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // Revoke the previous upload's object URL now that it is being
    // replaced. The one currently displayed (if any) is exactly the one
    // stored here, so this never revokes a URL still on screen.
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    void classify(url);
  }

  // Weights already on the device mean there is nothing to consent to, so
  // the page answers its own default question instead of waiting.
  useAutoRun(modelState.status, () => void classify(SAMPLES[0]));

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="demo-columns">
        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Data input</span>
            <label className="link-quiet cursor-pointer">
              Upload image
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="sr-only"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="max-h-64 w-full border border-[var(--color-border)] object-cover"
              />
            ) : (
              <p className="eyebrow">Pick a sample or upload an image</p>
            )}

            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => void classify(src)}
                  className={src === imageUrl ? "chip is-active" : "chip"}
                >
                  {src.split("/").pop()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Probabilities</span>
            <span className="eyebrow">
              {modelState.status === "running"
                ? "Classifying…"
                : predictions.length > 0
                  ? "Top 5"
                  : "Awaiting input"}
            </span>
          </div>

          {predictions.length > 0 ? (
            <div>
              {predictions.map((prediction, rank) => (
                <ConfidenceBar
                  key={prediction.label}
                  label={prediction.label}
                  score={prediction.score}
                  rank={rank}
                />
              ))}
            </div>
          ) : (
            <PendingResult
              running={modelState.status === "running"}
              label="Classifying the image"
            />
          )}
        </div>
      </div>
    </DemoShell>
  );
}
