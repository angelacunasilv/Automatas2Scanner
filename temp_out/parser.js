import { SemanticAnalyzer } from './semantic';
export class Parser {
    tokens = [];
    current = 0;
    errores = [];
    semantic;
    constructor() { }
    parse(tokens, enableSemantic = false) {
        // Filtrar errores léxicos para no confundir al parser
        this.tokens = tokens.filter(t => t.tipo !== 'ERROR_LEXICO');
        this.current = 0;
        this.errores = [];
        this.semantic = new SemanticAnalyzer(this.errores);
        this.semantic.enabled = enableSemantic;
        if (this.tokens.length === 0) {
            return { errores: [], exito: true };
        }
        this.programa();
        return {
            errores: this.errores,
            exito: this.errores.length === 0,
            simbolos: this.semantic.getSymbols()
        };
    }
    // 1. PROGRAMA → INICIO LISTA_DECL FIN
    programa() {
        if (this.match('PALABRA_RESERVADA', 'INICIO')) {
            this.listaDecl();
            if (!this.match('PALABRA_RESERVADA', 'FIN')) {
                this.addError('Se esperaba la palabra reservada "FIN" al final del programa.');
            }
        }
        else {
            this.addError('El programa debe comenzar con la palabra reservada "INICIO".');
            // Intentamos continuar de todos modos para encontrar más errores
            this.listaDecl();
        }
    }
    // 2. LISTA_DECL → [ INSTRUCCION ]*
    listaDecl() {
        while (!this.isAtEnd() && !this.check('PALABRA_RESERVADA', 'FIN') && !this.check('DELIMITADOR', '}')) {
            this.instruccion();
            if (this.errores.length > 100)
                break; // Evitar ciclos infinitos o demasiados errores
        }
    }
    // 3. INSTRUCCION
    instruccion() {
        const tipoToken = this.matchTipoDato();
        if (tipoToken) {
            // TIPO IDENTIFICADOR = EXPRESION ;
            if (this.match('IDENTIFICADOR')) {
                const idToken = this.previous();
                if (this.match('ASIGNACION', '=')) {
                    const expType = this.expresion();
                    this.semantic.declareVariable(idToken.lexema, tipoToken.lexema, idToken);
                    this.semantic.checkTypeMatch(tipoToken.lexema, expType, idToken);
                    this.consumeDelimiter(';', 'Se esperaba ";" al final de la declaración.');
                }
                else {
                    this.addError('Se esperaba "=" después del identificador.');
                    this.synchronize();
                }
            }
            else {
                this.addError('Se esperaba un identificador después del tipo.');
                this.synchronize();
            }
        }
        else if (this.match('IDENTIFICADOR')) {
            // IDENTIFICADOR = EXPRESION ;
            const idToken = this.previous();
            if (this.match('ASIGNACION', '=')) {
                const expType = this.expresion();
                const expectedType = this.semantic.checkVariable(idToken.lexema, idToken);
                this.semantic.checkTypeMatch(expectedType, expType, idToken);
                this.consumeDelimiter(';', 'Se esperaba ";" después de la expresión.');
            }
            else {
                this.addError('Se esperaba "=" para la asignación.');
                this.synchronize();
            }
        }
        else if (this.match('PALABRA_RESERVADA', 'print')) {
            // print ( VALOR ) ;
            if (this.match('DELIMITADOR', '(')) {
                this.valor();
                if (this.match('DELIMITADOR', ')')) {
                    this.consumeDelimiter(';', 'Se esperaba ";" al final de print.');
                }
                else {
                    this.addError('Se esperaba ")" después del valor en print.');
                    this.synchronize();
                }
            }
            else {
                this.addError('Se esperaba "(" después de "print".');
                this.synchronize();
            }
        }
        else if (this.match('PALABRA_RESERVADA', 'leer')) {
            // leer ( IDENTIFICADOR ) ;
            if (this.match('DELIMITADOR', '(')) {
                if (this.match('IDENTIFICADOR')) {
                    const idToken = this.previous();
                    this.semantic.checkVariable(idToken.lexema, idToken);
                    if (this.match('DELIMITADOR', ')')) {
                        this.consumeDelimiter(';', 'Se esperaba ";" al final de leer.');
                    }
                    else {
                        this.addError('Se esperaba ")" después del identificador en leer.');
                        this.synchronize();
                    }
                }
                else {
                    this.addError('Se esperaba un identificador dentro de "leer".');
                    this.synchronize();
                }
            }
            else {
                this.addError('Se esperaba "(" después de "leer".');
                this.synchronize();
            }
        }
        else if (this.match('PALABRA_RESERVADA', 'if')) {
            // if ( CONDICION ) { LISTA_DECL }
            if (this.match('DELIMITADOR', '(')) {
                this.condicion();
                if (this.match('DELIMITADOR', ')')) {
                    if (this.match('DELIMITADOR', '{')) {
                        this.listaDecl();
                        if (!this.match('DELIMITADOR', '}')) {
                            this.addError('Se esperaba "}" al final del bloque if.');
                        }
                    }
                    else {
                        this.addError('Se esperaba "{" para iniciar el bloque if.');
                        this.synchronize();
                    }
                }
                else {
                    this.addError('Se esperaba ")" después de la condición.');
                    this.synchronize();
                }
            }
            else {
                this.addError('Se esperaba "(" después de "if".');
                this.synchronize();
            }
        }
        else if (this.match('PALABRA_RESERVADA', 'while')) {
            // while ( CONDICION ) { LISTA_DECL }
            if (this.match('DELIMITADOR', '(')) {
                this.condicion();
                if (this.match('DELIMITADOR', ')')) {
                    if (this.match('DELIMITADOR', '{')) {
                        this.listaDecl();
                        if (!this.match('DELIMITADOR', '}')) {
                            this.addError('Se esperaba "}" al final del bloque while.');
                        }
                    }
                    else {
                        this.addError('Se esperaba "{" para iniciar el bloque while.');
                        this.synchronize();
                    }
                }
                else {
                    this.addError('Se esperaba ")" después de la condición.');
                    this.synchronize();
                }
            }
            else {
                this.addError('Se esperaba "(" después de "while".');
                this.synchronize();
            }
        }
        else {
            // Statement no reconocido
            const t = this.peek();
            this.addError(`Instrucción no reconocida comenzando con '${t.lexema}'.`);
            this.advance();
            this.synchronize();
        }
    }
    // 4. TIPO → int | boolean | string
    matchTipoDato() {
        if (this.isAtEnd())
            return null;
        const t = this.peek();
        if (t.tipo === 'PALABRA_RESERVADA' && (t.lexema === 'int' || t.lexema === 'boolean' || t.lexema === 'string')) {
            this.advance();
            return t;
        }
        return null;
    }
    // 5. CONDICION → EXPRESION OPERADOR_RELACIONAL EXPRESION | EXPRESION_BOOLEANA
    condicion() {
        const t1 = this.expresion();
        const opToken = this.matchOperadorRelacional();
        if (opToken) {
            const t2 = this.expresion();
            this.semantic.checkTypeMatch(t1, t2, opToken);
            return 'boolean';
        }
        else {
            if (t1 !== 'boolean' && t1 !== 'unknown') {
                this.addError('Se esperaba un operador relacional en la condición.');
            }
            return 'boolean';
        }
    }
    // 6. EXPRESION → VALOR | VALOR OPERADOR_ARITMETICO VALOR
    expresion() {
        const t1 = this.valor();
        // Opcional operador aritmético y otro valor
        if (this.matchOperadorAritmetico()) {
            this.valor();
        }
        return t1;
    }
    matchOperadorAritmetico() {
        if (this.isAtEnd())
            return null;
        const t = this.peek();
        if (t.tipo === 'OPERADOR' && (t.lexema === '@' || t.lexema === '#' || t.lexema === '+' || t.lexema === '-' || t.lexema === '*' || t.lexema === '/')) {
            this.advance();
            return t;
        }
        return null;
    }
    matchOperadorRelacional() {
        if (this.isAtEnd())
            return null;
        const t = this.peek();
        if (t.tipo === 'OPERADOR' && ['==', '!=', '<', '>', '<=', '>='].includes(t.lexema)) {
            this.advance();
            return t;
        }
        return null;
    }
    // 7. VALOR → NUMERO | CADENA | true | false | IDENTIFICADOR
    valor() {
        if (this.match('NUMERO'))
            return 'int';
        if (this.match('CADENA'))
            return 'string';
        if (this.match('IDENTIFICADOR')) {
            const idToken = this.previous();
            return this.semantic.checkVariable(idToken.lexema, idToken);
        }
        if (this.match('PALABRA_RESERVADA', 'true') || this.match('PALABRA_RESERVADA', 'false')) {
            return 'boolean';
        }
        this.addError('Se esperaba un valor (Número, Cadena, true, false o Identificador).');
        return 'unknown';
    }
    // Helper functions
    advance() {
        if (!this.isAtEnd())
            this.current++;
        return this.previous();
    }
    isAtEnd() {
        return this.current >= this.tokens.length;
    }
    peek() {
        return this.tokens[this.current] || this.tokens[this.tokens.length - 1]; // si estamos al final, devolver el último para linea/columna
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    check(tipo, lexema) {
        if (this.isAtEnd())
            return false;
        const t = this.peek();
        if (t.tipo !== tipo)
            return false;
        if (lexema !== undefined && t.lexema !== lexema)
            return false;
        return true;
    }
    match(tipo, lexema) {
        if (this.check(tipo, lexema)) {
            this.advance();
            return true;
        }
        return false;
    }
    consumeDelimiter(lexema, errorMsg) {
        if (this.match('DELIMITADOR', lexema)) {
            return;
        }
        this.addError(errorMsg);
    }
    addError(mensaje) {
        const t = this.peek() || this.previous();
        if (t) {
            this.errores.push({
                mensaje,
                linea: t.linea,
                columna: t.columna,
                token: t
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
    // Sincronización para recuperación de errores simples (panic mode)
    synchronize() {
        this.advance();
        while (!this.isAtEnd()) {
            if (this.previous().tipo === 'DELIMITADOR' && this.previous().lexema === ';')
                return;
            const t = this.peek();
            if (t.tipo === 'PALABRA_RESERVADA') {
                if (['INICIO', 'FIN', 'int', 'boolean', 'string', 'print', 'leer', 'if', 'while'].includes(t.lexema)) {
                    return;
                }
            }
            this.advance();
        }
    }
}
