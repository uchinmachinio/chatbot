from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play
from elevenlabs import save, stream
from uuid import uuid4
from time import time
import os

load_dotenv()

elevenlabs = ElevenLabs(
    api_key=os.getenv("ELEVENLABS_API_KEY"),
    # base_url="https://api-global-preview.elevenlabs.io",
    base_url="https://api.elevenlabs.io"
)

start_time = time()

audio = elevenlabs.text_to_speech.convert(
    text="Well well well... Up up up... and away! This is a test of the Eleven Labs text to speech API. Well well well... Up up up... and away! This is a test of the Eleven Labs text to speech API.",
    voice_id="1SM7GgM6IMuvQlz2BwM3",
    model_id="eleven_flash_v2",  # Check out all models at: https://elevenlabs.io/docs/models
    output_format="mp3_44100_128",  # TODO: Increase this to 128kbps if want higher quality
)

generation_time = time() - start_time

# Save audio in outputs folder
save(audio, f"outputs/elevenlabs_output_{str(uuid4())[:4]}.mp3")

# Stream audio to speakers
play(audio)
play_time = time() - start_time - generation_time

print(f"Generation time: {generation_time:.2f} seconds")
print(f"Play time: {play_time:.2f} seconds")

