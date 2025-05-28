// DOM元素
const uploadArea = document.getElementById('upload-area');
const audioFileInput = document.getElementById('audio-file');
const audioInfo = document.getElementById('audio-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const changeFileBtn = document.getElementById('change-file');
const transcribeBtn = document.getElementById('transcribe-btn');
const processingState = document.getElementById('processing-state');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const transcriptionResult = document.getElementById('transcription-result');
const transcriptionContent = document.getElementById('transcription-content');
const audioPlayer = document.getElementById('audio-player');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');

// 模拟转录结果数据
const mockTranscription = `这是一个示例的音频转文字结果。
您可以在这里看到从音频中提取的文本内容。
系统会尽可能准确地将语音转换为文字，
但在某些情况下可能需要手动编辑和修正。

[00:00:15] 发言人1: 大家好，欢迎参加本次会议。
[00:00:25] 发言人2: 今天我们将讨论几个重要议题。
[00:01:10] 发言人1: 首先是关于上季度的销售数据。
[00:01:30] 发言人3: 我们的市场份额有了显著增长。`;

// 处理文件上传
uploadArea.addEventListener('click', () => {
    audioFileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('border-primary');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('border-primary');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('border-primary');
    
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

audioFileInput.addEventListener('change', () => {
    if (audioFileInput.files.length) {
        handleFile(audioFileInput.files[0]);
    }
});

// 更换文件
changeFileBtn.addEventListener('click', () => {
    audioFileInput.click();
});

let selectedFile = null;  // 新增：保存用户选择的音频文件

// 处理选择的文件（修改后）
function handleFile(file) {
    // 显示文件信息
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    audioInfo.classList.remove('hidden');
    
    // 启用转录按钮
    transcribeBtn.disabled = false;
    selectedFile = file;  // 保存文件对象
    
    // 设置音频播放器
    const audioUrl = URL.createObjectURL(file);
    audioPlayer.src = audioUrl;
}

// 开始转录（修改后）
transcribeBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        alert("请先选择音频文件");
        return;
    }

    // 隐藏结果，显示处理中状态
    transcriptionResult.classList.add('hidden');
    processingState.classList.remove('hidden');

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const audioData = e.target.result.split(',')[1];
            
            const response = await fetch('/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio_data: audioData })
            });
            
            const result = await response.json();
            if (response.ok) {
                // 格式化带时间戳的转录结果（新增）
                const formattedText = result.segments.map(seg => {
                    const start = new Date(seg.start * 1000).toISOString().substr(14, 5); // 转换为00:00格式
                    const end = new Date(seg.end * 1000).toISOString().substr(14, 5);
                    return `[${start}-${end}] ${seg.text}`;
                }).join('\n');
                
                transcriptionContent.textContent = formattedText; // 显示带时间戳的内容
            } else {
                transcriptionContent.textContent = `错误：${result.detail}`;
            }
            
            processingState.classList.add('hidden');
            transcriptionResult.classList.remove('hidden');
        };
        reader.readAsDataURL(selectedFile);
    } catch (error) {
        processingState.classList.add('hidden');
        transcriptionContent.textContent = `错误：${error.message}`;
        transcriptionResult.classList.remove('hidden');
    }
});

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 复制到剪贴板
copyBtn.addEventListener('click', () => {
    const text = transcriptionContent.textContent;
    navigator.clipboard.writeText(text).then(() => {
        // 显示复制成功提示
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fa fa-check"></i>';
        copyBtn.classList.add('text-secondary');
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.classList.remove('text-secondary');
        }, 2000);
    });
});

// 下载文本
downloadBtn.addEventListener('click', () => {
    const text = transcriptionContent.textContent;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});