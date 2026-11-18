# Pablo Barros — personal website

The site is split into small HTML sections, shared CSS, JavaScript, and one publication data file. The generated root `index.html` and `research.html` remain ordinary static pages served by GitHub Pages. All paper explanations and initial SVG illustrations are in the HTML, so the content remains available without JavaScript.

## Where to make changes

| Change | Edit |
| --- | --- |
| Paper titles, authors, links, submission dates, explanations, applications | `content/papers.json` |
| Profile text and PhD / IMO / incoming Quant cards | `src/sections/hero.html` |
| Research interests | `src/sections/research.html` |
| Education | `src/sections/education.html` |
| Professional experience | `src/sections/experience.html` |
| Publications heading and introduction | `src/sections/publications.html` |
| Awards | `src/sections/awards.html` |
| Classes and teaching | `src/sections/classes.html` |
| Contact information | `src/sections/contact.html` |
| Shared navigation, metadata, footer | `src/components/` |
| Homepage / explanation-page structure | `src/pages/` |
| Existing site appearance | `assets/css/site.css` |
| Portrait, logos, and favicon | `assets/images/` |
| Explanation-page appearance | `assets/css/research.css` |
| Mathematical SVG illustrations and toy instances | `assets/js/diagrams.mjs` |
| Visualization controls and topic filters | `assets/js/research.mjs` |

## Build after editing

With Node.js 18 or newer:

```sh
node scripts/build.mjs
```

No packages need installing. This updates both root HTML files from their source sections and the shared publication data. Commit the source changes **and** the generated HTML files. GitHub Pages can keep serving the repository root with its existing configuration.

For a local preview, serve the repository folder using any static HTTP server. For example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. There are no third-party JavaScript dependencies, runtime HTML fetches, or external chart services. The existing Google Fonts stylesheet is retained.

## Editing a paper

Each object in `content/papers.json` supplies both its homepage entry and its explanation page. Update `status` for submission dates; add a `links` entry with a `label` and HTTPS `url` for a new preprint. Keep the `id` stable because it is also the public URL fragment (for example, `research.html#flexgrad`).

The `question`, `idea`, `result`, and `application` fields are plain text, escaped by the builder. The `diagram` field chooses a renderer from `assets/js/diagrams.mjs`.

The examples illustrate mathematical mechanisms; they are not paper benchmark results. For papers in preparation, use research-direction wording until results are ready to publish.
