# Cheat Sheet: Gauge + Playwright + Docker Framework
Interview-Vorbereitung — Schritt-für-Schritt-Protokoll

Ziel: Ein minimales, aber vollständiges Test-Framework mit Gauge (Spezifikation) +
Playwright (Browser-Automatisierung) + Docker (reproduzierbare Umgebung), das ich
im Interview live nachbauen kann.

---

## Schritt 1: Node.js Version prüfen

**Befehl (im Terminal ausführen):**
```
node -v
npm -v
```

**Warum:** Gauge und Playwright brauchen Node.js. Für Playwright wird aktuell
Node 18, 20 oder 22 empfohlen. Falls eine sehr alte Version installiert ist,
kann es zu Problemen bei der Installation kommen.

**Ergebnis:**
```
node -v  → v22.14.0
npm -v   → 11.1.0
```

**Status:** ✅ erledigt — aktuelle Versionen, kein Handlungsbedarf.

---

## Schritt 2: Gauge CLI installieren

**Befehl (im Terminal ausführen):**
```
npm install -g @getgauge/cli
gauge version
```

**Warum:** Gauge ist kein npm-Paket im klassischen Sinn, sondern ein eigenständiges
CLI-Tool (Go-Binary). Der `@getgauge/cli`-npm-Wrapper lädt und installiert das
passende Binary automatisch — das ist der einfachste Weg unter Windows, ohne
Chocolatey oder manuellen Installer.

`gauge version` sollte danach u.a. anzeigen, welche Sprachen-Plugins (z.B.
`js`) bereits vorhanden sind — bei einer Neuinstallation meist noch keine,
das installieren wir in Schritt 3.

**Ergebnis:** `npm install` lief durch ("changed 2 packages"), aber `gauge version`
zeigt keine Ausgabe — stattdessen öffnet sich kurz ein Terminal-Fenster und
schließt sich sofort wieder. Das deutet auf ein PATH-Problem oder einen
Namenskonflikt mit einem anderen `gauge`-Programm hin, nicht auf einen
Gauge/Playwright-Fehler.

**Status:** 🔍 wird diagnostiziert (siehe Schritt 2b)

---

## Schritt 2b: Diagnose — welches "gauge" wird ausgeführt?

**Befehle (im Terminal ausführen):**
```
where gauge
npm config get prefix
```

**Warum:**
- `where gauge` listet ALLE `gauge`-Programme, die in deinem PATH gefunden
  werden — der Effekt "Fenster öffnet und schließt sofort" deutet oft darauf
  hin, dass es ein anderes Programm namens `gauge.exe` auf dem System gibt
  (z.B. ein Hardware-Monitoring-Tool), das VOR dem npm-Gauge in der PATH-
  Reihenfolge gefunden wird.
- `npm config get prefix` zeigt, wo npm globale Pakete installiert (meist
  `%AppData%\npm`). Dort sollte eine `gauge.cmd` liegen.

**Ergebnis:** `where gauge` → keine Treffer (Gauge nicht im PATH).
`npm config get pefix` → Tippfehler (pefix statt prefix), daher `undefined`.

**Status:** 🔍 weiter diagnostizieren

---

## Schritt 2c: npm-Installationsort prüfen

**Befehle (im Terminal ausführen):**
```
npm config get prefix
dir "$(npm config get prefix)"
```

**Warum:** Wir wollen sehen, ob im npm-Global-Ordner überhaupt eine
`gauge.cmd` / `gauge.ps1` / `gauge` Datei liegt. Falls ja → reines PATH-Problem
(Ordner fehlt in der PATH-Umgebungsvariable, oder das Terminal muss neu
gestartet werden). Falls nein → die Installation von `@getgauge/cli` ist
fehlgeschlagen (Postinstall-Download der Gauge-Binary hat evtl. nicht
funktioniert, z.B. durch Firewall/Proxy) und wir installieren neu.

**Ergebnis:** `gauge`, `gauge.cmd`, `gauge.ps1` liegen im npm-Global-Ordner
(gleicher Ordner wie `npm`, `npx`, funktionieren nachweislich). PATH ist also
korrekt — kein PATH-Problem.

⚠️ Korrektur zu Schritt 2b: `where gauge` lieferte nichts, weil `where` in
PowerShell ein **Alias für `Where-Object`** ist, nicht das echte `where.exe`.
Das war ein Diagnose-Holzweg meinerseits, keine echte Fehlermeldung.

