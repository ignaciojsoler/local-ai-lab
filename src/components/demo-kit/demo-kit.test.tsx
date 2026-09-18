import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackendBadge } from "./BackendBadge";
import { ClearModelButton } from "./ClearModelButton";
import { ConfidenceBar } from "./ConfidenceBar";
import { DemoShell } from "./DemoShell";
import { ModelAction, ModelProgress, modelStatusLabel } from "./ModelLoader";
import type { UseModelState } from "./useModel";

function modelState(overrides: Partial<UseModelState> = {}): UseModelState {
  return {
    status: "idle",
    progress: 0,
    backend: null,
    durationMs: null,
    error: null,
    cached: false,
    probing: false,
    cacheSize: null,
    load: vi.fn(),
    run: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  };
}

describe("BackendBadge", () => {
  it("renders nothing before a backend is known", () => {
    const { container } = render(<BackendBadge backend={null} durationMs={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the backend and the timing", () => {
    render(<BackendBadge backend="webgpu" durationMs={48} />);
    expect(screen.getByText(/WebGPU/)).toBeInTheDocument();
    expect(screen.getByText(/48\s*ms/)).toBeInTheDocument();
  });

  it("labels the CPU fallback plainly", () => {
    render(<BackendBadge backend="wasm" durationMs={890} />);
    expect(screen.getByText(/WASM \(CPU\)/)).toBeInTheDocument();
  });
});

describe("ModelAction", () => {
  it("states the download size before the model is fetched", () => {
    render(<ModelAction model={modelState()} sizeLabel="~65 MB" />);
    expect(
      screen.getByRole("button", { name: /Download model \(~65 MB\)/ }),
    ).toBeInTheDocument();
  });

  it("loads the model when pressed", async () => {
    const state = modelState();
    render(<ModelAction model={state} sizeLabel="~65 MB" />);

    await userEvent.click(screen.getByRole("button"));

    expect(state.load).toHaveBeenCalledOnce();
  });

  it("offers to restore instead of download once the weights are cached", () => {
    render(<ModelAction model={modelState({ cached: true })} sizeLabel="~65 MB" />);
    expect(screen.getByRole("button", { name: /Start model/ })).toBeInTheDocument();
  });

  it("says nothing about downloading while the cache is still being probed", () => {
    const { container } = render(
      <ModelAction model={modelState({ probing: true })} sizeLabel="~65 MB" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ModelProgress", () => {
  it("shows a determinate bar while downloading", () => {
    render(
      <ModelProgress model={modelState({ status: "loading", progress: 42 })} sizeLabel="~65 MB" />,
    );

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
  });

  it("drops the percentage when the weights come back from the cache", () => {
    render(
      <ModelProgress
        model={modelState({ status: "loading", cached: true })}
        sizeLabel="~65 MB"
      />,
    );

    const bar = screen.getByRole("progressbar", { name: /Restoring model from cache/ });
    expect(bar).not.toHaveAttribute("aria-valuenow");
  });
});

describe("modelStatusLabel", () => {
  it("names the runtime condition without overstating it", () => {
    expect(modelStatusLabel(modelState({ probing: true }))).toBe("Checking cache");
    expect(modelStatusLabel(modelState())).toBe("Weights not cached");
    expect(modelStatusLabel(modelState({ cached: true }))).toBe("Weights cached");
    expect(modelStatusLabel(modelState({ status: "loading" }))).toBe("Downloading weights");
    expect(modelStatusLabel(modelState({ status: "loading", cached: true }))).toBe("Restoring");
  });
});

describe("ClearModelButton", () => {
  it("confirms in place before clearing", async () => {
    const onClear = vi.fn();
    render(<ClearModelButton cacheSize={68_157_440} onClear={onClear} />);

    await userEvent.click(screen.getByRole("button", { name: /Clear model \(65 MB\)/ }));
    expect(onClear).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^Clear$/ }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("backs out on cancel", async () => {
    const onClear = vi.fn();
    render(<ClearModelButton cacheSize={null} onClear={onClear} />);

    await userEvent.click(screen.getByRole("button", { name: /Clear model/ }));
    await userEvent.click(screen.getByRole("button", { name: /Cancel/ }));

    expect(onClear).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Clear model/ })).toBeInTheDocument();
  });
});

describe("ConfidenceBar", () => {
  it("renders the label and the score as a percentage", () => {
    render(<ConfidenceBar label="POSITIVE" score={0.9312} />);
    expect(screen.getByText("POSITIVE")).toBeInTheDocument();
    expect(screen.getByText("0.93")).toBeInTheDocument();
  });
});

describe("DemoShell", () => {
  it("shows the demo inert, not hidden, until the model is ready", () => {
    render(
      <DemoShell model={modelState()} sizeLabel="~65 MB">
        <button type="button">run</button>
      </DemoShell>,
    );

    expect(screen.getByRole("button", { name: /Download model/ })).toBeInTheDocument();
    // Visible so the visitor can see what the panel does, but every control
    // inside it is disabled by the surrounding fieldset.
    expect(screen.getByRole("button", { name: "run" })).toBeDisabled();
  });

  it("shows the demo and the badge once ready", () => {
    render(
      <DemoShell
        model={modelState({ status: "ready", backend: "wasm", durationMs: 120 })}
        sizeLabel="~65 MB"
      >
        <p>demo body</p>
      </DemoShell>,
    );

    expect(screen.getByText("demo body")).toBeInTheDocument();
    expect(screen.getByText(/WASM \(CPU\)/)).toBeInTheDocument();
  });

  it("offers to clear the weights once they are cached", () => {
    render(
      <DemoShell
        model={modelState({ status: "ready", cached: true, cacheSize: 68_157_440 })}
        sizeLabel="~65 MB"
      >
        <p>demo body</p>
      </DemoShell>,
    );

    expect(screen.getByRole("button", { name: /Clear model \(65 MB\)/ })).toBeInTheDocument();
  });

  it("surfaces an error message", () => {
    render(
      <DemoShell
        model={modelState({ status: "error", error: "network unreachable" })}
        sizeLabel="~65 MB"
      >
        <p>demo body</p>
      </DemoShell>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("network unreachable");
  });
});
