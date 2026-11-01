# Apple Silicon macOS prototype benchmark

Measured 2026-10-31 on the same Mac with one Lepton window at a time. Both
apps displayed the same six-snippet render fixture, including code, Markdown,
and an image. The Electron app was an unpacked production build. The Rust app
was a release-optimized build with the test-only WebDriver feature enabled;
its fixture represents the local library, so remote controls and profile
images differ from the Electron fixture.

| Measurement | Electron | Rust prototype |
| --- | ---: | ---: |
| Installed app directory, `du -sk` | 255.9 MiB | 11.7 MiB |
| Sum of process RSS, three idle samples | 491.2, 498.2, 492.4 MiB | 353.3, 353.3, 353.0 MiB |
| Launch to fixture DOM and decoded avatar, three launches | 678, 527, 514 ms | 771, 448, 427 ms |

The Rust bundle was about 95% smaller in this build. Mean summed RSS was
about 28% lower for this fixture. Electron's four app processes were included;
the Rust measurement included the main process plus the newly started macOS
WebKit content, GPU, and network processes. WebKit helpers already present
before the Rust launch were excluded. Summed RSS counts shared pages more than
once and is not equivalent to physical footprint. The macOS WebKit runtime is
provided by the operating system and is not included in the Rust app size.
For startup, each launch used a fresh isolated data directory and the apps ran
sequentially. Readiness was detected by polling for the fixture in the DOM and
the decoded avatar, using Electron's DevTools protocol and the Rust test build's
WebDriver respectively. The median was 527 ms for Electron and 448 ms for
Rust, but three runs and different instrumentation do not establish a reliable
general speedup. Filesystem and OS caches were warm; the test does not measure
first paint, editing, search, live GitHub sync, or a large account. These are
short, single-machine samples, and the migration is not feature-complete.

## Local interaction samples

Measured on the same Mac with the same six-snippet fixture. Each app was
launched separately. The table shows medians for six repetitions of each UI
action and five insertions of a synthetic 1 MiB editor buffer:

| Action | Electron | Rust prototype |
| --- | ---: | ---: |
| Open search | 4.7 ms | 7 ms |
| Search file content for `hello` | 5.1 ms | 8 ms |
| Select the Python snippet | 5.4 ms | 7.5 ms |
| Open the existing snippet editor | 7.4 ms | 8 ms |
| Put 1 MiB of synthetic text in the editor and wait two animation frames | 480 ms | 587 ms |

The small-action timings are measured inside the renderer from a synthetic
event until the expected DOM element appears; they do not include physical
input, screen presentation or remote requests. Search covered only six small
snippets. For the large-buffer test, the editor was already open and CodeMirror
received 16,384 synthetic 64-byte lines using `setValue`; the value was checked
after two animation frames. The first insertion took 502 ms in Electron and
1,623 ms in Rust; the following four ranged from 450–500 ms and 578–589 ms,
respectively. This is neither a GitHub download nor an end-to-end large-Gist
load, and five repetitions in one process are not a broad benchmark. As with
the startup measurement, Electron used DevTools and the Rust test build used
WebDriver to run the same measurement code.

## Large-file follow-up

An isolated loopback server returned the same single 512 KiB JavaScript Gist to
both apps, with `snippet.downloadAll` enabled. The samples measure from
submitting the test token to the complete 513-row file table appearing in the
DOM, including profile, index and file requests, local processing, and UI
construction. Each run used a fresh data directory; the server used only test
credentials and in-memory data.

| Measurement | Electron | Rust prototype |
| --- | ---: | ---: |
| Mock 512 KiB Gist login to file view | 117, 87, 101 ms | 62, 69, 71 ms |

The medians are 101 ms and 69 ms, respectively. This uses a local server with
no internet latency and a complete, untruncated API response. It does not prove
performance for GitHub's truncated-file response, larger accounts, or actual
network conditions.

The 1 MiB editor test was also split into the synchronous `CodeMirror.setValue`
call and the following two animation-frame callbacks. In one eight-insertion
run, Electron's `setValue` calls took 368–440 ms. Rust's calls varied between
339–393 ms and 886–1,408 ms; its second post-insertion frame arrived roughly
224–238 ms after the first. Electron's second frame arrived 14–62 ms after the
first. Both windows reported being visible and focused; five idle frame waits
were approximately 12–18 ms in each app. Detaching the editor's one change
handler did not remove the slow Rust calls or the post-insertion frame delay.

These observations narrow the issue to work in or following the editor/WebKit
path, rather than the measured React change handler alone. They do not identify
a specific function, prove a garbage-collection cause, or establish how much
of the frame delay is layout, rendering, scheduling, or test instrumentation.
This was phase timing, not a sampled CPU profile or a real GitHub load.
