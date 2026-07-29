# Gauge + Playwright + Docker — Interview Cheat Sheet
**Interview: 30.07.2026, 15:00 Uhr — Michael Lucas (Consultant Manager) & Micha Schulz (Sales Manager)**

Ziel: Frontend-Testautomatisierung mit Gauge (Spec) + Playwright (Automatisierung) + Docker (reproduzierbare Umgebung), live nachbaubar.

---

## 1. Setup-Sequenz (von Null zum laufenden Framework)

```powershell
# 1. Voraussetzungen prüfen
node -v
npm -v

# 2. Gauge installieren
npm install -g @getgauge/cli
gauge version

# 3. Projekt anlegen (TypeScript-Template)
gauge init ts

# 4. Taiko raus, Playwright rein
npm uninstall taiko
npm install playwright
npx playwright install chromium

# 5. Framework lokal ausführen
gauge run specs
# oder kurz, falls npm-Script vorhanden:
npm test

# 6. Docker
docker build -t gauge-playwright-demo .
docker run --rm gauge-playwright-demo

# 7. CI/CD
git init
git add .
git commit -m "..."
git remote add origin <repo-url>
git push -u origin master   # Branch-Name im Workflow-Trigger muss passen!
```

**Windows-Stolperstein (falls `gauge version` nach der Installation ein
Fenster aufblitzen lässt und nichts tut):** Der npm-Installer legt unter
`%AppData%\npm\node_modules\@getgauge\cli\bin\` eine leere Platzhalter-Datei
`gauge` (ohne Endung) NEBEN der echten `gauge.exe` ab. Windows findet die
leere Datei zuerst statt automatisch `.exe` zu ergänzen. Fix: die leere
Datei umbenennen (`Rename-Item ... gauge.placeholder.bak`).

---

## 2. Finale Spec-Struktur — ein datengetriebenes File pro fachlichem Test

```
specs/
  add_todo.spec        → "Add Todo Items"
  complete_todo.spec   → "Complete Todo Items"
  delete_todo.spec     → "Delete Todo Items"
```
Zielseite: `https://demo.playwright.dev/todomvc` (offizielle Playwright-Demo).
Jede Spec hat eine Tabelle DIREKT unter der `#`-Überschrift → Gauge führt
das Szenario darunter automatisch einmal PRO ZEILE aus, jede Zeile ist ein
vollständig unabhängiger Testfall (frische Seite pro Szenario).

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

---

## 3. Finale Step-Implementierung (`tests/StepImplementation.ts`)

```typescript
import { Step, BeforeSuite, AfterSuite, BeforeScenario, AfterScenario } from "gauge-ts";
import { chromium, Browser, Page, Locator } from "playwright";
import assert = require("assert");

export default class StepImplementation {
    private browser!: Browser;
    private page!: Page;

    @BeforeSuite()
    public async beforeSuite() {
        this.browser = await chromium.launch({ headless: process.env.HEADLESS !== "false" });
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

    private todoItem(item: string): Locator {
        return this.page.getByTestId("todo-item").filter({ hasText: item });
    }

    private async assertCompleted(item: string) {
        const classAttr = await this.todoItem(item).getAttribute("class");
        assert.ok(classAttr?.includes("completed"));
    }

    private async assertNotCompleted(item: string) {
        const classAttr = await this.todoItem(item).getAttribute("class");
        assert.ok(!classAttr?.includes("completed"));
    }

    private toBoolean(value: unknown): boolean {
        if (typeof value === "boolean") return value;
        if (value === "true") return true;
        if (value === "false") return false;
        throw new Error(`Expected "true" or "false", got: ${JSON.stringify(value)}`);
    }

    @Step("Wait for <seconds> seconds") // demonstration purposes only — avoid fixed waits in real tests
    public async waitForSeconds(seconds: unknown) {
        const value = typeof seconds === "number" ? seconds : Number(seconds);
        if (!Number.isFinite(value) || value < 0) {
            throw new Error(`"Wait for <seconds> seconds" expects a non-negative number, got: ${JSON.stringify(seconds)}`);
        }
        await this.page.waitForTimeout(value * 1000);
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

    @Step("Todo <item> should not be visible")
    public async todoShouldNotBeVisible(item: string) {
        const todo = this.page.getByTestId("todo-title").filter({ hasText: item });
        await todo.waitFor({ state: "hidden" });
        assert.ok(!(await todo.isVisible()));
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

    @Step("Hover over todo <item>")
    public async hoverOverTodo(item: string) {
        await this.todoItem(item).hover();
    }

    @Step("Delete todo <item>")
    public async deleteTodo(item: string) {
        const todo = this.todoItem(item);
        await todo.hover();
        await todo.getByRole("button", { name: "Delete" }).click();
    }
}
```

