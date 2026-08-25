/* =========================================================
   NAKHYAD Connect — script.js
   Prototype logic: จำลองการทำงานของ AI Chatbot และฟอร์มแจ้งปัญหา
   ยังไม่เชื่อมต่อ Backend/API จริง (ดูจุดเตรียมเชื่อมต่อด้านล่าง)
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- 0) เสียงต้อนรับตอนเข้าเว็บไซต์ ---------- */
  const welcomeAudio = new Audio("audio/welcome.wav");
  welcomeAudio.volume = 0.8;

  welcomeAudio.play().catch(() => {
    // เบราว์เซอร์บล็อก autoplay เพราะยังไม่มีการคลิก/แตะจากผู้ใช้เลย
    // ให้รอจนผู้ใช้มีปฏิสัมพันธ์กับหน้าเว็บครั้งแรก แล้วเล่นเสียงทันที
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

}
  });

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
     3) AI CHATBOT (จำลองด้วย Keyword Matching)
     ---------------------------------------------------------
     ในเวอร์ชันจริง ให้แทนที่ฟังก์ชัน getBotReply() ด้วยการเรียก
     AI API (เช่น Anthropic API) โดยส่งข้อความผู้ใช้ไปประมวลผล
     แล้วรับคำตอบกลับมาแสดงแทน
     ========================================================= */

  const chatBody = document.getElementById("chatBody");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const typingIndicator = document.getElementById("typingIndicator");
  const chatStatus = document.getElementById("chatStatus");
  const quickQuestions = document.getElementById("quickQuestions");
  const autoSpeakToggle = document.getElementById("autoSpeakToggle");
  const micBtn = document.getElementById("micBtn");

  // ฐานความรู้จำลอง (Prototype Knowledge Base)
  // TODO: ในระบบจริง เนื้อหานี้ควรดึงจาก Google Sheets หรือฐานข้อมูลของเทศบาล
  const knowledgeBase = [
    {
      keywords: ["ขยะ", "เก็บขยะ", "รถขยะ"],
      reply: "การจัดเก็บขยะแบ่งตามโซนดังนี้ครับ 🚛\n• จันทร์ พุธ ศุกร์ — โซนตลาดและชุมชนใน\n• อังคาร พฤหัสฯ เสาร์ — โซนหมู่บ้านรอบนอก\nกรุณานำขยะออกมาวางก่อนเวลา 07.00 น."
    },
    {
      keywords: ["ภาษี", "ชำระภาษี", "เสียภาษี"],
      reply: "สามารถชำระภาษีที่ดินและสิ่งปลูกสร้าง หรือภาษีป้าย ได้ที่กองคลัง ชั้น 1 สำนักงานเทศบาลตำบลนาขยาด ในวันและเวลาราชการ (จันทร์–ศุกร์ 08.30–16.30 น.)"
    },
    {
      keywords: ["ไฟถนน", "ไฟดับ", "ไฟส่องสว่าง"],
      reply: "หากพบไฟถนนเสียหรือดับ แนะนำให้แจ้งผ่านระบบ “แจ้งปัญหา” ด้านล่างของหน้านี้ พร้อมระบุตำแหน่งให้ชัดเจน เจ้าหน้าที่กองช่างจะดำเนินการซ่อมแซมโดยเร็วครับ"
    },
    {
      keywords: ["ติดต่อ", "เบอร์โทร", "โทรศัพท์"],
      reply: "ติดต่อเทศบาลตำบลนาขยาดได้ที่เบอร์ 0-XXXX-XXXX ในวันจันทร์–ศุกร์ เวลา 08.30–16.30 น. หรือดูรายละเอียดเพิ่มเติมได้ที่ส่วนท้ายของหน้านี้ครับ"
    },
    {
      keywords: ["ถนนชำรุด", "ถนนพัง", "หลุมถนน"],
      reply: "กรณีถนนชำรุดหรือมีหลุมบ่อ กรุณาแจ้งผ่านแบบฟอร์ม “แจ้งปัญหา” พร้อมระบุจุดเกิดเหตุ เพื่อให้เจ้าหน้าที่ลงพื้นที่ตรวจสอบครับ"
    },
    {
      keywords: ["น้ำประปา", "น้ำไม่ไหล", "ประปา"],
      reply: "ปัญหาน้ำประปาสามารถแจ้งผ่านระบบแจ้งปัญหา โดยเลือกประเภท “น้ำประปา” เจ้าหน้าที่การประปาจะติดต่อกลับเพื่อตรวจสอบครับ"
    }
  ];

  const fallbackReply = "ขออภัย ขณะนี้ยังไม่พบข้อมูลสำหรับคำถามนี้ ระบบจะบันทึกคำถามไว้เพื่อให้เจ้าหน้าที่ตรวจสอบ";

  // ตรวจเพศผู้ถามจากคำลงท้ายสุภาพในภาษาไทย เพื่อเลือกเสียง AI ให้ตรงกัน
  // "ครับ" → ชาย, "ค่ะ"/"คะ" → หญิง, ถ้าตรวจไม่เจอ (พิมพ์สั้นๆ ไม่มีคำลงท้าย) คืนค่า null
  // ให้ backend ใช้เสียง default (หญิง) แทน
  function detectPreferredVoiceGender(text) {
    if (/ครับ/.test(text)) return "male";
    if (/(ค่ะ|คะ)/.test(text)) return "female";
    return null;
  }

  // ค้นหาคำตอบจาก Keyword ในฐานความรู้จำลอง
  function getBotReply(userText) {
    const text = userText.toLowerCase();
    const matched = knowledgeBase.find(item =>
      item.keywords.some(k => text.includes(k))
    );
    return matched ? matched.reply : fallbackReply;
  }

  // เพิ่มข้อความลงในหน้าต่างแชต
  // voiceGender: "male" | "female" | null — เพศที่ตรวจจับได้จากคำถามของผู้ใช้ ใช้เลือกเสียง AI ตอนอ่านออกเสียง
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

    // อ่านออกเสียงอัตโนมัติถ้าผู้ใช้เปิด toggle ไว้
    if (sender === "bot" && autoSpeakToggle && autoSpeakToggle.checked) {
      speakText(text, speakerBtn, voiceGender);
    }
  }

  /* =========================================================
     TEXT-TO-SPEECH (Gemini TTS ก่อน → Web Speech API เป็น fallback)
     ---------------------------------------------------------
     ลำดับการทำงาน:
     1) ยิงไป backend "/tts" ให้ Gemini สร้างเสียงจริง (เป็นธรรมชาติกว่า)
     2) ถ้า Gemini ใช้งานไม่ได้ (โควต้าหมด/error ใดๆ) สลับไปใช้
        Web Speech API ของเบราว์เซอร์ทันที ผู้ใช้จะไม่เจอความเงียบ
     ========================================================= */
  const synth = window.speechSynthesis;
  let thaiVoice = null;       // เสียงไทยเริ่มต้น (เผื่อแยกชาย/หญิงไม่ได้)
  let thaiMaleVoice = null;   // เสียงไทยที่พอเดาได้ว่าเป็นชาย เช่น "Pattara"
  let thaiFemaleVoice = null; // เสียงไทยที่พอเดาได้ว่าเป็นหญิง เช่น "Premwadee"
  let currentAudioEl = null;  // เสียงที่กำลังเล่นอยู่จาก Gemini TTS (ถ้ามี)

  function pickThaiVoice() {
    if (!synth) return;
    const voices = synth.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith("th"));
    thaiVoice = voices[0] || null;
    // เดาเพศจากชื่อเสียงที่พบบ่อย (เช่นเสียงไทยของ Windows/Edge: Pattara = ชาย, Premwadee = หญิง)
    thaiMaleVoice = voices.find(v => /pattara|male/i.test(v.name)) || null;
    thaiFemaleVoice = voices.find(v => /premwadee|female/i.test(v.name)) || null;
  }

  if (synth) {
    pickThaiVoice();
    // เสียงบางตัวโหลดหลัง DOMContentLoaded เล็กน้อย ต้องรอ event นี้ด้วย
    synth.addEventListener("voiceschanged", pickThaiVoice);
  }

  // หยุดเสียงที่กำลังเล่นอยู่ทั้งหมด ไม่ว่าจะมาจาก Gemini TTS หรือ Web Speech API
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

  // เล่นเสียง WAV (base64) ที่ได้จาก Gemini TTS
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

  // Fallback: อ่านออกเสียงด้วย Web Speech API ของเบราว์เซอร์
  function speakWithWebSpeech(text, btn, voiceGender = null) {
    if (!synth) {
      // เบราว์เซอร์ไม่รองรับทั้ง Gemini TTS (โหลดไม่สำเร็จ) และ Web Speech เลย
      if (btn) {
        btn.classList.remove("speaking");
        btn.textContent = "🔊";
        btn.dataset.wasSpeaking = "false";
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";

    // เลือกเสียงตามเพศที่ตรวจจับได้ ถ้าเบราว์เซอร์มีเสียงไทยแยกชาย/หญิงให้เลือก
    // ถ้าไม่มี ใช้เสียงไทย default (thaiVoice) แทน — ดีกว่าไม่มีเสียงเลย
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

    // Chrome มีบั๊กที่ถ้าเรียก speak() ทันทีหลัง cancel() เสียงมักจะไม่ออก
    setTimeout(() => synth.speak(utterance), 50);
  }

  // ฟังก์ชันหลักที่เรียกใช้จากปุ่มลำโพง / auto-read
  // voiceGender: "male" | "female" | null — ถ้า null ฝั่ง backend จะใช้เสียง default (หญิง)
  async function speakText(text, btn, voiceGender = null) {
    const wasSpeakingThis = btn && btn.dataset.wasSpeaking === "true";

    stopAnySpeaking();

    // ถ้ากดปุ่มเดิมซ้ำระหว่างกำลังพูดอยู่ ให้แค่หยุด ไม่พูดซ้ำ
    if (wasSpeakingThis) return;

    if (btn) {
      btn.classList.add("speaking");
      btn.textContent = "⏳"; // กำลังโหลดเสียงจาก Gemini
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

  // สร้างปุ่มลำโพงเล็กๆ ต่อท้ายข้อความของ AI แต่ละบับเบิล
  function addSpeakerButton(row, text, voiceGender = null) {
    // แสดงปุ่มเสมอ แม้เบราว์เซอร์จะไม่รองรับ Web Speech API ก็ตาม
    // เพราะ Gemini TTS (ฝั่ง backend) ไม่ต้องพึ่งความสามารถของเบราว์เซอร์เลย
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

  // เพิ่มปุ่มลำโพงให้ข้อความต้อนรับที่มีอยู่แล้วใน HTML ตั้งแต่แรก
  const initialBotRow = chatBody.querySelector(".msg-row.bot");
  if (initialBotRow) {
    const initialBubble = initialBotRow.querySelector(".bubble-bot");
    if (initialBubble) {
      addSpeakerButton(initialBotRow, initialBubble.textContent.trim());
    }
  }


async function sendToBot(userText) {

    // ตรวจเพศจากคำลงท้ายในคำถาม เพื่อเลือกเสียง AI ตอบให้ตรงกัน
    const voiceGender = detectPreferredVoiceGender(userText);

    appendMessage(userText, "user");
    chatInput.value = "";

    typingIndicator.hidden = false;
    chatStatus.textContent = "AI กำลังคิด...";
    chatBody.scrollTop = chatBody.scrollHeight;

    try {

         const apiKey = "ใส่_API_KEY_ของคุณที่นี่"; // นำ API Key จาก Google AI Studio มาใส่
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: userText }] // ตัวแปร userText ดึงมาจากโค้ดเดิมของคุณ
            }]
        })
    });

    const rawData = await response.json();
    
    // ดึงข้อความตอบกลับจากโครงสร้างของ Gemini
    const botReply = rawData.candidates[0].content.parts[0].text;

    // สร้างตัวแปร data จำลองขึ้นมา เพื่อให้โค้ดบรรทัดล่างๆ ของคุณทำงานต่อได้โดยไม่ต้องแก้เพิ่ม
    const data = {
        message: botReply,
        reply: botReply,
        response: botReply,
        text: botReply
    };
        const data = await response.json();

        typingIndicator.hidden = true;
        chatStatus.textContent = "พร้อมให้บริการ";

        appendMessage(data.reply, "bot", voiceGender);

    } catch (error) {

        console.error(error);

        typingIndicator.hidden = true;
        chatStatus.textContent = "เกิดข้อผิดพลาด";

        appendMessage("❌ ไม่สามารถเชื่อมต่อ AI ได้", "bot", voiceGender);

    }

}
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = chatInput.value.trim();
    if (!value) return;
    sendToBot(value);
  });

  // ปุ่มคำถามด่วน
  quickQuestions.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      sendToBot(chip.dataset.q);
      document.getElementById("chatbot").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  /* ---------- ปุ่มไมโครโฟน (Web Speech API หากรองรับ) ---------- */
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = "th-TH";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let isListening = false;

    micBtn.addEventListener("click", () => {
      if (isListening) {
        // กดซ้ำระหว่างกำลังฟังอยู่ → หยุดฟังทันที
        recognition.stop();
        return;
      }

      try {
        stopAnySpeaking(); // หยุดเสียง AI ที่กำลังอ่านอยู่ (ทั้ง Gemini TTS และ Web Speech) กันไมค์ดักเสียงตัวเอง
        recognition.start();
      } catch (err) {
        // ป้องกันกรณีเรียก start() ซ้อนกัน (เบราว์เซอร์บางตัว throw error)
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
          message = "กรุณาอนุญาตให้เว็บไซต์นี้ใช้ไมโครโฟนก่อนนะครับ (ดูไอคอนไมค์/กุญแจบนแถบที่อยู่เว็บ)";
          break;
        case "network":
          message = "การเชื่อมต่อขัดข้อง กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ครับ";
          break;
      }

      appendMessage(message, "bot");
    });

  } else {
    // เบราว์เซอร์ไม่รองรับการพูด (เช่น Firefox/Safari บางเวอร์ชัน) ซ่อนปุ่มไมค์เพื่อไม่ให้ผู้ใช้สับสน
    micBtn.hidden = true;
  }


  /* =========================================================
     4) ระบบแจ้งปัญหา (Report Form)
     ---------------------------------------------------------
     ในระบบจริง ให้ส่งข้อมูลฟอร์มไปยัง Google Sheets (ผ่าน Apps
     Script Web App) หรือฐานข้อมูลของเทศบาล แทนการจำลองด้วย
     ตัวเลขรันนิ่งในเครื่อง
     ========================================================= */

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

;
