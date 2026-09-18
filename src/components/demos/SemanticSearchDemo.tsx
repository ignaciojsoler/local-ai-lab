import { useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";
import { PendingResult } from "../demo-kit/PendingResult";
import { useAutoRun } from "../demo-kit/useAutoRun";
import { rankBySimilarity, type EmbeddingMatrix, type RankedDocument } from "../../lib/similarity";

/**
 * Five unrelated sentences and a query that shares **no word at all** with
 * the right answer — not even an article. Every link has to be understood:
 * pet as cat, nap as sleeping, home as the room the sofa is in.
 *
 * The distractors are deliberately on other subjects. An earlier version put
 * a second animal sentence among them and it scored 0.26 against the cat's
 * 0.32, which is a correct ranking that reads as a close call.
 */
const DEFAULT_QUERY = "A pet taking a nap at home";

const DEFAULT_DOCUMENTS = [
  "The cat is sleeping on the sofa.",
  "The stock market fell sharply after the announcement.",
  "JavaScript is widely used to build interactive websites.",
  "A doctor examined the patient and prescribed antibiotics.",
  "The train to the airport leaves every twenty minutes.",
].join("\n");

function parseDocuments(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export default function SemanticSearchDemo({
  model,
  sizeLabel,
}: {
  model: string;
  sizeLabel: string;
}) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [rawDocuments, setRawDocuments] = useState(DEFAULT_DOCUMENTS);
  const [ranked, setRanked] = useState<RankedDocument[]>([]);

  const modelState = useModel({ task: "feature-extraction", model });
  const documents = parseDocuments(rawDocuments);

  async function search() {
    setRanked([]);
    // One run for the query and the whole corpus: the pipeline batches them,
    // and the embeddings are only comparable when they come from one pass.
    const output = await modelState.run<EmbeddingMatrix>([[query, ...documents]], {
      pooling: "mean",
      normalize: true,
    });
    if (!output) return;
    setRanked(rankBySimilarity(output, documents));
  }

  // Weights already on the device mean there is nothing to consent to, so
  // the page answers its own default question instead of waiting.
  useAutoRun(modelState.status, () => void search());

  return (
    <DemoShell model={modelState} sizeLabel={sizeLabel}>
      <div className="demo-columns">
        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Data input</span>
            <span className="eyebrow">{documents.length} documents</span>
          </div>

          <div className="flex flex-col gap-3">
            <label className="field-label">
              <span className="eyebrow">Query</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="field"
              />
            </label>

            <label className="field-label">
              <span className="eyebrow">Documents (one per line)</span>
              <textarea
                value={rawDocuments}
                onChange={(event) => setRawDocuments(event.target.value)}
                rows={7}
                className="field"
              />
            </label>

            <button
              type="button"
              onClick={() => void search()}
              disabled={
                query.trim() === "" ||
                documents.length === 0 ||
                modelState.status !== "ready"
              }
              className="btn btn-primary w-fit"
            >
              {modelState.status === "running" ? "Searching…" : "Search"}
            </button>
          </div>
        </div>

        <div>
          <div className="demo-col-head">
            <span className="eyebrow">Similarity</span>
            <span className="eyebrow">
              {ranked.length > 0 ? "Ranked" : "Awaiting input"}
            </span>
          </div>

          {ranked.length > 0 ? (
            <ul className="score-list">
              {ranked.map((entry, rank) => (
                <li key={entry.document}>
                  <ConfidenceBar
                    label={entry.document}
                    score={entry.score}
                    rank={rank}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <PendingResult
              running={modelState.status === "running"}
              label="Embedding the documents"
            />
          )}
        </div>
      </div>
    </DemoShell>
  );
}
