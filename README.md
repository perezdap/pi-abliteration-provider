# pi-abliteration-provider

[Abliteration AI](https://docs.abliteration.ai/) provider extension for [pi](https://github.com/earendil-works/pi-mono). Uses pi's OpenAI Chat Completions transport for streaming text, reasoning, tool calls, image input, and usage accounting.

Requires Node.js 22+ and pi 0.85.0 or a compatible newer version. Tested against 0.85.0.

## Install

```sh
pi install git:github.com/perezdap/pi-abliteration-provider
```

Private repositories require GitHub access through your Git credentials. Restart pi (or `/reload`), then:

```text
/login abliteration
/model abliteration/abliterated-model-large-v2
```

Enter the API key from your Abliteration console in the login prompt, not in chat. Pi stores the key in its user-level credential store, outside this repository. `/logout abliteration` removes that stored credential; environment variables remain usable until unset.

Alternatively, set `ABLITERATION_API_KEY` or the provider docs' `ABLIT_KEY` environment variable before launching pi. Stored credentials take precedence, followed by those environment variables in that order. No `.env` file is loaded automatically. No API key is needed to load the extension. Pi's `--list-models` lists authenticated providers, so configure a key first.

## Models

| Model ID | Context | Maximum output | Input | USD / million input / output / cached input |
| --- | ---: | ---: | --- | --- |
| `abliterated-model` | 262,144 | 262,134 | Text, images | 3 / 3 / 0.30 |
| `abliterated-model-large-v2` | 1,000,000 | 999,990 | Text | 5 / 5 / 0.50 |
| `abliterated-model-large` | 1,000,000 | 999,990 | Text | 5 / 5 / 0.50 |

Context is a **combined input and output budget**; the maximum output is reachable only with a tiny prompt. These are documented limits, not independently measured limits. The catalog is intentionally static: startup is offline, does not probe models or incur inference charges, and always exposes all three models. Update the extension when the provider changes its catalog or rates.

### Reasoning

- Base: off, minimal, low, medium, high, xhigh, max.
- Large V2: off, low, high, max.
- Previous Large: off, high, max.

Redundant aliases are hidden on large models so the picker shows distinct depths. **Large V2 cannot disable reasoning**: off sends `none`, which runs low reasoning with the trace hidden and still bills those tokens. Off disables reasoning on the other two models.

### Compatibility

- Endpoint: `https://api.abliteration.ai/v1/chat/completions` with bearer authentication.
- Sends `system`, `max_tokens`, `reasoning_effort`, and streaming usage requests.
- Omits `store`, strict tool schema mode, OpenAI-specific affinity headers, and unsupported `prompt_cache_retention`.
- Prompt caching is automatic. Pi reads `prompt_tokens_details.cached_tokens` and applies the documented 10% cached-input rate. Cache creation is billed at the normal input rate. This extension does not add routing hints or promise cache hits.
- Uses ordinary pi tools; provider-hosted web search/fetch, video, Responses, Anthropic Messages, and policy gateway routes are not implemented.
- No custom retry, cancellation, or overflow handling; these remain pi's responsibility.

## Development

```sh
npm ci
npm run check
# After configuring your key (listing does not perform inference):
pi --no-extensions -e ./index.ts --list-models abliteration
npm pack --dry-run
```

Tests exercise the real pi serializer and streaming parser with mocked HTTP responses: model metadata, reasoning payloads, usage/costs, streamed tool arguments, and authentication errors. They make no live requests. Live inference and account access have **not** been verified; authenticate and make a small request to verify your account before relying on it.

## Sources

Catalog and behavior checked against the provider documentation on 2026-09-04:

- [Models and limits](https://docs.abliteration.ai/models)
- [Pricing](https://docs.abliteration.ai/pricing)
- [Reasoning modes](https://docs.abliteration.ai/capabilities/thinking)
- [OpenAI compatibility](https://docs.abliteration.ai/api/openai-compatibility)
- [Prompt caching and streaming usage](https://docs.abliteration.ai/capabilities/prompt-caching)

MIT licensed. Unofficial integration; not affiliated with Abliteration AI.
