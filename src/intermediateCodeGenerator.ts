export class IntermediateCodeGenerator {
  private dataTableBody: HTMLTableSectionElement | null;

  constructor() {
    this.dataTableBody = document.getElementById('dataTableBody') as HTMLTableSectionElement;
  }

  public update(exito: boolean, enableSemantic: boolean, simbolos?: Record<string, string>): void {
    if (!this.dataTableBody) return;

    if (enableSemantic && exito && simbolos) {
      this.renderFromSymbols(simbolos);
    } else {
      this.clear();
    }
  }

  public clear(): void {
    if (this.dataTableBody) {
      this.dataTableBody.innerHTML = '<tr><td colspan="3" align="center">Presiona el botón "Mostrar Tabla" para generar.</td></tr>';
    }
  }

  public showError(mensaje: string): void {
    if (this.dataTableBody) {
      this.dataTableBody.innerHTML = `<tr><td colspan="3" align="center" style="color: red;">${this.escapeHtml(mensaje)}</td></tr>`;
    }
  }

  public renderFromSymbols(simbolos: Record<string, string>): void {
    if (!this.dataTableBody) return;

    const keys = Object.keys(simbolos);
    if (keys.length === 0) {
      this.dataTableBody.innerHTML = '<tr><td colspan="3" align="center">No hay variables declaradas.</td></tr>';
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
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
