import { Token, ParseError } from './types';

export class SymbolTable {
  private symbols: Map<string, string>;

  constructor() {
    this.symbols = new Map<string, string>();
  }

  public set(name: string, type: string): void {
    this.symbols.set(name, type);
  }

  public get(name: string): string | undefined {
    return this.symbols.get(name);
  }

  public has(name: string): boolean {
    return this.symbols.has(name);
  }
}

export class SemanticAnalyzer {
  private symbolTable: SymbolTable;
  private errores: ParseError[];

  constructor(errores: ParseError[]) {
    this.symbolTable = new SymbolTable();
    this.errores = errores; // compartimos la misma referencia para los errores del parser
  }

  // 1. Variable ya declarada
  public declareVariable(name: string, type: string, token: Token): void {
    if (this.symbolTable.has(name)) {
      this.addError(`Variable ya declarada: '${name}'.`, token);
    } else {
      this.symbolTable.set(name, type);
    }
  }

  // 2. Variable no declarada
  public checkVariable(name: string, token: Token): string {
    if (!this.symbolTable.has(name)) {
      this.addError(`Variable no declarada: '${name}'.`, token);
      return 'unknown';
    }
    return this.symbolTable.get(name) || 'unknown';
  }

  // 3. Tipo incompatible
  public checkTypeMatch(expectedType: string, actualType: string, token: Token | undefined): void {
    if (expectedType === 'unknown' || actualType === 'unknown') {
      return; // Si es unknown (error previo) evitamos re-reportar tipo incompatible
    }
    if (expectedType !== actualType) {
      this.addError(`Tipo incompatible. Se esperaba '${expectedType}', se obtuvo '${actualType}'.`, token);
    }
  }

  public enabled: boolean = true;

  private addError(mensaje: string, token: Token | undefined): void {
    if (!this.enabled) return;
    if (token) {
      this.errores.push({
        mensaje,
        linea: token.linea,
        columna: token.columna,
        token
      });
    } else {
      this.errores.push({
        mensaje,
        linea: 1,
        columna: 1
      });
    }
  }
}
