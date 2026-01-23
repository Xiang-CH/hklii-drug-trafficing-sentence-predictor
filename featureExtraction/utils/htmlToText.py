from io import StringIO
from bs4 import BeautifulSoup
import pandas as pd

def html_to_text_with_tables(soup: BeautifulSoup) -> str:
    """Convert HTML to text, preserving tables as clean HTML."""
    soup = BeautifulSoup(str(soup), "html.parser")  # Make a copy to avoid modifying original

    for table in soup.find_all("table")[1:]:
        # Skip tables inside parties, coram, date, representation, or charge tags
        if table.find_parent(["parties", "coram", "date", "representation", "charge"]):
            continue

        table_df = pd.read_html(StringIO(str(table)), header=0)[0].fillna("").rename(columns={"Unnamed: 0": ""}).astype(str)
        clean_table = table_df.to_markdown(index=False)
        table.replace_with(clean_table)  # Replace with string, not parsed HTML

    return soup.get_text()