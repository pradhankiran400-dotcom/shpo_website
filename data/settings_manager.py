import os
import json
import threading
from typing import Dict, Any

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")
_settings_lock = threading.Lock()

DEFAULT_SETTINGS = {
    "gemini_api_key": "",
    "google_maps_api_key": "",
    "ai_verification_enabled": True,
    "store_upi_id": "9078445116@ybl",
    "delivery_agent_phone": "",
    "show_agent_phone_to_customer": True
}

def load_env_file():
    """Reads a .env file from the root directory and populates os.environ."""
    # Find the root directory (.env is in the parent of the directory containing settings_manager.py)
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(root_dir, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip()
                        # Strip surrounding quotes if present
                        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                            val = val[1:-1]
                        os.environ[key] = val
        except Exception as e:
            print(f"[ENV ERROR]: Failed to load .env file: {e}")

# Load environment variables on module import
load_env_file()

def load_settings() -> Dict[str, Any]:
    """Reads settings from settings.json, but overrides sensitive configs and keys from environment variables."""
    # Refresh env file values in case they were modified
    load_env_file()
    
    with _settings_lock:
        settings = DEFAULT_SETTINGS.copy()
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    settings.update(json.load(f))
            except Exception as e:
                print(f"[SETTINGS ERROR]: Failed to load settings.json: {e}")
                
        # Overwrite all keys that are environment variables
        settings["gemini_api_key"] = os.getenv("GEMINI_API_KEY", "").strip()
        settings["google_maps_api_key"] = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
        settings["store_upi_id"] = os.getenv("STORE_UPI_ID", settings.get("store_upi_id", "")).strip()
        settings["delivery_agent_phone"] = os.getenv("DELIVERY_AGENT_PHONE", settings.get("delivery_agent_phone", "")).strip()
        
        return settings

def save_settings(new_settings: Dict[str, Any]) -> bool:
    """Saves settings to settings.json in a thread-safe manner."""
    with _settings_lock:
        try:
            current = DEFAULT_SETTINGS.copy()
            if os.path.exists(SETTINGS_FILE):
                try:
                    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                        current.update(json.load(f))
                except Exception:
                    pass
            
            # Update only valid settings keys
            for k in DEFAULT_SETTINGS.keys():
                if k in new_settings:
                    # Do not save backend secrets/private keys/configs to settings.json
                    if k in ("gemini_api_key", "google_maps_api_key", "store_upi_id", "delivery_agent_phone"):
                        continue
                    current[k] = new_settings[k]
                    
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(current, f, indent=4)
            return True
        except Exception as e:
            print(f"[SETTINGS ERROR]: Failed to save settings: {e}")
            return False

def get_effective_gemini_key() -> str:
    """Returns the configured Gemini API key from env."""
    load_env_file()
    return os.getenv("GEMINI_API_KEY", "").strip()
