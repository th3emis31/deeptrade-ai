// Shim: main.jsx imports "./App.jsx" while the application lives in src/src/App.jsx.
// Re-export so the build resolves without moving the original file.
export { default } from "./src/App.jsx";
export * from "./src/App.jsx";
