# ⚕️ EvidenceFlowAI: AI Hospitalist Mentor & Clinical Co-Pilot

**EvidenceFlowAI** is an open-source, persona-driven clinical AI copilot. Built on top of **Gemini 3.5 Flash** for blazing-fast inference, EvidenceFlowAI uses dynamic system prompting to shift between highly specialized medical personas—acting as either a Socratic medical tutor or a direct, high-level attending physician. It serves as an interactive, web-based reasoning engine for medical professionals and hospitalists to augment clinical decision-making, generate structured documentation, and create high-yield, board-style thinking algorithms.

> [!WARNING]
> **DO NOT ENTER PROTECTED HEALTH INFORMATION (PHI) OR PERSONALLY IDENTIFIABLE INFORMATION (PII).**
> Unless you have configured a dedicated Google Cloud project covered by an institutional Business Associate Agreement (BAA) and updated the API configuration, sending real patient identifiers over the public Gemini API violates HIPAA and patient privacy laws. Always use mock cases or fully de-identified data.

---

## ✨ Key Features

*   **🎓 Socratic Preceptor (Default Mode)**
    When you describe a patient case, EvidenceFlowAI doesn't simply give you answers. It asks structured, probing questions (categorized by organ system, pre-test probability, and "can't miss" diagnoses) to sharpen your clinical reasoning.
*   **📝 Generative Clinical Scribes (Powered by Local RAG)**
    Synthesizes the conversation history instantly into EHR-ready medical documentation using a localized Retrieval-Augmented Generation (RAG) architecture:
    *   `/assessment_and_plan` - Dynamically retrieves templates from your custom `apTemplates.ts` knowledge base, matching the patient's condition to your preferred hospital protocols, then weaves in live patient data (vitals, labs).
    *   `/short_presentation` - Structured notes formatted for reading aloud on morning rounds.
    *   `/handoff` - A concise IPASS/SBAR written handoff for covering clinicians.
    *   `/sticky_note` - A hyper-concise, quick-reference dashboard of the patient.
    *   `/clinicalalgorithm [topic]` - Generates a step-by-step, high-yield clinical algorithm for a specified topic.
    *   `/ask_the_expert` - Decodes the "unwritten rules" of inpatient medicine.
    *   `/run_simulation` - Starts a dynamic, interactive clinical emergency simulation.
*   **🧠 Master Board-Style Algorithms**
    Generate a step-by-step thinking algorithm (ABIM board-prep style) for any topic directly in the chat feed to master the underlying pathophysiology, differential comparisons, and actionable "Best Next Steps."
*   **💻 Modern Fluid Interface**
    A completely responsive, fluid-width workspace featuring Claude-style editorial typography (Source Serif 4 / Inter) that makes reading dense clinical charts and tables comfortable on any monitor.
*   **🔒 Clinician-First Privacy**
    Built entirely on a client-side architecture. Chat logs, patient summaries, and clinical algorithms are saved exclusively in your browser's local storage (`localStorage`). No clinical data is ever stored on external project databases.

---

## 🛠️ Technology Stack

*   **Core**: React 19 (Hooks, Refs), TypeScript 5, Vite 6
*   **AI Integration**: `@google/genai` (Official Google GenAI SDK v1.25.0)
*   **Styling**: Tailwind CSS (Tailored UI palette with light/slate surfaces)
*   **Markdown**: `react-markdown` and `remark-gfm` (Supports clean tables, lists, and guidelines rendering)

---

## 🚀 Quick Start

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   A Google Gemini API Key (Get one from [Google AI Studio](https://aistudio.google.com/))

### 1. Clone & Install
```bash
git clone git@github.com:drsku6/EvidenceFlowAI.git
cd EvidenceFlowAI
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Locally
```bash
npm run dev
```
Open `http://localhost:3000` in your browser to begin seeing your patient.

### 4. Build for Production
To compile and package the app for static hosting (Firebase, Netlify, Cloud Storage, etc.):
```bash
npm run build
```

---

## 📖 How it Works: Behind the Scenes

### Socratic Mentorship
EvidenceFlowAI is grounded by a custom medical persona defined in `constants.ts`. When a conversation starts, the app spawns a chat session targeting `gemini-3.5-flash`. The model triage-checks the case in the background, identifying the "Sickest Problem", "Can't Miss" diagnoses, and key data gaps, then prompts you to justify your diagnostic path.

### Unified Model Architecture
To optimize speed, cost, and latency, EvidenceFlowAI runs all actions—including Socratic chats, patient summaries, IPASS/SBAR handoffs, progress plan formatting, and board-style clinical algorithms—on **`gemini-3.5-flash`**.

### Local RAG & Knowledge Base
The `/assessment_and_plan` generator acts as a **Retrieval-Augmented Generation (RAG)** engine. When triggered, the application serializes the `prompts/apTemplates.ts` file (a custom 130KB+ library of hospital protocols and guidelines) directly into Gemini's 1M token context window. The model reads the raw patient conversation, acts as a diagnostic engine to identify the primary pathology, searches the injected templates for a matching protocol, and dynamically customizes the boilerplate text with the patient's actual vitals, lab results, and history.

---

## 🛡️ Security & HIPAA Policy

EvidenceFlowAI is designed with data protection in mind:
*   **No PHI / PII**: **Do not input any real patient records or identifiers under any circumstances.** If you are demoing, teaching, or testing the app, ensure all cases are strictly fictional or fully de-identified.
*   **Local Storage**: All patient encounter data resides locally in the user's browser cache. Clearing your browser data deletes all sessions.
*   **Data Transmission**: Data is sent client-side to the Google Gemini API. When deploying in a clinical setting, ensure your Google Cloud organization is covered by a Business Associate Agreement (BAA) to prevent inputs from being utilized in training sets.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
