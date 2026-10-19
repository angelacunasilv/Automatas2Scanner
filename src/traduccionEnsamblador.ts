import { Token } from './types';

export interface VariableInfo {
  nombre: string;
  tipo: string;
  directiva: string;
  valorInicial: string;
}

export interface AsmRow {
  etiqueta: string;
  instruccion: string;
  operandos: string;
}

export class TraduccionEnsamblador {
  private tokens: Token[] = [];
  private current: number = 0;
  private variables: Map<string, VariableInfo> = new Map();
  private stringConstants: Map<string, string> = new Map();
  private rows: AsmRow[] = [];
  private labelCounter: number = 0;
  private stringCounter: number = 0;
  private usesPrintNum: boolean = false;
  private usesPrintNl: boolean = false;

  constructor() {}

  /**
   * Genera el código ensamblador estructurado en 3 celdas (Etiqueta, Instrucción, Operandos).
   */
  public generarFilas(tokens: Token[]): AsmRow[] {
    this.tokens = tokens.filter(t => t.tipo !== 'ERROR_LEXICO');
    this.current = 0;
    this.variables.clear();
    this.stringConstants.clear();
    this.rows = [];
    this.labelCounter = 0;
    this.stringCounter = 0;
    this.usesPrintNum = false;
    this.usesPrintNl = false;

    if (this.tokens.length === 0) {
      return [];
    }

    try {
      this.programa();
    } catch {
      // Ignorar errores parciales
    }

    return this.construirFilasCompletas();
  }

  /**
   * Genera el código ensamblador en texto puro para compilar en TASM/MASM o copiar.
   */
  public generarCodigo(tokens: Token[]): string {
    const filas = this.generarFilas(tokens);
    if (filas.length === 0) return '';

    return filas.map(f => {
      if (f.etiqueta && !f.instruccion && !f.operandos) {
        return `${f.etiqueta}`;
      }
      const eti = f.etiqueta ? `${f.etiqueta.padEnd(12)}` : '            ';
      const inst = f.instruccion ? `${f.instruccion.padEnd(8)}` : '        ';
      const op = f.operandos || '';
      return `${eti}${inst}${op}`.trimEnd();
    }).join('\n');
  }

  private addRow(etiqueta: string, instruccion: string, operandos: string): void {
    this.rows.push({ etiqueta, instruccion, operandos });
  }

  // 1. PROGRAMA → INICIO LISTA_DECL FIN
  private programa(): void {
    if (this.match('PALABRA_RESERVADA', 'INICIO')) {
      this.addRow('inicio:', '', '');
      this.listaDecl();
      this.match('PALABRA_RESERVADA', 'FIN');
    } else {
      this.addRow('inicio:', '', '');
      this.listaDecl();
    }
  }

  // 2. LISTA_DECL → [ INSTRUCCION ]*
  private listaDecl(): void {
    while (!this.isAtEnd() && !this.check('PALABRA_RESERVADA', 'FIN') && !this.check('DELIMITADOR', '}')) {
      this.instruccion();
    }
  }

  // 3. INSTRUCCION
  private instruccion(): void {
    const tipoToken = this.matchTipoDato();
    if (tipoToken) {
      if (this.match('IDENTIFICADOR')) {
        const idToken = this.previous();
        const varName = idToken.lexema;
        const tipo = tipoToken.lexema;

        if (this.match('ASIGNACION', '=')) {
          if (tipo === 'string') {
            const strVal = this.obtenerValorOperando();
            this.registrarVariable(varName, tipo, strVal);
            this.match('DELIMITADOR', ';');
          } else {
            this.registrarVariable(varName, tipo);
            this.generarAsignacion(varName);
            this.match('DELIMITADOR', ';');
          }
        } else {
          this.registrarVariable(varName, tipo);
          this.match('DELIMITADOR', ';');
        }
      }
    } else if (this.match('IDENTIFICADOR')) {
      const idToken = this.previous();
      const varName = idToken.lexema;
      if (!this.variables.has(varName)) {
        this.registrarVariable(varName, 'int');
      }

      if (this.match('ASIGNACION', '=')) {
        this.generarAsignacion(varName);
        this.match('DELIMITADOR', ';');
      }
    } else if (this.match('PALABRA_RESERVADA', 'print')) {
      if (this.match('DELIMITADOR', '(')) {
        this.generarPrint();
        this.match('DELIMITADOR', ')');
        this.match('DELIMITADOR', ';');
      }
    } else if (this.match('PALABRA_RESERVADA', 'leer')) {
      if (this.match('DELIMITADOR', '(')) {
        if (this.match('IDENTIFICADOR')) {
          const varName = this.previous().lexema;
          if (!this.variables.has(varName)) {
            this.registrarVariable(varName, 'int');
          }
          this.generarLeer(varName);
        }
        this.match('DELIMITADOR', ')');
        this.match('DELIMITADOR', ';');
      }
    } else if (this.match('PALABRA_RESERVADA', 'if')) {
      this.generarIf();
    } else if (this.match('PALABRA_RESERVADA', 'while')) {
      this.generarWhile();
    } else {
      this.advance();
    }
  }

