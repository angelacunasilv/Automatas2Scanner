export class SymbolTable {
    symbols;
    constructor() {
        this.symbols = new Map();
    }
    set(name, type) {
        this.symbols.set(name, type);
    }
    get(name) {
        return this.symbols.get(name);
    }
    has(name) {
        return this.symbols.has(name);
    }
    getSymbols() {
        const obj = {};
        for (const [key, value] of this.symbols.entries()) {
            obj[key] = value;
        }
        return obj;
    }
}
export class SemanticAnalyzer {
    symbolTable;
    errores;
    constructor(errores) {
        this.symbolTable = new SymbolTable();
        this.errores = errores; // compartimos la misma referencia para los errores del parser
    }
    // 1. Variable ya declarada
    declareVariable(name, type, token) {
        if (this.symbolTable.has(name)) {
            this.addError(`Variable ya declarada: '${name}'.`, token);
        }
        else {
            this.symbolTable.set(name, type);
        }
    }
    // 2. Variable no declarada
    checkVariable(name, token) {
        if (!this.symbolTable.has(name)) {
            this.addError(`Variable no declarada: '${name}'.`, token);
            return 'unknown';
        }
        return this.symbolTable.get(name) || 'unknown';
    }
    // 3. Tipo incompatible
    checkTypeMatch(expectedType, actualType, token) {
        if (expectedType === 'unknown' || actualType === 'unknown') {
            return; // Si es unknown (error previo) evitamos re-reportar tipo incompatible
        }
        if (expectedType !== actualType) {
            this.addError(`Tipo incompatible. Se esperaba '${expectedType}', se obtuvo '${actualType}'.`, token);
        }
    }
    enabled = true;
    addError(mensaje, token) {
        if (!this.enabled)
            return;
        if (token) {
            this.errores.push({
                mensaje,
                linea: token.linea,
                columna: token.columna,
                token
            });
        }
        else {
            this.errores.push({
                mensaje,
                linea: 1,
                columna: 1
            });
        }
    }
    getSymbols() {
        return this.symbolTable.getSymbols();
    }
}
