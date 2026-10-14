# Registro de operaciones en las libretas de las cuentas de registro — reglas de saldos

Fuente: *Anexo 14 · Registro de operaciones en libretas CR (CEL 3), corregido 07.10.2026* (RN-036 a RN-051, RN-066 a RN-073).
Estado revisado el 14.10.2026 contra el taller (`mock/libretas-seed.ts`, `mock/libretas-backend.ts`,
`utils/registro-libretas-saldos.util.ts`, `utils/exportacion/excel-consulta.util.ts`).

Leyenda: ✅ implementado y probado · ⚠️ parcial · ⏸️ descartado por ahora · ➖ fuera del alcance del taller.

## Cálculo de saldos del registro (Actividad 04)

- [x] **RN-036 / RN-044 / RN-045** Saldo inicial = saldo final del registro válido anterior de la misma libreta. ✅ La libreta se ordena por **fecha y, a igual fecha, secuencia**. Junio viene tal cual del Figma (no se encadena por fecha); desde julio se encadena y lo prueba `registro-libretas-saldos.util.spec.ts`.
- [x] **RN-037** Saldo de Apertura (tipo «Saldos Iniciales»): saldo inicial 0.00 y el importe entra como **crédito**. ✅ Corregido el registro 18 (antes SI 500,000).
- [x] **RN-038 / RN-040** Saldo disponible = crédito − débito. ⚠️ No se guarda como campo; se deriva.
- [x] **RN-039 / RN-041** Saldo final = saldo inicial + saldo disponible. ✅ Corregido el registro 17 (el débito de 5,000 era un crédito).
- [x] **RN-042 a RN-045** Lo mismo en moneda nacional, con el tipo de cambio de la operación. ✅ `saldosMNPorMovimiento` encadena el saldo MN (inicial MN = final MN anterior).
- [x] **RN-043** Un débito requiere saldo inicial ≥ débito. ✅ Probado sobre los datos de ejemplo.
- [ ] **RN-046 / RN-047** Si no cuadran las fórmulas, saldo insuficiente o cuadre roto → la operación queda **PENDIENTE** con su causal. ⏸️ Descartado de momento (el backend simulado solo tiene PROCESADO y RECHAZADO).

## Saldos de la Cuenta de Registro (Actividad 05)

- [x] El saldo final de la cuenta de registro es el saldo final del **último** registro válido. ✅ (`saldosPorCuentaRegistro`).
- [ ] El saldo inicial de la cuenta de registro solo lo fija el movimiento «Saldo Inicial» y no cambia con un «Ajuste de Saldo Inicial» ni con la apertura. ➖ No se modela una cuenta de registro con saldo propio; se deriva de sus libretas.
- [ ] Un ajuste de saldo inicial solo mueve el saldo final. ➖ Mismo motivo.
- [ ] **Corte anual (31/12)**: saldo final del último registro por cuenta de registro para el proceso de Saldos Iniciales. ➖ Otro proceso.

## Consultas y reportes (RN-066 a RN-073)

- [x] **RN-069 (agregada)** Para cada cuenta de registro se considera **una sola vez** el saldo final del último registro; **no se suman** los saldos de distintas secuencias de una misma libreta. ✅ Aplicado también a los totales del agrupado (antes se tomaba el saldo del primer y último movimiento del grupo, incoherente con varias cuentas de registro).
- [x] **Saldos de la cuenta bancaria** = suma, por cuenta de registro, de su saldo inicial del primer registro y su saldo final del último, dentro del resultado consultado. ✅ Se derivan de las libretas; ya no hay saldos fijos en `CUENTAS_BANCARIAS_INFO`.
- [ ] **RN-071** Los saldos en moneda de la cuenta van diferenciados por moneda; si se consolida entre monedas, se usa moneda nacional. ⚠️ Cada cuenta bancaria va aparte; no existe la consolidación conjunta en MN.
- [x] **RN-073** La exportación lleva el mismo conjunto de datos que la consulta activa. ✅

## Datos de ejemplo — verificación automática

`registro-libretas-saldos.util.spec.ts` comprueba sobre las libretas del taller: fórmula del saldo final, débito ≤ saldo inicial,
apertura con saldo inicial 0 y continuidad desde julio. `excel-consulta.util.spec.ts` comprueba que el total por entidad sigue RN-069.
