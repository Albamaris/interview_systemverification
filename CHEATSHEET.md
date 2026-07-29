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

**Ergebnis:** `git init/add/commit` erfolgreich. Nutzer hat den Standard-
Branch bewusst zu `master` umbenannt (statt `main`, alte Gewohnheit).

**Status:** ✅

---

## Schritt 13: Push zu GitHub

**Repo (vom Nutzer manuell angelegt):**
`https://github.com/Albamaris/interview_systemverification.git`

**Befehl (im Terminal ausgeführt):**
```
git branch -M main
git remote add origin https://github.com/Albamaris/interview_systemverification.git
git push -u origin main
```
→ tatsächlich als `master` gepusht (siehe oben).

⚠️ **Wichtige Korrektur:** Der Workflow-Trigger stand auf `branches: [ main ]`,
gepusht wurde aber auf `master` → Pipeline wäre NICHT automatisch gestartet.
Fix: `.github/workflows/ci.yml` auf `branches: [ master ]` angepasst,
committet und erneut gepusht.

**Merksatz fürs Interview:** Der CI-Trigger-Branch in der Workflow-Datei
muss exakt zum tatsächlichen Standard-Branch des Repos passen — ein
klassischer, leicht zu übersehener Stolperstein bei CI/CD-Setups.

**Ergebnis (GitHub Actions):**
```
Workflow: Gauge Playwright Tests #1
Status:   ✅ Success (52s)
Branch:   master
Commit:   02e6387 "Fix CI trigger branch to master"
```

**Status:** ✅ Kompletter Kreis geschlossen: lokal → Docker → GitHub Actions,
überall grün.

---

## Schritt 14: Scheduled Run ergänzen

**Ergänzung in `.github/workflows/ci.yml`:**
```yaml
on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:
```

**Warum:**
- `schedule` mit Cron-Syntax (`Minute Stunde Tag Monat Wochentag`, hier
  täglich 02:00 UTC) lässt die Pipeline **unabhängig von Code-Änderungen**
  laufen. Talking Point: Fängt Drift ab, den ein reiner Push-Trigger nicht
  sieht — z.B. ein Playwright-/Browser-Update, das plötzlich Locators
  bricht, oder eine Änderung auf der getesteten Ziel-Website selbst
  (typischer Grund für "nightly regression runs" in echten Projekten).
- `workflow_dispatch` (Bonus, oft zusammen mit `schedule` eingesetzt):
  erlaubt manuelles Auslösen über den "Run workflow"-Button im GitHub-
  Actions-Tab — praktisch, um den Cron-Job zu testen, ohne bis 02:00 Uhr
  zu warten.

**Hinweis:** GitHub Actions Cron-Zeiten sind IMMER UTC, nicht Lokalzeit —
bei 02:00 UTC im Sommer (MESZ, UTC+2) wäre das 04:00 Uhr deutscher Zeit.

**Befehl (im Terminal ausführen):**
```
git add .github/workflows/ci.yml
git commit -m "Add scheduled nightly run and manual trigger to CI pipeline"
git push
```

**Status:** ⏳ ausstehend — bitte Ergebnis mitteilen

---

## Schritt 15: Push-getriggerte Pipeline simulieren

**Ziel:** Den `on: push`-Trigger (seit Schritt 13 aktiv) bewusst live
durchspielen — ein Entwickler committet eine kleine Änderung, pusht, die
Pipeline startet automatisch (kein `workflow_dispatch`, kein `schedule`).

**Simulierte "Entwickler-Änderung":** Neues Szenario `Add multiple todo
items`, das zusätzlich Gauges **Tabellen-Parameter** demonstriert (bisher
nicht gezeigt — guter Bonus-Talking-Point).

**`specs/todo.spec`, neues Szenario:**
```markdown
## Add multiple todo items
* Open the todo app
* Add todos

   |description     |
   |-----------------|
   |Buy milk         |
   |Walk the dog     |
   |Clean the house  |

* Todo "Buy milk" should be visible
* Todo "Walk the dog" should be visible
* Todo "Clean the house" should be visible
```

**`tests/StepImplementation.ts`, neuer Step:**
```typescript
@Step("Add todos <table>")
public async addTodos(table: Table) {
    const input = this.page.getByPlaceholder("What needs to be done?");
    for (const row of table.getTableRows()) {
        await input.fill(row.getCell("description"));
        await input.press("Enter");
    }
}
```
(`Table` zusätzlich aus `"gauge-ts"` importiert.)

