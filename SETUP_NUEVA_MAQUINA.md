# Setup en una máquina nueva — App Kipo (app-fibra-pwa)

Guía para dejar el proyecto funcionando (build + deploy) en otra PC con Windows.

---

## 1) Programas a instalar

| Programa            | Versión recomendada           | Link / cómo                                              |
|---------------------|-------------------------------|---------------------------------------------------------|
| **Node.js**         | 20 LTS o superior (acá uso v24, ambas sirven) | https://nodejs.org → instalador "LTS"        |
| **Git**             | 2.x (acá v2.53)               | https://git-scm.com/download/win                        |
| **VS Code**         | última                        | https://code.visualstudio.com                           |
| **Firebase CLI**    | 15.x (acá v15.8)              | se instala con npm (ver abajo)                          |
| **Extensión Claude**| última                        | en VS Code: Extensions → buscar "Claude Code"           |

> El runtime de las Cloud Functions es **Node 24** (definido en `functions/package.json`). Para solo *deployar* no importa tu Node local; para correr el emulador conviene Node 24.

---

## 2) Carpeta del proyecto

**Si la otra PC ya tiene el proyecto:** basta con `git pull` en la carpeta (GitHub
`jnoriegav93/kipo`; ramas `main` y `equipos-por-proyecto`). Antes de pasarse de PC, en
la que se deja hay que hacer commit **y push**: lo que no se sube no llega.

Si es una PC sin el proyecto, copiá toda la carpeta tal cual. **Importante**, asegurate de que estén estos archivos/carpetas que NO están en git pero hacen falta:

- `.env`  ← variables de entorno (necesario, no se sube a git)
- `.firebaserc` y `firebase.json` ← apuntan al proyecto `kipo-d29af`
- `firestore.rules`, `storage.rules`

**NO hace falta copiar** (se regeneran):
- `node_modules/` (raíz) y `functions/node_modules/`
- `dist/` (se regenera con el build)

---

## 3) Pasos en la máquina nueva (en orden)

Abrí una terminal **dentro** de la carpeta del proyecto y corré:

```powershell
# 1. Instalar Firebase CLI (global, una sola vez en la PC)
npm install -g firebase-tools

# 2. Instalar dependencias del proyecto (raíz)
npm install

# 3. Instalar dependencias de las funciones
cd functions
npm install
cd ..
```

---

## 4) Logins necesarios

```powershell
# A) Firebase — abre el navegador, entrá con la cuenta dueña de kipo-d29af
firebase login

# (verificá que apunta al proyecto correcto)
firebase use kipo-d29af
```

- **Git:** el remote ya trae credenciales embebidas, así que `git push` debería funcionar sin login.
  - ⚠️ Por seguridad conviene **rotar el token de GitHub** (está en texto plano en `.git/config`). Si lo rotás, después configurás el remote nuevo con:
    `git remote set-url origin https://USUARIO:NUEVO_TOKEN@github.com/jnoriegav93/kipo.git`
- **Cuenta Google del CLI:** la misma que administra el proyecto Firebase `kipo-d29af`.

---

## 5) Comandos del día a día

```powershell
npm run build                                  # compilar el cliente (genera dist/)
firebase deploy --only hosting                 # subir la web (PWA)
firebase deploy --only firestore:rules         # subir reglas de Firestore
firebase deploy --only functions               # subir Cloud Functions
firebase deploy --only hosting,firestore:rules # combinar
```

Datos del proyecto:
- **Firebase project:** `kipo-d29af`
- **Hosting URL:** https://kipo-d29af.web.app
- **Stack:** React 19 + Vite 7 + Firebase 12 (Auth/Firestore/Storage) + Tailwind 3

---

## 6) Prompt para pegarle a Claude en la máquina nueva

> Estoy en una máquina nueva con el proyecto **app-fibra-pwa** (PWA "Kipo", Firebase project `kipo-d29af`). Stack: React 19 + Vite 7 + Firebase 12 + Tailwind 3; Cloud Functions en `functions/` (Node 24). Acabo de copiar la carpeta del proyecto pero todavía no instalé dependencias. Guiame paso a paso para dejarlo listo para build y deploy: verificá que estén Node, Git y Firebase CLI instalados, ayudame a correr `npm install` en raíz y en `functions/`, y a hacer `firebase login` y `firebase use kipo-d29af`. Después confirmá que `npm run build` compila y que puedo deployar con `firebase deploy --only hosting`. El build se sube a hosting sin necesidad de commitear. Tené en cuenta que la memoria del proyecto (MEMORY.md y notas) vive en la carpeta `.claude` del usuario y puede no estar en esta máquina — si no la tenés, pedímela o reconstruí contexto leyendo el código y este archivo SETUP_NUEVA_MAQUINA.md.

---

## 7) (Opcional) Llevar la "memoria" de Claude

El contexto que Claude recuerda del proyecto está en la carpeta personal del usuario, no en el proyecto. El nombre de la carpeta sale de la ruta del proyecto; para `C:\Users\USER\Documents\Kipo\kipo` es:

`C:\Users\<TU_USUARIO>\.claude\projects\c--Users-USER-Documents-Kipo-kipo\`

Desde el 24/09 lo importante ya viaja con git: las preferencias de trabajo están en `CLAUDE.md` ("Cómo trabaja el usuario") y el estado y las decisiones en `CONTEXTO.md`. Copiar la memoria es opcional.
