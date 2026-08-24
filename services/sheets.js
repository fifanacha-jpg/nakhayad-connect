const { google } = require("googleapis");
const credentials = require("../credentials.json");

// Authentication
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// Google Sheets Client
const sheets = google.sheets({
    version: "v4",
    auth
});

// ใส่ Spreadsheet ID ของคุณตรงนี้
const SPREADSHEET_ID = "17beM8JM10yWYsTxqUnRYI05BoaF42n15Xspm6is8G3k";

// อ่านข้อมูลจาก Knowledge_Base
async function getKnowledgeBase() {

    const response = await sheets.spreadsheets.values.get({

        spreadsheetId: SPREADSHEET_ID,

        range: "Knowledge_Base!A:H"

    });

    const rows = response.data.values || [];

    // ข้าม Header
    rows.shift();

    return rows;

}

// สร้างเลขที่แจ้งถัดไปแบบ RP001, RP002, ... โดยดูจากจำนวนแถวที่มีอยู่ในคอลัมน์ A
async function getNextProblemId() {

    const response = await sheets.spreadsheets.values.get({

        spreadsheetId: SPREADSHEET_ID,

        range: "Problem_Report!A:A"

    });

    const rows = response.data.values || [];

    // rows[0] คือ Header ดังนั้นจำนวนแถวข้อมูลจริง = rows.length - 1
    const nextNumber = Math.max(rows.length, 1);

    return "RP" + String(nextNumber).padStart(3, "0");

}

// บันทึกการแจ้งปัญหา
// data = { reporterName, contact, issueType, location, detail }
// คืนค่าเลขที่แจ้ง (เช่น "RP002") กลับไป เพื่อให้ backend ส่งต่อไปแสดงที่หน้าเว็บได้
async function saveProblem(data) {

    const id = await getNextProblemId();

    await sheets.spreadsheets.values.append({

        spreadsheetId: SPREADSHEET_ID,

        range: "Problem_Report!A:J",

        valueInputOption: "RAW",

        requestBody: {

            values: [[

                id,                                    // A: เลขที่แจ้ง
                new Date().toLocaleString("th-TH"),     // B: วันที่/เวลา
                data.reporterName,                      // C: ชื่อผู้แจ้ง
                data.contact,                            // D: ช่องทางติดต่อ
                data.issueType,                          // E: ประเภทปัญหา
                data.detail,                             // F: รายละเอียด
                data.location,                           // G: สถานที่
                "รอดำเนินการ",                          // H: สถานะ
                "",                                      // I: ผู้รับผิดชอบ
                ""                                       // J: หมายเหตุ

            ]]

        }

    });

    return id;

}

// สร้าง ID ถัดไปแบบ UQ001, UQ002, ... โดยดูจากจำนวนแถวที่มีอยู่ในคอลัมน์ A
async function getNextUnknownQuestionId() {

    const response = await sheets.spreadsheets.values.get({

        spreadsheetId: SPREADSHEET_ID,

        range: "Unknown_Questions!A:A"

    });

    const rows = response.data.values || [];

    // rows[0] คือ Header ดังนั้นจำนวนแถวข้อมูลจริง = rows.length - 1
    const nextNumber = Math.max(rows.length, 1);

    return "UQ" + String(nextNumber).padStart(3, "0");

}

// บันทึกคำถามที่ AI ตอบไม่ได้
// channel = ช่องทางที่ถาม เช่น "เว็บไซต์", "Line", ฯลฯ
async function saveUnknownQuestion(question, channel = "เว็บไซต์") {

    const id = await getNextUnknownQuestionId();

    await sheets.spreadsheets.values.append({

        spreadsheetId: SPREADSHEET_ID,

        range: "Unknown_Questions!A:H",

        valueInputOption: "RAW",

        requestBody: {

            values: [[

                id,                            // A: ID
                new Date().toLocaleString("th-TH"), // B: วันที่/เวลา
                question,                       // C: คำถามของประชาชน
                channel,                        // D: ช่องทาง
                "รอตรวจสอบ",                    // E: สถานะ
                "",                             // F: คำตอบจากเจ้าหน้าที่
                "",                             // G: หน่วยงานรับผิดชอบ
                "ไม่"                           // H: เพิ่มเข้าฐานความรู้แล้ว

            ]]

        }

    });

}

module.exports = {

    getKnowledgeBase,
    saveProblem,
    saveUnknownQuestion

};