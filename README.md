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
| Constraint drawing, playback, and optimizer controls | `assets/js/playgrounds.mjs` |
| Playground SVGs, charts, and static rendering | `assets/js/playground-view.mjs` |
| A3PM, Halpern, Dykstra, MAP, Cimmino, and 3D P-CRM | `assets/js/projection-math.mjs` |
| FlexGrad, AdaGrad dual averaging, and example objectives | `assets/js/optimizer-math.mjs` |

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

## Interactive numerical experiments

The Halpern and A3PM explanations support drawing up to eight disks or boxes, moving their center handles, setting a common start, and editing constraints numerically. The intersection and its closest point are computed from 2D boundary geometry. An empty intersection disables playback and prompts the visitor to edit the constraints.

- **Halpern–A3PM versus Dykstra:** the chart measures distance to the geometric projection of the common start. Halpern uses `alpha_k = 1/(k+2)` with zero-based indexing and the fixed original anchor. Dykstra retains a correction vector for every set.
- **A3PM versus MAP and Cimmino:** the chart measures `max_i dist(x,C_i)`. MAP is cyclic, and Cimmino uses uniform weights. One outer sweep uses one projection per constraint, with additional half-space combination work for A3PM.
- **Admissible inexactness:** both A3PM phases use `P_hat(x) = eps*x + (1-eps)*P(x)`, which satisfies Definition 3.1 of [the A3PM paper](https://arxiv.org/abs/2506.15895). Exact 2D projections construct these educational approximate projections. `eps=0` recovers 3PM. The demo reports iteration and set-projection counts.
- **P-CRM:** two intersecting lines in three dimensions and an out-of-plane start yield nontrivial circumcenter iterates. The displayed view can rotate; all distances and updates are computed in 3D.
- **FlexGrad:** Algorithm 1 of [the paper](https://arxiv.org/abs/2610.09203), with unit weights, global cumulative gradients, no EMA, and denominator regularization `1e-12`. The comparator is global AdaGrad dual averaging, so the update family, initial point, and scale D agree. Each method evaluates gradients along its own trajectory. The average-view chart uses the running average including `x_0`; the current-view chart uses the latest iterate. Shared D is an adjustable experiment parameter.

Mathematical checks can be run with `node scripts/check-playgrounds.mjs`.
