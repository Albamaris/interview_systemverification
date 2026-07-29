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