---

## 4. Datengetriebene Specs — das zentrale Gauge-Feature

Eine Tabelle DIREKT unter der `#`/`##`-Überschrift (nicht unter einem
einzelnen Step!) macht das ganze Szenario darunter datengetrieben: Gauge
wiederholt es automatisch einmal PRO ZEILE und ersetzt `<spalte>` in jedem
Step — kein `Table`-Objekt im Code nötig, Steps bleiben einfache
Einzelwert-Funktionen. Ein Test Manager kann eine neue Zeile ergänzen
(`|Buy bread|true|`) und hat sofort einen neuen, vollständigen Testfall,
ohne Code anzufassen.

**Wichtiger Talking Point:** Reale Drittanbieter-Suchmaschinen (Google,
DuckDuckGo) live in automatisierten Tests anzusteuern ist KEIN gutes
Beispiel dafür — beide zeigen CAPTCHA-Challenges bei Bot-Traffic (live
getestet: DuckDuckGo antwortet mit "Select all squares containing a
duck"). Für echte Projekte: externe Abhängigkeiten mocken oder gegen eine
eigene, kontrollierte Umgebung testen — nicht gegen fremde Live-Seiten.

---

## 5. Dockerfile

```dockerfile
FROM mcr.microsoft.com/playwright:v1.62.0-noble
WORKDIR /app
RUN npm install -g @getgauge/cli && gauge install ts
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["gauge", "run", "specs"]
```
Versionsnummer im Image-Tag **muss** zur `playwright`-Version in
`package.json` passen (Browser-Binary ↔ Client-Library dürfen nicht
auseinanderdriften).

---

## 6. GitHub Actions (`.github/workflows/ci.yml`)

```yaml
name: Gauge Playwright Tests
on:
  push: { branches: [ master ] }
  pull_request: { branches: [ master ] }
  schedule:
    - cron: '0 2 * * *'   # täglich 02:00 UTC — Drift unabhängig von Code-Änderungen abfangen
  workflow_dispatch:       # manuelles Auslösen im Actions-Tab
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t gauge-playwright-demo .
      - run: docker run --rm -v ${{ github.workspace }}/reports:/app/reports gauge-playwright-demo
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: gauge-html-report, path: reports/html-report }
```
Branch im Trigger muss zum tatsächlichen Default-Branch des Repos passen
(`main` vs. `master` — leicht zu übersehen). `schedule` läuft unabhängig
von Pushes (nightly regression); `workflow_dispatch` erlaubt manuelles
Auslösen über den "Run workflow"-Button im Actions-Tab. Alle drei
Trigger-Arten (push/schedule/workflow_dispatch) live im Repo verifiziert.

---

## 7. Nützliche Befehle (Cheat-Referenz)

| Befehl | Zweck |
|---|---|
| `gauge run specs` | Alle Specs ausführen |
| `gauge run specs/delete_todo.spec:5` | Ein Szenario nach Zeilennummer |
| `gauge run --scenario "Name" specs/delete_todo.spec` | Ein Szenario nach Name |
| `gauge run -t "tagname" specs` | Nach Tag filtern |
| `gauge run -f` | Nur zuletzt fehlgeschlagene Szenarien |
| `gauge run -v` | Verbose (Step-Level statt Szenario-Level) |
| `$env:HEADLESS="false"; gauge run ...` | Browser sichtbar (PowerShell-Syntax!) |
| `npx playwright codegen <url>` | Locators durch Klicken generieren lassen |

---

## 8. Kernkonzepte — Talking Points

- **Gauge trennt WAS von WIE:** Spec (Markdown, lesbar für Nicht-Techniker)
  vs. Step-Implementierung (Code). Guter Anknüpfungspunkt für Sales-Sicht.
- **Ein Spec pro fachlichem Test, gemeinsame Step-Bibliothek:** So wächst
  eine echte Testsuite — Test Manager pflegt `.spec` + Tabellen, ohne den
  TypeScript-Code anzufassen.
- **Datengetriebene Specs (Abschnitt 4):** Zeile = unabhängiger Testfall.
  Neue Testdaten = neue Zeile, kein Code nötig.
- **Playwright ist hier nur Library, nicht Runner:** `playwright` (nicht
  `@playwright/test`) wird innerhalb der Gauge-Steps aufgerufen — wie
  Selenium/Playwright als Library in JUnit-Steps.
- **Locators statt CSS-Selektoren:** `getByRole`, `getByTestId`,
  `getByPlaceholder` — robuster, näher an dem, was ein Nutzer sieht.
- **Auto-Waiting:** `.fill()`, `.click()`, `.check()` warten automatisch auf
  Actionability (visible, stable, enabled) — kein `sleep()`.
- **Playwrights `isVisible()` prüft `display`/Bounding-Box, nicht `opacity`.**
  TodoMVC-Löschbutton ist `display:none` bis `:hover` → Hover-Step ist
  funktional notwendig, nicht nur kosmetisch (selbst nachgewiesen).
- **Docker = reproduzierbare Umgebung:** Gleicher Befehl (`docker build` +
  `docker run`) lokal wie in CI — kein Auseinanderdriften.
- **Typsicherheit endet an der Spec-Grenze:** Gauge-Parameter aus der
  `.spec`-Datei sind für TypeScript unsichtbar. `gauge-ts` versucht
  automatisch String→Number/Boolean-Konvertierung (`PrimitiveParser`),
  aber bei ungültigen Werten (`"abc"`) entstehen **stille** Fehler
  (`NaN` → `setTimeout(NaN)` läuft ~sofort durch, ohne Crash) statt eines
  Fehlers — deshalb: Parameter an der Grenze explizit validieren
  (`toBoolean()`-Helper macht genau das für den `shouldComplete`-Wert).
- **Externe Live-Abhängigkeiten meiden:** Suchmaschinen/fremde Seiten in
  Tests haben Bot-Erkennung/CAPTCHAs — mocken oder eigene Umgebung nutzen.
- **Gauge generiert automatisch HTML-Reports** (`reports/html-report/`) —
  als CI-Artefakt archivierbar.

---

## 9. Für die Sales-Frage ("Wie erklärst du einem Kunden den Nutzen?")

- Gauge-Specs sind lesbares Markdown → auch Product Owner/Kunden können
  Testabdeckung nachvollziehen, ohne Code zu lesen.
- Docker sorgt dafür, dass "es funktioniert auf meiner Maschine" kein Thema
  mehr ist — gleiches Ergebnis lokal, beim Kunden, in der Pipeline.
- CI/CD verhindert, dass kaputte Änderungen in Produktion gelangen —
  jeder Push wird automatisch getestet, Reports als Nachweis.

---

## 10. Eigene Referenzprojekte

- `github.com/Albamaris/ecommerce-test-automation` — Page Object Pattern,
  GitHub Actions + Jenkins
- `github.com/Albamaris/interview_systemverification` — dieses Demo-Framework
  (heute gebaut, GitHub Actions grün, alle drei Trigger-Arten verifiziert)
