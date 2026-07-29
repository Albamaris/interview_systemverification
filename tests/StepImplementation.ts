import { Step, BeforeSuite, AfterSuite, BeforeScenario, AfterScenario, Table } from "gauge-ts";
import { chromium, Browser, Page } from "playwright";
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

    @Step("Add todo <item>")
    public async addTodo(item: string) {
        const input = this.page.getByPlaceholder("What needs to be done?");
        await input.fill(item);
        await input.press("Enter");
    }

    @Step("Add todos <table>")
    public async addTodos(table: Table) {
        const input = this.page.getByPlaceholder("What needs to be done?");
        for (const row of table.getTableRows()) {
            await input.fill(row.getCell("description"));
            await input.press("Enter");
        }
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
}
