from openai import OpenAI
import time
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play
from elevenlabs import save, stream
from uuid import uuid4
import requests
import os
import tempfile
import platform
import subprocess
import webbrowser

load_dotenv()
client = OpenAI()
elevenlabs = ElevenLabs(
    api_key=os.getenv("ELEVENLABS_API_KEY"),
    base_url="https://api.elevenlabs.io"
)

DID_API_KEY = os.getenv("DID_KEY")
DID_BASE = "https://api.d-id.com"

def play_response_as_audio(text):
    audio = elevenlabs.text_to_speech.convert(
        text=text,
        voice_id="1SM7GgM6IMuvQlz2BwM3",
        model_id="eleven_flash_v2",
        output_format="mp3_44100_32",
    )
    play(audio)

def _open_natively(path_or_url: str):
    """Open a local file or URL with the system's default video handler."""
    system = platform.system()
    try:
        if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
            webbrowser.open(path_or_url)
            return
        if system == "Darwin":   # macOS
            subprocess.Popen(["open", path_or_url])
        elif system == "Windows":
            # 'start' is a shell built-in; use shell=True
            subprocess.Popen(f'start "" "{path_or_url}"', shell=True)
        else:  # Linux and others
            subprocess.Popen(["xdg-open", path_or_url])
    except Exception as e:
        print(f"Failed to open video natively: {e}")

def _download_to_temp(url: str, suffix=".mp4") -> str:
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    with open(temp_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
    return temp_path

def create_did_talk(text: str, image_url: str = "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg") -> str:
    """POST /talks -> return talk id."""
    url = f"{DID_BASE}/talks"
    payload = {
        "source_url": image_url,
        "script": {
            "type": "text",
            "provider": {
                "type": "microsoft",
                "voice_id": "en-US-JennyNeural"
            },
            "input": text
        }
    }
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": f"Bearer {DID_API_KEY}",
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    talk_id = data.get("id")
    if not talk_id:
        raise RuntimeError(f"D-ID response missing 'id': {data}")
    return talk_id

def get_did_talk(talk_id: str) -> dict:
    """GET /talks/{id} -> return JSON."""
    url = f"{DID_BASE}/talks/{talk_id}"
    headers = {
        "accept": "application/json",
        "authorization": f"Bearer {DID_API_KEY}",
    }
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()

def wait_for_result_url(talk_id: str, max_wait_sec: int = 120, base_sleep: float = 0.8) -> str:
    """
    Poll until status=='done' and return result_url.
    Raises if 'error' or timeout.
    """
    total = 0.0
    sleep = base_sleep
    while total <= max_wait_sec:
        info = get_did_talk(talk_id)
        status = info.get("status")
        if status == "done":
            result_url = info.get("result_url")
            if not result_url:
                raise RuntimeError(f"D-ID: status done but no result_url. Full: {info}")
            return result_url
        if status == "error":
            raise RuntimeError(f"D-ID error: {info.get('error', info)}")
        # statuses often: created / processing
        time.sleep(sleep)
        total += sleep
        # gentle backoff, cap at ~5s
        sleep = min(sleep * 1.5, 5.0)
    raise TimeoutError(f"D-ID talk {talk_id} not ready after {max_wait_sec}s")

def create_video_from_text_and_play(text: str, download_locally: bool = True):
    if not DID_API_KEY:
        raise EnvironmentError("Missing DID_API_KEY in environment/.env")

    talk_id = create_did_talk(text)
    result_url = wait_for_result_url(talk_id)

    if download_locally:
        mp4_path = _download_to_temp(result_url, suffix=".mp4")
        _open_natively(mp4_path)
    else:
        # open the streaming URL directly (lets the browser/player stream from S3)
        _open_natively(result_url)

def chat_loop():
    sys_role = {
        "role": "system",
        "content": "You are a friendly fitness coach. Answer in a concise and informative manner. Use maximum of two sentences."
    }

    conversation = [sys_role]

    while True:
        prompt = input("message: ")
        if prompt.strip().lower() == "exit":
            break

        conversation.append({"role": "user", "content": prompt})
        response = client.responses.create(
            model="gpt-4o-mini",
            input=conversation,
            service_tier="priority",
        )
        assistant_text = response.output_text
        conversation.append({"role": "assistant", "content": assistant_text})
        print(assistant_text)

        # Audio (existing)
        try:
            play_response_as_audio(assistant_text)
        except Exception as e:
            print(f"[audio warn] {e}")

        # Video via D-ID (new)
        try:
            create_video_from_text_and_play(assistant_text, download_locally=True)
        except Exception as e:
            print(f"[video warn] {e}")

if __name__ == "__main__":
    chat_loop()