require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();

// ==============================
// Middleware
// ==============================
app.use(cors());
app.use(express.json());

// เปิดโฟลเดอร์ public
app.use(express.static(path.join(__dirname, "public")));

// ==============================
// Gemini
// ==============================
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});
const {
    getKnowledgeBase,
    saveProblem,
    saveUnknownQuestion
} = require("./services/sheets");

// ==============================
// รายชื่อโมเดลที่จะลองใช้ตามลำดับ
// ถ้าตัวแรกใช้ไม่ได้ (เช่นถูกปิดใช้งานกะทันหัน)
// ระบบจะลองตัวถัดไปอัตโนมัติ
// ==============================
const MODEL_CANDIDATES = [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash"
];

// error ที่ควรลองโมเดลถัดไป (ไม่ใช่ error ที่แก้ด้วยการลองซ้ำไม่ได้ เช่น API key ผิด)
const RETRYABLE_STATUSES = [404, 429, 503];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ฟังก์ชันกลางสำหรับเรียก Gemini พร้อม fallback
async function generateWithFallback(prompt) {
    let lastError;

    for (const model of MODEL_CANDIDATES) {

        // ลองโมเดลนี้สูงสุด 2 ครั้ง (เผื่อ 503 เป็นปัญหาชั่วคราวแค่แว้บเดียว)
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: prompt
                });
                return { text: response.text, modelUsed: model };
            } catch (error) {
                lastError = error;
                const status = error?.status || error?.error?.code;

                if (!RETRYABLE_STATUSES.includes(status)) {
                    // error ที่ลองซ้ำไม่ได้ (เช่น 400 prompt ผิด, 401/403 คีย์ผิด) ให้เลิกทันที
                    throw error;
                }

                if (status === 503 && attempt === 1) {
                    console.warn(`โมเดล "${model}" กำลังโหลดสูง (503) รอ 1 วิ แล้วลองซ้ำอีกครั้ง...`);
                    await sleep(1000);
                    continue; // ลองโมเดลเดิมอีกครั้ง
                }

                console.warn(`โมเดล "${model}" ใช้งานไม่ได้ (${status}) กำลังลองโมเดลถัดไป...`);
                break; // ไปโมเดลถัดไปใน MODEL_CANDIDATES
            }
        }
    }

    // ลองครบทุกโมเดลแล้วยัง error อยู่
    throw lastError;
}

