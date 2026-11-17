import type { AsmRow } from './traduccionEnsamblador';

export interface FilaCodigoObjeto {
  segmento: 'DATOS' | 'CODIGO';
  direccion: string;
  contenido: string;
  hex: string;
  origen: string;
  reubicacion: boolean;
}

interface Operando {
  tipo: 'registro' | 'segmento' | 'memoria' | 'inmediato';
  codigo: number;
  ancho: number;
  valor: number;
  desplazamiento: number[];
  reubicacion: boolean;
}

// Codificación Intel 8086 de 16 bits. No depende del DOM ni del analizador léxico.
export class CodigoObjeto {
  private variables: Map<string, { direccion: number; ancho: number }> = new Map();
  private etiquetas: Map<string, number> = new Map();
  private saltosLargos: Set<number> = new Set();
  private registros8: string[] = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
  private registros16: string[] = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
  private segmentos: string[] = ['es', 'cs', 'ss', 'ds'];
  private saltos: Record<string, number> = {
    jo: 0x70, jno: 0x71, jb: 0x72, jae: 0x73,
    je: 0x74, jz: 0x74, jne: 0x75, jnz: 0x75,
    jbe: 0x76, ja: 0x77, js: 0x78, jns: 0x79,
    jp: 0x7a, jnp: 0x7b, jl: 0x7c, jge: 0x7d, jle: 0x7e, jg: 0x7f
  };

  constructor() {}

  /** Una fila por byte; DATOS y CODIGO tienen contadores independientes. */
  public generarFilas(filas: AsmRow[]): FilaCodigoObjeto[] {
    this.variables.clear();
    this.etiquetas.clear();
    this.saltosLargos.clear();
    const resultado: FilaCodigoObjeto[] = [];
    const codigo: AsmRow[] = [];
    let segmento = '';
    let direccion = 0;

    for (const fila of filas) {
      const instruccion = fila.instruccion.toLowerCase();
      if (instruccion === '.data' || instruccion === '.code') {
        segmento = instruccion;
        continue;
      }
      if (['title', '.model', '.stack'].includes(instruccion)) continue;
      if (instruccion === 'end') break;
      if (segmento === '.data' && instruccion) {
        const ancho = { db: 1, dw: 2, dd: 4 }[instruccion];
        if (!ancho) throw new Error(`Directiva de datos no soportada: ${fila.instruccion}.`);
        const nombre = this.nombreEtiqueta(fila.etiqueta);
        if (nombre) {
          if (this.variables.has(nombre) || this.esRegistro(nombre)) {
            throw new Error(`Nombre de variable duplicado o reservado: ${fila.etiqueta}.`);
          }
          this.variables.set(nombre, { direccion, ancho });
        }
        const bytes = this.codificarDatos(fila.operandos, ancho);
        this.validarSegmento(direccion + bytes.length);
        for (const byte of bytes) {
          resultado.push(this.crearFila('DATOS', direccion++, byte, this.textoFila(fila)));
        }
      } else if (segmento === '.code') {
        codigo.push(fila);
      } else if (instruccion) {
        throw new Error(`Falta indicar .DATA o .CODE antes de ${fila.instruccion}.`);
      }
    }

    // Primera pasada: tamaños y etiquetas. Los saltos que no caben se amplían
    // y se vuelven a calcular hasta estabilizar todas las direcciones.
    let cambio: boolean;
    do {
      this.etiquetas.clear();
      direccion = 0;
      codigo.forEach((fila, indice) => {
        const nombre = this.nombreEtiqueta(fila.etiqueta);
        const instruccion = fila.instruccion.toLowerCase();
        if (nombre && instruccion !== 'endp') {
          if (this.etiquetas.has(nombre) || this.variables.has(nombre) || this.esRegistro(nombre)) {
            throw new Error(`Etiqueta duplicada o reservada: ${fila.etiqueta}.`);
          }
          this.etiquetas.set(nombre, direccion);
        }
        direccion += this.codificarFila(fila, direccion, indice, true).length;
        this.validarSegmento(direccion);
      });
      cambio = false;
      direccion = 0;
      codigo.forEach((fila, indice) => {
        const instruccion = fila.instruccion.toLowerCase();
        const bytes = this.codificarFila(fila, direccion, indice, true);
        if ((instruccion === 'jmp' || this.saltos[instruccion] !== undefined) && !this.saltosLargos.has(indice)) {
          const destino = this.resolverEtiqueta(fila.operandos);
          const distancia = destino - (direccion + bytes.length);
          if (distancia < -128 || distancia > 127) {
            this.saltosLargos.add(indice);
            cambio = true;
          }
        }
        direccion += bytes.length;
      });
    } while (cambio);

    // Segunda pasada: operandos y desplazamientos relativos definitivos.
    direccion = 0;
    codigo.forEach((fila, indice) => {
      const bytes = this.codificarFila(fila, direccion, indice, false);
      const reubicacion = /@data/i.test(fila.operandos);
      bytes.forEach((byte, posicion) => {
        resultado.push(this.crearFila('CODIGO', direccion++, byte, this.textoFila(fila), reubicacion && posicion > 0));
      });
    });
    return resultado;
  }

