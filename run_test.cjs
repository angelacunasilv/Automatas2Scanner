const fs = require('fs');
const bundle = fs.readFileSync('./dist/assets/index-cF7_9OOj.js', 'utf8');

// Añadimos export al final del bundle para extraer Scanner y Parser
const testScript = `
let exportedScanner, exportedParser;
` + bundle.replace('const s = new Scanner();', 'exportedScanner = new Scanner(); const s = exportedScanner;')
          .replace('const p = new Parser();', 'exportedParser = new Parser(); const p = exportedParser;') + `
globalThis.ScannerInstance = exportedScanner;
globalThis.ParserInstance = exportedParser;
`;

globalThis.document = {
  getElementById: (id) => ({
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
};
globalThis.MutationObserver = class { observe() {} };
globalThis.performance = performance;

// Evaluamos
eval(testScript);

console.log('Scanner created:', !!globalThis.ScannerInstance);
console.log('Parser created:', !!globalThis.ParserInstance);

// Probemos los casos
const codeCase1 = `INICIO
int contador = 0;
string mensaje = "Bienvenido al sistema";
boolean activo = true;

leer ( contador );
print ( contador );
print ( mensaje );
FIN`;

const s = globalThis.ScannerInstance;
const p = globalThis.ParserInstance;

const res1 = s.scan(codeCase1);
console.log('--- TOKENS CASE 1 ---');
res1.tokens.forEach(t => console.log(`Fila ${t.linea}: ${t.tipo} '${t.lexema}'`));

const pres1 = p.parse(res1.tokens, true);
console.log('--- PARSER CASE 1 ---');
console.log('Exito:', pres1.exito);
console.log('Errores:', pres1.errores);

// Ahora probemos qué pasa si el usuario NO corrió el scanner tras editar:
const codeOriginal = `INICIO
int contador = 0;
string mensaje = "Bienvenido al sistema";
boolean activo = true;

leer ( contador );
print ( mensaje );
FIN`;

const resOrig = s.scan(codeOriginal);
console.log('--- TOKENS ORIGINAL ---');
resOrig.tokens.forEach(t => console.log(`Fila ${t.linea}: ${t.tipo} '${t.lexema}'`));

// Si en la UI se agrega en la fila 7 "print ( contador );" y la fila 8 es "print ( mensaje );"
// pero los tokens son los viejos:
const presOrig = p.parse(resOrig.tokens, true);
console.log('--- PARSER ORIGINAL ---');
console.log('Exito:', presOrig.exito);
console.log('Errores:', presOrig.errores);
