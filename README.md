# Formula del Bienestar

App interactiva en Next.js para explorar la Formula del Bienestar con controles
emocionales, plano cartesiano 3D, trazo continuo, avatar emocional, memoria
interior y valor vital.

## Funciones principales

- Simulacion continua con controles de play, pausa, reinicio y guardado diario.
- Plano 3D que representa la evolucion del estado emocional y del valor vital.
- Avatar emocional sincronizado con alegria, tristeza, calma, intensidad y agotamiento.
- Persistencia local en el navegador mediante `localStorage`.
- Importacion y exportacion de sesiones en formato JSON.

## Ejecutar en local

```bash
npm install
npm run dev
```

Luego abre `http://localhost:3000`.

## Compilar

```bash
npm run build
```

## Modelo usado

La app usa tres niveles:

- Armonia presente: calcula la armonia del momento desde tranquilidad, paz,
  responsabilidad, esfuerzo y pasion.
- Memoria interior: acumula la armonia vivida con mayor peso en lo reciente.
- Valor vital total: combina memoria interior y alegria presente.

## Publicacion

El repositorio incluye `.zenodo.json` para facilitar el archivado como software
en Zenodo y la generacion de DOI desde un release de GitHub.

## Deploy en Vercel

1. Importa el repositorio desde GitHub.
2. Framework: Next.js.
3. Build command: `npm run build`.
4. Deploy.