**Talking Point Tabellen:** Eine Markdown-Tabelle direkt unter einem Step
wird automatisch als `<table>`-Parameter erkannt — kein `<table>` im
Spec-Text nötig, nur in der `@Step(...)`-Signatur im Code. Gut für
datengetriebene Szenarien (mehrere Eingaben ohne Step-Wiederholung).

**Befehl (lokal testen, dann committen/pushen):**
```
gauge run --scenario "Add multiple todo items" specs/todo.spec
git add specs/todo.spec tests/StepImplementation.ts
git commit -m "Add table-driven scenario for multiple todos"
git push
```

**Danach:** Im Browser `.../actions` öffnen und beobachten, wie der neue
Lauf automatisch (Trigger-Spalte: "push", nicht "workflow_dispatch") startet
— das ist der eigentliche Beweis für den Push-getriggerten CI-Flow.

**Status:** ⏳ ausstehend — bitte lokales Testergebnis mitteilen

---

## Schritt 16: Volle Gauge-Stärke — ein Spec pro Test, im "Testmanager-Stil"

**Idee:** Statt einer kombinierten `todo.spec` jetzt EIN Spec-File pro
fachlichem Test, jeweils mit Tabellen für die Testdaten — genau die
Struktur, in der ein Test Manager (nicht-technisch) Specs schreiben würde,
während der Automatisierer (du) nur die Step-Implementierung liefert.

**Neue Struktur:**
```
specs/
  add_todo.spec        → "Add Todo Items"
  complete_todo.spec   → "Complete Todo Items"
  delete_todo.spec     → "Delete Todo Items"
```
(altes kombiniertes `specs/todo.spec` entfernt)

**`specs/add_todo.spec`:**
```markdown
# Add Todo Items

## Add todo items and verify they appear
* Open the todo app
* Add todos

   |description     |
   |-----------------|
   |Buy milk         |
   |Walk the dog     |
   |Clean the house  |

* Todos should be visible

   |description     |
   |-----------------|
   |Buy milk         |
   |Walk the dog     |
   |Clean the house  |
```

**`specs/complete_todo.spec`:**
```markdown
# Complete Todo Items

## Complete selected todo items
* Open the todo app
* Add todos

   |description     |
   |-----------------|
   |Buy milk         |
   |Walk the dog     |
   |Clean the house  |

* Complete todos

   |description     |
   |-----------------|
   |Buy milk         |
   |Clean the house  |

* Todos should be marked as completed

   |description     |
   |-----------------|
   |Buy milk         |
   |Clean the house  |

* Todos should not be marked as completed

   |description     |
   |-----------------|
   |Walk the dog     |
```

**`specs/delete_todo.spec`:**
```markdown
# Delete Todo Items

## Delete selected todo items
* Open the todo app
* Add todos

   |description     |
   |-----------------|
   |Buy milk         |
   |Walk the dog     |

* Delete todos

   |description     |
   |-----------------|
   |Buy milk         |

* Todos should not be visible

   |description     |
   |-----------------|
   |Buy milk         |

* Todos should be visible

   |description     |
   |-----------------|
   |Walk the dog     |
```

**Refaktorierte `tests/StepImplementation.ts`:** Private Helper-Methoden
(`addSingleTodo`, `assertVisible`, `assertNotVisible`, `completeSingle`,
`assertCompleted`, `assertNotCompleted`, `deleteSingle`, `todoItem`) sind
die EINE Quelle der Wahrheit. Sowohl die alten Einzel-Steps (`<item>`) als
auch die neuen Tabellen-Steps (`<table>`) rufen dieselben Helper auf —
keine Logik-Duplikation zwischen "ein Item" und "mehrere Items aus einer
Tabelle".

**Talking Points:**
- **Skalierbarkeit:** So wächst eine echte Testsuite — viele kleine,
  fachlich benannte Spec-Dateien, alle auf einer gemeinsamen,
  wiederverwendbaren Step-Bibliothek aufbauend.
- **Arbeitsteilung:** Der Test Manager kann `.spec`-Dateien und Tabellen
  direkt in Markdown pflegen/erweitern (neue Testdaten-Zeile = neuer
  Testfall), ohne den TypeScript-Code anzufassen — solange die
  Step-Texte zu vorhandenen Implementierungen passen.