**Status:** ✅ Datei vorhanden — weiter zur eigentlichen Ursache des
"Fenster blitzt auf"-Verhaltens

---

## Schritt 2d: Fehlerausgabe von `gauge version` sichtbar machen

**Befehl (im Terminal ausführen):**
```
gauge version *> gauge_version_output.txt
type gauge_version_output.txt
```

**Warum:** `*>` leitet in PowerShell ALLE Ausgabeströme (normale Ausgabe UND
Fehlermeldungen) in eine Datei um. Falls das kurz aufblitzende Fenster ein
Absturz der eigentlichen Gauge-Binary ist (z.B. weil der Download der
Gauge-Core-Engine beim `npm install` durch Firewall/Antivirus blockiert
wurde), sehen wir die genaue Fehlermeldung jetzt in der Datei, statt dass
sie im geschlossenen Fenster verschwindet.

**Ergebnis:** Auch mit Umleitung in eine Datei — komplett keine Ausgabe,
kein Fehlertext. Das schließt eine "normale" Fehlermeldung aus.

**Status:** 🔍 Ursache im Installationsordner selbst gefunden (Schritt 2e)

---

## Schritt 2e: Root Cause gefunden

**Befund (durch Inspektion des npm-Installationsordners):**
```
.../node_modules/@getgauge/cli/bin/
  gauge           ← 0 Bytes, LEERE Platzhalter-Datei
  gauge.exe       ← 24,8 MB, DIE ECHTE Gauge-Binary (korrekt heruntergeladen!)
  DO_NOT_DELETE.txt  → Inhalt: "Required for npm install"
```

Der Windows-Shim `gauge.cmd` ruft auf: `"...\bin\gauge"   %*` — **ohne**
Dateiendung. Normalerweise würde Windows dann automatisch `.exe` ergänzen
(PATHEXT-Mechanismus). Weil aber zusätzlich eine leere Datei namens exakt
`gauge` (ohne Endung) im selben Ordner liegt, findet Windows diese exakte
Datei zuerst und versucht sie auszuführen — sie ist aber leer/keine gültige
Anwendung → sofortiger, stiller Abbruch ("Fenster blitzt auf und schließt").

**Wichtig:** Die eigentliche Installation ist NICHT kaputt — die 24-MB-
`gauge.exe` ist korrekt da. Es ist nur der Windows-Startmechanismus, der auf
die falsche Datei zeigt.

**Status:** ✅ Ursache identifiziert — weiter zu Schritt 2f (Workaround testen)

---

## Schritt 2f: Direkt die echte gauge.exe testen

**Befehl (im Terminal ausführen):**
```
& "$env:APPDATA\npm\node_modules\@getgauge\cli\bin\gauge.exe" version
```

**Warum:** Das umgeht den kaputten Shim komplett und ruft die echte Binary
direkt auf. Wenn das funktioniert, wissen wir sicher: Gauge selbst ist
korrekt installiert, wir müssen nur dafür sorgen, dass `gauge` im Terminal
künftig auf `gauge.exe` zeigt.

**Ergebnis:**
```
Gauge version: 1.6.35
Commit Hash: e967358

Plugins
-------
html-report (4.4.0)
screenshot (0.3.2)
ts (0.3.5)
```
Gauge läuft. Bonus: Ein `ts`-Plugin (TypeScript) ist schon installiert —
das nutzen wir später, da Playwright ohnehin exzellenten TS-Support hat.

**Status:** ✅ gauge.exe funktioniert direkt — Shim-Problem wird jetzt fixiert

---

## Schritt 2g: Startmechanismus dauerhaft reparieren

**Befehl (im Terminal ausführen):**
```
Rename-Item "$env:APPDATA\npm\node_modules\@getgauge\cli\bin\gauge" "$env:APPDATA\npm\node_modules\@getgauge\cli\bin\gauge.placeholder.bak"
gauge version
```

**Warum:** Wir benennen die leere Platzhalter-Datei nur um (nicht löschen —
reversibel, falls doch mal benötigt). Danach existiert am Zielpfad keine
Datei mehr namens exakt `gauge` ohne Endung, sodass Windows automatisch
über PATHEXT die echte `gauge.exe` findet, wenn der Shim `gauge.cmd`
aufgerufen wird. Der ganz normale Befehl `gauge` sollte danach im Terminal
funktionieren — genau wie im Interview erwartet.

**Hinweis:** Falls `@getgauge/cli` später per `npm update`/Neuinstallation
aktualisiert wird, legt npm die Platzhalter-Datei automatisch neu an —
dann ggf. diesen Schritt wiederholen.

