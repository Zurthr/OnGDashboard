import sys
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from api import ForecastRequest, forecast

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"success": False, "error": "Empty input"}))
            sys.exit(1)
        input_data = json.loads(raw_input)
        req = ForecastRequest(**input_data)
        result = forecast(req)
        print(json.dumps({"success": True, "data": result}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