- **DRY-Prinzip:** Private Helper vermeiden, dass jede `<table>`-Variante
  ihre eigene Kopie der Playwright-Logik hat.

**Befehl (im Terminal ausführen, lokal validieren):**
```
gauge run specs
```

**Ergebnis:** Grün. Struktur bestätigt.

**Status:** ✅ Ein Spec pro fachlichem Test, gemeinsame Step-Bibliothek

---

## Schritt 17: Datengetriebene Specs (Tabelle auf Spec-Ebene)

**Anfrage:** Muster wie
```
# Search the internet
|query    |
|---------|
|Cup Cakes|
|Star wars|
|Pies     |

## Look for things
* Search Google for <query>
```

**Wichtiger Unterschied zu Schritt 16:** Das ist eine ANDERE Gauge-Funktion
als die Inline-Step-Tabelle (`* Add todos` + `<table>`-Parameter):

| Muster | Wo die Tabelle steht | Was passiert |
|---|---|---|
| **Inline-Step-Tabelle** (Schritt 16) | Direkt unter einem `*`-Step | EIN Step-Aufruf bekommt die GANZE Tabelle als `Table`-Objekt; Schleife über Zeilen im Code |
| **Datengetriebene Spec** (dieser Schritt) | Direkt unter der `#`/`##`-Überschrift | Gauge wiederholt das GANZE Szenario automatisch einmal PRO ZEILE, ersetzt `<spalte>` in JEDEM Step — kein `Table`-Objekt, Steps bleiben einfache Einzelwert-Funktionen |

**Recherche vor der Umsetzung:** Live gegen DuckDuckGo getestet
(`https://duckduckgo.com/html/?q=...`) — Ergebnis: HTTP 202, Seite zeigt
sofort eine CAPTCHA-Challenge ("Select all squares containing a duck").
Bot-Erkennung, kein Playwright-Problem. Google verhält sich ähnlich oder
aggressiver. Diese CAPTCHA zu umgehen wurde bewusst NICHT versucht.

**Talking Point:** Reale Drittanbieter-Suchmaschinen sind für automatisierte
Tests grundsätzlich ungeeignet (Bot-Erkennung, CAPTCHAs, ToS, instabiles
UI) — in echten Projekten mockt/stubt man solche externen Abhängigkeiten
oder testet gegen eine eigene, kontrollierte Umgebung.

**Umgesetzt stattdessen mit der bewährten TodoMVC-Demo — identisches
Gauge-Feature, zuverlässiges Ziel (`specs/add_todo_data_driven.spec`):**
```markdown
# Add several todo items (data-driven)

|description     |
|-----------------|
|Buy milk         |
|Walk the dog     |
|Clean the house  |

## Add a todo item and verify it appears
* Open the todo app
* Add todo <description>
* Todo <description> should be visible
```
**Kein neuer Code nötig** — nutzt die längst vorhandenen Steps `Add todo
<item>` und `Todo <item> should be visible` direkt weiter. Gauge führt
dieses eine Szenario automatisch 3× aus (einmal pro Tabellenzeile).

**Befehl (im Terminal ausführen):**
```
gauge run specs/add_todo_data_driven.spec
```

**Ergebnis:** Grün, beide Läufe (`gauge run specs` und gezielt die
data-driven Spec). Nutzer-Fazit: Bei datengetriebenen Tabellen-Specs
bleiben, weil so auch Nicht-Programmierer die Tests in Gauge schreiben
und verstehen können — die eigentliche Ausführung passiert eine Ebene
tiefer in Playwright. Genau Gauges Kernversprechen.

**Status:** ✅ Alle drei Specs + data-driven Variante laufen grün

**Befehl (im Terminal ausführen, alles zusammen committen/pushen):**
```
git add specs tests/StepImplementation.ts
git status
git commit -m "Split specs per feature, add table-driven and data-driven examples"
git push
```

---

## Schritt 18: Komplett auf datengetriebene Specs umgestellt

**Entscheidung:** Inline-Step-Tabellen-Variante (Schritt 16) wieder verworfen
zugunsten von durchgängig datengetriebenen Specs (Schritt 17) — pro Zeile
ein vollständig unabhängiger Testfall (jedes Szenario startet ohnehin mit
frischer `Page`). Begründung des Nutzers: Nicht-Programmierer können
Tabellen auf Spec-Ebene direkt lesen/erweitern; die Ausführung passiert
unsichtbar eine Ebene tiefer in Playwright.

