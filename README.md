# mydaddyfriend.lol

Una página amarilla sin ningún propósito. La página está en inglés; estas notas no.

Subís la foto de un amigo, se le recorta la cara y se le pega a un avatar con orejas
de gato, arnés de encaje y un látigo en la mano. Le ponés un nombre que le queda
flotando arriba de la cabeza como en un videojuego, y cada vez que lo apretás suena
un latigazo, cierra los ojos, abre la boca y gime *"YES DADDY"*.

Todo pasa **dentro del navegador**: la foto nunca se sube a ningún servidor.

## Cómo se usa

1. `📸 add a face` (o arrastrás la foto a la página, o la pegás con `Ctrl+V`).
2. `✏️ name it` y le escribís el nombre.
3. Le elegís **pose** (de pie, arrodillada, boca abajo, de espaldas), qué tiene **en la mano**
   (látigo, pala, flogger o nada) y qué **accesorios** lleva puestos (antifaz, mordaza de bola
   con correa, collar con correa, esposas, cuerda).
4. Si el tono de piel o de pelo no te convence, lo cambiás en la tira de colores
   (10 tonos de cada uno, más un selector libre). `↺ take the colors from the photo`
   vuelve a los que sacó de la foto.
5. Lo apretás. Y lo volvés a apretar. Cada 10 clicks sube de nivel.

La foto, el nombre y el contador quedan guardados en el `localStorage` del navegador,
así que siguen ahí cuando volvés. `🗑️ clear` los limpia.

## Cómo funciona

- La foto se procesa con [face-api.js](https://github.com/vladmandic/face-api)
  (`tinyFaceDetector` + `faceLandmark68TinyNet`, ~270 KB de modelos) para encontrar
  los **ojos y la boca**.
- Con la posición de los ojos se calcula escala, rotación e inclinación, y la cara se
  dibuja centrada en un canvas de 560×560. Ese canvas se recorta con una **máscara con
  forma de cara** (frente redondeada, mentón en punta, bordes difuminados), así queda
  la cara recortada y no una pelota con una foto encima. Los mechones de pelo del avatar
  se dibujan por encima y tapan el borde del recorte.
- Sobre esa textura se colocan los párpados cerrados y la boca abierta, en las
  coordenadas exactas de los rasgos detectados. El color de cada parche se saca
  muestreando la piel al lado del rasgo, así se funde con la foto.
- **El avatar se pinta con los colores de la foto**: el tono de piel del borde de la
  cara pinta cuello, brazos y piernas, y el pelo se muestrea en un arco por encima de
  los ojos. Por eso el cuerpo empalma con la cara en vez de parecer un casco.
- Si no encuentra ninguna cara, hace un recorte centrado y abre el panel de ajustes
  para acomodarla a mano con los sliders.
- Los colores se pueden pisar a mano desde la tira de swatches. Lo elegido a mano gana
  sobre lo muestreado y queda guardado; el pelo elegido a mano no se oscurece (si querés
  rubio platino o rosa, queda así).
- **Las frases son archivos de audio** en `sounds/`, generados con `pico2wave` y
  reproducidos por el mismo `AudioContext` que el latigazo. Antes esto lo hacía la
  `SpeechSynthesis` del navegador y era imposible de sostener: en varios navegadores
  emite la locución y no suena nada, sin disparar `start` ni `error`. Ahora la voz del
  navegador quedó sólo como respaldo por si falta la carpeta, y sigue habiendo un
  selector en el panel para volver a ella. Ver `sounds/README.md` para reemplazarlas
  por grabaciones propias.
- El gemido con formantes quedó como un respiro corto (180-240 ms) antes de la frase.
- **Money rain**: el botón tira billetes por toda la pantalla, el personaje baila y suena
  una canción de 8 s. La canción está compuesta a mano en `sounds/money-rain.mp3` (kick,
  clap, hats, bajo y un riff pentatónico a 120 BPM, generados por síntesis en Python y
  masterizados con ffmpeg) y se reproduce por el mismo `AudioContext` que todo lo demás.
  El baile es CSS a 1 s por ciclo, o sea dos tiempos de la canción. Se le puede seguir
  pegando mientras baila.
- El latigazo también es Web Audio puro: ruido blanco por un pasa-banda que barre de
  420 Hz a 3.8 kHz (el silbido), un chasquido filtrado en agudos y un golpe grave de
  170 a 55 Hz. No hay ningún archivo de audio en todo el proyecto.

## Correrlo

Es HTML, CSS y JS sueltos, sin build ni dependencias que instalar. Lo único que hace
falta es servirlo por HTTP (abriéndolo como `file://` el navegador bloquea la carga de
los modelos):

```sh
python3 -m http.server 8000
# http://localhost:8000
```

Para publicarlo alcanza con subir la carpeta a cualquier hosting estático
(GitHub Pages, Netlify, Vercel, un `nginx`).

## Archivos

```
index.html            la página y el avatar (SVG en dos capas: atrás y adelante de la cara)
styles.css            todo lo amarillo + la máscara con forma de cara
app.js                detección, recorte, colores, expresión, látigo
vendor/face-api/      face-api.js + los dos modelos chicos (MIT)
```

`face-api.js` está vendorizado a propósito: sin CDN, la página anda igual aunque el CDN
se caiga y no le cuenta a nadie que la abriste. Son 1.3 MB que se bajan en segundo
plano recién cuando el navegador está inactivo, no al abrir la página.
