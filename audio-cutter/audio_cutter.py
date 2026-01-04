from pydub import AudioSegment
import os
import math
import argparse

def split_audio(input_file, chunk_length_min=30, output_dir="output"):
    audio = AudioSegment.from_file(input_file)
    chunk_length_ms = chunk_length_min * 60 * 1000  # 30 minutes in ms
    total_length_ms = len(audio)
    total_chunks = math.ceil(total_length_ms / chunk_length_ms)

    os.makedirs(output_dir, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(input_file))[0]

    for i in range(total_chunks):
        start = i * chunk_length_ms
        end = min((i + 1) * chunk_length_ms, total_length_ms)
        chunk = audio[start:end]
        chunk_filename = os.path.join(output_dir, f"{base_name}_part{i+1}.mp3")
        chunk.export(chunk_filename, format="mp3")
        print(f"Exported {chunk_filename}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Split audio into 30-minute chunks.")
    parser.add_argument("input_file", help="Path to the input audio file.")
    parser.add_argument("--chunk", type=int, default=30, help="Chunk length in minutes (default: 30)")
    parser.add_argument("--output", default="output", help="Directory to save chunks (default: output)")
    args = parser.parse_args()

    split_audio(args.input_file, chunk_length_min=args.chunk, output_dir=args.output)
