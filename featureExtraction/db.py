import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

DB_NAME = "drug-sentencing-predictor"
JUDGEMENTS_COLLECTION_NAME = "judgement-html"
EXTRACTED_FEATURES_COLLECTION_NAME = "llm-extracted-features"


class DB:
    def __init__(self):
        uri = os.getenv("DB_MONGODB_URI")
        self.client = MongoClient(uri)
        self.database = self.client.get_database(DB_NAME)

    def get_judgements_collection(self):
        return self.database.get_collection(JUDGEMENTS_COLLECTION_NAME)

    def get_extracted_features_collection(self):
        return self.database.get_collection(EXTRACTED_FEATURES_COLLECTION_NAME)
