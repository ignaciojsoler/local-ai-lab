import { useEffect, useRef } from "react";
import type { ModelStatus } from "./useModel";

/**
 * Runs the demo's default case once the model is ready.
 *
 * A visitor returning to a page whose weights are already on their device
 * should not have to press anything to see the thing work: nothing is
 * downloaded, so there is nothing to ask permission for, and an empty results
 * column is a worse greeting than an answer.
 *
 * It fires once per load of the model. A model that goes ready -> running ->
 * ready has just finished an inference of its own, and firing on that arrival
 * would loop forever. Clearing the weights resets it, so loading them again
 * greets the visitor the same way.
 */
export function useAutoRun(status: ModelStatus, run: () => void) {
  const hasRun = useRef(false);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (status === "idle") {
      hasRun.current = false;
      return;
    }

    if (status !== "ready" || hasRun.current) return;

    hasRun.current = true;
    runRef.current();
  }, [status]);
}
