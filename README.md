# mydaddyfriend.lol

Una página amarilla sin ningún propósito.

Subís la foto de un amigo, la cara se le pega al muñeco, le ponés un nombre y cada
vez que lo apretás cierra los ojos, abre la boca y gime *"YES DADDY"*.

Todo pasa **dentro del navegador**: la foto nunca se sube a ningún servidor.

## Cómo se usa

1. `📸 poné una cara` (o arrastrás la foto a la página, o la pegás con `Ctrl+V`).
2. Le escribís el nombre en el cartelito de arriba.
3. Lo apretás. Y lo volvés a apretar.

La foto, el nombre y el contador de gemidos quedan guardados en el `localStorage`
del navegador, así que siguen ahí cuando volvés. `🗑️ borrar` los limpia.

## Cómo funciona

- La foto se procesa con [face-api.js](https://github.com/vladmandic/face-api)
  (`tinyFaceDetector` + `faceLandmark68TinyNet`, ~270 KB de modelos) para encontrar
  los **ojos y la boca**.
- Con la posición de los ojos se calcula escala, rotación e inclinación, y la cara
  se dibuja centrada en un canvas de 560×560 que es lo que se ve en la cabeza del muñeco.
- Sobre esa textura se colocan los párpados cerrados y la boca abierta, en las
  coordenadas exactas de los ojos y la boca detectados. El color de cada parche se
  saca muestreando la piel al lado del rasgo, así se funde con la foto en vez de
  quedar como un sticker.
- Si no encuentra ninguna cara, hace un recorte centrado y abre el panel de ajustes
  para acomodarla a mano con los sliders.
- El "yes daddy" lo dice la `SpeechSynthesis` del navegador, con tono y velocidad
  al azar. El chirrido es un oscilador de la Web Audio API.

## Correrlo

Es HTML, CSS y JS sueltos, sin build ni dependencias que instalar. Lo único que
hace falta es servirlo por HTTP (abriéndolo como `file://` el navegador bloquea la
carga de los modelos):

```sh
python3 -m http.server 8000
# http://localhost:8000
```

Para publicarlo alcanza con subir la carpeta a cualquier hosting estático
(GitHub Pages, Netlify, Vercel, un `nginx`).

## Archivos

```
index.html            la página y el muñeco (SVG)
styles.css            todo lo amarillo
app.js                detección de cara, recorte, expresión, sonido
vendor/face-api/      face-api.js + los dos modelos chicos (MIT)
```

`face-api.js` está vendorizado a propósito: sin CDN, la página anda igual aunque
el CDN se caiga y no le cuenta a nadie que la abriste.
