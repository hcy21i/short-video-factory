# Connect AI clients with MCP

Short Video Factory exposes a standard MCP `stdio` server. The MCP host uses Node.js for the client protocol and starts a private, hidden Electron worker for video rendering. This works with MCP clients that launch local `stdio` servers, including clients that do not support MCP over HTTP. Each client gets an isolated worker; one worker renders one job at a time.

## Packaged app

Node.js 22 or newer must be installed. Point the client's MCP server command to `node`, then pass the packaged host script and application executable as arguments:

The desktop app's **AI assistant connection** page generates this configuration using the paths for the current installation. Set the Node.js command there if the AI client cannot find `node`, then copy the JSON into the client's MCP settings.

```json
{
  "mcpServers": {
    "short-video-factory": {
      "command": "node",
      "args": [
        "C:\\Program Files\\短视频工厂\\resources\\mcp-stdio-host.cjs",
        "--app-path",
        "C:\\Program Files\\短视频工厂\\短视频工厂.exe"
      ]
    }
  }
}
```

The app executable is `短视频工厂.app/Contents/MacOS/短视频工厂` on macOS. On Linux, use the executable installed from the AppImage and the host script under the adjacent `resources` directory. Change these paths to match your install location. Use the same command and arguments in each MCP client.

## Development from source

Build the renderer and Electron main process with `pnpm exec vite build`, then generate the standalone host with `pnpm build:mcp`. Add an MCP server entry with `node` as command and the following arguments, replacing both placeholders with absolute paths:

```json
[
  "<absolute-project-path>/.mcp-build/mcp-stdio-host.cjs",
  "--app-path",
  "<absolute-project-path>"
]
```

The host launches the Electron binary from that project.

## Tools

- `list_subtitle_styles`: list the twelve subtitle styles.
- `render_video`: render local video clips in the supplied order with a voice track, optional background music, optional SRT subtitles, and an optional subtitle style. Paths must be absolute. Clip times are seconds. Output folders must already exist; width and height must be even numbers.
- `get_task_status`: read task progress, output path, or error using its `jobId`.
- `cancel_task`: cancel an active render using its `jobId`.

The worker listens only on `127.0.0.1`, uses a fresh random token for each connection, and accepts calls only from its MCP host. Disconnecting the AI client cancels any render still in progress.
