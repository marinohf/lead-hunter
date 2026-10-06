# Lead Hunter

Lead Hunter is a lightweight lead capture and CRM-style dashboard focused on collecting and tracking customer prospects.

## Features

- Capture new leads from a simple web form
- Store leads locally in JSON for fast iteration
- View a list of all captured leads in a clean dashboard
- Support common lead statuses: New, Contacted, Qualified, Won, and Lost

## Tech Stack

- Node.js
- Express
- Vanilla JavaScript + HTML + CSS

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the application:

   ```bash
   npm start
   ```

3. Open http://localhost:3000

## Project structure

```text
.
├── data/
│   └── leads.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## Notes

This repository is intentionally simple and ready for extension. You can add authentication, a database, analytics, or a real CRM integration later.