**Ergebnis:** `gauge version` läuft jetzt direkt, ohne vollen Pfad. ✅

**Status:** ✅ Gauge CLI vollständig einsatzbereit

---

# Teil 2: Gauge-Projekt initialisieren

## Schritt 3: Gauge-Projekt mit TypeScript-Template erstellen

**Befehl (im aktuellen Ordner `c:\Playwright_Interview_SystemVericication` ausführen):**
```
gauge init ts
```

**Warum:** `gauge init <template>` erzeugt ein lauffähiges Grundgerüst.
Wir nutzen das `ts`-Template (TypeScript), weil das Plugin schon installiert
ist (siehe Schritt 2) und weil Playwright ohnehin nativ in TypeScript
geschrieben ist — im Interview wirkt das stimmig aus einem Guss.

**Was danach neu im Ordner liegt (grob):**
```
manifest.json          → definiert die Sprache (ts) und Plugins
env/default/            → Umgebungs-Properties (z.B. Timeouts)
specs/example.spec     → Beispiel-Spezifikation (Markdown)
testConfig/ts/ (o.ä.)  → Step-Implementierungen in TypeScript
package.json           → npm-Projekt inkl. gauge-ts als Dev-Dependency
tsconfig.json
node_modules/
```

**Ergebnis:** Projekt erfolgreich initialisiert. Struktur:
```
manifest.json              → { "Language": "ts", "Plugins": ["html-report"] }
env/default/               → default.properties, ts.properties
specs/example.spec         → Beispiel-Spec (Todo-App, nutzt "Taiko")
tests/StepImplementation.ts → Step-Code (nutzt "Taiko", nicht Playwright!)
package.json                → deps: gauge-ts, ts-node, typescript, taiko
```
npm-audit-Warnungen (7 vulnerabilities) betreffen nur `taiko`/`documentation`
als transitive Dev-Dependencies — unkritisch, kein Fix nötig.

**Wichtige Erkenntnis:** Das Standard-Template nutzt **Taiko**
(ein Browser-Automatisierungs-Tool, ebenfalls von ThoughtWorks, "Bruder" von
Gauge) — NICHT Playwright! Das tauschen wir jetzt aus.

**Status:** ✅ Projektgerüst steht

---

# Teil 3: Taiko durch Playwright ersetzen

## Schritt 4: Taiko entfernen, Playwright installieren

**Befehl (im Terminal ausführen):**
```
npm uninstall taiko
npm install playwright
npx playwright install chromium
```

**Warum:**
- `npm uninstall taiko` entfernt die Taiko-Bibliothek UND den riesigen
  mitgelieferten Chromium-Ordner (spart Platz, vermeidet Verwechslung).
- `npm install playwright` installiert die Playwright-Bibliothek als
  normales npm-Paket (nicht `@playwright/test` — das wäre Playwrights
  EIGENER Test-Runner, den wir hier nicht brauchen, weil **Gauge** unser
  Runner ist. Wir nutzen Playwright nur als Automatisierungs-Bibliothek
  innerhalb der Gauge-Steps — genau wie man in Java-Welt Selenium/Playwright
  als Library in JUnit-Steps einbindet).
- `npx playwright install chromium` lädt die Browser-Binary herunter, die
  Playwright zum Steuern von Chrome/Chromium braucht. Wir installieren nur
  Chromium (nicht auch Firefox/WebKit), um Zeit/Bandbreite zu sparen — für
  die Live-Aufgabe morgen reicht ein Browser.

**Ergebnis:** `npm uninstall taiko`, `npm install playwright`,
`npx playwright install chromium` erfolgreich durchgelaufen.

**Nebenbefund:** VS Code zeigte in `tsconfig.json` eine Deprecation-Warnung:
`moduleResolution=node10 is deprecated ... stop functioning in TypeScript 7.0`.
Das ist der alte `"node"`-Resolutionsmodus (von TS intern in "node10"
umbenannt), der irgendwann entfernt wird — kein aktueller Fehler. Um das
Template nicht unnötig zu verändern (kein Risiko am Vorabend des Interviews),
haben wir nur die Warnung stummgeschaltet statt die Resolution-Logik
umzustellen:
```json
"moduleResolution": "node",
"ignoreDeprecations": "6.0",
```

**Status:** ✅ Playwright installiert, Chromium heruntergeladen

---

# Teil 4: Spec + Step-Implementierung schreiben

