import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
after(() => server.close());
const { CodigoObjeto } = await server.ssrLoadModule('/src/codigoObjeto.ts');
const { Scanner } = await server.ssrLoadModule('/src/scanner.ts');
const { Parser } = await server.ssrLoadModule('/src/parser.ts');
const { TraduccionEnsamblador } = await server.ssrLoadModule('/src/traduccionEnsamblador.ts');
const { EXAMPLES } = await server.ssrLoadModule('/src/examples.ts');

const fila = (instruccion, operandos = '', etiqueta = '') => ({ etiqueta, instruccion, operandos });
const codigo = (...filas) => [fila('.code'), ...filas];
const hex = filas => filas.map(f => f.hex).join(' ');
const generar = (...filas) => new CodigoObjeto().generarFilas(codigo(...filas));
const offset = f => parseInt(f.direccion.replaceAll(' ', ''), 2);

test('asignación completa: DW sin inicializar, segmentos separados y @DATA reubicable', () => {
  const tokens = new Scanner().scan('INICIO\nint numero = 10;\nFIN').tokens;
  assert.equal(new Parser().parse(tokens, true).exito, true);
  const objeto = new CodigoObjeto();
  const asm = new TraduccionEnsamblador().generarFilas(tokens);
  const filas = objeto.generarFilas(asm);
  assert.equal(hex(filas.slice(0, 2)), '-- --');
  assert.equal(filas[0].contenido, '????????');
  assert.equal(filas[1].direccion, '0000 0000 0000 0001');
  assert.equal(filas[2].direccion, '0000 0000 0000 0000');
  assert.equal(hex(filas.slice(2)), 'B8 00 00 8E D8 B8 0A 00 89 06 00 00 B8 00 4C CD 21');
  assert.equal(filas.filter(f => f.reubicacion).length, 2);
  assert.match(objeto.generarCodigo(asm), /requiere reubicación/);
});

test('reglas de las diapositivas: implícitos, registros y modos de direccionamiento', () => {
  const casos = [
    [fila('CLC'), 'F8'], [fila('DEC', 'CX'), '49'],
    [fila('MOV', 'AX, CX'), '89 C8'], [fila('MOV', 'DL, AL'), '88 C2'],
    [fila('AND', 'DL, [BX+SI]'), '22 10'],
    [fila('AND', 'BH, [BX+DI]'), '22 39'],
    [fila('SUB', 'AL, [BX+10]'), '2A 47 0A'],
    [fila('SUB', 'DH, [BX+DI+634]'), '2A B1 7A 02'],
    [fila('ADC', 'CX, 0FD81H'), '81 D1 81 FD'],
    [fila('OR', 'word ptr [BX+SI+2000H], 30H'), '81 88 00 20 30 00'],
    [fila('OR', 'word ptr [BX+DI+875], 771'), '81 89 6B 03 03 03'],
    [fila('MOV', 'AX, [BP]'), '8B 46 00'],
    [fila('MOV', 'AX, [BX-1]'), '8B 47 FF'],
    [fila('IMUL', 'BX'), 'F7 EB'], [fila('DIV', 'BX'), 'F7 F3'],
    [fila('MOV', 'DS, AX'), '8E D8'], [fila('INT', '21H'), 'CD 21']
  ];
  for (const [asm, esperado] of casos) assert.equal(hex(generar(asm)), esperado, `${asm.instruccion} ${asm.operandos}`);
});

test('datos DB/DW, little endian y direcciones del ejercicio N1/N2/N3', () => {
  const filas = new CodigoObjeto().generarFilas([
    fila('.data'), fila('DB', '17', 'N1'), fila('DW', '5E1AH', 'N2'), fila('DB', '28', 'N3'),
    ...codigo(fila('MOV', 'AL, N1'), fila('ADD', 'AL, 39'), fila('MOV', 'DX, N2'), fila('SUB', 'DX, 43FH'), fila('MOV', 'CL, N3'))
  ]);
  assert.equal(hex(filas.filter(f => f.segmento === 'DATOS')), '11 1A 5E 1C');
  assert.equal(hex(filas.filter(f => f.segmento === 'CODIGO')), '8A 06 00 00 04 27 8B 16 01 00 81 EA 3F 04 8A 0E 03 00');
});

test('cadenas con comas, DUP y bytes reservados sin inventar ceros', () => {
  const filas = new CodigoObjeto().generarFilas([
    fila('.data'), fila('db', '"A,B", \'$\'', 'mensaje'), fila('db', "3 dup('$')", 'buffer'), fila('dw', '2 dup(?)', 'datos'),
    ...codigo(fila('lea', 'dx, buffer'))
  ]);
  assert.equal(hex(filas), '41 2C 42 24 24 24 24 -- -- -- -- 8D 16 04 00');
});

test('saltos hacia delante y atrás y CALL usan el final de la instrucción como base', () => {
  const filas = generar(fila('mov', 'ax, 1', 'inicio:'), fila('jne', 'fin'), fila('call', 'fin'), fila('jmp', 'inicio'), fila('ret', '', 'fin:'));
  assert.equal(hex(filas), 'B8 01 00 75 05 E8 02 00 EB F6 C3');
});

