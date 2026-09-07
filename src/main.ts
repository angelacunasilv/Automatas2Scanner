import './style.css';
import { Scanner } from './scanner';
import { Token, TokenType, ScannerResult } from './types';
import { EXAMPLES } from './examples';

// Instancia del scanner léxico
const scanner = new Scanner();
let lastResult: ScannerResult | null = null;
let currentFilter: string = 'ALL';
let searchQuery: string = '';

// Elementos del DOM
const codeEditor = document.getElementById('codeEditor') as HTMLTextAreaElement;
const lineNumbers = document.getElementById('lineNumbers') as HTMLDivElement;
const btnScan = document.getElementById('btnScan') as HTMLButtonElement;
const btnClear = document.getElementById('btnClear') as HTMLButtonElement;
const exampleSelect = document.getElementById('exampleSelect') as HTMLSelectElement;
const liveScanToggle = document.getElementById('liveScanToggle') as HTMLInputElement;
const lineColCount = document.getElementById('lineColCount') as HTMLSpanElement;
const scanDuration = document.getElementById('scanDuration') as HTMLSpanElement;
const tokensTableBody = document.getElementById('tokensTableBody') as HTMLTableSectionElement;
const tokenBadgeCount = document.getElementById('tokenBadgeCount') as HTMLSpanElement;
const searchToken = document.getElementById('searchToken') as HTMLInputElement;
const filterPillsContainer = document.getElementById('filterPills') as HTMLDivElement;
const errorBanner = document.getElementById('errorBanner') as HTMLDivElement;
const errorMessage = document.getElementById('errorMessage') as HTMLSpanElement;

// Tarjetas de estadísticas
const statTotal = document.getElementById('statTotal') as HTMLSpanElement;
const statPr = document.getElementById('statPr') as HTMLSpanElement;
const statId = document.getElementById('statId') as HTMLSpanElement;
const statNum = document.getElementById('statNum') as HTMLSpanElement;
const statCad = document.getElementById('statCad') as HTMLSpanElement;
const statOp = document.getElementById('statOp') as HTMLSpanElement;
const statAsig = document.getElementById('statAsig') as HTMLSpanElement;
const statDelim = document.getElementById('statDelim') as HTMLSpanElement;
const statErr = document.getElementById('statErr') as HTMLSpanElement;

// Botones de exportación
const btnExportJson = document.getElementById('btnExportJson') as HTMLButtonElement;
const btnExportCsv = document.getElementById('btnExportCsv') as HTMLButtonElement;
const btnCopyTokens = document.getElementById('btnCopyTokens') as HTMLButtonElement;

// Sección de Gramática
const grammarToggle = document.getElementById('grammarToggle') as HTMLDivElement;
const grammarContent = document.getElementById('grammarContent') as HTMLDivElement;
const grammarChevron = document.getElementById('grammarChevron') as HTMLSpanElement;

// Inicialización de ejemplos en el select
function initExamples(): void {
  exampleSelect.innerHTML = '<option value="" disabled selected>Cargar Ejemplo...</option>';
  EXAMPLES.forEach((example, index) => {
    const opt = document.createElement('option');
    opt.value = index.toString();
    opt.textContent = `${example.name} - ${example.description}`;
    exampleSelect.appendChild(opt);
  });

  // Cargar el primer ejemplo por defecto
  codeEditor.value = EXAMPLES[0].code;
  updateLineNumbers();
  runScan();
}

// Actualizar números de línea
function updateLineNumbers(): void {
  const lines = codeEditor.value.split('\n');
  const lineCount = lines.length || 1;
  const numbersArray: string[] = [];
  for (let i = 1; i <= lineCount; i++) {
    numbersArray.push(`${i}`);
  }
  lineNumbers.innerHTML = numbersArray.join('<br>');
  
  // Actualizar contador del footer
  const charCount = codeEditor.value.length;
  lineColCount.textContent = `Líneas: ${lineCount} | Caracteres: ${charCount}`;
}

// Sincronizar scroll entre el textarea y los números de línea
function syncScroll(): void {
  lineNumbers.scrollTop = codeEditor.scrollTop;
}

// Ejecutar análisis léxico
function runScan(): void {
  const code = codeEditor.value;
  lastResult = scanner.scan(code);

  // Actualizar duración y KPIs
  scanDuration.textContent = `${lastResult.duracionMs} ms`;
  updateStats(lastResult);
  renderTable();
}