**Alte Dateien gelöscht:** `add_todo.spec`, `complete_todo.spec`,
`delete_todo.spec` (Inline-Tabellen-Version) sowie das Prototyp-File
`add_todo_data_driven.spec` (jetzt in `add_todo.spec` aufgegangen).

**`specs/add_todo.spec`:**
```markdown
# Add Todo Items

|description     |
|-----------------|
|Buy milk         |
|Walk the dog     |
|Clean the house  |

## Add a todo item and verify it appears
* Open the todo app
* Add todo <description>
* Todo <description> should be visible
```

**`specs/complete_todo.spec`** (zwei Spalten — zweite Spalte steuert eine
Bedingung im Step-Code):
```markdown
# Complete Todo Items

|description     |shouldComplete|
|-----------------|--------------|
|Buy milk         |true          |
|Walk the dog     |false         |

## Add a todo item and set its completion state
* Open the todo app
* Add todo <description>
* Set completed state of <description> to <shouldComplete>
* Completion state of <description> should be <shouldComplete>
```

**`specs/delete_todo.spec`:**
```markdown
# Delete Todo Items

|description     |
|-----------------|
|Buy milk         |
|Walk the dog     |

## Add and delete a todo item
* Open the todo app
* Add todo <description>
* Delete todo <description>
* Todo <description> should not be visible
```

**Neue/geänderte Steps in `tests/StepImplementation.ts`:**
```typescript
private toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`Expected "true" or "false", got: ${JSON.stringify(value)}`);
}

@Step("Set completed state of <item> to <state>")
public async setCompletedState(item: string, state: unknown) {
    if (this.toBoolean(state)) {
        await this.todoItem(item).getByRole("checkbox").check();
    }
}

@Step("Completion state of <item> should be <state>")
public async completionStateShouldBe(item: string, state: unknown) {
    if (this.toBoolean(state)) {
        await this.assertCompleted(item);
    } else {
        await this.assertNotCompleted(item);
    }
}
```

**Talking Points:**
- **`shouldComplete`-Spalte kommt als echter `boolean` an, nicht als String**
  — gauge-ts' `PrimitiveParser` konvertiert `"true"`/`"false"` automatisch
  (gleicher Mechanismus wie bei den Zahlen in Schritt 6/Bonus). `toBoolean()`
  validiert trotzdem explizit statt blind zu vertrauen — konsistent mit der
  robusten-Wait-Lektion.
- **Ein Test Manager könnte jetzt eine neue Zeile** (`|Buy bread|true|`) in
  `complete_todo.spec` ergänzen und hätte sofort einen neuen, vollständigen
  Testfall — ohne eine Zeile Code anzufassen.
- **Aufgeräumter Code:** Alle nicht mehr referenzierten Inline-Tabellen-Steps
  (`Add todos <table>`, `Complete todos <table>`, `Delete todos <table>`,
  `Todos should (not) be visible/completed <table>`) entfernt — toter Code
  vermieden.

**Befehl (im Terminal ausführen):**
```
gauge run specs
```

**Ergebnis:** Grün, committet und gepusht.

**Status:** ✅ Finale, konsequent datengetriebene Spec-Struktur steht

---

## Schritt 19: Jira-Rückverfolgbarkeit + Tag-Konvention

**Ziel:** Specs sollen aussehen wie in einem echten Projekt gepflegt — mit
Rückverfolgbarkeit zu Jira-Testfällen und einer durchdachten Tag-Struktur.
Keine echte Jira-API-Anbindung nötig, nur saubere Dokumentation über
Gauges eingebautes Tag-Feature (`tags: ...` direkt unter der Überschrift).

**Tag-Konvention (vier Kategorien):**
| Kategorie | Beispiel | Zweck |
|---|---|---|
| Jira-Rückverfolgbarkeit | `jira-QAT-101` | Verknüpfung zum Jira-Testfall/Story |
| Fachliches Modul | `todo`, `add`, `complete`, `delete` | Welcher Funktionsbereich |
| Test-Typ | `smoke`, `regression`, `functional` | Testebene/-zweck |
| Priorität | `P1`, `P2`, `P3` | Kritikalität |

