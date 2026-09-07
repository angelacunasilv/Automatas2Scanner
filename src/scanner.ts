import { Token, TokenType, ScannerResult, ScannerStats } from './types';

// Palabras reservadas según la gramática
export const PALABRAS_RESERVADAS = new Set<string>([
  'INICIO',
  'FIN',
  'int',
  'boolean',
  'string',
  'print',
  'leer',
  'if',
  'while',
  'true',
  'false'
]);

// Delimitadores según la gramática
export const DELIMITADORES: Record<string, string> = {
  ';': 'Punto y coma (Fin de instrucción)',
  '(': 'Paréntesis de apertura',
  ')': 'Paréntesis de cierre',
  '{': 'Llave de apertura (Inicio de bloque)',
  '}': 'Llave de cierre (Fin de bloque)'
};

// Operadores según la gramática: @ | # | > | < | == | != | <= | >=
export const OPERADORES_DOBLES: Record<string, string> = {
  '==': 'Operador relacional de igualdad',
  '!=': 'Operador relacional de desigualdad',
  '<=': 'Operador relacional menor o igual',
  '>=': 'Operador relacional mayor o igual'
};

export const OPERADORES_SIMPLES: Record<string, string> = {
  '@': 'Operador especial (@)',
  '#': 'Operador especial (#)',
  '>': 'Operador relacional mayor que',
  '<': 'Operador relacional menor que'
};

export class Scanner {
  private source: string = '';
  private cursor: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  private tokenCount: number = 0;

  constructor() {}

  public scan(source: string): ScannerResult {
    const startTime = performance.now();
    this.source = source;
    this.cursor = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
    this.tokenCount = 0;

    while (!this.isAtEnd()) {
      this.scanToken();
    }

    const duracionMs = Math.round((performance.now() - startTime) * 100) / 100;
    const stats = this.computeStats();
    const errores = this.tokens.filter(t => t.tipo === 'ERROR_LEXICO');

    return {
      tokens: this.tokens,
      stats,
      errores,
      duracionMs
    };
  }

