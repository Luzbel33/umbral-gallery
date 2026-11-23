# Capacidad del piloto

Prueba del 23 de noviembre de 2026. La galería pública usa GitHub Pages y Supabase Free. Se generó carga sólo contra una instalación independiente en Docker en la computadora de desarrollo. El cliente, el servidor web, el gateway y PostgreSQL compartieron la máquina. PostgreSQL tenía un límite de 1 CPU y 512 MiB de RAM. La base contenía 1.024 salas publicadas y 4.096 obras sintéticas.

## Entradas de golpe y entradas escalonadas

Cada visitante virtual descargó una vez los recursos observados al abrir una ventana nueva de Chrome. El catálogo hizo además una consulta real a PostgreSQL por la primera página. El destino 3D fue **Materia orbital**, una sala inaugural con archivos locales y recorrido individual. El servidor de prueba sirvió archivos comprimidos en memoria por HTTP de loopback. Los visitantes virtuales descargaron recursos. Sólo el navegador de reconocimiento renderizó la escena.

| Escenario | Visitas completas | Tiempo p95 de las completas |
| --- | ---: | ---: |
| Catálogo, 100 de golpe | 100/100 | 1,11 s |
| Catálogo, 500 de golpe | 411/500 | 3,60 s |
| Catálogo, 1.000 de golpe | 512/1.000 | 6,62 s |
| Sala inaugural 3D, 100 de golpe | 100/100 | 0,97 s |
| Sala inaugural 3D, 500 de golpe | 500/500 | 5,48 s |
| Sala inaugural 3D, 1.000 de golpe | 800/1.000 | 9,02 s |
| Sala de artista 3D con cuatro fotos, 100 de golpe | 100/100 | 3,83 s |
| Sala de artista 3D con cuatro fotos, 500 de golpe | 203/500 | 8,68 s |
| Sala de artista 3D con cuatro fotos, 1.000 de golpe | 203/1.000 | 8,38 s |
| Catálogo, 1.000 llegadas en 30 s | 1.000/1.000 | 18 ms |
| Sala inaugural 3D, 1.000 llegadas en 30 s | 1.000/1.000 | 18 ms |
| Sala de artista 3D con cuatro fotos, 1.000 llegadas en 30 s | 1.000/1.000 | 166 ms |

Para la sala de artista se publicaron cuatro fotos en el Storage aislado. Cada visita descargó la escena, leyó la sala en PostgreSQL y abrió las cuatro imágenes. Se observaron 19 solicitudes y 573.948 bytes en total, de los cuales 170.612 correspondieron a las fotos. La prueba recorrió también la ruta real de los medios de artistas, sin caché de CDN externa.

La consulta de catálogo por sí sola completó 300/300 solicitudes con 100 clientes (p95 de 293 ms), 686/750 con 250 clientes (903 ms) y 512/1.000 con 1.000 clientes (909 ms). Los errores observados fueron conexiones rechazadas o cerradas por la pila local. El p95 mide el tiempo por debajo del cual terminó el 95 % de las solicitudes exitosas. La medición escalonada representa unas 33 llegadas por segundo durante medio minuto.

## Capacidad compartida y voz

La aplicación reserva **120 lugares sociales en toda la galería**, con hasta **6 personas por grupo**. En una llegada simultánea de 160 visitantes al patio se armaron 20 grupos de seis. Los otros 40 recibieron el aviso de cupo y conservaron el acceso individual. Los 120 visitantes enviaron posición y consultaron su grupo durante unos 30 segundos. Se completaron **2.640/2.640 actualizaciones**, con p95 de 11 ms. Las reservas se liberan al salir o tras 100 segundos sin renovación. El chat de texto utiliza la misma consulta que los avatares.

La voz se activa por cuenta y por grupo. Admite un hablante por grupo y seis hablantes en total. Cada pulsación dura hasta 13,5 segundos. El servidor aplica un presupuesto diario compartido de 10.000 fragmentos o 40 MiB estimados, contando destinatarios. Ese presupuesto puede agotarse antes de llenar el patio. Se validó la voz como función por separado. La prueba de los 120 visitantes midió movimiento y consulta del grupo sin micrófonos transmitiendo.

Una respuesta local con seis visitantes y sin chat nuevo midió 599 bytes sin comprimir. Con los 120 lugares ocupados y una consulta cada 1,3 segundos, son unas 332.000 respuestas por hora, aproximadamente **199 MB/h de contenido** en ese ejemplo. Una bolsa de 5 GB alcanzaría para unas 25 horas a esa intensidad si se facturara ese tamaño. Cabeceras, compresión, mensajes de chat, nombres y demás tráfico cambian el consumo real. La cantidad de horas importa tanto como el pico simultáneo.

## Si una publicación se viraliza

- **Permanecer mirando** una sala individual abierta requiere pocos recursos adicionales del servidor. Entrar por primera vez, abrir otra obra o reproducir video sí consume transferencia. El motor dibuja en la GPU de cada visitante. Los tiempos de Internet, FPS en teléfonos físicos y la cantidad de espectadores mundiales simultáneos siguen sin medirse.
- **La muestra inaugural** transfirió 350.157 bytes en 12 recursos del catálogo y 427.958 bytes en 15 recursos de la entrada 3D en esta prueba. Cien mil entradas frías al catálogo con ese conjunto representan unos 35 GB de archivos estáticos, más API y medios adicionales. Pages publica un límite blando de 100 GB/mes. Las visitas con caché y los archivos que el público elija abrir cambian la cuenta. [Límites de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
- **Las obras de usuarios** salen de Supabase Storage. Si 1.000 visitantes descargan por completo un video de 10 MB se transfieren 10 GB. Free incluye bolsas separadas de 5 GB de egreso con caché y 5 GB sin caché. Un pico concentrado puede superar una de ellas bastante antes. El piloto dispone de 1 GB para almacenar archivos y 500 MB de base. Las cuentas comparten las cuotas aplicables a su organización. [Planes de Supabase](https://supabase.com/pricing).
- **El cupo social** permite que más personas sigan viendo exposiciones individualmente. Los límites publicados de Free incluyen 200 conexiones Realtime y 100 mensajes por segundo. Los oyentes usan un canal privado mientras tienen la voz activada. El presupuesto del piloto es adicional a las cuotas del proveedor. [Límites Realtime](https://supabase.com/docs/guides/realtime/limits).
- **Antes de aumentar los cupos**, medir egreso por obra, latencia de catálogo y actualizaciones sociales, y tiempo de cuadro en dispositivos reales. Si domina el video, financiar almacenamiento y entrega por CDN o agregar calidades de reproducción. Un patrocinio de muestras puede cubrir esos costos y mantener gratuita la exposición básica. La aplicación conserva PostgreSQL y claves de objeto exportables.

## Repetir la prueba

Con Node, Docker, Chrome y la CLI de Supabase, ejecutar desde la raíz del repositorio:

```sh
npm ci
supabase start
node scripts/load-gallery.mjs
```

`CHROME_PATH` permite elegir un Chrome instalado. El script admite exclusivamente la URL de loopback que devuelve la CLI local, compila con la clave local y crea y retira las filas sintéticas identificadas por el dominio reservado de prueba. Para repetir el límite del contenedor, ejecutar antes `docker update --cpus 1 --memory 512m --memory-swap 1g supabase_db_umbral-gallery`. Los resultados de la ejecución quedan en `.qa/load-results.json`.
