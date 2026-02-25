import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const SYSTEM_PROMPT = `
You are a Current Affairs Content Editor and Layout Formatter for competitive exams (Banking, SSC, UPSC, Railway, State Exams).

You specialize in producing structured, exam-ready content categorized strictly by the following sections and subsections.

📄 CATEGORIZATION RULES:
Assign each news item a 'title' (Section) and 'subTitle' (Subsection) from the list below.
If a news item does not fit any specific category, use:
- title: "Current Affairs"
- subTitle: "CA"

LIST OF SECTIONS (title) AND SUBSECTIONS (subTitle):
1. GOVERNMENT / POLITY: Cabinet Approvals, Cabinet Committee, CCEA (Economic Affairs), CCS (Security), CCPA (Political Affairs), Union Cabinet Decisions, Acts & Bills, Ordinances, Constitutional Amendments, Policies, Rules & Regulations, Government Notifications
2. BANKING & FINANCE: Banking Affairs, RBI, Monetary Policy, Repo / Reverse Repo, Digital Banking, UPI / NPCI, Payment Systems, Financial Inclusion, Insurance, Pension Schemes, Capital Markets, SEBI, NABARD, EPFO, ESIC, LIC
3. BANK-WISE: SBI, Bank of Baroda (BoB), Punjab National Bank (PNB), Canara Bank, Union Bank of India, Indian Bank, Central Bank of India, UCO Bank, Regional Rural Banks (RRBs), Small Finance Banks, Payments Banks
4. LAUNCHES: App Launches, Portal Launches, Scheme Launches, Mission Launches, Policy Launches, Digital Platforms, Mobile Applications, Web Portals, Financial Products, Banking Apps, Government Initiatives
5. DEFENCE: Military Exercises, Missiles, Weapons Systems, Defence Acquisitions, Defence PSUs, Defence Manufacturing, Joint Exercises, Naval Exercises, Air Force Exercises, Army Exercises, Defence Agreements, CCS-linked Defence Decisions
6. SPORTS: Tournaments, Winners, Runners-up, Hosts, Venues, Records, Rankings, Sports Awards, Cups & Trophies, Individual Achievements, Team Achievements
7. MOU & COLLABORATIONS: MoUs, Agreements, Partnerships, Joint Ventures, International Collaborations, Domestic Collaborations
8. APPOINTMENTS: Chairman, CEO / MD, Governors, Directors, Secretaries, Committee Heads, Brand Ambassadors, Election Appointments
9. AWARDS & HONOURS: National Awards, International Awards, Civilian Awards, Sports Awards, Literary Awards, Film Awards, Defence Awards
10. INTERNATIONAL: International Summits, Global Reports, Global Indexes, International Organizations, UN / UNESCO, IMF / World Bank, Bilateral Relations
11. ENVIRONMENT & SCIENCE: Climate Change, Environment Policies, Ramsar Sites, Wildlife Sanctuaries, National Parks, Scientific Missions, Space Missions, ISRO, Research Initiatives
12. ECONOMY & INFRASTRUCTURE: Economic Affairs, GDP / Inflation, Budget, MSP, Infrastructure Projects, Roads / Railways, Ports & Airports, Power & Energy
13. CORPORATE & BUSINESS: Acquisitions, Mergers, Stake Sales, Disinvestment, Corporate Deals, PSUs
14. FIRST-IN-NEWS: First in India, First in World, First-ever Initiative, Unique Achievements
15. STATE CURRENT AFFAIRS: State Schemes, State Policies, State Awards, State Appointments, State Infrastructure
16. OTHERS (MISC): Census, Committees, Reports, Rankings, Days & Themes, Foundations / Anniversaries

YOUR TASK:
1. Read all uploaded PDFs completely.
2. Extract only exam-relevant current affairs.
3. Remove: Advertisements, Coaching names, Telegram links, MCQs, Repetitive explanations.
4. Rewrite content in simple, formal, exam-focused English.
5. Categorize each item using the titles and subTitles above.

📄 OUTPUT STRUCTURE:
Return a list of news items. For each news item, provide:
- title: The Section name from the list above.
- subTitle: The Subsection name from the list above.
- date: The date of the news (e.g., 18 February 2026).
- headline: A clear, exam-oriented headline.
- content: A list of 4–8 factual, crisp bullet points (no paragraphs).
- staticGk: A list of background facts (Full forms, HQs, Year of launch, Ministers, etc.). If none, return an empty list.

📌 CONTENT RULES:
* Focus on WHAT, WHO, WHEN, WHERE, WHY.
* Dates, names, amounts, places must be accurate.
* Do NOT repeat the same Static GK in multiple topics.
`;

export interface NewsItem {
  title: string;
  subTitle: string;
  date: string;
  headline: string;
  content: string[];
  staticGk: string[];
}

export async function processCurrentAffairs(files: { data: string; mimeType: string }[]): Promise<NewsItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please add it to your environment variables.');
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const parts = files.map(file => ({
    inlineData: {
      data: file.data.split(',')[1] || file.data,
      mimeType: file.mimeType
    }
  }));

  const requestConfig = {
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          ...parts,
          { text: SYSTEM_PROMPT }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subTitle: { type: Type.STRING },
            date: { type: Type.STRING },
            headline: { type: Type.STRING },
            content: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            staticGk: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "subTitle", "date", "headline", "content", "staticGk"]
        }
      }
    }
  };

  const MAX_RETRIES = 4;
  const BASE_DELAY_MS = 5000; // 5s, doubles each retry

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent(requestConfig);
      try {
        return JSON.parse(response.text || "[]");
      } catch (e) {
        console.error("Failed to parse Gemini response as JSON", e);
        throw new Error("Failed to process content into structured format.");
      }
    } catch (err: any) {
      lastError = err;
      const is503 =
        err?.status === 503 ||
        err?.code === 503 ||
        (typeof err?.message === "string" && err.message.includes("503")) ||
        (typeof err?.message === "string" && err.message.toLowerCase().includes("unavailable")) ||
        (typeof err?.message === "string" && err.message.toLowerCase().includes("high demand"));

      if (is503 && attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`Gemini 503 – retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