## Schritt 5: Die Spezifikation (`specs/todo.spec`)

Alte `specs/example.spec` (Taiko-basiert) gelöscht, neue Datei angelegt.
Zielseite: **https://demo.playwright.dev/todomvc** — das ist die offizielle
TodoMVC-Demo, die Playwright selbst in seiner eigenen Dokumentation für
Beispieltests verwendet. Gute Wahl fürs Interview: Der technische
Interviewer (Playwright-Erfahrung) erkennt sie vermutlich sofort.

```markdown
# Todo Application

Einfache Beispiel-Spezifikation gegen die offizielle Playwright-TodoMVC-Demo
(https://demo.playwright.dev/todomvc). Jede Überschrift (##) ist ein
Szenario, jeder Bullet-Point (*) ist ein Step.

## Add a new todo item
* Open the todo app
* Add todo "Buy milk"
* Todo "Buy milk" should be visible

## Complete a todo item
* Open the todo app
* Add todo "Clean the house"
* Mark todo "Clean the house" as done
* Todo "Clean the house" should be marked as completed
```

**Kernidee zum Erklären im Interview:** Gauge trennt WAS (Spec, lesbar für
Nicht-Techniker — die Sales-Perspektive!) von WIE (Step-Implementierung,
Code). Genau das ist der große Vorteil ggü. reinem Playwright-Test.

---

## Schritt 6: Die Step-Implementierung (`tests/StepImplementation.ts`)

```typescript
import { Step, BeforeSuite, AfterSuite, BeforeScenario, AfterScenario } from "gauge-ts";
import { chromium, Browser, Page } from "playwright";
import assert = require("assert");

export default class StepImplementation {
    private browser!: Browser;
    private page!: Page;

    @BeforeSuite()
    public async beforeSuite() {
        this.browser = await chromium.launch({ headless: true });
    }

    @AfterSuite()
    public async afterSuite() {
        await this.browser.close();
    }

    @BeforeScenario()
    public async beforeScenario() {
        this.page = await this.browser.newPage();
    }

    @AfterScenario()
    public async afterScenario() {
        await this.page.close();
    }

    @Step("Open the todo app")
    public async openTodoApp() {
        await this.page.goto("https://demo.playwright.dev/todomvc");
    }

    @Step("Add todo <item>")
    public async addTodo(item: string) {
        const input = this.page.getByPlaceholder("What needs to be done?");
        await input.fill(item);
        await input.press("Enter");
    }

    @Step("Todo <item> should be visible")
    public async todoShouldBeVisible(item: string) {
        const todo = this.page.getByTestId("todo-title").filter({ hasText: item });
        await todo.waitFor({ state: "visible" });
        assert.ok(await todo.isVisible());
    }

    @Step("Mark todo <item> as done")
    public async markTodoAsDone(item: string) {
        const todoItem = this.page.getByTestId("todo-item").filter({ hasText: item });
        await todoItem.getByRole("checkbox").check();
    }

    @Step("Todo <item> should be marked as completed")
    public async todoShouldBeCompleted(item: string) {
        const todoItem = this.page.getByTestId("todo-item").filter({ hasText: item });
        const classAttr = await todoItem.getAttribute("class");
        assert.ok(classAttr?.includes("completed"));
    }
}
```

**Erklärung, Zeile für Zeile — das ist dein Talking-Point-Material fürs Interview:**

| Konzept | Wo im Code | Was du dazu sagen kannst |
|---|---|---|
| **Hooks** | `@BeforeSuite`/`@AfterSuite` | Browser wird EINMAL für die ganze Suite gestartet/geschlossen — spart Zeit ggü. Neustart pro Test |
| **Test-Isolation** | `@BeforeScenario`/`@AfterScenario` | Pro Szenario ein NEUER `Page`-Kontext — verhindert, dass Zustand (z.B. Cookies, offene Todos) zwischen Tests durchsickert. Best Practice in Playwright |
| **Headless** | `headless: true` | Für CI/Docker schneller & ohne UI. Für eine Live-Demo im Interview kannst du kurz auf `false` umstellen, damit der Browser sichtbar aufpoppt |
| **Locators statt CSS-Selektoren** | `getByPlaceholder`, `getByTestId`, `getByRole` | Genau der Playwright-Best-Practice-Punkt: rollen-/nutzer-basierte Locators statt brüchiger `div.class > span:nth-child(2)`-Selektoren |
| **Auto-Waiting** | `.fill()`, `.press()`, `.check()`, `.waitFor()` | Playwright wartet automatisch, bis das Element interagierbar ist — kein `sleep()`, kein manuelles Polling |
| **Parametrisierte Steps** | `<item>` in Spec ↔ `item: string` im Code | Gauge übergibt den Text aus der Spec direkt als Funktionsparameter |
| **Assertions** | `assert.ok(...)` | Hier simpel mit Node's `assert`. Talking Point: Mit `@playwright/test` gäbe es zusätzlich `expect(locator).toBeVisible()` mit eingebautem Retry — kann man erwähnen, auch ohne es hier einzusetzen |

