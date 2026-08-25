/* =========================================================
   NAKHYAD Connect — script.js
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- 0) เสียงต้อนรับตอนเข้าเว็บไซต์ ---------- */
  const welcomeAudio = new Audio("audio/welcome.wav");
  welcomeAudio.volume = 0.8;

  welcomeAudio.play().catch(() => {
    const playOnFirstInteraction = () => {
      welcomeAudio.play().catch(() => {});
      document.removeEventListener("click", playOnFirstInteraction);
      document.removeEventListener("touchstart", playOnFirstInteraction);
      document.removeEventListener("keydown", playOnFirstInteraction);
    };
    document.addEventListener("click", playOnFirstInteraction, { once: true });
    document.addEventListener("touchstart", playOnFirstInteraction, { once: true });
    document.addEventListener("keydown", playOnFirstInteraction, { once: true });
  });

  /* ---------- 1) เมนูมือถือ (Nav Toggle) ---------- */
  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("mainNav");

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    mainNav.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => {
        mainNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  } // แก้ไข: ลบ }); ที่เกินออกตรงนี้

  /* ---------- 2) Scroll Reveal แบบเรียบง่าย ---------- */
  document.querySelectorAll(
    ".hero-copy, .chatbot-section, .report-section, .services-section, .service-card"
  ).forEach(el => el.classList.add("reveal"));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll(".reveal").forEach(el => revealObserver.observe(el));


  /* =========================================================
     3) AI CHATBOT (เชื่อมต่อ Gemini API)
     ========================================================= */

  const chatBody = document.getElementById("chatBody");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const typingIndicator = document.getElementById("typingIndicator");
  const chatStatus = document.getElementById("chatStatus");
  const quickQuestions = document.getElementById("quickQuestions");
  const autoSpeakToggle = document.getElementById("autoSpeakToggle");
  const micBtn = document.getElementById("micBtn");

  function detectPreferredVoiceGender(text) {
    if (/ครับ/.test(text)) return "male";
    if (/(ค่ะ|คะ)/.test(text)) return "female";
    return null;
  }

  function appendMessage(text, sender, voiceGender = null) {
    const row = document.createElement("div");
    row.className = `msg-row ${sender}`;

    const avatar = document.createElement("span");
    avatar.className = "msg-avatar";
    avatar.textContent = sender === "bot" ? "🤖" : "🙂";

    const bubble = document.createElement("div");
    bubble.className = `bubble ${sender === "bot" ? "bubble-bot" : "bubble-user"}`;
    bubble.style.whiteSpace = "pre-line";
    bubble.textContent = text;

    row.appendChild(avatar);
    row.appendChild(bubble);

    let speakerBtn = null;
    if (sender === "bot") {
      speakerBtn = addSpeakerButton(row, text, voiceGender);
    }

    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;

    if (sender === "bot" && autoSpeakToggle && autoSpeakToggle.checked) {
      speakText(text, speakerBtn, voiceGender);
    }
  }

  /* ---------- TEXT-TO-SPEECH ---------- */
  const synth = window.speechSynthesis;
  let thaiVoice = null;
  let thaiMaleVoice = null;
  let thaiFemaleVoice = null;
  let currentAudioEl = null;

  function pickThaiVoice() {
    if (!synth) return;
    const voices = synth.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith("th"));
    thaiVoice = voices[0] || null;
    thaiMaleVoice = voices.find(v => /pattara|male/i.test(v.name)) || null;
    thaiFemaleVoice = voices.find(v => /premwadee|female/i.test(v.name)) || null;
  }

  if (synth) {
    pickThaiVoice();
    synth.addEventListener("voiceschanged", pickThaiVoice);
  }

  function stopAnySpeaking() {
    if (currentAudioEl) {
      currentAudioEl.pause();
      currentAudioEl.currentTime = 0;
      currentAudioEl = null;
    }
    if (synth && (synth.speaking || synth.pending)) {
      synth.cancel();
    }
    document.querySelectorAll(".speak-btn.speaking").forEach(b => {
      b.classList.remove("speaking");
      b.textContent = "🔊";
      b.dataset.wasSpeaking = "false";
    });
  }

  function playGeminiAudio(base64Wav, btn) {
    const audio = new Audio(`data:audio/wav;base64,${base64Wav}`);
    currentAudioEl = audio;

    if (btn) btn.textContent = "⏸️";

    const resetBtn = () => {
      if (btn) {
        btn.classList.remove("speaking");
        btn.textContent = "🔊";
        btn.dataset.wasSpeaking = "false";
      }
      currentAudioEl = null;
    };

    audio.addEventListener("ended", resetBtn);
    audio.addEventListener("error", resetBtn);

    audio.play().catch(err => {
      console.warn("เล่นเสียงจาก Gemini TTS ไม่ได้:", err);
      resetBtn();
    });
  }

  function speakWithWebSpeech(text, btn, voiceGender = null) {
    if (!synth) {
      if (btn) {
        btn.classList.remove("speaking");
        btn.textContent = "🔊";
        btn.dataset.wasSpeaking = "false";
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";

    if (voiceGender === "male" && thaiMaleVoice) {
      utterance.voice = thaiMaleVoice;
    } else if (voiceGender === "female" && thaiFemaleVoice) {
      utterance.voice = thaiFemaleVoice;
    } else if (thaiVoice) {
      utterance.voice = thaiVoice;
    }

    utterance.rate = 1;

    if (btn) {
      btn.textContent = "⏸️";
      const resetBtn = () => {
        btn.classList.remove("speaking");
        btn.textContent = "🔊";
        btn.dataset.wasSpeaking = "false";
      };
      utterance.addEventListener("end", resetBtn);
      utterance.addEventListener("error", resetBtn);
    }

    setTimeout(() => synth.speak(utterance), 50);
  }

  async function speakText(text, btn, voiceGender = null) {
    const wasSpeakingThis = btn && btn.dataset.wasSpeaking === "true";

    stopAnySpeaking();

    if (wasSpeakingThis) return;

    if (btn) {
      btn.classList.add("speaking");
      btn.textContent = "⏳";
      btn.dataset.wasSpeaking = "true";
    }

    try {
      const response = await fetch("/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, gender: voiceGender })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Gemini TTS ไม่พร้อมใช้งาน");
      }

      playGeminiAudio(data.audioBase64, btn);

    } catch (error) {
      console.warn("Gemini TTS ใช้งานไม่ได้ สลับไปใช้ Web Speech API แทน:", error.message);
      speakWithWebSpeech(text, btn, voiceGender);
    }
  }

  function addSpeakerButton(row, text, voiceGender = null) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn speak-btn";
    btn.setAttribute("aria-label", "อ่านออกเสียงข้อความนี้");
    btn.textContent = "🔊";
    btn.dataset.wasSpeaking = "false";
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "14px";
    btn.style.marginLeft = "6px";
    btn.style.alignSelf = "center";
    btn.style.opacity = "0.7";

    btn.addEventListener("click", () => speakText(text, btn, voiceGender));

    row.appendChild(btn);
    return btn;
  }

  const initialBotRow = chatBody.querySelector(".msg-row.bot");
  if (initialBotRow) {
    const initialBubble = initialBotRow.querySelector(".bubble-bot");
    if (initialBubble) {
      addSpeakerButton(initialBotRow, initialBubble.textContent.trim());
    }
  }

  /* ---------- ฟังก์ชันส่งข้อความหา Gemini API ---------- */
  async function sendToBot(userText) {
    const voiceGender = detectPreferredVoiceGender(userText);

    appendMessage(userText, "user");
    chatInput.value = "";

    typingIndicator.hidden = false;
    chatStatus.textContent = "AI กำลังคิด...";
    chatBody.scrollTop = chatBody.scrollHeight;

    try {
      const apiKey = "AQ.Ab8RN6LZfoCy_55OdqeQbfvdzrEKK7cEz7YyikuSBSUaDQNkGQ"; 
      // แก้ไข: ใช้ Template Literal แทรก apiKey อย่างถูกต้อง
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: userText }]
          }]
        })
      });

      const rawData = await response.json();

      // เพิ่มการตรวจสอบ Response ว่ามีข้อมูลตอบกลับมาจริงหรือไม่
      if (!response.ok || !rawData.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error(rawData.error?.message || "ไม่ได้รับตอบกลับจาก Gemini API");
      }

      const botReply = rawData.candidates[0].content.parts[0].text;

      typingIndicator.hidden = true;
      chatStatus.textContent = "พร้อมให้บริการ";

      appendMessage(botReply, "bot", voiceGender);

    } catch (error) {
      console.error(error);
      typingIndicator.hidden = true;
      chatStatus.textContent = "เกิดข้อผิดพลาด";
      appendMessage("ไม่สามารถเชื่อมต่อ AI ได้: " + error.message, "bot", voiceGender);
    }
  }

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = chatInput.value.trim();
    if (!value) return;
    sendToBot(value);
  });

  quickQuestions.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      sendToBot(chip.dataset.q);
      document.getElementById("chatbot").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  /* ---------- ปุ่มไมโครโฟน ---------- */
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = "th-TH";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let isListening = false;

    micBtn.addEventListener("click", () => {
      if (isListening) {
        recognition.stop();
        return;
      }

      try {
        stopAnySpeaking();
        recognition.start();
      } catch (err) {
        console.warn("ไม่สามารถเริ่มฟังเสียงได้:", err);
      }
    });

    recognition.addEventListener("start", () => {
      isListening = true;
      micBtn.classList.add("listening");
      chatStatus.textContent = "🎤 กำลังฟัง... พูดได้เลยครับ";
    });

    recognition.addEventListener("result", (e) => {
      const transcript = e.results[0][0].transcript;
      chatInput.value = transcript;
      chatInput.focus();
    });

    recognition.addEventListener("end", () => {
      isListening = false;
      micBtn.classList.remove("listening");
      chatStatus.textContent = "พร้อมให้บริการ";
    });

    recognition.addEventListener("error", (e) => {
      isListening = false;
      micBtn.classList.remove("listening");
      chatStatus.textContent = "พร้อมให้บริการ";

      let message = "เกิดข้อผิดพลาดในการฟังเสียง กรุณาลองใหม่อีกครั้งครับ";

      switch (e.error) {
        case "no-speech":
          message = "ไม่ได้ยินเสียงพูด กรุณาลองพูดใหม่อีกครั้งครับ";
          break;
        case "audio-capture":
          message = "ไม่พบไมโครโฟน กรุณาตรวจสอบอุปกรณ์ของท่านครับ";
          break;
        case "not-allowed":
          message = "กรุณาอนุญาตให้เว็บไซต์นี้ใช้ไมโครโฟนก่อนนะครับ";
          break;
        case "network":
          message = "การเชื่อมต่อขัดข้อง กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ครับ";
          break;
      }

      appendMessage(message, "bot");
    });

  } else {
    micBtn.hidden = true;
  }

  /* ---------- 4) ระบบแจ้งปัญหา (Report Form) ---------- */
  const reportForm = document.getElementById("reportForm");
  const confirmCard = document.getElementById("confirmCard");
  const reportIdEl = document.getElementById("reportId");
  const reportSubmitBtn = reportForm.querySelector("button[type='submit']");

  reportForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(reportForm);
    const reportPayload = Object.fromEntries(formData.entries());

    const originalBtnText = reportSubmitBtn.textContent;
    reportSubmitBtn.disabled = true;
    reportSubmitBtn.textContent = "กำลังส่งเรื่อง...";

    try {
      const response = await fetch("/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(reportPayload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "ไม่สามารถบันทึกข้อมูลได้");
      }

      reportIdEl.textContent = data.reportId;

      confirmCard.hidden = false;
      confirmCard.scrollIntoView({ behavior: "smooth", block: "center" });
      reportForm.reset();

    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      reportSubmitBtn.disabled = false;
      reportSubmitBtn.textContent = originalBtnText;
    }
  });

});
