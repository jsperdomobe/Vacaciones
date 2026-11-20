# Vacaciones · Calendario del equipo

Aplicación compartida para diciembre de 2026 a diciembre de 2027. Frontend HTML/CSS/JS en GitHub Pages, autenticación y datos en Supabase con RLS.

## Configuración
- GitHub Pages: Settings > Pages > Deploy from a branch > main > /(root).
- Supabase Auth: Configuration > URL Configuration. **Site URL** y **Redirect URL**: `https://jsperdomobe.github.io/Vacaciones/`.
- En Supabase Auth habilitar correo/magic links. En el primer ingreso, la cuenta de supervisor debe usar el correo corporativo ya configurado en la base.
- Los demás usuarios solicitan vincular su correo a uno de los nombres de la lista y el supervisor aprueba desde la pestaña Supervisión.
- No introducir claves secret/service_role en `config.js`.

## Reglas
- Los saldos se cargan manualmente desde Success; esta app no reemplaza el trámite oficial.
- Las solicitudes pendientes y aprobadas reservan saldo.
- Vacaciones: lunes a viernes menos festivos colombianos.
- Medios días y pasantes: bolsas independientes, año calendario, y comprobación de saldo en el servidor.
- El comodín del 24 o 31 de diciembre reemplaza un día de descuento si coincide con vacaciones.

**Privacidad:** no compartir detalles laborales sin revisión y autorización de la empresa. El repositorio público no contiene los nombres o saldos de personas; los datos están en Supabase con acceso controlado.

## Acceso inicial sin SMTP (alternativa segura)
Mientras se configura un proveedor de correos, el dueño de Supabase puede crear las cuentas en **Authentication > Users > Add user > Create new user**, marcar confirmación de correo solo para cuentas verificadas personalmente y asignar una contraseña temporal diferente para cada integrante. Compártela por un canal privado. Entra en la aplicación con «Entrar con contraseña» y cambia la contraseña desde el menú lateral.

**No desactivar Confirm email globalmente**: permitir cuentas autoconfirmadas creadas por cualquiera podría facilitar una suplantación. Para inicio de sesión mediante enlace a correos corporativos, configurar previamente SMTP propio.