**Status:** ✅ Spec + Step-Implementierung geschrieben

---

## Schritt 7: Framework lokal ausführen

**Befehl (im Terminal ausführen):**
```
gauge run specs
```

**Warum:** Führt alle `.spec`-Dateien im `specs/`-Ordner aus. Gauge findet
automatisch die Step-Implementierung in `tests/StepImplementation.ts`
(über `manifest.json` → `"Language": "ts"`) und matcht die `@Step(...)`-Texte
gegen die Bullet-Points in der Spec.

**Ergebnis:**
```
# Todo Application
  ## Add a new todo item         P P P
  ## Complete a todo item        P P P P

Specifications: 1 executed      1 passed        0 failed        0 skipped
Scenarios:      2 executed      2 passed        0 failed        0 skipped
Total time taken: 12.16s
```
**Was bedeutet `P P P`?** Gauge druckt im Simple-Reporter-Modus pro **Step**
(nicht pro Szenario) ein Zeichen: `P` = Pass. "Add a new todo item" hat 3
Steps → `P P P`; "Complete a todo item" hat 4 Steps → `P P P P`. Bei einem
fehlschlagenden Step stünde dort `F`, mit Stacktrace-Details direkt darunter
— zeigt exakt, an welchem Step es hakt.

Beide Szenarien grün beim ersten Versuch — HTML-Report liegt unter
`reports/html-report/index.html` (guter Talking Point: Gauge generiert
automatisch einen Report, den man z.B. auch in Jenkins/GitHub Actions als
Artefakt ablegen kann).

**Status:** ✅ Framework läuft lokal grün — Kernaufgabe erledigt

---

# Teil 5: Docker

## Schritt 8: Docker-Voraussetzung

**Ergebnis:** Docker Desktop ist installiert und läuft (vom Nutzer bestätigt).

**Status:** ✅

---

## Schritt 9: Dockerfile schreiben

Installierte Playwright-Version geprüft (`node_modules/playwright/package.json`)
→ **1.62.0**. Wichtig: Das Docker-Image muss zur exakt gleichen Version
passen, sonst driften Browser-Binary (im Image) und Playwright-Client-Library
(im Code) auseinander — genau der Grund, warum Docker im Interview als Thema
drankommt ("reproduzierbare Umgebung").

**`Dockerfile`:**
```dockerfile
FROM mcr.microsoft.com/playwright:v1.62.0-noble

WORKDIR /app

RUN npm install -g @getgauge/cli && gauge install ts

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["gauge", "run", "specs"]
```

**Erklärung, Zeile für Zeile:**
| Zeile | Warum |
|---|---|
| `FROM mcr.microsoft.com/playwright:v1.62.0-noble` | Offizielles Microsoft-Image: Node.js + alle Browser (Chromium/Firefox/WebKit) + alle System-Bibliotheken sind schon vorinstalliert — die Versionsnummer im Tag MUSS zur `playwright`-Version in `package.json` passen |
| `RUN npm install -g @getgauge/cli && gauge install ts` | Gauge selbst ist NICHT im Playwright-Image enthalten (das Image kennt nur Playwright) — Gauge-CLI + TypeScript-Plugin müssen wir selbst nachinstallieren |
| `COPY package*.json ./` + `RUN npm ci` | Erst nur die Manifest-Dateien kopieren, dann installieren — nutzt Docker-Layer-Caching: Bei Codeänderungen (ohne Dependency-Änderung) muss dieser teure Schritt nicht wiederholt werden |
| `COPY . .` | Restlichen Projekt-Code (Specs, Steps) erst danach kopieren |
| `CMD ["gauge", "run", "specs"]` | Standard-Befehl beim Containerstart — führt genau das aus, was wir eben lokal manuell gemacht haben |

**`.dockerignore`:** schließt `node_modules`, `reports`, temporäre Dateien
vom Build-Kontext aus (schneller Build, kein Windows-`node_modules`
versehentlich im Linux-Container).

