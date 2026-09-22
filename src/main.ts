import './style.css';
import { Scanner } from './scanner';
import { Parser } from './parser';
import { ScannerResult, ParserResult } from './types';
import { EXAMPLES } from './examples';

// Instancias
const scanner = new Scanner();
const parser = new Parser();

let lastResult: ScannerResult | null = null;
let lastParserResult: ParserResult | null = null;

// DOM Elements
const codeEditor = document.getElementById('codeEditor') as HTMLTextAreaElement;
const lineNumbers = document.getElementById('lineNumbers') as HTMLDivElement;
const btnTokens = document.getElementById('btnTokens') as HTMLButtonElement;
const btnParser = document.getElementById('btnParser') as HTMLButtonElement;
const btnSemantic = document.getElementById('btnSemantic') as HTMLButtonElement;
const btnClear = document.getElementById('btnClear') as HTMLButtonElement;
const exampleSelect = document.getElementById('exampleSelect') as HTMLSelectElement;

const lineColCount = document.getElementById('lineColCount') as HTMLSpanElement;
const scanDuration = document.getElementById('scanDuration') as HTMLSpanElement;
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
  const charCount = codeEditor.value.length;
  lineColCount.textContent = `Líneas: ${lineCount} | Caracteres: ${charCount}`;
}

function syncScroll(): void {
  lineNumbers.scrollTop = codeEditor.scrollTop;
}

// Action: Tokens
function runScannerOnly(): void {
  const code = codeEditor.value;
  lastResult = scanner.scan(code);
  scanDuration.textContent = `${lastResult.duracionMs} ms`;

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
    // Si no han corrido el scanner, lo corremos silenciosamente o forzamos
    const code = codeEditor.value;
    lastResult = scanner.scan(code);
    renderTokensTable();
  }

  // Corremos el parser
  lastParserResult = parser.parse(lastResult.tokens, enableSemantic);

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

  btnClear.addEventListener('click', () => {
    codeEditor.value = '';
    updateLineNumbers();
    lastResult = null;
    lastParserResult = null;
    renderTokensTable();
    parserOutput.innerHTML = 'Presiona el botón "Parser" para verificar la sintaxis.';
    parserOutput.style.color = 'black';
    errorBanner.style.display = 'none';
  });

  exampleSelect.addEventListener('change', () => {
    const selectedIndex = parseInt(exampleSelect.value, 10);
    if (!isNaN(selectedIndex) && EXAMPLES[selectedIndex]) {
      codeEditor.value = EXAMPLES[selectedIndex].code;
      updateLineNumbers();
      btnTokens.click(); // Automáticamente correr tokens al cargar
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
});