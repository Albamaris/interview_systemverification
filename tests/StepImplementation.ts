import { Step, BeforeSuite, AfterSuite, BeforeScenario, AfterScenario, Table } from "gauge-ts";
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

    // ---- private helpers: single source of truth for both <item> and <table> steps ----

    private todoItem(item: string): Locator {
        return this.page.getByTestId("todo-item").filter({ hasText: item });
    }

    private async addSingleTodo(item: string) {
        const input = this.page.getByPlaceholder("What needs to be done?");
        await input.fill(item);
        await input.press("Enter");
    }

    private async assertVisible(item: string) {
        const todo = this.page.getByTestId("todo-title").filter({ hasText: item });
        await todo.waitFor({ state: "visible" });
        assert.ok(await todo.isVisible());
    }

    private async assertNotVisible(item: string) {
        const todo = this.page.getByTestId("todo-title").filter({ hasText: item });
        await todo.waitFor({ state: "hidden" });
        assert.ok(!(await todo.isVisible()));
    }

    private async completeSingle(item: string) {
        await this.todoItem(item).getByRole("checkbox").check();
    }

    private async assertCompleted(item: string) {
        const classAttr = await this.todoItem(item).getAttribute("class");
        assert.ok(classAttr?.includes("completed"));
    }

    private async assertNotCompleted(item: string) {
        const classAttr = await this.todoItem(item).getAttribute("class");
        assert.ok(!classAttr?.includes("completed"));
    }

    private async deleteSingle(item: string) {
        const todo = this.todoItem(item);
        await todo.hover();
        await todo.getByRole("button", { name: "Delete" }).click();
    }

    // ---- steps ----

    @Step("Wait for <seconds> seconds") // This step will wait for the specified number of seconds, only for demonstration purposes. In real tests, you should avoid using fixed waits and instead wait for specific conditions.
    public async waitForSeconds(seconds: unknown) {
        const value = typeof seconds === "number" ? seconds : Number(seconds);
        if (!Number.isFinite(value) || value < 0) {
            throw new Error(`"Wait for <seconds> seconds" expects a non-negative number, got: ${JSON.stringify(seconds)}`);
        }
        await this.page.waitForTimeout(value * 1000); // Convert seconds to milliseconds
    }

    @Step("Open the todo app")
    public async openTodoApp() {
        await this.page.goto("https://demo.playwright.dev/todomvc");
    }

    @Step("Hover over todo <item>")
    public async hoverOverTodo(item: string) {
        await this.todoItem(item).hover();
    }

    @Step("Add todo <item>")
    public async addTodo(item: string) {
        await this.addSingleTodo(item);
    }

    @Step("Add todos <table>")
    public async addTodos(table: Table) {
        for (const row of table.getTableRows()) {
            await this.addSingleTodo(row.getCell("description"));
        }
    }

    @Step("Todo <item> should be visible")
    public async todoShouldBeVisible(item: string) {
        await this.assertVisible(item);
    }

    @Step("Todos should be visible <table>")
    public async todosShouldBeVisible(table: Table) {
        for (const row of table.getTableRows()) {
            await this.assertVisible(row.getCell("description"));
        }
    }

    @Step("Todo <item> should not be visible")
    public async todoShouldNotBeVisible(item: string) {
        await this.assertNotVisible(item);
    }

    @Step("Todos should not be visible <table>")
    public async todosShouldNotBeVisible(table: Table) {
        for (const row of table.getTableRows()) {
            await this.assertNotVisible(row.getCell("description"));
        }
    }

    @Step("Mark todo <item> as done")
    public async markTodoAsDone(item: string) {
        await this.completeSingle(item);
    }

    @Step("Complete todos <table>")
    public async completeTodos(table: Table) {
        for (const row of table.getTableRows()) {
            await this.completeSingle(row.getCell("description"));
        }
    }

    @Step("Todo <item> should be marked as completed")
    public async todoShouldBeCompleted(item: string) {
        await this.assertCompleted(item);
    }

    @Step("Todos should be marked as completed <table>")
    public async todosShouldBeCompleted(table: Table) {
        for (const row of table.getTableRows()) {
            await this.assertCompleted(row.getCell("description"));
        }
    }

    @Step("Todos should not be marked as completed <table>")
    public async todosShouldNotBeCompleted(table: Table) {
        for (const row of table.getTableRows()) {
            await this.assertNotCompleted(row.getCell("description"));
        }
    }

    @Step("Delete todo <item>")
    public async deleteTodo(item: string) {
        await this.deleteSingle(item);
    }

    @Step("Delete todos <table>")
    public async deleteTodos(table: Table) {
        for (const row of table.getTableRows()) {
            await this.deleteSingle(row.getCell("description"));
        }
    }
}