test('amplía saltos condicionales fuera de rel8 con instrucciones válidas en 8086', () => {
  const filas = generar(fila('je', 'fin'), ...Array.from({ length: 130 }, () => fila('nop')), fila('ret', '', 'fin:'));
  assert.equal(hex(filas.slice(0, 5)), '75 03 E9 82 00');
  assert.equal(offset(filas.at(-1)), 135);
  const salto = generar(fila('jmp', 'fin'), ...Array.from({ length: 130 }, () => fila('nop')), fila('ret', '', 'fin:'));
  assert.equal(hex(salto.slice(0, 3)), 'E9 82 00');
});

test('integra todos los ejemplos válidos, incluyendo leer, print, if y while', () => {
  for (const ejemplo of EXAMPLES.slice(0, 3)) {
    const scan = new Scanner().scan(ejemplo.code);
    assert.equal(scan.errores.length, 0);
    const parse = new Parser().parse(scan.tokens, true);
    assert.equal(parse.exito, true, JSON.stringify(parse.errores));
    const filas = new CodigoObjeto().generarFilas(new TraduccionEnsamblador().generarFilas(scan.tokens));
    assert.ok(filas.some(f => f.segmento === 'DATOS'));
    assert.ok(filas.some(f => f.origen === 'ret'));
    for (const segmento of ['DATOS', 'CODIGO']) {
      const bytes = filas.filter(f => f.segmento === segmento);
      bytes.forEach((byte, indice) => assert.equal(offset(byte), indice));
    }
    // Cada salto debe llegar a la primera instrucción de su etiqueta real.
    const bytes = filas.filter(f => f.segmento === 'CODIGO');
    const asm = new TraduccionEnsamblador().generarFilas(scan.tokens);
    const destinos = new Map();
    let posicion = 0;
    let enCodigo = false;
    for (let i = 0; i < asm.length; i++) {
      const f = asm[i];
      if (f.instruccion === '.code') { enCodigo = true; continue; }
      if (!enCodigo) continue;
      if (f.instruccion === 'end') break;
      if (f.etiqueta && f.instruccion !== 'endp') destinos.set(f.etiqueta.replace(':', ''), posicion);
      if (!f.instruccion || ['proc', 'endp'].includes(f.instruccion)) continue;
      const instruccion = [f.etiqueta, f.instruccion, f.operandos].filter(Boolean).join(' ');
      assert.equal(bytes[posicion].origen, instruccion);
      while (posicion < bytes.length && bytes[posicion].origen === instruccion) posicion++;
    }
    for (let i = 0; i < bytes.length; i++) {
      const match = /^(call|jmp|jne|je|jle|jge|jl|jg|loop) (\w+)$/.exec(bytes[i].origen);
      if (!match || (i && bytes[i - 1].origen === bytes[i].origen)) continue;
      const op = parseInt(bytes[i].hex, 16);
      const largo = op === 0xe8 || op === 0xe9;
      let desplazamiento = parseInt(bytes[i + 1].hex, 16);
      if (largo) desplazamiento |= parseInt(bytes[i + 2].hex, 16) << 8;
      if (desplazamiento >= (largo ? 32768 : 128)) desplazamiento -= largo ? 65536 : 256;
      assert.equal(i + (largo ? 3 : 2) + desplazamiento, destinos.get(match[2]), bytes[i].origen);
    }
  }
});

test('rechaza instrucciones, símbolos, tamaños y segmentos inválidos', () => {
  assert.throws(() => generar(fila('mov', 'ax, desconocida')), /Símbolo desconocido/);
  assert.throws(() => generar(fila('mov', 'al, 256')), /no cabe/);
  assert.throws(() => generar(fila('mov', 'ax, bl')), /tamaños diferentes/);
  assert.throws(() => generar(fila('jmp', 'ausente')), /Etiqueta desconocida/);
  assert.throws(() => generar(fila('mov', '[bx], [si]')), /memoria-memoria/);
  assert.throws(() => generar(fila('mov', 'ax, [ax]')), /Símbolo desconocido/);
  assert.throws(() => generar(fila('xyz', 'ax, bx')), /Instrucción no soportada/);
  assert.throws(() => new CodigoObjeto().generarFilas([fila('.data'), fila('dw', '32769 dup(?)', 'x')]), /segmento excede/);
});

test('una misma instancia puede generar otro programa y recuperarse de errores', () => {
  const objeto = new CodigoObjeto();
  objeto.generarFilas([fila('.data'), fila('dw', '?', 'x'), ...codigo(fila('mov', 'ax, x'))]);
  assert.throws(() => objeto.generarFilas(codigo(fila('mov', 'ax, x'))), /Símbolo desconocido/);
  assert.equal(hex(objeto.generarFilas(codigo(fila('ret')))), 'C3');
  assert.equal(objeto.generarCodigo([]), '');
});

test('el parser rechaza instrucciones posteriores a FIN', () => {
  const scan = new Scanner().scan('INICIO\nint x = 1;\nFIN\nx = 2;');
  assert.equal(new Parser().parse(scan.tokens, true).exito, false);
});
