# Las frases

Los `.mp3` de esta carpeta son lo que dice el muñeco. Se reproducen por el mismo
`AudioContext` que el latigazo, así que suenan igual en todos los navegadores.

Antes esto lo hacía la `SpeechSynthesis` del navegador y era un desastre: en
varios navegadores emitía la locución y no sonaba nada, sin dar ningún error.
Ahora la voz del navegador quedó sólo como respaldo, por si esta carpeta no está.

## Poner tu propia voz

Grabá los audios (cortitos, 1 a 2 segundos) y reemplazá los archivos **con el
mismo nombre**. No hay que tocar código:

```
yes-daddy.mp3              i-live-for-this.mp3
youre-my-daddy.mp3         yes-yes-yes.mp3
i-love-this.mp3            mmmm-daddy.mp3
oh-my-god-daddy.mp3        youre-the-best-daddy.mp3
more-daddy-more.mp3        please-daddy.mp3
thank-you-daddy.mp3        dont-stop-daddy.mp3
aaah-daddy.mp3             one-more-time-daddy.mp3
harder-daddy.mp3           daddy-daddy-daddy.mp3
```

Podés reemplazar los que quieras; los que dejes quedan con la voz actual. Se
suben arrastrándolos en GitHub (`Add file` → `Upload files`).

Para cambiar las frases o los textos que salen en el globo, editá `voice.json`:

```json
{ "file": "lo-que-sea.mp3", "text": "LO QUE SALE EN EL GLOBO" }
```

Usá `.mp3` o `.m4a`. El `.ogg` que exporta WhatsApp no anda en Safari ni en
iPhone; convertilo con `ffmpeg -i nota.ogg -ac 1 -b:a 64k yes-daddy.mp3`.

## Cómo se generaron los actuales

Con `pico2wave` (el motor de voz de Android, bastante más natural que espeak) y
`ffmpeg` para subirle el tono un 9%, recortar los silencios y normalizar:

```sh
pico2wave -l en-US -w /tmp/x.wav "yesss, daddy"
ffmpeg -i /tmp/x.wav -af "asetrate=16000*1.09,aresample=44100,atempo=1/1.09,\
silenceremove=start_periods=1:start_silence=0.02:start_threshold=-45dB,\
areverse,silenceremove=start_periods=1:start_silence=0.02:start_threshold=-45dB,areverse,\
loudnorm=I=-15:TP=-1.5:LRA=11" -ac 1 -b:a 64k yes-daddy.mp3
```

Son 216 KB en total y se bajan en segundo plano, no al abrir la página.
