import { readFileSync } from 'fs';

// Cargamos el bundle y extraemos los objetos
const bundle = readFileSync('./dist/assets/index-cF7_9OOj.js', 'utf-8');

// Ejecutamos el bundle con un entorno simulado
let capturedScanner, capturedParser;
const sandbox = {
  document: {
    getElementById: () => ({
      addEventListener: () => {},
      appendChild: () => {},
      style: {},
      click: () => {},
      innerHTML: '',
      value: ''
    }),
    createElement: () => ({ relList: {} }),
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  MutationObserver: class { observe() {} },
  performance: performance,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout
};

// Vamos a probar con TypeScript transpilando src/ a una sola función
import('./src/types.ts').catch(async () => {
  // Como es un entorno node, transpilemos src/scanner.ts y src/parser.ts rápidamente con esbuild/vite si está
});
