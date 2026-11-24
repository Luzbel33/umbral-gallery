import { language, t } from "./i18n.js";
import { icon } from "./icons.js";
const pick = (es, en) => (language === "es" ? es : en);
export function guide() {
  const sections = [
    [
      pick("Entrar y guardar salas", "Visiting and saving rooms"),
      pick(
        "Desde Explorar podés filtrar por disciplina, abrir una muestra en la web o recorrerla en 3D. En PC usá WASD para caminar y mové el mouse para mirar. En celular, movete con el joystick izquierdo y girá con el pulgar derecho. El marcador guarda hasta 100 salas. Como invitado se quedan en ese navegador; con cuenta se guardan en tu perfil.",
        "Browse by discipline. Open an exhibition on the web or walk through it in 3D. On desktop use WASD to walk and the mouse to look. On mobile use the left stick to walk and the right thumb to look. Bookmark up to 100 rooms. Guest bookmarks stay in that browser. Signed-in bookmarks follow your account.",
      ),
    ],
    [
      pick("Crear una cuenta", "Creating an account"),
      pick(
        "Elegí Registrarme. Inventá un usuario de 3 a 24 letras, números o guion bajo y una contraseña de al menos 10 caracteres. Guardá el código de recuperación. Después entrás desde Ingresar. No hace falta correo ni crear una sala. Si ya usabas una llave, en Ingresar elegí el acceso anterior del dispositivo.",
        "Choose Sign up. Pick a username of 3–24 letters, digits or underscores and a password of at least 10 characters. Save the recovery code. Next time choose Sign in. No email or room is required. Previous passkey users can choose the device sign-in option under Sign in.",
      ),
    ],
    [
      pick(
        "Crear, publicar o liberar tu sala",
        "Creating, publishing or releasing a room",
      ),
      pick(
        "Mi espacio → Crear mi sala reserva un lugar. En Sala y enlaces elegí el nombre, disciplina, descripción, tamaño, color y piso. Agregá tu biografía y enlaces HTTPS para tu web, hasta tres redes sociales y un proyecto. Guardá y recorré la sala. Para publicarla, marcá Mostrar mi sala en el catálogo público y guardá. Desmarcarla la vuelve borrador. Para liberar el cupo, retirás tus obras y elegís Eliminar mi sala vacía.",
        "My space → Create my room reserves a place. Under Room and links set the name, discipline, description, dimensions, wall color and floor. Add a bio and HTTPS links for your website, up to three social profiles and a project. Save and walk through the installation. To publish, check the public catalogue option and save. Clear it to return to draft. To release the place, remove your works and choose Delete my empty room.",
      ),
    ],
    [
      pick("Subir una obra y ubicarla", "Uploading and placing a work"),
      pick(
        "En Obras y archivos elegí el archivo, escribí el título y tocá Subir obra. Elegí la obra en la lista para editar título, técnica, año y texto. Tocá uno de los ocho puntos del plano y guardá el montaje. Al elegir un punto ocupado, las dos obras intercambian lugar. Podés montar hasta cuatro esculturas en una misma sala. Sólo las imágenes llevan marcos. Los modelos se apoyan en una base y permiten definir un ángulo inicial de 0 a 359°. El visitante puede girar y acercar la pieza. Podés elegir letras sobre la pared, una cartela de papel o esconderlas.",
        "Under Works and files, choose a file, enter a title and select Upload work. Select the work to edit its title, medium, year and note. Choose one of eight floor-plan positions and save. Choosing an occupied point swaps the two pieces. You can exhibit up to four sculptures in one room. Only images have picture frames. Models stand on plinths and take an initial angle of 0–359°. Visitors can rotate and zoom them. Choose wall lettering, paper labels or hide them.",
      ),
    ],
    [
      pick("Qué admite cada visor", "What each viewer supports"),
      pick(
        "Imágenes JPG, PNG, WebP, AVIF y BMP se optimizan hasta 1920 px. Un GIF se muestra como imagen fija. Video MP4, WebM, MOV u OGV abre un reproductor. Audio MP3, Ogg, Opus, WAV, FLAC o M4A tiene reproductor y espectro. Los códecs dependen del navegador. Modelos GLB, glTF autocontenido, OBJ, STL y PLY ASCII admiten malla estática y color base, hasta 60.000 triángulos. PDF abre por páginas. CSV y TSV muestran hasta 100 filas y 30 columnas. Código, HTML, SVG, JSON, Markdown y cuadernos se leen como texto UTF-8 de hasta 524 kB. Para una demo ejecutable, agregá su enlace HTTPS en tu perfil.",
        "JPG, PNG, WebP, AVIF and BMP images are optimized up to 1920 px. GIFs appear as still images. MP4, WebM, MOV and OGV open a video player. MP3, Ogg, Opus, WAV, FLAC and M4A have a player and spectrum. Codec support depends on the browser. GLB, self-contained glTF, OBJ, STL and ASCII PLY support static geometry and base colors, up to 60,000 triangles. PDFs open page by page. CSV and TSV show up to 100 rows and 30 columns. Code, HTML, SVG, JSON, Markdown and notebooks are read as UTF-8 text up to 524 kB. Link an executable demo through your HTTPS project link.",
      ),
    ],
    [
      pick("Música y sonido", "Music and sound"),
      pick(
        "Subí un audio como obra. En Sala y enlaces → Música ambiente elegí esa pista y guardá. Los visitantes empiezan en silencio y deciden si activan la música. Reproducir un video u otro audio pausa lo anterior. Para volver a escuchar el ambiente, tocá Música. La pista seleccionada también cuenta entre las cuatro obras.",
        "Upload a track as a work. In Room and links → Room music select it and save. Visitors enter in silence and can turn the soundtrack on. Playing a video or another recording pauses the previous one. Use Music to turn the soundtrack back on. The soundtrack counts as one of the four works.",
      ),
    ],
    [
      pick("El piloto y sus cupos", "Pilot limits"),
      pick(
        "Hasta 100 salas de artistas, incluidos borradores. Una por cuenta y cuatro obras por sala. En Obras y archivos podés consultar la cuota activa. Con Cloudinary, las 100 salas tienen 50,33 MB propios para archivos de medios, incluidas las miniaturas. Los PDF siguen en Supabase y su espacio disponible se muestra al elegir el archivo. Con el almacenamiento anterior la reserva es de 6,29 MB más una bolsa compartida. Cada foto preparada pesa hasta 2 MB y su miniatura hasta 66 kB. El máximo general por archivo preparado es de 33,55 MB. El editor muestra cuánto pesa la copia antes de confirmar. Audio y video originales de hasta 134,22 MB pueden optimizarse en navegadores compatibles para piezas de hasta 20 minutos. Para grabaciones largas podés usar enlaces públicos de YouTube, Vimeo o SoundCloud, sin gastar espacio de archivos. Los enlaces externos cuentan como obra y se reproducen en el visor del proveedor. Para el ambiente elegí una pista subida. Las salas inaugurales y el ejemplo son independientes. Los archivos reales subidos quedan accesibles por enlace directo, incluso en borrador.",
        "Up to 100 artist rooms, including drafts. One room per account and four works per room. Works and files shows the active quota. With Cloudinary, each of the 100 rooms has its own 50.33 MB for media including previews. PDFs use Supabase and the editor shows their available space when you select a file. The original storage system provides 6.29 MB per room plus a shared pool. Prepared photos are up to 2 MB and previews up to 66 kB. The overall limit per prepared file is 33.55 MB. The editor shows its actual size before you confirm. Audio and video originals up to 134.22 MB can be optimized on compatible browsers for works up to 20 minutes long. For longer recordings, public YouTube, Vimeo and SoundCloud links use no file storage. Linked media count as works and open the provider’s player. Room soundtracks use uploaded tracks. Inaugural exhibitions and the example are separate. Uploaded files can be opened by direct link even when a room is a draft.",
      ),
    ],
    [
      pick("Ver redes y conocer gente", "Artist links and meeting others"),
      pick(
        "En la web, los enlaces aparecen bajo la presentación del artista. En 3D tocá Artista y redes. En el atrio o en una sala pública, Caminar en compañía te reúne con hasta cinco personas más. Hay 120 lugares sociales en total. Como invitado podés leer. Con cuenta podés escribir hasta 400 caracteres cada dos segundos. Se muestran los últimos 15 minutos. Para hablar, activá la voz y mantené presionado el micrófono. Un hablante por grupo y hasta seis en todo el piloto. Si el cupo social está lleno, podés visitar solo.",
        "On the web, find links under the artist’s introduction. In 3D choose Artist & links. Join a public room or the atrium to walk with up to five others. There are 120 social places overall. Guests can read. Signed-in users can write up to 400 characters every two seconds. Messages are visible for 15 minutes. Enable voice and hold to talk. One person can speak per group and up to six across the pilot. If the social session is full, you can visit individually.",
      ),
    ],
  ];
  return `<article class="visitor-guide"><a data-nav href="./" class="crumb">${icon("back", 16)} ${t("Explorar salas")}</a><h1>${t("Cómo funciona")}</h1><a class="secondary" data-nav href="?sala=taller">${t("Ver una sala de ejemplo")} ${icon("external", 16)}</a>${sections.map(([title, body], i) => `<details ${i === 0 ? "open" : ""}><summary>${title} ${icon("down", 16)}</summary><p>${body}</p></details>`).join("")}</article>`;
}
