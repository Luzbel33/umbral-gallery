# Capacidad del piloto

El cupo social global es de **120 visitantes, en grupos de seis**. La visita individual funciona sin reservar lugar. Las pruebas dejan abierta la cantidad de visitantes individuales simultáneos que podría sostener el plan gratuito. La transferencia de video, las cuotas mensuales y la concentración de las llegadas determinan cómo responde ante una publicación viral.

## Prueba de carga aislada

Fecha de la prueba: 2026-11-23. Docker local con 1.024 salas publicadas y 4.096 obras sintéticas. El gateway, la base, el servidor HTTP y el generador de tráfico compartieron la máquina. La base utilizó los recursos compartidos de Docker. Las funciones reutilizaron workers.

Chrome registró los recursos de cada entrada en frío. Los visitantes virtuales descargaron ese conjunto y consultaron la API pública correspondiente. La lectura de metadatos usa el reintento acotado de la aplicación. El recorrido inaugural fue Materia orbital. La sala del artista exhibía cuatro fotos subidas a Storage. Los tiempos miden transferencias HTTP locales. La simulación no incluyó miles de GPU, redes móviles ni la CDN de producción.

| Escenario | Visitas completas | p95 de las visitas completas |
| --- | ---: | ---: |
| Catálogo, 100 de golpe | 100 / 100 | 2.242 ms |
| Catálogo, 500 de golpe | 420 / 500 | 8.160 ms |
| Catálogo, 1.000 de golpe | 780 / 1.000 | 17.363 ms |
| Catálogo, 1.000 en 30 segundos | 1.000 / 1.000 | 36 ms |
| Sala inaugural 3D, 100 de golpe | 100 / 100 | 1.901 ms |
| Sala inaugural 3D, 500 de golpe | 332 / 500 | 6.833 ms |
| Sala inaugural 3D, 1.000 de golpe | 628 / 1.000 | 13.191 ms |
| Sala inaugural 3D, 1.000 en 30 segundos | 1.000 / 1.000 | 79 ms |
| Sala de artista 3D, 100 de golpe | 97 / 100 | 3.699 ms |
| Sala de artista 3D, 500 de golpe | 202 / 500 | 15.287 ms |
| Sala de artista 3D, 1.000 de golpe | 197 / 1.000 | 11.047 ms |
| Sala de artista 3D, 1.000 en 30 segundos | 1.000 / 1.000 | 1.010 ms |

En las ráfagas instantáneas hubo fallos de conexión o del gateway incluso con el catálogo en caché. Entrar directamente a una exhibición inaugural requiere sólo archivos estáticos. Ante una interrupción de la base o del catálogo comunitario, esas muestras siguen accesibles mientras responda el alojamiento estático.

## Transferencia y visitas compartidas

Archivos estáticos del catálogo en frío: 331.796 bytes. Entrada 3D a Materia orbital: 647.243 bytes. La sala de artista transfirió 439.892 bytes, de los cuales 35.110 bytes correspondieron a miniaturas. Las mismas cuatro imágenes transferían 170.612 bytes antes. El audio, el video y las obras a tamaño completo se descargan a pedido. Los otros interiores inaugurales tienen modelos de distinto tamaño.

De 160 solicitudes sociales simultáneas, 120 ingresaron en 20 grupos y 40 recibieron la respuesta de cupo completo. Se completaron 2.640 / 2.640 actualizaciones de movimiento, p95 14 ms. Con seis visitantes quietos y sin chat nuevo, el cuerpo de una respuesta midió 2 bytes. La actualización con posiciones nuevas midió 361 bytes en la muestra. Las cabeceras y TLS agregan transferencia. Las reservas vencen a los 100 segundos sin renovación.

La voz se verificó por separado entre dos cuentas. Se permite un hablante por grupo y hasta seis en total, con un presupuesto diario de 10.000 fragmentos por destinatario o 40 MiB estimados. Los canales de voz son opcionales. El chat y el movimiento utilizan consultas a la base.

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
