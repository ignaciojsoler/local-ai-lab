import { useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { useModel } from "../demo-kit/useModel";
import { useAutoRun } from "../demo-kit/useAutoRun";
import { PendingResult } from "../demo-kit/PendingResult";

type Translation = { translation_text: string };

/**
 * Three sentences with different things to get wrong: a plain one, one with a
 * subordinate clause between subject and verb, and one about this site.
 *
 * Each was run through the model and read before being put here. An earlier
 * set had "cached" in it, which came back as the invented verb "se caché".
 */
const SAMPLES = [
  {
    name: "plain",
    text: "The cat is sleeping on the sofa.",
  },
  {
    name: "clause",
    text: "The model was downloaded once, and now it runs without a server.",
  },
  {
    name: "privacy",
    text: "Every word you type stays inside your browser.",
  },
];

export default function TranslationDemo({
  model,
  sizeLabel,
}: {
  model: string;
  sizeLabel: string;
}) {
  const [text, setText] = useState(SAMPLES[0].text);
  const [translation, setTranslation] = useState("");

  const modelState = useModel({ task: "translation", model });

  async function translate(source: string) {
    setTranslation("");
    // The third argument subscribes to the decoder, so the Spanish arrives
    // word by word instead of appearing whole when the run is over.
    const output = await modelState.run<Translation[]>([source], undefined, (chunk) =>
      setTranslation((soFar) => soFar + chunk),
    );
    // The streamed chunks and the final result say the same thing; taking the
    // result as the last word keeps a dropped chunk from truncating it.
    if (output?.[0]) setTranslation(output[0].translation_text.trim());
  }

  useAutoRun(modelState.status, () => void translate(SAMPLES[0].text));

  const running = modelState.status === "running";

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="demo-columns">
        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Data input</span>
            <span className="eyebrow">English</span>
          </div>

          <div className="flex flex-col gap-3">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={4}
              aria-label="English text"
              className="field"
            />

            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => {
                    setText(sample.text);
                    void translate(sample.text);
                  }}
                  className={sample.text === text ? "chip is-active" : "chip"}
                >
                  {sample.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void translate(text)}
              disabled={text.trim() === "" || modelState.status !== "ready"}
              className="btn btn-primary w-fit"
            >
              {running ? "Translating…" : "Translate"}
            </button>
          </div>
        </div>

        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Spanish</span>
            <span className="eyebrow">
              {running ? "Decoding…" : translation ? "Done" : "Awaiting input"}
            </span>
          </div>

          {/* The encoder runs before the first token exists. Until then this is
              a meter rather than a blinking caret on an empty line. */}
          {running && !translation && (
            <PendingResult running label="Reading the sentence" />
          )}

          <p
            data-testid="translation"
            className={running && translation ? "transcription is-streaming" : "transcription"}
            lang="es"
          >
            {translation}
          </p>
        </div>
      </div>
    </DemoShell>
  );
}
