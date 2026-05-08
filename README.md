<div align="center">
  <img src="images/TVS_logo.png" alt="Tiny Village Spirit Logo" width="120" />

  # 🏘️ VillageHub

  **A centralized mobile app for residents to manage community amenities, bookings, and communication.**

  ![React Native](https://img.shields.io/badge/React_Native-Expo-61DAFB?style=flat-square&logo=react)
  ![Firebase](https://img.shields.io/badge/Backend-Firebase-FFCA28?style=flat-square&logo=firebase)
  ![Status](https://img.shields.io/badge/Status-Deploying-1a7a6e?style=flat-square)
  ![Platform](https://img.shields.io/badge/Platform-iOS_(App_Store)-000000?style=flat-square&logo=apple)

</div>

---

## 📖 Overview

VillageHub is a mobile app built for residents of **Tiny Village Spirit's** tiny home communities. It streamlines how residents book shared amenities, receive announcements, submit feedback, and stay connected with their community — all in one place.

> Designed to live in the **lifestyle space**, VillageHub makes daily community life more efficient and enjoyable for both residents and administrators.

---

## 🚩 The Problem

Community spaces get chaotic without a centralized system:

- 🏠 **Booking conflicts** — residents accidentally try to use spaces at the same time
- 📬 **Missed communication** — announcement emails go unread or arrive late
- 📋 **Lost feedback** — maintenance requests and suggestions fall through the cracks

VillageHub solves all three.

---

## ✨ Features

| Feature | Description | Status |
|---|---|---|
| 🔐 **User Authentication** | Secure login & registration with role-based access (Resident / Admin) | ✅ Core |
| 🏠 **Room Booking** | Browse available time slots and reserve shared spaces | ✅ Core |
| 📢 **Announcements** | Admins post community-wide updates; residents receive them instantly | ✅ Core |
| 💬 **Feedback & Requests** | Residents submit maintenance requests and feedback; Admins manage and respond | ✅ Core |
| 📅 **Community Calendar** | Shared calendar for events, bookings, and gardening sessions | ✅ Core |
| 🌱 **Gardening Slots** | Book plot time in the community garden | ✅ Core |
| 🧹 **Chore Management** | Rotating chore assignments tracked per resident | ✅ Core |
| 🤖 **AI Chatbot** | Resident assistant for quick questions | 🔮 Stretch |
| 🌙 **Dark / Light Mode** | Theme toggle for accessibility | 🔮 Stretch |
| 📱 **Community Posts** | Social-media-style community board | 🔮 Stretch |
| 🤝 **Social Worker Matching** | Match residents with social workers via Hope Services integration | 🔮 Future |
| 📞 **Hope Services Contacts** | Direct access to Hope Services contacts and resources in-app | 🔮 Future |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Mobile Framework** | React Native (Expo) |
| **Language** | TypeScript |
| **Navigation** | Expo Router |
| **Backend & Auth** | Firebase (Firestore + Firebase Auth) |
| **UI / Styling** | React Native StyleSheet |
| **Icons** | @expo/vector-icons (Ionicons) |

---

## 🗂️ Project Structure

```
VillageHub/
├── app/
│   ├── (admin)/          # Admin-only screens
│   └── (user)/           # Resident screens
├── assets/
│   └── images/
├── services/             # Firebase service layer
├── state/                # Auth & global state
└── firebase.ts           # Firebase config
```

---

## 🗓️ Timeline

```
Week 1       → Onboarding & environment setup
Weeks 2–3    → Training, design system & Firebase setup
Weeks 3–8    → Core feature development
Weeks 8–10   → Testing, bug fixes & polish
Weeks 10–12  → Demo prep & client presentation
```

---

## 🚀 Deployment

VillageHub is being deployed as a **native iOS app** through the **Apple Developer Program**.

| Step | Details |
|---|---|
| **Platform** | iOS (iPhone) |
| **Distribution** | Apple App Store via Apple Developer Program |
| **Build Tool** | Expo EAS Build |
| **Review Process** | Apple App Store Review |

> Android / Google Play deployment may follow in a future phase.

---

## 🤝 Partnerships & Future Integrations

### Hope Services Collaboration

VillageHub is planning a partnership with **[Hope Services](https://www.hopeservices.org/)** — a leading nonprofit supporting individuals with developmental disabilities — to bring wraparound support directly into the app.

Planned integrations include:

- 👩‍⚕️ **Social Worker Matching** — Residents can be matched with a dedicated social worker based on their needs and location
- 📞 **Hope Services Contact Directory** — In-app access to Hope Services staff contacts, resources, and emergency support lines
- 📋 **Case Coordination** — Streamlined communication between residents, social workers, and community admins

> These features are planned for a future release and are subject to partnership agreement finalization.

---

## 👥 Team

| Role | Headcount |
|---|---|
| Backend Developers | 8 |
| Frontend Developers | 4 |
| Project Managers | 2 |

**Difficulty:** Beginner–Intermediate  
**Topics:** Frontend · Backend · APIs · Database · UI/UX

---

## ⚠️ Risks & Mitigations

| Risk | Mitigation |
|---|---|
| New technology learning curve | Dedicated training weeks + pair programming |
| Team experience gaps | Regular check-ins, documentation, and shared code reviews |
| Scope creep | Strict core vs. stretch feature separation |

---

## 🎯 Project Goals

**In scope:**
- ✅ Functional app deployed to the Apple App Store
- ✅ Polished, usable UI/UX
- ✅ Clear learning outcomes for all team members
- ✅ Hope Services partnership groundwork

**Out of scope:**
- ❌ Production-perfect features (polish over completeness)
- ❌ Full-scale deployment

---

<div align="center">
  <br/>
  <img src="images/TVS_logo.png" alt="Tiny Village Spirit" width="48" />
  <br/>
  <sub>Built with ❤️ for <strong>Tiny Village Spirit</strong> communities</sub>
</div>