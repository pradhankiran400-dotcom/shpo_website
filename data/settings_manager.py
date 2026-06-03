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

def load_settings() -> Dict[str, Any]:
    """Reads settings from settings.json or returns default settings if file doesn't exist."""
    with _settings_lock:
        if not os.path.exists(SETTINGS_FILE):
            # Try to populate from env variable initially if available
            env_key = os.getenv("GEMINI_API_KEY", "")
            initial = DEFAULT_SETTINGS.copy()
            if env_key:
                initial["gemini_api_key"] = env_key
            try:
                with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                    json.dump(initial, f, indent=4)
            except Exception as e:
                print(f"[SETTINGS WARNING]: Failed to create settings.json: {e}")
            return initial
        
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Ensure all default keys exist
                updated = False
                for k, v in DEFAULT_SETTINGS.items():
                    if k not in data:
                        data[k] = v
                        updated = True
                if updated:
                    with open(SETTINGS_FILE, "w", encoding="utf-8") as wf:
                        json.dump(data, wf, indent=4)
                return data
        except Exception as e:
            print(f"[SETTINGS ERROR]: Failed to load settings.json: {e}")
            return DEFAULT_SETTINGS.copy()

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
                    # Do not overwrite with stars/placeholder keys
                    if k in ("gemini_api_key", "google_maps_api_key") and ("..." in str(new_settings[k]) or "*" in str(new_settings[k])):
                        continue
                    current[k] = new_settings[k]
                    
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(current, f, indent=4)
            return True
        except Exception as e:
            print(f"[SETTINGS ERROR]: Failed to save settings: {e}")
            return False

def get_effective_gemini_key() -> str:
    """Returns the configured Gemini API key, giving preference to the settings file then env."""
    settings = load_settings()
    key = settings.get("gemini_api_key", "").strip()
    if not key:
        key = os.getenv("GEMINI_API_KEY", "").strip()
    return key
