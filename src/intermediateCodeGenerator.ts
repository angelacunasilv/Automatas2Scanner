export class IntermediateCodeGenerator {
  private currentSymbols: Record<string, string> | null = null;
  private dataTableBody: HTMLTableSectionElement | null;
  private btnDownloadData: HTMLButtonElement | null;

  constructor() {
    this.dataTableBody = document.getElementById('dataTableBody') as HTMLTableSectionElement;
    this.btnDownloadData = document.getElementById('btnDownloadData') as HTMLButtonElement;

    if (this.btnDownloadData) {
      this.btnDownloadData.addEventListener('click', () => this.generateDataFile());
    }
  }

  public update(exito: boolean, enableSemantic: boolean, simbolos?: Record<string, string>): void {
    if (!this.dataTableBody || !this.btnDownloadData) return;

    if (enableSemantic && exito && simbolos) {
      this.currentSymbols = simbolos;
      this.renderDataTable(simbolos);
    } else {
      this.currentSymbols = null;
      this.dataTableBody.innerHTML = '<tr><td colspan="3" align="center">Realiza el análisis semántico para generar variables.</td></tr>';
      this.btnDownloadData.style.display = 'none';
    }
  }

  private renderDataTable(simbolos: Record<string, string>): void {
    if (!this.dataTableBody || !this.btnDownloadData) return;

    const keys = Object.keys(simbolos);
    if (keys.length === 0) {
      this.dataTableBody.innerHTML = '<tr><td colspan="3" align="center">No hay variables declaradas.</td></tr>';
      this.btnDownloadData.style.display = 'none';
      return;
    }

    const rows = keys.map(key => {
      const type = simbolos[key];
      let directive = '??';
      let val = '?';
      if (type === 'int') { directive = 'DW'; }
      else if (type === 'boolean') { directive = 'DB'; }
      else if (type === 'string') { directive = 'DB'; }
      else if (type === 'float') { directive = 'DD'; }

      return `<tr>
        <td align="center">${this.escapeHtml(key)}</td>
        <td align="center">${directive}</td>
        <td align="center">${val}</td>
      </tr>`;
    }).join('');

    this.dataTableBody.innerHTML = rows;
    this.btnDownloadData.style.display = 'block';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private generateDataFile(): void {
    if (!this.currentSymbols) return;
    const simbolos = this.currentSymbols;
    let content = 'Código Intermedio\n\n';
    const keys = Object.keys(simbolos);
    keys.forEach(key => {
      const type = simbolos[key];
      let directive = '??';
      let val = '?';
      if (type === 'int') { directive = 'DW'; }
      else if (type === 'boolean') { directive = 'DB'; }
      else if (type === 'string') { directive = 'DB'; }
      else if (type === 'float') { directive = 'DD'; }
      content += `${key} ${directive} ${val}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tabla_data.asm';
    a.click();
    URL.revokeObjectURL(url);
  }
}
