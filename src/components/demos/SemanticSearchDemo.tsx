import { useState } from "react";
import { DemoShell } from "../demo-kit/DemoShell";
import { ConfidenceBar } from "../demo-kit/ConfidenceBar";
import { useModel } from "../demo-kit/useModel";
import { rankBySimilarity, type EmbeddingMatrix, type RankedDocument } from "../../lib/similarity";

/**
 * Five unrelated sentences and a query that shares one word with the right
 * answer: "on". Everything else has to be understood — cat as an animal,
 * sleeping as resting, a sofa as furniture — so nothing here can be
 * explained away as keyword matching.
 *
 * The runner-up is the other animal sentence, which is the ranking a person
 * would produce too.
 */
const DEFAULT_QUERY = "An animal resting on furniture";

const DEFAULT_DOCUMENTS = [
  "The cat is sleeping on the sofa.",
  "A puppy is playing with a tennis ball.",
  "The stock market fell sharply after the announcement.",
  "JavaScript is widely used to build interactive websites.",
  "A doctor examined the patient and prescribed antibiotics.",
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
            <p className="eyebrow">No run yet</p>
          )}
        </div>
      </div>
    </DemoShell>
  );
}
