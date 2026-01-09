export const sql_executor = async (sql: string, db: any) => {
    // db is expected to be an instance of SandboxDB
    const result = await db.query(sql);
    return result;
};