  /** Listado didáctico de bytes; @DATA queda pendiente del enlazador. */
  public generarCodigo(filas: AsmRow[]): string {
    return this.formatearFilas(this.generarFilas(filas));
  }

  public formatearFilas(filas: FilaCodigoObjeto[]): string {
    if (filas.length === 0) return '';
    const cabecera = 'Segmento\tDireccion\tContenido\tHex';
    const lineas = filas.map(f => `${f.segmento}\t${f.direccion}\t${f.contenido}\t${f.hex}`);
    const nota = filas.some(f => f.reubicacion)
      ? '\n; @DATA = 0000h provisional: requiere reubicación del enlazador. Este listado no es un archivo OBJ/EXE.'
      : '';
    return [cabecera, ...lineas].join('\n') + nota;
  }

  private codificarFila(fila: AsmRow, direccion: number, indice: number, primeraPasada: boolean): number[] {
    try {
      return this.codificarInstruccion(fila, direccion, indice, primeraPasada);
    } catch (err) {
      throw new Error(`${this.textoFila(fila)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private codificarInstruccion(fila: AsmRow, direccion: number, indice: number, primeraPasada: boolean): number[] {
    const instruccion = fila.instruccion.toLowerCase();
    const operandos = this.separarOperandos(fila.operandos);
    if (!instruccion || instruccion === 'proc' || instruccion === 'endp') return [];
    const simples: Record<string, number> = {
      clc: 0xf8, stc: 0xf9, cli: 0xfa, sti: 0xfb, cld: 0xfc, std: 0xfd,
      ret: 0xc3, nop: 0x90, cwd: 0x99
    };
    if (simples[instruccion] !== undefined) {
      this.validarCantidad(operandos, 0);
      return [simples[instruccion]];
    }
    if (['call', 'jmp', 'loop'].includes(instruccion) || this.saltos[instruccion] !== undefined) {
      this.validarCantidad(operandos, 1);
      const destino = primeraPasada ? 0 : this.resolverEtiqueta(operandos[0]);
      if (instruccion === 'call') return [0xe8, ...this.littleEndian((destino - direccion - 3) & 0xffff, 2)];
      if (this.saltosLargos.has(indice)) {
        if (instruccion === 'jmp') return [0xe9, ...this.littleEndian((destino - direccion - 3) & 0xffff, 2)];
        // 8086: invertir condición y omitir un JMP cercano (no usar Jcc de 386).
        return [this.saltos[instruccion] ^ 1, 3, 0xe9, ...this.littleEndian((destino - direccion - 5) & 0xffff, 2)];
      }
      const distancia = destino - direccion - 2;
      if (!primeraPasada && (distancia < -128 || distancia > 127)) {
        throw new Error('El salto corto supera el rango de -128 a 127 bytes.');
      }
      const opcode = instruccion === 'jmp' ? 0xeb : instruccion === 'loop' ? 0xe2 : this.saltos[instruccion];
      return [opcode, distancia & 0xff];
    }
    if (instruccion === 'int') {
      this.validarCantidad(operandos, 1);
      return [0xcd, ...this.littleEndian(this.numero(operandos[0]), 1)];
    }
    if (['push', 'pop', 'inc', 'dec', 'mul', 'imul', 'div', 'idiv', 'neg', 'not'].includes(instruccion)) {
      this.validarCantidad(operandos, 1);
      const op = this.obtenerOperando(operandos[0]);
      if (op.tipo === 'inmediato' || op.tipo === 'segmento') throw new Error('Se esperaba un registro general o memoria.');
      if (instruccion === 'push' || instruccion === 'pop') {
        if (op.tipo !== 'registro' || op.ancho !== 2) throw new Error('Se esperaba un registro de 16 bits.');
        return [(instruccion === 'push' ? 0x50 : 0x58) + op.codigo];
      }
      const ancho = op.ancho || 2;
      this.validarAncho(ancho);
      if (instruccion === 'inc' || instruccion === 'dec') {
        if (op.tipo === 'registro' && ancho === 2) return [(instruccion === 'inc' ? 0x40 : 0x48) + op.codigo];
        return [ancho === 1 ? 0xfe : 0xff, ...this.modRM(instruccion === 'inc' ? 0 : 1, op)];
      }
      const grupo = { not: 2, neg: 3, mul: 4, imul: 5, div: 6, idiv: 7 }[instruccion]!;
      return [ancho === 1 ? 0xf6 : 0xf7, ...this.modRM(grupo, op)];
    }

    this.validarCantidad(operandos, 2);
    const destino = this.obtenerOperando(operandos[0]);
    const fuente = this.obtenerOperando(operandos[1]);
    if (instruccion === 'lea') {
      if (destino.tipo !== 'registro' || destino.ancho !== 2 || fuente.tipo !== 'memoria') {
        throw new Error('LEA requiere un registro de 16 bits y una dirección de memoria.');
      }
      return [0x8d, ...this.modRM(destino.codigo, fuente)];
    }
    if (instruccion === 'mov' && (destino.tipo === 'segmento' || fuente.tipo === 'segmento')) {
      const segmento = destino.tipo === 'segmento' ? destino : fuente;
      const op = destino.tipo === 'segmento' ? fuente : destino;
      if (!['registro', 'memoria'].includes(op.tipo) || (op.ancho && op.ancho !== 2) || (destino.tipo === 'segmento' && destino.codigo === 1)) {
        throw new Error('Transferencia de registro de segmento no válida.');
      }
      return [destino.tipo === 'segmento' ? 0x8e : 0x8c, ...this.modRM(segmento.codigo, op)];
    }
    if (destino.tipo === 'inmediato' || destino.tipo === 'segmento' || fuente.tipo === 'segmento') {
      throw new Error('Combinación de operandos no válida.');
    }
    const ancho = destino.ancho || fuente.ancho || 2;
    this.validarAncho(ancho);
    if (destino.ancho && fuente.ancho && destino.ancho !== fuente.ancho) throw new Error('Los operandos tienen tamaños diferentes.');
    if (fuente.reubicacion && (instruccion !== 'mov' || destino.tipo !== 'registro' || ancho !== 2)) {
      throw new Error('@DATA requiere MOV hacia un registro de 16 bits.');
    }
    const w = ancho === 2 ? 1 : 0;
    if (instruccion === 'mov') {
      if (fuente.tipo === 'inmediato') {
        const bytes = this.littleEndian(fuente.valor, ancho);
        if (destino.tipo === 'registro') return [(w ? 0xb8 : 0xb0) + destino.codigo, ...bytes];
        return [0xc6 + w, ...this.modRM(0, destino), ...bytes];
      }
      return this.codificarTransferencia(0x88, destino, fuente, w);
    }
    const operaciones: Record<string, number> = { add: 0, or: 1, adc: 2, sbb: 3, and: 4, sub: 5, xor: 6, cmp: 7 };
    const grupo = operaciones[instruccion];
    if (grupo === undefined) throw new Error(`Instrucción no soportada: ${fila.instruccion}.`);
    if (fuente.tipo === 'inmediato') {
      const bytes = this.littleEndian(fuente.valor, ancho);
      if (destino.tipo === 'registro' && destino.codigo === 0) return [grupo * 8 + 4 + w, ...bytes];
      return [0x80 + w, ...this.modRM(grupo, destino), ...bytes];
    }
    return this.codificarTransferencia(grupo * 8, destino, fuente, w);
  }

  private codificarTransferencia(base: number, destino: Operando, fuente: Operando, w: number): number[] {
    // Registro-registro usa d=0, igual que MOV AX,CX = 89 C8 en clase.
    if (fuente.tipo === 'registro') return [base + w, ...this.modRM(fuente.codigo, destino)];
    if (destino.tipo === 'registro' && fuente.tipo === 'memoria') return [base + 2 + w, ...this.modRM(destino.codigo, fuente)];
    throw new Error('No se permite una operación memoria-memoria.');
  }

  private obtenerOperando(texto: string): Operando {
    const nombre = texto.trim().toLowerCase();
    const op: Operando = { tipo: 'inmediato', codigo: 0, ancho: 0, valor: 0, desplazamiento: [], reubicacion: false };
    if (this.registros8.includes(nombre)) return { ...op, tipo: 'registro', codigo: this.registros8.indexOf(nombre), ancho: 1 };
    if (this.registros16.includes(nombre)) return { ...op, tipo: 'registro', codigo: this.registros16.indexOf(nombre), ancho: 2 };
    if (this.segmentos.includes(nombre)) return { ...op, tipo: 'segmento', codigo: this.segmentos.indexOf(nombre), ancho: 2 };
    if (nombre === '@data') return { ...op, reubicacion: true };
    const offset = /^offset\s+(.+)$/.exec(nombre);
    if (offset) {
      const variable = this.variables.get(offset[1]);
      if (!variable) throw new Error(`Variable desconocida: ${offset[1]}.`);
      return { ...op, valor: variable.direccion };
    }
    const variable = this.variables.get(nombre);
    if (variable) return { ...op, tipo: 'memoria', codigo: 6, ancho: variable.ancho, desplazamiento: this.littleEndian(variable.direccion, 2) };
    const memoria = /^(?:(byte|word)\s+ptr\s+)?\[([^\]]+)\]$/.exec(nombre);
    if (memoria) {
      let valor = 0;
      let ancho = memoria[1] === 'byte' ? 1 : memoria[1] === 'word' ? 2 : 0;
      const registros: string[] = [];
      const terminos = memoria[2].replace(/\s/g, '').replace(/-/g, '+-').split('+').filter(Boolean);
      for (const termino of terminos) {
        if (['bx', 'bp', 'si', 'di'].includes(termino)) registros.push(termino);
        else if (this.variables.has(termino)) {
          const dato = this.variables.get(termino)!;
          valor += dato.direccion;
          if (!ancho) ancho = dato.ancho;
        } else valor += this.numero(termino);
      }
      if (registros.length === 0) return { ...op, tipo: 'memoria', codigo: 6, ancho, desplazamiento: this.littleEndian(valor, 2) };
      const modos: Record<string, number> = { 'bx+si': 0, 'bx+di': 1, 'bp+si': 2, 'bp+di': 3, si: 4, di: 5, bp: 6, bx: 7 };
      const clave = registros.sort((a, b) => ['bx', 'bp', 'si', 'di'].indexOf(a) - ['bx', 'bp', 'si', 'di'].indexOf(b)).join('+');
      const rm = modos[clave];
      if (rm === undefined) throw new Error(`Modo de direccionamiento 8086 no válido: ${texto}.`);
      if (valor === 0 && clave !== 'bp') return { ...op, tipo: 'memoria', codigo: rm, ancho };
      const corto = valor >= -128 && valor <= 127;
      return { ...op, tipo: 'memoria', codigo: (corto ? 0x40 : 0x80) | rm, ancho,
        desplazamiento: this.littleEndian(corto ? valor & 0xff : valor, corto ? 1 : 2) };
    }
    return { ...op, valor: this.numero(texto) };
  }

  private modRM(reg: number, op: Operando): number[] {
    if (op.tipo !== 'registro' && op.tipo !== 'memoria') throw new Error('Se esperaba registro o memoria para ModR/M.');
    return [(op.tipo === 'registro' ? 0xc0 : 0) | (reg << 3) | op.codigo, ...op.desplazamiento];
  }

  private codificarDatos(texto: string, ancho: number, profundidad: number = 0): (number | null)[] {
    if (profundidad > 16) throw new Error('Demasiados niveles de DUP.');
    const bytes: (number | null)[] = [];
    for (const valor of this.separarOperandos(texto)) {
      const dup = /^(\d+)\s+dup\s*\((.*)\)$/i.exec(valor);
      let datos: (number | null)[];
      if (dup) {
        const contenido = this.codificarDatos(dup[2], ancho, profundidad + 1);
        const cantidad = Number(dup[1]);
        this.validarSegmento(bytes.length + contenido.length * cantidad);
        datos = [];
        for (let i = 0; i < cantidad; i++) datos.push(...contenido);
      } else if (valor === '?') datos = Array<number | null>(ancho).fill(null);
      else if (/^(["']).*\1$/s.test(valor)) {
        if (ancho !== 1) throw new Error('Las cadenas requieren DB.');
        datos = Array.from(valor.slice(1, -1), caracter => {
          const byte = caracter.codePointAt(0)!;
          if (byte > 255) throw new Error(`Carácter fuera del juego de 8 bits: ${caracter}.`);
          return byte;
        });
      } else datos = this.littleEndian(this.numero(valor), ancho);
      this.validarSegmento(bytes.length + datos.length);
      bytes.push(...datos);
    }
    if (bytes.length === 0) throw new Error('La declaración de datos no contiene valores.');
    return bytes;
  }

  private separarOperandos(texto: string): string[] {
    if (!texto.trim()) return [];
    const partes: string[] = [];
    let inicio = 0;
    let comilla = '';
    let nivel = 0;
    for (let i = 0; i < texto.length; i++) {
      const caracter = texto[i];
      if (comilla) {
        if (caracter === comilla) comilla = '';
      } else if (caracter === '"' || caracter === "'") comilla = caracter;
      else if (caracter === '(' || caracter === '[') nivel++;
      else if (caracter === ')' || caracter === ']') nivel--;
      else if (caracter === ',' && nivel === 0) {
        partes.push(texto.slice(inicio, i).trim());
        inicio = i + 1;
      }
    }
    partes.push(texto.slice(inicio).trim());
    if (comilla || nivel !== 0 || partes.some(p => !p)) throw new Error('Lista de operandos no válida.');
    return partes;
  }

  private numero(texto: string): number {
    const valor = texto.trim();
    if (/^(["']).\1$/s.test(valor)) return valor.codePointAt(1)!;
    if (/^[+-]?\d+$/.test(valor)) return Number(valor);
    if (/^[+-]?(?:0x[\da-f]+|[\da-f]+h)$/i.test(valor)) {
      const signo = valor.startsWith('-') ? -1 : 1;
      return signo * parseInt(valor.replace(/^[+-]/, '').replace(/^0x/i, '').replace(/h$/i, ''), 16);
    }
    if (/^[01]+b$/i.test(valor)) return parseInt(valor.slice(0, -1), 2);
    throw new Error(`Símbolo desconocido o número no válido: ${texto}.`);
  }

  private littleEndian(valor: number, ancho: number): number[] {
    if (!Number.isSafeInteger(valor) || valor < -(2 ** (ancho * 8 - 1)) || valor >= 2 ** (ancho * 8)) {
      throw new Error(`El valor ${valor} no cabe en ${ancho * 8} bits.`);
    }
    const positivo = valor < 0 ? valor + 2 ** (ancho * 8) : valor;
    return Array.from({ length: ancho }, (_, i) => Math.floor(positivo / 2 ** (i * 8)) & 0xff);
  }

  private crearFila(segmento: 'DATOS' | 'CODIGO', direccion: number, byte: number | null, origen: string, reubicacion: boolean = false): FilaCodigoObjeto {
    return {
      segmento,
      direccion: this.agruparBits(direccion.toString(2).padStart(16, '0')),
      contenido: byte === null ? '????????' : this.agruparBits(byte.toString(2).padStart(8, '0')),
      hex: byte === null ? '--' : byte.toString(16).toUpperCase().padStart(2, '0'),
      origen,
      reubicacion
    };
  }

  private agruparBits(texto: string): string {
    return texto.match(/.{4}/g)!.join(' ');
  }

  private nombreEtiqueta(texto: string): string {
    return texto.trim().replace(/:$/, '').toLowerCase();
  }

  private resolverEtiqueta(texto: string): number {
    const valor = this.etiquetas.get(this.nombreEtiqueta(texto));
    if (valor === undefined) throw new Error(`Etiqueta desconocida: ${texto}.`);
    return valor;
  }

  private textoFila(fila: AsmRow): string {
    return [fila.etiqueta, fila.instruccion, fila.operandos].filter(Boolean).join(' ');
  }

  private esRegistro(nombre: string): boolean {
    return [...this.registros8, ...this.registros16, ...this.segmentos].includes(nombre);
  }

  private validarCantidad(operandos: string[], cantidad: number): void {
    if (operandos.length !== cantidad) throw new Error(`Se esperaban ${cantidad} operandos.`);
  }

  private validarAncho(ancho: number): void {
    if (ancho !== 1 && ancho !== 2) throw new Error('Las instrucciones 8086 requieren operandos de 8 o 16 bits.');
  }

  private validarSegmento(tamano: number): void {
    if (!Number.isSafeInteger(tamano) || tamano > 0x10000) throw new Error('El segmento excede los 65536 bytes.');
  }
}