// Actualizar contadores de estadísticas
function updateStats(result: ScannerResult): void {
  statTotal.textContent = result.stats.total.toString();
  statPr.textContent = result.stats.palabrasReservadas.toString();
  statId.textContent = result.stats.identificadores.toString();
  statNum.textContent = result.stats.numeros.toString();
  statCad.textContent = result.stats.cadenas.toString();
  statOp.textContent = result.stats.operadores.toString();
  statAsig.textContent = result.stats.asignaciones.toString();
  statDelim.textContent = result.stats.delimitadores.toString();
  statErr.textContent = result.stats.errores.toString();
  tokenBadgeCount.textContent = result.stats.total.toString();

  // Banner de errores
  if (result.stats.errores > 0) {
    errorBanner.style.display = 'flex';
    errorMessage.innerHTML = `<strong>${result.stats.errores} error(es) léxico(s) detectado(s).</strong> Revisa los caracteres marcados en rojo en la tabla.`;
  } else {
    errorBanner.style.display = 'none';
  }
}

// Obtener clase CSS de badge para el tipo de token
function getBadgeClass(tipo: TokenType): string {
  switch (tipo) {
    case 'PALABRA_RESERVADA': return 'badge-pr';
    case 'IDENTIFICADOR': return 'badge-id';
    case 'NUMERO': return 'badge-num';
    case 'CADENA': return 'badge-cad';
    case 'OPERADOR': return 'badge-op';
    case 'ASIGNACION': return 'badge-asig';
    case 'DELIMITADOR': return 'badge-delim';
    case 'ERROR_LEXICO': return 'badge-err';
    default: return '';
  }
}

// Obtener etiqueta legible para el badge
function getBadgeLabel(tipo: TokenType): string {
  switch (tipo) {
    case 'PALABRA_RESERVADA': return 'PALABRA RESERVADA';
    case 'IDENTIFICADOR': return 'IDENTIFICADOR';
    case 'NUMERO': return 'NUMERO';
    case 'CADENA': return 'CADENA';
    case 'OPERADOR': return 'OPERADOR';
    case 'ASIGNACION': return 'ASIGNACION';
    case 'DELIMITADOR': return 'DELIMITADOR';
    case 'ERROR_LEXICO': return 'ERROR LEXICO';
    default: return tipo;
  }
}

