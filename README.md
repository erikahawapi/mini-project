# 🌐 Interactive 3D Virtual Tour — Perpustakaan Raja Zarith Sofiah (PRZS)

> A fully interactive, browser-based 3D virtual tour experience of the Raja Zarith Sofiah Library at Universiti Teknologi Malaysia (UTM). Visitors can explore the library building exterior, enter the main lobby, navigate between floors, and interact with hotspots to learn about facilities and view real-world reference photo evidence.

---

## 📸 Overview

This project is a **collaborative immersive virtual tour** designed to recreate the Raja Zarith Sofiah Library (PRZS) in an interactive 3D WebGL environment. It features a combined full-building tour alongside isolated sub-experiences for Floor 1 and Floor 2. 

The application implements custom look-around mechanics, dynamic location-aware photo evidence overlays, glassmorphic UI panels, and background music. It is built entirely using vanilla web technologies — **HTML5**, **CSS3 (Vanilla)**, **Three.js**, and **GSAP** — without requiring heavy game engines.

---

## ✨ Key Features

- 🌍 **Fully 3D Navigable Environment** — Orbit and orient camera angles using left-click drag controls, and navigate the space using WASD keyboard inputs.
- 🔮 **Interactive Hotspots & Objects** — Click on floating hotspots, the building sign, or main doors to trigger popups, open doors, and transition zones.
- 📷 **Location-Aware Photo Evidence** — Reference photo modal dynamically changes its pictures to show real-world camera comparisons matching the floor the visitor is currently on.
- 🕒 **Animated HUD & Modals** — Glassmorphism UI guide panel showing location descriptions, library operating hours, UTM contact info, and audio controls.

---

## 🛠️ Technology Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Core Structure** | HTML5 | — | Web page layout and semantic elements |
| **Graphics Engine** | Three.js | r128 | WebGL 3D scene rendering, lighting, and materials |
| **3D Loader** | THREE.GLTFLoader | — | Loads and parses the compiled `.glb` building model |
| **Animations & Camera** | GSAP | 3.12.2 | Camera fly-to transitions and smooth animations |
| **Styling** | Vanilla CSS | — | Glassmorphic panels, button layouts, and responsive media queries |
| **Typography** | Google Fonts | — | Space Grotesk (headings) and Outfit (body text) |

---

## 🗂️ Project Structure

```
PRZS-Tour/
├── assets/
│   ├── Music.mp3               # Background music audio
│   ├── models/
│   │   └── PRZS.glb            # Core 3D library model file (GLB format)
│   └── reference/              # Converted reference photo evidence (.jpg, .png)
│
├── index.html                  # Main combined virtual tour entry page
├── main.js                     # Main tour orchestrator and DragControls
├── style.css                   # Global glassmorphic stylesheet
└── PRZS Image.jpg              # Preview image of the PRZS building
```

---

## 🏛️ Pages & Locations

### 🌐 Exterior Building
The entry zone visitors land on. 
* **About the Library** — Historical background of PRZS and proclamation ceremony details.
* **Operating Hours** — Library opening hours during semesters/break sessions.
* **Contact Information** — Official website link, email, phone, and campus address.

### 🚪 Floor 1 (Hall, Registration Counter, & Study Section)
Accessed by clicking the double glass entrance doors.
* **1F: Hall** — Main entry hall layout and open space for events.
* **1F: Registration Counter** — Reception desk for enquiries and book borrowing.
* **1F: Study Section** — Group study zone and reading tables.

### 🖼️ Floor 2 (Gallery & Study Section)
Accessed via floor navigation buttons.
* **2F: Gallery** — Archives and historical collections displaying UTM achievements.
* **2F: Study Section** — Quiet study tables situated by the glass windows.

---

## 🚀 Getting Started

### Prerequisites
To run this application locally, you only need a web browser and a local static server.

### Running Locally

1. **Clone or Download the Repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/PRZS-Tour.git
   cd PRZS-Tour
   ```

2. **Serve the Project**:
   Since the GLTFLoader requires CORS to download the `.glb` model, you must run it through a local web server (opening the `.html` file directly via double-click will block model loading):
   * **Using VS Code**: Install the **Live Server** extension, open the project folder, and click **Go Live**.
   * **Using Node.js / npm**:
     ```bash
     npm install -g serve
     serve .
     ```
   * **Using Python**:
     ```bash
     python -m http.server 8000
     ```

3. Open the local address (e.g., `http://localhost:3000` or `http://localhost:8000`) in your browser.

---

## 📬 Contact

| Member | Email | GitHub | LinkedIn |
|--------|-------|--------|----------|
| Puteri Nurul Syahirah | puterinurulsyahirah@graduate.utm.my | [puterinurulsyahirah](https://github.com/puterinurulsyahirah) | [puterinurulsyahirah](http://www.linkedin.com/in/puterinurulsyahirah) |
| Erika | erika04@graduate.utm.my | [erikahawapi](https://github.com/erikahawapi) | [erikahawapi](https://linkedin.com/in/erikahawapi) |
| Nur Amiera Zulaikha | nuramierazulaikha@graduate.utm.my | [amierazulaikha](https://github.com/amierazulaikha) | [nur-amiera-zulaikha](https://www.linkedin.com/in/nur-amiera-zulaikha) |
| Farhanah | farhanah@graduate.utm.my | [nurfarhanahhusni](https://github.com/nurfarhanahhusni) | [nur-farhanah-husni](https://www.linkedin.com/in/nur-farhanah-husni) |

---

## 📄 License

This project was developed as part of an academic assignment at **Universiti Teknologi Malaysia (UTM)** for the Bachelor of Computer Science (Graphics and Multimedia Software) with Honours programme.
