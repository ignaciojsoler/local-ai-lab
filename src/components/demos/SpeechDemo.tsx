import { useRef, useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { useModel } from "../demo-kit/useModel";
import { useAutoRun } from "../demo-kit/useAutoRun";
import { PendingResult } from "../demo-kit/PendingResult";
import { decodeAudio } from "../../lib/audio";

type Transcript = { text: string };

/**
 * English only, and told rather than detected.
 *
 * Whisper detects the language itself when it is not told, and on a short
 * clip it detects badly. A selector was tried and removed: `whisper-base`
 * transcribes accented English well and Spanish poorly — a four-second
 * Spanish sentence came back as "Fíjate a tua estasurrala taula" — so
 * offering the choice was offering a setting that only had one good value.
 */
const LANGUAGE = "english";

/**
 * One clip for now, in English, verified against the model before shipping.
 *
 * Whisper-tiny needs clean speech. Two 1960s radio transmissions and a
 * fragment of a podcast were tried first and all three came back invented:
 * the Apollo 11 "one small step" broadcast transcribed as "I'm going to stop
 * right now."
 */
/**
 * Three short clips, each verified against the model before shipping and
 * each about ten seconds: long enough for Whisper to have context, short
 * enough that the run finishes while you are still looking at it.
 */
const SAMPLES = [
  { name: "kennedy", src: "/samples/speech-en.wav" },
  { name: "librivox", src: "/samples/speech-librivox.mp3" },
  { name: "pooh", src: "/samples/speech-pooh.mp3" },
];

export default function SpeechDemo({
  model,
  sizeLabel,
}: {
  model: string;
  sizeLabel: string;
}) {
  const [clip, setClip] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [decodeError, setDecodeError] = useState<string | null>(null);

  // Only the newest run may write. A slower earlier one finishing later used
  // to leave its text prepended to the new one: one transcript made of two.
  const runIdRef = useRef(0);

  const objectUrlRef = useRef<string | null>(null);

  const modelState = useModel({ task: "automatic-speech-recognition", model });
  const running = modelState.status === "running";

  async function transcribe(src: string) {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const isCurrent = () => runIdRef.current === runId;

    setClip(src);
    setText("");
    setDecodeError(null);

    let samples: Float32Array;
    try {
      // The model takes mono samples at 16 kHz. Doing the decoding here keeps
      // the worker free of anything that needs the DOM.
      const response = await fetch(src);
      samples = await decodeAudio(await response.arrayBuffer());
    } catch {
      if (isCurrent()) setDecodeError("That audio could not be decoded by this browser.");
      return;
    }

    const output = await modelState.run<Transcript>(
      [samples],
      // Whisper guesses the language when it is not told, and on a short clip
      // it guesses badly: a German sentence came back as invented English.
      { chunk_length_s: 30, language: LANGUAGE, task: "transcribe" },
      (chunk) => {
        if (isCurrent()) setText((soFar) => soFar + chunk);
      },
    );
    if (output?.text && isCurrent()) setText(output.text.trim());
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    void transcribe(url);
  }

  useAutoRun(modelState.status, () => void transcribe(SAMPLES[0].src));

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="demo-columns">
        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Data input</span>
            <label className="link-quiet cursor-pointer">
              Upload audio
              <input type="file" accept="audio/*" onChange={handleUpload} className="sr-only" />
            </label>
          </div>

          <div className="flex flex-col gap-3">
            {clip ? (
              <audio src={clip} controls className="w-full" />
            ) : (
              <p className="eyebrow">Pick a clip or upload your own</p>
            )}


            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => void transcribe(sample.src)}
                  className={sample.src === clip ? "chip is-active" : "chip"}
                >
                  {sample.name}
                </button>
              ))}
            </div>

            {decodeError && (
              <p role="alert" className="font-mono text-xs text-[var(--color-danger)]">
                {decodeError}
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Transcript</span>
            <span className="eyebrow">
              {running ? "Decoding…" : text ? "Done" : "Awaiting input"}
            </span>
          </div>

          {/* The encoder runs before the first token exists. Until then this is
              a meter rather than a blinking caret on an empty line. */}
          {running && !text && (
            <PendingResult running label="Decoding the audio" />
          )}

          <p
            data-testid="transcript"
            className={running && text ? "transcription is-streaming" : "transcription"}
          >
            {text}
          </p>
        </div>
      </div>
    </DemoShell>
  );
}
