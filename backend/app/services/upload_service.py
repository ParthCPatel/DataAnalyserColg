import pandas as pd
import sqlite3
import os
import re
from datetime import datetime
from typing import List, Dict, Any, Tuple
from app.core.config import get_settings

settings = get_settings()

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

class UploadService:
    def __init__(self):
        self.upload_dir = os.path.abspath("uploads")
        if not os.path.exists(self.upload_dir):
            os.makedirs(self.upload_dir, exist_ok=True)

    def get_local_path(self, path: str) -> str:
        """
        Takes any path (windows, linux, absolute, relative) and returns 
        the absolute path within the current environment's upload directory.
        """
        if not path:
            return ""
        # Get just the filename (e.g., "db_123.sqlite")
        filename = os.path.basename(path)
        return os.path.join(self.upload_dir, filename)

    def sanitize_table_name(self, name: str) -> str:
        # Simple sanitization
        clean = re.sub(r'[^a-zA-Z0-9_]', '_', name).lower()
        if not clean or not clean[0].isalpha():
            clean = "t_" + clean
        return clean

    async def persist_db_to_mongo(self, db_path: str, upload_id: str, mongo_db: AsyncIOMotorDatabase):
        """
        Reads the SQLite file as binary and saves it to a binary_storage collection.
        """
        local_path = self.get_local_path(db_path)
        if not os.path.exists(local_path):
            print(f"File {local_path} does not exist for persistence.")
            return

        with open(local_path, "rb") as f:
            binary_data = f.read()

        await mongo_db.binary_storage.update_one(
            {"uploadId": upload_id},
            {"$set": {
                "uploadId": upload_id,
                "binary": binary_data,
                "updatedAt": datetime.utcnow()
            }},
            upsert=True
        )
        print(f"Persisted {local_path} to MongoDB for uploadId: {upload_id}")

    async def retrieve_db_from_mongo(self, db_path: str, upload_id: str, mongo_db: AsyncIOMotorDatabase) -> bool:
        """
        Retrieves binary data from MongoDB and writes it back to a local SQLite file if missing.
        """
        local_path = self.get_local_path(db_path)
        if os.path.exists(local_path):
            return True

        record = await mongo_db.binary_storage.find_one({"uploadId": upload_id})
        if record and "binary" in record:
            with open(local_path, "wb") as f:
                f.write(record["binary"])
            print(f"Restored {local_path} from MongoDB for uploadId: {upload_id}")
            return True
        
        print(f"Failed to restore {local_path} from MongoDB (Upload ID: {upload_id})")
        return False

    async def process_csv_to_sqlite(self, csv_paths: List[str], original_names: List[str], master_db_path: str = None) -> Tuple[str, List[str]]:
        """
        Converts list of CSVs to a single SQLite DB.
        Returns (db_path, table_names)
        """
        if not master_db_path:
            # Generate a new master DB path
            timestamp = int(datetime.utcnow().timestamp())
            local_db_path = os.path.join(self.upload_dir, f"db_{timestamp}.sqlite")
        else:
            local_db_path = self.get_local_path(master_db_path)

        conn = sqlite3.connect(local_db_path)
        table_names = []

        try:
            for csv_path, original_name in zip(csv_paths, original_names):
                base_name = os.path.splitext(original_name)[0]
                table_name = self.sanitize_table_name(base_name)
                
                # Check for uniqueness if needed, but pandas 'replace' handles overwrites on same table name
                # If we want to append to existing DB with different table names, we need to ensure uniqueness
                # For now, simplistic approach
                
                df = pd.read_csv(csv_path)
                df.to_sql(table_name, conn, if_exists='replace', index=False)
                table_names.append(table_name)
                print(f"Processed {original_name} -> {table_name}")

        finally:
            conn.close()

        return local_db_path, table_names

    def get_database_state(self, db_path: str) -> Dict[str, Any]:
        """
        Returns {schema: str, databaseState: Dict}
        """
        local_path = self.get_local_path(db_path)
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Database file not found: {local_path}")

        conn = sqlite3.connect(local_path)
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
                df = df.replace([float('inf'), float('-inf'), float('nan')], None)
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
upload_service = UploadService()