  private isAtEnd(): boolean {
    return this.cursor >= this.source.length;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.cursor];
  }

  private advance(): string {
    const char = this.source[this.cursor];
    this.cursor++;
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private isLetter(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\r' || char === '\t' || char === '\n';
  }

  private scanToken(): void {
    const startLine = this.line;
    const startCol = this.column;
    const char = this.advance();

    // 1. Espacios en blanco
    if (this.isWhitespace(char)) {
      return;
    }

    // 2. Comentarios de una sola línea (// ...)
    if (char === '/' && this.peek() === '/') {
      while (!this.isAtEnd() && this.peek() !== '\n') {
        this.advance();
      }
      return;
    }

    // 3. Delimitadores: ; ( ) { }
    if (char in DELIMITADORES) {
      this.addToken(
        'DELIMITADOR',
        char,
        startLine,
        startCol,
        DELIMITADORES[char]
      );
      return;
    }

    // 4. Asignación '=' o Operador '=='
    if (char === '=') {
      if (this.peek() === '=') {
        this.advance();
        this.addToken(
          'OPERADOR',
          '==',
          startLine,
          startCol,
          OPERADORES_DOBLES['==']
        );
      } else {
        this.addToken(
          'ASIGNACION',
          '=',
          startLine,
          startCol,
          'Operador de asignación'
        );
      }
      return;
    }

    // 5. Operador '!=' o Error con '!'
    if (char === '!') {
      if (this.peek() === '=') {
        this.advance();
        this.addToken(
          'OPERADOR',
          '!=',
          startLine,
          startCol,
          OPERADORES_DOBLES['!=']
        );
      } else {
        this.addToken(
          'ERROR_LEXICO',
          '!',
          startLine,
          startCol,
          'Carácter no reconocido "!" (se esperaba "!=")'
        );
      }
      return;
    }

    // 6. Operadores '<' o '<='
    if (char === '<') {
      if (this.peek() === '=') {
        this.advance();
        this.addToken(
          'OPERADOR',
          '<=',
          startLine,
          startCol,
          OPERADORES_DOBLES['<=']
        );
      } else {
        this.addToken(
          'OPERADOR',
          '<',
          startLine,
          startCol,
          OPERADORES_SIMPLES['<']
        );
      }
      return;
    }

    // 7. Operadores '>' o '>='
    if (char === '>') {
      if (this.peek() === '=') {
        this.advance();
        this.addToken(
          'OPERADOR',
          '>=',
          startLine,
          startCol,
          OPERADORES_DOBLES['>=']
        );
      } else {
        this.addToken(
          'OPERADOR',
          '>',
          startLine,
          startCol,
          OPERADORES_SIMPLES['>']
        );
      }
      return;
    }

    // 8. Operadores simples: @ | #
    if (char === '@' || char === '#') {
      this.addToken(
        'OPERADOR',
        char,
        startLine,
        startCol,
        OPERADORES_SIMPLES[char]
      );
      return;
    }

    // 9. Identificadores y Palabras Reservadas: LETRA [LETRA | DIGITO]*
    if (this.isLetter(char)) {
      let lexema = char;
      while (!this.isAtEnd() && (this.isLetter(this.peek()) || this.isDigit(this.peek()))) {
        lexema += this.advance();
      }

      if (PALABRAS_RESERVADAS.has(lexema)) {
        let desc = 'Palabra reservada del lenguaje';
        if (lexema === 'INICIO') desc = 'Inicio del programa';
        else if (lexema === 'FIN') desc = 'Fin del programa';
        else if (lexema === 'int' || lexema === 'boolean' || lexema === 'string') desc = `Tipo de dato primitivo (${lexema})`;
        else if (lexema === 'print') desc = 'Instrucción de salida (impresión)';
        else if (lexema === 'leer') desc = 'Instrucción de entrada (lectura)';
        else if (lexema === 'if') desc = 'Estructura condicional';
        else if (lexema === 'while') desc = 'Estructura de bucle/repetición';
        else if (lexema === 'true' || lexema === 'false') desc = `Literal booleano (${lexema})`;

        this.addToken('PALABRA_RESERVADA', lexema, startLine, startCol, desc);
      } else {
        this.addToken(
          'IDENTIFICADOR',
          lexema,
          startLine,
          startCol,
          `Identificador de variable: "${lexema}"`
        );
      }
      return;
    }

    // 10. Números: DIGITO [DIGITO]*
    if (this.isDigit(char)) {
      let lexema = char;
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        lexema += this.advance();
      }
      this.addToken(
        'NUMERO',
        lexema,
        startLine,
        startCol,
        `Constante numérica entera: ${lexema}`
      );
      return;
    }

    // 11. Cadenas: " [CARACTER]* " donde CARACTER = LETRA | DIGITO | " "
    if (char === '"') {
      let lexema = '"';
      let cerrado = false;

      while (!this.isAtEnd()) {
        const nextChar = this.peek();
        if (nextChar === '\n') {
          // Cadena no cerrada en la misma línea
          break;
        }
        if (nextChar === '"') {
          lexema += this.advance();
          cerrado = true;
          break;
        }

        const c = this.advance();
        lexema += c;
      }

      if (!cerrado) {
        this.addToken(
          'ERROR_LEXICO',
          lexema,
          startLine,
          startCol,
          'Cadena de texto sin cerrar (falta comilla doble de cierre ")'
        );
      } else {
        this.addToken(
          'CADENA',
          lexema,
          startLine,
          startCol,
          `Literal de cadena de texto: ${lexema}`
        );
      }
      return;
    }

    // 12. Caracter no reconocido (Error Léxico)
    this.addToken(
      'ERROR_LEXICO',
      char,
      startLine,
      startCol,
      `Símbolo no reconocido en el alfabeto: '${char}' (Código ASCII: ${char.charCodeAt(0)})`
    );
  }

  private addToken(
    tipo: TokenType,
    lexema: string,
    linea: number,
    columna: number,
    descripcion: string
  ): void {
    this.tokenCount++;
    this.tokens.push({
      id: this.tokenCount,
      tipo,
      lexema,
      linea,
      columna,
      descripcion
    });
  }

  private computeStats(): ScannerStats {
    const stats: ScannerStats = {
      total: this.tokens.length,
      palabrasReservadas: 0,
      identificadores: 0,
      numeros: 0,
      cadenas: 0,
      operadores: 0,
      asignaciones: 0,
      delimitadores: 0,
      errores: 0
    };

    for (const token of this.tokens) {
      switch (token.tipo) {
        case 'PALABRA_RESERVADA':
          stats.palabrasReservadas++;
          break;
        case 'IDENTIFICADOR':
          stats.identificadores++;
          break;
        case 'NUMERO':
          stats.numeros++;
          break;
        case 'CADENA':
          stats.cadenas++;
          break;
        case 'OPERADOR':
          stats.operadores++;
          break;
        case 'ASIGNACION':
          stats.asignaciones++;
          break;
        case 'DELIMITADOR':
          stats.delimitadores++;
          break;
        case 'ERROR_LEXICO':
          stats.errores++;
          break;
      }
    }

    return stats;
  }
}
