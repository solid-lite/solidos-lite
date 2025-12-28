# solidos-lite

Lightweight SolidOS shim with data island support.

**[Live Demo](https://solid-lite.github.io/solidos-lite/)**

## What is this?

solidos-lite intercepts RDF fetches to check for embedded data islands first, falling back to network requests when no island exists. This enables:

- **No CORS issues** - Data is already in the page
- **No network latency** - Instant load
- **Works offline** - No server required
- **Static site compatible** - Just HTML files

## Installation

### CDN / Script Tag

```html
<!-- Load mashlib first -->
<script src="https://cdn.jsdelivr.net/npm/mashlib/dist/mashlib.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/mashlib/dist/mash.css" />

<!-- Then load solidos-lite -->
<script src="https://cdn.jsdelivr.net/npm/solidos-lite/solidos-lite.js"></script>
<script>
  SolidOSLite.init({ verbose: true })
</script>
```

### npm

```bash
npm install solidos-lite
```

```html
<script src="node_modules/solidos-lite/solidos-lite.js"></script>
<script>
  SolidOSLite.init({ verbose: true })
</script>
```

## Usage

### 1. Embed your data

Add a `<script type="text/turtle">` tag with your RDF:

```html
<script type="text/turtle">
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<#me>
    a foaf:Person ;
    foaf:name "Alice" ;
    foaf:knows <#bob> .

<#bob>
    a foaf:Person ;
    foaf:name "Bob" .
</script>
```

### 2. Initialize the shim

```javascript
SolidOSLite.init({ verbose: true })
```

### 3. Use SolidOS normally

```javascript
const subject = $rdf.sym(window.location.href + '#me')
const outliner = panes.getOutliner(document)
outliner.GotoSubject(subject, true, undefined, true, undefined)
```

When SolidOS tries to load `#me`, it will find the data in the embedded island instead of making a network request.

## Data Island Attributes

### Default (page base URI)

```html
<script type="text/turtle">
  <!-- Data for this page's URI -->
</script>
```

### Specific URI

```html
<script type="text/turtle" data-uri="https://example.org/profile">
  <!-- Data for a specific URI -->
</script>
```

## Supported Formats

- `text/turtle` (recommended)
- `application/ld+json`
- `application/n-triples`
- `text/n3`

## API

### `SolidOSLite.init(options)`

Initialize the data island shim.

```javascript
SolidOSLite.init({
  verbose: true  // Log data island loads to console
})
```

### `SolidOSLite.findDataIsland(uri)`

Find a data island for a given URI.

```javascript
const island = SolidOSLite.findDataIsland('https://example.org/profile')
if (island) {
  console.log('Found:', island.textContent)
}
```

### `SolidOSLite.parseAllIslands()`

Pre-parse all data islands into the store.

```javascript
const count = SolidOSLite.parseAllIslands()
console.log(`Parsed ${count} data islands`)
```

### `SolidOSLite.VERSION`

Current version string.

## Roadmap

- [x] Phase 1: Read-only data islands
- [ ] Phase 2: Write support (update data islands on PUT/PATCH)
- [ ] Phase 3: localStorage persistence

## License

MIT
