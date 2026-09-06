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
- El "yes daddy" lo dice la `SpeechSynthesis` del navegador, pero con tres cosas encima
  para que no suene a lector de PDF:
  1. **Elige una voz femenina en inglés** en vez de la de por defecto: puntúa las voces
     del sistema contra una lista de nombres femeninos conocidos (Samantha, Zira, Ava,
     Karen, Google US English…) y penaliza los masculinos. En el panel hay un `select`
     para elegir otra, porque cuáles hay depende del sistema operativo.
  2. **Cada frase tiene una versión hablada**: en el globo se lee `YES DADDY` pero se
     pronuncia `yesss... daddy`. Las comas y los puntos suspensivos son lo que le da
     entonación. El pitch varía poco (1.05–1.35) a propósito: estirarlo mucho es
     justamente lo que la hacía sonar a robot.
  3. **Un gemido sintetizado por debajo**, con formantes: un oscilador diente de sierra
     con vibrato pasado por tres pasa-banda que se abren de "mm" a "ah", más un poco de
     ruido de aire. Eso es lo que le pone cuerpo humano.
- En celular el `AudioContext` arranca suspendido y `resume()` es asíncrono: si se
  programan los sonidos antes de que arranque quedan agendados en un tiempo que ya pasó
  y no suenan nunca. Por eso todo el audio pasa por un `withAudio()` que espera a que el
  contexto esté corriendo. El golpe se dispara en `pointerdown`, no en `click`, que en
  celular llega 100-300 ms más tarde.
- `styles.css` y `app.js` se piden con `?v=N`. Sin eso el navegador se queda con el CSS
  viejo después de un deploy y la página se rompe entera (los `display:none` de poses y
  accesorios desaparecen y se dibuja todo superpuesto). **Al cambiar CSS o JS hay que
  subir ese número en `index.html`.**
- El cursor es un látigo que sigue al mouse y chasquea al hacer click. En celular no hay
  cursor, así que la animación aparece en el punto donde tocaste y se va sola.
- **Poses**: las cuatro están dibujadas en SVG dentro del mismo `viewBox`, y solo se muestra
  una por vez. La caja de la cara se reposiciona por CSS en cada pose, así que la foto
  recortada acompaña a la cabeza sin recalcular nada en JS.
- **Accesorios**: los que van sobre la cara (antifaz y mordaza) se posicionan con los mismos
  ojos y boca que detectó face-api, así que calzan en cualquier cara. Los del cuerpo (collar,
  esposas, cuerda) se dibujan una sola vez en `<defs>` y cada pose los coloca con un
  `transform`, en vez de redibujarlos cuatro veces.
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
