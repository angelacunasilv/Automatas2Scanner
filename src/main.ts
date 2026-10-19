import './style.css';
import { Scanner } from './scanner';
import { Parser } from './parser';
import { ScannerResult, ParserResult } from './types';
import { EXAMPLES } from './examples';
import { IntermediateCodeGenerator } from './intermediateCodeGenerator';
import { TraduccionEnsamblador } from './traduccionEnsamblador';

// Instancias
const scanner = new Scanner();
const parser = new Parser();
const traductor = new TraduccionEnsamblador();
let codeGenerator: IntermediateCodeGenerator;

let lastResult: ScannerResult | null = null;
let lastParserResult: ParserResult | null = null;
let currentAsmCode: string = '';

// DOM Elements
const codeEditor = document.getElementById('codeEditor') as HTMLTextAreaElement;
const lineNumbers = document.getElementById('lineNumbers') as HTMLDivElement;
const btnTokens = document.getElementById('btnTokens') as HTMLButtonElement;
const btnParser = document.getElementById('btnParser') as HTMLButtonElement;
const btnSemantic = document.getElementById('btnSemantic') as HTMLButtonElement;
const btnIntermediate = document.getElementById('btnIntermediate') as HTMLButtonElement | null;
const btnShowIntermediate = document.getElementById('btnShowIntermediate') as HTMLButtonElement | null;
const btnEnsambladorTop = document.getElementById('btnEnsambladorTop') as HTMLButtonElement | null;
const btnEnsamblador = document.getElementById('btnEnsamblador') as HTMLButtonElement | null;
const btnCopyAsm = document.getElementById('btnCopyAsm') as HTMLButtonElement | null;
const btnClear = document.getElementById('btnClear') as HTMLButtonElement;
const exampleSelect = document.getElementById('exampleSelect') as HTMLSelectElement;

const dataTableContainer = document.getElementById('dataTableContainer') as HTMLDivElement | null;
const ensambladorContainer = document.getElementById('ensambladorContainer') as HTMLDivElement | null;
const asmTableBody = document.getElementById('asmTableBody') as HTMLTableSectionElement | null;

const tokensTableBody = document.getElementById('tokensTableBody') as HTMLTableSectionElement;
const errorBanner = document.getElementById('errorBanner') as HTMLDivElement;
const errorMessage = document.getElementById('errorMessage') as HTMLSpanElement;
const parserOutput = document.getElementById('parserOutput') as HTMLDivElement;

const grammarToggle = document.getElementById('grammarToggle') as HTMLElement;
const grammarContent = document.getElementById('grammarContent') as HTMLDivElement;

// Initialization
function initExamples(): void {
  exampleSelect.innerHTML = '<option value="" disabled selected>Cargar Ejemplo...</option>';
  EXAMPLES.forEach((example, index) => {
    const opt = document.createElement('option');
    opt.value = index.toString();
    opt.textContent = `${example.name} - ${example.description}`;
    exampleSelect.appendChild(opt);
  });

  // Load first example
  codeEditor.value = EXAMPLES[0].code;
  updateLineNumbers();
}

function updateLineNumbers(): void {
  const lines = codeEditor.value.split('\n');
  const lineCount = lines.length || 1;
  const numbersArray: string[] = [];
  for (let i = 1; i <= lineCount; i++) {
    numbersArray.push(`${i}`);
  }
  lineNumbers.innerHTML = numbersArray.join('<br>');
}

function syncScroll(): void {
  lineNumbers.scrollTop = codeEditor.scrollTop;
}

// Limpiar todas las tablas y paneles de salida
function limpiarEstado(): void {
  lastResult = null;
  lastParserResult = null;
  currentAsmCode = '';
  
  // Limpiar tokens
  renderTokensTable();
  errorBanner.style.display = 'none';
  
  // Limpiar parser
  parserOutput.innerHTML = 'Presiona el botón "Parser" para verificar la sintaxis.';
  parserOutput.style.color = 'black';
  
  // Limpiar código intermedio (tabla abajo a la izquierda)
  if (codeGenerator) {
    codeGenerator.clear();
  }
  if (dataTableContainer) dataTableContainer.style.display = 'block';
  if (ensambladorContainer) ensambladorContainer.style.display = 'none';
  if (asmTableBody) {
    asmTableBody.innerHTML = '<tr><td colspan="3" align="center">Presiona "Generar Ensamblador" para ver el código en 3 celdas.</td></tr>';
  }
}

