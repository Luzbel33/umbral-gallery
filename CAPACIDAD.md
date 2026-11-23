# Capacidad del piloto

El cupo social global es de **120 visitantes, en grupos de seis**. La visita individual funciona sin reservar lugar. Las pruebas dejan abierta la cantidad de visitantes individuales simultáneos que podría sostener el plan gratuito. La transferencia de video, las cuotas mensuales y la concentración de las llegadas determinan cómo responde ante una publicación viral.

## Espacio disponible para artistas

El piloto tiene 100 salas, hasta cuatro obras por sala y ocho lugares posibles en el plano. Con Cloudinary habilitado, cada artista reserva hasta 48 MiB de medios, incluso si las otras 99 salas están llenas. El total de medios y miniaturas es de 4.800 MiB (4,6875 GiB). En la prueba aislada se reservaron los 48 MiB de todas las salas y se rechazó el byte siguiente. Se cargó un MP4 de 33.554.432 bytes en Cloudinary a través del servidor local y se verificó su tamaño en la respuesta del proveedor. Una transferencia que declaró ese tamaño y envió solo 256 bytes fue rechazada. Los PDF y los objetos existentes siguen en el depósito original. La reserva de 6 MiB por artista más 200 MiB compartidos da un techo de 800 MiB en Storage. Una sala puede crecer hasta 48 MiB y cada archivo listo para subir hasta 32 MiB. Las miniaturas cuentan. Los enlaces de medios externos ocupan una obra y cero bytes del cupo de archivos.

En Docker se aceptó la sala número 100 y se rechazó la 101. Con la bolsa compartida llena, otra sala pudo completar su reserva de 6 MiB. Dos subidas concurrentes de 25 MiB a la misma sala dejaron un archivo almacenado y 23 MiB disponibles. En Chrome, una muestra WAV de 4.608.078 bytes se preparó en 389.411 bytes y un MP4 de 9.216.746 bytes en 812.311 bytes. El resultado depende del original y del códec disponible en el dispositivo. El editor muestra el tamaño exacto de la copia preparada antes de confirmar.

## Prueba de carga aislada

Fecha de la prueba: 2026-11-23. Docker local con 100 salas publicadas y 400 obras sintéticas. El gateway, la base, el servidor HTTP y el generador de tráfico compartieron la máquina. PostgreSQL tuvo un límite de 1 CPU y 512 MiB de RAM. Las funciones reutilizaron workers.

Chrome registró los recursos de cada entrada en frío. Los visitantes virtuales descargaron ese conjunto y consultaron la API pública correspondiente. La lectura de metadatos usa el reintento acotado de la aplicación. El recorrido inaugural fue Materia orbital. La sala del artista exhibía cuatro fotos subidas a Storage. Los tiempos miden transferencias HTTP locales. La simulación no incluyó miles de GPU, redes móviles ni la CDN de producción.

| Escenario | Visitas completas | p95 de las visitas completas |
| --- | ---: | ---: |
| Catálogo, 100 de golpe | 100 / 100 | 1.596 ms |
| Catálogo, 500 de golpe | 420 / 500 | 5.016 ms |
| Catálogo, 1.000 de golpe | 780 / 1.000 | 11.118 ms |
| Catálogo, 1.000 en 30 segundos | 1.000 / 1.000 | 26 ms |
| Sala inaugural 3D, 100 de golpe | 100 / 100 | 1.225 ms |
| Sala inaugural 3D, 500 de golpe | 364 / 500 | 5.053 ms |
| Sala inaugural 3D, 1.000 de golpe | 652 / 1.000 | 9.450 ms |
| Sala inaugural 3D, 1.000 en 30 segundos | 1.000 / 1.000 | 32 ms |
| Sala de artista 3D, 100 de golpe | 100 / 100 | 2.869 ms |
| Sala de artista 3D, 500 de golpe | 202 / 500 | 8.912 ms |
| Sala de artista 3D, 1.000 de golpe | 221 / 1.000 | 15.388 ms |
| Sala de artista 3D, 1.000 en 30 segundos | 1.000 / 1.000 | 60 ms |

En las ráfagas instantáneas hubo fallos de conexión o del gateway incluso con el catálogo en caché. Entrar directamente a una exhibición inaugural requiere sólo archivos estáticos. Ante una interrupción de la base o del catálogo comunitario, esas muestras siguen accesibles mientras responda el alojamiento estático.

## Transferencia y visitas compartidas

Archivos estáticos del catálogo en frío: 338.843 bytes. Entrada 3D a Materia orbital: 698.807 bytes. La sala de artista transfirió 427.347 bytes, de los cuales 35.110 bytes correspondieron a miniaturas. Las mismas cuatro imágenes transferían 170.612 bytes antes. El audio, el video y las obras a tamaño completo se descargan a pedido. Los otros interiores inaugurales tienen modelos de distinto tamaño.

De 160 solicitudes sociales simultáneas, 120 ingresaron en 20 grupos y 40 recibieron la respuesta de cupo completo. Se completaron 2.640 / 2.640 actualizaciones de movimiento, p95 9 ms. Con seis visitantes quietos y sin chat nuevo, el cuerpo de una respuesta midió 2 bytes. La actualización con posiciones nuevas midió 361 bytes en la muestra. Las cabeceras y TLS agregan transferencia. Las reservas vencen a los 100 segundos sin renovación.

La voz se verificó por separado entre dos cuentas. Se permite un hablante por grupo y hasta seis en total, con un presupuesto diario de 10.000 fragmentos o 40 MiB estimados. Los canales de voz son opcionales. El chat y el movimiento utilizan consultas a la base.

## Qué consume una publicación viral

GitHub Pages publica un límite blando de 100 GB mensuales. Supabase Free incluye bolsas mensuales separadas de 5 GB de egreso sin caché y 5 GB con caché, 1 GB de archivos y 500.000 invocaciones de funciones. Mil reproducciones completas de un video de 10 MB transfieren unos 10 GB. Una respuesta que llega a una función cuenta como invocación incluso si su worker tenía la consulta en caché. La caché HTTP del navegador puede evitar esa invocación. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) · [Supabase](https://supabase.com/pricing).

Si el video concentra el consumo, una CDN y calidades de video adaptativas permiten financiar la entrega por separado antes de ampliar el cupo social. Un patrocinio de exposiciones puede cubrir ese costo y conservar las salas gratuitas. El piloto sigue en los servicios gratuitos existentes.

## Reproducir localmente

Instalá las dependencias e iniciá Supabase en Docker. Aplicá las migraciones, levantá las funciones con workers reutilizables y ejecutá la prueba en otra terminal. El script sólo admite el entorno de loopback y retira sus datos. CHROME_PATH permite elegir Chrome. Para la prueba con recursos acotados, fijá el límite del contenedor antes de iniciarla.

```sh
npm ci
supabase start
supabase migration up --local
docker update --cpus 1 --memory 512m --memory-swap 1g supabase_db_umbral-gallery
supabase functions serve
```

```sh
node scripts/load-gallery.mjs
```
