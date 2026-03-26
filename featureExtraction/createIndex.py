import pymongo

from featureExtraction.db import DB


if __name__ == "__main__":
    db = DB()
    judgements_collection = db.get_judgements_collection()

    # create indexes for faster querying
    judgements_collection.create_index("trial")
    judgements_collection.create_index("appeal")
    judgements_collection.create_index("corrigendum")
    judgements_collection.create_index(
        ["trial", ("year", pymongo.DESCENDING)]
    )