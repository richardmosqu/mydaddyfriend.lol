# Los sonidos

Todo lo que suena en la página está acá, y se reproduce por el mismo `AudioContext`,
así que anda igual en todos los navegadores.

| Archivo | Qué es |
|---|---|
| `whip.mp3` | El latigazo de cada click |
| `oh-yeah-daddy.mp3` | Frase |
| `ahh.mp3` | Frase |
| `daddy-chill.mp3` | Frase |
| `moan-small.mp3` | Gemido |
| `moan-anime.mp3` | Gemido |
| `money-rain.mp3` | La canción del Money rain (14 s) |

`voice.json` es el que manda: `whip` dice cuál es el latigazo, y cada entrada de
`clips` dice qué archivo suena y qué texto aparece en el globo.

```json
{
  "whip": "whip.mp3",
  "clips": [
    { "file": "oh-yeah-daddy.mp3", "text": "OH YEAH DADDY" }
  ]
}
```

## Agregar o cambiar sonidos

1. Dejá el `.mp3` en esta carpeta.
2. Agregá su línea en `clips` con el texto que querés que salga en el globo.

No hay que tocar código. Se pueden poner todos los que quieras; en cada click se
elige uno al azar.

**Poné nombres en minúscula, sin espacios ni acentos.** El látigo original se
llamaba `Sonido de Látigo 3 - efecto de sonido.mp3` y esa `á` venía en forma
descompuesta (NFD, como la guarda macOS): son dos caracteres, `a` + tilde, que en
una URL no coinciden con la `á` de un solo carácter. Eso rompe la descarga en
algunos servidores sin dar ningún error visible.

## Cambiar la canción del Money rain

Reemplazá `money-rain.mp3`. **La duración del archivo es la duración del efecto**:
el baile y los billetes duran exactamente lo que dure la canción, así que si ponés
una de 30 s el botón queda bloqueado 30 s.

La actual son los primeros 14 s del original, con un fundido de salida al final y
7 dB menos de volumen: venía a -7 dB de nivel medio, siete más alto que las voces,
y las tapaba al pegarle mientras baila.

```sh
ffmpeg -i original.mp3 -t 14 \
  -af "volume=-7dB,afade=t=in:st=0:d=0.06,afade=t=out:st=13:d=1" \
  -ac 1 -ar 44100 -b:a 96k money-rain.mp3
```

## Formatos

`.mp3` y `.m4a` andan en todos lados. El `.ogg` que exporta WhatsApp **no anda en
Safari ni en iPhone**; convertilo:

```sh
ffmpeg -i nota.ogg -ac 1 -b:a 64k frase.mp3
```

## Emparejar niveles

Si un sonido se escucha mucho más bajo que los otros, medilo y subilo la
diferencia. `loudnorm` no sirve para clips de menos de un segundo: mide mal.

```sh
ffmpeg -i frase.mp3 -af volumedetect -f null -    # mirá mean_volume
ffmpeg -i frase.mp3 -af "volume=7dB" -ac 1 -b:a 64k frase-fix.mp3
```

Los que están ahora quedaron todos entre -17 y -21 dB de nivel medio, con los
picos por debajo de -0,8 dB. El latigazo va más caliente a propósito, es un golpe.
