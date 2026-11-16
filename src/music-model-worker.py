"""NDJSON worker: load Essentia Discogs400 once, then analyze local audio."""
import json
import os
import sys

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("TF_NUM_INTRAOP_THREADS", "1")
os.environ.setdefault("TF_NUM_INTEROP_THREADS", "1")

import numpy as np
from essentia.standard import MonoLoader, TensorflowPredictEffnetDiscogs, TensorflowPredict2D

root = sys.argv[1]
with open(os.path.join(root, "genre_discogs400-discogs-effnet-1.json"), encoding="utf-8") as stream:
    classes = json.load(stream)["classes"]
embedding = TensorflowPredictEffnetDiscogs(
    graphFilename=os.path.join(root, "discogs-effnet-bs64-1.pb"),
    output="PartitionedCall:1",
)
classifier = TensorflowPredict2D(
    graphFilename=os.path.join(root, "genre_discogs400-discogs-effnet-1.pb"),
    input="serving_default_model_Placeholder", output="PartitionedCall:0",
)
for line in sys.stdin:
    try:
        file = json.loads(line)["file"]
        audio = MonoLoader(filename=file, sampleRate=16000, resampleQuality=4)()
        if len(audio) < 16000 * 6:
            print(json.dumps({"labels": []}), flush=True)
            continue
        width = 16000 * 30
        starts = [0] if len(audio) <= width else [0, (len(audio)-width)//2, len(audio)-width]
        windows = [classifier(embedding(audio[start:start+width])) for start in starts]
        scores = np.concatenate(windows, axis=0).mean(axis=0)
        top = np.argsort(scores)[-8:][::-1]
        print(json.dumps({"labels": [[classes[i], float(scores[i])] for i in top]}, allow_nan=False), flush=True)
    except Exception:
        print('{"error":true}', flush=True)
