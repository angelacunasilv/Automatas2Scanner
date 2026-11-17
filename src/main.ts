import './style.css';
import { Scanner } from './scanner';
import { Parser } from './parser';
import { ScannerResult, ParserResult } from './types';
import { EXAMPLES } from './examples';
import { IntermediateCodeGenerator, X86MachineCodeGenerator } from './intermediateCodeGenerator';
import { TraduccionEnsamblador, AsmRow } from './traduccionEnsamblador';
import { CodigoObjeto } from './codigoObjeto';

// Instancias
const scanner = new Scanner();
const parser = new Parser();
const traductor = new TraduccionEnsamblador();
const codigoObjeto = new CodigoObjeto();
let codeGenerator: IntermediateCodeGenerator;
let machineCodeGenerator: X86MachineCodeGenerator;

let lastResult: ScannerResult | null = null;
let lastParserResult: ParserResult | null = null;
let currentAsmCode: string = '';
let currentAsmRows: AsmRow[] = [];
let currentObjectCode: string = '';

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
const btnMachineCode = document.getElementById('btnMachineCode') as HTMLButtonElement | null;
const btnActualizarBinario = document.getElementById('btnActualizarBinario') as HTMLButtonElement | null;
const btnCopyAsm = document.getElementById('btnCopyAsm') as HTMLButtonElement | null;
const btnCodigoObjeto = document.getElementById('btnCodigoObjeto') as HTMLButtonElement;
const btnCopyObjeto = document.getElementById('btnCopyObjeto') as HTMLButtonElement;
const btnClear = document.getElementById('btnClear') as HTMLButtonElement;
const exampleSelect = document.getElementById('exampleSelect') as HTMLSelectElement;

const intermediateTitle = document.getElementById('intermediateTitle') as HTMLElement | null;
const dataTableContainer = document.getElementById('dataTableContainer') as HTMLDivElement | null;
const ensambladorContainer = document.getElementById('ensambladorContainer') as HTMLDivElement | null;
const asmTableBody = document.getElementById('asmTableBody') as HTMLTableSectionElement | null;

const tokensTableBody = document.getElementById('tokensTableBody') as HTMLTableSectionElement;
const errorBanner = document.getElementById('errorBanner') as HTMLDivElement;
const errorMessage = document.getElementById('errorMessage') as HTMLSpanElement;
const parserOutput = document.getElementById('parserOutput') as HTMLDivElement;
const errorOutput = document.getElementById('errorOutput') as HTMLDivElement;
const codigoObjetoTableBody = document.getElementById('codigoObjetoTableBody') as HTMLTableSectionElement;
const objetoNota = document.getElementById('objetoNota') as HTMLParagraphElement;

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
  currentAsmRows = [];
  currentObjectCode = '';
  
  // Limpiar tokens
  renderTokensTable();
  errorBanner.style.display = 'none';
  errorOutput.textContent = '';
  objetoNota.hidden = true;
  codigoObjetoTableBody.innerHTML = '<tr><td class="empty" colspan="4">Presiona «Código objeto» para generar los bytes del programa.</td></tr>';
  
  // Limpiar parser
  parserOutput.innerHTML = 'Presiona el botón "Parser" para verificar la sintaxis.';
  parserOutput.style.color = '';
  
  // Limpiar código intermedio (tabla en Bloque 1)
  if (codeGenerator) {
    codeGenerator.clear();
  }
  if (intermediateTitle) intermediateTitle.textContent = 'Código intermedio';
  if (dataTableContainer) dataTableContainer.style.display = 'none';
  if (ensambladorContainer) ensambladorContainer.style.display = 'block';
  if (asmTableBody) {
    asmTableBody.innerHTML = '<tr><td class="empty" colspan="3">Presiona «Código intermedio» para generar el ensamblador.</td></tr>';
  }
  if (machineCodeGenerator) machineCodeGenerator.clear();
}

