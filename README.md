# Vacaciones — Calendario del equipo

Aplicación de planeación de vacaciones y ausencias para diciembre de 2026 a diciembre de 2027.

## Estado
**Repositorio creado. Aplicación pendiente de publicación y configuración de base de datos.** No utilizar para registrar información real hasta que se complete la configuración.

## Funciones previstas
- Inicio de sesión individual y autorización de integrantes.
- Carga inicial de saldos de vacaciones reportados por Success.
- Solicitudes pendientes, aprobadas, rechazadas y canceladas, con control de saldos.
- Cálculo de días hábiles de lunes a viernes, excluyendo festivos nacionales de Colombia.
- Días de antigüedad separados y medios días adicionales con vencimiento anual.
- Comodín de diciembre: elegir el 24 **o** el 31.
- Vista de calendario y control compartido; panel exclusivo para supervisión.

## Publicación segura
Se utilizará GitHub Pages para el frontend y Supabase para autenticación y datos compartidos, previa autorización empresarial. No subir información personal, volcados SQL con datos reales, contraseñas, claves de servicio ni secretos al repositorio público.

**Antes de considerarla productiva:** revisar y aplicar migraciones, configurar Row Level Security, credenciales publicables, URL de autenticación, GitHub Pages y pruebas con cuentas de usuario distintas.
