export interface Example {
  name: string;
  description: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  {
    name: '1. Programa Básico',
    description: 'Declaración de variables, asignaciones y lecturas válidas',
    code: `INICIO
int contador = 0;
string mensaje = "Bienvenido al sistema";
boolean activo = true;

leer ( contador );
print ( mensaje );
FIN`
  },
  {
    name: '2. Condicionales y Bucles',
    description: 'Estructuras if, while con operadores relacionales y especiales @, #',
    code: `INICIO
int x = 10;
int y = 20;
int resultado = 0;

if ( x <= y ) {
    resultado = x @ y;
    print ( resultado );
}

while ( x > 0 ) {
    x = x # 1;
    print ( x );
}

boolean estado = false;
if ( estado == true ) {
    print ( "Activo" );
}
FIN`
  },
  {
    name: '3. Operaciones Completas',
    description: 'Uso exhaustivo de todos los tipos, operadores y estructuras',
    code: `INICIO
int a = 15;
int b = 30;
int c = a @ b;
string titulo = "Calculo de Automatas 2";
boolean flag = true;

leer ( a );
leer ( b );

if ( a == b ) {
    print ( "Valores iguales" );
}

if ( a != b ) {
    while ( a < b ) {
        a = a @ 2;
        print ( a );
    }
}

FIN`
  },
  {
    name: '4. Con Errores Léxicos',
    description: 'Demostración de detección de caracteres inválidos y cadenas no cerradas',
    code: `INICIO
int $precio = 500;
string texto = "Cadena sin cerrar;
float decimal = 3.14;
int resultado = 10 + 20 - 5;
boolean test = true & false;
FIN`
  }
];