// ==============================
// หน้าแรก
// ==============================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ==============================
// API Chat
// ==============================
app.post("/chat", async (req, res) => {

    try {

        const question = req.body.message;
        // อ่านฐานข้อมูล (getKnowledgeBase() ตัด Header ออกให้แล้ว ไม่ต้องตัดซ้ำ)
const rows = await getKnowledgeBase();

// ค้นหา Keyword
for (const row of rows) {

    const keyword = (row[2] || "").toLowerCase().trim();

    // ข้ามแถวที่ยังไม่มี Keyword (เช่น KB005-KB010 ที่เตรียมไว้แต่ยังไม่กรอกข้อมูล)
    // ถ้าไม่ข้าม keyword ว่าง "".split(",") จะกลายเป็น [""] และ question.includes("")
    // จะเป็น true เสมอ ทำให้แมตช์มั่วทุกคำถามและตอบ "undefined" ออกมา
    if (!keyword) continue;

    const answer = row[4];
    const department = row[5];
    const phone = row[6];

    const keywords = keyword.split(",").map(k => k.trim()).filter(Boolean);

    const found = keywords.some(k =>
        question.toLowerCase().includes(k)
    );

    if (found) {

      return res.json({

    reply:
`📋 ${answer}

🏢 หน่วยงานรับผิดชอบ : ${department}

☎️ ติดต่อ : ${phone}`,

    source: "Google Sheets"

});

    }

}


        const prompt = `
คุณคือ AI Chatbot NAKHAYAD Connect ผู้ช่วยของเทศบาลตำบลนาขยาด

คำถามนี้ถูกตรวจสอบกับฐานข้อมูล Knowledge Base ของเทศบาลแล้ว และ "ไม่พบ" คำตอบที่ตรงกัน
ให้คุณจำแนกคำถามของประชาชนออกเป็น 2 กรณี แล้วตอบตามกฎของกรณีนั้นอย่างเคร่งครัด:

กรณีที่ 1 — คำถามทั่วไป ไม่เกี่ยวข้องกับงานราชการหรือบริการของเทศบาล
เช่น การทักทาย ขอบคุณ พูดคุยเล่น ถามว่าคุณคือใคร หรือคำถามความรู้ทั่วไปที่ไม่มีผลต่อการให้บริการของเทศบาล
→ ตอบได้ตามปกติ ด้วยน้ำเสียงสุภาพและเป็นตัวของตัวเอง ไม่ต้องอ้างอิงฐานข้อมูลใดๆ

กรณีที่ 2 — คำถามที่เกี่ยวข้องกับงานราชการ ระเบียบ ขั้นตอน เอกสาร ค่าธรรมเนียม หรือบริการใดๆ ของเทศบาลตำบลนาขยาด
(เช่น การขอใบอนุญาต ภาษี ทะเบียนพาณิชย์ สาธารณูปโภค การแจ้งปัญหา ฯลฯ)
→ ห้ามใช้ความรู้ทั่วไปของคุณเองมาตอบเด็ดขาด แม้คุณจะรู้คำตอบทั่วไปเกี่ยวกับราชการไทยก็ตาม
   เพราะข้อมูลนั้นอาจไม่ตรงกับระเบียบ/ขั้นตอนจริงของเทศบาลตำบลนาขยาดเลย
→ ให้ตอบกลับด้วยข้อความต่อไปนี้ "เป๊ะๆ" คำต่อคำเท่านั้น ห้ามแต่งเติม ห้ามอธิบายเพิ่ม:

[NOT_FOUND]

หากไม่แน่ใจว่าคำถามเข้าข่ายกรณีใด ให้ถือว่าเป็นกรณีที่ 2 เพื่อความปลอดภัย

คำถามของประชาชน: ${question}
`;
        const { text, modelUsed } = await generateWithFallback(prompt);

        // เช็คด้วย marker เฉพาะ แม่นยำกว่าการเช็คคำว่า "ขออภัย" ที่อาจชนกับคำตอบปกติ
        if (text.includes("[NOT_FOUND]")) {

            await saveUnknownQuestion(question);

            return res.json({
                reply: "ขออภัย ขณะนี้ยังไม่พบข้อมูลสำหรับคำถามนี้\nระบบจะส่งต่อให้เจ้าหน้าที่ตรวจสอบ",
                modelUsed,
                source: "Unknown"
            });
        }

        res.json({

            reply: text,
            modelUsed // ไว้ debug ว่าตอนนี้ระบบใช้โมเดลไหนอยู่จริง

        });

    } catch (error) {

        console.error("Gemini Error:");

        console.error(error);

        console.error(error.message);

        console.error(error.status);

        console.error(error.error);

        res.status(500).json({

            reply: "เกิดข้อผิดพลาดในการเชื่อมต่อ AI",
            debug: process.env.NODE_ENV === "development" ? error.message : undefined

        });

    }

});

// ==============================
// API Problem Report (แจ้งปัญหา)
// ==============================
app.post("/report", async (req, res) => {

    try {

        const { reporterName, contact, issueType, location, detail } = req.body;

        // ตรวจสอบข้อมูลเบื้องต้น กันข้อมูลว่างหลุดเข้า Sheets
        if (!reporterName || !contact || !issueType || !location || !detail) {
            return res.status(400).json({
                success: false,
                message: "กรุณากรอกข้อมูลให้ครบทุกช่อง"
            });
        }

        const reportId = await saveProblem({
            reporterName,
            contact,
            issueType,
            location,
            detail
        });

        res.json({
            success: true,
            reportId
        });

    } catch (error) {

        console.error("Save Problem Error:", error);

        res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง"
        });

    }

});

// ==============================
// API Text-to-Speech (Gemini TTS)
// ==============================

// โมเดล TTS ของ Gemini (Google AI Studio)
const TTS_MODEL = "gemini-3.1-flash-tts-preview";

