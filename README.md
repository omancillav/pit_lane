# pit_lane

Programa en **Solana** desarrollado con **Anchor** para registrar **resultados de carreras de F1 on-chain**. El contrato permite guardar resultados por carrera, validar reglas del podio y calcular puntos de forma determinística, incorporando condiciones de pista y el punto extra por vuelta rápida.

## Qué resuelve este proyecto

`pit_lane` busca llevar a cadena el registro de resultados de una carrera (por ejemplo, un Gran Premio) de forma:
- **Verificable**: las reglas se validan al momento de registrar el resultado.
- **Reproducible**: el cálculo de puntos queda definido en el programa (sin depender de lógica off-chain).
- **Auditable**: cualquier persona puede consultar el estado y verificar los resultados almacenados.

## Funcionalidades principales

- Registro de resultados de una carrera on-chain.
- Validación del podio (consistencia de posiciones y reglas básicas).
- Cálculo automático de puntos.
- Soporte para condición de pista (por ejemplo: seca/mojada u otra clasificación definida por el programa).
- Punto extra por vuelta rápida (según reglas del programa).

## Conceptos (modelo de datos)

Según el diseño típico en Anchor, el programa suele trabajar con:
- **Cuenta de Carrera (Race / GrandPrix)**: almacena metadata (identificador, fecha o ronda) y configuración asociada.
- **Resultado**: posiciones finales, piloto/equipo asociado (según tu modelo), puntos calculados, condición de pista y vuelta rápida.
- **Autoridad**: wallet que tiene permisos para inicializar o registrar resultados (si tu programa aplica control de acceso).

> Nota: los nombres exactos de cuentas e instrucciones dependen de tu implementación. Este README describe la intención del proyecto y cómo probarlo en Solana Playground.

## Requisitos

Para usarlo en **Solana Playground**:
- Un navegador web.
- Acceso a https://beta.solpg.io (Solana Playground).
- Tener el proyecto en GitHub (este repositorio) o copiar los archivos al Playground.
- Usar una red de pruebas (normalmente **devnet**).

## Uso en Solana Playground (paso a paso)

### 1) Abrir el proyecto
1. Entra a Solana Playground.
2. Importa el repositorio:
   - Opción A: si Playground permite “Import from GitHub”, usa `omancillav/pit_lane`.
   - Opción B: crea un proyecto Anchor nuevo y copia el contenido de tu repo (por ejemplo `programs/pit_lane/src/lib.rs`, `Anchor.toml`, `Cargo.toml`, `tests/`, etc.).

### 2) Seleccionar red y wallet
1. En la parte superior, selecciona **devnet**.
2. Conecta/crea una wallet dentro del Playground.
3. Solicita airdrop de SOL (Playground suele ofrecer un botón de airdrop). Esto es necesario para pagar deploy y transacciones.

### 3) Construir el programa (build)
1. Abre la sección de **Build**.
2. Ejecuta el build del programa Anchor.
3. Si hay errores, revisa:
   - `declare_id!()` en `lib.rs` (puede requerir actualizarse tras deploy).
   - Versiones de Anchor/solana-toolchain que use Playground.

### 4) Deploy del programa
1. En la sección de **Deploy**, despliega el programa.
2. Al finalizar, Playground te mostrará un **Program ID**.
3. Copia ese Program ID y actualiza `declare_id!("<PROGRAM_ID>")` en `programs/pit_lane/src/lib.rs` si tu flujo lo requiere.
4. Vuelve a **Build** y luego **Deploy** si hiciste cambios.

### 5) Ejecutar instrucciones (interactuar)
Tienes dos caminos típicos:

#### Opción A: Usar el cliente del Playground (si tu proyecto incluye scripts)
- Si tienes un cliente Typescript en `app/` o scripts, ejecuta las funciones que llamen a tus instrucciones Anchor.
- Verifica que el IDL se genere y que el cliente apunte al Program ID desplegado.

#### Opción B: Crear un script de prueba en Playground
1. Abre la sección de tests (si tienes `tests/*.ts`) o crea un archivo de script Typescript.
2. Asegúrate de importar Anchor y tu IDL.
3. Ejecuta el flujo típico:
   - Inicializar la cuenta de carrera (por ejemplo `initialize_race`).
   - Registrar resultado (por ejemplo `submit_result`).
   - Consultar la cuenta y verificar puntos/validaciones.

### 6) Verificar estado on-chain
- Usa el panel de cuentas del Playground para inspeccionar las cuentas creadas.
- Comprueba que:
  - El resultado almacenado coincide con el input.
  - Los puntos calculados son los esperados.
  - La vuelta rápida aplica el extra cuando corresponde.
  - La condición de pista queda persistida en la cuenta.

## Ejemplo de flujo (alto nivel)

1. **Crear carrera**
   - Input: identificador/ronda, autoridad, parámetros iniciales.
   - Output: cuenta `Race` inicializada.

2. **Registrar resultado**
   - Input: posiciones/podio, vuelta rápida, condición de pista.
   - Validaciones: unicidad de posiciones, consistencia del podio, reglas definidas.
   - Output: cuenta de resultados actualizada y puntos calculados.

3. **Consultar**
   - Lectura de cuenta para obtener clasificación y puntajes.

## Estructura recomendada del repositorio (Anchor)

Una estructura común para Anchor:
- `programs/pit_lane/src/lib.rs`: lógica del programa (instrucciones y cuentas).
- `tests/`: pruebas (Typescript).
- `Anchor.toml`: configuración del workspace.
- `migrations/`: scripts de deploy (si aplica).
- `app/` o `client/`: cliente (si aplica).

## Roadmap (ideas de mejora)

- Tabla completa de puntos configurable por temporada.
- Soporte para Sprint y carrera principal.
- Múltiples carreras por temporada y leaderboard acumulado.
- Control de acceso por rol (admin/oracle) para publicar resultados.
- Eventos (Anchor events) para indexación más fácil.

## Licencia

Define una licencia para el proyecto (por ejemplo MIT o Apache-2.0) o agrega un archivo `LICENSE`.