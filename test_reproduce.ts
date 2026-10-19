import { Scanner } from './src/scanner';
import { Parser } from './src/parser';

const code1 = `INICIO
int contador = 0;
string mensaje = "Bienvenido al sistema";
boolean activo = true;

leer ( contador );
print ( contador );
print ( mensaje );
FIN`;

const s = new Scanner();
const p = new Parser();

const sr = s.scan(code1);
const pr = p.parse(sr.tokens, true);

console.log('--- TEST 1: print ( contador ); luego print ( mensaje ); ---');
console.log('Exito:', pr.exito);
console.log('Errores:', pr.errores);

const code2 = `INICIO
int contador = 0;
string mensaje = "Bienvenido al sistema";
boolean activo = true;

leer ( contador );
print ( contador );
FIN`;

const sr2 = s.scan(code2);
const pr2 = p.parse(sr2.tokens, true);
console.log('--- TEST 2: print ( contador ); sin mensaje ---');
console.log('Exito:', pr2.exito);
console.log('Errores:', pr2.errores);
