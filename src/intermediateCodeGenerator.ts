export interface X86InstructionInfo {
  instruccion: string;
  hex: string;
  binario: string;
  desglose: string;
}

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
      this.dataTableBody.innerHTML = '<tr><td class="empty" colspan="3">Presiona «Tabla de variables» para generar.</td></tr>';
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
      else if (type === 'boolean') { directive = 'DW'; }
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

export class X86MachineCodeGenerator {
  private tableBody: HTMLTableSectionElement | null;

  constructor() {
    this.tableBody = document.getElementById('machineCodeTableBody') as HTMLTableSectionElement;
  }

  public getInstructions(): X86InstructionInfo[] {
    return [
      {
        instruccion: 'MOV EAX, 0x05 (Inmediato 32-bit a Reg EAX)',
        hex: 'B8 05 00 00 00',
        binario: '10111000 00000101 00000000 00000000 00000000',
        desglose: 'B8: Opcode MOV hacia registro EAX de 32 bits (10111000b). 05 00 00 00: Valor inmediato (0x05) en formato Little Endian (4 bytes).'
      },
      {
        instruccion: 'MOV AX, 10 (Asignación: Inmediato 16-bit a Reg AX)',
        hex: 'B8 0A 00',
        binario: '10111000 00001010 00000000',
        desglose: 'B8: Opcode MOV hacia registro AX de 16 bits (10111b + 000b). 0A 00: Valor inmediato 10 (0x000A) en Little Endian (2 bytes).'
      },
      {
        instruccion: 'MOV [x], AX (Almacenar: Reg AX a Memoria)',
        hex: '89 06 00 02',
        binario: '10001001 00000110 00000000 00000010',
        desglose: '89: Opcode MOV r/m16, r16. 06: Byte ModR/M [Mod: 00 (memoria), REG: 000 (AX), R/M: 110 (disp16)]. 00 02: Desplazamiento de memoria (0x0200) Little Endian.'
      },
      {
        instruccion: 'MOV AX, [y] (Cargar: Memoria a Reg AX)',
        hex: '8B 06 02 02',
        binario: '10001011 00000110 00000010 00000010',
        desglose: '8B: Opcode MOV r16, r/m16. 06: Byte ModR/M [Mod: 00 (memoria), REG: 000 (AX), R/M: 110 (disp16)]. 02 02: Dirección de memoria (0x0202) Little Endian.'
      },
      {
        instruccion: 'MOV DS, AX (Configuración de Segmento de Datos)',
        hex: '8E D8',
        binario: '10001110 11011000',
        desglose: '8E: Opcode MOV Sreg, r/m16. D8: Byte ModR/M [Mod: 11 (modo registro), REG: 011 (segmento DS), R/M: 000 (AX)].'
      },
      {
        instruccion: 'ADD AX, BX (Operador @: Reg + Reg)',
        hex: '01 D8',
        binario: '00000001 11011000',
        desglose: '01: Opcode ADD r/m16, r16. D8: Byte ModR/M [Mod: 11 (registro), REG: 011 (fuente BX), R/M: 000 (destino AX)].'
      },
      {
        instruccion: 'ADD AX, 2 (Operador @: Reg + Inmediato 16-bit)',
        hex: '05 02 00',
        binario: '00000101 00000010 00000000',
        desglose: '05: Opcode especializado ADD AX, imm16. 02 00: Valor inmediato (0x0002) en Little Endian (2 bytes).'
      },
      {
        instruccion: 'SUB AX, BX (Operador #: Reg - Reg)',
        hex: '29 D8',
        binario: '00101001 11011000',
        desglose: '29: Opcode SUB r/m16, r16. D8: Byte ModR/M [Mod: 11 (registro), REG: 011 (fuente BX), R/M: 000 (destino AX)].'
      },
      {
        instruccion: 'SUB AL, 0x30 (Operación LEER: Conversión ASCII)',
        hex: '2C 30',
        binario: '00101100 00110000',
        desglose: '2C: Opcode SUB AL, imm8. 30: Valor inmediato de 8 bits (0x30 = ASCII \'0\').'
      },
      {
        instruccion: 'IMUL BX (Multiplicación entera con signo)',
        hex: 'F7 EB',
        binario: '11110111 11101011',
        desglose: 'F7: Opcode operaciones Grupo 3 de 16 bits. EB: Byte ModR/M [Mod: 11 (registro), REG: 101 (extensión opcode /5 = IMUL), R/M: 011 (BX)].'
      },
      {
        instruccion: 'CMP AX, BX (Comparación en if / while)',
        hex: '39 D8',
        binario: '00111001 11011000',
        desglose: '39: Opcode CMP r/m16, r16 (resta comparativa que actualiza FLAGS). D8: Byte ModR/M [Mod: 11 (registro), REG: 011 (BX), R/M: 000 (AX)].'
      },
      {
        instruccion: 'JE label (Salto si es igual / ZF=1)',
        hex: '74 08',
        binario: '01110100 00001000',
        desglose: '74: Opcode JE/JZ rel8 (salto condicional si ZF=1). 08: Desplazamiento relativo con signo de 8 bits (+8 bytes).'
      },
      {
        instruccion: 'JNE label (Salto si no es igual / ZF=0)',
        hex: '75 0A',
        binario: '01110101 00001010',
        desglose: '75: Opcode JNE/JNZ rel8 (salto condicional si ZF=0). 0A: Desplazamiento relativo con signo de 8 bits (+10 bytes).'
      },
      {
        instruccion: 'JMP while1 (Bucle: Salto incondicional)',
        hex: 'EB E0',
        binario: '11101011 11100000',
        desglose: 'EB: Opcode JMP rel8 (salto incondicional corto). E0: Desplazamiento relativo en complemento a dos (-32 bytes).'
      },
      {
        instruccion: 'PUSH AX (Pila: Guardar registro)',
        hex: '50',
        binario: '01010000',
        desglose: '50: Opcode de 1 byte PUSH r16 (01010b base + 000b AX). Decrementa SP en 2 y almacena AX en [SS:SP].'
      },
      {
        instruccion: 'POP AX (Pila: Restaurar registro)',
        hex: '58',
        binario: '01011000',
        desglose: '58: Opcode de 1 byte POP r16 (01011b base + 000b AX). Extrae de [SS:SP] hacia AX e incrementa SP en 2.'
      },
      {
        instruccion: 'CALL print_num (Llamada a subrutina)',
        hex: 'E8 24 00',
        binario: '11101000 00100100 00000000',
        desglose: 'E8: Opcode CALL near rel16 (apila IP y suma desplazamiento). 24 00: Desplazamiento de 16 bits en Little Endian (+0x0024).'
      },
      {
        instruccion: 'RET (Retorno de subrutina)',
        hex: 'C3',
        binario: '11000011',
        desglose: 'C3: Opcode de 1 byte RET near (desapila dirección de retorno hacia IP).'
      },
      {
        instruccion: 'INT 21h (Interrupción por software DOS)',
        hex: 'CD 21',
        binario: '11001101 00100001',
        desglose: 'CD: Opcode INT imm8 (invocación de interrupción). 21: Vector de interrupción de 8 bits (0x21).'
      },
      {
        instruccion: 'LEA DX, msg_0 (Carga dirección de mensaje)',
        hex: '8D 16 10 01',
        binario: '10001101 00010110 00010000 00000001',
        desglose: '8D: Opcode LEA r16, m (Load Effective Address). 16: Byte ModR/M [Mod: 00 (memoria), REG: 010 (DX), R/M: 110 (disp16)]. 10 01: Offset en Little Endian (0x0110).'
      }
    ];
  }

  public render(items?: X86InstructionInfo[]): void {
    if (!this.tableBody) return;
    const list = items || this.getInstructions();
    this.tableBody.innerHTML = list.map(item => `
      <tr>
        <td><code>${this.escapeHtml(item.instruccion)}</code></td>
        <td align="center"><code style="font-weight: bold; color: #0055aa;">${this.escapeHtml(item.hex)}</code></td>
        <td align="center"><code style="color: #226622; font-size: 11px;">${this.escapeHtml(item.binario)}</code></td>
        <td style="font-size: 11px;">${this.formatDesglose(item.desglose)}</td>
      </tr>
    `).join('');
  }

  public clear(): void {
    if (this.tableBody) {
      this.tableBody.innerHTML = '<tr><td colspan="4" align="center">Presiona el botón "Codificación x86" para ver el análisis de código máquina.</td></tr>';
    }
  }

  private formatDesglose(text: string): string {
    return this.escapeHtml(text)
      .replace(/([0-9A-Fa-f]{2}(?:\s+[0-9A-Fa-f]{2})*):/g, '<strong>$1:</strong>')
      .replace(/\[(.*?)\]/g, '<span style="color: #660066;">[$1]</span>');
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