**Hinweis:** Falls der Tag `v1.62.0-noble` beim Pull nicht gefunden wird
(Microsoft könnte selten mal eine OS-Codename ändern), einfach `-jammy`
statt `-noble` probieren, oder auf https://mcr.microsoft.com nachsehen.

**Status:** ⏳ ausstehend — bitte Build testen (Schritt 10)

---

## Schritt 10: Image bauen und Container ausführen

**Befehl (im Terminal ausführen):**
```
docker build -t gauge-playwright-demo .
docker run --rm gauge-playwright-demo
```

**Warum:**
- `docker build -t gauge-playwright-demo .` baut das Image anhand des
  Dockerfiles im aktuellen Ordner und gibt ihm einen lesbaren Namen (Tag).
- `docker run --rm gauge-playwright-demo` startet einen Container aus
  diesem Image, führt `CMD` (also `gauge run specs`) aus und löscht den
  Container danach automatisch wieder (`--rm`) — sauber für wiederholte
  Testläufe.

**Ergebnis:**
```
Compatible version of plugin html-report not found. Installing plugin html-report...
Successfully installed plugin 'html-report' version 4.4.6
Successfully installed plugin 'screenshot' version 1.0.2

# Todo Application
  ## Add a new todo item         ✔ ✔ ✔
  ## Complete a todo item        ✔ ✔ ✔ ✔

Specifications: 1 executed      1 passed        0 failed        0 skipped
Scenarios:      2 executed      2 passed        0 failed        0 skipped
```
Image-Build + Containerlauf liefen im ersten Anlauf grün. Der Container hat
sich beim ersten Start automatisch die im Linux-Image (noch) fehlenden
Plugin-Versionen nachgezogen (`html-report`, `screenshot`) — das ist normal,
Plugins werden pro Sprach-/OS-Kombination separat verwaltet. Ergebnis:
gleicher Code → gleiches grünes Ergebnis lokal UND im Container. Das ist
genau der Kern-Talking-Point für "Docker = reproduzierbare Umgebung".

**Status:** ✅ Framework läuft vollständig in Docker

---

# Teil 6: CI/CD mit GitHub Actions

## Schritt 11: Workflow-Datei (`.github/workflows/ci.yml`)

```yaml
name: Gauge Playwright Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t gauge-playwright-demo .

      - name: Run tests in container
        run: docker run --rm -v ${{ github.workspace }}/reports:/app/reports gauge-playwright-demo

      - name: Upload HTML report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: gauge-html-report
          path: reports/html-report
```

**Erklärung — Pipeline-Logik zum Erklären im Interview:**
| Schritt | Was passiert |
|---|---|
| `on: push` / `pull_request` | Läuft bei jedem Push auf `main` und bei jedem PR gegen `main` — verhindert, dass kaputte Änderungen ungetestet gemergt werden |
| `actions/checkout@v4` | Holt den Repo-Code auf den GitHub-Runner |
| `docker build` | Baut EXAKT das gleiche Image, das wir eben lokal gebaut haben — Build → Test-Umgebung ist identisch zu lokal |
| `docker run` mit Volume-Mount auf `reports/` | Führt `gauge run specs` im Container aus (siehe `Dockerfile` `CMD`); der Report landet dank Volume-Mount auch auf dem Runner-Dateisystem, nicht nur im (danach gelöschten) Container |
| `upload-artifact` mit `if: always()` | Lädt den HTML-Report als Artefakt hoch — auch wenn Tests fehlschlagen (wichtig fürs Debugging in der Pipeline) |

**Talking Point:** Das ist bewusst die GENAU GLEICHE Kommandokette wie lokal
(`docker build` + `docker run`) — keine Parallel-Logik, die auseinanderlaufen
könnte. "Es läuft lokal genauso wie in CI" ist eines der stärksten Argumente
für Docker in Pipelines.

**Status:** ✅ Workflow-Datei geschrieben

---

## Schritt 12: Git-Repo lokal vorbereiten

**Befehl (im Terminal ausführen):**
```
git init
git add .
git commit -m "Gauge + Playwright + Docker demo framework"
```

**Warum:** `.gitignore` existiert schon (aus dem Gauge-Template, ergänzt um
`gauge_version_output.txt`) — `node_modules`, `reports`, Gauge-Metadaten
werden also automatisch NICHT committet.

**Status:** ⏳ ausstehend — bitte Ergebnis mitteilen
