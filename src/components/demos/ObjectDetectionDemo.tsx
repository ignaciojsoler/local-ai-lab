import { useEffect, useRef, useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";
import { PendingResult } from "../demo-kit/PendingResult";
import { useAutoRun } from "../demo-kit/useAutoRun";
import { toOverlayRect, type DetectionBox } from "../../lib/boxes";

type Detection = { label: string; score: number; box: DetectionBox };

/**
 * One object, three objects, and two of the same kind.
 *
 * The street scene the classifier uses is replaced here by the zebras: it
 * held eleven overlapping bicycles, cars and people, which is an impressive
 * count and an unreadable picture. Two zebras make the same point — this
 * model counts instances, where a classifier only names a category — with
 * two boxes you can actually see.
 */
const SAMPLES = ["/samples/dog.jpg", "/samples/espresso.jpg", "/samples/zebras.jpg"];

/** Below this the boxes are mostly noise, and the picture becomes unreadable. */
const THRESHOLD = 0.5;

export default function ObjectDetectionDemo({
  model,
  sizeLabel,
}: {
  model: string;
  sizeLabel: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[] | null>(null);

  // Only an uploaded file's object URL needs revoking, and only once it is no
  // longer the one on screen, so it is tracked apart from `imageUrl`.
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const modelState = useModel({ task: "object-detection", model });

  async function detect(url: string) {
    setImageUrl(url);
    setDetections(null);
    // Percentages, not pixels: the overlay is laid out in CSS over whatever
    // size the image happens to render at.
    const output = await modelState.run<Detection[]>([url], {
      threshold: THRESHOLD,
      percentage: true,
    });
    setDetections(output ?? []);
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    void detect(url);
  }

  const ranked = detections ? [...detections].sort((a, b) => b.score - a.score) : null;

  // Weights already on the device mean there is nothing to consent to, so
  // the page answers its own default question instead of waiting.
  useAutoRun(modelState.status, () => void detect(SAMPLES[0]));

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="demo-columns">
        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Data input</span>
            <label className="link-quiet cursor-pointer">
              Upload image
              <input type="file" accept="image/*" onChange={handleUpload} className="sr-only" />
            </label>
          </div>

          <div className="flex flex-col gap-3">
            {imageUrl ? (
              <div className="detection-frame">
                <img src={imageUrl} alt="" />
                {ranked?.map((detection) => {
                  const rect = toOverlayRect(detection.box);
                  return (
                    <span
                      key={`${detection.label}-${rect.left}-${rect.top}`}
                      data-testid="detection-box"
                      className="detection-box"
                      style={{
                        left: `${rect.left}%`,
                        top: `${rect.top}%`,
                        width: `${rect.width}%`,
                        height: `${rect.height}%`,
                      }}
                    >
                      <span className="detection-tag">{detection.label}</span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="eyebrow">Pick a sample or upload an image</p>
            )}

            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => void detect(src)}
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
            <span className="eyebrow">Detections</span>
            <span className="eyebrow">
              {modelState.status === "running"
                ? "Detecting…"
                : ranked
                  ? `${ranked.length} found`
                  : "Awaiting input"}
            </span>
          </div>

          {ranked === null ? (
            <PendingResult
              running={modelState.status === "running"}
              label="Scanning the image"
            />
          ) : ranked.length === 0 ? (
            <p className="eyebrow">Nothing above the threshold of {THRESHOLD}</p>
          ) : (
            <ul className="score-list">
              {ranked.map((detection, rank) => (
                <li key={`${detection.label}-${rank}`}>
                  <ConfidenceBar
                    label={detection.label}
                    score={detection.score}
                    rank={rank}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DemoShell>
  );
}
