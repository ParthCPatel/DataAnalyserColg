import pandas as pd
import sqlite3
import os
import re
from typing import List, Dict, Any, Tuple
from app.core.config import get_settings

settings = get_settings()

class UploadService:
    def __init__(self):
        self.upload_dir = "uploads"
        if not os.path.exists(self.upload_dir):
            os.makedirs(self.upload_dir)

    def sanitize_table_name(self, name: str) -> str:
        # Simple sanitization, strict logic can be added later or via LLM
        clean = re.sub(r'[^a-zA-Z0-9_]', '_', name).lower()
        if not clean or not clean[0].isalpha():
            clean = "t_" + clean
        return clean

    async def process_csv_to_sqlite(self, csv_paths: List[str], original_names: List[str], master_db_path: str = None) -> Tuple[str, List[str]]:
        """
        Converts list of CSVs to a single SQLite DB.
        Returns (db_path, table_names)
        """
        if not master_db_path:
            # Generate a new master DB path based on the first file or timestamp
            timestamp = int(datetime.utcnow().timestamp())
            master_db_path = os.path.join(self.upload_dir, f"db_{timestamp}.sqlite")

        conn = sqlite3.connect(master_db_path)
        table_names = []

        try:
            for csv_path, original_name in zip(csv_paths, original_names):
                # Simple table name generation for now
                base_name = os.path.splitext(original_name)[0]
                table_name = self.sanitize_table_name(base_name)
                
                # Check for collision
                # If collision, append timestamp? For now, let's assume unique or overwrite
                
                # Read CSV
                df = pd.read_csv(csv_path)
                
                # Write to SQLite
                df.to_sql(table_name, conn, if_exists='replace', index=False)
                table_names.append(table_name)
                print(f"Processed {original_name} -> {table_name}")

        finally:
            conn.close()

        return master_db_path, table_names

    def get_database_state(self, db_path: str) -> Dict[str, Any]:
        """
        Returns {schema: str, databaseState: Dict}
        """
        if not os.path.exists(db_path):
            raise FileNotFoundError(f"Database file not found: {db_path}")

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        try:
            # Get Schema
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL")
            schemas = [row[0] for row in cursor.fetchall()]
            full_schema = ";\n\n".join(schemas)

            # Get State (Preview)
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            tables = [row[0] for row in cursor.fetchall()]
            
            database_state = {}
            for table in tables:
                # Count
                cursor.execute(f'SELECT COUNT(*) FROM "{table}"')
                count = cursor.fetchone()[0]
                
                # Preview
                df = pd.read_sql_query(f'SELECT * FROM "{table}" LIMIT 5', conn)
                rows = df.to_dict(orient='records')
                
                database_state[table] = {
                    "total": count,
                    "rows": rows
                }
            
            return {
                "schema": full_schema,
                "databaseState": database_state
            }

        finally:
            conn.close()

from datetime import datetime
upload_service = UploadService()
