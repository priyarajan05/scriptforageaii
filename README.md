# ScriptForge AI

**An AI‑powered YouTube content generator** that transforms a simple topic or uploaded image into a complete, production‑ready YouTube package.

---

## ✨ Features

- **AI‑Powered Script Generation** – Full‑length, engaging scripts with storytelling, hooks, and audience‑retention techniques.
- **Image‑to‑Content Analysis** – Upload any image; the vision model extracts objects, scenes, text, colors, and emotions to drive the script.
- **Viral Title & Thumbnail Suggestions** – Click‑worthy titles and concise thumbnail text (3‑5 words).
- **SEO Optimization** – Automatic keyword and tag generation for better YouTube ranking.
- **Dynamic Badges** – Real‑time generation time, hook inclusion, and retention metrics displayed with SVG icons.
- **Multi‑Niche Support** – Adapts tone and style for tutorials, vlogs, gaming, education, etc.
- **Fast Production** – Scripts are generated in seconds, cutting production time dramatically.
- **Cloud‑Based Storage** – Local (and optional cloud) storage of generated scripts for easy reuse.

---

## 🛠️ Tech Stack

- **Frontend** – HTML, CSS (custom design system with glass‑morphism), vanilla JavaScript (`app.js`).
- **Backend** – Node.js + Express.
- **AI Providers** –
  - **Groq (Llama‑4‑scout‑17b)** – Fast text‑only generation.
  - **Google Gemini (gemini‑2.5‑flash)** – Vision‑enabled analysis for images.
- **File Uploads** – `multer` for image handling.
- **Image Processing** – `sharp` for resizing/compression.
- **Environment** – `.env` stores `GEMINI_API_KEY` and `GROQ_API_KEY`.

---

## 🚀 Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/yourusername/scriptforageai-fixed.git
   cd scriptforageai-fixed/scriptforageai-fixed/scriptforageai-fixed
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Configure environment variables**
   Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   GROQ_API_KEY=your_groq_api_key
   PORT=3000   # optional – defaults to 3000
   ```
4. **Run the development server**
   ```bash
   npm run dev   # or node server.js
   ```
   Open your browser at `http://localhost:3000`.

---

## 📦 Production Build

```bash
npm run build   # creates a production‑ready bundle
npm start       # serves the built files
```

---

## 🖼️ Image Upload Workflow

1. User selects an image → it is uploaded via `multer`.
2. The image is processed with `sharp` (max 1024 px width).
3. The processed image is sent to **Google Gemini** for vision analysis.
4. Results are merged with the text prompt and fed to the **Groq** model for final script generation.
5. The UI displays generated badges, script sections, and thumbnail suggestions.

---

## 🎨 Design System Highlights

- **Glass‑morphism cards** with smooth hover lifts.
- **Dynamic SVG icons** for badges and feature cards – no broken emoji characters.
- **Responsive grid** – works across mobile, tablet, and desktop.
- **Custom CSS variables** (`--primary-start`, `--primary‑end`) for easy theming.

---

## 🧪 Testing

- Run unit tests (if any) with:
  ```bash
  npm test
  ```
- Verify API responses in the browser console for correct JSON structure.

---

## 📄 License

MIT License – feel free to modify, distribute, and use in commercial projects.

---

## 🙏 Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/awesome‑feature`).
3. Ensure code follows the existing style and passes linting (`npm run lint`).
4. Open a Pull Request with a clear description of changes.

---
## 📦 Frontend (React + Vite)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

### Available plugins

- `@vitejs/plugin-react` uses Oxc
- `@vitejs/plugin-react-swc` uses SWC

### React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

### Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and `typescript-eslint` in your project.
## 📞 Support

For questions or issues, open a GitHub Issue or contact the maintainer at `support@scriptforge.ai`.