// Action: Tokens
function runScannerOnly(): void {
  limpiarEstado();
  const code = codeEditor.value;
  lastResult = scanner.scan(code);

  // UI Updates for scanner only
  if (lastResult.stats.errores > 0) {
    errorBanner.style.display = 'block';
    errorMessage.textContent = `${lastResult.stats.errores} error(es) léxico(s) detectado(s).`;
    errorOutput.textContent = lastResult.errores.map(t => `Fila ${t.linea}, columna ${t.columna}: ${t.descripcion} (${t.lexema})`).join('\n');
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
  // Siempre analizar el contenido actual; no reutilizar tokens de otra edición.
  runScannerOnly();
  if (!lastResult) return;

  // Corremos el parser
  lastParserResult = parser.parse(lastResult.tokens, enableSemantic);

  const exito = lastParserResult.exito && lastResult.errores.length === 0 && lastResult.tokens.length > 0;
  if (codeGenerator) {
    codeGenerator.update(exito, enableSemantic, lastParserResult.simbolos);
  }

  if (exito) {
    parserOutput.innerHTML = `<strong style="color: green;">La compilación ${enableSemantic? 'semántica ' : 'sintáctica '}fue exitosa.</strong>\nNo se encontraron errores ${enableSemantic? 'sintácticos ni semánticos' : 'sintácticos'}.`;
    parserOutput.style.color = 'green';
  } else {
    let errores = errorOutput.textContent || '';
    lastParserResult.errores.forEach((err, index) => {
      errores += `${errores ? '\n' : ''}${index + 1}. Fila ${err.linea}: ${err.mensaje}`;
    });
    if (lastResult.tokens.length === 0 && lastResult.errores.length === 0) errores = 'Escribe un programa antes de analizar.';
    errorOutput.textContent = errores;
    parserOutput.textContent = 'Se encontraron errores. Consulta el panel Error.';
    parserOutput.style.color = '#a51e1e';
  }
}

function validarPrograma(): boolean {
  runParserOnly(true);
  return !!lastResult && lastResult.tokens.length > 0 && lastResult.errores.length === 0 && !!lastParserResult?.exito;
}

// Action: Mostrar únicamente la Tabla de Código Intermedio (en Bloque 1)
function showIntermediateCodeOnly(): void {
  const exito = validarPrograma();
  if (dataTableContainer) dataTableContainer.style.display = 'block';
  if (ensambladorContainer) ensambladorContainer.style.display = 'none';
  if (intermediateTitle) intermediateTitle.textContent = 'Código Intermedio';

  if (codeGenerator) {
    if (exito) {
      codeGenerator.renderFromSymbols(lastParserResult?.simbolos || {});
    } else {
      codeGenerator.showError('No se pudo generar código intermedio. Corrige los errores en el programa.');
    }
  }
}

// Action: Generar el Código Ensamblador en formato de 3 celdas (en Bloque 1)
function generarCodigoEnsamblador(): boolean {
  if (!validarPrograma() || !lastResult) return false;
  if (dataTableContainer) dataTableContainer.style.display = 'none';
  if (ensambladorContainer) ensambladorContainer.style.display = 'block';
  if (intermediateTitle) intermediateTitle.textContent = 'Código intermedio';

  const filas = traductor.generarFilas(lastResult.tokens);
  currentAsmRows = filas;
  currentAsmCode = traductor.generarCodigo(lastResult.tokens);

  if (asmTableBody) {
    if (filas.length === 0) {
      asmTableBody.innerHTML = '<tr><td colspan="3" align="center">No hay código para mostrar.</td></tr>';
      return false;
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
  return filas.length > 0;
}

// Action: Generar código objeto a partir de las mismas filas de ensamblador.
function generarCodigoObjeto(): boolean {
  if (!generarCodigoEnsamblador()) {
    codigoObjetoTableBody.innerHTML = '<tr><td class="empty" colspan="4">No se pudo generar. Consulta el panel Error.</td></tr>';
    return false;
  }
  try {
    const filas = codigoObjeto.generarFilas(currentAsmRows);
    currentObjectCode = codigoObjeto.formatearFilas(filas);
    codigoObjetoTableBody.innerHTML = filas.map(f => `
      <tr title="${escapeHtml(f.origen + (f.reubicacion ? ' · Reubicación @DATA pendiente' : ''))}">
        <td>${f.segmento}</td>
        <td>${f.direccion}</td>
        <td>${f.contenido}</td>
        <td>${f.hex}</td>
      </tr>
    `).join('');
    objetoNota.hidden = !filas.some(f => f.reubicacion);
    return filas.length > 0;
  } catch (err) {
    currentObjectCode = '';
    objetoNota.hidden = true;
    const mensaje = err instanceof Error ? err.message : String(err);
    errorOutput.textContent = `Código objeto: ${mensaje}`;
    codigoObjetoTableBody.innerHTML = '<tr><td class="empty" colspan="4">No se pudo generar. Consulta el panel Error.</td></tr>';
    return false;
  }
}

// Action: Mostrar / Enfocar Cuadro Aparte de Codificación Binaria y Arquitectura Intel x86
function showMachineCodeView(): void {
  if (machineCodeGenerator) {
    machineCodeGenerator.render();
  }
  const cuadro = document.getElementById('cuadroCodificacionBinaria');
  if (cuadro) {
    if (cuadro instanceof HTMLDetailsElement) cuadro.open = true;
    cuadro.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Action: Copiar Código Ensamblador al Portapapeles
function copiarCodigo(): void {
  if (!currentAsmCode && !generarCodigoEnsamblador()) return;
  copiarTexto(currentAsmCode, btnCopyAsm);
}

function copiarCodigoObjeto(): void {
  if (!currentObjectCode && !generarCodigoObjeto()) return;
  copiarTexto(currentObjectCode, btnCopyObjeto);
}

function copiarTexto(textoACopiar: string, boton: HTMLButtonElement | null): void {
  if (!textoACopiar.trim()) return;

  const feedback = () => {
    if (boton) {
      const originalText = boton.textContent || 'Copiar';
      boton.textContent = '¡Copiado!';
      setTimeout(() => {
        boton.textContent = originalText;
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
    if (document.execCommand('copy')) callback();
    else errorOutput.textContent = 'El navegador no permitió copiar al portapapeles.';
  } catch (err) {
    console.error('Error al copiar al portapapeles', err);
    errorOutput.textContent = 'El navegador no permitió copiar al portapapeles.';
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
    limpiarEstado();
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
      limpiarEstado();
    }
  });

  btnTokens.addEventListener('click', runScannerOnly);
  btnParser.addEventListener('click', () => runParserOnly(false));
  btnSemantic.addEventListener('click', () => runParserOnly(true));
  btnCodigoObjeto.addEventListener('click', generarCodigoObjeto);
  btnCopyObjeto.addEventListener('click', copiarCodigoObjeto);
  codigoObjetoTableBody.addEventListener('click', (event) => {
    const fila = (event.target as HTMLElement).closest('tr');
    if (!fila || fila.querySelector('.empty')) return;
    codigoObjetoTableBody.querySelector('.selected')?.classList.remove('selected');
    fila.classList.add('selected');
  });

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

  if (btnMachineCode) {
    btnMachineCode.addEventListener('click', showMachineCodeView);
  }
  if (btnActualizarBinario) {
    btnActualizarBinario.addEventListener('click', () => {
      if (machineCodeGenerator) machineCodeGenerator.render();
    });
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
    grammarToggle.setAttribute('aria-expanded', String(isHidden));
    grammarToggle.innerHTML = isHidden ? '<b>[-] Ocultar Gramática</b>' : '<b>[+] Ver Gramática de Referencia</b>';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initExamples();
  setupEventListeners();
  codeGenerator = new IntermediateCodeGenerator();
  machineCodeGenerator = new X86MachineCodeGenerator();
  machineCodeGenerator.render();
});