**Angewendet (`tags:`-Zeile direkt nach der `#`-Überschrift, vor der Tabelle):**
```markdown
# Add Todo Items
tags: jira-QAT-101, todo, add, smoke, P1
...

# Complete Todo Items
tags: jira-QAT-102, todo, complete, regression, P2
...

# Delete Todo Items
tags: jira-QAT-103, todo, delete, regression, P2
...
```

**Talking Points:**
- **`jira-QAT-1xx` sind bewusst fiktive Platzhalter-IDs** — Muster ist
  identisch zu echten Jira-Keys (`PROJEKTKÜRZEL-NUMMER`), aber ohne
  Anbindung an eine echte Jira-Instanz. Im echten Projekt würde man hier
  die tatsächliche Story-/Testfall-ID eintragen.
- **Direkter Nutzen der Tags:** Filterbar über den schon bekannten
  `-t`/`--tags`-Flag (siehe Befehlsreferenz) — z.B. nur Smoke-Tests
  laufen lassen, oder gezielt den zu einem Jira-Ticket gehörenden Test:
  ```
  gauge run -t "smoke" specs
  gauge run -t "jira-QAT-102" specs
  ```
- **Skaliert gut:** Je mehr Specs dazukommen, desto wichtiger wird diese
  Struktur — z.B. "nur Regression vor einem Release" oder "nur P1" in
  der CI-Pipeline laufen lassen (`docker run ... gauge run -t "P1" specs`).

**Befehl (im Terminal ausführen, lokal validieren + Tag-Filter demonstrieren):**
```
gauge run specs
gauge run -t "smoke" specs
gauge run -t "jira-QAT-102" specs
```

**Status:** ⏳ ausstehend — bitte Ergebnis mitteilen

---

# Teil 7: Live-Coding-Übung (Simulation einer echten Interview-Aufgabe)

**Gestellte Aufgabe:** Neues Szenario "Todo-Eintrag löschen" ergänzen.
Das Lösch-Icon (×) erscheint auf der TodoMVC-Demo erst beim Hover über den
Eintrag.

**Eigene Recherche bestätigt (DOM-Inspektion via kleinem Node-Skript mit der
schon installierten Playwright-Lib):**
```html
<button aria-label="Delete" class="destroy"></button>
```
→ Locator: `getByRole("button", { name: "Delete" })` (matcht über
`aria-label`, das ist der "accessible name").

**Wichtiger Fund:** Der Button ist standardmäßig `display: none` (klassisches
TodoMVC-CSS), nicht nur `opacity: 0`. Playwrights `isVisible()`-Check
berücksichtigt `display`/Bounding-Box, aber NICHT `opacity`. Test bestätigt:
```
Visible BEFORE hover: false
Visible AFTER hover:  true
```
→ Der explizite `.hover()`-Step ist hier funktional notwendig, nicht nur
Show-Effekt — ohne Hover würde `.click()` auf den Button einen Timeout
werfen ("element is not visible"). Guter Talking Point: Playwrights
Actionability-Checks (visible, stable, enabled, receives events) sind genau
deshalb so wertvoll, weil sie solche UI-Fallstricke automatisch abfangen,
statt stumpf zu klicken.

**Erweiterte Spec (`specs/todo.spec`, neues Szenario):**
```markdown
## Delete a todo item
* Open the todo app
* Add todo "Buy milk"
* Hover over todo "Buy milk"
* Delete todo "Buy milk"
* Todo "Buy milk" should not be visible
```

**Erweiterte Step-Implementierung (`tests/StepImplementation.ts`):**
```typescript
    @Step("Hover over todo <item>")
    public async hoverOverTodo(item: string) {
        const todoItem = this.page.getByTestId("todo-item").filter({ hasText: item });
        await todoItem.hover();
    }

    @Step("Delete todo <item>")
    public async deleteTodo(item: string) {
        const todoItem = this.page.getByTestId("todo-item").filter({ hasText: item });
        await todoItem.getByRole("button", { name: "Delete" }).click();
    }

    @Step("Todo <item> should not be visible")
    public async todoShouldNotBeVisible(item: string) {
        const todo = this.page.getByTestId("todo-title").filter({ hasText: item });
        await todo.waitFor({ state: "hidden" });
        assert.ok(!(await todo.isVisible()));
    }
```

**Ergebnis:** Nutzer hat die Korrekturen (fehlender `Add todo`-Step, Tippfehler
"By Milk"/"Buy Milk") selbst umgesetzt.

