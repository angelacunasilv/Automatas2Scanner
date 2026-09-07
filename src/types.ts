export type TokenType =
  | 'PALABRA_RESERVADA'
  | 'IDENTIFICADOR'
  | 'NUMERO'
  | 'CADENA'
  | 'OPERADOR'
  | 'ASIGNACION'
  | 'DELIMITADOR'
  | 'ERROR_LEXICO';

export interface Token {
  id: number;
  tipo: TokenType;
  subtipo?: string;
  lexema: string;
  linea: number;
  columna: number;
  descripcion: string;
}

export interface ScannerStats {
  total: number;
  palabrasReservadas: number;
  identificadores: number;
  numeros: number;
  cadenas: number;
  operadores: number;
  asignaciones: number;
  delimitadores: number;
  errores: number;
}

export interface ScannerResult {
  tokens: Token[];
  stats: ScannerStats;
  errores: Token[];
  duracionMs: number;
}


