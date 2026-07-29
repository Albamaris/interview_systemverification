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
