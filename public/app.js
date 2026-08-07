document.addEventListener('DOMContentLoaded', () => {
  const setupCard = document.getElementById('setupCard');
  const questionCard = document.getElementById('questionCard');
  const jobDescriptionEl = document.getElementById('jobDescription');
  const startSetupBtn = document.getElementById('startSetupBtn');

  const questionCategoryEl = document.getElementById('questionCategory');
  const questionTextEl = document.getElementById('questionText');
  const followUpBadge = document.getElementById('followUpBadge');
  const recordBtn = document.getElementById('recordBtn');
  const statusEl = document.getElementById('status');
  const waveformCanvas = document.getElementById('waveformCanvas');
  const canvasCtx = waveformCanvas.getContext('2d');
  
  const progressText = document.getElementById('progressText');
  const progressBar = document.getElementById('progressBar');
  
  const feedbackCard = document.getElementById('feedbackCard');
  const transcriptDisplay = document.getElementById('transcriptDisplay');
  const specificityBar = document.getElementById('specificityBar');
  const specificityLabel = document.getElementById('specificityLabel');
  const relevanceBar = document.getElementById('relevanceBar');
  const relevanceLabel = document.getElementById('relevanceLabel');
  const structureBar = document.getElementById('structureBar');
  const structureLabel = document.getElementById('structureLabel');
  const feedbackList = document.getElementById('feedbackList');
  const rewriteSection = document.getElementById('rewriteSection');
  const rewriteText = document.getElementById('rewriteText');
  
  const agentTraceSection = document.getElementById('agentTraceSection');
  const agentFiredList = document.getElementById('agentFiredList');
  const agentReasoningText = document.getElementById('agentReasoningText');

  const nextBtn = document.getElementById('nextBtn');
  const continueBtn = document.getElementById('continueBtn');
  
  // Completion Card Elements
  const completionCard = document.getElementById('completionCard');
  const avgSpecBar = document.getElementById('avgSpecBar');
  const avgSpecLabel = document.getElementById('avgSpecLabel');
  const avgRelBar = document.getElementById('avgRelBar');
  const avgRelLabel = document.getElementById('avgRelLabel');
  const avgStructBar = document.getElementById('avgStructBar');
  const avgStructLabel = document.getElementById('avgStructLabel');
  const weakestAreaLabel = document.getElementById('weakestAreaLabel');
  const perQuestionList = document.getElementById('perQuestionList');
  const practiceAgainBtn = document.getElementById('practiceAgainBtn');
  const aiSummarySection = document.getElementById('aiSummarySection');
  const aiSummaryText = document.getElementById('aiSummaryText');

  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;
  let liveAudioCtx;
  let analyser;

  let questions = [];
  let currentQuestionIndex = 0;
  
  // Follow-up state
  let isFollowUpPhase = false;
  let currentTranscript = "";
  
  // Session results for completion screen
  let sessionResults = [];

  startSetupBtn.addEventListener('click', async () => {
    const jobDescription = jobDescriptionEl.value.trim();
    startSetupBtn.disabled = true;
    startSetupBtn.textContent = "Starting...";

    try {
      if (jobDescription) {
        startSetupBtn.innerHTML = '<span class="spinner"></span> Generating tailored questions...';
        const response = await fetch('/api/interview/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription })
        });
        questions = await response.json();
      } else {
        // Fallback to static if empty
        const response = await fetch('/api/interview/questions');
        questions = await response.json();
      }

      setupCard.style.display = 'none';
      completionCard.style.display = 'none';
      questionCard.style.display = 'block';

      if (questions.length > 0) {
        showQuestion(0);
        recordBtn.disabled = false;
      } else {
        questionTextEl.textContent = "No questions found.";
      }
    } catch (err) {
      console.error(err);
      startSetupBtn.textContent = "Error! Try again.";
      startSetupBtn.disabled = false;
    }
  });

  function showQuestion(index) {
    if (index >= questions.length) {
      showCompletionScreen();
      return;
    }
    currentQuestionIndex = index;
    const q = questions[index];
    
    // Reset state for new base question
    isFollowUpPhase = false;
    currentTranscript = "";
    
    questionCategoryEl.textContent = `Category: ${q.category}`;
    questionTextEl.textContent = q.text;
    followUpBadge.style.display = 'none';
    
    // Update Progress
    const total = questions.length;
    progressText.textContent = `Question ${index + 1} of ${total}`;
    progressBar.style.width = `${((index + 1) / total) * 100}%`;
    
    // Reset UI
    feedbackCard.style.display = 'none';
    waveformCanvas.style.display = 'none';
    statusEl.textContent = "Ready";
    statusEl.style.display = 'block';
  }

  nextBtn.addEventListener('click', () => {
    showQuestion(currentQuestionIndex + 1);
  });

  continueBtn.addEventListener('click', async () => {
    try {
      feedbackCard.style.display = 'none';

      const followUpQuestionText = window.currentFollowUpQuestion || "Could you tell me more about that?";

      // Enter follow-up phase
      isFollowUpPhase = true;
      questionTextEl.textContent = followUpQuestionText;
      followUpBadge.style.display = 'inline-block';
      
      // Update Progress text for follow-up
      const total = questions.length;
      progressText.textContent = `Question ${currentQuestionIndex + 1} of ${total} (Follow-up)`;
      
      waveformCanvas.style.display = 'none';
      statusEl.textContent = "Ready";
      recordBtn.disabled = false;

    } catch (error) {
      console.error("Follow-up error:", error);
      statusEl.textContent = "Error: " + error.message;
      recordBtn.disabled = false;
    }
  });

  // --- Recording Logic ---
  recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  });

  async function startRecording() {
    try {
      feedbackCard.style.display = 'none';
      statusEl.style.display = 'block';
      statusEl.textContent = ""; 
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Brief delay to prevent mic initialization lag from clipping the first word
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Setup live audio visualization
      liveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = liveAudioCtx.createMediaStreamSource(stream);
      analyser = liveAudioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = handleStop;
      mediaRecorder.start();
      isRecording = true;
      
      // Start visualization
      waveformCanvas.style.display = 'block';
      drawWaveform();

      recordBtn.textContent = "Stop Recording";
      recordBtn.classList.replace('primary', 'danger');
      statusEl.textContent = "Recording...";
      statusEl.classList.add('recording');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      statusEl.textContent = "Error: Microphone access denied. Please allow microphone permissions and try again.";
      recordBtn.disabled = false;
      recordBtn.textContent = "Start Recording";
      recordBtn.classList.replace('danger', 'primary');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    isRecording = false;
    
    if (liveAudioCtx && liveAudioCtx.state !== 'closed') {
      liveAudioCtx.close();
    }
    
    recordBtn.textContent = "Start Recording";
    recordBtn.classList.replace('danger', 'primary');
    statusEl.innerHTML = '<span class="spinner"></span> Processing audio... (This may take a moment)';
    statusEl.classList.remove('recording');
  }

  function drawWaveform() {
    if (!isRecording) return; // Freezes the canvas state when false
    requestAnimationFrame(drawWaveform);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    canvasCtx.fillStyle = getComputedStyle(document.body).getPropertyValue('--paper') || '#F6F4EE';
    canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    
    const barWidth = (waveformCanvas.width / bufferLength) * 2.5;
    let x = 0;
    
    for(let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] / 2;
      canvasCtx.fillStyle = getComputedStyle(document.body).getPropertyValue('--teal') || '#4a7b76';
      canvasCtx.fillRect(x, waveformCanvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  }

  async function handleStop() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const pcmData = audioBuffer.getChannelData(0);
      
      let sumSquares = 0;
      for (let i = 0; i < pcmData.length; i++) {
        sumSquares += pcmData[i] * pcmData[i];
      }
      const rms = Math.sqrt(sumSquares / pcmData.length);
      console.log(`Calculated Audio RMS: ${rms}`);
      
      if (rms < 0.01) {
        statusEl.style.display = 'block';
        statusEl.textContent = "Error: Audio too short or empty — please record a longer message.";
        return; // Abort upload
      }
    } catch (err) {
      console.warn("Client-side silence check failed or not supported, proceeding with upload.", err);
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    
    // Always pass the current question text so the backend doesn't need to look it up 
    // (which fails for dynamically generated questions)
    formData.append('questionText', questionTextEl.textContent);
    formData.append('isFollowUp', isFollowUpPhase.toString());

    try {
      const response = await fetch('/api/interview/answer', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || result.error || 'Upload failed');
      }

      const data = result.data;
      
      statusEl.style.display = 'none';
      
      if (!isFollowUpPhase) {
        currentTranscript = data.transcript;
      }
      
      // Update UI with response
      transcriptDisplay.textContent = `"${data.transcript}"`;
      
      const specPct = Math.round((data.specificityScore || 0) * 100);
      specificityBar.style.width = `${specPct}%`;
      specificityLabel.textContent = `${specPct}%`;
      
      const relPct = Math.round((data.relevanceScore || 0) * 100);
      relevanceBar.style.width = `${relPct}%`;
      relevanceLabel.textContent = `${relPct}%`;
      
      const structPct = Math.round((data.structureScore || 0) * 100);
      structureBar.style.width = `${structPct}%`;
      structureLabel.textContent = `${structPct}%`;

      // Save to session results
      sessionResults.push({
        category: questions[currentQuestionIndex].category,
        isFollowUp: isFollowUpPhase,
        transcript: data.transcript,
        specPct,
        relPct,
        structPct
      });
      
      feedbackList.innerHTML = '';
      if (data.feedback && Array.isArray(data.feedback)) {
        data.feedback.forEach(point => {
          const li = document.createElement('li');
          li.textContent = point;
          feedbackList.appendChild(li);
        });
      }

      if (data.modelRewrite && data.modelRewrite.trim() !== '') {
        rewriteText.textContent = data.modelRewrite;
        rewriteSection.style.display = 'block';
        rewriteSection.removeAttribute('open'); // start collapsed
      } else {
        rewriteSection.style.display = 'none';
      }

      if (data.orchestratorReasoning) {
        agentTraceSection.style.display = 'block';
        agentTraceSection.removeAttribute('open');
        const firedAgents = ['EvaluatorAgent', 'CoachAgent'];
        if (data.askFollowUp) {
          firedAgents.push('InterviewerAgent');
        }
        agentFiredList.innerHTML = `<strong>Agents Fired:</strong> ${firedAgents.join(', ')}`;
        agentReasoningText.innerHTML = `<strong>Reasoning:</strong> ${data.orchestratorReasoning}`;
      } else {
        agentTraceSection.style.display = 'none';
      }

      // Save current followUpQuestion if needed
      if (data.askFollowUp && data.followUpQuestion) {
        window.currentFollowUpQuestion = data.followUpQuestion;
      } else {
        window.currentFollowUpQuestion = "";
      }

      // Toggle Continue vs Next Question button
      if (isFollowUpPhase) {
        continueBtn.style.display = 'none';
        nextBtn.style.display = 'inline-block';
      } else {
        if (data.askFollowUp === true) {
          continueBtn.style.display = 'inline-block';
          nextBtn.style.display = 'none';
        } else {
          continueBtn.style.display = 'none';
          nextBtn.style.display = 'inline-block';
        }
      }

      feedbackCard.style.display = 'block';
      
    } catch (error) {
      console.error("Upload error:", error);
      statusEl.style.display = 'block';
      statusEl.textContent = "Network error: " + error.message + ". Please check your connection and try again.";
      recordBtn.textContent = "Retry Recording";
    }
  }

  function showCompletionScreen() {
    questionCard.style.display = 'none';
    feedbackCard.style.display = 'none';
    completionCard.style.display = 'block';
    
    if (sessionResults.length === 0) return;

    let totalSpec = 0, totalRel = 0, totalStruct = 0;
    
    perQuestionList.innerHTML = '';

    sessionResults.forEach((result, idx) => {
      totalSpec += result.specPct;
      totalRel += result.relPct;
      totalStruct += result.structPct;

      const item = document.createElement('div');
      item.style.border = '1px solid var(--border-color)';
      item.style.padding = '1rem';
      item.style.borderRadius = '8px';
      item.style.background = 'var(--surface-color)';
      
      const title = result.isFollowUp ? `${result.category} (Follow-up)` : result.category;
      
      item.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.5rem;">${idx + 1}. ${title}</div>
        <div style="display: flex; gap: 1rem; font-size: 0.9rem; color: var(--muted-text);">
          <span>Spec: ${result.specPct}%</span>
          <span>Rel: ${result.relPct}%</span>
          <span>STAR: ${result.structPct}%</span>
        </div>
      `;
      perQuestionList.appendChild(item);
    });

    const avgSpec = Math.round(totalSpec / sessionResults.length);
    const avgRel = Math.round(totalRel / sessionResults.length);
    const avgStruct = Math.round(totalStruct / sessionResults.length);

    avgSpecBar.style.width = `${avgSpec}%`;
    avgSpecLabel.textContent = `${avgSpec}%`;
    avgRelBar.style.width = `${avgRel}%`;
    avgRelLabel.textContent = `${avgRel}%`;
    avgStructBar.style.width = `${avgStruct}%`;
    avgStructLabel.textContent = `${avgStruct}%`;

    // Find weakest
    const scores = [
      { name: 'Specificity', val: avgSpec },
      { name: 'Relevance', val: avgRel },
      { name: 'Structure (STAR)', val: avgStruct }
    ];
    scores.sort((a, b) => a.val - b.val);
    const weakest = scores[0];
    
    weakestAreaLabel.textContent = `Focus Area: ${weakest.name} was your lowest-scoring area this session (${weakest.val}%).`;

    // Async call for AI Summary (Stretch Goal)
    aiSummarySection.style.display = 'none';
    aiSummaryText.textContent = '';
    
    fetch('/api/interview/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionResults })
    })
    .then(res => {
      if (!res.ok) throw new Error("Summary failed");
      return res.json();
    })
    .then(data => {
      if (data && data.summary) {
        aiSummaryText.textContent = data.summary;
        aiSummarySection.style.display = 'block';
      }
    })
    .catch(err => {
      console.warn("AI Summary stretch goal failed gracefully:", err);
    });
  }

  practiceAgainBtn.addEventListener('click', () => {
    // Reset state
    sessionResults = [];
    currentQuestionIndex = 0;
    questions = [];
    
    completionCard.style.display = 'none';
    setupCard.style.display = 'block';
    startSetupBtn.disabled = false;
    startSetupBtn.textContent = "Start Interview";
  });
});
