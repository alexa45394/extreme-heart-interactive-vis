# Rising Floor split-file version

This version uses the uploaded tester HTML as `index.html`, but splits the embedded CSS and JavaScript into:

- `style.css`
- `script.js`

The uploaded JSON is copied exactly as:

- `data/sea_level.json`

Run locally:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```
