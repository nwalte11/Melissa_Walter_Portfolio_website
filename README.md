# Melissa Walter Portfolio Website

A clean, responsive teacher portfolio website focused on readability and simple maintenance.

## Project Architecture

```
.
|-- index.html
|-- css/
|   `-- styles.css
|-- js/
|   `-- main.js
|-- vercel.json
`-- README.md
```

## Readability and Pane Layout Strategy

- Semantic sections (`header`, `main`, `section`, `article`, `aside`, `footer`) improve accessibility and content scanning.
- Responsive pane sizing uses CSS Grid and `minmax()` so content blocks stay readable on desktop and mobile.
- Text scale uses `clamp()` to keep headings and body text balanced across screen sizes.
- Card and pane spacing follows a consistent rhythm for visual clarity.
- Motion is minimal and respectful of accessibility via `prefers-reduced-motion`.

## Local Preview

You can open `index.html` directly in a browser, or use a simple local server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Vercel Deployment

This project is ready for static deployment on Vercel.

1. Push this repository to GitHub.
2. In Vercel, click **New Project** and import the repository.
3. Keep defaults (Framework Preset can stay as **Other**).
4. Deploy.

`vercel.json` is included for clean URLs and consistent behavior.

## Customization

- Update profile content in `index.html`.
- Change the visual theme in `css/styles.css` under `:root` variables.
- Replace contact links in the Contact section.