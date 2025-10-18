import os
from elevenlabs import ElevenLabs

# Load API key from environment variable (fallback to hardcoded for now)
ELEVENLABS_API_KEY = 'sk_66c40847434edf7d5c59d36d9405f153be48b8bacf2da24b'

def speech_to_text(audio_file_path: str, language_code: str = "eng") -> str:
    # Check if file exists
    if not os.path.exists(audio_file_path):
        raise FileNotFoundError(f"Audio file not found: {audio_file_path}")
    
    # Initialize ElevenLabs client
    client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
    
    # Open and transcribe the audio file
    with open(audio_file_path, "rb") as media_file:
        response = client.speech_to_text.convert(
            file=media_file,
            model_id="scribe_v1",
            language_code=language_code,
            tag_audio_events=False
        )
    
    return response.text


# Example usage (uncomment to test):
# if __name__ == "__main__":
#     transcription = speech_to_text("input.mp4")
#     print("Transcription:\n")
#     print(transcription)
