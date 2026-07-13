# SiteX – Site Intelligence Tool

![Node.js Version](https://img.shields.io/badge/node.js-14%2B-brightgreen?style=flat&logo=node.js)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
![ss](screenshot.jpg)
**SiteX** is a powerful web‑based tool that reveals the complete digital fingerprint of any website.  
Enter a URL and get detailed information about its **IP, geolocation, WHOIS, DNS records, SSL certificate, HTTP headers, technology stack, page metadata, cookies, and all internal/external links** – all in a beautiful, dark‑themed UI.

---

## ✨ Features

- 🔍 **Instant lookup** – just paste a URL and hit enter.
- 🌐 **Comprehensive data** – IP, geolocation, DNS (A, AAAA, MX, NS, TXT, CNAME), WHOIS, SSL, server headers, and more.
- 🧩 **Technology detection** – identifies frameworks, CMS, analytics, and CDNs.
- 🔗 **Link discovery** – extracts internal, external, and social links from the target page.
- 📋 **Export as JSON** – download all gathered data for offline analysis.
- 🎨 **Dark, modern UI** – with smooth animations and responsive cards.
- 🚀 **Backend driven** – all requests go through a Node.js server, avoiding browser CORS issues.

---

## 🧰 Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (no frameworks)
- **Backend:** Node.js + Express
- **Libraries:** Axios, Cheerio, WHOIS‑JSON, Node.js built‑in `dns` and `tls`

---

## 📦 Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/sitex.git
cd sitex
```
### 2. Run
```bash
node server.js
```
### 3. Open your browser
Visit **`http://localhost:3000`** and start exploring!

## Structure
```
sitex/
├── public/
│   ├── index.html      # Main HTML
│   ├── styles.css      # All styles
│   └── app.js          # Frontend logic
├── server.js           # Express backend
├── package.json
└── README.md
```
## 📄 License

[MIT](https://choosealicense.com/licenses/mit/)

---

## 🙏 Credits

Developed by [DangerousAngel](https://github.com/DangerousAngel/)  
Powered by [ipapi.co](https://ipapi.co/) and [HackerTarget](https://hackertarget.com/) APIs.

---

