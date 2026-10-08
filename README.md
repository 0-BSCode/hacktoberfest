Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
pnpm install
pnpm dev
```

# Building For Production

To build this application for production:

```bash
pnpm build
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting. The following scripts are available:


```bash
pnpm lint
pnpm format
pnpm check
```


## Deploy with Nitro

This project uses Nitro as a generic server adapter, so it can run on any Node-compatible host.

```bash
npm run build
node dist/server/index.mjs
```

The build output is a self-contained Node server. To deploy, push the `dist/` directory to your host (Render, Fly.io, your own VPS, etc.) and run the server command above.

For host-specific presets (Vercel, Netlify, Cloudflare, AWS Lambda, etc.) and tuning, see https://v3.nitro.build/deploy.


# Todo workspace

Open `/todos` or use the Todos navigation link. Enter one task in the New task
field and click Add or press Enter. Manual entry works without AI access. Check
or uncheck tasks directly in the list.

Select the red trash icon on the right of a task to remove it. A themed confirmation dialog
names the task; Cancel or Escape keeps it. Confirmed deletions are saved in this browser and
work while chat is processing or unavailable. Chat deletion commands remain
deferred.

For a longer dump, enter a message in the side chat and select Extract tasks.
The app extracts new task titles and adds them automatically. Each message is
independent. Empty results change nothing; failed messages have a Retry button.
Manual entry stays available while extraction is running or unavailable.

Tasks and completion states are saved in this browser under
`hacktoberfest.todos.v1`. Chat messages last only for the page session. There are
no accounts, device sync, or live synchronization between tabs. Storage failures
show a warning and leave the current list usable. Chat commands to edit, complete,
or delete existing tasks are deferred to a later change.

## Extraction setup and API

Set `OPENROUTER_API_KEY` in `.env.local` for local development, or in the server
environment when deployed. Restart the server after changing configuration. The
key stays on the server; do not use a `VITE_` prefix. Todo extraction uses the
TanStack AI OpenRouter adapter and defaults to the open-weight
`qwen/qwen3-30b-a3b-instruct-2507` model.

```env
OPENROUTER_API_KEY=your_openrouter_api_key
# Optional; unset or whitespace-only uses the Qwen default above.
OPENROUTER_MODEL=qwen/qwen3-30b-a3b-instruct-2507
```

To switch models, set `OPENROUTER_MODEL` to an open-weight model ID with
structured-output support on OpenRouter. The server trims the setting; the
browser cannot select a model. Requests require schema-capable provider
endpoints and do not automatically fall back to another model or plain text.
Unsupported models or unavailable compatible providers produce a safe error.
Optional streamed usage reporting is disabled to keep it from restricting
provider routing. The browser still receives one complete JSON response.

`OPENAI_API_KEY` alone no longer enables todo extraction. Existing demo routes
continue using their own provider credentials, including `OPENAI_API_KEY`.

`POST /api/tasks/extract` accepts JSON:

```json
{ "message": "Buy milk, submit the presentation, and call Mum" }
```

A successful response is a complete, validated batch:

```json
{ "tasks": ["Buy milk", "Submit the presentation", "Call Mum"] }
```

Messages can contain 1 to 10,000 characters. Results can contain up to 50 titles,
each trimmed and between 1 and 500 characters. Messages without new tasks return
`{ "tasks": [] }`. Only the current message goes to the model; existing tasks and
the chat transcript are not sent.

Errors return `{ "error": "..." }`: HTTP 400 for invalid input, 503 for missing
server configuration, and 502 for provider or output-validation failure. The
browser adds no tasks from failed or invalid responses.

Run the assertion-based schema, endpoint, and adapter transport checks with Node 24:

```bash
node --experimental-test-module-mocks src/lib/todo.test.ts
```

These checks use controlled responses and intercept provider requests, so they
require no credentials or external network access. They verify routing, schema
serialization, model configuration, and safe failures, but do not establish
live model accuracy. Live Qwen extraction has not been verified in this workspace
because no `OPENROUTER_API_KEY` is configured.

# TanStack Chat Application

Am example chat application built with TanStack Start, TanStack Store, and Claude AI.

## .env Updates

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## ✨ Features

### AI Capabilities
- 🤖 Powered by Claude 3.5 Sonnet 
- 📝 Rich markdown formatting with syntax highlighting
- 🎯 Customizable system prompts for tailored AI behavior
- 🔄 Real-time message updates and streaming responses (coming soon)

### User Experience
- 🎨 Modern UI with Tailwind CSS and Lucide icons
- 🔍 Conversation management and history
- 🔐 Secure API key management
- 📋 Markdown rendering with code highlighting

### Technical Features
- 📦 Centralized state management with TanStack Store
- 🔌 Extensible architecture for multiple AI providers
- 🛠️ TypeScript for type safety

## Architecture

### Tech Stack
- **Frontend Framework**: TanStack Start
- **Routing**: TanStack Router
- **State Management**: TanStack Store
- **Styling**: Tailwind CSS
- **AI Integration**: Anthropic's Claude API


## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).


# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.


# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
