# Connect AI clients with MCP

Short Video Factory exposes a standard MCP `stdio` server for clients that launch local servers, including clients that do not support MCP over HTTP. The packaged Windows app uses a Node.js host script and starts a private, hidden Electron worker. Each MCP client starts its own worker, which runs one render task at a time.

## Connect a client

Install Node.js 22 or newer. In the app, open **AI assistant connection**, copy the generated JSON into the MCP settings of your client, and use the same JSON in each client you want to connect. If a client cannot find `node`, set its full Node.js executable path in the app before copying the configuration.

The generated configuration follows this shape; the app fills in the actual install paths:

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

## Tools

- `list_subtitle_styles`: list the twelve subtitle styles.
- `render_subtitled_video`: overlay an SRT, subtitle style, and optional animation on one local video while retaining its original audio track. Animations are `none`, `fade`, `slide-up`, `slide-left`, `slide-right`, `pop`, `zoom-in`, `typewriter`, and `fade-out`; `fade-out` fades at the end of each cue. The default is `none`. The video must contain audio. Supply `duration` in seconds, then poll `get_task_status` for the output path.
- `render_video`: render local video clips in the supplied order with a voice track, optional background music, optional SRT subtitles, subtitle style, and optional animation. The animation values are `none`, `fade`, `slide-up`, `slide-left`, `slide-right`, `pop`, `zoom-in`, `typewriter`, and `fade-out`; `fade-out` fades at the end of each cue. The default is `none`. Paths must be absolute. Clip times are seconds. Output folders must already exist; width and height must be even numbers.
- `get_task_status`: read the progress, result, output path, or error for a render task using its `jobId`.
- `cancel_task`: cancel a running render task using its `jobId`.

Video and audio paths are read by the local app. The MCP worker listens only on `127.0.0.1`, uses a fresh random token for each connection, and accepts calls only from its MCP host. Disconnecting the AI client cancels its active render job.

Each MCP render is limited to 10 minutes of output. Source clip timestamps are limited to 24 hours, and subtitle frame generation is capped at 18,000 frames.
