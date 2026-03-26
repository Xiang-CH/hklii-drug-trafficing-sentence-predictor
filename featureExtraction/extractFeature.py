import sys

sys.stderr = open("errors.log", "w")
from extract.runner import main

if __name__ == "__main__":
    main()
