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
3. Lo apretás. Y lo volvés a apretar. Cada 10 clicks sube de nivel.

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
- El "yes daddy" lo dice la `SpeechSynthesis` del navegador, con tono y velocidad al
  azar. El latigazo es Web Audio puro: ruido blanco por un pasa-banda que barre de
  420 Hz a 3.8 kHz (el silbido), un chasquido filtrado en agudos y un golpe grave de
  170 a 55 Hz. No hay ningún archivo de audio.

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
