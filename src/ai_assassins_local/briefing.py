from datetime import datetime
import os

def run():
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    message = f"Ai-Assassins 0700 briefing executed at {timestamp}"
    
    print(message)

    os.makedirs("briefings", exist_ok=True)

    filename = datetime.now().strftime("briefings/%Y-%m-%d.txt")
    with open(filename, "w") as f:
        f.write(message)

    print(f"Saved briefing to {filename}")
