/**
 * solidos-lite v0.0.3
 * Lightweight SolidOS shim with data island support
 *
 * Intercepts RDF fetches to check for local data islands first,
 * falling back to network requests when no island exists.
 *
 * @license MIT
 */

(function(global) {
'use strict';

const VERSION = '0.0.3'

// Load mashlib from CDN
const MASHLIB_JS = 'https://cdn.jsdelivr.net/npm/mashlib/dist/mashlib.min.js'
const MASHLIB_CSS = 'https://cdn.jsdelivr.net/npm/mashlib/dist/mash.css'

/**
 * Load mashlib dynamically if not already loaded
 * @returns {Promise}
 */
function loadMashlib() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof SolidLogic !== 'undefined' && typeof panes !== 'undefined') {
      resolve()
      return
    }

    // Load CSS if not present
    if (!document.querySelector(`link[href="${MASHLIB_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = MASHLIB_CSS
      document.head.appendChild(link)
    }

    // Load JS
    const script = document.createElement('script')
    script.src = MASHLIB_JS
    script.onerror = () => reject(new Error('Failed to load mashlib'))
    script.onload = () => {
      // Wait for SolidLogic to be defined (mashlib initialization)
      const checkReady = () => {
        if (typeof SolidLogic !== 'undefined' && typeof panes !== 'undefined') {
          resolve()
        } else {
          setTimeout(checkReady, 10)
        }
      }
      checkReady()
    }
    document.head.appendChild(script)
  })
}

/**
 * Minimal JSON-LD to Turtle converter
 * Handles basic JSON-LD without remote contexts
 */
function jsonldToTurtle(jsonld, baseUri) {
  const ctx = jsonld['@context'] || {}
  const lines = []
  const prefixes = {}

  // Collect prefixes from context
  Object.keys(ctx).forEach(key => {
    if (typeof ctx[key] === 'string' && !key.startsWith('@')) {
      prefixes[key] = ctx[key]
    }
  })

  // Add prefix declarations
  Object.keys(prefixes).forEach(prefix => {
    lines.push(`@prefix ${prefix}: <${prefixes[prefix]}> .`)
  })
  lines.push(`@base <${baseUri}> .`)
  lines.push('')

  // Expand a prefixed term using context
  function expand(term) {
    if (!term) return null
    if (term.startsWith('http://') || term.startsWith('https://')) return `<${term}>`
    if (term.startsWith('#')) return `<${term}>`

    const colonIdx = term.indexOf(':')
    if (colonIdx > 0) {
      const prefix = term.substring(0, colonIdx)
      const local = term.substring(colonIdx + 1)
      if (prefixes[prefix]) return `${prefix}:${local}`
      if (ctx[prefix]) return `<${ctx[prefix]}${local}>`
    }
    if (ctx[term]) return `<${ctx[term]}>`
    return `<${term}>`
  }

  // Convert a value to Turtle format
  function toTurtle(value) {
    if (typeof value === 'string') {
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
      return `"${escaped}"`
    }
    if (typeof value === 'number') return `${value}`
    if (typeof value === 'boolean') return `${value}`
    return null
  }

  // Process a single node
  function processNode(node, defaultId) {
    const id = node['@id'] ? expand(node['@id']) : defaultId
    if (!id) return

    const subject = id

    // Handle @type
    const types = node['@type']
    if (types) {
      const typeArray = Array.isArray(types) ? types : [types]
      typeArray.forEach(t => {
        lines.push(`${subject} a ${expand(t)} .`)
      })
    }

    // Handle other properties
    Object.keys(node).forEach(key => {
      if (key.startsWith('@')) return

      const predicate = expand(key)
      if (!predicate) return

      const values = Array.isArray(node[key]) ? node[key] : [node[key]]
      values.forEach(val => {
        if (val === null || val === undefined) return

        if (typeof val === 'object' && val['@id']) {
          lines.push(`${subject} ${predicate} ${expand(val['@id'])} .`)
        } else if (typeof val === 'object' && val['@value']) {
          let obj = `"${val['@value']}"`
          if (val['@type']) obj += `^^${expand(val['@type'])}`
          if (val['@language']) obj += `@${val['@language']}`
          lines.push(`${subject} ${predicate} ${obj} .`)
        } else if (typeof val === 'object') {
          const blankId = '_:b' + Math.random().toString(36).substr(2, 9)
          lines.push(`${subject} ${predicate} ${blankId} .`)
          processNode(val, blankId)
        } else {
          const obj = toTurtle(val)
          if (obj) lines.push(`${subject} ${predicate} ${obj} .`)
        }
      })
    })
  }

  if (jsonld['@graph']) {
    jsonld['@graph'].forEach(node => processNode(node))
  } else {
    processNode(jsonld)
  }

  return lines.join('\n')
}

/**
 * Find a data island script tag for a given URI
 * @param {string} uri - The URI to look for
 * @returns {HTMLScriptElement|null}
 */
function findDataIsland(uri) {
  // Check for exact URI match via data-uri attribute
  const byUri = document.querySelector(`script[data-uri="${uri}"]`)
  if (byUri) return byUri

  // Check for fragment URIs using page base
  const pageBase = window.location.href.split('?')[0].split('#')[0]
  if (uri.startsWith(pageBase + '#') || uri === pageBase) {
    // Look for default data island (no data-uri, or matching page)
    const defaultIsland = document.querySelector('script[type="text/turtle"]:not([data-uri])')
      || document.querySelector(`script[type="text/turtle"][data-uri="${pageBase}"]`)
    if (defaultIsland) return defaultIsland
  }

  return null
}

/**
 * Get the content type from a script element
 * @param {HTMLScriptElement} script
 * @returns {string}
 */
function getContentType(script) {
  const type = script.type || script.getAttribute('type')
  // Map common types
  const typeMap = {
    'text/turtle': 'text/turtle',
    'application/ld+json': 'application/ld+json',
    'application/n-triples': 'application/n-triples',
    'text/n3': 'text/n3'
  }
  return typeMap[type] || 'text/turtle'
}

/**
 * Initialize the data island shim
 * Must be called after mashlib is loaded
 * @param {Object} options
 * @param {boolean} options.verbose - Log data island loads to console
 */
function init(options = {}) {
  const { verbose = false } = options

  // Check mashlib is loaded
  if (typeof SolidLogic === 'undefined') {
    console.error('solidos-lite: SolidLogic not found. Load mashlib first.')
    return false
  }

  const store = SolidLogic.store
  const fetcher = store.fetcher

  if (!fetcher || !fetcher.load) {
    console.error('solidos-lite: fetcher.load not found.')
    return false
  }

  // Store original load function
  const originalLoad = fetcher.load.bind(fetcher)

  // Override load to check data islands first
  fetcher.load = async function(uri, options = {}) {
    const uriStr = typeof uri === 'string' ? uri : uri.value || uri.uri || String(uri)

    // Normalize URI (remove trailing slash for comparison)
    const normalizedUri = uriStr.replace(/\/$/, '')
    const pageBase = window.location.href.split('?')[0].split('#')[0].replace(/\/$/, '')

    // Look for a data island
    const island = findDataIsland(uriStr) || findDataIsland(normalizedUri)

    if (island) {
      const contentType = getContentType(island)
      const content = island.textContent
      const baseUri = island.dataset.uri || window.location.href.split('?')[0].split('#')[0]

      if (verbose) {
        console.log(`solidos-lite: Loading from data island: ${uriStr}`)
      }

      try {
        // Parse the data island content into the store
        $rdf.parse(content, store, baseUri, contentType)

        // Mark as fetched in multiple formats
        const doc = $rdf.sym(baseUri)
        fetcher.requested[baseUri] = 'done'
        fetcher.requested[baseUri.replace(/\/$/, '')] = 'done'
        fetcher.requested[baseUri + '/'] = 'done'

        // Also mark the fetcher's getState
        if (fetcher.getState) {
          fetcher.getState = (function(original) {
            return function(docuri) {
              const u = typeof docuri === 'string' ? docuri : docuri.uri
              if (u === baseUri || u === normalizedUri || u === pageBase ||
                  u === baseUri + '/' || u === normalizedUri + '/') {
                return 'fetched'
              }
              return original.call(fetcher, docuri)
            }
          })(fetcher.getState.bind(fetcher))
        }

        return doc
      } catch (err) {
        console.error(`solidos-lite: Error parsing data island for ${uriStr}:`, err)
        // Fall through to network fetch
      }
    }

    // Check if this is the current page (which we've already loaded via data island)
    if (normalizedUri === pageBase || uriStr === pageBase ||
        uriStr === pageBase + '/' || normalizedUri === pageBase + '/') {
      if (verbose) {
        console.log(`solidos-lite: Skipping fetch for current page: ${uriStr}`)
      }
      return $rdf.sym(uriStr)
    }

    // No data island found, use network
    if (verbose) {
      console.log(`solidos-lite: No data island for ${uriStr}, using network`)
    }

    return originalLoad(uri, options)
  }

  if (verbose) {
    console.log(`solidos-lite v${VERSION} initialized`)
  }

  return true
}

/**
 * Parse all data islands on the page into the store
 * Useful for pre-loading all embedded data
 */
function parseAllIslands() {
  const store = SolidLogic.store
  const islands = document.querySelectorAll('script[type="text/turtle"], script[type="application/ld+json"]')
  const pageBase = window.location.href.split('?')[0].split('#')[0]

  let count = 0
  islands.forEach(island => {
    const uri = island.dataset.uri || pageBase
    const contentType = getContentType(island)

    try {
      if (contentType === 'application/ld+json') {
        // Use our custom JSON-LD parser to avoid chunk loading
        const jsonld = JSON.parse(island.textContent)
        const turtle = jsonldToTurtle(jsonld, uri)
        $rdf.parse(turtle, store, uri, 'text/turtle')
      } else {
        $rdf.parse(island.textContent, store, uri, contentType)
      }
      count++
    } catch (err) {
      console.error(`solidos-lite: Error parsing island for ${uri}:`, err)
    }
  })

  return count
}

/**
 * Ensure the required DOM structure exists for the outliner
 * Creates elements if missing, defaults to body
 * @returns {HTMLElement} The container element
 */
function ensureContainer() {
  // Look for existing container
  let container = document.getElementById('DummyUUID')
                || document.getElementById('PageBody')

  // Default to body if no container found
  if (!container) {
    container = document.body
  }

  // Ensure outline table exists
  if (!document.getElementById('outline')) {
    const table = document.createElement('table')
    table.id = 'outline'
    container.appendChild(table)
  }

  // Ensure GlobalDashboard exists (for auth UI)
  if (!document.getElementById('GlobalDashboard')) {
    const dashboard = document.createElement('div')
    dashboard.id = 'GlobalDashboard'
    container.appendChild(dashboard)
  }

  return container
}

/**
 * Run the data browser with minimal setup
 * Automatically parses data islands and navigates to the URL fragment
 * @param {Object} options
 * @param {boolean} options.verbose - Log to console
 */
function run(options = {}) {
  const { verbose = false } = options

  // Init the shim
  if (!init({ verbose })) {
    console.error('solidos-lite: Failed to initialize')
    return false
  }

  // Parse all data islands
  const count = parseAllIslands()
  if (verbose) {
    console.log(`solidos-lite: Parsed ${count} data island(s)`)
  }

  // Ensure DOM structure exists
  ensureContainer()

  // Set up fetcher intercepts for the current page
  const pageBase = window.location.href.split('?')[0].split('#')[0]
  const pageBaseNoSlash = pageBase.replace(/\/$/, '')
  const fetcher = SolidLogic.store.fetcher

  // Mark as fetched
  fetcher.requested[pageBase] = 'done'
  fetcher.requested[pageBaseNoSlash] = 'done'

  // Intercept nowOrWhenFetched
  const origNowOrWhen = fetcher.nowOrWhenFetched.bind(fetcher)
  fetcher.nowOrWhenFetched = function(uri, opts, callback) {
    const u = (typeof uri === 'string' ? uri : uri.value || uri.uri).replace(/\/$/, '')
    if (u === pageBaseNoSlash) {
      if (callback) callback(true, null)
      return Promise.resolve(true)
    }
    return origNowOrWhen(uri, opts, callback)
  }

  // Get subject from URL hash, or use document itself
  const hash = window.location.hash
  const subject = hash ? $rdf.sym(pageBase + hash) : $rdf.sym(pageBase)

  if (verbose) {
    console.log(`solidos-lite: Navigating to ${subject.value}`)
  }

  // Run the outliner
  const outliner = panes.getOutliner(document)
  outliner.GotoSubject(subject, true, undefined, true, undefined)

  return true
}

// Attach to window
global.SolidOSLite = { init, findDataIsland, parseAllIslands, run, loadMashlib, VERSION }

// Auto-run if data island exists and DOM is ready
async function autoRun() {
  const hasDataIsland = document.querySelector('script[type="text/turtle"], script[type="application/ld+json"]')

  if (hasDataIsland) {
    try {
      await loadMashlib()
      run()
    } catch (err) {
      console.error('solidos-lite: Failed to load mashlib:', err)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoRun)
} else {
  autoRun()
}

})(typeof window !== 'undefined' ? window : this);