// Action: Tokens
function runScannerOnly(): void {
  const code = codeEditor.value;
  lastResult = scanner.scan(code);

  // UI Updates for scanner only
  if (lastResult.stats.errores > 0) {
    errorBanner.style.display = 'block';
    errorMessage.innerHTML = `<strong>${lastResult.stats.errores} error(es) léxico(s) detectado(s).</strong>`;
  } else {
    errorBanner.style.display = 'none';
  }
  
  renderTokensTable();
  
  // Limpiar el parser hasta que lo presionen
  parserOutput.innerHTML = 'Presiona el botón "Parser" para verificar la sintaxis.';
  parserOutput.style.color = 'black';
  lastParserResult = null;
}

// Action: Parser
function runParserOnly(enableSemantic: boolean = false): void {
  if (!lastResult) {
    const code = codeEditor.value;
    lastResult = scanner.scan(code);
    renderTokensTable();
  }

  // Corremos el parser
  lastParserResult = parser.parse(lastResult.tokens, enableSemantic);

  if (codeGenerator) {
    codeGenerator.update(lastParserResult.exito, enableSemantic, lastParserResult.simbolos);
  }

  if (lastParserResult.exito) {
    parserOutput.innerHTML = `<strong style="color: green;">La compilación ${enableSemantic? 'semántica ' : 'sintáctica '}fue exitosa.</strong>\nNo se encontraron errores ${enableSemantic? 'sintácticos ni semánticos' : 'sintácticos'}.`;
    parserOutput.style.color = 'green';
  } else {
    let errorHtml = `<strong style="color: red;">Errores de compilación ${enableSemantic? '(Sintáctico + Semántico)' : '(Sintáctico)'}:</strong>\n\n`;
    lastParserResult.errores.forEach((err, index) => {
      errorHtml += `${index + 1}. Fila ${err.linea}: ${err.mensaje} ${err.token ? `(cerca de '${err.token.lexema}')` : ''}\n`;
    });
    parserOutput.innerHTML = errorHtml;
    parserOutput.style.color = 'red';
  }
}

// Action: Mostrar únicamente la Tabla de Código Intermedio (abajo a la izquierda)
function showIntermediateCodeOnly(): void {
  if (dataTableContainer) dataTableContainer.style.display = 'block';
  if (ensambladorContainer) ensambladorContainer.style.display = 'none';

  const code = codeEditor.value;
  const scanRes = scanner.scan(code);
  const parseRes = parser.parse(scanRes.tokens, true);

  if (codeGenerator) {
    if (parseRes.simbolos && Object.keys(parseRes.simbolos).length > 0) {
      codeGenerator.renderFromSymbols(parseRes.simbolos);
    } else if (parseRes.exito) {
      codeGenerator.renderFromSymbols({});
    } else {
      codeGenerator.showError('No se pudo generar código intermedio. Corrige los errores en el programa.');
    }
  }
}

// Action: Generar el Código Ensamblador en formato de 3 celdas (abajo a la izquierda)
function generarCodigoEnsamblador(): void {
  if (dataTableContainer) dataTableContainer.style.display = 'none';
  if (ensambladorContainer) ensambladorContainer.style.display = 'block';

  const code = codeEditor.value;
  const scanRes = scanner.scan(code);

  const filas = traductor.generarFilas(scanRes.tokens);
  currentAsmCode = traductor.generarCodigo(scanRes.tokens);

  if (asmTableBody) {
    if (filas.length === 0) {
      asmTableBody.innerHTML = '<tr><td colspan="3" align="center">No hay código para mostrar.</td></tr>';
      return;
    }

    const rowsHtml = filas.map(f => {
      const isHeaderOrSection = f.instruccion.startsWith('.') || f.instruccion === 'title';
      const bgColor = isHeaderOrSection ? 'bgcolor="#f7f7f7"' : '';
      return `
        <tr ${bgColor}>
          <td align="left"><code>${escapeHtml(f.etiqueta)}</code></td>
          <td align="left"><strong>${escapeHtml(f.instruccion)}</strong></td>
          <td align="left"><code>${escapeHtml(f.operandos)}</code></td>
        </tr>
      `;
    }).join('');

    asmTableBody.innerHTML = rowsHtml;
  }
}

