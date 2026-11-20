# Tiempo fuera — Vacaciones del equipo

Aplicación conectada a Supabase y diseñada para publicarse como sitio estático en GitHub Pages.

## Accesos
- **Equipo (selecciona nombre, sin cuenta):** https://jsperdomobe.github.io/Vacaciones/
- **Jefe (solo visualizador):** https://jsperdomobe.github.io/Vacaciones/?modo=visor
- **Supervisor (inicio de sesión):** https://jsperdomobe.github.io/Vacaciones/?modo=supervisor

## Funciones
- Calendario diciembre 2026 — diciembre 2027.
- Solicitudes sin credenciales: selecciona el nombre, fechas y tipo de ausencia. **Siempre quedan pendientes de aprobación.**
- Consulta de personas y ausencias aprobadas o pendientes.
- Comodín 24 o 31 de diciembre por año, una elección por persona; supervisor puede corregir.
- Panel protegido para aprobar, rechazar y editar saldos de Success, antigüedad y medios días adicionales.
- Solo se descuentan días hábiles lunes-viernes, excluyendo festivos de Colombia.

## Precauciones
- **El enlace es público:** cualquiera con él puede ver nombres y fechas de ausencias y puede enviar una solicitud en nombre de otra persona. No hay verificación de identidad para el equipo. El supervisor debe verificar antes de aprobar; la plataforma no genera permisos automáticamente.
- La vista abierta no publica saldos de Success, correos ni observaciones privadas.
- La cuenta de supervisor sí requiere autenticación individual.
- Antes de compartir externamente, confirma la autorización corporativa para el tratamiento de esta información. Si se requiere control de acceso, reactivar un inicio de sesión o colocar el sitio detrás de una pasarela de acceso.
- Nunca subir contraseñas ni claves service_role a GitHub; solo una clave publishable está en config.js.
- Si GitHub Pages muestra 404, ir a Settings → Pages y pulsar **Save** tras seleccionar `main` / `(root)`.