// เสียงสไตล์ "ผู้บรรยายโฆษณา" — ชาย = Charon (ทุ้ม หนักแน่น), หญิง/default = Despina (นุ่ม เรียบลื่น)
const VOICE_MALE = "Charon";
const VOICE_FEMALE = "Despina";
const VOICE_DEFAULT = VOICE_FEMALE; // ใช้เสียงหญิงเป็นค่าเริ่มต้นเมื่อตรวจเพศไม่ได้

function pickVoiceName(gender) {
    if (gender === "male") return VOICE_MALE;
    if (gender === "female") return VOICE_FEMALE;
    return VOICE_DEFAULT;
}

// คำสั่งกำกับสไตล์การพูดแบบผู้บรรยายโฆษณามืออาชีพ แนบไปกับข้อความก่อนส่งให้ Gemini
// (Gemini TTS อ่านคำสั่งนี้เป็น "วิธีพูด" ไม่ใช่เนื้อหาที่ต้องพูดออกมาจริงๆ)
function toAdVoiceoverStyle(text) {
    return `พูดด้วยน้ำเสียงผู้บรรยายโฆษณามืออาชีพ หนักแน่น น่าเชื่อถือ ชัดถ้อยชัดคำ จังหวะกระชับแบบสปอตโฆษณา: ${text}`;
}

// Gemini TTS ส่งข้อมูลกลับมาเป็น raw PCM (16-bit, mono, 24kHz)
// ต้องห่อ header WAV เองก่อนส่งให้หน้าเว็บเล่นได้ ไม่ต้องพึ่ง library เสริม
function pcmToWavBuffer(pcmBuffer, channels = 1, sampleRate = 24000, bitDepth = 16) {

    const byteRate = (sampleRate * channels * bitDepth) / 8;
    const blockAlign = (channels * bitDepth) / 8;
    const dataSize = pcmBuffer.length;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);       // Subchunk1Size (PCM = 16)
    buffer.writeUInt16LE(1, 20);        // AudioFormat = 1 (PCM)
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitDepth, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);
    pcmBuffer.copy(buffer, 44);

    return buffer;
}

app.post("/tts", async (req, res) => {

    try {

        const { text, gender } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: "ไม่มีข้อความให้อ่าน"
            });
        }

        const voiceName = pickVoiceName(gender);
        const styledText = toAdVoiceoverStyle(text);

        const response = await ai.models.generateContent({
            model: TTS_MODEL,
            contents: [{ parts: [{ text: styledText }] }],
            config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName }
                    }
                }
            }
        });

        const base64Pcm = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!base64Pcm) {
            throw new Error("ไม่พบข้อมูลเสียงในผลลัพธ์จาก Gemini");
        }

        const pcmBuffer = Buffer.from(base64Pcm, "base64");
        const wavBuffer = pcmToWavBuffer(pcmBuffer);

        res.json({
            success: true,
            audioBase64: wavBuffer.toString("base64"),
            voiceUsed: voiceName
        });

    } catch (error) {

        console.error("Gemini TTS Error:", error?.message || error);

        const status = error?.status || error?.error?.code;

        // ตอบกลับ fallback:true เสมอ เพื่อให้ frontend รู้ว่าต้องสลับไปใช้ Web Speech API
        // ไม่ว่าจะเป็นโควต้าหมด (429), โมเดลโหลดสูง (503), หรือ error อื่นใดก็ตาม
        res.status(status && Number.isInteger(status) ? status : 500).json({
            success: false,
            fallback: true,
            message: "ไม่สามารถสร้างเสียงจาก Gemini TTS ได้ในขณะนี้"
        });

    }

});

// ==============================
// Start Server
// ==============================
const PORT = process.env.PORT || 3000;
app.get("/test", async (req, res) => {
    try {
        const { text, modelUsed } = await generateWithFallback("สวัสดี");

        res.json({
            success: true,
            text,
            modelUsed
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
            status: error.status,
            error: error.error
        });
    }
});
app.get("/knowledge", async (req, res) => {

    try {

        const data = await getKnowledgeBase();

        res.json(data);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});
app.listen(PORT, () => {

    console.log("--------------------------------");
    console.log("NAKHAYAD Connect");
    console.log(`Server : http://localhost:${PORT}`);
    console.log("--------------------------------");

});