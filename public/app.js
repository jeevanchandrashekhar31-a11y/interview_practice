document.addEventListener('DOMContentLoaded', () => {
  const setupCard = document.getElementById('setupCard');
  const questionCard = document.getElementById('questionCard');
  const jobDescriptionEl = document.getElementById('jobDescription');
  const personaSelector = document.getElementById('personaSelector');
  const startSetupBtn = document.getElementById('startSetupBtn');

  const questionCategoryEl = document.getElementById('questionCategory');
  const questionTextEl = document.getElementById('questionText');
  const followUpBadge = document.getElementById('followUpBadge');
  const recordBtn = document.getElementById('recordBtn');
  const prevBtn = document.getElementById('prevBtn');
  const statusEl = document.getElementById('status');
  const waveformCanvas = document.getElementById('waveformCanvas');
  const canvasCtx = waveformCanvas.getContext('2d');
  
  const progressText = document.getElementById('progressText');
  const progressBar = document.getElementById('progressBar');
  
  const feedbackCard = document.getElementById('feedbackCard');
  const contradictionAlert = document.getElementById('contradictionAlert');
  const contradictionText = document.getElementById('contradictionText');
  const transcriptDisplay = document.getElementById('transcriptDisplay');
  const scorecardNoteText = document.getElementById('scorecardNoteText');
  const scorecardNoteContainer = document.getElementById('scorecardNoteContainer');
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
  const groundingTraceText = document.getElementById('groundingTraceText');
  const contradictionTraceText = document.getElementById('contradictionTraceText');

  const wpmLabel = document.getElementById('wpmLabel');
  const paceLabelText = document.getElementById('paceLabelText');
  const fillerCountLabel = document.getElementById('fillerCountLabel');
  const fillerRateLabel = document.getElementById('fillerRateLabel');
  const fillerLabelText = document.getElementById('fillerLabelText');

  const alignmentContainer = document.getElementById('alignmentContainer');
  const alignmentLabelText = document.getElementById('alignmentLabelText');
  const alignmentExplanationText = document.getElementById('alignmentExplanationText');

  // Grounding
  const groundingAlert = document.getElementById('groundingAlert');
  const nextBtn = document.getElementById('nextBtn');
  const continueBtn = document.getElementById('continueBtn');
  const feedbackPrevBtn = document.getElementById('feedbackPrevBtn');
  const retryBtn = document.getElementById('retryBtn');
  
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
  const downloadCardBtn = document.getElementById('downloadCardBtn');
  const shareCanvas = document.getElementById('shareCanvas');
  const aiSummarySection = document.getElementById('aiSummarySection');
  const aiSummaryText = document.getElementById('aiSummaryText');

  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;
  let recordingStartTime = 0;
  let liveAudioCtx;
  let analyser;

  let questions = [];
  let currentQuestionIndex = 0;
  
  // Follow-up state
  let isFollowUpPhase = false;
  let currentTranscript = "";
  
  // Session results for completion screen
  let sessionResults = [];
  let feedbackCache = {};
  
  let selectedPersona = 'generic';

  startSetupBtn.addEventListener('click', async () => {
    const jobDescription = jobDescriptionEl.value.trim();
    selectedPersona = personaSelector.value;
    
    startSetupBtn.disabled = true;
    startSetupBtn.textContent = "Starting...";

    try {
      if (jobDescription) {
        startSetupBtn.innerHTML = '<span class="spinner"></span> Generating tailored questions...';
        const response = await fetch('/api/interview/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription, persona: selectedPersona })
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
    
    if (index > 0) {
      prevBtn.style.display = 'inline-block';
    } else {
      prevBtn.style.display = 'none';
    }
    
    // Reset UI
    feedbackCard.style.display = 'none';
    waveformCanvas.style.display = 'none';
    statusEl.textContent = "Ready";
    statusEl.style.display = 'block';
    questionCard.style.display = 'block';
  }

  nextBtn.addEventListener('click', () => {
    showQuestion(currentQuestionIndex + 1);
  });

  prevBtn.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
      showQuestion(currentQuestionIndex - 1);
    }
  });

  feedbackPrevBtn.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
      showQuestion(currentQuestionIndex - 1);
    }
  });

  retryBtn.addEventListener('click', () => {
    // Clear history for this specific question
    delete feedbackCache[currentQuestionIndex];
    // We also need to remove it from sessionResults to prevent double-counting
    // Find the entry that matches this index. For simplicity, we just filter it out based on the questionText.
    // Actually, because follow-ups also get pushed, it's safer to remove all entries for this base question.
    const qText = questions[currentQuestionIndex].text;
    sessionResults = sessionResults.filter(r => r.questionText !== qText);
    
    // Show the recording screen again
    showQuestion(currentQuestionIndex);
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
      recordingStartTime = Date.now();
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

  
  function renderFeedback(data, isCached = false) {
    if (!isFollowUpPhase && !isCached) {
      currentTranscript = data.transcript;
    }
    
    transcriptDisplay.textContent = '"' + data.transcript + '"';

    if (data.scorecardNote && data.scorecardNote.trim() !== '') {
      scorecardNoteText.textContent = data.scorecardNote;
      scorecardNoteContainer.style.display = 'block';
    } else {
      scorecardNoteContainer.style.display = 'none';
    }

    const specPct = Math.round((data.specificityScore || 0) * 100);
    specificityBar.style.width = `${specPct}%`;
    specificityLabel.textContent = `${specPct}%`;
    
    const relPct = Math.round((data.relevanceScore || 0) * 100);
    relevanceBar.style.width = `${relPct}%`;
    relevanceLabel.textContent = `${relPct}%`;
    
    const structPct = Math.round((data.structureScore || 0) * 100);
    structureBar.style.width = `${structPct}%`;
    structureLabel.textContent = `${structPct}%`;

    wpmLabel.textContent = data.wpm || 0;
    paceLabelText.textContent = data.paceLabel || 'optimal';
    
    fillerCountLabel.textContent = data.fillerCount || 0;
    fillerRateLabel.textContent = data.fillerRate || 0;
    fillerLabelText.textContent = data.fillerLabel || 'clean';

    const paceColor = data.paceLabel === 'optimal' ? 'var(--primary-color)' : '#d97706';
    wpmLabel.parentElement.style.color = paceColor;
    paceLabelText.style.color = paceColor;

    const fillerColor = data.fillerLabel === 'clean' ? 'var(--primary-color)' : (data.fillerLabel === 'noticeable' ? '#d97706' : '#dc2626');
    fillerCountLabel.parentElement.style.color = fillerColor;
    fillerRateLabel.parentElement.style.color = fillerColor;
    fillerLabelText.style.color = fillerColor;

    if (!isCached) {
      sessionResults.push({
        category: questions[currentQuestionIndex].category,
        questionText: questionTextEl.textContent,
        isFollowUp: isFollowUpPhase,
        transcript: data.transcript,
        specPct,
        relPct,
        structPct,
        wpm: data.wpm || 0,
        fillerRate: data.fillerRate || 0
      });
      feedbackCache[currentQuestionIndex] = data;
      feedbackCache[currentQuestionIndex]._cachedIsFollowUpPhase = isFollowUpPhase;
      feedbackCache[currentQuestionIndex]._cachedCurrentTranscript = currentTranscript;
      feedbackCache[currentQuestionIndex]._cachedQuestionText = questionTextEl.textContent;
    } else {
      isFollowUpPhase = data._cachedIsFollowUpPhase || false;
      currentTranscript = data._cachedCurrentTranscript || '';
      questionTextEl.textContent = data._cachedQuestionText || questions[currentQuestionIndex].text;
    }
    
    if (data.alignmentLabel) {
      alignmentLabelText.textContent = data.alignmentLabel;
      alignmentExplanationText.textContent = data.alignmentExplanation;
      alignmentContainer.style.display = 'block';
    } else {
      alignmentContainer.style.display = 'none';
    }
    
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
      rewriteSection.removeAttribute('open');
    } else {
      rewriteSection.style.display = 'none';
    }

    if (data.contradictionFlag && data.contradictionNote) {
      contradictionText.textContent = data.contradictionNote;
      contradictionAlert.style.display = 'block';
    } else {
      contradictionAlert.style.display = 'none';
    }

    if (data.orchestratorReasoning || data.groundingPassed !== undefined || data.contradictionFlag !== undefined) {
      agentTraceSection.style.display = 'block';
      agentTraceSection.removeAttribute('open');
      
      if (data.orchestratorReasoning) {
        const firedAgents = ['EvaluatorAgent', 'CoachAgent'];
        if (data.askFollowUp) {
          firedAgents.push('InterviewerAgent');
        }
        agentFiredList.innerHTML = '<strong>Agents Fired:</strong> ' + firedAgents.join(', ');
        agentReasoningText.innerHTML = '<strong>Reasoning:</strong> ' + data.orchestratorReasoning;
      }

      if (data.groundingPassed !== undefined) {
        if (data.groundingPassed) {
          groundingTraceText.innerHTML = '<strong>Grounding check:</strong> passed';
          groundingTraceText.style.color = 'inherit';
        } else {
          const claims = data.unsupportedClaims || [];
          groundingTraceText.innerHTML = '<strong>Grounding check:</strong> flagged unsupported claims - [' + claims.join(', ') + ']';
          groundingTraceText.style.color = '#d97706';
        }
        groundingTraceText.style.display = 'block';
      } else {
        groundingTraceText.style.display = 'none';
      }

      if (data.contradictionFlag !== undefined) {
        contradictionTraceText.innerHTML = '<strong>Contradiction check:</strong> ' + (data.contradictionFlag ? '<span style="color: #dc2626;">flagged (' + data.contradictionNote + ')</span>' : 'passed');
        contradictionTraceText.style.display = 'block';
      } else {
        contradictionTraceText.style.display = 'none';
      }
    } else {
      agentTraceSection.style.display = 'none';
    }

    if (data.askFollowUp && data.followUpQuestion) {
      window.currentFollowUpQuestion = data.followUpQuestion;
    } else {
      window.currentFollowUpQuestion = '';
    }

    if (isCached) {
      retryBtn.style.display = 'inline-block';
      continueBtn.style.display = 'none';
      nextBtn.style.display = 'inline-block';
      
      if (currentQuestionIndex > 0) {
        feedbackPrevBtn.style.display = 'inline-block';
      } else {
        feedbackPrevBtn.style.display = 'none';
      }
    } else {
      retryBtn.style.display = 'none';
      feedbackPrevBtn.style.display = 'none';
      
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
    }

    questionCard.style.display = 'none';
    feedbackCard.style.display = 'block';
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
    
    const durationSeconds = (Date.now() - recordingStartTime) / 1000;

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('durationSeconds', durationSeconds.toString());
    
    const priorHistory = sessionResults.map(r => ({ questionText: r.questionText, transcript: r.transcript }));
    formData.append('priorHistory', JSON.stringify(priorHistory));
    
    // Always pass the current question text so the backend doesn't need to look it up 
    // (which fails for dynamically generated questions)
    formData.append('questionText', questionTextEl.textContent);
    formData.append('isFollowUp', isFollowUpPhase.toString());
    formData.append('persona', selectedPersona);

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
      
      renderFeedback(data, false);

      
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

    perQuestionList.innerHTML = '';

    let totalSpec = 0;
    let totalRel = 0;
    let totalStruct = 0;
    let totalWpm = 0;
    let totalFillerRate = 0;

    sessionResults.forEach((r, idx) => {
      totalSpec += r.specPct;
      totalRel += r.relPct;
      totalStruct += r.structPct;
      totalWpm += r.wpm;
      totalFillerRate += r.fillerRate;

      const item = document.createElement('div');
      item.style.border = '1px solid var(--border-color)';
      item.style.padding = '1rem';
      item.style.borderRadius = '8px';
      item.style.background = 'var(--surface-color)';
      
      const title = r.isFollowUp ? `${r.category} (Follow-up)` : r.category;
      
      item.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.5rem;">${idx + 1}. ${title}</div>
        <div style="display: flex; gap: 1rem; font-size: 0.9rem; color: var(--muted-text);">
          <span>Spec: ${r.specPct}%</span>
          <span>Rel: ${r.relPct}%</span>
          <span>STAR: ${r.structPct}%</span>
        </div>
      `;
      perQuestionList.appendChild(item);
    });

    const avgSpec = Math.round(totalSpec / sessionResults.length);
    const avgRel = Math.round(totalRel / sessionResults.length);
    const avgStruct = Math.round(totalStruct / sessionResults.length);
    const avgWpm = Math.round(totalWpm / sessionResults.length);
    const avgFillerRate = Math.round(totalFillerRate / sessionResults.length);

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
    .then(res => res.json())
    .then(result => {
      if(result.summary) {
        aiSummaryText.textContent = result.summary;
        aiSummarySection.style.display = 'block';
      }
    })
    .catch(err => {
      console.error('Failed to get AI summary', err);
    });
  }

  downloadCardBtn.addEventListener('click', () => {
    generateAndDownloadShareableCard();
  });

  function generateAndDownloadShareableCard() {
    const ctx = shareCanvas.getContext('2d');
    const width = shareCanvas.width;
    const height = shareCanvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#1e1b4b'; // Dark indigo background
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Interview Practice Results', width / 2, 80);

    // Persona
    const personaLabel = personaSelector.options[personaSelector.selectedIndex].text;
    ctx.font = '500 24px "Inter", sans-serif';
    ctx.fillStyle = '#a5b4fc';
    ctx.fillText(`Persona: ${personaLabel}`, width / 2, 130);

    // Decorative line
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(100, 160);
    ctx.lineTo(width - 100, 160);
    ctx.stroke();

    // Stats Grid
    const overallScore = Math.round(sessionResults.reduce((acc, r) => acc + (r.specPct + r.relPct + r.structPct)/3, 0) / sessionResults.length);
    const weakestArea = document.getElementById('weakestAreaLabel').textContent.replace('Focus Area: ', '').split(' was')[0];
    const alignmentText = document.getElementById('overallAlignmentLabelText').textContent;

    // Box 1: Overall Score
    drawStatBox(ctx, width/2 - 170, 220, 150, 150, 'Overall Score', `${overallScore}%`, overallScore >= 80 ? '#22c55e' : (overallScore >= 60 ? '#eab308' : '#ef4444'));

    // Box 2: Questions Answered
    drawStatBox(ctx, width/2 + 20, 220, 150, 150, 'Questions', `${sessionResults.length}`, '#6366f1');

    // Box 3: Weakest Area
    drawStatBox(ctx, width/2 - 250, 410, 500, 120, 'Needs Focus', weakestArea, '#f43f5e');

    // Box 4: Alignment
    drawStatBox(ctx, width/2 - 250, 570, 500, 120, 'Delivery vs Content', alignmentText, '#0ea5e9');

    // Footer
    ctx.font = '400 20px "Inter", sans-serif';
    ctx.fillStyle = '#6366f1';
    ctx.fillText('Generated by Adk Interview Coach', width / 2, 850);

    // Download
    const dataUrl = shareCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `interview-results-${new Date().toISOString().split('T')[0]}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function drawStatBox(ctx, x, y, w, h, title, value, color) {
    ctx.fillStyle = '#312e81';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = '600 18px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title.toUpperCase(), x + w/2, y + 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + (h > 120 ? '48px' : '36px') + ' "Inter", sans-serif';
    ctx.fillText(value, x + w/2, y + h/2 + 25);
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
