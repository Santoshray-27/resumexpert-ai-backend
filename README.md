# ⚙️ ResumeXpert AI - Backend API

The high-performance AI engine powering the **ResumeXpert AI** Career OS. This repository contains the production-ready Node.js/Express API responsible for semantic resume parsing, multi-provider AI analysis (Gemini/OpenAI/Groq), and contextual interview coaching.

---

## 🚀 Key Features

- **Multi-Provider AI Fallback Intelligence:** A resilient 3-tier chain (Google Gemini → OpenAI → Groq) ensuring 100% analysis uptime.
- **Semantic Resume Parsing:** Advanced extraction of skills, experience, and metadata from PDF/DOCX using OCR and LLM logic.
- **Real-time Interview Engine:** Contextual mock interviews generated on-the-fly based on candidate resumes and target roles.
- **Secure Authentication:** Stateless JWT-based identity management with secure bcrypt password hashing.
- **Enterprise Security:** Integrated protection using Helmet.js, CORS, and strictly validated middleware.

---

## 🛠️ Technology Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js 4 (MVC Architecture)
- **Database:** MongoDB (via Mongoose ODM 8)
- **AI Integration:** Google Gemini 2.0, OpenAI GPT-3.5, Groq (LLaMA 3.1)
- **Logging & Monitoring:** Morgan & Winston (ready for integration)

---

## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <your-backend-repo-url>
   cd resumexpert-ai-api
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the `.env.example` file to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   *Required: `MONGODB_URI`, `JWT_SECRET`, and at least `GEMINI_API_KEY`.*

4. **Start Development Server:**
   ```bash
   npm run dev
   ```

---

## 🚀 Deployment (Render / Railway)

This API is designed to be deployed as a specialized backend service.

### Railway / Render Checklist:
1. Connect your GitHub repository.
2. Set the **Root Directory** to `./` (since this is a dedicated backend repo).
3. Add all environment variables from `.env.example` to the platform's Dashboard.
4. The platform will automatically detect the `start` script: `node server.js`.

---

## 📁 Repository Structure

```
.
├── config/             # Database connection & platform config
├── controllers/        # Business logic for all API endpoints
├── middleware/         # Auth verification & Multer file handlers
├── models/             # Mongoose schemas (User, Resume, Analysis, etc.)
├── routes/             # RESTful API route definitions
├── utils/              # AI Service, Resume Parser, and Token Generators
├── uploads/            # Temporary storage for resume files (Git-ignored)
└── server.js           # Main Express application entry point
```

---

## 📄 License
MIT License — Built for the next generation of job seekers.
