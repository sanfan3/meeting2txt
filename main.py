from fastapi import FastAPI, HTTPException, Request
import uvicorn
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os
import torch
import base64
import tempfile
from pydub import AudioSegment  # 新增：音频处理库
from transformers import pipeline  # 新增：导入 pipeline

app = FastAPI()

# -------------------------- 模型配置 ---------------------------
MODEL_NAME = "openai/whisper-large-v3-turbo"  # 保留原模型配置
DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"
CHUNK_LENGTH = 30000  # 新增：切割时长（毫秒，默认30秒）

# 新增：安全切割音频函数
def split_audio(file_path, chunk_length=CHUNK_LENGTH):
    """ 安全切割音频的增强版 """
    try:
        audio = AudioSegment.from_file(file_path)
        return [audio[i*chunk_length : (i+1)*chunk_length] for i in range(len(audio)//chunk_length +1)]
    except Exception as e:
        raise RuntimeError(f"音频切割失败: {str(e)}")

# 初始化 ASR pipeline（GPU 用 0，CPU 用 -1）
transcriber = pipeline(
    "automatic-speech-recognition",
    model=MODEL_NAME,
    device=0 if DEVICE.startswith("cuda") else -1,
    torch_dtype=torch.float16 if DEVICE.startswith("cuda") else torch.float32
)  # 新增：初始化转录 pipeline

# -------------------------- 网页挂载 ---------------------------
base_dir = os.path.dirname(os.path.abspath(__file__))
templates = Jinja2Templates(directory=os.path.join(base_dir, "templates"))
app.mount("/static", StaticFiles(directory=os.path.join(base_dir, "static")), name="static")

# -------------------------- 页面渲染 ---------------------------
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    try:
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"渲染页面失败：{str(e)}")

# -------------------------- 增强版音频处理 ---------------------------
@app.post("/transcribe")
async def transcribe(request: Request):
    try:
        data = await request.json()
        audio_data = data.get("audio_data")
        if not audio_data:
            raise HTTPException(status_code=400, detail="未提供音频数据")

        # 解码 Base64 音频数据并保存为临时文件
        audio_bytes = base64.b64decode(audio_data)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            input_path = f.name  # 主临时文件路径

        results = []  # 存储分段转录结果
        chunk_temp_files = []  # 存储分段临时文件路径（用于清理）

        try:
            # Step1: 切割音频
            chunks = split_audio(input_path)
            print(f"🔊 切割成 {len(chunks)} 个片段")

            # Step2: 分段转录
            for idx, chunk in enumerate(chunks):
                # 每个片段保存为临时文件
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as cf:
                    chunk.export(cf.name, format="wav")  # pydub导出为wav格式
                    chunk_temp_files.append(cf.name)  # 记录临时文件路径
                    # 调用转录模型
                    result = transcriber(cf.name)
                    results.append(result["text"])
                print(f"✅ 完成第 {idx+1}/{len(chunks)} 段转录")

            # 合并结果
            transcription = " ".join(results)

        finally:  # 确保清理所有临时文件
            os.unlink(input_path)  # 清理主临时文件
            for temp_file in chunk_temp_files:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)  # 清理分段临时文件

        return {"transcription": transcription}  # 返回合并后的转录结果

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理音频数据失败：{str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app", 
        port=8000, 
        reload=True,
        log_level="debug"
        )
