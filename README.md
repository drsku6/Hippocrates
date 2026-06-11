# ⚕️ Hippocrates: AI Hospitalist Mentor & Clinical Co-Pilot

Hippocrates is an interactive, web-based clinical decision-support and educational tool. Designed to act as an on-demand mentor for hospital medicine physicians, residents, and medical students, Hippocrates combines the wisdom of a seasoned academic physician with the latest evidence-based guidelines and clinical trials.

The application leverages Google's Gemini models directly in the browser to guide clinical reasoning, generate polished medical documentation, and create high-yield, board-style thinking algorithms.

> [!WARNING]
> **DO NOT ENTER PROTECTED HEALTH INFORMATION (PHI) OR PERSONALLY IDENTIFIABLE INFORMATION (PII).**
> Unless you have configured a dedicated Google Cloud project covered by an institutional Business Associate Agreement (BAA) and updated the API configuration, sending real patient identifiers over the public Gemini API violates HIPAA and patient privacy laws. Always use mock cases or fully de-identified data.

---

## ✨ Key Features

*   **🎓 Socratic Preceptor (Default Mode)**
    When you describe a patient case, Hippocrates doesn't simply give you answers. It asks structured, probing questions (categorized by organ system, pre-test probability, and "can't miss" diagnoses) to sharpen your clinical reasoning.
*   **📝 Generative Clinical Scribes**
    Synthesizes the conversation history instantly into EHR-ready medical documentation using specialized templates:
    *   `/assessment_and_plan` - Daily progress note format with acute and chronic problems.
    *   `/short_presentation` - Structured notes formatted for reading aloud on morning rounds.
    *   `/handoff` - A concise IPASS/SBAR written handoff for covering clinicians.
    *   `/sticky_note` - A hyper-concise, quick-reference dashboard of the patient.
    *   `/clinicalalgorithm [topic]` - Generates a step-by-step, high-yield clinical algorithm for a specified topic.
    *   `/ask_the_expert` - Decodes the "unwritten rules" of inpatient medicine.
    *   `/run_simulation` - Starts a dynamic, interactive clinical emergency simulation.
*   **🧠 Master Board-Style Algorithms**
    Generate a step-by-step thinking algorithm (ABIM board-prep style) for any topic directly in the chat feed to master the underlying pathophysiology, differential comparisons, and actionable "Best Next Steps."
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
git clone git@github.com:drsku6/hippocrates.git
cd hippocrates
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
Open `http://localhost:3000` in your browser to begin your consultation.

### 4. Build for Production
To compile and package the app for static hosting (Firebase, Netlify, Cloud Storage, etc.):
```bash
npm run build
```

---

## 📖 How it Works: Behind the Scenes

### Socratic Mentorship
Hippocrates is grounded by a custom medical persona defined in `constants.ts`. When a conversation starts, the app spawns a chat session targeting `gemini-3.5-flash`. The model triage-checks the case in the background, identifying the "Sickest Problem", "Can't Miss" diagnoses, and key data gaps, then prompts you to justify your diagnostic path.

### Unified Model Architecture
To optimize speed, cost, and latency, Hippocrates runs all actions—including Socratic chats, patient summaries, IPASS/SBAR handoffs, progress plan formatting, and board-style clinical algorithms—on **`gemini-3.5-flash`**.

---

## 🛡️ Security & HIPAA Policy

Hippocrates is designed with data protection in mind:
*   **No PHI / PII**: **Do not input any real patient records or identifiers under any circumstances.** If you are demoing, teaching, or testing the app, ensure all cases are strictly fictional or fully de-identified.
*   **Local Storage**: All consultation data resides locally in the user's browser cache. Clearing your browser data deletes all sessions.
*   **Data Transmission**: Data is sent client-side to the Google Gemini API. When deploying in a clinical setting, ensure your Google Cloud organization is covered by a Business Associate Agreement (BAA) to prevent inputs from being utilized in training sets.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
