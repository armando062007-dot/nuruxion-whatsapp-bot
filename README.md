# Nuruxion · Bot de WhatsApp

Proyecto personal: un bot comunitario con comandos de moderación, misiones, inventario, economía virtual, mazmorras y actividades de temporada. Está escrito en Node.js y utiliza Baileys para conectarse a WhatsApp. La búsqueda musical separa los metadatos del acceso a archivos de audio autorizados.

Esta copia de portafolio se preparó a partir del código local. No es un respaldo del servicio activo: no incluye la web privada de postulaciones, la sesión de WhatsApp, los datos de producción, música descargada ni archivos multimedia privados.

## Prueba local

1. Usa Node.js 22 o posterior. Ejecuta `npm ci` para instalar las dependencias.
2. Copia `.env.example` a `.env` y configura `ALLOWED_GROUP_JIDS` con un grupo de pruebas propio. Sin esa lista el bot no arranca.
3. Ejecuta `npm test` para probar las funciones sin conectar WhatsApp.
4. Si quieres conectar una cuenta de pruebas, ejecuta `npm start` y vincúlala con el QR que aparece en la terminal. No uses ni copies la sesión del bot de producción.

La conversión de audio usa FFmpeg. Instala FFmpeg y, si lo necesitas, yt-dlp desde fuentes oficiales y mantenlos actualizados: el bot no descarga estos ejecutables. La clasificación musical es opcional y requiere Python, Essentia y sus modelos. Las integraciones opcionales de IA y formularios se configuran por separado. Si agregas imágenes o audio propios, conserva esos archivos fuera del repositorio salvo que tengas derecho a publicarlos.

## Antes de compartir

Publica solo código, documentación y datos ficticios. Guarda credenciales, sesiones, números privados, registros y datos de usuarios fuera de Git. Si ya expusiste una credencial, revócala o rótala; si se expuso la sesión de WhatsApp, desvincula ese dispositivo. No subas copias del host ni el historial de trabajo.
