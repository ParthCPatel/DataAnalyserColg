import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

export class SandboxDB {
    private db: sqlite3.Database;
    private tempFilePath: string | null = null;

    constructor(dbFilePath?: string) {
        if (dbFilePath) {
            if (!fs.existsSync(dbFilePath)) {
                console.error(`[SandboxDB] File not found: ${dbFilePath}`);
                // Try to see if it's just the extension missing or .sqlite vs .csv mismatch handled by caller?
                // Caller (sandbox.ts) handles extension. 
                // If we are here, path is supposed to be correct.
                throw new Error(`Database file not found at path: ${dbFilePath}`);
            }
            // Create a temp copy of the uploaded DB for this session
            const uploadsDir = path.dirname(dbFilePath);
            this.tempFilePath = path.join(uploadsDir, `sandbox-${Date.now()}-${path.basename(dbFilePath)}`);
            try {
                fs.copyFileSync(dbFilePath, this.tempFilePath);
            } catch (e: any) {
                throw new Error(`Failed to copy database file: ${e.message}`);
            }
            this.db = new sqlite3.Database(this.tempFilePath);
        } else {
            this.db = new sqlite3.Database(':memory:');
        }
    }

    async init(): Promise<void> {
        return new Promise((resolve) => {
            if (this.tempFilePath) {
                // File DBs usually don't need serialize like :memory: might for initial setup, but good practice
                 this.db.serialize(() => {
                    resolve();
                });
            } else {
                this.db.serialize(() => {
                    resolve();
                });
            }
        });
    }

    async run(sql: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async query(sql: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            // console.log(`[SandboxDB] Executing SQL: ${sql}`); 
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error(`[SandboxDB] Query Error: ${err.message} | SQL: ${sql}`);
                    reject(err);
                }
                else resolve(rows);
            });
        });
    }

    close(): void {
        this.db.close((err) => {
            if (this.tempFilePath && fs.existsSync(this.tempFilePath)) {
                try {
                    fs.unlinkSync(this.tempFilePath);
                } catch (e) {
                    console.error("Failed to cleanup temp DB file:", e);
                }
            }
        });
    }
}
