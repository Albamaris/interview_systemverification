import { DatabaseSync } from "node:sqlite";
import { join } from "path";

const DB_PATH = join(process.cwd(), "testdata", "gauge.db");

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
    if (!db) {
        db = new DatabaseSync(DB_PATH);
        db.exec(`
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                description TEXT NOT NULL
            );
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS test_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                spec_name TEXT,
                scenario_name TEXT,
                status TEXT,
                executed_at TEXT
            );
        `);
        const row = db.prepare("SELECT COUNT(*) as count FROM todos").get() as { count: number };
        if (row.count === 0) {
            const insert = db.prepare("INSERT INTO todos (description) VALUES (?)");
            insert.run("Buy milk");
            insert.run("Walk the dog");
            insert.run("Clean the house");
        }
    }
    return db;
}

export function getAllTodoDescriptions(): string[] {
    const rows = getDb().prepare("SELECT description FROM todos ORDER BY id").all() as { description: string }[];
    return rows.map((row) => row.description);
}

export function recordTestResult(specName: string | null | undefined, scenarioName: string | null | undefined, status: string) {
    getDb()
        .prepare("INSERT INTO test_results (spec_name, scenario_name, status, executed_at) VALUES (?, ?, ?, ?)")
        .run(specName ?? "unknown", scenarioName ?? "unknown", status, new Date().toISOString());
}