  // Manejo de asignaciones
  private generarAsignacion(targetVar: string): void {
    const val1 = this.obtenerValorOperando();
    if (this.match('OPERADOR')) {
      const opToken = this.previous();
      const val2 = this.obtenerValorOperando();

      this.addRow('', 'mov', `ax, ${val1}`);
      if (opToken.lexema === '@') {
        this.addRow('', 'add', `ax, ${val2}`);
      } else if (opToken.lexema === '#') {
        this.addRow('', 'sub', `ax, ${val2}`);
      } else if (opToken.lexema === '*') {
        this.addRow('', 'mov', `bx, ${val2}`);
        this.addRow('', 'imul', 'bx');
      } else {
        this.addRow('', 'add', `ax, ${val2}`);
      }
      this.addRow('', 'mov', `${targetVar}, ax`);
    } else {
      const esTargetString = this.variables.has(targetVar) && this.variables.get(targetVar)!.tipo === 'string';
      if (esTargetString) {
        if (val1.startsWith('"')) {
          const limpio = val1.replace(/^"|"$/g, '');
          this.variables.get(targetVar)!.valorInicial = `"${limpio}", '$'`;
        }
      } else {
        this.addRow('', 'mov', `ax, ${val1}`);
        this.addRow('', 'mov', `${targetVar}, ax`);
      }
    }
  }

  // Manejo de condicional IF
  private generarIf(): void {
    if (!this.match('DELIMITADOR', '(')) return;
    const cond = this.obtenerCondicion();
    this.match('DELIMITADOR', ')');

    const endIfLabel = this.crearEtiqueta('endif');

    this.addRow('', 'mov', `ax, ${cond.val1}`);
    this.addRow('', 'cmp', `ax, ${cond.val2}`);
    this.addRow('', this.obtenerSaltoOpuesto(cond.op), endIfLabel);

    if (this.match('DELIMITADOR', '{')) {
      this.listaDecl();
      this.match('DELIMITADOR', '}');
    }

    this.addRow(`${endIfLabel}:`, '', '');
  }

  // Manejo de bucle WHILE
  private generarWhile(): void {
    if (!this.match('DELIMITADOR', '(')) return;
    const startWhileLabel = this.crearEtiqueta('while');
    const endWhileLabel = this.crearEtiqueta('endwhile');

    this.addRow(`${startWhileLabel}:`, '', '');
    const cond = this.obtenerCondicion();
    this.match('DELIMITADOR', ')');

    this.addRow('', 'mov', `ax, ${cond.val1}`);
    this.addRow('', 'cmp', `ax, ${cond.val2}`);
    this.addRow('', this.obtenerSaltoOpuesto(cond.op), endWhileLabel);

    if (this.match('DELIMITADOR', '{')) {
      this.listaDecl();
      this.match('DELIMITADOR', '}');
    }

    this.addRow('', 'jmp', startWhileLabel);
    this.addRow(`${endWhileLabel}:`, '', '');
  }

  // Manejo de PRINT
  private generarPrint(): void {
    const val = this.obtenerValorOperando();
    const esVariableString = this.variables.has(val) && this.variables.get(val)!.tipo === 'string';

    if (val.startsWith('"')) {
      const strLabel = this.registrarConstanteCadena(val);
      this.addRow('', 'lea', `dx, ${strLabel}`);
      this.addRow('', 'mov', 'ah, 09h');
      this.addRow('', 'int', '21h');
      this.addRow('', 'call', 'print_nl');
      this.usesPrintNl = true;
    } else if (esVariableString) {
      this.addRow('', 'lea', `dx, ${val}`);
      this.addRow('', 'mov', 'ah, 09h');
      this.addRow('', 'int', '21h');
      this.addRow('', 'call', 'print_nl');
      this.usesPrintNl = true;
    } else {
      this.addRow('', 'mov', `ax, ${val}`);
      this.addRow('', 'call', 'print_num');
      this.addRow('', 'call', 'print_nl');
      this.usesPrintNum = true;
      this.usesPrintNl = true;
    }
  }

