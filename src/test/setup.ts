import "@testing-library/jest-dom/vitest";

// jsdom has no createObjectURL, and Vitest's own compat shim throws on a
// plain `new File([...], name)` (it expects an internal buffer field), so we
// always install a plain mock rather than only filling in a missing one.
globalThis.URL.createObjectURL = () => "blob:mock";
globalThis.URL.revokeObjectURL = () => {};
