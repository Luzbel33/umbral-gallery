# Umbral

[English](README.md)

Galería virtual gratuita para artistas, músicos y programadores. Abrí una sala en el navegador o recorré la exposición en 3D con teclado, mouse o controles táctiles. [Entrar a Umbral](https://luzbel33.github.io/umbral-gallery/) · [Visitar el patio](https://luzbel33.github.io/umbral-gallery/?sala=patio).

![Materia orbital, escultura original de la colección inaugural](public/art/orbital-wide.webp)

## Visitar o exponer

Explorá el catálogo sin cuenta. Elegí una disciplina o entrá directamente desde el enlace de cualquier sala pública. Podés marcar favoritos como visitante en ese navegador. Al ingresar a una cuenta, las salas guardadas en ella se sincronizan entre dispositivos.

Usá **Registrarme** para elegir tu nombre y crear una llave de acceso WebAuthn. Podés quedarte como visitante registrado. Para exponer abrí **Mi espacio → Crear mi sala**. Cada cuenta tiene una sola sala. Agregá tu biografía y elegí título, disciplina, color, piso y música de ambiente. Agregá enlaces HTTPS a tu web, red social y proyecto o demo. En **Obras y archivos** podés subir, retirar e intercambiar obras entre ocho posiciones. **Mostrar mi sala en el catálogo público** publica la sala. Cada archivo subido ya se puede abrir por enlace directo. Para eliminarlo, usá **Retirar**.

El piloto admite una llave por cuenta. Elegí una llave sincronizada o conservá una llave física. La pérdida de la única copia impide recuperar la cuenta. Las passkeys dependen del dominio de registro y de la compatibilidad del dispositivo. No se solicita correo.

### Archivos que se pueden exponer

| Contenido | Formatos y experiencia |
| --- | --- |
| Imagen | JPG, PNG, WebP, AVIF, BMP y primer cuadro de GIF. Conversión a WebP de hasta 1.920 px por lado. |
| Video y música | Video MP4, WebM, MOV y OGV. Audio MP3, WAV, Ogg, Opus, M4A y FLAC. Reproductor del navegador según los códecs del dispositivo. Cada pista de audio puede elegirse como ambiente de sala. |
| Escultura, diseño y modelos | GLB, glTF con datos embebidos, OBJ, STL y PLY ASCII. Visor con giro y zoom. La geometría estática y el color base compatible se convierten al formato interno, con un límite de 60.000 triángulos. |
| Documentos y datos | PDF paginado en canvas, CSV y TSV en tabla, JSON formateado y cuadernos Jupyter con las celdas visibles. |
| Código y escritura | Texto UTF-8, Markdown, scripts, HTML, SVG como fuente, shaders y decenas de extensiones más. El contenido se muestra como texto. Las demos ejecutables y repositorios se abren desde el enlace externo que elija el artista. [Lista de extensiones](src/formats.js). |

Cada sala admite ocho obras y cada archivo hasta 12 MiB. El límite de código y texto es 512 KiB. Los modelos se validan y convierten antes de subirlos. Los visores especializados se cargan al abrir una obra y ponen límites al tamaño descargado. El PDF se dibuja sin habilitar scripts ni formularios interactivos. El sitio usa una política de contenido y los enlaces públicos abren sin acceso a la ventana de origen. Quien opera la galería puede ocultar una sala. Para reportar contenido, compartí la URL pública sin datos personales en los [issues del proyecto](https://github.com/Luzbel33/umbral-gallery/issues).

### Patio, chat y voz

La interfaz sigue el idioma principal del navegador. Podés cambiar entre español e inglés desde el menú. En escritorio, mové el mouse sin presionar para mirar. En el celular, caminá con el joystick y girá con el otro pulgar. La ficha del artista permite abrir sus obras y enlaces desde el recorrido.

Entrá al patio desde el menú en modo web o 3D. También podés activar **Caminar en compañía** en una exposición. Los visitantes que se suman comparten grupo, posiciones y chat. Con cuenta podés escribir y habilitar la voz. Al escuchar, el micrófono queda apagado hasta que mantenés presionado **Mantené para hablar**. Soltar el control, cambiar de ventana o llegar al límite de una intervención detiene la captura. El servidor reenvía el audio a oyentes del mismo grupo mediante canales privados. La aplicación no guarda grabaciones. Los últimos mensajes de los 15 minutos recientes se muestran en el grupo.

El cupo global es de 120 visitas sociales, de a seis por grupo. Al llenarse se conserva la visita individual. La capacidad observada, el coste de las descargas y los presupuestos de la voz están en el [informe de pruebas de carga](CAPACIDAD.md).

## Desarrollo y publicación

Requiere Node 22.12 o posterior y un navegador moderno. El recorrido usa WebGL 2. La vista web permite visitar sin aceleración 3D.

```sh
npm ci
npm run dev
npm run build
```

Vite imprime la URL local. Por defecto el backend es el del piloto. Para desarrollar con datos propios, definí `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. `BASE_PATH` permite cambiar el prefijo `/umbral-gallery/`. GitHub Actions compila `dist/` y lo publica en Pages al actualizar `main`. Las exposiciones inaugurales disponen de páginas estáticas, metadatos de vista previa y sitemap.

Para una copia independiente, creá el proyecto de Supabase, actualizá los enlaces del sitio y del sitemap a tu dominio estable y configurá el origen HTTPS permitido para las funciones:

```sh
supabase link --project-ref TU_PROYECTO
supabase db push --linked
supabase secrets set GALLERY_ORIGIN=https://tu-dominio.example
supabase functions deploy gallery-passkeys --use-api
supabase functions deploy gallery-voice --use-api
supabase functions deploy gallery-public --use-api
```

La función de identidad verifica WebAuthn y emite sesiones. Los retos firmados vencen en tres minutos y se consumen una sola vez. La función de voz comprueba la sesión, el turno y el cupo antes de transmitir. Las claves de servicio permanecen en el runtime del backend. PostgreSQL aplica propiedad por cuenta, permisos por fila, posiciones únicas, límites de texto y autorización por grupo. Storage sirve archivos públicos directamente. Las reservas de subidas interrumpidas pueden retirarse desde el editor.

Para las pruebas de navegación, iniciá el sitio en el puerto 5178 y ejecutá `npx playwright test`. `GALLERY_TEST_URL` y `CHROME_PATH` permiten elegir el sitio y el navegador. Para usar el navegador incluido en Playwright ejecutá previamente `npx playwright install chromium`. Para ensayar carga descargá y ejecutá una pila local de Supabase como se indica en el [informe reproducible](CAPACIDAD.md).

La prueba integral del editor y la comunidad usa dos cuentas temporales, un autenticador de prueba y audio sintético. En la pila local, configurá un archivo de entorno con `GALLERY_ORIGIN=http://localhost:5184`, iniciá `supabase functions serve --env-file RUTA_AL_ARCHIVO` y ejecutá `node scripts/test-community.mjs`. Las capturas se guardan en `.qa/`.

En una copia alojada, restringí Realtime a canales privados desde la configuración del proyecto. La política de voz sólo permite escuchar el canal asignado a la propia visita autenticada. [Configuración de Realtime](https://supabase.com/docs/guides/realtime/settings).

## Arte y licencias

El código y las piezas originales de Estudio Umbral en este repositorio se distribuyen bajo [MIT](LICENSE). Cada persona conserva los derechos de las obras que suba. Instrument Serif y Space Grotesk usan SIL Open Font License 1.1. Sus licencias están en `public/licenses/`.

`art/interiors.py` construye las salas y hornea su iluminación en Blender. `art/media.py` crea el cortometraje con FFmpeg. *Cylinder Five* y *Cylinder Six*, de Chris Zabriskie, se reproducen bajo CC BY 4.0. La exposición de fotografía utiliza imágenes de dominio público del USGS. [Música](public/licenses/Cylinders.txt) · [Imágenes satelitales](public/licenses/Earth-As-Art.txt)