  // Manejo de LEER
  private generarLeer(varName: string): void {
    this.addRow('', 'mov', 'ah, 01h');
    this.addRow('', 'int', '21h');
    this.addRow('', 'sub', "al, '0'");
    this.addRow('', 'mov', 'ah, 0');
    this.addRow('', 'mov', `${varName}, ax`);
    this.addRow('', 'call', 'print_nl');
    this.usesPrintNl = true;
  }

  private obtenerValorOperando(): string {
    if (this.match('NUMERO')) {
      return this.previous().lexema;
    }
    if (this.match('CADENA')) {
      return this.previous().lexema;
    }
    if (this.match('IDENTIFICADOR')) {
      const name = this.previous().lexema;
      if (!this.variables.has(name)) {
        this.registrarVariable(name, 'int');
      }
      return name;
    }
    if (this.match('PALABRA_RESERVADA', 'true')) {
      return '1';
    }
    if (this.match('PALABRA_RESERVADA', 'false')) {
      return '0';
    }
    return '0';
  }

  private obtenerCondicion(): { val1: string; op: string; val2: string } {
    const val1 = this.obtenerValorOperando();
    if (this.match('OPERADOR')) {
      const op = this.previous().lexema;
      const val2 = this.obtenerValorOperando();
      return { val1, op, val2 };
    }
    return { val1, op: '==', val2: '1' };
  }

  private obtenerSaltoOpuesto(op: string): string {
    switch (op) {
      case '==': return 'jne';
      case '!=': return 'je';
      case '>':  return 'jle';
      case '<':  return 'jge';
      case '>=': return 'jl';
      case '<=': return 'jg';
      default:   return 'jne';
    }
  }

  private registrarVariable(nombre: string, tipo: string, valorInicial?: string): void {
    if (this.variables.has(nombre)) {
      if (valorInicial && this.variables.get(nombre)!.valorInicial === '?') {
        if (tipo === 'string') {
          const limpio = valorInicial.replace(/^"|"$/g, '');
          this.variables.get(nombre)!.valorInicial = `"${limpio}", '$'`;
        } else {
          this.variables.get(nombre)!.valorInicial = valorInicial;
        }
      }
      return;
    }

    let directiva = 'dw';
    let valInit = '?';

    if (tipo === 'int') {
      directiva = 'dw';
      valInit = valorInicial ?? '?';
    } else if (tipo === 'boolean') {
      directiva = 'dw';
      valInit = valorInicial === 'true' ? '1' : valorInicial === 'false' ? '0' : (valorInicial ?? '?');
    } else if (tipo === 'string') {
      directiva = 'db';
      if (valorInicial && valorInicial.startsWith('"')) {
        const limpio = valorInicial.replace(/^"|"$/g, '');
        valInit = `"${limpio}", '$'`;
      } else {
        valInit = "50 dup('$')";
      }
    }

    this.variables.set(nombre, {
      nombre,
      tipo,
      directiva,
      valorInicial: valInit
    });
  }

  private registrarConstanteCadena(cadena: string): string {
    for (const [label, val] of this.stringConstants.entries()) {
      if (val === cadena) return label;
    }
    const label = `msg_${this.stringCounter++}`;
    this.stringConstants.set(label, cadena);
    return label;
  }

  private crearEtiqueta(prefix: string): string {
    return `${prefix}${++this.labelCounter}`;
  }

  private matchTipoDato(): Token | null {
    if (this.isAtEnd()) return null;
    const t = this.peek();
    if (t.tipo === 'PALABRA_RESERVADA' && ['int', 'boolean', 'string'].includes(t.lexema)) {
      this.advance();
      return t;
    }
    return null;
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length;
  }

