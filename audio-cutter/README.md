```
cd audio_cutter

python3 -m venv venv
source venv/bin/activate

pip3 install -r requirements.txt

brew install ffmpeg
``` 


▶️ Run the script
```
python audio_cutter.py path/to/your/audiofile.mp3
```

You can optionally customize the chunk duration and output directory:
```
python audio_cutter.py path/to/your/audiofile.mp3 --chunk 15 --output my_chunks
```

Solution Without Python3
```
ffmpeg -i yourfile.m4a -f segment -segment_time 1800 -c copy output_%03d.m4a
ffmpeg -i 2025-04-19-predictive.m4a -f segment -segment_time 1800 -c copy output_%03d.m4a
```