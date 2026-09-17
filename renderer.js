/* ==========================================================================
   CASSETTO - RENDERER ENGINE (AUDIO RECORDING, VU METER, WIN95 INTERFACE)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- UI Element References ---
  const btnMinimize = document.getElementById('btn-minimize');
  const btnMaximize = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');

  const menuFile = document.getElementById('menu-file');
  const menuOptions = document.getElementById('menu-options');
  const menuHelp = document.getElementById('menu-help');
  const optSave = document.getElementById('opt-save');
  const optOpenFolder = document.getElementById('opt-open-folder');
  const optExit = document.getElementById('opt-exit');
  const optCreateShortcut = document.getElementById('opt-create-shortcut');
  const optAudioStereo = document.getElementById('opt-audio-stereo');
  const optAudioMono = document.getElementById('opt-audio-mono');
  const optThemeWin95 = document.getElementById('opt-theme-win95');
  const optThemeWood = document.getElementById('opt-theme-wood');
  const optThemeCyberpunk = document.getElementById('opt-theme-cyberpunk');
  const optThemeStudio = document.getElementById('opt-theme-studio');
  const optThemeSkeleton = document.getElementById('opt-theme-skeleton');
  const optAbout = document.getElementById('opt-about');

  const timerDisplay = document.getElementById('timer-display');
  const lcdStatus = document.getElementById('lcd-status');
  const spoolLeft = document.getElementById('spool-left');
  const spoolRight = document.getElementById('spool-right');

  const audioInputSelect = document.getElementById('audio-input-select');
  const btnRefreshDevices = document.getElementById('btn-refresh-devices');

  const btnRecord = document.getElementById('btn-record');
  const btnPause = document.getElementById('btn-pause');
  const btnStop = document.getElementById('btn-stop');
  const btnPlay = document.getElementById('btn-play');
  const btnSave = document.getElementById('btn-save');

  const statusText = document.getElementById('status-text');
  const statusFormat = document.getElementById('status-format');
  const statusShortcut = document.getElementById('status-shortcut');

  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBodyText = document.getElementById('modal-body-text');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnModalOk = document.getElementById('btn-modal-ok');

  const vuBarL = document.getElementById('vu-bar-l');
  const vuBarR = document.getElementById('vu-bar-r');

  // --- State Variables ---
  let audioContext = null;
  let mediaStream = null;
  let sourceNode = null;
  let scriptProcessor = null;
  let analyserL = null;
  let analyserR = null;
  let splitter = null;

  let recordingState = 'idle'; // 'idle' | 'recording' | 'paused' | 'stopped'
  let isChannelStereo = true;
  let sampleRate = 44100;
  
  let leftPcmChunks = [];
  let rightPcmChunks = [];
  let totalSamplesRecorded = 0;

  let timerInterval = null;
  let elapsedMilliseconds = 0;
  let animFrameId = null;

  let recordedAudioBlob = null;
  let recordedAudioUrl = null;
  let lastSavedFilePath = null;
  let previewAudioElement = null;

  const NUM_LED_SEGMENTS = 16;

  // --- Initialize App ---
  initTheme();
  initVUGrid();
  initWindowControls();
  initMenus();
  enumerateAudioDevices();
  checkDesktopShortcutStatus();

  // --- VU LED Grid Initialization ---
  function initVUGrid() {
    vuBarL.innerHTML = '';
    vuBarR.innerHTML = '';
    for (let i = 0; i < NUM_LED_SEGMENTS; i++) {
      const segL = document.createElement('div');
      const segR = document.createElement('div');

      let colorClass = 'green';
      if (i >= 11 && i < 14) colorClass = 'yellow';
      else if (i >= 14) colorClass = 'red';

      segL.className = `led-segment ${colorClass}`;
      segR.className = `led-segment ${colorClass}`;
      segL.dataset.index = i;
      segR.dataset.index = i;

      vuBarL.appendChild(segL);
      vuBarR.appendChild(segR);
    }
  }

  // --- Audio Device Enumeration ---
  async function enumerateAudioDevices() {
    try {
      // Prompt permissions if needed
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop());
      }).catch(() => {});

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');

      audioInputSelect.innerHTML = '';
      if (audioInputs.length === 0) {
        audioInputSelect.innerHTML = '<option value="">Default Microphone</option>';
        return;
      }

      audioInputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${index + 1}`;
        audioInputSelect.appendChild(option);
      });
    } catch (err) {
      console.warn('Device enumeration warning:', err);
    }
  }

  btnRefreshDevices.addEventListener('click', enumerateAudioDevices);

  // --- Audio Recording & Web Audio Engine ---
  async function startRecording() {
    try {
      leftPcmChunks = [];
      rightPcmChunks = [];
      totalSamplesRecorded = 0;
      elapsedMilliseconds = 0;
      updateTimerDisplay();

      const deviceId = audioInputSelect.value;
      const constraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: isChannelStereo ? 2 : 1
        }
      };

      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
      sampleRate = audioContext.sampleRate;

      sourceNode = audioContext.createMediaStreamSource(mediaStream);

      // VU Meter Analysers
      splitter = audioContext.createChannelSplitter(2);
      analyserL = audioContext.createAnalyser();
      analyserR = audioContext.createAnalyser();

      analyserL.fftSize = 256;
      analyserR.fftSize = 256;

      sourceNode.connect(splitter);
      splitter.connect(analyserL, 0);
      if (isChannelStereo && sourceNode.channelCount > 1) {
        splitter.connect(analyserR, 1);
      } else {
        splitter.connect(analyserR, 0); // Duplicate left if mono source
      }

      // ScriptProcessor for PCM capture (4096 buffer size)
      const bufferSize = 4096;
      scriptProcessor = audioContext.createScriptProcessor(bufferSize, 2, 2);

      scriptProcessor.onaudioprocess = (e) => {
        if (recordingState !== 'recording') return;

        const left = e.inputBuffer.getChannelData(0);
        const right = isChannelStereo && e.inputBuffer.numberOfChannels > 1
          ? e.inputBuffer.getChannelData(1)
          : left;

        // Copy array buffers
        leftPcmChunks.push(new Float32Array(left));
        if (isChannelStereo) {
          rightPcmChunks.push(new Float32Array(right));
        }
        totalSamplesRecorded += left.length;
      };

      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      recordingState = 'recording';
      startTimer();
      startVUMeter();

      // UI updates
      btnRecord.disabled = true;
      btnPause.disabled = false;
      btnStop.disabled = false;
      btnPlay.disabled = true;
      btnSave.disabled = true;

      spoolLeft.classList.add('spinning');
      spoolRight.classList.add('spinning');
      lcdStatus.textContent = '● REC';
      lcdStatus.className = 'lcd-badge status-rec';
      statusText.textContent = 'Recording in progress...';
      updateFormatStatus();

    } catch (err) {
      console.error('Failed to start recording:', err);
      showModal('Recording Error', `Could not access microphone: ${err.message}`);
    }
  }

  function pauseRecording() {
    if (recordingState === 'recording') {
      recordingState = 'paused';
      stopTimer();
      spoolLeft.classList.remove('spinning');
      spoolRight.classList.remove('spinning');
      lcdStatus.textContent = '❚❚ PAUSED';
      lcdStatus.className = 'lcd-badge status-pause';
      btnPause.innerHTML = '<span class="icon-dot red-dot">●</span> Resume';
      statusText.textContent = 'Recording paused.';
    } else if (recordingState === 'paused') {
      recordingState = 'recording';
      startTimer();
      spoolLeft.classList.add('spinning');
      spoolRight.classList.add('spinning');
      lcdStatus.textContent = '● REC';
      lcdStatus.className = 'lcd-badge status-rec';
      btnPause.innerHTML = '<span class="icon-pause yellow-pause">❚❚</span> Pause';
      statusText.textContent = 'Recording resumed.';
    }
  }

  async function stopRecording() {
    if (recordingState === 'idle') return;

    recordingState = 'stopped';
    stopTimer();
    stopVUMeter();

    spoolLeft.classList.remove('spinning');
    spoolRight.classList.remove('spinning');
    lcdStatus.textContent = '■ STOPPED';
    lcdStatus.className = 'lcd-badge status-idle';

    if (scriptProcessor) scriptProcessor.disconnect();
    if (sourceNode) sourceNode.disconnect();
    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());

    // Generate WAV blob
    recordedAudioBlob = encodeWavBlob(leftPcmChunks, isChannelStereo ? rightPcmChunks : [], sampleRate, isChannelStereo);
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    recordedAudioUrl = URL.createObjectURL(recordedAudioBlob);

    // Update UI controls
    btnRecord.disabled = false;
    btnPause.disabled = true;
    btnPause.innerHTML = '<span class="icon-pause yellow-pause">❚❚</span> Pause';
    btnStop.disabled = true;
    btnPlay.disabled = false;
    btnSave.disabled = false;

    statusText.textContent = `Recording stopped. Size: ${formatBytes(recordedAudioBlob.size)}`;
  }

  // --- Real-Time Stereo VU Meter Renderer ---
  function startVUMeter() {
    const dataL = new Uint8Array(analyserL.frequencyBinCount);
    const dataR = new Uint8Array(analyserR.frequencyBinCount);

    function updateVU() {
      if (recordingState === 'idle') return;

      analyserL.getByteTimeDomainData(dataL);
      analyserR.getByteTimeDomainData(dataR);

      const levelL = calculatePeakLevel(dataL);
      const levelR = calculatePeakLevel(dataR);

      renderVUBars(vuBarL, levelL);
      renderVUBars(vuBarR, levelR);

      animFrameId = requestAnimationFrame(updateVU);
    }
    updateVU();
  }

  function stopVUMeter() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    renderVUBars(vuBarL, 0);
    renderVUBars(vuBarR, 0);
  }

  function calculatePeakLevel(dataArray) {
    let maxVal = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const abs = Math.abs(dataArray[i] - 128);
      if (abs > maxVal) maxVal = abs;
    }
    return Math.min(1, maxVal / 128);
  }

  function renderVUBars(container, normLevel) {
    const activeSegments = Math.round(normLevel * NUM_LED_SEGMENTS);
    const segments = container.children;
    for (let i = 0; i < segments.length; i++) {
      if (i < activeSegments) {
        segments[i].classList.add('active');
      } else {
        segments[i].classList.remove('active');
      }
    }
  }

  // --- Pure JS PCM WAV Encoder ---
  function encodeWavBlob(leftChunks, rightChunks, sampleRate, isStereo) {
    // Flatten Float32 arrays
    const numChannels = isStereo ? 2 : 1;
    let totalLength = 0;
    leftChunks.forEach(chunk => totalLength += chunk.length);

    const leftMerged = new Float32Array(totalLength);
    let offset = 0;
    leftChunks.forEach(chunk => {
      leftMerged.set(chunk, offset);
      offset += chunk.length;
    });

    let rightMerged = null;
    if (isStereo) {
      rightMerged = new Float32Array(totalLength);
      offset = 0;
      rightChunks.forEach(chunk => {
        rightMerged.set(chunk, offset);
        offset += chunk.length;
      });
    }

    // Interleave channels & convert Float32 to Int16
    const numSamples = totalLength * numChannels;
    const pcmBuffer = new Int16Array(numSamples);

    let pcmIndex = 0;
    for (let i = 0; i < totalLength; i++) {
      // Left channel
      let sL = Math.max(-1, Math.min(1, leftMerged[i]));
      pcmBuffer[pcmIndex++] = sL < 0 ? sL * 0x8000 : sL * 0x7FFF;

      if (isStereo) {
        let sR = Math.max(-1, Math.min(1, rightMerged[i]));
        pcmBuffer[pcmIndex++] = sR < 0 ? sR * 0x8000 : sR * 0x7FFF;
      }
    }

    // Build RIFF Header
    const dataByteLength = pcmBuffer.length * 2;
    const buffer = new ArrayBuffer(44 + dataByteLength);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataByteLength, true);
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
    view.setUint16(32, numChannels * 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample (16-bit)

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataByteLength, true);

    // Copy PCM data
    const pcmByteView = new Uint8Array(pcmBuffer.buffer);
    const wavUint8 = new Uint8Array(buffer, 44);
    wavUint8.set(pcmByteView);

    return new Blob([buffer], { type: 'audio/wav' });
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // --- Timer Controls ---
  function startTimer() {
    const startTime = Date.now() - elapsedMilliseconds;
    timerInterval = setInterval(() => {
      elapsedMilliseconds = Date.now() - startTime;
      updateTimerDisplay();
    }, 100);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
  }

  function updateTimerDisplay() {
    const totalSecs = Math.floor(elapsedMilliseconds / 1000);
    const msDigit = Math.floor((elapsedMilliseconds % 1000) / 100);

    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');

    timerDisplay.textContent = `${hrs}:${mins}:${secs}.${msDigit}`;
  }

  // --- File Saving & Playback ---
  async function saveWavFile() {
    if (!recordedAudioBlob) {
      showModal('Save Warning', 'No audio recording available to save.');
      return;
    }

    try {
      const buffer = await recordedAudioBlob.arrayBuffer();
      const defaultName = `Cassetto_${getTimestampStr()}.wav`;

      const result = await window.cassettoAPI.saveWavFile(buffer, defaultName);
      if (result.success) {
        lastSavedFilePath = result.filePath;
        statusText.textContent = `Saved: ${result.filePath}`;
        showModal('File Saved', `Audio successfully saved to:\n${result.filePath}`);
      }
    } catch (err) {
      console.error('Save error:', err);
      showModal('Save Error', `Failed to save file: ${err.message}`);
    }
  }

  function playPreview() {
    if (!recordedAudioUrl) return;

    if (previewAudioElement) {
      previewAudioElement.pause();
    }

    previewAudioElement = new Audio(recordedAudioUrl);
    previewAudioElement.play();

    spoolLeft.classList.add('spinning-fast');
    spoolRight.classList.add('spinning-fast');
    lcdStatus.textContent = '► PLAY';
    lcdStatus.className = 'lcd-badge status-play';
    statusText.textContent = 'Playing audio preview...';

    previewAudioElement.onended = () => {
      spoolLeft.classList.remove('spinning-fast');
      spoolRight.classList.remove('spinning-fast');
      lcdStatus.textContent = '■ STOPPED';
      lcdStatus.className = 'lcd-badge status-idle';
      statusText.textContent = 'Playback complete.';
    };
  }

  // --- Transport Event Listeners ---
  btnRecord.addEventListener('click', startRecording);
  btnPause.addEventListener('click', pauseRecording);
  btnStop.addEventListener('click', stopRecording);
  btnPlay.addEventListener('click', playPreview);
  btnSave.addEventListener('click', saveWavFile);

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key.toLowerCase() === 'r' && !btnRecord.disabled) startRecording();
    if (e.key.toLowerCase() === 'p' && !btnPause.disabled) pauseRecording();
    if (e.key.toLowerCase() === 's' && !btnStop.disabled) stopRecording();
  });

  // --- Desktop Shortcut & Permissions ---
  async function checkDesktopShortcutStatus() {
    try {
      const exists = await window.cassettoAPI.checkDesktopShortcut();
      updateShortcutStatus(exists);
    } catch (e) {
      updateShortcutStatus(false);
    }
  }

  async function createDesktopShortcut() {
    try {
      const result = await window.cassettoAPI.createDesktopShortcut();
      if (result.success) {
        updateShortcutStatus(true);
        showModal('Desktop Shortcut', 'Desktop shortcut created successfully!');
      } else {
        showModal('Shortcut Notice', `Could not create shortcut: ${result.message || 'Permission denied by policy'}`);
      }
    } catch (err) {
      showModal('Shortcut Error', `Failed to create desktop shortcut: ${err.message}`);
    }
  }

  function updateShortcutStatus(exists) {
    if (exists) {
      statusShortcut.textContent = '📌 Shortcut: Active';
      statusShortcut.title = 'Desktop shortcut is installed';
    } else {
      statusShortcut.textContent = '📌 Shortcut: None';
      statusShortcut.title = 'No desktop shortcut found. Click Options -> Create Desktop Shortcut';
    }
  }

  // --- Window Frame Controls ---
  function initWindowControls() {
    btnMinimize.addEventListener('click', () => window.cassettoAPI.minimizeWindow());
    btnMaximize.addEventListener('click', () => window.cassettoAPI.maximizeWindow());
    btnClose.addEventListener('click', () => window.cassettoAPI.closeWindow());
  }

  // --- Menu Bar Behavior ---
  function initMenus() {
    const menus = [
      { trigger: menuFile, dropdown: document.getElementById('dropdown-file') },
      { trigger: menuOptions, dropdown: document.getElementById('dropdown-options') },
      { trigger: menuHelp, dropdown: document.getElementById('dropdown-help') }
    ];

    menus.forEach(m => {
      m.trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = m.trigger.classList.contains('active');
        closeAllMenus();
        if (!isActive) m.trigger.classList.add('active');
      });
    });

    document.addEventListener('click', closeAllMenus);

    function closeAllMenus() {
      menus.forEach(m => m.trigger.classList.remove('active'));
    }

    // Options Menu Actions
    optSave.addEventListener('click', saveWavFile);
    optOpenFolder.addEventListener('click', () => {
      if (lastSavedFilePath) {
        window.cassettoAPI.showInFolder(lastSavedFilePath);
      } else {
        showModal('Open Folder', 'No file has been saved yet in this session.');
      }
    });
    optExit.addEventListener('click', () => window.cassettoAPI.closeWindow());
    optCreateShortcut.addEventListener('click', createDesktopShortcut);

    optAudioStereo.addEventListener('click', () => {
      isChannelStereo = true;
      optAudioStereo.textContent = '✓ Stereo (2 Channel)';
      optAudioMono.textContent = '  Mono (1 Channel)';
      updateFormatStatus();
    });

    optAudioMono.addEventListener('click', () => {
      isChannelStereo = false;
      optAudioStereo.textContent = '  Stereo (2 Channel)';
      optAudioMono.textContent = '✓ Mono (1 Channel)';
      updateFormatStatus();
    });

    optThemeWin95.addEventListener('click', () => setTheme('win95'));
    optThemeWood.addEventListener('click', () => setTheme('wood'));
    if (optThemeCyberpunk) optThemeCyberpunk.addEventListener('click', () => setTheme('cyberpunk'));
    if (optThemeStudio) optThemeStudio.addEventListener('click', () => setTheme('studio'));
    if (optThemeSkeleton) optThemeSkeleton.addEventListener('click', () => setTheme('skeleton'));

    optAbout.addEventListener('click', () => {
      showModal(
        'About Cassetto',
        `<h3>Cassetto</h3>
        <p>Portable WAV Audio Recorder built for simplicity and maximum compatibility.</p>
        <br>
        <p>• 16-Bit PCM Uncompressed WAV Encoding</p>
        <p>• Real-time Peak Stereo VU Meter</p>
        <p>• 5 Interface Themes (Win95, Luxury Wood, Cyberpunk Neon, Hi-Fi Studio, Clear Skeleton)</p>
        <p>• Auto Desktop Shortcut Creator</p>`
      );
    });
  }

  // --- Theme Management ---
  function initTheme() {
    const savedTheme = localStorage.getItem('cassetto_theme') || 'wood';
    setTheme(savedTheme);
  }

  function setTheme(themeName) {
    const validThemes = ['win95', 'wood', 'cyberpunk', 'studio', 'skeleton'];
    if (!validThemes.includes(themeName)) themeName = 'wood';

    validThemes.forEach(t => {
      document.body.classList.remove(`theme-${t}`);
    });

    if (themeName !== 'win95') {
      document.body.classList.add(`theme-${themeName}`);
    }

    if (optThemeWin95) optThemeWin95.textContent = `${themeName === 'win95' ? '✓' : ' '} Classic Windows 95`;
    if (optThemeWood) optThemeWood.textContent = `${themeName === 'wood' ? '✓' : ' '} Luxury Wood Veneer`;
    if (optThemeCyberpunk) optThemeCyberpunk.textContent = `${themeName === 'cyberpunk' ? '✓' : ' '} 80s Cyberpunk Neon`;
    if (optThemeStudio) optThemeStudio.textContent = `${themeName === 'studio' ? '✓' : ' '} Hi-Fi Studio Metallic`;
    if (optThemeSkeleton) optThemeSkeleton.textContent = `${themeName === 'skeleton' ? '✓' : ' '} Clear Skeleton Acrylic`;

    localStorage.setItem('cassetto_theme', themeName);
  }

  function updateFormatStatus() {
    statusFormat.textContent = `44.1 kHz, 16-Bit ${isChannelStereo ? 'Stereo' : 'Mono'}`;
  }

  // --- Modal Alert Helper ---
  function showModal(title, contentHtml) {
    modalTitle.textContent = title;
    modalBodyText.innerHTML = contentHtml;
    modalOverlay.classList.remove('hidden');
  }

  btnModalClose.addEventListener('click', () => modalOverlay.classList.add('hidden'));
  btnModalOk.addEventListener('click', () => modalOverlay.classList.add('hidden'));

  // Utility helpers
  function getTimestampStr() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
});
