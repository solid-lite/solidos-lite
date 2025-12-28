# solidos-lite

Lightweight SolidOS shim with data island support.

**[Live Demo](https://solid-lite.github.io/solidos-lite/)**

## What is this?

solidos-lite lets you embed RDF data directly in HTML and render it with SolidOS - no server required. Just one script tag:

```html
<script src="https://cdn.jsdelivr.net/npm/solidos-lite/solidos-lite.js"></script>
```

It automatically:
- Loads mashlib from CDN
- Parses embedded Turtle or JSON-LD data islands
- Renders with SolidOS panes

## Quick Start

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/solidos-lite/solidos-lite.js"></script>
</head>
<body>

<script type="text/turtle">
@prefix : <#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

:me a foaf:Person ;
    foaf:name "Alice" .
</script>

<div class="TabulatorOutline" id="DummyUUID" role="main">
  <table id="outline"></table>
  <div id="GlobalDashboard"></div>
</div>

</body>
</html>
```

That's it! Visit `page.html#me` to see Alice's profile.

## Supported Formats

### Turtle

```html
<script type="text/turtle">
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
<#me> a foaf:Person ; foaf:name "Alice" .
</script>
```

### JSON-LD

```html
<script type="application/ld+json">
{
  "@context": { "foaf": "http://xmlns.com/foaf/0.1/" },
  "@id": "#me",
  "@type": "foaf:Person",
  "foaf:name": "Alice"
}
</script>
```

## How It Works

1. **Auto-detection** - When the page loads, solidos-lite checks for data islands and a container
2. **Loads mashlib** - Dynamically loads mashlib + CSS from CDN
3. **Parses data** - Turtle parsed directly, JSON-LD converted to Turtle (custom parser, no webpack chunks)
4. **Renders** - Navigates to the URL fragment (e.g., `#me`) or shows document view

## API

For manual control:

```javascript
// Run everything automatically
SolidOSLite.run()

// Or step by step:
await SolidOSLite.loadMashlib()
SolidOSLite.init({ verbose: true })
SolidOSLite.parseAllIslands()
```

### `SolidOSLite.run(options)`

Initialize and run the data browser. Called automatically if data island + container detected.

### `SolidOSLite.loadMashlib()`

Load mashlib from CDN. Returns a Promise.

### `SolidOSLite.init(options)`

Initialize the data island shim. Options: `{ verbose: true }` for logging.

### `SolidOSLite.parseAllIslands()`

Parse all data islands into the RDF store.

### `SolidOSLite.VERSION`

Current version string.

## Examples

- [minimal.html](https://solid-lite.github.io/solidos-lite/minimal.html#me) - Turtle
- [minimal-jsonld.html](https://solid-lite.github.io/solidos-lite/minimal-jsonld.html#me) - JSON-LD
- [standalone.html](https://solid-lite.github.io/solidos-lite/standalone.html#me) - Full profile

## Benefits

- **No CORS issues** - Data is in the page
- **No server required** - Works with static HTML files
- **Works offline** - Once loaded, no network needed
- **Single script** - Mashlib loaded automatically from CDN

## License

AGPL-3.0
