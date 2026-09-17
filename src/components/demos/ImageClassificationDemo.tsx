import { useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";

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

  const modelState = useModel({ task: "image-classification", model });

  async function classify(url: string) {
    setImageUrl(url);
    setPredictions([]);
    const output = await modelState.run<Prediction[]>(url, { top_k: 5 });
    setPredictions(output ?? []);
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void classify(URL.createObjectURL(file));
  }

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => void classify(src)}
              className="rounded border border-current/20 px-2 py-1 font-mono text-xs hover:bg-current/5"
            >
              Sample {index + 1}
            </button>
          ))}
        </div>

        <label className="flex w-fit cursor-pointer flex-col gap-1 font-mono text-xs">
          <span>Upload an image</span>
          <input type="file" accept="image/*" onChange={handleUpload} className="text-xs" />
        </label>

        {imageUrl && (
          <img src={imageUrl} alt="" className="max-h-64 w-fit rounded border border-current/15" />
        )}

        {modelState.status === "running" && (
          <p className="font-mono text-xs opacity-70">Classifying…</p>
        )}

        {predictions.length > 0 && (
          <div className="flex flex-col gap-2">
            {predictions.map((prediction) => (
              <ConfidenceBar
                key={prediction.label}
                label={prediction.label}
                score={prediction.score}
              />
            ))}
          </div>
        )}
      </div>
    </DemoShell>
  );
}
