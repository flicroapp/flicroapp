import sys
import os
import json
import shutil
import platform

def get_disk_storage():
    try:
        # Determine the root drive/path
        if platform.system() == "Windows":
            path = os.environ.get("SystemDrive", "C:") + "\\"
        else:
            path = "/"

        total, used, free = shutil.disk_usage(path)

        return {
            "totalBytes": total,
            "usedBytes": used,
            "availableBytes": free,
            "usedPercent": round((used / total) * 100, 1) if total > 0 else 0,
            "path": path,
            "system": platform.system(),
            "source": "python"
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    result = get_disk_storage()
    print(json.dumps(result))