// Renderizar la tabla de tokens
function renderTable(): void {
  if (!lastResult || lastResult.tokens.length === 0) {
    tokensTableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-state-icon">⚡</div>
            <p>No se encontraron tokens o el editor está vacío.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Filtrado
  const filteredTokens = lastResult.tokens.filter(token => {
    // Filtro por categoría
    if (currentFilter !== 'ALL' && token.tipo !== currentFilter) {
      return false;
    }
    // Filtro por búsqueda de texto en lexema
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchLex = token.lexema.toLowerCase().includes(q);
      const matchDesc = token.descripcion.toLowerCase().includes(q);
      const matchTipo = token.tipo.toLowerCase().includes(q);
      return matchLex || matchDesc || matchTipo;
    }
    return true;
  });

  if (filteredTokens.length === 0) {
    tokensTableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <p>No se encontraron tokens con el filtro seleccionado.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = filteredTokens.map(token => {
    const badgeClass = getBadgeClass(token.tipo);
    const badgeLabel = getBadgeLabel(token.tipo);
    const escapedLexeme = escapeHtml(token.lexema);

    return `
      <tr data-line="${token.linea}" data-col="${token.columna}" title="Línea ${token.linea}, Columna ${token.columna}">
        <td class="token-id">${token.id}</td>
        <td>
          <span class="token-badge ${badgeClass}">${badgeLabel}</span>
        </td>
        <td>
          <code class="token-lexeme">${escapedLexeme}</code>
        </td>
        <td class="token-pos">${token.linea}</td>
        <td class="token-pos">${token.columna}</td>
        <td class="token-desc">${escapeHtml(token.descripcion)}</td>
      </tr>
    `;
  }).join('');

  tokensTableBody.innerHTML = rowsHtml;

  // Event listener para resaltar línea al hacer clic en un token
  const trElements = tokensTableBody.querySelectorAll('tr[data-line]');
  trElements.forEach(tr => {
    tr.addEventListener('click', () => {
      const line = parseInt(tr.getAttribute('data-line') || '1', 10);
      highlightEditorLine(line);
    });
  });
}

// Resaltar y posicionar cursor en el editor
function highlightEditorLine(targetLine: number): void {
  const lines = codeEditor.value.split('\n');
  let pos = 0;
  for (let i = 0; i < targetLine - 1 && i < lines.length; i++) {
    pos += lines[i].length + 1; // +1 por el \n
  }
  
  codeEditor.focus();
  const lineEndPos = pos + (lines[targetLine - 1] ? lines[targetLine - 1].length : 0);
  codeEditor.setSelectionRange(pos, lineEndPos);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message: string): void {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>✓</span> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Configuración de eventos
function setupEventListeners(): void {
  // Input en el editor
  codeEditor.addEventListener('input', () => {
    updateLineNumbers();
    if (liveScanToggle.checked) {
      runScan();
    }
  });

  // Scroll sincronizado
  codeEditor.addEventListener('scroll', syncScroll);

  // Soporte para tabulaciones en el editor
  codeEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = codeEditor.selectionStart;
      const end = codeEditor.selectionEnd;
      codeEditor.value = codeEditor.value.substring(0, start) + '    ' + codeEditor.value.substring(end);
      codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
      updateLineNumbers();
      if (liveScanToggle.checked) {
        runScan();
      }
    }
  });

  // Botón Escanear
  btnScan.addEventListener('click', () => {
    runScan();
    showToast('Escaneo léxico completado');
  });

  // Botón Limpiar
  btnClear.addEventListener('click', () => {
    codeEditor.value = '';
    updateLineNumbers();
    runScan();
    exampleSelect.selectedIndex = 0;
    showToast('Editor limpiado');
  });

  // Selector de ejemplos
  exampleSelect.addEventListener('change', () => {
    const selectedIndex = parseInt(exampleSelect.value, 10);
    if (!isNaN(selectedIndex) && EXAMPLES[selectedIndex]) {
      codeEditor.value = EXAMPLES[selectedIndex].code;
      updateLineNumbers();
      runScan();
      showToast(`Ejemplo "${EXAMPLES[selectedIndex].name}" cargado`);
    }
  });

  // Búsqueda de tokens
  searchToken.addEventListener('input', () => {
    searchQuery = searchToken.value;
    renderTable();
  });

  // Filtros de categoría
  filterPillsContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target && target.classList.contains('filter-pill')) {
      filterPillsContainer.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
      target.classList.add('active');
      currentFilter = target.getAttribute('data-filter') || 'ALL';
      renderTable();
    }
  });

  // Exportar JSON
  btnExportJson.addEventListener('click', () => {
    if (!lastResult) return;
    const jsonStr = JSON.stringify(lastResult, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tokens_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Tokens exportados a JSON');
  });

  // Exportar CSV
  btnExportCsv.addEventListener('click', () => {
    if (!lastResult) return;
    let csv = 'ID,Tipo,Lexema,Linea,Columna,Descripcion\n';
    lastResult.tokens.forEach(t => {
      const cleanLex = `"${t.lexema.replace(/"/g, '""')}"`;
      const cleanDesc = `"${t.descripcion.replace(/"/g, '""')}"`;
      csv += `${t.id},${t.tipo},${cleanLex},${t.linea},${t.columna},${cleanDesc}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tokens_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Tokens exportados a CSV');
  });

  // Copiar Tokens
  btnCopyTokens.addEventListener('click', () => {
    if (!lastResult) return;
    const formatted = lastResult.tokens
      .map(t => `[${t.id}] ${t.tipo.padEnd(18)} | "${t.lexema}" | L:${t.linea} C:${t.columna} | ${t.descripcion}`)
      .join('\n');
    navigator.clipboard.writeText(formatted).then(() => {
      showToast('Tokens copiados al portapapeles');
    });
  });

  // Toggle Gramática
  grammarToggle.addEventListener('click', () => {
    const isHidden = grammarContent.style.display === 'none';
    grammarContent.style.display = isHidden ? 'grid' : 'none';
    grammarChevron.textContent = isHidden ? '▲' : '▼';
  });
}

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
  initExamples();
  setupEventListeners();
});