**Bonus: npm-Scripts in `package.json` ergänzt** (bequemer Aufruf im Interview):
```json
"scripts": {
  "test": "gauge run specs",
  "docker:build": "docker build -t gauge-playwright-demo .",
  "docker:test": "docker run --rm gauge-playwright-demo"
}
```
→ Ab jetzt reicht `npm test` statt `gauge run specs` zu tippen — wirkt im
Interview routinierter und ist Standard in JS/TS-Projekten.

**Status:** ✅ Übung abgeschlossen — bereit für finalen Testlauf

---

## Bonus: VS Code Auto-Save fürs Live-Pairing

**Datei:** `.vscode/settings.json`
```json
{
  "files.autoSave": "onFocusChange"
}
```

**Warum:** Speichert automatisch, sobald der Editor den Fokus verliert
(z.B. Klick ins Terminal) — genau der Workflow im Interview: Code schreiben
→ ins Terminal wechseln → `npm test` ausführen, ohne vorher manuell
`Strg+S` zu drücken. Falls die Einstellung nicht sofort greift: VS-Code-
Fenster einmal neu laden.

**Status:** ⏳ ausstehend — bitte final `npm test` ausführen

---

## Bonus: Einzelnes Szenario gezielt ausführen

**Nach Zeilennummer** (Zeile der `##`-Überschrift):
```
gauge run specs/todo.spec:18
```

**Nach Szenario-Name** (Flag `--scenario`, oft praktischer im Interview,
weil Zeilennummern sich beim Editieren verschieben):
```
gauge run --scenario "Delete new todo item" specs/todo.spec
```

**Weitere nützliche Flags aus `gauge run --help`:**
| Flag | Zweck |
|---|---|
| `-t, --tags "tagname"` | Nur Szenarien mit bestimmtem Tag ausführen |
| `-f, --failed` | Nur die beim letzten Lauf fehlgeschlagenen Szenarien wiederholen |
| `-v, --verbose` | Step-Level-Reporting statt nur Szenario-Level (gut zum Debuggen live) |
| `-p, --parallel` | Parallele Ausführung |

**Status:** ✅

---

## Bonus: Warum `seconds: number` trotz String-Parameter funktioniert

Nachlauf-Frage aus der Praxis: `* Wait for "1" seconds` → Methode
`waitForSeconds(seconds: number)` — warum meldet TypeScript hier keinen
Typfehler, obwohl Gauge-Parameter eigentlich Strings aus der Spec-Datei sind?

**Antwort (verifiziert im gauge-ts-Quellcode, `node_modules/gauge-ts/dist/processors/params/`):**
`gauge-ts` besitzt eine `ParameterParsingChain` → `PrimitiveParser`, die JEDEN
rohen String-Parameter aus der Spec automatisch versucht in `number`/`boolean`
zu konvertieren (`Number(value)`, Finite-Check), BEVOR deine `@Step`-Methode
aufgerufen wird. Bei `"1"` wird daraus eine echte JS-`number` `1` — kein
Zufall durch `*`-Coercion, sondern aktive Konvertierung durch das Framework.

**Die eigentliche Typsicherheits-Lücke:** Der Methodenaufruf läuft über
generischen, zur Compile-Zeit ungetypten Dispatch (`executeMethod(instance,
method, params)`). TypeScript prüft Typen nur an Stellen, die es selbst zur
Compile-Zeit sieht — nicht bei Framework-seitigem Reflection-Aufruf. Würde
die Spec `* Wait for "abc" seconds` lauten, würde `Number("abc")` zu `NaN`
führen, der Primitive-Parser gäbe den rohen String `"abc"` zurück, und
`seconds` wäre zur Laufzeit ein String — trotz `number`-Annotation. Das kann
TypeScript nie verhindern, weil die `.spec`-Datei außerhalb seines
Sichtfelds liegt.

**Talking Point (gilt genauso für Cucumber & Co.):** Typsicherheit endet an
der Grenze zwischen typisiertem Step-Code und der untypisierten,
text-basierten Spezifikation — Laufzeit-Parsing/Validierung im Framework
ersetzt dort, was der Compiler nicht leisten kann.

---

## Bonus: Der "abc"-Test — ein stiller Fehler statt eines Crashs