// Action: Copiar Código Ensamblador al Portapapeles
function copiarCodigo(): void {
  let textoACopiar = currentAsmCode;
  if (!textoACopiar) {
    const code = codeEditor.value;
    const scanRes = scanner.scan(code);
    textoACopiar = traductor.generarCodigo(scanRes.tokens);
    currentAsmCode = textoACopiar;
  }

  if (!textoACopiar.trim()) return;

  const feedback = () => {
    if (btnCopyAsm) {
      const originalText = btnCopyAsm.textContent || 'Copiar';
      btnCopyAsm.textContent = '¡Copiado!';
      setTimeout(() => {
        if (btnCopyAsm) btnCopyAsm.textContent = originalText;
      }, 1500);
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textoACopiar).then(feedback).catch(() => {
      copiarFallback(textoACopiar, feedback);
    });
  } else {
    copiarFallback(textoACopiar, feedback);
  }
}

function copiarFallback(texto: string, callback: () => void): void {
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    callback();
  } catch (err) {
    console.error('Error al copiar al portapapeles', err);
  }
  document.body.removeChild(ta);
}

function renderTokensTable(): void {
  if (!lastResult || lastResult.tokens.length === 0) {
    tokensTableBody.innerHTML = `
      <tr>
        <td colspan="3" align="center">Tabla vacía.</td>
      </tr>
    `;
    return;
  }

  const rowsHtml = lastResult.tokens.map(token => {
    const escapedLexeme = escapeHtml(token.lexema);
    const isError = token.tipo === 'ERROR_LEXICO';
    
    return `
      <tr style="${isError ? 'background-color: #ffcccc;' : ''}">
        <td><strong>${token.tipo}</strong></td>
        <td><code>${escapedLexeme}</code></td>
        <td align="center">${token.linea}</td>
      </tr>
    `;
  }).join('');

  tokensTableBody.innerHTML = rowsHtml;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Setup Events
function setupEventListeners(): void {
  codeEditor.addEventListener('input', () => {
    updateLineNumbers();
  });

  codeEditor.addEventListener('scroll', syncScroll);

  codeEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = codeEditor.selectionStart;
      const end = codeEditor.selectionEnd;
      codeEditor.value = codeEditor.value.substring(0, start) + '    ' + codeEditor.value.substring(end);
      codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
      updateLineNumbers();
    }
  });

  btnTokens.addEventListener('click', runScannerOnly);
  btnParser.addEventListener('click', () => runParserOnly(false));
  btnSemantic.addEventListener('click', () => runParserOnly(true));

  if (btnIntermediate) {
    btnIntermediate.addEventListener('click', showIntermediateCodeOnly);
  }
  if (btnShowIntermediate) {
    btnShowIntermediate.addEventListener('click', showIntermediateCodeOnly);
  }

  if (btnEnsambladorTop) {
    btnEnsambladorTop.addEventListener('click', generarCodigoEnsamblador);
  }
  if (btnEnsamblador) {
    btnEnsamblador.addEventListener('click', generarCodigoEnsamblador);
  }
  if (btnCopyAsm) {
    btnCopyAsm.addEventListener('click', copiarCodigo);
  }

  btnClear.addEventListener('click', () => {
    codeEditor.value = '';
    updateLineNumbers();
    limpiarEstado();
  });

  exampleSelect.addEventListener('change', () => {
    const selectedIndex = parseInt(exampleSelect.value, 10);
    if (!isNaN(selectedIndex) && EXAMPLES[selectedIndex]) {
      codeEditor.value = EXAMPLES[selectedIndex].code;
      updateLineNumbers();
      limpiarEstado();
    }
  });

  grammarToggle.addEventListener('click', () => {
    const isHidden = grammarContent.style.display === 'none';
    grammarContent.style.display = isHidden ? 'block' : 'none';
    grammarToggle.innerHTML = isHidden ? '<b>[-] Ocultar Gramática</b>' : '<b>[+] Ver Gramática de Referencia</b>';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initExamples();
  setupEventListeners();
  codeGenerator = new IntermediateCodeGenerator();
});
