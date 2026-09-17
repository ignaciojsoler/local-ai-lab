import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackendBadge } from "./BackendBadge";
import { ConfidenceBar } from "./ConfidenceBar";
import { DemoShell } from "./DemoShell";
import { ModelLoader } from "./ModelLoader";
import type { UseModelState } from "./useModel";

function modelState(overrides: Partial<UseModelState> = {}): UseModelState {
  return {
    status: "idle",
    progress: 0,
    backend: null,
    durationMs: null,
    error: null,
    load: vi.fn(),
    run: vi.fn(),
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

describe("ModelLoader", () => {
  it("states the download size before the model is fetched", () => {
    render(<ModelLoader status="idle" progress={0} sizeLabel="~65 MB" onLoad={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Load model \(~65 MB\)/ })).toBeInTheDocument();
  });

  it("calls onLoad when the button is pressed", async () => {
    const onLoad = vi.fn();
    render(<ModelLoader status="idle" progress={0} sizeLabel="~65 MB" onLoad={onLoad} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("shows a progress bar while loading", () => {
    render(<ModelLoader status="loading" progress={42} sizeLabel="~65 MB" onLoad={vi.fn()} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
  });
});

describe("ConfidenceBar", () => {
  it("renders the label and the score as a percentage", () => {
    render(<ConfidenceBar label="POSITIVE" score={0.9312} />);
    expect(screen.getByText("POSITIVE")).toBeInTheDocument();
    expect(screen.getByText("93.1%")).toBeInTheDocument();
  });
});

describe("DemoShell", () => {
  it("shows the loader and hides the demo until the model is ready", () => {
    render(
      <DemoShell model={modelState()} sizeLabel="~65 MB">
        <p>demo body</p>
      </DemoShell>,
    );

    expect(screen.getByRole("button", { name: /Load model/ })).toBeInTheDocument();
    expect(screen.queryByText("demo body")).not.toBeInTheDocument();
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
