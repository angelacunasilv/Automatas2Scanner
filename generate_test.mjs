import fs from 'fs';

// Leemos los archivos y quitamos las declaraciones import/export
let types = fs.readFileSync('./src/types.ts', 'utf8').replace(/export /g, '');
let scanner = fs.readFileSync('./src/scanner.ts', 'utf8').replace(/import [^;]+;/g, '').replace(/export /g, '');
let semantic = fs.readFileSync('./src/semantic.ts', 'utf8').replace(/import [^;]+;/g, '').replace(/export /g, '');
let parser = fs.readFileSync('./src/parser.ts', 'utf8').replace(/import [^;]+;/g, '').replace(/export /g, '');

// Creamos un código TS combinado
const combined = `
${types}
${scanner}
${semantic}
${parser}

const codeWithPrint = \`INICIO
int contador = 0;
string mensaje = "Bienvenido al sistema";
boolean activo = true;

leer ( contador );
print ( contador );
print ( mensaje );
FIN\`;

const sc = new Scanner();
const pa = new Parser();

const sRes = sc.scan(codeWithPrint);
console.log('--- TOKENS ---');
sRes.tokens.forEach(t => console.log('Fila ' + t.linea + ' (' + t.tipo + '): ' + t.lexema));

const pRes = pa.parse(sRes.tokens, true);
console.log('--- PARSER RESULT ---');
console.log('Exito:', pRes.exito);
console.log('Errores:', pRes.errores);

const codeWithoutSemicolon = \`INICIO
int contador = 0;
string mensaje = "Bienvenido al sistema";
boolean activo = true;

leer ( contador );
print ( contador )
print ( mensaje );
FIN\`;
const sRes2 = sc.scan(codeWithoutSemicolon);
const pRes2 = pa.parse(sRes2.tokens, true);
console.log('--- PARSER SIN PUNTO Y COMA ---');
console.log('Errores:', pRes2.errores);
`;

fs.writeFileSync('./combined_test.ts', combined);
console.log('Generated combined_test.ts');