  private peek(): Token {
    return this.tokens[this.current] || this.tokens[this.tokens.length - 1];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private check(tipo: string, lexema?: string): boolean {
    if (this.isAtEnd()) return false;
    const t = this.peek();
    if (t.tipo !== tipo) return false;
    if (lexema !== undefined && t.lexema !== lexema) return false;
    return true;
  }

  private match(tipo: string, lexema?: string): boolean {
    if (this.check(tipo, lexema)) {
      this.advance();
      return true;
    }
    return false;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  // Construye la lista de filas con formato de 3 celdas (Etiqueta, Instrucción, Operandos)
  private construirFilasCompletas(): AsmRow[] {
    const res: AsmRow[] = [];

    res.push({ etiqueta: '', instruccion: 'title', operandos: 'programa' });
    res.push({ etiqueta: '', instruccion: '.model', operandos: 'small' });
    res.push({ etiqueta: '', instruccion: '.stack', operandos: '100h' });
    res.push({ etiqueta: '', instruccion: '.data', operandos: '' });

    if (this.variables.size > 0 || this.stringConstants.size > 0) {
      for (const v of this.variables.values()) {
        res.push({
          etiqueta: v.nombre,
          instruccion: v.directiva,
          operandos: v.valorInicial
        });
      }
      for (const [lbl, strVal] of this.stringConstants.entries()) {
        const limpio = strVal.replace(/^"|"$/g, '');
        res.push({
          etiqueta: lbl,
          instruccion: 'db',
          operandos: `"${limpio}", '$'`
        });
      }
    }

    res.push({ etiqueta: '', instruccion: '.code', operandos: '' });
    res.push({ etiqueta: 'main', instruccion: 'proc', operandos: '' });
    res.push({ etiqueta: '', instruccion: 'mov', operandos: 'ax, @data' });
    res.push({ etiqueta: '', instruccion: 'mov', operandos: 'ds, ax' });

    if (this.rows.length > 0) {
      res.push(...this.rows);
    }

    res.push({ etiqueta: '', instruccion: 'mov', operandos: 'ax, 4c00h' });
    res.push({ etiqueta: '', instruccion: 'int', operandos: '21h' });
    res.push({ etiqueta: 'main', instruccion: 'endp', operandos: '' });

    if (this.usesPrintNum) {
      res.push({ etiqueta: 'print_num', instruccion: 'proc', operandos: '' });
      res.push({ etiqueta: '', instruccion: 'push', operandos: 'ax' });
      res.push({ etiqueta: '', instruccion: 'push', operandos: 'bx' });
      res.push({ etiqueta: '', instruccion: 'push', operandos: 'cx' });
      res.push({ etiqueta: '', instruccion: 'push', operandos: 'dx' });
      res.push({ etiqueta: '', instruccion: 'mov', operandos: 'cx, 0' });
      res.push({ etiqueta: '', instruccion: 'mov', operandos: 'bx, 10' });
      res.push({ etiqueta: 'l_div:', instruccion: 'mov', operandos: 'dx, 0' });
      res.push({ etiqueta: '', instruccion: 'div', operandos: 'bx' });
      res.push({ etiqueta: '', instruccion: 'push', operandos: 'dx' });
      res.push({ etiqueta: '', instruccion: 'inc', operandos: 'cx' });
      res.push({ etiqueta: '', instruccion: 'cmp', operandos: 'ax, 0' });
      res.push({ etiqueta: '', instruccion: 'jne', operandos: 'l_div' });
      res.push({ etiqueta: 'l_print:', instruccion: 'pop', operandos: 'dx' });
      res.push({ etiqueta: '', instruccion: 'add', operandos: "dl, '0'" });
      res.push({ etiqueta: '', instruccion: 'mov', operandos: 'ah, 02h' });
      res.push({ etiqueta: '', instruccion: 'int', operandos: '21h' });
      res.push({ etiqueta: '', instruccion: 'loop', operandos: 'l_print' });
      res.push({ etiqueta: '', instruccion: 'pop', operandos: 'dx' });
      res.push({ etiqueta: '', instruccion: 'pop', operandos: 'cx' });
      res.push({ etiqueta: '', instruccion: 'pop', operandos: 'bx' });
      res.push({ etiqueta: '', instruccion: 'pop', operandos: 'ax' });
      res.push({ etiqueta: '', instruccion: 'ret', operandos: '' });
      res.push({ etiqueta: 'print_num', instruccion: 'endp', operandos: '' });
    }

    if (this.usesPrintNl) {
      res.push({ etiqueta: 'print_nl', instruccion: 'proc', operandos: '' });
      res.push({ etiqueta: '', instruccion: 'push', operandos: 'ax' });
      res.push({ etiqueta: '', instruccion: 'push', operandos: 'dx' });
      res.push({ etiqueta: '', instruccion: 'mov', operandos: 'dl, 13' });
      res.push({ etiqueta: '', instruccion: 'mov', operandos: 'ah, 02h' });
      res.push({ etiqueta: '', instruccion: 'int', operandos: '21h' });
      res.push({ etiqueta: '', instruccion: 'mov', operandos: 'dl, 10' });
      res.push({ etiqueta: '', instruccion: 'mov', operandos: 'ah, 02h' });
      res.push({ etiqueta: '', instruccion: 'int', operandos: '21h' });
      res.push({ etiqueta: '', instruccion: 'pop', operandos: 'dx' });
      res.push({ etiqueta: '', instruccion: 'pop', operandos: 'ax' });
      res.push({ etiqueta: '', instruccion: 'ret', operandos: '' });
      res.push({ etiqueta: 'print_nl', instruccion: 'endp', operandos: '' });
    }

    res.push({ etiqueta: '', instruccion: 'end', operandos: 'main' });
    return res;
  }
}