**Live ausprobiert:** `* Wait for "abc" seconds` (dreimal im Szenario platziert)
lief GRÜN durch (`P P P P P P P P P`, 3.701s total), obwohl `"abc"` keine
gültige Zahl ist. Wurde die vorhin beschriebene Typsicherheits-Lücke also
widerlegt? Nein — sie zeigt sich nur ANDERS als erwartet: nicht als Fehler,
sondern als lautlos falsches Verhalten.

**Nachvollzogen mit einem Mini-Node-Test:**
```javascript
const seconds = "abc";
console.log(seconds * 1000);       // NaN
setTimeout(() => console.log("resolved"), seconds * 1000);
// → resolved nach ~11ms, KEIN Fehler
```

**Kausalkette:**
1. `Number("abc")` → `NaN`, nicht finite → Gauges `PrimitiveParser` gibt den
   rohen String `"abc"` zurück (keine Konvertierung).
2. Methode bekommt `seconds = "abc"` (String, trotz `number`-Signatur).
3. `"abc" * 1000` → `NaN`.
4. `page.waitForTimeout(NaN)` → intern `setTimeout(fn, NaN)` → Node klemmt
   ungültige Delays auf ~1ms — **kein Fehler, aber auch keine echte Wartezeit**.

**Warum das der gefährlichere Fall ist:** Ein Crash wäre sofort sichtbar
gewesen. Hier zeigt Gauge `P P P P P P P P P` — scheinbar alles korrekt —
obwohl drei der neun Steps de facto nichts bewirkt haben. Das ist ein
Paradebeispiel für "grüner Test ≠ Test prüft/tut das Richtige".

**Talking Point fürs Interview:** Genau deshalb rät Playwright grundsätzlich
von expliziten `waitForTimeout`-Wartezeiten zur Synchronisation ab (siehe
Schritt 6, "Auto-Waiting") — sie können bei ungültigen/unerwarteten Werten
lautlos ins Leere laufen, statt einen Fehler zu erzwingen. Ein `waitFor({
state: ... })` auf einem echten Locator hätte bei einem kaputten Zustand
wenigstens einen ehrlichen Timeout-Fehler geworfen.

---

## Bonus: Robustes Wait — den stillen Fehler laut machen

**Fix in `tests/StepImplementation.ts`:**
```typescript
@Step("Wait for <seconds> seconds")
public async waitForSeconds(seconds: unknown) {
    const value = typeof seconds === "number" ? seconds : Number(seconds);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`"Wait for <seconds> seconds" expects a non-negative number, got: ${JSON.stringify(seconds)}`);
    }
    await this.page.waitForTimeout(value * 1000);
}
```

**Was sich ändert:**
| Vorher | Nachher |
|---|---|
| `seconds: number` — Lüge zur Laufzeit, Gauge garantiert das nicht | `seconds: unknown` — ehrlich zur tatsächlichen Unsicherheit |
| `seconds * 1000` direkt, kein Check | Erst prüfen: ist es (nach Konvertierung) eine endliche, nicht-negative Zahl? |
| Bei `"abc"` → `NaN` → `setTimeout` lautlos ~0ms | Bei `"abc"` → expliziter, sprechender `Error` — Test schlägt sichtbar fehl |

**Talking Point:** Das ist das allgemeine Muster gegen die Typsicherheits-
Lücke an der Spec↔Code-Grenze: Werte aus der Spec-Datei so behandeln, als
kämen sie von einer nicht vertrauenswürdigen externen Quelle (Validierung
an der Grenze), statt der TS-Signatur blind zu vertrauen.

---

## Bonus: Headed-Modus für die Live-Demo umschaltbar machen

`headless: true` war hart im Code verdrahtet. Für eine visuelle Demo im
Interview (Browser sichtbar statt unsichtbar) jetzt per Umgebungsvariable
steuerbar, ohne Code zu ändern:

**`tests/StepImplementation.ts`, Zeile in `beforeSuite()`:**
```typescript
this.browser = await chromium.launch({ headless: process.env.HEADLESS !== "false" });
```

**Aufruf (PowerShell-Syntax!):**
```powershell
$env:HEADLESS="false"; gauge run --scenario "Delete new todo item" specs/todo.spec
```
Ohne gesetzte Variable (Standardfall, z.B. in Docker/CI) bleibt es headless.

**Merksatz:** PowerShell setzt Umgebungsvariablen anders als bash
(`$env:VAR="wert"` statt `VAR=wert`) — im Interview evtl. relevant, falls
im geteilten Terminal nach der Syntax gefragt wird.

**Status:** ✅
